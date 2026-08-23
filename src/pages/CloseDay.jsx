// HP-7 FIX: chunk deletions to avoid 500-op batch limit; replace window.location.reload() with React state
import { useMemo, useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDailySession } from '../hooks/useDailySession';
import { useFinancialsForRange } from '../hooks/useFinancials';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner';
import { formatKES } from '../utils/currency';
import { startOfDay, endOfDay } from '../utils/dateRanges';
import { computeExpectedTillBalances } from '../utils/financials';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function CloseDay() {
  const { profile } = useAuth();
  const { session, loading:sessLoad, sessionId, isClosed, reopenSession } = useDailySession();
  const today = useMemo(() => ({ start:startOfDay(), end:endOfDay() }), []);
const { loading:finLoad, error:finErr, summary, purchases, supplierPayments } = useFinancialsForRange(today.start, today.end);

const cashPurchases   = purchases.filter(p => p.paymentStatus === 'paid' && p.paymentMethod === 'Cash').reduce((s,p)=>s+(p.totalCost||0),0);
const mpesaPurchases  = purchases.filter(p => p.paymentStatus === 'paid' && p.paymentMethod === 'M-Pesa').reduce((s,p)=>s+(p.totalCost||0),0);
const cashSupplierPay = supplierPayments.filter(p=>p.method==='Cash').reduce((s,p)=>s+(p.amount||0),0);
const mpesaSupplierPay= supplierPayments.filter(p=>p.method==='M-Pesa').reduce((s,p)=>s+(p.amount||0),0);  const [cash,      setCash]      = useState('');
  const [mpesa,     setMpesa]     = useState('');
  const [submitting,setSubmit]    = useState(false);

  if (sessLoad || finLoad) return <LoadingSpinner />;
  if (!session) return <EmptyState title="No session open today" description="The counter hasn't been opened yet today." />;

  const { expectedCashAtClose, expectedMpesaAtClose } = computeExpectedTillBalances({
    openingCashFloat:         session.openingCashFloat,
    openingMpesaFloat:        session.openingMpesaFloat,
    totalCashSales:           summary.totalCashSales,
    totalMpesaSales:          summary.totalMpesaSales,
    totalDebtRepaymentsCash:  summary.totalDebtRepaymentsCash,
    totalDebtRepaymentsMpesa: summary.totalDebtRepaymentsMpesa,
    totalExpensesCash:        summary.totalExpensesCash,
    totalExpensesMpesa:       summary.totalExpensesMpesa,
    totalCashOutflows:        summary.totalCashOutflows,
    totalMpesaOutflows:       summary.totalMpesaOutflows,
  });

  const cashVar  = (Number(cash) ||0) - expectedCashAtClose;
  const mpesaVar = (Number(mpesa)||0) - expectedMpesaAtClose;

  const handleClose = async () => {
    setSubmit(true);
try {
      const write = updateDoc(doc(db,'dailySessions',sessionId), {
        totalCashSales: summary.totalCashSales,
        totalMpesaSales: summary.totalMpesaSales,
        totalCreditSales: summary.totalCreditSales,
        totalDebtRepaymentsCash: summary.totalDebtRepaymentsCash,
        totalDebtRepaymentsMpesa: summary.totalDebtRepaymentsMpesa,
        totalExpensesCash: summary.totalExpensesCash,
        totalExpensesMpesa: summary.totalExpensesMpesa,
        totalRefundsCash: summary.totalRefundsCash,
        totalRefundsMpesa: summary.totalRefundsMpesa,
        expectedCashAtClose, actualCashAtClose:Number(cash)||0,
        expectedMpesaAtClose, actualMpesaAtClose:Number(mpesa)||0,
        cashVariance:cashVar, mpesaVariance:mpesaVar,
        closedAt:serverTimestamp(), closedBy:profile.uid,
      });
      const { queuedOffline, error } = await raceWithTimeout(write, 4000);
      if (error) throw error;
      toast.success(queuedOffline ? "Day closed offline. It'll sync later!" : 'Day closed. See you tomorrow!');
    } catch(err) { toast.error(friendlyErrorMessage(err)); } finally { setSubmit(false); }
  };

  if (isClosed) return (
    <div className="mx-auto max-w-2xl space-y-4">
      <EmptyState title="Today's session is closed" description="Counting resumes when the counter opens tomorrow." />
      <div className="card divide-y divide-ink-100">
        <SRow label="Expected cash"   value={expectedCashAtClose} />
        <SRow label="Actual cash"     value={session.actualCashAtClose||0} />
        <SRow label="Cash variance"   value={(session.actualCashAtClose||0)-expectedCashAtClose} variance />
        <SRow label="Expected M-Pesa" value={expectedMpesaAtClose} />
        <SRow label="Actual M-Pesa"   value={session.actualMpesaAtClose||0} />
        <SRow label="M-Pesa variance" value={(session.actualMpesaAtClose||0)-expectedMpesaAtClose} variance />
      </div>
      <button className="btn-primary w-full" onClick={reopenSession}>Reopen session</button>
    </div>
  );

  if (finErr) return <ErrorBanner message={`Failed to load figures: ${finErr}`} />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Close Day</h1>
      <div className="card divide-y divide-ink-100">
        <div className="px-4 py-3 text-sm font-bold text-ink-800">Cash drawer</div>
        <Row label="Opening float"             value={session.openingCashFloat} />
        <Row label="+ Cash sales"              value={summary.totalCashSales} />
        <Row label="+ Debt repayments (cash)"  value={summary.totalDebtRepaymentsCash} />
        <Row label="− Expenses (cash)"         value={-summary.totalExpensesCash} />
        <Row label="− Refunds (cash)"          value={-summary.totalRefundsCash} />
        <Row label="− Purchases paid (cash)" value={-cashPurchases} />
        <Row label="− Supplier debt payments (cash)" value={-cashSupplierPay} />
        <Row label="= Expected cash"           value={expectedCashAtClose} bold />
      </div>
      <div className="card p-4 space-y-2">
        <label className="label">Actual cash counted (KES)</label>
        <input type="number" className="input" value={cash} onChange={e=>setCash(e.target.value)} placeholder="0" />
        {cash!==''&&<Variance v={cashVar} />}
      </div>
      <div className="card divide-y divide-ink-100">
        <div className="px-4 py-3 text-sm font-bold text-ink-800">M-Pesa till</div>
        <Row label="Opening balance"             value={session.openingMpesaFloat} />
        <Row label="+ M-Pesa sales"              value={summary.totalMpesaSales} />
        <Row label="+ Debt repayments (M-Pesa)"  value={summary.totalDebtRepaymentsMpesa} />
        <Row label="− Expenses (M-Pesa)"         value={-summary.totalExpensesMpesa} />
        <Row label="− Refunds (M-Pesa)"          value={-summary.totalRefundsMpesa} />
        <Row label="− Purchases paid (M-Pesa)" value={-mpesaPurchases} />
        <Row label="− Supplier debt payments (M-Pesa)" value={-mpesaSupplierPay} />
        <Row label="= Expected M-Pesa"           value={expectedMpesaAtClose} bold />
      </div>
      <div className="card p-4 space-y-2">
        <label className="label">Actual M-Pesa balance (KES)</label>
        <input type="number" className="input" value={mpesa} onChange={e=>setMpesa(e.target.value)} placeholder="0" />
        {mpesa!==''&&<Variance v={mpesaVar} />}
      </div>
      <button className="btn-primary w-full" disabled={cash===''||mpesa===''||submitting} onClick={handleClose}>{submitting?'Closing…':'Confirm and close day'}</button>
    </div>
  );
}

function Row({ label, value, bold }) {
  return <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${bold?'bg-ink-50/60':''}`}><span className={bold?'font-bold text-ink-900':'text-ink-500'}>{label}</span><span className={bold?'font-bold text-ink-900':'text-ink-700'}>{formatKES(value)}</span></div>;
}
function SRow({ label, value, variance }) {
  const tone = variance ? (value===0?'text-moss-700':value<0?'text-rust-600':'text-amber-600') : 'text-ink-700';
  return <div className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="text-ink-500">{label}</span><span className={`font-semibold ${tone}`}>{formatKES(value)}</span></div>;
}
function Variance({ v }) {
  const tone = v===0?'text-moss-700':v<0?'text-rust-600':'text-amber-600';
  return <p className={`text-sm font-semibold ${tone}`}>{v===0?'✓ Matches exactly':v<0?`Shortage of ${formatKES(Math.abs(v))}`:`Surplus of ${formatKES(v)}`}</p>;
}