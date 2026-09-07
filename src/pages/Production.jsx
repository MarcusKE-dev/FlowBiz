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
import { tenantQuery, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import Money from '../components/ui/Money';
import { formatDateTime } from '../utils/dateRanges';
import { formatQuantityWithUnit, unitStep, getUnit, DEFAULT_UNIT, roundQuantity } from '../industry/units';
import { resolveProductionDeltas, productionUnitCost, isProducedInAdvance } from '../utils/inventory';
import { applyStockDeltas } from '../utils/stockWrites';
import { roundMoney } from '../utils/currency';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Production() {
  const { businessId, profile } = useAuth();

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
  const madeQty = roundQuantity(Number(quantity) || 0, unit);
  const unitCost = useMemo(
    () => (selected ? productionUnitCost(selected, 1, products) : 0),
    [selected, products]
  );
  const totalCost = roundMoney(unitCost * madeQty);

  const deltas = useMemo(
    () => (selected && madeQty > 0 ? resolveProductionDeltas(selected, madeQty, products) : {}),
    [selected, madeQty, products]
  );

  // What the run would leave behind. Shown before committing, because a
  // baker who is about to go 3 kg short of flour should find out now.
  const componentPreview = useMemo(() => {
    if (!selected) return [];
    return (selected.recipe || []).map((line) => {
      const component = products.find((p) => p.id === line.componentId);
      const componentUnit = component?.unit || DEFAULT_UNIT;
      const needed = roundQuantity(madeQty * (Number(line.quantity) || 0), componentUnit);
      const available = roundQuantity(Number(component?.stock) || 0, componentUnit);
      return {
        id: line.componentId,
        name: component?.name || line.componentName || 'Missing ingredient',
        unit: componentUnit,
        needed,
        available,
        short: component ? needed > available : false,
        missing: !component,
      };
    });
  }, [selected, madeQty, products]);

  const shortfall = componentPreview.some((c) => c.short);

  const handleProduce = async (e) => {
    e.preventDefault();
    if (!selected || madeQty <= 0 || busy) return;
    if (shortfall) {
      toast.error('There is not enough of one of the ingredients.');
      return;
    }

    setBusy(true);
    try {
      // Finished goods in and ingredients out in ONE batch: a run that
      // half-applied would leave a bakery with loaves it never had the
      // flour for. Offline this queues as a single atomic mutation.
      const batch = writeBatch(db);

      // The finished item's cost price becomes what this run ACTUALLY
      // cost — the current price of the flour, the sugar and the yeast
      // that went into it — set in the SAME update as its stock movement.
      // Without this the loaf kept whatever cost somebody typed when they
      // created it, so every gross-profit figure a bakery reads (the
      // counter's estimate, reports, close day, inventory valuation) was
      // computed against a stale number that only drifted further from
      // the truth as ingredient prices moved.
      //
      // Only when the run produced a real cost: a recipe whose components
      // have no cost prices yet must not overwrite a sensible typed
      // figure with zero.
      applyStockDeltas(batch, deltas, {
        productFields: unitCost > 0 ? { [selected.id]: { costPrice: unitCost } } : null,
      });

      const runRef = doc(collection(db, 'productions'));
      batch.set(runRef, withBusiness({
        productId: selected.id,
        productName: selected.name,
        quantity: madeQty,
        ...(unit !== DEFAULT_UNIT ? { unit } : {}),
        unitCost,
        totalCost,
        components: componentPreview.map((c) => ({
          componentId: c.id, componentName: c.name, quantity: c.needed,
          ...(c.unit !== DEFAULT_UNIT ? { unit: c.unit } : {}),
        })),
        note: note.trim().slice(0, 300),
        producedBy: profile.uid,
        producedByName: profile.displayName,
        producedAt: new Date(),
      }, businessId));

      const commit = batch.commit();
      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      if (queuedOffline) commit.catch((err) => toast.error(`A production run couldn't be saved: ${friendlyErrorMessage(err)}`));

      toast.success(
        queuedOffline
          ? 'Production saved offline. It will sync when you reconnect.'
          : `${formatQuantityWithUnit(madeQty, unit, { showPiece: true })} of ${selected.name} added to stock.`
      );
      setQuantity('');
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
                How many?
                {unit !== DEFAULT_UNIT && <span className="ml-1 font-normal normal-case text-ink-400">({getUnit(unit).short})</span>}
              </label>
              <input
                type="number"
                min={unitStep(unit)}
                step={unitStep(unit)}
                inputMode={unit === DEFAULT_UNIT ? 'numeric' : 'decimal'}
                className="input"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={busy || !selected}
                required
              />
            </div>
          </div>

          {selected && madeQty > 0 && (
            <div className="space-y-2 rounded-panel border border-line bg-ink-50 p-3">
              <p className="text-label uppercase text-ink-500">This run will use</p>
              <ul className="space-y-1">
                {componentPreview.map((component) => (
                  <li key={component.id} className="flex items-baseline justify-between gap-3 text-secondary">
                    <span className={component.missing ? 'text-danger-700' : 'text-ink-700'}>{component.name}</span>
                    <span className={`num ${component.short ? 'font-semibold text-danger-700' : 'text-ink-600'}`}>
                      {formatQuantityWithUnit(component.needed, component.unit, { showPiece: true })}
                      <span className="text-ink-400">
                        {' of '}{formatQuantityWithUnit(component.available, component.unit, { showPiece: true })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-baseline justify-between border-t border-line pt-2 text-body">
                <span className="text-ink-600">Cost of this batch</span>
                <span className="font-semibold text-ink-900"><Money value={totalCost} /></span>
              </div>
              {shortfall && (
                <p className="text-secondary font-medium text-danger-700">
                  There is not enough of one of the ingredients. Record a purchase first, or make fewer.
                </p>
              )}
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

          <button type="submit" className="btn-primary w-full" disabled={busy || !selected || madeQty <= 0 || shortfall}>
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
