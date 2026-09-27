// HP-7 FIX: chunk deletions to avoid 500-op batch limit; replace window.location.reload() with React state
import { useState } from 'react';
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
import { computeExpectedTillBalances } from '../utils/financials';
import { roundMoney } from '../utils/currency';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';
import { currencyMarker, formatAmount, tenderLabel } from '../lib/region';

export default function CloseDay() {
  const { profile } = useAuth();
  const { session, loading:sessLoad, sessionId, isClosed, reopenSession, dayStart, dayEnd } = useDailySession();
  // The range comes from the SAME business day as the session id — see
  // useDailySession — so the figures below always belong to the session
  // they are shown against, including across midnight.
  const { loading:finLoad, error:finErr, summary, purchases, supplierPayments } = useFinancialsForRange(dayStart, dayEnd);

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
      const { queuedOffline, error } = await raceWithTimeout(write, 4000, { label: 'Closing the day' });
      if (error) throw error;
      toast.success(queuedOffline ? 'Day closed offline. It will sync when you reconnect.' : 'Day closed. See you tomorrow.');
    } catch(err) { toast.error(friendlyErrorMessage(err)); } finally { setSubmit(false); }
  };

  if (isClosed) {
    // A CLOSED DAY SHOWS WHAT WAS CLOSED. It used to recompute "expected"
    // from live transactions every time it was opened, so a sale from
    // another device that synced after the close silently changed the
    // variance the cashier had already signed off. The figures recorded
    // at close are the record; anything that arrived since is shown
    // beside them, as what it is.
    const stored = (value, live) => (typeof value === 'number' && Number.isFinite(value) ? value : live);
    const closedExpectedCash  = stored(session.expectedCashAtClose, expectedCashAtClose);
    const closedExpectedMpesa = stored(session.expectedMpesaAtClose, expectedMpesaAtClose);
    const closedCashVar  = stored(session.cashVariance,  (session.actualCashAtClose  || 0) - closedExpectedCash);
    const closedMpesaVar = stored(session.mpesaVariance, (session.actualMpesaAtClose || 0) - closedExpectedMpesa);
    const lateCash  = roundMoney(expectedCashAtClose  - closedExpectedCash);
    const lateMpesa = roundMoney(expectedMpesaAtClose - closedExpectedMpesa);
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Day closed"
          description="Counting resumes when the counter opens tomorrow."
          actions={<button className="btn-primary" onClick={reopenSession}>Reopen session</button>}
        />
        <Section title="Cash drawer">
          <StatementBlock>
            <StatementRow label="Expected cash" prefix={currencyMarker()} value={formatAmount(closedExpectedCash)} />
            <StatementRow label="Counted cash"  prefix={currencyMarker()} value={formatAmount(session.actualCashAtClose || 0)} />
            <StatementResult
              label={varianceLabel(closedCashVar)}
              prefix={currencyMarker()}
              value={formatAmount(Math.abs(closedCashVar))}
              tone={varianceTone(closedCashVar)}
            />
          </StatementBlock>
        </Section>
        <Section title={`${tenderLabel('M-Pesa')} till`}>
          <StatementBlock>
            <StatementRow label="Expected balance" prefix={currencyMarker()} value={formatAmount(closedExpectedMpesa)} />
            <StatementRow label="Counted balance"  prefix={currencyMarker()} value={formatAmount(session.actualMpesaAtClose || 0)} />
            <StatementResult
              label={varianceLabel(closedMpesaVar)}
              prefix={currencyMarker()}
              value={formatAmount(Math.abs(closedMpesaVar))}
              tone={varianceTone(closedMpesaVar)}
            />
          </StatementBlock>
        </Section>
        {(Math.abs(lateCash) >= 0.01 || Math.abs(lateMpesa) >= 0.01) && (
          <p className="text-secondary text-ink-600">
            Since this day was closed, activity dated today has arrived from another device or from offline:
            {Math.abs(lateCash) >= 0.01 && <> <span className="num font-medium">{currencyMarker()} {formatAmount(lateCash)}</span> cash</>}
            {Math.abs(lateCash) >= 0.01 && Math.abs(lateMpesa) >= 0.01 && ' and'}
            {Math.abs(lateMpesa) >= 0.01 && <> <span className="num font-medium">{currencyMarker()} {formatAmount(lateMpesa)}</span> {tenderLabel('M-Pesa')}</>}.
            The closed figures above are unchanged. Reopen the day to count again.
          </p>
        )}
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
          <StatementRow label="Opening float"               prefix={currencyMarker()} value={formatAmount(session.openingCashFloat)} />
          <StatementRow label="Cash sales"                  prefix={currencyMarker()} value={formatAmount(summary.totalCashSales)} />
          <StatementRow label="Debt repayments in cash"     prefix={currencyMarker()} value={formatAmount(summary.totalDebtRepaymentsCash)} />
          <StatementRow label="Expenses paid in cash"       prefix={currencyMarker()} value={formatAmount(-summary.totalExpensesCash)} tone={summary.totalExpensesCash ? 'negative' : 'muted'} />
          <StatementRow label="Refunds paid in cash"        prefix={currencyMarker()} value={formatAmount(-summary.totalRefundsCash)} tone={summary.totalRefundsCash ? 'negative' : 'muted'} />
          <StatementRow label="Purchases paid in cash"      prefix={currencyMarker()} value={formatAmount(-cashPurchases)} tone={cashPurchases ? 'negative' : 'muted'} />
          <StatementRow label="Supplier payments in cash"   prefix={currencyMarker()} value={formatAmount(-cashSupplierPay)} tone={cashSupplierPay ? 'negative' : 'muted'} />
          <StatementRow label="Expected in the drawer"      prefix={currencyMarker()} value={formatAmount(expectedCashAtClose)} strong />

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <label htmlFor="closeday-cash" className="text-body font-medium text-ink-900">
              Cash you counted
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-label uppercase text-ink-400">{currencyMarker()}</span>
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
              prefix={currencyMarker()}
              value={formatAmount(Math.abs(cashVar))}
              tone={varianceTone(cashVar)}
            />
          )}
        </StatementBlock>
      </Section>

      <Section title={`${tenderLabel('M-Pesa')} till`}>
        <StatementBlock>
          <StatementRow label="Opening balance"              prefix={currencyMarker()} value={formatAmount(session.openingMpesaFloat)} />
          <StatementRow label={`${tenderLabel('M-Pesa')} sales`}                 prefix={currencyMarker()} value={formatAmount(summary.totalMpesaSales)} />
          <StatementRow label={`Debt repayments on ${tenderLabel('M-Pesa')}`}    prefix={currencyMarker()} value={formatAmount(summary.totalDebtRepaymentsMpesa)} />
          <StatementRow label={`Expenses paid on ${tenderLabel('M-Pesa')}`}      prefix={currencyMarker()} value={formatAmount(-summary.totalExpensesMpesa)} tone={summary.totalExpensesMpesa ? 'negative' : 'muted'} />
          <StatementRow label={`Refunds paid on ${tenderLabel('M-Pesa')}`}       prefix={currencyMarker()} value={formatAmount(-summary.totalRefundsMpesa)} tone={summary.totalRefundsMpesa ? 'negative' : 'muted'} />
          <StatementRow label={`Purchases paid on ${tenderLabel('M-Pesa')}`}     prefix={currencyMarker()} value={formatAmount(-mpesaPurchases)} tone={mpesaPurchases ? 'negative' : 'muted'} />
          <StatementRow label={`Supplier payments on ${tenderLabel('M-Pesa')}`}  prefix={currencyMarker()} value={formatAmount(-mpesaSupplierPay)} tone={mpesaSupplierPay ? 'negative' : 'muted'} />
          <StatementRow label="Expected in the till"         prefix={currencyMarker()} value={formatAmount(expectedMpesaAtClose)} strong />

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <label htmlFor="closeday-mpesa" className="text-body font-medium text-ink-900">
              {tenderLabel('M-Pesa')} balance you counted
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-label uppercase text-ink-400">{currencyMarker()}</span>
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
              prefix={currencyMarker()}
              value={formatAmount(Math.abs(mpesaVar))}
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
  // A balanced till is correct, not "good" — 'info' reads as neutral,
  // which is what a reconciliation that came out even actually means.
  if (v === 0) return 'info';
  return v < 0 ? 'negative' : 'caution';
}

