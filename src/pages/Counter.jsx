import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { doc, addDoc, writeBatch, increment, serverTimestamp, orderBy, where, limit, getDoc, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDailySession } from '../hooks/useDailySession';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct, updateProduct } from '../utils/products';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import ProductGrid from '../components/pos/ProductGrid';
import SaleModal from '../components/pos/SaleModal';
import SaleCompleteModal from '../components/pos/SaleCompleteModal';
import OpenSessionPrompt from '../components/pos/OpenSessionPrompt';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES } from '../utils/currency';
import { formatDateTime } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Counter() {
  const { profile, isAdmin, businessId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const productsQ  = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  
  const customersQ = useMemo(() => businessId ? tenantQuery('customers', businessId, orderBy('name')) : null, [businessId]);
  const salesQ     = useMemo(() => businessId ? tenantQuery('sales', businessId, orderBy('soldAt','desc'), limit(100)) : null, [businessId]);
  const creditSalesQ = useMemo(() => businessId ? tenantQuery('creditSales', businessId, orderBy('soldAt','desc'), limit(100)) : null, [businessId]);
  const suppliersQ = useMemo(() => businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null, [businessId]);

  const { data: products,  loading: prodLoading }  = useFirestoreCollection(productsQ);
  const { data: customers }                         = useFirestoreCollection(customersQ);
  const { data: sales,     loading: salesLoading }  = useFirestoreCollection(salesQ);
  const { data: creditSales, loading: creditLoading } = useFirestoreCollection(creditSalesQ);
  const { data: suppliers }                         = useFirestoreCollection(suppliersQ);
  const { session, loading: sessLoading, isClosed, openSession, reopenSession } = useDailySession();

  const [search, setSearch]           = useState('');
  const [activeProduct, setActive]    = useState(null);
  const [completedSale, setCompletedSale] = useState(null);
  const [pendingVoid, setPendingVoid] = useState(null);
  const [editProduct, setEditProd]    = useState(null);
  const [prodModal, setProdModal]     = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState(null);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    if (location.state?.autoScan && session && !isClosed) {
      setScannerOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, session, isClosed]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search.trim())) ||
    (p.internalCode && p.internalCode.toLowerCase().includes(search.toLowerCase()))
  );

  const mergedSales = useMemo(() => {
    const list = [];
    sales.forEach(s => { list.push({ ...s, isCredit: false, paymentType: s.paymentMethod || 'Cash' }); });
    creditSales.forEach(cs => { list.push({ ...cs, isCredit: true, paymentType: 'Credit' }); });
    return list.sort((a, b) => {
      const aTime = a.soldAt?.toMillis?.() ?? a.soldAt?.toDate?.()?.getTime?.() ?? new Date(a.soldAt || 0).getTime();
      const bTime = b.soldAt?.toMillis?.() ?? b.soldAt?.toDate?.()?.getTime?.() ?? new Date(b.soldAt || 0).getTime();
      return bTime - aTime;
    }).slice(0, 100);
  }, [sales, creditSales]);

  const handleCreateCustomer = async ({ name, phone }) => {
    const ref = await addDoc(tenantCollection('customers'), withBusiness({ name, phone, email:'', address:'', notes:'', createdAt:serverTimestamp() }, businessId));
    return { id:ref.id, name, phone };
  };

  // FIX: Replaced runTransaction with writeBatch(db) and increment() for perfect offline capability.
