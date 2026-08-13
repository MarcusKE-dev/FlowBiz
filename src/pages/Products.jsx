import { useMemo, useState } from 'react';
import { orderBy, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Pencil, Trash2, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, withBusiness, tenantCollection } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct, updateProduct, softDeleteProduct } from '../utils/products';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES } from '../utils/currency';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Products() {
  const { businessId } = useAuth();
  const productsQ = useMemo(
    () => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null,
    [businessId]
  );
  const suppliersQ = useMemo(() => businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null, [businessId]);
  const { data: products, loading, error } = useFirestoreCollection(productsQ);
  const { data: suppliers } = useFirestoreCollection(suppliersQ);
  
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [pendingDel, setPendingDel] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanFoundProduct, setScanFoundProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);


  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search.trim())) ||
      (p.internalCode && p.internalCode.toLowerCase().includes(search.toLowerCase()))
  );
  const suppName = (id) => suppliers.find((s) => s.id === id)?.name || '—';

  const closeFormModal = () => { setModal(false); setEditing(null); setPrefillBarcode(null); };

  const handleSave = async (data) => {
    try {
      if (editing) {
        await updateProduct(editing.id, data, editing.barcode, businessId);
        toast.success('Product updated');
      } else {
        await createProduct(data, businessId);
        toast.success('Product added');
      }
      closeFormModal();
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
  };
const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    if (!queuedOffline) setNewSupplierId(ref.id); // offline: won't auto-select until next reload — acceptable trade-off
    setSupplierModal(false);
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Supplier added');
  };
const handleDel = async () => {
    setDeleting(true);
    const { queuedOffline, error } = await raceWithTimeout(softDeleteProduct(pendingDel.id), 4000);
    setDeleting(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(queuedOffline ? "Archived offline — it'll sync later." : 'Product archived');
    setPendingDel(null);
  };

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) setScanFoundProduct(found);
    else { setEditing(null); setPrefillBarcode(code); setModal(true); }
  };

  useHardwareScanner(handleScanDetected, { enabled: !modal && !supplierModal && !scannerOpen && !scanFoundProduct });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-xl font-bold text-ink-900">Products</h1><p className="text-sm text-ink-400">{products.length} items</p></div>
        <div className="flex gap-2">
          <Link to="/inventory-intelligence" className="btn-outline">
            <TrendingUp className="h-4 w-4" /> Intelligence
          </Link>
          <button className="btn-primary" onClick={() => { setEditing(null); setPrefillBarcode(null); setModal(true); }}>+ Add product</button>
        </div>
      </div>
      <input className="input" placeholder="Search by name, category, or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ErrorBanner message={error} />
      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState title="No products yet" description="Add your first product to start tracking stock." action={<button className="btn-primary" onClick={() => setModal(true)}>+ Add product</button>} />
      ) : (
        <>
          <div className="space-y-2.5 sm:hidden">
            {filtered.map((p) => (
              <div key={p.id} className={`card p-3.5 space-y-2 ${p.stock <= (p.lowStockThreshold ?? 5) ? 'border-rust-200 bg-rust-50/20' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="badge bg-ink-100 text-ink-500 text-[10px] mb-1">{p.category}</span>
                    <h3 className="font-semibold text-ink-800 leading-tight truncate">{p.name}</h3>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100" onClick={() => { setEditing(p); setPrefillBarcode(null); setModal(true); }}><Pencil className="h-4 w-4" strokeWidth={1.75} /></button>
                    <button className="rounded-lg p-1.5 text-rust-400 hover:bg-rust-50" onClick={() => setPendingDel(p)}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-ink-100 text-xs">
                  <div>
                    <span className="text-ink-400">Retail: </span><span className="font-display font-bold text-moss-700">{formatKES(p.sellingPrice)}</span>
                  </div>
                  <span className={`font-semibold ${p.stock <= (p.lowStockThreshold ?? 5) ? 'text-rust-600' : 'text-ink-700'}`}>{p.stock} in stock {p.stock <= (p.lowStockThreshold ?? 5) ? '⚠️' : ''}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Cat.</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Retail</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3 w-16"></th></tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filtered.map((p) => (
                    <tr key={p.id} className={p.stock <= (p.lowStockThreshold ?? 5) ? 'bg-rust-50/40' : ''}>
                      <td className="px-4 py-3 font-semibold text-ink-800">{p.name}</td>
                      <td className="px-4 py-3 text-ink-500">{p.category}</td>
                      <td className="px-4 py-3 text-ink-500">{formatKES(p.costPrice)}</td>
                      <td className="px-4 py-3 font-semibold text-moss-700">{formatKES(p.sellingPrice)}</td>
                      <td className="px-4 py-3"><span className={p.stock <= (p.lowStockThreshold ?? 5) ? 'font-bold text-rust-600' : 'text-ink-700'}>{p.stock}</span></td>
                      <td className="px-4 py-3 text-ink-500">{suppName(p.supplierId)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button className="rounded p-1.5 text-ink-400 hover:bg-ink-100" onClick={() => { setEditing(p); setPrefillBarcode(null); setModal(true); }}><Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /></button>
                          <button className="rounded p-1.5 text-rust-400 hover:bg-rust-50" onClick={() => setPendingDel(p)}><Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!scanFoundProduct} onClose={() => setScanFoundProduct(null)} title="Barcode already registered" widthClass="max-w-xs">
        <p className="text-sm text-ink-500 mb-4">This barcode already belongs to <span className="font-semibold text-ink-800">{scanFoundProduct?.name}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setScanFoundProduct(null)}>Cancel</button>
          <button className="btn-primary" onClick={() => { setEditing(scanFoundProduct); setPrefillBarcode(null); setScanFoundProduct(null); setModal(true); }}>View Product</button>
        </div>
      </Modal>

<ProductFormModal open={modal} onClose={closeFormModal} onSave={handleSave} suppliers={suppliers} initialProduct={editing} prefillBarcode={prefillBarcode} onAddSupplier={() => setSupplierModal(true)} newSupplierId={newSupplierId} productCount={products.length} />      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
<ConfirmDialog open={!!pendingDel} title="Archive this product?" message={`"${pendingDel?.name}" will be moved to Archived Data. You can restore it later from Settings.`} confirmLabel={deleting ? "Archiving..." : "Archive"} confirmDisabled={deleting} danger onConfirm={handleDel} onCancel={() => setPendingDel(null)} />    </div>
  );
}