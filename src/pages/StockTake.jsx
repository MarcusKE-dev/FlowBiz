// src/pages/StockTake.jsx
//
// A physical count, reconciled against what FlowBiz thinks is on the
// shelf.
//
// WHAT IS COUNTED, AND WHY IT IS NOT ALWAYS THE PRODUCT.
//
// FlowBiz holds three stock ledgers, and they are required to agree:
// `products.stock` is the total, `products.variantStock` breaks it down
// by version, and `productBatches.remainingQuantity` breaks it down by
// lot. A count that moved the total without moving the ledger behind it
// would leave a boutique's sizes or a pharmacy's batches quietly wrong —
// and the batch ledger is the one FEFO dispenses from, so a pharmacy
// would then sell out of a box that had already been emptied.
//
// So the sheet expands each product into the rows that actually exist on
// the shelf:
//
//   BATCH-TRACKED  → one countable row per batch. This is the option a
//     pharmacy needs and the one good-practice guidance describes: a
//     physical count is per lot, because the lot is what is physically
//     boxed, dated and reconciled. Spreading a single figure across
//     batches in FEFO order (the alternative) would INVENT per-batch
//     quantities nobody counted, and refusing the count outright would
//     leave the one profile that most needs reconciliation without it.
//
//   VERSIONED      → one countable row per version, and the product total
//     is the sum of the version adjustments.
//
//   EVERYTHING ELSE → one row, exactly as this page has always worked.
//     A General Retail shop sees precisely the sheet it saw before.
//
// The arithmetic lives in utils/inventory.js `resolveCountDeltas`, so the
// invariant — variant sum equals stock, batch sum equals stock — is a
// tested property rather than a promise made in a component.

