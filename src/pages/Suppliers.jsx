import { useMemo, useState } from 'react';
import { addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp, orderBy, where, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Banknote, Smartphone } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import { formatKES } from '../utils/currency';
import { computeSupplierBalances } from '../utils/financials';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Suppliers() {
  const { profile, businessId } = useAuth();
  const suppQ   = useMemo(() => businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null, [businessId]);
  const purchQ  = useMemo(() => businessId ? tenantQuery('purchases', businessId, where('paymentStatus', '==', 'pending_supplier_credit')) : null, [businessId]);
  const paymQ   = useMemo(() => businessId ? tenantQuery('supplierPayments', businessId) : null, [businessId]);
  const { data: suppliers, loading } = useFirestoreCollection(suppQ);
  const { data: purchases }          = useFirestoreCollection(purchQ);
  const { data: spayments }          = useFirestoreCollection(paymQ);

  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [pendDel, setPendDel]   = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [selSupp, setSelSupp]   = useState(null);
  const [payAmt, setPayAmt]     = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payCode, setPayCode]   = useState('');
  const [paying, setPaying]     = useState(false);

  const owedList = useMemo(
    () => computeSupplierBalances(purchases, spayments, suppliers),
    [purchases, spayments, suppliers]
  );
  const owedMap = useMemo(
    () => Object.fromEntries(owedList.map((o) => [o.supplierId, o.balance])),
    [owedList]
  );
  const totalOwed = owedList.reduce((a, o) => a + o.balance, 0);

