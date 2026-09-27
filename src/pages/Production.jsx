// src/pages/Production.jsx
//
// Bakery production: what was baked, from what, and what it cost.
//
// The whole feature is one form and one history table, because that is
// genuinely all a bakery needs from software. A production run does two
// things atomically — finished goods in, ingredients out — and records
// that it happened. There is no work order, no routing, no shop floor and
// no scheduling: that is manufacturing ERP, and the brief is explicit
// that FlowBiz is not becoming one.
//
// The important correctness property is in utils/inventory.js, not here:
// an item marked "made in advance" has its ingredients consumed HERE and
// nowhere else, so selling a loaf later takes only the loaf. Deducting
// flour in both places is the bug this whole distinction exists to
// prevent, and it is covered by inventory.test.js.

import { useMemo, useState } from 'react';
import { doc, collection, writeBatch, orderBy, where, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ChefHat } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useIndustry } from '../hooks/useIndustry';
import { tenantQuery, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import Money from '../components/ui/Money';
import { formatDateTime } from '../utils/dateRanges';
import { formatQuantityWithUnit, unitStep, getUnit, DEFAULT_UNIT } from '../industry/units';
import { isProducedInAdvance, weightedAverageCost } from '../utils/inventory';
import { applyStockDeltas, stockMovement } from '../utils/stockWrites';
import { buildBatchDocument } from '../utils/batches';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';
// THE PRODUCTION ENGINE. The screen used to call a simpler resolver that
// assumed what came out equalled what was planned, skipped a missing
// ingredient, and deducted a made-to-order dough's own (non-existent)
// stock. The planner below costs a short yield over what actually came
// out, refuses a run it cannot cost, follows sub-recipes to the flour,
// and dates a run of anything with a shelf life.
import { planProduction, productionDeltas, buildProductionRecord, shelfLifeDaysOf } from '../domain/fnb/production';
import { recipeYieldOf } from '../domain/fnb/costing';

export default function Production() {
  const { businessId, profile } = useAuth();
  const industry = useIndustry();
  const batchesOn = industry.can('batches');

  const productsQ = useMemo(
    () => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null),
    [businessId]
  );
  const runsQ = useMemo(
    () => (businessId ? tenantQuery('productions', businessId, orderBy('producedAt', 'desc'), limit(50)) : null),
    [businessId]
  );
  const { data: products, loading } = useFirestoreCollection(productsQ);
  const { data: runs } = useFirestoreCollection(runsQ);

  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [actual, setActual] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Only items explicitly marked "made in advance" can be produced.
  // Something assembled to order already consumes its ingredients at the
  // sale, so producing it here would take them a second time.
  const makeable = useMemo(
    () => products.filter(isProducedInAdvance).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [products]
  );

  const selected = useMemo(
    () => products.find((p) => p.id === productId) || null,
    [products, productId]
  );
  const unit = selected?.unit || DEFAULT_UNIT;
  const yieldPerBatch = selected ? recipeYieldOf(selected) : 1;
  // With a batch size of one, "how many batches" and "how many items" are
  // the same question, and it is asked the simple way.
  const byBatch = yieldPerBatch > 1;

  const plan = useMemo(() => {
    if (!selected) return null;
    const runs = Number(quantity) || 0;
    if (runs <= 0) return null;
    return planProduction(selected, products, {
      batches: byBatch ? runs : runs / yieldPerBatch,
      actualQuantity: actual === '' ? null : actual,
    });
  }, [selected, products, quantity, actual, byBatch, yieldPerBatch]);

  const blocked = !plan
    ? null
    : plan.problem
      || (plan.missing ? 'One of the ingredients no longer exists. Fix the recipe first.' : null)
      || (plan.shortfall ? 'There is not enough of one of the ingredients. Record a purchase first, or make fewer.' : null)
      || (plan.plannedQuantity <= 0 ? 'Enter how much you made.' : null)
      || (plan.quantity < 0 ? 'What came out cannot be less than nothing.' : null);

  const handleProduce = async (e) => {
    e.preventDefault();
    if (!selected || !plan || busy) return;
    if (blocked) {
      toast.error(blocked);
      return;
    }

    setBusy(true);
    try {
      // Finished goods in and ingredients out in ONE batch: a run that
      // half-applied would leave a bakery with loaves it never had the
      // flour for. Offline this queues as a single atomic mutation.
      const batch = writeBatch(db);
      const runRef = doc(collection(db, 'productions'));
      const movement = stockMovement('productions', runRef.id);

      // The finished item's cost price becomes the WEIGHTED AVERAGE of the
      // stock already on the shelf and this run — whose own unit cost is
      // the whole batch's ingredient cost over what ACTUALLY came out, so
      // two loaves stuck to the tin are carried by the eighteen that did
      // not. Overwriting it with this run's cost used to reprice every
      // loaf baked yesterday.
      const productFields = plan.quantity > 0 && plan.unitCost > 0
        ? {
          [selected.id]: {
            costPrice: weightedAverageCost({
              currentStock: selected.stock,
              currentCost: selected.costPrice,
              receivedQuantity: plan.quantity,
              receivedCost: plan.unitCost,
            }),
          },
        }
        : null;
      applyStockDeltas(batch, productionDeltas(plan, products), { productFields, movement });

      const record = buildProductionRecord(plan, {
        note, producedBy: profile.uid, producedByName: profile.displayName,
      });

      // A DATED LOT for anything with a shelf life, when the business
      // tracks batches: bread made on Monday is not Thursday's bread, and
      // the till sells it oldest first.
      if (batchesOn && plan.quantity > 0 && shelfLifeDaysOf(selected)) {
        const lotRef = doc(collection(db, 'productBatches'));
        batch.set(lotRef, withBusiness({ ...buildBatchDocument({
          productId: selected.id,
          productName: selected.name,
          batchNumber: `RUN-${runRef.id.slice(-6).toUpperCase()}`,
          expiryDate: plan.expiryDate,
          quantity: plan.quantity,
          costPrice: plan.unitCost,
          unit,
          receivedBy: profile.uid,
          receivedByName: profile.displayName,
        }), productionId: runRef.id }, businessId));
        record.batchId = lotRef.id;
        if (plan.expiryDate) record.expiryDate = plan.expiryDate;
      }

      // A RUN THAT PRODUCED NOTHING still used its ingredients, and with
      // nothing to carry their cost it would vanish from the books. It is
      // recorded as waste — the ingredients already came out above, so
      // this is the money only, never a second stock movement.
      if (plan.quantity === 0 && plan.totalCost > 0) {
        batch.set(doc(collection(db, 'waste')), withBusiness({
          productId: selected.id,
          productName: selected.name,
          quantity: plan.plannedQuantity,
          ...(unit !== DEFAULT_UNIT ? { unit } : {}),
          reason: 'prep',
          unitCost: plan.plannedQuantity > 0 ? Math.round((plan.totalCost / plan.plannedQuantity) * 100) / 100 : 0,
          totalCost: plan.totalCost,
          note: 'Production run that produced nothing. Ingredients already deducted by the run.',
          productionId: runRef.id,
          stockAlreadyMoved: true,
          recordedBy: profile.uid,
          recordedByName: profile.displayName,
          recordedAt: new Date(),
        }, businessId));
      }

      batch.set(runRef, withBusiness(record, businessId));

      const commit = batch.commit();
      const { queuedOffline, error } = await raceWithTimeout(commit, 4000, { label: `The production run of ${selected.name}` });
      if (error) throw error;

      toast.success(
        queuedOffline
          ? 'Production saved offline. It will sync when you reconnect.'
          : plan.quantity > 0
            ? `${formatQuantityWithUnit(plan.quantity, unit, { showPiece: true })} of ${selected.name} added to stock.`
            : 'Recorded. The ingredients have been taken off and the loss recorded as waste.'
      );
      setQuantity('');
      setActual('');
      setNote('');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading production…" />;

  return (
    // Full width. The tables and strips below run to the edge of the
    // content area, which a centred column would stop short of; the
    // 1800px ceiling lives in AppShell so every page shares one.
    <div className="space-y-6">
      <PageHeader
        title="Production"
        description="Record a batch you have made. Ingredients come out, finished goods go in."
      />

      {makeable.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="Nothing is set up to be made in advance"
          description="Open a product, list its ingredients, and tick “Made in advance”. It will then appear here."
        />
      ) : (
        <form onSubmit={handleProduce} className="panel-measure space-y-4 p-4 sm:max-w-2xl">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">What did you make?</label>
              <select
                className="input"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                disabled={busy}
                required
              >
                <option value="" disabled>Choose an item</option>
                {makeable.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                {byBatch ? `How many batches? (${yieldPerBatch} each)` : 'How many?'}
                {!byBatch && unit !== DEFAULT_UNIT && <span className="ml-1 font-normal normal-case text-ink-400">({getUnit(unit).short})</span>}
              </label>
              <input
                type="number"
                min={byBatch ? 1 : unitStep(unit)}
                step={byBatch ? 1 : unitStep(unit)}
                inputMode={byBatch || unit === DEFAULT_UNIT ? 'numeric' : 'decimal'}
                className="input"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={busy || !selected}
                required
              />
            </div>
          </div>

          {plan && (
            <div>
              <label className="label">
                How many actually came out? <span className="font-normal normal-case text-ink-400">(if different)</span>
              </label>
              <input
                type="number"
                min="0"
                step={unitStep(unit)}
                inputMode={unit === DEFAULT_UNIT ? 'numeric' : 'decimal'}
                className="input"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder={String(plan.plannedQuantity)}
                disabled={busy}
              />
            </div>
          )}

          {plan && (
            <div className="space-y-2 rounded-panel border border-line bg-ink-50 p-3">
              <p className="text-label uppercase text-ink-500">This run will use</p>
              <ul className="space-y-1">
                {plan.components.map((component) => (
                  <li key={component.componentId} className="flex items-baseline justify-between gap-3 text-secondary">
                    <span className={component.missing ? 'text-danger-700' : 'text-ink-700'}>{component.componentName}</span>
                    <span className={`num ${component.short ? 'font-semibold text-danger-700' : 'text-ink-600'}`}>
                      {formatQuantityWithUnit(component.quantity, component.unit, { showPiece: true })}
                      {component.available !== null && (
                        <span className="text-ink-400">
                          {' of '}{formatQuantityWithUnit(component.available, component.unit, { showPiece: true })}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-baseline justify-between border-t border-line pt-2 text-body">
                <span className="text-ink-600">Cost of this batch</span>
                <span className="font-semibold text-ink-900"><Money value={plan.totalCost} /></span>
              </div>
              {plan.quantity > 0 && (
                <div className="flex items-baseline justify-between text-secondary">
                  <span className="text-ink-600">Cost per item</span>
                  <span className="num text-ink-900"><Money value={plan.unitCost} /></span>
                </div>
              )}
              {plan.yieldVariance < 0 && (
                <p className="text-secondary text-ink-600">
                  {formatQuantityWithUnit(-plan.yieldVariance, unit, { showPiece: true })} short of plan. Their cost is carried by what came out.
                </p>
              )}
              {blocked && <p className="text-secondary font-medium text-danger-700">{blocked}</p>}
            </div>
          )}

          <div>
            <label className="label">Note <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. morning bake"
              disabled={busy}
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={busy || !plan || Boolean(blocked)}>
            {busy ? 'Recording…' : 'Record production'}
          </button>
        </form>
      )}

      <Section title="Recent production" hint="The last 50 runs.">
        <DataTable
          bleed
          caption="Production runs"
          rows={runs}
          rowKey={(r) => r.id}
          mobileLayout="row"
          columns={[
            { key: 'productName', header: 'Item', primary: true, render: (r) => r.productName },
            {
              key: 'quantity', header: 'Made', numeric: true, mobileTrailing: true,
              render: (r) => <span className="num font-semibold text-ink-900">{formatQuantityWithUnit(r.quantity, r.unit, { showPiece: true })}</span>,
            },
            { key: 'totalCost', header: 'Cost', numeric: true, mobileTrailing: true, render: (r) => <Money value={r.totalCost} /> },
            { key: 'producedByName', header: 'By', render: (r) => <span className="text-ink-600">{r.producedByName || 'Staff'}</span> },
            { key: 'producedAt', header: 'When', render: (r) => <span className="text-ink-600">{formatDateTime(r.producedAt)}</span> },
          ]}
          empty={<EmptyState icon={ChefHat} title="No production recorded yet" description="Batches you record appear here." />}
        />
      </Section>
    </div>
  );
}
