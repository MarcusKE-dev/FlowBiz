import { useMemo, useState } from 'react';
import { addDoc, orderBy, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Banknote, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useSettings } from '../contexts/SettingsContext';
import { useIndustry } from '../hooks/useIndustry';
import { isExpenseExcluded } from '../utils/financials';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ExportCsvButton from '../components/common/ExportCsvButton';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import DataTable from '../components/ui/DataTable';
import Money from '../components/ui/Money';
import { formatDateTime, todayKey } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';
const emptyForm = { description:'', category:'', amount:'', paymentMethod:'Cash', mpesaCode:'' };

export default function Expenses() {
  const { profile, businessId } = useAuth();
  const permissions = usePermissions();
  const { loading:sLoad } = useSettings();
  // The business's own list, resolved off the settings document the app
  // already listens to. An owner edits it under Customize.
  const { expenseCategories } = useIndustry();
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

  // The chosen category, resolved against the live list. A blank form and
  // a form whose category an owner has since removed both fall back to
  // the first offered word, so the select is never left showing nothing.
  const category = expenseCategories.includes(form.category) ? form.category : (expenseCategories[0] || '');

  if (sLoad) return <LoadingSpinner />;
  // The permission catalogue's answer, not a bare settings flag — see
  // src/industry/permissions.js. The route guard already turns a cashier
  // without it away; this is the second answer for anyone who reaches the
  // component another way, and firestore.rules is the third.
  if (!permissions.can('expenses.record')) {
    return <EmptyState title="Expense recording is owner-only" description="Ask your owner to allow cashiers to record expenses, under Team." />;
  }

const handle = async e => {
    e.preventDefault();
    if (!form.description.trim()||!form.amount) return;
    if (form.paymentMethod==='M-Pesa'&&!form.mpesaCode.trim()) { toast.error('Enter M-Pesa transaction code.'); return; }
    setBusy(true);
    const write = addDoc(tenantCollection('expenses'), withBusiness({
      description:form.description.trim(), category, amount:Number(form.amount),
      paymentMethod:form.paymentMethod, mpesaCode:form.paymentMethod==='M-Pesa'?form.mpesaCode.trim():null,
      recordedBy:profile.uid, recordedByName:profile.displayName, recordedAt:new Date(),
    }, businessId));

    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    setBusy(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(queuedOffline ? 'Expense saved offline. It will sync when you reconnect.' : 'Expense recorded');
    if (queuedOffline) write.catch((err) => toast.error(`An expense from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
    setForm(emptyForm);
  };

  const rows = expenses.map(e=>({ date:formatDateTime(e.recordedAt), description:e.description, category:e.category, amount:e.amount, paymentMethod:e.paymentMethod, mpesaCode:e.mpesaCode||'', recordedBy:e.recordedByName }));

  return (
    // Full width. The tables and strips below run to the edge of the
    // content area, which a centred column would stop short of; the
    // 1800px ceiling lives in AppShell so every page shares one.
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Record what the shop spends, so profit and the till both stay honest."
      />

      {/* An entry form wants a measure, not width — a 1,800px text input
          is not an improvement. Edge to edge on a phone, a contained
          card once there is room for one. */}
      <form onSubmit={handle} className="panel-measure space-y-4 p-4 sm:max-w-2xl">
        <h2 className="section-title">Record an expense</h2>

        <div>
          <label className="label" htmlFor="expense-description">Description</label>
          <input
            id="expense-description"
            className="input"
            value={form.description}
            onChange={set('description')}
            placeholder="e.g. Rent for July"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="expense-category">Category</label>
            <select id="expense-category" className="input" value={category} onChange={set('category')}>
              {expenseCategories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="expense-amount">Amount (KES)</label>
            <input
              id="expense-amount"
              type="number"
              min="0.01"
              step="0.01"
              className="input num text-right"
              value={form.amount}
              onChange={set('amount')}
              required
            />
          </div>
        </div>

        <div>
          <p className="label">Payment method</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
            {['Cash', 'M-Pesa'].map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={form.paymentMethod === m}
                onClick={() => setForm((p) => ({ ...p, paymentMethod: m }))}
                className={`flex items-center justify-center gap-1.5 rounded-control border text-button transition-colors ${
                  form.paymentMethod === m
                    ? 'border-primary-600 bg-primary-50 text-primary-800'
                    : 'border-line text-ink-600 hover:bg-ink-50'
                }`}
              >
                {m === 'Cash'
                  ? <Banknote className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  : <Smartphone className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
                {m}
              </button>
            ))}
          </div>
        </div>

        {form.paymentMethod === 'M-Pesa' && (
          <div>
            <label className="label" htmlFor="expense-mpesa">
              M-Pesa code <span className="text-danger-600" aria-hidden="true">*</span>
            </label>
            <input
              id="expense-mpesa"
              className="input num uppercase"
              value={form.mpesaCode}
              onChange={set('mpesaCode')}
              placeholder="QWE1234567"
            />
          </div>
        )}

        <div className="flex justify-end border-t border-divider pt-4">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Record expense'}
          </button>
        </div>
      </form>

      <Section
        title="Recent expenses"
        action={<ExportCsvButton filename={`expenses-${todayKey()}.csv`} rows={rows} />}
      >
        {loading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            bleed
            caption="Expenses recorded recently"
            rows={expenses}
            rowKey={(e) => e.id}
            mobileLayout="row"
            columns={[
              {
                key: 'description',
                header: 'Expense',
                primary: true,
                render: (e) => <span className="font-medium text-ink-900">{e.description}</span>,
              },
              { key: 'category', header: 'Category', mobileTrailing: true, render: (e) => <span className="text-ink-600">{e.category}</span> },
              { key: 'paymentMethod', header: 'Method', render: (e) => <span className="text-ink-600">{e.paymentMethod}</span> },
              { key: 'recordedAt', header: 'Date', render: (e) => <span className="text-ink-600">{formatDateTime(e.recordedAt)}</span> },
              { key: 'recordedByName', header: 'Recorded by', render: (e) => <span className="text-ink-600">{e.recordedByName}</span> },
              {
                key: 'amount',
                header: 'Amount',
                numeric: true,
                mobileTrailing: true,
                render: (e) => <span className="font-semibold"><Money value={e.amount} /></span>,
              },
            ]}
            empty={<EmptyState title="No expenses yet" description="Expenses you record above will be listed here." />}
          />
        )}
      </Section>
    </div>
  );
}