import { useMemo, useRef, useState } from 'react';
import {
  doc,
  collection,
  writeBatch,
  orderBy,
  where,
  limit,
} from 'firebase/firestore';
import { formatDateTime } from '../utils/dateRanges';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { productUnit } from '../utils/lineItems';
import { isStockItem, resolveCountDeltas } from '../utils/inventory';
import { applyStockDeltas } from '../utils/stockWrites';
import { variantsOf } from '../utils/variants';
import { sortFefo, remainingOf } from '../utils/batches';
import { useIndustry } from '../hooks/useIndustry';
import { DEFAULT_UNIT, getUnit, unitStep, roundQuantity, formatQuantityWithUnit } from '../industry/units';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function StockTake() {
  const { profile, businessId } = useAuth();
  const industry = useIndustry();
  const batchesOn = industry.can('batches');

  // Products query
  const productsQ = useMemo(
    () =>
      businessId
        ? tenantQuery(
            'products',
            businessId,
            where('deleted', '!=', true),
            orderBy('deleted'),
            orderBy('name')
          )
        : null,
    [businessId]
  );

  const { data: allProducts, loading } = useFirestoreCollection(productsQ);
  // A stock take counts things. Services and dishes assembled to order
  // have nothing to count, so they are not rows to be left blank — they
  // are simply not on the sheet.
  const products = useMemo(() => allProducts.filter(isStockItem), [allProducts]);

  // Recent stock adjustments query
  // IMPORTANT: Hooks must be called at the top level of the component,
  // never inside handleSave or another callback.
  const adjustmentsQ = useMemo(
    () =>
      businessId
        ? tenantQuery(
            'stockAdjustments',
            businessId,
            orderBy('adjustedAt', 'desc'),
            limit(20)
          )
        : null,
    [businessId]
  );

  const { data: recentAdjustments } =
    useFirestoreCollection(adjustmentsQ);

  // Opened ONLY when batch tracking is on, so a shop that does not use
  // batches subscribes to nothing and pays for no reads it will not use.
  const batchesQ = useMemo(
    () => (businessId && batchesOn ? tenantQuery('productBatches', businessId) : null),
    [businessId, batchesOn]
  );
  const { data: batches } = useFirestoreCollection(batchesQ);

  const [counts, setCounts] = useState({});
  const [reasons, setReasons] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);

  const rowRefs = useRef({});

  // The countable rows. One per product for an ordinary shop — which is
  // exactly the sheet this page has always shown — and one per version or
  // per batch where those exist, because that is what is physically on
  // the shelf to be counted.
  const sheet = useMemo(() => {
    const rows = [];
    for (const p of products) {
      const unit = productUnit(p);
      const productBatches = batchesOn ? batches.filter((b) => b.productId === p.id) : [];
      const productVariants = variantsOf(p);

      // Versions and batches on the same product would need a count of
      // every combination, which no profile ships and which a paper count
      // sheet cannot express. Rather than write a figure that would leave
      // one of the two ledgers wrong, the row says so and is not counted.
      if (productBatches.length > 0 && productVariants.length > 0) {
        rows.push({
          key: p.id, product: p, unit, system: roundQuantity(Number(p.stock) || 0, unit),
          label: p.name, uncountable: 'This item has both versions and batches. Count it from the Expiry page, batch by batch.',
        });
        continue;
      }

      if (productBatches.length > 0) {
        for (const b of sortFefo(productBatches)) {
          rows.push({
            key: `${p.id}::batch::${b.id}`,
            product: p, unit, batchId: b.id,
            system: remainingOf(b, unit),
            label: p.name,
            sublabel: [b.batchNumber ? `Batch ${b.batchNumber}` : 'Unnumbered batch',
                       b.expiryDate ? `exp ${b.expiryDate}` : 'no expiry date'].join(' · '),
          });
        }
        continue;
      }

      if (productVariants.length > 0) {
        for (const v of productVariants) {
          rows.push({
            key: `${p.id}::variant::${v.id}`,
            product: p, unit, variantId: v.id,
            system: v.stock, label: p.name, sublabel: v.label,
          });
        }
        continue;
      }

      rows.push({ key: p.id, product: p, unit, system: roundQuantity(Number(p.stock) || 0, unit), label: p.name });
    }
    return rows;
  }, [products, batches, batchesOn]);

  const getPhysical = (row) =>
    counts[row.key] !== undefined && counts[row.key] !== ''
      ? counts[row.key]
      : row.system;

  // Counted minus system, rounded to the row's own unit. Without the
  // rounding a shop counting 9.7 m against a system figure that has
  // drifted to 9.699999999999999 sees a phantom difference of 1e-15 and
  // an adjustment row it never asked for.
  const diffFor = (row) => {
    if (row.uncountable) return 0;
    if (counts[row.key] === undefined || counts[row.key] === '') return 0;
    return roundQuantity(roundQuantity(Number(counts[row.key]) || 0, row.unit) - row.system, row.unit);
  };

  const changed = sheet.filter((row) => diffFor(row) !== 0);

  const handleScanDetected = (code) => {
    setScannerOpen(false);

    const found = findProductByCode(products, code);

    if (!found) {
      toast.error('Product not found.');
      return;
    }

    // A scan lands on the product's FIRST countable row — its earliest
    // batch, or its first version — because that is where a counter with
    // a scanner in one hand starts.
    const first = sheet.find((row) => row.product.id === found.id);
    if (!first) {
      toast.error('Product not found.');
      return;
    }

    rowRefs.current[first.key]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    const inputEl =
      document.getElementById(`stocktake-count-${first.key}`) ||
      document.getElementById(`stocktake-count-mobile-${first.key}`);

    inputEl?.focus();
    inputEl?.select?.();
  };

  useHardwareScanner(handleScanDetected, {
    enabled: !scannerOpen && !confirm,
  });

  const handleSave = async () => {
    setSaving(true);

    try {
      const batch = writeBatch(db);

      // Every movement — product total, version and batch remainder — is
      // resolved by the one inventory foundation and written by the one
      // adapter, in the SAME atomic commit as the adjustment records. That
      // is what keeps the three ledgers in step: a count that adjusts a
      // batch by −4 adjusts the product total by −4 too, and there is no
      // window, online or offline, where only one of them landed.
      const deltas = resolveCountDeltas(
        changed.map((row) => ({
          productId: row.product.id,
          variantId: row.variantId,
          batchId: row.batchId,
          counted: getPhysical(row),
          systemQuantity: row.system,
        })),
        products,
        { batches }
      );
      applyStockDeltas(batch, deltas);

      for (const row of changed) {
        const physicalQty = roundQuantity(Number(getPhysical(row)) || 0, row.unit);
        const difference = diffFor(row);
        const adjRef = doc(collection(db, 'stockAdjustments'));

        // The adjustment record keeps the shape every existing reader
        // expects — productId, productName, systemQty, physicalQty,
        // difference, reason — and names the version or batch only when
        // there is one, so documents written before this stay valid and
        // read identically.
        batch.set(adjRef, {
          businessId,
          productId: row.product.id,
          productName: row.product.name,
          systemQty: row.system,
          physicalQty,
          ...(row.unit !== DEFAULT_UNIT ? { unit: row.unit } : {}),
          ...(row.variantId ? { variantId: row.variantId, variantLabel: row.sublabel } : {}),
          ...(row.batchId ? { batchId: row.batchId, batchLabel: row.sublabel } : {}),
          difference,
          reason: reasons[row.key] || '',
          adjustedBy: profile.uid,
          adjustedByName: profile.displayName,
          adjustedAt: new Date(),
        });
      }

      const { queuedOffline, error } = await raceWithTimeout(
        batch.commit(),
        4000
      );

      if (error) {
        throw error;
      }

      toast.success(
        queuedOffline
          ? 'Stock take queued offline.'
          : `Stock take saved. ${changed.length} line${changed.length === 1 ? '' : 's'} adjusted.`
      );

      setCounts({});
      setReasons({});
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Stock take"
        description="Enter physical counts, or scan to jump to a product. Leave a count blank to keep it unchanged."
        actions={
          <button
            className="btn-primary"
            disabled={changed.length === 0}
            onClick={() => setConfirm(true)}
          >
            {changed.length === 0
              ? 'Save stock take'
              : `Save ${changed.length} change${changed.length === 1 ? '' : 's'}`}
          </button>
        }
      />

      {/* Mobile. This page keeps its own two-branch layout rather than
          using DataTable: it is a data-entry grid, and every row owns a
          focusable input that the scanner jumps to. */}
      <div className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface sm:hidden">
        {sheet.map((row) => {
          const diff = diffFor(row);

          return (
            <div
              key={row.key}
              ref={(el) => {
                rowRefs.current[row.key] = el;
              }}
              className={`space-y-3 p-4 transition-colors ${
                selectedProductId === row.key
                  ? 'bg-primary-50'
                  : diff !== 0
                    ? 'bg-warning-50/50'
                    : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-body font-medium text-ink-900">
                  <span className="block truncate">{row.label}</span>
                  {row.sublabel && (
                    <span className="block truncate text-secondary font-normal text-ink-500">{row.sublabel}</span>
                  )}
                </span>

                <span className="shrink-0 text-label leading-4 text-ink-500">
                  System <span className="num ml-1 text-ink-700">{formatQuantityWithUnit(row.system, row.unit)}</span>
                </span>
              </div>

              {row.uncountable ? (
                <p className="text-secondary text-ink-500">{row.uncountable}</p>
              ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">
                    Physical count
                    {row.unit !== DEFAULT_UNIT && (
                      <span className="ml-1 font-normal normal-case text-ink-400">({getUnit(row.unit).short})</span>
                    )}
                  </label>

                  <input
                    id={`stocktake-count-mobile-${row.key}`}
                    type="number"
                    min="0"
                    step={unitStep(row.unit)}
                    inputMode={row.unit === DEFAULT_UNIT ? 'numeric' : 'decimal'}
                    className="input"
                    value={counts[row.key] ?? ''}
                    placeholder={String(row.system)}
                    onFocus={() => setSelectedProductId(row.key)}
                    onBlur={() => setSelectedProductId(null)}
                    onChange={(e) =>
                      setCounts((c) => ({
                        ...c,
                        [row.key]: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="label">Difference</label>

                  <div
                    className={`input num flex items-center font-semibold ${
                      diff < 0
                        ? 'text-danger-700'
                        : diff > 0
                          ? 'text-primary-700'
                          : 'text-ink-400'
                    }`}
                  >
                    {diff !== 0
                      ? diff > 0
                        ? `+${diff}`
                        : diff
                      : '0'}
                  </div>
                </div>
              </div>
              )}

              {diff !== 0 && (
                <div>
                  <label className="label">
                    Reason for discrepancy
                  </label>

                  <input
                    className="input"
                    placeholder="e.g. damage, theft, expired"
                    value={reasons[row.key] || ''}
                    onChange={(e) =>
                      setReasons((r) => ({
                        ...r,
                        [row.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-panel border border-line bg-surface sm:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-cell">
            <thead className="border-b border-line text-left text-label uppercase text-ink-500">
              <tr>
                <th scope="col" className="px-3 py-2">Product</th>
                <th scope="col" className="px-3 py-2 text-right">System</th>
                <th scope="col" className="px-3 py-2">Physical count</th>
                <th scope="col" className="px-3 py-2 text-right">Difference</th>
                <th scope="col" className="px-3 py-2">Reason</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-divider">
              {sheet.map((row) => {
                const diff = diffFor(row);

                return (
                  <tr
                    key={row.key}
                    ref={(el) => {
                      rowRefs.current[row.key] = el;
                    }}
                    className={`transition-colors ${
                      selectedProductId === row.key
                        ? 'bg-primary-50'
                        : diff !== 0
                          ? 'bg-warning-50/50'
                          : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-ink-900">
                      {row.label}
                      {row.sublabel && (
                        <span className="block text-secondary font-normal text-ink-500">{row.sublabel}</span>
                      )}
                    </td>

                    <td className="num px-3 py-2 text-right text-ink-600">
                      {formatQuantityWithUnit(row.system, row.unit)}
                    </td>

                    <td className="px-3 py-2">
                      {row.uncountable ? (
                        <span className="text-secondary text-ink-500">{row.uncountable}</span>
                      ) : (
                        <input
                          id={`stocktake-count-${row.key}`}
                          type="number"
                          min="0"
                          step={unitStep(row.unit)}
                          inputMode={row.unit === DEFAULT_UNIT ? 'numeric' : 'decimal'}
                          className="input num !w-24 text-right"
                          value={counts[row.key] ?? ''}
                          placeholder={String(row.system)}
                          onFocus={() => setSelectedProductId(row.key)}
                          onBlur={() => setSelectedProductId(null)}
                          onChange={(e) =>
                            setCounts((c) => ({
                              ...c,
                              [row.key]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </td>

                    <td
                      className={`num px-3 py-2 text-right font-semibold ${
                        diff < 0
                          ? 'text-danger-700'
                          : diff > 0
                            ? 'text-primary-700'
                            : 'text-ink-400'
                      }`}
                    >
                      {diff !== 0
                        ? diff > 0
                          ? `+${diff}`
                          : diff
                        : '-'}
                    </td>

                    <td className="px-3 py-2">
                      <input
                        className="input"
                        placeholder="e.g. breakage, theft"
                        value={reasons[row.key] || ''}
                        disabled={diff === 0}
                        onChange={(e) =>
                          setReasons((r) => ({
                            ...r,
                            [row.key]: e.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent adjustments */}
      {recentAdjustments.length > 0 && (
        <Section title="Recent stock adjustments">
          <div className="divide-y divide-divider overflow-hidden rounded-panel border border-line bg-surface">
            {recentAdjustments.map((a) => (
              <div key={a.id} className="px-4 py-2.5 text-body">
                <div className="flex items-center justify-between">
                  <span className="min-w-0 truncate font-medium text-ink-900">
                    {a.productName}
                    {(a.variantLabel || a.batchLabel) && (
                      <span className="font-normal text-ink-500"> · {a.variantLabel || a.batchLabel}</span>
                    )}
                  </span>

                  <span
                    className={`num shrink-0 font-semibold ${
                      a.difference < 0
                        ? 'text-danger-700'
                        : 'text-primary-700'
                    }`}
                  >
                    {formatQuantityWithUnit(a.systemQty, a.unit)} to {formatQuantityWithUnit(a.physicalQty, a.unit)}{' '}
                    ({a.difference > 0 ? '+' : ''}{formatQuantityWithUnit(a.difference, a.unit)})
                  </span>
                </div>

                <p className="text-secondary text-ink-500">
                  {a.reason || 'No reason given'} ·{' '}
                  {formatDateTime(a.adjustedAt)} · {a.adjustedByName}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <ScanFab
        onClick={() => setScannerOpen(true)}
        label="Scan"
      />

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScanDetected}
      />

      <ConfirmDialog
        open={confirm}
        title="Save stock take?"
        message={`${changed.length} line${changed.length === 1 ? '' : 's'} will be updated to match your physical count.`}
        confirmLabel={saving ? 'Saving…' : 'Save'}
        confirmDisabled={saving}
        onConfirm={handleSave}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}