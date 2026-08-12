import { useMemo, useState } from 'react';
import { addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Banknote, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useSettings } from '../hooks/useSettings';
import { isExpenseExcluded } from '../utils/financials';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ExportCsvButton from '../components/common/ExportCsvButton';
import { EXPENSE_CATEGORIES } from '../constants/categories';
import { formatKES } from '../utils/currency';
import { formatDateTime, todayKey } from '../utils/dateRanges';
const emptyForm = { description:'', category:EXPENSE_CATEGORIES[0], amount:'', paymentMethod:'Cash', mpesaCode:'' };

export default function Expenses() {
  const { profile, isAdmin, businessId } = useAuth();
  const { settings, loading:sLoad } = useSettings();
  const expQ = useMemo(() => businessId ? tenantQuery('expenses', businessId, orderBy('recordedAt','desc'), limit(200)) : null, [businessId]);
  const { data: rawExpenses, loading } = useFirestoreCollection(expQ);
  // FIX: supplier-debt-payment entries are auto-written to `expenses` so
  // till reconciliation math works (see financials.js), but they aren't
  // real operating expenses — showing them here confused the actual
  // expense log. Filter them out with the exact same rule used to
  // exclude them from the Total Expenses figure.
  const expenses = useMemo(() => rawExpenses.filter((e) => !isExpenseExcluded(e)), [rawExpenses]);
  const [form, setForm]   = useState(emptyForm);
  const [busy, setBusy]   = useState(false);
  const set = f => e => setForm(p=>({...p,[f]:e.target.value}));

  if (sLoad) return <LoadingSpinner />;
  if (!isAdmin && !settings.cashierCanRecordExpenses) return <EmptyState title="Expense recording is owner-only" description="Ask your owner to enable cashier expenses in Settings." />;

  const handle = async e => {
    e.preventDefault();
    if (!form.description.trim()||!form.amount) return;
    if (form.paymentMethod==='M-Pesa'&&!form.mpesaCode.trim()) { toast.error('Enter M-Pesa transaction code.'); return; }
    setBusy(true);
    try {
      await addDoc(tenantCollection('expenses'), withBusiness({
        description:form.description.trim(), category:form.category, amount:Number(form.amount),
        paymentMethod:form.paymentMethod, mpesaCode:form.paymentMethod==='M-Pesa'?form.mpesaCode.trim():null,
        recordedBy:profile.uid, recordedByName:profile.displayName, recordedAt:serverTimestamp(),
      }, businessId));
      toast.success('Expense recorded'); setForm(emptyForm);
    } catch(err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const rows = expenses.map(e=>({ date:formatDateTime(e.recordedAt), description:e.description, category:e.category, amount:e.amount, paymentMethod:e.paymentMethod, mpesaCode:e.mpesaCode||'', recordedBy:e.recordedByName }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Expenses</h1>
      <form onSubmit={handle} className="card space-y-3 p-4">
        <h2 className="font-display text-sm font-bold text-ink-800">Record an expense</h2>
        <div><label className="label">Description</label><input className="input" value={form.description} onChange={set('description')} placeholder="e.g. Rent for July" required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Category</label><select className="input" value={form.category} onChange={set('category')}>{EXPENSE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Amount (KES)</label><input type="number" min="0.01" step="0.01" className="input" value={form.amount} onChange={set('amount')} required /></div>
        </div>
        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-2 gap-2">
            {['Cash','M-Pesa'].map(m=>(
              <button key={m} type="button" onClick={()=>setForm(p=>({...p,paymentMethod:m}))} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.paymentMethod===m?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>
                {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
              </button>
            ))}
          </div>
        </div>
        {form.paymentMethod==='M-Pesa'&&<div><label className="label">M-Pesa code <span className="text-rust-500">*</span></label><input className="input uppercase" value={form.mpesaCode} onChange={set('mpesaCode')} placeholder="QWE1234567" /></div>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy?'Saving…':'Record expense'}</button>
      </form>
      <div className="flex items-center justify-between"><h2 className="font-display text-sm font-bold text-ink-800">Recent expenses</h2><ExportCsvButton filename={`expenses-${todayKey()}.csv`} rows={rows} /></div>
      {loading?<LoadingSpinner />:expenses.length===0?<EmptyState title="No expenses yet" />:(
        <div className="card divide-y divide-ink-100">
          {expenses.map(e=>(
            <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
              <div><p className="font-medium text-ink-700">{e.description}</p><p className="text-xs text-ink-400">{e.category} · {formatDateTime(e.recordedAt)} · {e.recordedByName}</p></div>
              <div className="text-right"><p className="font-semibold text-rust-600">{formatKES(e.amount)}</p><p className="text-xs text-ink-400">{e.paymentMethod}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}