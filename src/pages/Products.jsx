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
import ProductThumb from '../components/products/ProductThumb';
import PageHeader from '../components/ui/PageHeader';
import Toolbar from '../components/ui/Toolbar';
import DataTable from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Money from '../components/ui/Money';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Products() {
  const { businessId } = useAuth();
  const productsQ = useMemo(
    () => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null),
    [businessId]
  );
  const suppliersQ = useMemo(() => (businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null), [businessId]);
  const { data: products, loading, error } = useFirestoreCollection(productsQ);
  const { data: suppliers, refetch: refetchSuppliers } = useFirestoreCollection(suppliersQ);
  
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
      (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.includes(search.trim())) ||
      (p.internalCode && p.internalCode.toLowerCase().includes(search.toLowerCase()))
  );
  
  const suppName = (id) => suppliers.find((s) => s.id === id)?.name || '—';

  const closeFormModal = () => {
    setModal(false);
    setEditing(null);
    setPrefillBarcode(null);
  };

  const handleSave = async (data) => {
    try {
      let created = null;
      if (editing) {
        const { queuedOffline } = await updateProduct(editing.id, data, editing.barcode, businessId);
        toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product updated');
      } else {
        const { id, queuedOffline } = await createProduct(data, businessId);
        created = { id };
        toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product added');
      }
      closeFormModal();
      // Returned so ProductFormModal can attach a photo to the new product.
      return created;
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
      throw err;
    }
  };

  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); throw error; }
    if (!queuedOffline) {
      setNewSupplierId(ref.id);
      await refetchSuppliers();
    }
    setSupplierModal(false);
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Supplier added');
  };

  const handleDel = async () => {
    setDeleting(true);
    const { queuedOffline, error } = await raceWithTimeout(softDeleteProduct(pendingDel.id, pendingDel.barcode, businessId), 4000);
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

  // Presentation-only classification of an existing number — the low
  // stock threshold and its default are unchanged.
  const stockTone = (p) => {
    if (p.stock <= 0) return 'negative';
    if (p.stock <= (p.lowStockThreshold ?? 5)) return 'caution';
    return 'neutral';
  };
  const stockLabel = (p) => {
    if (p.stock <= 0) return 'Out of stock';
    if (p.stock <= (p.lowStockThreshold ?? 5)) return 'Low';
    return null;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Products"
        description={`${products.length} item${products.length === 1 ? '' : 's'} in the catalogue`}
        actions={
          <>
            <Link to="/inventory-intelligence" className="btn-secondary">
              <TrendingUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Intelligence
            </Link>
            <button
              className="btn-primary"
              onClick={() => { setEditing(null); setPrefillBarcode(null); setModal(true); }}
            >
              Add product
            </button>
          </>
        }
      />

      <Toolbar>
        <input
          className="input sm:max-w-sm"
          placeholder="Search by name, category, or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
        />
      </Toolbar>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          caption="Product catalogue"
          rows={filtered}
          rowKey={(p) => p.id}
          columns={[
            {
              key: 'name',
              header: 'Product',
              primary: true,
              render: (p) => (
                <div className="flex items-center gap-2.5">
                  <ProductThumb product={p} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-900">{p.name}</span>
                    {(p.internalCode || p.barcode) && (
                      <span className="num block truncate text-secondary text-ink-500">
                        {p.internalCode || p.barcode}
                      </span>
                    )}
                  </span>
                </div>
              ),
            },
            { key: 'category', header: 'Category', render: (p) => <span className="text-ink-600">{p.category || '—'}</span> },
            { key: 'costPrice', header: 'Cost', numeric: true, render: (p) => <Money value={p.costPrice} tone="muted" /> },
            { key: 'sellingPrice', header: 'Price', numeric: true, render: (p) => <span className="font-semibold"><Money value={p.sellingPrice} /></span> },
            {
              key: 'stock',
              header: 'Stock',
              align: 'right',
              render: (p) => (
                <span className="inline-flex items-center justify-end gap-2">
                  <span className="num font-semibold text-ink-900">{p.stock}</span>
                  {stockLabel(p) && <StatusPill tone={stockTone(p)}>{stockLabel(p)}</StatusPill>}
                </span>
              ),
            },
            { key: 'supplierId', header: 'Supplier', render: (p) => <span className="text-ink-600">{suppName(p.supplierId)}</span> },
          ]}
          rowActions={(p) => (
            <>
              <button
                className="btn-ghost !px-2 text-ink-500 hover:text-ink-900"
                onClick={() => { setEditing(p); setPrefillBarcode(null); setModal(true); }}
                aria-label={`Edit ${p.name}`}
              >
                <Pencil className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <button
                className="btn-ghost !px-2 text-ink-500 hover:text-danger-700"
                onClick={() => setPendingDel(p)}
                aria-label={`Archive ${p.name}`}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </>
          )}
          empty={
            <EmptyState
              title={search ? 'No products match that search' : 'No products yet'}
              description={search ? 'Try another keyword, or scan a barcode.' : 'Add your first product to start tracking stock.'}
              action={!search && (
                <button className="btn-primary" onClick={() => setModal(true)}>Add product</button>
              )}
            />
          }
        />
      )}

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!scanFoundProduct} onClose={() => setScanFoundProduct(null)} title="Barcode already registered" widthClass="max-w-xs">
        <p className="text-sm text-ink-500 mb-4">This barcode already belongs to <span className="font-semibold text-ink-800">{scanFoundProduct?.name}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setScanFoundProduct(null)}>Cancel</button>
          <button className="btn-primary" onClick={() => { setEditing(scanFoundProduct); setPrefillBarcode(null); setScanFoundProduct(null); setModal(true); }}>View product</button>
        </div>
      </Modal>

      <ProductFormModal open={modal} onClose={closeFormModal} onSave={handleSave} suppliers={suppliers} initialProduct={editing} prefillBarcode={prefillBarcode} onAddSupplier={() => setSupplierModal(true)} newSupplierId={newSupplierId} productCount={products.length} />
      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
      <ConfirmDialog open={!!pendingDel} title="Archive this product?" message={`"${pendingDel?.name}" will be moved to Archived Data. You can restore it later from Settings.`} confirmLabel={deleting ? "Archiving..." : "Archive"} confirmDisabled={deleting} danger onConfirm={handleDel} onCancel={() => setPendingDel(null)} />
    </div>
  );
}