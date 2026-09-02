import { useMemo, useRef, useState } from 'react';
import {
  doc,
  collection,
  writeBatch,
  increment,
  serverTimestamp,
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

  const { data: products, loading } = useFirestoreCollection(productsQ);

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

  const [counts, setCounts] = useState({});
  const [reasons, setReasons] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);

  const rowRefs = useRef({});

  const getPhysical = (p) =>
    counts[p.id] !== undefined && counts[p.id] !== ''
      ? counts[p.id]
      : p.stock;

  const diffFor = (p) =>
    counts[p.id] !== undefined && counts[p.id] !== ''
      ? Number(counts[p.id]) - p.stock
      : 0;

  const changed = products.filter((p) => diffFor(p) !== 0);

  const handleScanDetected = (code) => {
    setScannerOpen(false);

    const found = findProductByCode(products, code);

    if (!found) {
      toast.error('Product not found.');
      return;
    }

    rowRefs.current[found.id]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    const inputEl =
      document.getElementById(`stocktake-count-${found.id}`) ||
      document.getElementById(`stocktake-count-mobile-${found.id}`);

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

      for (const p of changed) {
        const physicalQty = Number(getPhysical(p)) || 0;
        const difference = physicalQty - p.stock;
        const ref = doc(db, 'products', p.id);

        batch.update(ref, {
          stock: increment(difference),
          updatedAt: serverTimestamp(),
        });

        const adjRef = doc(collection(db, 'stockAdjustments'));

        batch.set(adjRef, {
          businessId,
          productId: p.id,
          productName: p.name,
          systemQty: p.stock,
          physicalQty,
          difference,
          reason: reasons[p.id] || '',
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
          : `Stock take saved — ${changed.length} product(s) adjusted`
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
        {products.map((p) => {
          const diff = diffFor(p);

          return (
            <div
              key={p.id}
              ref={(el) => {
                rowRefs.current[p.id] = el;
              }}
              className={`space-y-3 p-4 transition-colors ${
                selectedProductId === p.id
                  ? 'bg-primary-50'
                  : diff !== 0
                    ? 'bg-warning-50/50'
                    : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-body font-medium text-ink-900">
                  {p.name}
                </span>

                <span className="badge shrink-0 bg-ink-100 text-ink-700">
                  System <span className="num ml-1">{p.stock}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Physical count</label>

                  <input
                    id={`stocktake-count-mobile-${p.id}`}
                    type="number"
                    min="0"
                    className="input"
                    value={counts[p.id] ?? ''}
                    placeholder={String(p.stock)}
                    onFocus={() => setSelectedProductId(p.id)}
                    onBlur={() => setSelectedProductId(null)}
                    onChange={(e) =>
                      setCounts((c) => ({
                        ...c,
                        [p.id]: e.target.value,
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
                          ? 'text-success-700'
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

              {diff !== 0 && (
                <div>
                  <label className="label">
                    Reason for discrepancy
                  </label>

                  <input
                    className="input"
                    placeholder="e.g. damage, theft, expired"
                    value={reasons[p.id] || ''}
                    onChange={(e) =>
                      setReasons((r) => ({
                        ...r,
                        [p.id]: e.target.value,
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
              {products.map((p) => {
                const diff = diffFor(p);

                return (
                  <tr
                    key={p.id}
                    ref={(el) => {
                      rowRefs.current[p.id] = el;
                    }}
                    className={`transition-colors ${
                      selectedProductId === p.id
                        ? 'bg-primary-50'
                        : diff !== 0
                          ? 'bg-warning-50/50'
                          : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-ink-900">
                      {p.name}
                    </td>

                    <td className="num px-3 py-2 text-right text-ink-600">
                      {p.stock}
                    </td>

                    <td className="px-3 py-2">
                      <input
                        id={`stocktake-count-${p.id}`}
                        type="number"
                        min="0"
                        className="input num !w-24 text-right"
                        value={counts[p.id] ?? ''}
                        placeholder={String(p.stock)}
                        onFocus={() => setSelectedProductId(p.id)}
                        onBlur={() => setSelectedProductId(null)}
                        onChange={(e) =>
                          setCounts((c) => ({
                            ...c,
                            [p.id]: e.target.value,
                          }))
                        }
                      />
                    </td>

                    <td
                      className={`num px-3 py-2 text-right font-semibold ${
                        diff < 0
                          ? 'text-danger-700'
                          : diff > 0
                            ? 'text-success-700'
                            : 'text-ink-400'
                      }`}
                    >
                      {diff !== 0
                        ? diff > 0
                          ? `+${diff}`
                          : diff
                        : '—'}
                    </td>

                    <td className="px-3 py-2">
                      <input
                        className="input"
                        placeholder="e.g. breakage, theft"
                        value={reasons[p.id] || ''}
                        disabled={diff === 0}
                        onChange={(e) =>
                          setReasons((r) => ({
                            ...r,
                            [p.id]: e.target.value,
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
                  </span>

                  <span
                    className={`num shrink-0 font-semibold ${
                      a.difference < 0
                        ? 'text-danger-700'
                        : 'text-success-700'
                    }`}
                  >
                    {a.systemQty} to {a.physicalQty} ({a.difference > 0 ? '+' : ''}{a.difference})
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
        message={`${changed.length} product(s) will be updated to match your physical count.`}
        confirmLabel={saving ? 'Saving…' : 'Save'}
        confirmDisabled={saving}
        onConfirm={handleSave}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}