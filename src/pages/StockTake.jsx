import { useMemo, useRef, useState } from 'react';
import { doc, collection, writeBatch, increment, serverTimestamp, orderBy, where } from 'firebase/firestore';
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

export default function StockTake() {
  const { profile, businessId } = useAuth();
  const productsQ = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  
  const { data: products, loading } = useFirestoreCollection(productsQ);
  const [counts, setCounts] = useState({});
  const [reasons, setReasons] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const rowRefs = useRef({});

  const getPhysical = (p) => (counts[p.id] !== undefined && counts[p.id] !== '' ? counts[p.id] : p.stock);
  const diffFor = (p) => (counts[p.id] !== undefined && counts[p.id] !== '' ? Number(counts[p.id]) - p.stock : 0);
  const changed = products.filter((p) => diffFor(p) !== 0);

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (!found) { toast.error('Product not found.'); return; }
    rowRefs.current[found.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const inputEl = document.getElementById(`stocktake-count-${found.id}`) || document.getElementById(`stocktake-count-mobile-${found.id}`);
    inputEl?.focus();
    inputEl?.select?.();
  };

  useHardwareScanner(handleScanDetected, { enabled: !scannerOpen && !confirm });

  const handleSave = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      for (const p of changed) {
        const physicalQty = Number(getPhysical(p)) || 0;
        const difference = physicalQty - p.stock;
        const ref = doc(db, 'products', p.id);

        batch.update(ref, { stock: increment(difference), updatedAt: serverTimestamp() });

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
          adjustedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      toast.success(`Stock take saved — ${changed.length} product(s) adjusted`);
      setCounts({});
      setReasons({});
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Stock Take</h1>
          <p className="text-sm text-ink-400">Enter physical counts, or scan to jump to a product. Leave blank to keep unchanged.</p>
        </div>
        <button className="btn-primary" disabled={changed.length === 0} onClick={() => setConfirm(true)}>
          Save ({changed.length} changed)
        </button>
      </div>

      <div className="space-y-3 sm:hidden">
        {products.map((p) => {
          const diff = diffFor(p);
          return (
            <div key={p.id} ref={(el) => { rowRefs.current[p.id] = el; }} className={`card p-4 space-y-3 ${diff !== 0 ? 'border-rust-200 bg-rust-50/20' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink-800">{p.name}</span>
                <span className="badge bg-ink-100 text-ink-600 text-xs">System: {p.stock}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Physical count</label>
                  <input id={`stocktake-count-mobile-${p.id}`} type="number" min="0" className="input !py-2" value={counts[p.id] ?? ''} placeholder={String(p.stock)} onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Difference</label>
                  <div className={`input !py-2 flex items-center font-semibold ${diff < 0 ? 'text-rust-600' : diff > 0 ? 'text-moss-600' : 'text-ink-400'}`}>
                    {diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : '0'}
                  </div>
                </div>
              </div>
              {diff !== 0 && (
                <div>
                  <label className="label">Reason for discrepancy</label>
                  <input className="input !py-2" placeholder="e.g. damage, theft, expired" value={reasons[p.id] || ''} onChange={(e) => setReasons((r) => ({ ...r, [p.id]: e.target.value }))} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden sm:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
              <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">System</th><th className="px-4 py-3">Physical count</th><th className="px-4 py-3">Diff</th><th className="px-4 py-3">Reason</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {products.map((p) => {
                const diff = diffFor(p);
                return (
                  <tr key={p.id} ref={(el) => { rowRefs.current[p.id] = el; }} className={diff !== 0 ? 'bg-rust-50/30' : ''}>
                    <td className="px-4 py-3 font-medium text-ink-800">{p.name}</td>
                    <td className="px-4 py-3 text-ink-500">{p.stock}</td>
                    <td className="px-4 py-3">
                      <input id={`stocktake-count-${p.id}`} type="number" min="0" className="input !w-24 !py-1.5" value={counts[p.id] ?? ''} placeholder={String(p.stock)} onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))} />
                    </td>
                    <td className={`px-4 py-3 font-semibold ${diff < 0 ? 'text-rust-600' : diff > 0 ? 'text-moss-600' : 'text-ink-300'}`}>
                      {diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <input className="input !py-1.5" placeholder="e.g. breakage, theft" value={reasons[p.id] || ''} disabled={diff === 0} onChange={(e) => setReasons((r) => ({ ...r, [p.id]: e.target.value }))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <ConfirmDialog
        open={confirm}
        title="Save stock take?"
        message={`${changed.length} product(s) will be updated to match your physical count.`}
        confirmLabel={saving ? 'Saving…' : 'Save'}
        onConfirm={handleSave}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}s