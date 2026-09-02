import { useMemo, useState } from 'react';
import { addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp, where, collection } from 'firebase/firestore'; // Removed orderBy

import toast from 'react-hot-toast';
import { Pencil, Trash2, Banknote, Smartphone } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner'; // Added Import
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import PageHeader from '../components/ui/PageHeader';
import DataTable from '../components/ui/DataTable';
import Money from '../components/ui/Money';
import { formatKES } from '../utils/currency';
import { computeSupplierBalances } from '../utils/financials';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Suppliers() {
  const { profile, businessId } = useAuth();
  const suppQ   = useMemo(() => businessId ? tenantQuery('suppliers', businessId) : null, [businessId]); // Removed orderBy('name')
  const purchQ  = useMemo(() => businessId ? tenantQuery('purchases', businessId, where('paymentStatus', '==', 'pending_supplier_credit')) : null, [businessId]);
  const paymQ   = useMemo(() => businessId ? tenantQuery('supplierPayments', businessId) : null, [businessId]);
  
  const { data: rawSuppliers, loading, error, refetch } = useFirestoreCollection(suppQ); // Destructured error
  const { data: purchases }          = useFirestoreCollection(purchQ);
  const { data: spayments }          = useFirestoreCollection(paymQ);

  // Alphabetically sort suppliers in memory
  const suppliers = useMemo(() => {
    return [...rawSuppliers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [rawSuppliers]);

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

    const { queuedOffline, error: writeError } = await raceWithTimeout(write, 4000);
    if (writeError) { toast.error(friendlyErrorMessage(writeError)); throw writeError; }
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : (editing ? 'Supplier updated' : 'Supplier added'));
    await refetch();
    setModal(false); setEditing(null);
  };

  const handleDel = async () => {
    const stillExists = suppliers.some((s) => s.id === pendDel.id);
    if (!stillExists) {
      toast.success('Already removed.');
      await refetch();
      setPendDel(null);
      return;
    }
    const balance = owedMap[pendDel.id] || 0;
    if (balance > 0.005) {
      toast.error(`Can't remove "${pendDel.name}" — they still have an outstanding balance of ${formatKES(balance)}. Pay it off first.`);
      setPendDel(null);
      return;
    }
    setDeleting(true);
    const { queuedOffline, error: deleteError } = await raceWithTimeout(deleteDoc(doc(db,'suppliers',pendDel.id)), 4000);
    setDeleting(false);
    if (deleteError) { toast.error(friendlyErrorMessage(deleteError)); return; }
    toast.success(queuedOffline ? "Removed — it'll sync once you're back online." : 'Supplier removed');
    setPendDel(null);
    await refetch();
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
    batch.set(expRef, withBusiness({ description:`Supplier payment to ${selSupp.name}`, category:'Supplier Payment', amount, paymentMethod:payMethod, mpesaCode:payMethod==='M-Pesa'?payCode.trim():null,
     recordedBy:profile.uid, recordedByName:profile.displayName, recordedAt:new Date() }, businessId));
    const payRef = doc(collection(db,'supplierPayments'));
    batch.set(payRef, withBusiness({ supplierId:selSupp.id, supplierName:selSupp.name, amount, method:payMethod, mpesaCode:payMethod==='M-Pesa'?payCode.trim():null, paidAt:new Date(), recordedBy:profile.uid, recordedByName:profile.displayName }, businessId));

    const commit = batch.commit();
    const { queuedOffline, error: commitError } = await raceWithTimeout(commit, 4000);
    setPaying(false);
    if (commitError) { toast.error(friendlyErrorMessage(commitError)); return; }
    toast.success(queuedOffline ? "Payment saved — it'll sync once you're back online." : `Payment of ${formatKES(amount)} recorded for ${selSupp.name}`);
    if (queuedOffline) commit.catch((err) => toast.error(`A supplier payment from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
    setPayModal(false); setPayAmt(''); setPayCode('');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Suppliers"
        description={<>Total owed <Money value={totalOwed} tone={totalOwed > 0 ? 'negative' : undefined} /></>}
        actions={
          <button className="btn-primary" onClick={() => { setEditing(null); setModal(true); }}>
            Add supplier
          </button>
        }
      />

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          caption="Suppliers and outstanding balances"
          rows={suppliers}
          rowKey={(s) => s.id}
          columns={[
            {
              key: 'name',
              header: 'Supplier',
              primary: true,
              render: (s) => <span className="font-medium text-ink-900">{s.name}</span>,
            },
            {
              key: 'contact',
              header: 'Contact',
              render: (s) => (
                <span className="text-ink-600">
                  {s.contactPerson ? `${s.contactPerson} · ` : ''}{s.phone || 'No phone'}
                </span>
              ),
            },
            {
              key: 'balance',
              header: 'Outstanding',
              numeric: true,
              render: (s) => {
                const balance = owedMap[s.id] || 0;
                return (
                  <span className="font-semibold">
                    <Money value={balance} tone={balance > 0 ? 'negative' : 'muted'} />
                  </span>
                );
              },
            },
          ]}
          rowActions={(s) => {
            const balance = owedMap[s.id] || 0;
            return (
              <>
                {balance > 0 && (
                  <button className="btn-secondary" onClick={() => { setSelSupp(s); setPayModal(true); }}>
                    Pay
                  </button>
                )}
                <button
                  className="btn-ghost !px-2 text-ink-500 hover:text-ink-900"
                  onClick={() => { setEditing(s); setModal(true); }}
                  aria-label={`Edit ${s.name}`}
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  className="btn-ghost !px-2 text-ink-500 hover:text-danger-700"
                  onClick={() => setPendDel(s)}
                  aria-label={`Remove ${s.name}`}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </>
            );
          }}
          empty={
            <EmptyState
              title="No suppliers yet"
              description="Add suppliers to track restocking and balances."
              action={<button className="btn-primary" onClick={() => { setEditing(null); setModal(true); }}>Add supplier</button>}
            />
          }
        />
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
      />      
      <Modal open={payModal} onClose={()=>setPayModal(false)} title={`Pay ${selSupp?.name||''}`}>
        <form onSubmit={handlePay} className="space-y-3">
          <div className="rounded-control border border-line bg-ink-50 px-3 py-2 text-body">Outstanding <span className="font-semibold"><Money value={owedMap[selSupp?.id]||0} tone="negative" /></span></div>
          <div><label className="label">Amount (KES)</label><input type="number" min="0.01" step="0.01" max={owedMap[selSupp?.id]||undefined} className="input" value={payAmt} onChange={e=>setPayAmt(e.target.value)} required autoFocus /></div>
          <div><label className="label">Method</label>
            <div className="grid grid-cols-2 gap-2">
              {['Cash','M-Pesa'].map(m=>(
                <button key={m} type="button" onClick={()=>setPayMethod(m)} className={`flex items-center justify-center gap-1.5 rounded-control border text-button transition-colors ${payMethod===m?'border-primary-600 bg-primary-50 text-primary-800':'border-line text-ink-600 hover:bg-ink-50'}`}>
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