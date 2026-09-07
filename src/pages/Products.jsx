import { useMemo, useState } from 'react';
import { orderBy, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Pencil, Trash2, TrendingUp, Tags } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useIndustry } from '../hooks/useIndustry';
import { usePermissions } from '../hooks/usePermissions';
import { tenantQuery, withBusiness, tenantCollection } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { searchCatalogue } from '../utils/catalogueSearch';
import { formatQuantityWithUnit } from '../industry/units';
import { isStockItem, isService, isRecipeItem, recipeDependents } from '../utils/inventory';
import { variantsOf } from '../utils/variants';
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
import BarcodeLabelModal from '../components/products/BarcodeLabelModal';
import PageHeader from '../components/ui/PageHeader';
import Toolbar from '../components/ui/Toolbar';
import DataTable from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Money from '../components/ui/Money';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Products() {
  const { businessId, isOwner } = useAuth();
  // Two different rights, and the page has to tell them apart: a cashier
  // the owner has let LOOK at the catalogue gets prices and stock levels
  // and no buttons, while one the owner has let MANAGE it gets the form.
  // Deleting is nobody's but the owner's — firestore.rules refuses it for
  // everyone else, so offering the button would be a lie.
  const permissions = usePermissions();
  const mayManage = permissions.can('catalogue.manage');
  const { settings } = useSettings();
  const industry = useIndustry();
  const [labelModal, setLabelModal] = useState(false);
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

  // Same ranked, capped search the counter uses. A supermarket catalogue
  // is not a list you scroll — rendering four thousand table rows costs
  // more than every other thing on this page put together.
  const { results: filtered, total: matchCount, truncated } = useMemo(
    () => searchCatalogue(products, { query: search, limit: 250 }),
    [products, search]
  );
  
  const suppName = (id) => suppliers.find((s) => s.id === id)?.name || '-';

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
        toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Product updated.');
      } else {
        const { id, queuedOffline } = await createProduct(data, businessId);
        created = { id };
        toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Product added.');
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
    toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Supplier added.');
  };

  // Archiving a product that another product is BUILT FROM is not a
  // self-contained act. The catalogue listener filters archived products
  // out, and the stock engine skips a component it cannot see rather than
  // failing — so a kitchen that archives "Beef patty" goes on selling
  // cheeseburgers that deduct no patties at all, silently, until the next
  // stock take. The owner is told which products depend on it before they
  // decide, rather than finding out from a count.
  const dependents = useMemo(
    () => (pendingDel ? recipeDependents(pendingDel.id, products) : []),
    [pendingDel, products],
  );

  const archiveMessage = useMemo(() => {
    const base = `"${pendingDel?.name}" will be archived. You can restore it later from Settings, under Data.`;
    if (dependents.length === 0) return base;
    const names = dependents.slice(0, 3).map((p) => p.name).join(', ');
    const more = dependents.length > 3 ? ` and ${dependents.length - 3} more` : '';
    return `${base}\n\nIt is an ingredient in ${names}${more}. Those will stop deducting it from stock until you edit their recipes.`;
  }, [pendingDel, dependents]);

  const handleDel = async () => {
    setDeleting(true);
    const { queuedOffline, error } = await raceWithTimeout(softDeleteProduct(pendingDel.id, pendingDel.barcode, businessId), 4000);
    setDeleting(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(queuedOffline ? 'Archived offline. It will sync when you reconnect.' : 'Product archived.');
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
  // stock threshold and its default are unchanged. Anything without stock
  // of its own is simply not classified: "Out of stock" against a haircut
  // is not a warning, it is a bug.
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
    // No `mx-auto max-w-6xl` here. The catalogue table below runs to the
    // edge of the screen, and it cannot do that from inside a centred
    // column — the column edge would stop it a few hundred pixels short
    // on a desktop. The page is the full width of <main>, the header,
    // the search box and the truncation note sit on its gutter, and the
    // table bleeds through it.
    <div className="space-y-6">
      <PageHeader
        title={industry.terms.catalogue}
        description={`${products.length} item${products.length === 1 ? '' : 's'} in the catalogue`}
        actions={
          <>
            {isOwner && (
              <Link to="/inventory-intelligence" className="btn-secondary">
                <TrendingUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Intelligence
              </Link>
            )}
            {industry.can('barcodeLabels') && mayManage && (
              <button className="btn-secondary" onClick={() => setLabelModal(true)}>
                <Tags className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Labels
              </button>
            )}
            {mayManage && (
              <button
                className="btn-primary"
                onClick={() => { setEditing(null); setPrefillBarcode(null); setModal(true); }}
              >
                {industry.terms.addCatalogueItem}
              </button>
            )}
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
          bleed
          caption="Product catalogue"
          rows={filtered}
          rowKey={(p) => p.id}
          mobileLayout="row"
          leading={(p) => <ProductThumb product={p} size="h-8 w-8" />}
          columns={[
            {
              key: 'name',
              header: 'Product',
              primary: true,
              render: (p) => (
                <div className="flex items-center gap-2.5">
                  {/* The mobile row layout supplies its own thumb through
                      `leading`, and its collapsed line is a single row —
                      so both of these are desktop-only. */}
                  <span className="hidden shrink-0 sm:flex"><ProductThumb product={p} /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-900">{p.name}</span>
                    {(p.internalCode || p.barcode) && (
                      <span className="num hidden truncate text-secondary text-ink-500 sm:block">
                        {p.internalCode || p.barcode}
                      </span>
                    )}
                  </span>
                </div>
              ),
            },
            { key: 'category', header: 'Category', hideOnMobile: false, render: (p) => <span className="text-ink-600">{p.category || '-'}</span> },
            // Cost stays reachable in the expansion — owners need it —
            // just not on the collapsed line.
            { key: 'costPrice', header: 'Cost', numeric: true, hideOnMobile: false, render: (p) => <Money value={p.costPrice} tone="muted" /> },
            { key: 'sellingPrice', header: 'Price', numeric: true, mobileTrailing: true, render: (p) => <span className="font-semibold"><Money value={p.sellingPrice} /></span> },
            {
              key: 'stock',
              header: 'Stock',
              align: 'right',
              mobileTrailing: true,
              render: (p) => {
                if (!isStockItem(p)) {
                  return (
                    <StatusPill tone="neutral">
                      {isService(p) ? 'Service' : isRecipeItem(p) ? 'Made to order' : 'Not stocked'}
                    </StatusPill>
                  );
                }
                // A boutique's total is the sum of its sizes, and the
                // total is what every low-stock alert and valuation reads.
                // But "7 shirts" does not tell a shop that it has run out
                // of M, so the versions that are actually empty are named
                // here — that is the one thing a total cannot say, and the
                // reason a boutique had no way to see it before.
                const emptyVersions = variantsOf(p).filter((v) => v.stock <= 0);
                return (
                  <span className="inline-flex flex-col items-end gap-0.5">
                    <span className="inline-flex items-center justify-end gap-2">
                      <span className="num font-semibold text-ink-900">{formatQuantityWithUnit(p.stock, p.unit)}</span>
                      {stockLabel(p) && <StatusPill tone={stockTone(p)}>{stockLabel(p)}</StatusPill>}
                    </span>
                    {emptyVersions.length > 0 && (
                      <span className="text-secondary text-ink-500">
                        Out of {emptyVersions.slice(0, 3).map((v) => v.label).join(', ')}
                        {emptyVersions.length > 3 && ` +${emptyVersions.length - 3}`}
                      </span>
                    )}
                  </span>
                );
              },
            },
            { key: 'supplierId', header: 'Supplier', hideOnMobile: false, render: (p) => <span className="text-ink-600">{suppName(p.supplierId)}</span> },
          ]}
          rowActions={(p) => (
            <>
              {mayManage && (
                <button
                  className="btn-ghost !px-2 text-ink-500 hover:text-ink-900"
                  onClick={() => { setEditing(p); setPrefillBarcode(null); setModal(true); }}
                  aria-label={`Edit ${p.name}`}
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
              {isOwner && (
                <button
                  className="btn-ghost !px-2 text-ink-500 hover:text-danger-700"
                  onClick={() => setPendingDel(p)}
                  aria-label={`Archive ${p.name}`}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
            </>
          )}
          empty={
            <EmptyState
              title={search ? 'No products match that search' : 'No products yet'}
              description={search ? 'Try another keyword, or scan a barcode.' : 'Add your first product to start tracking stock.'}
              action={!search && mayManage && (
                <button className="btn-primary" onClick={() => setModal(true)}>{industry.terms.addCatalogueItem}</button>
              )}
            />
          }
        />
      )}

      {truncated && (
        <p className="text-secondary text-ink-500">
          Showing the first <span className="num">{filtered.length}</span> of{' '}
          <span className="num">{matchCount}</span> products. Search to narrow it down.
        </p>
      )}

      <BarcodeLabelModal
        open={labelModal}
        onClose={() => setLabelModal(false)}
        products={products}
        shopName={settings.shopName}
      />

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!scanFoundProduct} onClose={() => setScanFoundProduct(null)} title="Barcode already registered" widthClass="max-w-xs">
        <p className="text-body text-ink-500 mb-4">This barcode already belongs to <span className="font-semibold text-ink-800">{scanFoundProduct?.name}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setScanFoundProduct(null)}>Cancel</button>
          {mayManage && (
            <button className="btn-primary" onClick={() => { setEditing(scanFoundProduct); setPrefillBarcode(null); setScanFoundProduct(null); setModal(true); }}>View product</button>
          )}
        </div>
      </Modal>

      <ProductFormModal open={modal} onClose={closeFormModal} onSave={handleSave} allProducts={products} suppliers={suppliers} initialProduct={editing} prefillBarcode={prefillBarcode} onAddSupplier={() => setSupplierModal(true)} newSupplierId={newSupplierId} productCount={products.length} />
      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
      <ConfirmDialog open={!!pendingDel} title="Archive this product?" message={archiveMessage} confirmLabel={deleting ? "Archiving…" : "Archive"} confirmDisabled={deleting} danger onConfirm={handleDel} onCancel={() => setPendingDel(null)} />
    </div>
  );
}