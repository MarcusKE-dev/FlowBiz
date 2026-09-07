// src/pages/Waste.jsx
//
// WHAT WAS THROWN AWAY, why, and what it cost.
//
// THE HOLE THIS FILLS. FlowBiz had two ways for stock to go down — a sale
// and a stock take — so everything a kitchen actually loses had to be
// entered as a stock-take "correction" with a free-text note, or not
// entered at all.
//
// That is wrong in the STOCK ledger, because a count is not a movement: a
// count says "the shelf holds nine" and loses the fact that one was
// dropped. And it is wrong in the MONEY, because cost of goods sold is
// computed from what was SOLD, so stock that vanished without a sale
// carried no cost at all and the business's recorded profit was
// overstated by the value of everything it binned.
//
// Recorded waste now reaches net profit. See utils/financials.js.
//
// THE SCREEN IS A FORM AND A LIST, deliberately, because the only thing
// that makes waste recording work is that it takes ten seconds. Waste
// that is awkward to record is waste that gets buried in the next count.

import { useMemo, useState } from 'react';
import { doc, collection, writeBatch, orderBy, where, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useIndustry } from '../hooks/useIndustry';
import { tenantQuery, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import MetricRail, { Metric } from '../components/ui/MetricRail';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import Money from '../components/ui/Money';
import { amountOnly } from '../components/ui/format';
import { formatDateTime, startOfDay } from '../utils/dateRanges';
import { formatQuantityWithUnit, unitStep, getUnit, DEFAULT_UNIT, roundQuantity } from '../industry/units';
import { hasVariants } from '../utils/variants';
import { applyStockDeltas } from '../utils/stockWrites';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';
import { roundMoney } from '../utils/currency';
import {
  WASTE_REASONS, DEFAULT_WASTE_REASON, MAX_WASTE_NOTE,
  buildWasteRecord, resolveWasteDeltas, summarizeWaste, wasteByProduct, isWastable,
  wasteReasonLabel,
} from '../domain/fnb/waste';

/** The last 30 days: enough to see a pattern, short enough to stay cheap. */
function thirtyDaysAgo() {
  const date = startOfDay();
  date.setDate(date.getDate() - 30);
  return date;
}

export default function Waste() {
  const { businessId, profile } = useAuth();
  const industry = useIndustry();
  const since = useMemo(() => thirtyDaysAgo(), []);

  const productsQ = useMemo(
    () => (businessId
      ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name'))
      : null),
    [businessId]
  );
  const wasteQ = useMemo(
    () => (businessId
      ? tenantQuery('waste', businessId, where('recordedAt', '>=', since), orderBy('recordedAt', 'desc'), limit(200))
      : null),
    [businessId, since]
  );
  const batchesQ = useMemo(
    () => (businessId && industry.can('batches')
      ? tenantQuery('productBatches', businessId, orderBy('expiryDate', 'asc'))
      : null),
    [businessId, industry]
  );

  const { data: products, loading } = useFirestoreCollection(productsQ);
  const { data: records } = useFirestoreCollection(wasteQ);
  const { data: batches } = useFirestoreCollection(batchesQ);

  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState(DEFAULT_WASTE_REASON);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Only something with stock of its own can be thrown away. A service
  // cannot, and neither can a dish assembled to order — what was lost in
  // that case is its ingredients, and they are what gets recorded.
  const wastable = useMemo(
    () => products.filter(isWastable).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [products]
  );

  const selected = useMemo(() => products.find((p) => p.id === productId) || null, [products, productId]);
  const unit = selected?.unit || DEFAULT_UNIT;
  const qty = roundQuantity(Number(quantity) || 0, unit);
  const cost = roundMoney(qty * (Number(selected?.costPrice) || 0));

  const productBatches = useMemo(
    () => (selected ? batches.filter((b) => b.productId === selected.id && (Number(b.remainingQuantity) || 0) > 0) : []),
    [batches, selected]
  );

  const summary = useMemo(() => summarizeWaste(records), [records]);
  const worst = useMemo(() => wasteByProduct(records).slice(0, 8), [records]);

  const available = useMemo(() => {
    if (!selected) return 0;
    if (batchId) {
      const batch = productBatches.find((b) => b.id === batchId);
      return roundQuantity(Number(batch?.remainingQuantity) || 0, unit);
    }
    if (variantId) return roundQuantity(Number(selected.variantStock?.[variantId]) || 0, unit);
    return roundQuantity(Number(selected.stock) || 0, unit);
  }, [selected, variantId, batchId, productBatches, unit]);

  const tooMuch = qty > available;

  const reset = () => {
    setProductId(''); setVariantId(''); setBatchId('');
    setQuantity(''); setReason(DEFAULT_WASTE_REASON); setNote('');
  };

  const handleRecord = async (e) => {
    e.preventDefault();
    if (!selected || qty <= 0 || busy || tooMuch) return;

    const variant = variantId ? (selected.variants || []).find((v) => v.id === variantId) : null;
    const batch = batchId ? productBatches.find((b) => b.id === batchId) : null;
    const record = buildWasteRecord(
      {
        quantity: qty, reason, note,
        variantId: variantId || null, variantLabel: variant?.label || null,
        batchId: batchId || null, batchLabel: batch?.batchNumber || batch?.expiryDate || null,
      },
      selected,
      { recordedBy: profile.uid, recordedByName: profile.displayName }
    );
    if (!record) { toast.error('That cannot be recorded as waste.'); return; }

    setBusy(true);
    try {
      // The record and the stock movement in ONE batch, through the same
      // adapter every other movement in the product uses. They can never
      // diverge, and offline the whole thing queues as one mutation.
      const batchWrite = writeBatch(db);
      applyStockDeltas(batchWrite, resolveWasteDeltas([record], products));
      batchWrite.set(doc(collection(db, 'waste')), withBusiness(record, businessId));

      const commit = batchWrite.commit();
      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      if (queuedOffline) commit.catch((err) => toast.error(`Waste couldn't be saved: ${friendlyErrorMessage(err)}`));

      toast.success(queuedOffline
        ? 'Recorded offline. It will sync when you reconnect.'
        : `${formatQuantityWithUnit(qty, unit, { showPiece: true })} of ${selected.name} recorded.`);
      reset();
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading…" />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Waste"
        description="Stock that was spoiled, broken or thrown away. It comes off the shelf and off the profit."
      />

      <MetricRail columns={3}>
        <Metric label="Wasted, 30 days" prefix="KES" value={amountOnly(summary.totalCost)} />
        <Metric label="Spoiled or out of date" prefix="KES" value={amountOnly(summary.byReason.spoilage + summary.byReason.expiry)} />
        <Metric label="Entries" value={summary.count} />
      </MetricRail>

      {wastable.length === 0 ? (
        <EmptyState icon={Trash2} title="Nothing to record waste against" description="Add a product with stock first." />
      ) : (
        <form onSubmit={handleRecord} className="space-y-4 rounded-panel border border-line bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">What was thrown away?</label>
              <select
                className="input"
                value={productId}
                onChange={(e) => { setProductId(e.target.value); setVariantId(''); setBatchId(''); }}
                disabled={busy}
                required
              >
                <option value="" disabled>Choose an item</option>
                {wastable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">
                How much?
                {unit !== DEFAULT_UNIT && <span className="ml-1 font-normal normal-case text-ink-400">({getUnit(unit).short})</span>}
              </label>
              <input
                type="number" min={unitStep(unit)} step={unitStep(unit)}
                inputMode={unit === DEFAULT_UNIT ? 'numeric' : 'decimal'}
                className="input" value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={busy || !selected} required
              />
              {selected && (
                <p className={`mt-1 text-secondary ${tooMuch ? 'text-danger-700' : 'text-ink-500'}`}>
                  {formatQuantityWithUnit(available, unit, { showPiece: true })} on hand
                  {tooMuch ? ' — you cannot throw away more than there is.' : ''}
                </p>
              )}
            </div>
          </div>

          {selected && hasVariants(selected) && (
            <div>
              <label className="label">Which one?</label>
              <select className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)} disabled={busy}>
                <option value="">All / not specific</option>
                {(selected.variants || []).map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
          )}

          {/* You throw away the box that went off, not the earliest one, so
              a batch is CHOSEN here rather than allocated by FEFO. */}
          {productBatches.length > 0 && (
            <div>
              <label className="label">Which batch?</label>
              <select className="input" value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={busy}>
                <option value="">Not from a specific batch</option>
                {productBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {[b.batchNumber, b.expiryDate].filter(Boolean).join(' · ')}
                    {` — ${formatQuantityWithUnit(b.remainingQuantity, unit, { showPiece: true })} left`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Why?</label>
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy}>
                {WASTE_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Note <span className="font-normal normal-case text-ink-300">(optional)</span></label>
              <input
                className="input" value={note} maxLength={MAX_WASTE_NOTE}
                onChange={(e) => setNote(e.target.value)} disabled={busy}
                placeholder="e.g. fridge failed overnight"
              />
            </div>
          </div>

          {selected && qty > 0 && (
            <div className="flex items-baseline justify-between rounded-panel border border-line bg-ink-50 px-3 py-2">
              <span className="text-secondary text-ink-600">What this cost</span>
              <span className="text-body font-semibold text-danger-700"><Money value={cost} /></span>
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy || !selected || qty <= 0 || tooMuch}>
            {busy ? 'Recording…' : 'Record waste'}
          </button>
        </form>
      )}

      {worst.length > 0 && (
        <Section title="Where it is going" hint="The last 30 days, worst first.">
          <ul className="divide-y divide-divider">
            {worst.map((row) => (
              <li key={row.productId} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-body text-ink-900">{row.productName}</span>
                <span className="shrink-0 text-secondary text-ink-500">
                  {formatQuantityWithUnit(row.quantity, row.unit, { showPiece: true })}
                </span>
                <span className="num shrink-0 text-body font-semibold text-ink-900"><Money value={row.totalCost} /></span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Recorded waste" hint="The last 30 days.">
        <DataTable
          caption="Waste records"
          rows={records}
          rowKey={(r) => r.id}
          mobileLayout="row"
          columns={[
            { key: 'productName', header: 'Item', primary: true, render: (r) => r.productName },
            {
              key: 'quantity', header: 'Amount', numeric: true, mobileTrailing: true,
              render: (r) => <span className="num">{formatQuantityWithUnit(r.quantity, r.unit, { showPiece: true })}</span>,
            },
            { key: 'reason', header: 'Why', render: (r) => <span className="text-ink-600">{wasteReasonLabel(r.reason)}</span> },
            { key: 'totalCost', header: 'Cost', numeric: true, mobileTrailing: true, render: (r) => <Money value={r.totalCost} /> },
            { key: 'recordedByName', header: 'By', render: (r) => <span className="text-ink-600">{r.recordedByName || 'Staff'}</span> },
            { key: 'recordedAt', header: 'When', render: (r) => <span className="text-ink-600">{formatDateTime(r.recordedAt)}</span> },
          ]}
          empty={<EmptyState icon={Trash2} title="No waste recorded" description="Nothing has been written off in the last 30 days." />}
        />
      </Section>
    </div>
  );
}