const handleSale = ({ product, quantity, soldPricePerUnit, paymentMethod, mpesaCode }) => {
    const productRef = doc(db, 'products', product.id);
    const saleRef = doc(collection(db, 'sales'));
    const saleData = withBusiness({
      productId: product.id, productName: product.name, quantity,
      costPricePerUnit: product.costPrice, soldPricePerUnit,
      totalAmount: soldPricePerUnit * quantity,
      profit: (soldPricePerUnit - product.costPrice) * quantity,
      paymentMethod, mpesaCode: mpesaCode || null,
      soldBy: profile.uid, soldByName: profile.displayName,
      soldAt: serverTimestamp(), isCredit: false, isVoided: false,
    }, businessId);

    const batch = writeBatch(db);
    batch.update(productRef, { stock: increment(-quantity), updatedAt: serverTimestamp() });
    batch.set(saleRef, saleData);

    return { record: { id: saleRef.id, ...saleData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleCredit = ({ product, quantity, soldPricePerUnit, customerId, customerName, customerPhone }) => {
    const productRef = doc(db, 'products', product.id);
    const totalAmount = soldPricePerUnit * quantity;
    const creditRef = doc(collection(db, 'creditSales'));
    const creditData = withBusiness({
      customerId, customerName, customerPhone: customerPhone || '',
      productId: product.id, productName: product.name, quantity,
      costPricePerUnit: product.costPrice, soldPricePerUnit, totalAmount,
      soldBy: profile.uid, soldByName: profile.displayName, soldAt: serverTimestamp(),
      status: 'pending', amountPaid: 0, remainingBalance: totalAmount, paymentHistory: [],
      isCredit: true
    }, businessId);

    const batch = writeBatch(db);
    batch.update(productRef, { stock: increment(-quantity), updatedAt: serverTimestamp() });
    batch.set(creditRef, creditData);

    return { record: { id: creditRef.id, ...creditData, soldAt: new Date() }, commit: batch.commit() };
  };

  // FIX: Voiding a Cash Sale now creates a 'refunds' document to correct CloseDay till shortages.
const handleVoid = async () => {
    const sale = pendingVoid;
    setVoiding(true);
    try {
      const batch = writeBatch(db);
      const prodRef = doc(db, 'products', sale.productId);
      const prodSnap = await getDoc(prodRef);

      if (prodSnap.exists()) {
        batch.update(prodRef, { stock: increment(sale.quantity), updatedAt: serverTimestamp() });
      }

      batch.update(doc(db, 'sales', sale.id), { isVoided: true, voidedAt: serverTimestamp(), voidedBy: profile.uid });

      if (!sale.isCredit) {
        const refundRef = doc(collection(db, 'refunds'));
        batch.set(refundRef, withBusiness({
          saleId: sale.id, amount: sale.totalAmount, method: sale.paymentMethod,
          refundedAt: serverTimestamp(), refundedBy: profile.uid, refundedByName: profile.displayName
        }, businessId));
      }

      const { queuedOffline, error } = await raceWithTimeout(batch.commit(), 4000);
      if (error) throw error;
      
      toast.success(queuedOffline ? 'Sale voided offline.' : (prodSnap.exists() ? 'Sale voided and stock restored.' : 'Sale voided (product was deleted, no stock restored).'));
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
    finally { setVoiding(false); setPendingVoid(null); }
  };

const handleProductSave = async (data) => {
    try {
      if (editProduct) {
        const { queuedOffline } = await updateProduct(editProduct.id, data, editProduct.barcode, businessId);
        toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product updated');
      } else {
        const { queuedOffline } = await createProduct(data, businessId);
        toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product added');
      }
      setEditProd(null);
      setProdModal(false);
      setPrefillBarcode(null);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
      throw err;
    }
  };

const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    if (!queuedOffline) setNewSupplierId(ref.id); // offline: won't auto-select until next reload — acceptable trade-off
    setSupplierModal(false);
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Supplier added');
  };

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) setActive(found);
    else setNotFoundCode(code);
  };

  useHardwareScanner(handleScanDetected, {
    enabled: !!session && !isClosed && !activeProduct && !prodModal && !supplierModal && !scannerOpen && !notFoundCode && !completedSale,
  });

  if (sessLoading) return <LoadingSpinner label="Loading today's session…" />;
  if (isClosed) return (
    <div className="mx-auto max-w-sm pt-8 space-y-4 text-center">
      <EmptyState title="Today's session is closed" description="Sales are locked. An owner can reopen to continue trading." />
      {isAdmin && <button className="btn-primary w-full" onClick={reopenSession}>Reopen session</button>}
    </div>
  );
  if (!session) return <OpenSessionPrompt onOpen={floats => openSession({ ...floats, openedBy:profile.uid })} />;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="font-display text-xl font-bold text-ink-900">Counter</h1><p className="text-sm text-ink-400">Tap a product, or scan a barcode, to record a sale.</p></div>
        {isAdmin && <button className="btn-outline text-xs" onClick={()=>{setEditProd(null);setPrefillBarcode(null);setProdModal(true);}}>+ Quick add product</button>}
      </div>
      <input className="input" placeholder="Search products or codes…" value={search} onChange={e=>setSearch(e.target.value)} />
      {prodLoading ? <LoadingSpinner /> : filtered.length===0 ? <EmptyState title="No products match" /> :
        <ProductGrid products={filtered} onSelect={setActive} isAdmin={isAdmin} />}

      {isAdmin && (
        <div className="mt-4">
          <h2 className="font-display text-sm font-bold text-ink-800 mb-2">Sales log (last 100)</h2>
          {salesLoading || creditLoading ? <LoadingSpinner /> : mergedSales.length === 0 ? <EmptyState title="No sales recorded" /> : (
            <div className="card divide-y divide-ink-100">
              {mergedSales.map(s=>(
                <div key={s.id} className={`flex items-center justify-between px-4 py-3 text-sm ${s.isVoided?'opacity-40 line-through':''}`}>
                  <div>
                    <p className="font-medium text-ink-700">{s.quantity} × {s.productName} — {formatKES(s.totalAmount)}</p>
                    <p className="text-xs text-ink-400">
                      {s.paymentType === 'Credit' ? `Credit (${s.customerName})` : s.paymentMethod}
                      {s.mpesaCode ? ` (${s.mpesaCode})` : ''} · {formatDateTime(s.soldAt)} · {s.soldByName || 'Staff'}
                    </p>
                  </div>
                  {!s.isVoided && !s.isCredit && isAdmin && (
                    <button onClick={()=>setPendingVoid(s)} className="p-1 text-rust-400 hover:text-rust-600 min-h-[44px] min-w-[44px] flex items-center justify-center" title="Void sale"><Trash2 className="h-4 w-4" strokeWidth={1.75}/></button>
                  )}
                  {s.isCredit && isAdmin && (
                    <Link to={`/customers/${s.customerId}`} className="btn-outline !py-1 !px-2.5 !min-h-0 text-xs text-ink-500 hover:text-ink-700">View Customer</Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={()=>setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!notFoundCode} onClose={()=>setNotFoundCode(null)} title="Product not found" widthClass="max-w-xs">
        <p className="text-sm text-ink-500 mb-4">No product matches barcode <span className="font-mono">{notFoundCode}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={()=>setNotFoundCode(null)}>Cancel</button>
          {isAdmin ? (
            <button className="btn-primary" onClick={()=>{ setEditProd(null); setPrefillBarcode(notFoundCode); setNotFoundCode(null); setProdModal(true); }}>Create Product</button>
          ) : (
            <span className="self-center text-xs text-ink-400">Ask an owner to add this product.</span>
          )}
        </div>
      </Modal>

      <SaleModal 
        open={!!activeProduct} 
        product={activeProduct} 
        customers={customers} 
        onClose={(record) => {
          setActive(null);
          if (record && record.id) {
            setCompletedSale(record);
          }
        }} 
        onConfirmSale={handleSale} 
        onConfirmCredit={handleCredit} 
        onCreateCustomer={handleCreateCustomer} 
      />
      <SaleCompleteModal
        open={!!completedSale}
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
      />

<ProductFormModal
        open={prodModal}
        onClose={()=>{setProdModal(false);setEditProd(null);setPrefillBarcode(null);}}
        onSave={handleProductSave}
        suppliers={suppliers}
        initialProduct={editProduct}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
      />
      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
<ConfirmDialog open={!!pendingVoid} title="Void this sale?" message={`Stock for "${pendingVoid?.productName}" (×${pendingVoid?.quantity}) will be restored.`} confirmLabel={voiding ? "Voiding..." : "Void sale"} confirmDisabled={voiding} danger onConfirm={handleVoid} onCancel={()=>setPendingVoid(null)} />    </div>
  );
}