const [deleting, setDeleting] = useState(false);

  const handleSave = async data => {
    const write = editing
      ? updateDoc(doc(db,'suppliers',editing.id), data)
      : addDoc(tenantCollection('suppliers'), withBusiness({ ...data, createdAt:serverTimestamp() }, businessId));

    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); throw error; }
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : (editing ? 'Supplier updated' : 'Supplier added'));
    setModal(false); setEditing(null);
  };

  const handleDel = async () => {
    const balance = owedMap[pendDel.id] || 0;
    if (balance > 0.005) {
      toast.error(`Can't remove "${pendDel.name}" — they still have an outstanding balance of ${formatKES(balance)}. Pay it off first.`);
      setPendDel(null);
      return;
    }
    setDeleting(true);
    const { queuedOffline, error } = await raceWithTimeout(deleteDoc(doc(db,'suppliers',pendDel.id)), 4000);
    setDeleting(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(queuedOffline ? "Removed — it'll sync once you're back online." : 'Supplier removed');
    setPendDel(null);
  };

  const handlePay = async e => {
    e.preventDefault();
    const amount = Number(payAmt);
    const balance = owedMap[selSupp?.id]||0;
    if (amount<=0) { toast.error('Enter a positive amount.'); return; }
    if (amount > balance + 0.005) { toast.error(`Amount exceeds the outstanding balance of ${formatKES(balance)}.`); return; }
    if (payMethod==='M-Pesa'&&!payCode.trim()) { toast.error('Enter M-Pesa code.'); return; }
    setPaying(true);
    const batch = writeBatch(db);
    const expRef = doc(collection(db,'expenses'));
    batch.set(expRef, withBusiness({ description:`Supplier payment to ${selSupp.name}`, category:'Supplier Payment', amount, paymentMethod:payMethod, mpesaCode:payMethod==='M-Pesa'?payCode.trim():null, recordedBy:profile.uid, recordedByName:profile.displayName, recordedAt:serverTimestamp() }, businessId));
    const payRef = doc(collection(db,'supplierPayments'));
    batch.set(payRef, withBusiness({ supplierId:selSupp.id, supplierName:selSupp.name, amount, method:payMethod, mpesaCode:payMethod==='M-Pesa'?payCode.trim():null, paidAt:serverTimestamp(), recordedBy:profile.uid, recordedByName:profile.displayName }, businessId));

    const commit = batch.commit();
    const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
    setPaying(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(queuedOffline ? "Payment saved — it'll sync once you're back online." : `Payment of ${formatKES(amount)} recorded for ${selSupp.name}`);
    if (queuedOffline) commit.catch((err) => toast.error(`A supplier payment from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
    setPayModal(false); setPayAmt(''); setPayCode('');
  };
  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    if (!queuedOffline) setNewSupplierId(ref.id); // offline: won't auto-select until next reload — acceptable trade-off
    setSupplierModal(false);
    toast.success(queuedOffline ? "Saved, it'll sync once you're back online." : 'Supplier added');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-xl font-bold text-ink-900">Suppliers</h1><p className="text-sm text-ink-400">Total owed: <span className="font-semibold text-rust-600">{formatKES(totalOwed)}</span></p></div>
        <button className="btn-primary" onClick={()=>{setEditing(null);setModal(true);}}>+ Add supplier</button>
      </div>
      {loading?<LoadingSpinner />:suppliers.length===0?<EmptyState title="No suppliers yet" description="Add suppliers to track restocking and balances." />:(
        <div className="space-y-3">
          {suppliers.map(s=>{
            const balance = owedMap[s.id]||0;
            return (
              <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="font-semibold text-ink-800">{s.name}</p><p className="text-xs text-ink-400">{s.contactPerson&&`${s.contactPerson} · `}{s.phone||'No phone'}</p></div>
                <div className="flex items-center gap-3">
                  <div className="text-right"><p className="text-xs text-ink-400">Outstanding</p><p className={`font-semibold ${balance>0?'text-rust-600':'text-moss-600'}`}>{formatKES(balance)}</p></div>
                  {balance>0&&<button className="btn-primary !text-xs !px-3 !py-1.5 !min-h-0" onClick={()=>{setSelSupp(s);setPayModal(true);}}>Pay</button>}
                  <button className="rounded-lg p-2 text-ink-400 hover:bg-ink-100" onClick={()=>{setEditing(s);setModal(true);}}><Pencil className="h-4 w-4" strokeWidth={1.75}/></button>
                  <button className="rounded-lg p-2 text-rust-400 hover:bg-rust-50" onClick={()=>setPendDel(s)}><Trash2 className="h-4 w-4" strokeWidth={1.75}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <SupplierFormModal open={modal} onClose={()=>{setModal(false);setEditing(null);}} onSave={handleSave} initialSupplier={editing} />
<ConfirmDialog
        open={!!pendDel}
        title="Remove supplier?"
        message={(owedMap[pendDel?.id]||0) > 0.005
          ? `"${pendDel?.name}" has an outstanding balance of ${formatKES(owedMap[pendDel?.id]||0)} — pay it off first.`
          : `"${pendDel?.name}" will be removed. Purchase records stay intact.`}
        confirmLabel={deleting ? 'Removing…' : 'Remove'}
        confirmDisabled={deleting}
        danger
        onConfirm={handleDel}
        onCancel={()=>{ if (!deleting) setPendDel(null); }}
      />      <Modal open={payModal} onClose={()=>setPayModal(false)} title={`Pay ${selSupp?.name||''}`}>
        <form onSubmit={handlePay} className="space-y-3">
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">Outstanding: <span className="font-semibold text-rust-600">{formatKES(owedMap[selSupp?.id]||0)}</span></div>
          <div><label className="label">Amount (KES)</label><input type="number" min="0.01" step="0.01" max={owedMap[selSupp?.id]||undefined} className="input" value={payAmt} onChange={e=>setPayAmt(e.target.value)} required autoFocus /></div>
          <div><label className="label">Method</label>
            <div className="grid grid-cols-2 gap-2">
              {['Cash','M-Pesa'].map(m=>(
                <button key={m} type="button" onClick={()=>setPayMethod(m)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${payMethod===m?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>
                  {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
                </button>
              ))}
            </div>
          </div>
          {payMethod==='M-Pesa'&&<div><label className="label">M-Pesa code</label><input className="input uppercase" value={payCode} onChange={e=>setPayCode(e.target.value.toUpperCase())} /></div>}
          <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={()=>setPayModal(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={paying}>{paying?'Recording…':'Record payment'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
