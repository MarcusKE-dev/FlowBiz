import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { where, orderBy, doc, writeBatch, increment, getDoc, serverTimestamp, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Receipt, Banknote, Smartphone, Undo2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import RepaymentModal from '../components/debtors/RepaymentModal';
import RefundModal from '../components/debtors/RefundModal';
import { formatKES } from '../utils/currency';
import { formatDateTime } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function CustomerDetail() {
  const { customerId } = useParams();
  const { profile, isAdmin, businessId } = useAuth();

  const customerQ   = useMemo(() => businessId ? tenantQuery('customers', businessId, where('__name__','==',customerId)) : null, [customerId, businessId]);
  const creditQ     = useMemo(() => businessId ? tenantQuery('creditSales', businessId, where('customerId','==',customerId)) : null, [customerId, businessId]);
  const repaymentsQ = useMemo(() => businessId ? tenantQuery('repayments', businessId, where('customerId','==',customerId), orderBy('paidAt','desc')) : null, [customerId, businessId]);

  const { data: customerData, loading: custLoad } = useFirestoreCollection(customerQ);
  const { data: creditSales, loading: credLoad, error } = useFirestoreCollection(creditQ);
  const { data: repayments } = useFirestoreCollection(repaymentsQ);
  
  const [repayOpen, setRepayOpen]       = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);

  const customer = customerData[0];
  const sorted = [...creditSales].sort((a,b) => (b.soldAt?.toMillis?.() ?? 0) - (a.soldAt?.toMillis?.() ?? 0));
  const totalOwed = creditSales
    .filter(cs => cs.status !== 'cancelled' && cs.status !== 'refunded')
    .reduce((acc,cs) => acc + (Number(cs.remainingBalance) || 0), 0);

  const handleRepayment = async ({ amount, method, mpesaCode }) => {
    const openSales = [...creditSales]
      .filter(cs => cs.status !== 'cancelled' && cs.status !== 'refunded' && (Number(cs.remainingBalance) || 0) > 0.005)
      .sort((a,b) => (a.soldAt?.toMillis?.() ?? 0) - (b.soldAt?.toMillis?.() ?? 0));

    if (!openSales.length) { toast.error('No outstanding balance.'); return; }
    try {
      const batch = writeBatch(db);
      let remaining = amount;
      for (const cs of openSales) {
        if (remaining <= 0.005) break;
        const owed    = Number(cs.remainingBalance) || 0;
        const portion = Math.min(owed, remaining);
        remaining    -= portion;
        const newPaid = (Number(cs.amountPaid) || 0) + portion;
        const newBal  = owed - portion;
        batch.update(doc(db,'creditSales',cs.id), { amountPaid: newPaid, remainingBalance: newBal, status: newBal <= 0.005 ? 'paid' : 'partial' });
        const repRef = doc(collection(db,'repayments'));
        batch.set(repRef, {
          businessId,
          creditSaleId: cs.id,
          customerId: cs.customerId,
          customerName: cs.customerName,
          productName: cs.productName,
          amount: portion,
          method,
          mpesaCode: mpesaCode || null,
          paidAt: serverTimestamp(),
          recordedBy: profile.uid,
          recordedByName: profile.displayName,
        });
      }
      await batch.commit();
      toast.success(`Recorded ${formatKES(amount)} repayment`);
    } catch (err) { toast.error(friendlyErrorMessage(err)); throw err; }
  };

  const handleCancel = async (cs) => {
    setCancelTarget(null);
    try {
      const batch = writeBatch(db);
      const prodRef = doc(db,'products',cs.productId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        batch.update(prodRef, { stock: increment(cs.quantity), updatedAt: serverTimestamp() });
      }
      batch.update(doc(db,'creditSales',cs.id), {
        status: 'cancelled', remainingBalance: 0,
        cancelledAt: serverTimestamp(), cancelledBy: profile.uid,
      });
      await batch.commit();
      toast.success('Credit sale cancelled and stock restored.');
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
  };

  const handleRefund = async (cs, { method }) => {
    try {
      const batch = writeBatch(db);
      const prodRef = doc(db,'products',cs.productId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        batch.update(prodRef, { stock: increment(cs.quantity), updatedAt: serverTimestamp() });
      }
      batch.update(doc(db,'creditSales',cs.id), {
        status: 'refunded', remainingBalance: 0,
        refundedAt: serverTimestamp(), refundedBy: profile.uid,
      });
      const refundRef = doc(collection(db,'refunds'));
      batch.set(refundRef, {
        businessId,
        creditSaleId: cs.id, customerId: cs.customerId, customerName: cs.customerName,
        productName: cs.productName, amount: Number(cs.amountPaid) || 0, method,
        refundedAt: serverTimestamp(), refundedBy: profile.uid, refundedByName: profile.displayName,
      });
      await batch.commit();
      toast.success('Sale refunded and stock restored.');
      setRefundTarget(null);
    } catch (err) { toast.error(friendlyErrorMessage(err)); throw err; }
  };

  if (custLoad || credLoad) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={`Could not load data. ${error}`} />;
  if (!customer && creditSales.length === 0) return <EmptyState title="Customer not found" />;

  const displayName = customer?.name || creditSales[0]?.customerName || 'Unknown Customer';
  const displayPhone = customer?.phone || creditSales[0]?.customerPhone || 'No phone';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/customers" className="text-sm font-semibold text-ink-400 hover:text-ink-700">← Back to Customers</Link>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">{displayName}</h1>
          <p className="text-sm text-ink-400">{displayPhone}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-400">Outstanding Debt</p>
          <p className={`font-display text-xl font-bold ${totalOwed > 0 ? 'text-rust-600' : 'text-moss-700'}`}>{formatKES(totalOwed)}</p>
        </div>
      </div>
      <button className="btn-primary w-full sm:w-auto" disabled={totalOwed <= 0} onClick={() => setRepayOpen(true)}>
        <Receipt className="h-4 w-4" strokeWidth={1.75}/> Record repayment
      </button>

      {sorted.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-ink-800">Credit purchases</h2>
          <div className="divide-y divide-ink-100">
            {sorted.map(cs => {
              const reversed = cs.status === 'cancelled' || cs.status === 'refunded';
              return (
                <div key={cs.id} className={`flex items-center justify-between gap-2 py-2.5 text-sm ${reversed ? 'opacity-50' : ''}`}>
                  <div>
                    <p className="font-medium text-ink-700">{cs.quantity} × {cs.productName}</p>
                    <p className="text-xs text-ink-400">{formatDateTime(cs.soldAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={`font-semibold ${reversed ? 'line-through text-ink-400' : 'text-ink-800'}`}>{formatKES(cs.totalAmount)}</p>
                      <span className={`badge ${cs.status === 'paid' ? 'bg-moss-100 text-moss-700' : cs.status === 'partial' ? 'bg-rust-100 text-rust-700' : 'bg-ink-100 text-ink-500'}`}>{cs.status}</span>
                    </div>
                    {isAdmin && !reversed && (
                      <button
                        className="rounded-lg p-2 text-ink-400 hover:bg-ink-100"
                        title={Number(cs.amountPaid) > 0.005 ? 'Refund this sale' : 'Cancel this sale'}
                        onClick={() => (Number(cs.amountPaid) > 0.005 ? setRefundTarget(cs) : setCancelTarget(cs))}
                      >
                        <Undo2 className="h-4 w-4" strokeWidth={1.75}/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {repayments.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-ink-800">Repayment history</h2>
          <div className="divide-y divide-ink-100">
            {repayments.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink-700">{r.method === 'Cash' ? <><Banknote className="inline h-4 w-4 mr-1" strokeWidth={1.75}/>Cash</> : <><Smartphone className="inline h-4 w-4 mr-1" strokeWidth={1.75}/>M-Pesa {r.mpesaCode ? `(${r.mpesaCode})` : ''}</>}</p>
                  <p className="text-xs text-ink-400">{formatDateTime(r.paidAt)}</p>
                </div>
                <span className="font-semibold text-moss-700">{formatKES(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RepaymentModal open={repayOpen} customer={{ name: displayName }} totalOwed={totalOwed} onClose={() => setRepayOpen(false)} onSubmit={handleRepayment} />
      <RefundModal open={!!refundTarget} creditSale={refundTarget} onClose={() => setRefundTarget(null)} onSubmit={(opts) => handleRefund(refundTarget, opts)} />
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this credit sale?"
        message={`"${cancelTarget?.productName}" (×${cancelTarget?.quantity}) will be cancelled and stock restored. Nothing has been paid on this sale yet.`}
        confirmLabel="Cancel sale"
        danger
        onConfirm={() => handleCancel(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}