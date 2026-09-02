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
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import StatementBlock, { StatementRow, StatementResult } from '../components/ui/StatementBlock';
import { amountOnly } from '../components/ui/format';
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

  if (isClosed) {
    const closedCashVar  = (session.actualCashAtClose  || 0) - expectedCashAtClose;
    const closedMpesaVar = (session.actualMpesaAtClose || 0) - expectedMpesaAtClose;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Day closed"
          description="Counting resumes when the counter opens tomorrow."
          actions={<button className="btn-primary" onClick={reopenSession}>Reopen session</button>}
        />
        <Section title="Cash drawer">
          <StatementBlock>
            <StatementRow label="Expected cash" prefix="KES" value={amountOnly(expectedCashAtClose)} />
            <StatementRow label="Counted cash"  prefix="KES" value={amountOnly(session.actualCashAtClose || 0)} />
            <StatementResult
              label={varianceLabel(closedCashVar)}
              prefix="KES"
              value={amountOnly(Math.abs(closedCashVar))}
              tone={varianceTone(closedCashVar)}
            />
          </StatementBlock>
        </Section>
        <Section title="M-Pesa till">
          <StatementBlock>
            <StatementRow label="Expected balance" prefix="KES" value={amountOnly(expectedMpesaAtClose)} />
            <StatementRow label="Counted balance"  prefix="KES" value={amountOnly(session.actualMpesaAtClose || 0)} />
            <StatementResult
              label={varianceLabel(closedMpesaVar)}
              prefix="KES"
              value={amountOnly(Math.abs(closedMpesaVar))}
              tone={varianceTone(closedMpesaVar)}
            />
          </StatementBlock>
        </Section>
      </div>
    );
  }

  if (finErr) return <ErrorBanner message={`Failed to load figures: ${finErr}`} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Close day"
        description="Count what is actually in the drawer and the till, and record the difference."
      />

      <Section title="Cash drawer">
        <StatementBlock>
          <StatementRow label="Opening float"               prefix="KES" value={amountOnly(session.openingCashFloat)} />
          <StatementRow label="Cash sales"                  prefix="KES" value={amountOnly(summary.totalCashSales)} />
          <StatementRow label="Debt repayments in cash"     prefix="KES" value={amountOnly(summary.totalDebtRepaymentsCash)} />
          <StatementRow label="Expenses paid in cash"       prefix="KES" value={amountOnly(-summary.totalExpensesCash)} tone={summary.totalExpensesCash ? 'negative' : 'muted'} />
          <StatementRow label="Refunds paid in cash"        prefix="KES" value={amountOnly(-summary.totalRefundsCash)} tone={summary.totalRefundsCash ? 'negative' : 'muted'} />
          <StatementRow label="Purchases paid in cash"      prefix="KES" value={amountOnly(-cashPurchases)} tone={cashPurchases ? 'negative' : 'muted'} />
          <StatementRow label="Supplier payments in cash"   prefix="KES" value={amountOnly(-cashSupplierPay)} tone={cashSupplierPay ? 'negative' : 'muted'} />
          <StatementRow label="Expected in the drawer"      prefix="KES" value={amountOnly(expectedCashAtClose)} strong />

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <label htmlFor="closeday-cash" className="text-body font-medium text-ink-900">
              Cash you counted
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-label uppercase text-ink-400">KES</span>
              <input
                id="closeday-cash"
                type="number"
                className="input num w-36 text-right"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {cash !== '' && (
            <StatementResult
              label={varianceLabel(cashVar)}
              prefix="KES"
              value={amountOnly(Math.abs(cashVar))}
              tone={varianceTone(cashVar)}
            />
          )}
        </StatementBlock>
      </Section>

      <Section title="M-Pesa till">
        <StatementBlock>
          <StatementRow label="Opening balance"              prefix="KES" value={amountOnly(session.openingMpesaFloat)} />
          <StatementRow label="M-Pesa sales"                 prefix="KES" value={amountOnly(summary.totalMpesaSales)} />
          <StatementRow label="Debt repayments on M-Pesa"    prefix="KES" value={amountOnly(summary.totalDebtRepaymentsMpesa)} />
          <StatementRow label="Expenses paid on M-Pesa"      prefix="KES" value={amountOnly(-summary.totalExpensesMpesa)} tone={summary.totalExpensesMpesa ? 'negative' : 'muted'} />
          <StatementRow label="Refunds paid on M-Pesa"       prefix="KES" value={amountOnly(-summary.totalRefundsMpesa)} tone={summary.totalRefundsMpesa ? 'negative' : 'muted'} />
          <StatementRow label="Purchases paid on M-Pesa"     prefix="KES" value={amountOnly(-mpesaPurchases)} tone={mpesaPurchases ? 'negative' : 'muted'} />
          <StatementRow label="Supplier payments on M-Pesa"  prefix="KES" value={amountOnly(-mpesaSupplierPay)} tone={mpesaSupplierPay ? 'negative' : 'muted'} />
          <StatementRow label="Expected in the till"         prefix="KES" value={amountOnly(expectedMpesaAtClose)} strong />

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <label htmlFor="closeday-mpesa" className="text-body font-medium text-ink-900">
              M-Pesa balance you counted
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-label uppercase text-ink-400">KES</span>
              <input
                id="closeday-mpesa"
                type="number"
                className="input num w-36 text-right"
                value={mpesa}
                onChange={(e) => setMpesa(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {mpesa !== '' && (
            <StatementResult
              label={varianceLabel(mpesaVar)}
              prefix="KES"
              value={amountOnly(Math.abs(mpesaVar))}
              tone={varianceTone(mpesaVar)}
            />
          )}
        </StatementBlock>
      </Section>

      <div className="flex justify-end">
        <button
          className="btn-primary"
          disabled={cash === '' || mpesa === '' || submitting}
          onClick={handleClose}
        >
          {submitting ? 'Closing…' : 'Confirm and close day'}
        </button>
      </div>
    </div>
  );
}

// Variance is described in words first — "Short by", "Over by", "Balanced"
// — so the reconciliation never depends on the tint alone to be read.
function varianceLabel(v) {
  if (v === 0) return 'Balanced';
  return v < 0 ? 'Short by' : 'Over by';
}
function varianceTone(v) {
  if (v === 0) return 'positive';
  return v < 0 ? 'negative' : 'caution';
}

