import { useEffect, useMemo, useState } from 'react';
import { doc, writeBatch, increment, serverTimestamp, orderBy, where, limit, addDoc, collection } from 'firebase/firestore';

import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct } from '../utils/products';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES } from '../utils/currency';
import { formatDateTime } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

const empty = { supplierId:'', productId:'', quantity:'', costPricePerUnit:'', paymentStatus:'paid', paymentMethod:'Cash', mpesaCode:'' };

export default function Purchases() {
  const { profile, businessId } = useAuth();
  const productsQ  = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  const suppliersQ = useMemo(() => businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null, [businessId]);
  const purchasesQ = useMemo(() => businessId ? tenantQuery('purchases', businessId, orderBy('purchasedAt','desc'), limit(50)) : null, [businessId]);
  const { data: products }  = useFirestoreCollection(productsQ);
  const { data: suppliers } = useFirestoreCollection(suppliersQ);
  const { data: purchases, loading } = useFirestoreCollection(purchasesQ);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const set = f => e => setForm(p=>({...p,[f]:e.target.value}));

  // FIX (supplier not showing as selected after creating it): a supplier
  // created via "+ Add new supplier" was written to Firestore correctly
  // and would eventually appear in the dropdown's option list once the
  // realtime listener delivered it, but nothing ever selected it in
  // `form.supplierId` — the newly created supplier looked like it hadn't
  // been added at all unless you manually reopened the dropdown and
  // scrolled to find it. This mirrors the same wiring ProductFormModal
  // already does for its own supplier field.
  useEffect(() => {
    if (newSupplierId) setForm(p => ({ ...p, supplierId: newSupplierId }));
  }, [newSupplierId]);

  const selProd = products.find(p=>p.id===form.productId);
  const selSupp = suppliers.find(s=>s.id===form.supplierId);
  const totalCost = (Number(form.quantity)||0)*(Number(form.costPricePerUnit)||0);

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) {
      setForm(p => ({ ...p, productId: found.id }));
      toast.success(`Selected ${found.name}`);
    } else {
      setPrefillBarcode(code);
      setProductModal(true);
    }
  };

  useHardwareScanner(handleScanDetected, { enabled: !productModal && !supplierModal && !scannerOpen });

  const handle = async e => {
    e.preventDefault();
    if (!form.productId||!form.supplierId||!form.quantity||!form.costPricePerUnit) { toast.error('Fill in all fields.'); return; }
    if (form.paymentStatus==='paid'&&form.paymentMethod==='M-Pesa'&&!form.mpesaCode.trim()) { toast.error('Enter M-Pesa code.'); return; }
    setBusy(true);
try {
      const qty   = Number(form.quantity);
      const cost  = Number(form.costPricePerUnit);
      const total = qty * cost;
      const batch = writeBatch(db);
      batch.update(doc(db,'products',form.productId), { stock:increment(qty), costPrice:cost, updatedAt:serverTimestamp() });
      const purchRef = doc(collection(db,'purchases'));
      batch.set(purchRef, withBusiness({
        supplierId:form.supplierId,
        supplierName:selSupp?.name||'',
        productId:form.productId,
        productName:selProd?.name||'',
        quantity:qty,
        costPricePerUnit:cost,
        totalCost:total,
       purchasedBy:profile.uid, 
       purchasedByName:profile.displayName, 
       purchasedAt:new Date(),
        paymentStatus:form.paymentStatus==='paid'?'paid':'pending_supplier_credit',
        paymentMethod:form.paymentStatus==='paid'?form.paymentMethod:null,
        mpesaCode:form.paymentStatus==='paid'&&form.paymentMethod==='M-Pesa'?form.mpesaCode.trim():null,
      }, businessId));
      
      const commit = batch.commit();
      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      
      toast.success(queuedOffline ? "Purchase queued offline — it'll sync soon." : 'Purchase recorded and stock updated');
      if (queuedOffline) commit.catch((err) => toast.error(`A purchase from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      
      setForm(empty);
    } catch(err) { toast.error(friendlyErrorMessage(err)); } finally { setBusy(false); }
  };

  // FIX (stuck "Saving…" bug): this used to `return` after showing the
  // error toast, which meant SupplierFormModal's own try/catch never
  // fired and its "Saving…" button never reset — the form just looked
  // frozen after a failed save, with no obvious way to try again.
  // Throwing here lets SupplierFormModal's catch/finally reset it.
  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); throw error; }
    if (!queuedOffline) setNewSupplierId(ref.id); // offline: won't auto-select until next reload — acceptable trade-off
    setSupplierModal(false);
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Supplier added');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Record Purchase</h1>
      <form onSubmit={handle} className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={form.supplierId} onChange={set('supplierId')} required>
              <option value="">— Select —</option>
              {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="button" className="mt-2 text-sm font-semibold text-moss-700" onClick={()=>setSupplierModal(true)}>+ Add new supplier</button>
          </div>
          <div>
            <label className="label">Product</label>
            <select className="input" value={form.productId} onChange={set('productId')} required>
              <option value="">— Select —</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" className="mt-2 text-sm font-semibold text-moss-700" onClick={()=>{setPrefillBarcode(null);setProductModal(true);}}>+ Add new product</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Qty received</label><input type="number" min="1" className="input" value={form.quantity} onChange={set('quantity')} required /></div>
          <div><label className="label">Cost / unit (KES)</label><input type="number" min="0" step="0.01" className="input" value={form.costPricePerUnit} onChange={set('costPricePerUnit')} required /></div>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">Total cost: <span className="font-semibold">{formatKES(totalCost)}</span></div>
        <div>
          <label className="label">Payment status</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={()=>setForm(p=>({...p,paymentStatus:'paid'}))} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.paymentStatus==='paid'?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>Paid now</button>
            <button type="button" onClick={()=>setForm(p=>({...p,paymentStatus:'credit'}))} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.paymentStatus==='credit'?'border-rust-500 bg-rust-50 text-rust-700':'border-ink-200 text-ink-500'}`}>On credit</button>
          </div>
        </div>
        {form.paymentStatus==='paid'&&(
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Paid via</label><select className="input" value={form.paymentMethod} onChange={set('paymentMethod')}><option>Cash</option><option>M-Pesa</option></select></div>
            {form.paymentMethod==='M-Pesa'&&<div><label className="label">M-Pesa code</label><input className="input uppercase" value={form.mpesaCode} onChange={set('mpesaCode')} /></div>}
          </div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy?'Saving…':'Record purchase'}</button>
      </form>
      <h2 className="font-display text-sm font-bold text-ink-800">Recent purchases</h2>

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={()=>setScannerOpen(false)} onDetected={handleScanDetected} />

<ProductFormModal
        open={productModal}
        onClose={()=>{setProductModal(false);setPrefillBarcode(null);}}
onSave={async (data) => {
  try {
    const { id, queuedOffline } = await createProduct(data, businessId);
    setForm(p=>({...p, productId: id}));
    setProductModal(false);
    setPrefillBarcode(null);
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product added');
  } catch (err) { toast.error(friendlyErrorMessage(err)); }
}}
        suppliers={suppliers}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
        simplifiedForPurchase
      />
      <SupplierFormModal open={supplierModal} onClose={()=>setSupplierModal(false)} onSave={handleSupplierSave} />
      {loading?<LoadingSpinner />:purchases.length===0?<EmptyState title="No purchases yet" />:(
        <div className="card divide-y divide-ink-100">
          {purchases.map(p=>(
            <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
              <div><p className="font-medium text-ink-700">{p.quantity} × {p.productName}</p><p className="text-xs text-ink-400">{p.supplierName} · {formatDateTime(p.purchasedAt)}</p></div>
              <div className="text-right"><p className="font-semibold text-ink-800">{formatKES(p.totalCost)}</p><span className={`badge ${p.paymentStatus==='paid'?'bg-moss-100 text-moss-700':'bg-rust-100 text-rust-700'}`}>{p.paymentStatus==='paid'?'Paid':'On credit'}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
