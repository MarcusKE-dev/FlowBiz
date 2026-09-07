import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { where, orderBy, doc, writeBatch, getDoc, serverTimestamp, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Receipt, Banknote, Smartphone, Undo2, ChevronLeft } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import MetricRail, { Metric } from '../components/ui/MetricRail';
import DataTable from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Money from '../components/ui/Money';
import { amountOnly } from '../components/ui/format';
import RepaymentModal from '../components/debtors/RepaymentModal';
import RefundModal from '../components/debtors/RefundModal';
import DebtPaymentReceiptModal from '../components/debtors/DebtPaymentReceiptModal';
import { formatKES, roundMoney } from '../utils/currency';
import {
  openCreditSales, allocateRepayment, batchAllocations, totalOutstanding, CENT,
} from '../utils/debtAllocation';
import { formatDateTime } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';
import { resolveStockDeltas, missingComponentIds, MAX_RECIPE_DEPTH } from '../utils/inventory';
import { applyStockDeltas } from '../utils/stockWrites';
import { useIndustry } from '../hooks/useIndustry';

export default function CustomerDetail() {
  const { customerId } = useParams();
  const { profile, isAdmin, businessId } = useAuth();
  const industry = useIndustry();

  const customerQ   = useMemo(() => businessId ? tenantQuery('customers', businessId, where('__name__','==',customerId)) : null, [customerId, businessId]);
  const creditQ     = useMemo(() => businessId ? tenantQuery('creditSales', businessId, where('customerId','==',customerId)) : null, [customerId, businessId]);
  const repaymentsQ = useMemo(() => businessId ? tenantQuery('repayments', businessId, where('customerId','==',customerId), orderBy('paidAt','desc')) : null, [customerId, businessId]);

  const { data: customerData, loading: custLoad } = useFirestoreCollection(customerQ);
  const { data: creditSales, loading: credLoad, error } = useFirestoreCollection(creditQ);
  const { data: repayments } = useFirestoreCollection(repaymentsQ);
  
  const [repayOpen, setRepayOpen]       = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [receiptData, setReceiptData]   = useState(null);

  const customer = customerData[0];
  const sorted = [...creditSales].sort((a,b) => (b.soldAt?.toMillis?.() ?? 0) - (a.soldAt?.toMillis?.() ?? 0));
  // One definition of "open", shared with the allocation below, so the
  // balance shown, the balance the modal validates against and the
  // balance a payment is spread over can never be three different numbers.
  const totalOwed = totalOutstanding(openCreditSales(creditSales));

  const displayName = customer?.name || creditSales[0]?.customerName || 'Unknown Customer';
  const displayPhone = customer?.phone || creditSales[0]?.customerPhone || '';

  // A debt payment is a payment against existing debt — it updates the
  // credit sale(s) it applies to and nothing else. It never creates a new
  // sale or a second financial transaction (Part 28). If the customer has
  // more than one open credit sale, a single payment can span several of
  // them (oldest first, unchanged from the app's existing allocation
  // rule) — the receipt below reflects the payment at the customer level
  // (previous total owed → new total owed), with each sale's own
  // reference number kept for traceability (Part 18/19).
  const handleRepayment = async ({ amount, method, mpesaCode }) => {
    const openSales = openCreditSales(creditSales);
    if (!openSales.length) { toast.error('No outstanding balance.'); return; }

    // The allocation is worked out BEFORE anything is written, so the two
    // things that used to go wrong here cannot.
    //
    // A surplus is refused rather than written. RepaymentModal already
    // blocks an over-payment, but it blocks it against a balance read a
    // moment earlier — if another till settled an invoice in between, a
    // legitimate-looking amount no longer fits. Writing it anyway would
    // put a repayment total in the ledger that does not match the receipt
    // handed to the customer, and FlowBiz has no customer-credit ledger
    // to hold the difference. Refusing costs the cashier one re-entry
    // against the corrected balance; the alternative costs them an
    // unexplainable variance at close of day.
    const { allocations, allocated, surplus } = allocateRepayment(openSales, amount);
    if (surplus > CENT) {
      const owedNow = totalOutstanding(openSales);
      toast.error(`This customer now owes ${formatKES(owedNow)}. Enter that or less.`);
      throw new Error('Repayment exceeds the outstanding balance.');
    }
    if (!allocations.length) { toast.error('Enter an amount greater than zero.'); return; }

    const previousBalance = totalOwed;

    try {
      // One batch per 200 settled sales. A single lump sum from a
      // wholesale customer can clear hundreds of invoices, and each one
      // costs two writes — past 249 sales the old single batch broke
      // Firestore's 500-operation ceiling and the payment could not be
      // recorded at all. Every batch is built before any is committed,
      // and they are committed together, so offline they queue as one
      // ordered run exactly as a single batch did.
      const groups = batchAllocations(allocations);
      const batches = groups.map(() => writeBatch(db));
      const paymentReferences = [];

      groups.forEach((group, groupIndex) => {
        const batch = batches[groupIndex];
        for (const { sale: cs, portion, newPaid, newBalance, status } of group) {
          batch.update(doc(db,'creditSales',cs.id), { amountPaid: newPaid, remainingBalance: newBalance, status });

          const repRef = doc(collection(db,'repayments'));
          // Reuses Firestore's own unique doc id for traceability rather than
          // introducing a second, parallel counter/ID system (Part 18) —
          // adapted to this app's existing ID conventions rather than
          // literally implementing PAY-000381-style sequential numbering.
          const paymentReference = `PAY-${repRef.id.slice(-6).toUpperCase()}`;
          paymentReferences.push(paymentReference);
          batch.set(repRef, {
            businessId,
            creditSaleId: cs.id,
            customerId: cs.customerId,
            customerName: cs.customerName,
            productName: cs.productName,
            amount: portion,
            method,
            mpesaCode: mpesaCode || null,
            paymentReference,
            paidAt: serverTimestamp(),
            recordedBy: profile.uid,
            recordedByName: profile.displayName,
          });
        }
      });

      // Persist an immutable snapshot of the receipt itself (Parts 8/9/15
      // of the WhatsApp/document-sharing spec). A debt payment can span
      // several credit sales, so there's no single existing Firestore
      // document that already IS "the receipt" the way a sale or credit
      // sale doc already represents its own receipt — this is that
      // missing piece. It goes in the LAST batch, after the repayments it
      // summarises, so it can never be the only thing that landed.
      //
      // The figure on it is `allocated`, which the refusal above has
      // already proved equals the amount handed over. The receipt and the
      // `repayments` collection therefore always agree, which is what
      // makes the till reconcile.
      const newTotalOwed = Math.max(0, roundMoney(previousBalance - allocated));
      const receiptRef = doc(collection(db, 'debtPaymentReceipts'));
      batches[batches.length - 1].set(receiptRef, {
        businessId,
        customerId,
        customerName: displayName,
        customerPhone: displayPhone,
        amountPaid: allocated,
        previousBalance,
        remainingBalance: newTotalOwed,
        isCleared: newTotalOwed <= CENT,
        method,
        mpesaCode: mpesaCode || null,
        paymentReferences,
        paidAt: new Date(),
        recordedBy: profile.uid,
        recordedByName: profile.displayName,
      });

      // Committed together and awaited as one, so the offline path is
      // unchanged: Firestore's mutation queue is ordered, so these apply
      // in the order they were built when the connection returns.
      const commit = Promise.all(batches.map((b) => b.commit()));
      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : `Recorded ${formatKES(allocated)} repayment`);
      if (queuedOffline) commit.catch((err) => toast.error(`A repayment from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));

      setReceiptData({
        receiptDocId: receiptRef.id,
        customerId,
        customerName: displayName,
        customerPhone: displayPhone,
        amountPaid: allocated,
        previousBalance,
        remainingBalance: newTotalOwed,
        isCleared: newTotalOwed <= CENT,
        method,
        mpesaCode,
        paidAt: new Date(),
        paymentReferences,
      });
    } catch (err) { toast.error(friendlyErrorMessage(err)); throw err; }
  };

  // Cancelling or refunding a credit sale puts stock back through the ONE
  // inventory foundation, exactly as Counter.handleVoid does. It used to
  // write a raw `increment(item.quantity)` per line, which credited the
  // product total but never the version a boutique sold, never the recipe
  // components a kitchen used, and never the batch a pharmacy dispensed
  // from — so a reversal quietly broke the invariants the sale had kept.
  //
  // Only the products this sale actually needs are fetched — this page
  // has no catalogue listener, unlike the counter and the dashboard.
  // "Needs" includes the RECIPE COMPONENTS of anything made to order: a
  // burger's patty and bun are what the sale really took off the shelf,
  // and resolveStockDeltas() can only put back what it can see in the
  // products it is handed. Fetching the parents alone made a kitchen's
  // cancelled credit sale credit the burger and silently keep the
  // ingredients — permanent, invisible shrinkage.
  //
  // Components are pulled a level at a time because a recipe's shape is
  // only known once its parent has been read, and a component may itself
  // be a recipe (a sauce made from ingredients). The loop stops at
  // MAX_RECIPE_DEPTH, which is where resolveStockDeltas() stops
  // recursing, so it never fetches a level the engine would ignore.
  //
  // A product deleted since the sale is skipped rather than resurrected.
  const loadProductsFor = async (rows) => {
    const seen = new Set(rows.map((row) => row.productId).filter(Boolean));
    const fetchAll = async (ids) => {
      const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, 'products', id))));
      return snaps
        .map((snap, idx) => (snap.exists() ? { id: ids[idx], ...snap.data() } : null))
        .filter(Boolean);
    };

    const live = await fetchAll([...seen]);
    if (industry.can('recipes')) {
      let frontier = live;
      for (let level = 0; level < MAX_RECIPE_DEPTH; level++) {
        const next = missingComponentIds(frontier, seen);
        if (next.length === 0) break;
        next.forEach((id) => seen.add(id));
        frontier = await fetchAll(next);
        live.push(...frontier);
      }
    }
    return live;
  };

  const restoreStock = async (batch, cs) => {
    const lineItems = Array.isArray(cs.items) && cs.items.length > 0
      ? cs.items
      : [{ productId: cs.productId, quantity: cs.quantity, variantId: cs.variantId, batchAllocations: cs.batchAllocations }];
    const targets = lineItems.filter((item) => item.productId);
    const live = await loadProductsFor(targets);

    const deltas = resolveStockDeltas(targets, live, {
      recipes: industry.can('recipes'), packSizes: industry.can('packSizes'), reverse: true,
    });
    applyStockDeltas(batch, deltas);
  };

  const handleCancel = async (cs) => {
    setCancelTarget(null);
    try {
      const batch = writeBatch(db);
      await restoreStock(batch, cs);
      batch.update(doc(db,'creditSales',cs.id), {
        status: 'cancelled', remainingBalance: 0,
        cancelledAt: serverTimestamp(), cancelledBy: profile.uid,
      });
      // Queued like every other write in the product, so cancelling a
      // sale works on a phone with no signal and applies atomically when
      // it syncs. This path used to await the commit directly, which left
      // an offline owner watching a spinner that would never resolve.
      const commit = batch.commit();
      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      if (queuedOffline) commit.catch((err) => toast.error(`A cancellation from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      toast.success(queuedOffline
        ? 'Cancelled offline. It will sync when you reconnect.'
        : 'Credit sale cancelled and stock restored.');
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
  };

  // Same restoration as handleCancel above, applied to a refund (a credit
  // sale that had some amount already paid on it).
  const handleRefund = async (cs, { method }) => {
    try {
      const batch = writeBatch(db);
      await restoreStock(batch, cs);
      batch.update(doc(db,'creditSales',cs.id), {
        status: 'refunded', remainingBalance: 0,
        refundedAt: serverTimestamp(), refundedBy: profile.uid,
      });
      const refundRef = doc(collection(db,'refunds'));
      batch.set(refundRef, {
        businessId,
        creditSaleId: cs.id, customerId: cs.customerId, customerName: cs.customerName,
        productName: cs.productName, amount: Number(cs.amountPaid) || 0, method,
        refundedAt: new Date(), refundedBy: profile.uid, refundedByName: profile.displayName,
      });
      const commit = batch.commit();
      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      if (queuedOffline) commit.catch((err) => toast.error(`A refund from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      toast.success(queuedOffline
        ? 'Refunded offline. It will sync when you reconnect.'
        : 'Sale refunded and stock restored.');
      setRefundTarget(null);
    } catch (err) { toast.error(friendlyErrorMessage(err)); throw err; }
  };

  if (custLoad || credLoad) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={`Could not load data. ${error}`} />;
  if (!customer && creditSales.length === 0) return <EmptyState title="Customer not found" />;

  return (
    // Full width. The tables and strips below run to the edge of the
    // content area, which a centred column would stop short of; the
    // 1800px ceiling lives in AppShell so every page shares one.
    <div className="space-y-6">
      <Link
        to="/customers"
        className="inline-flex items-center gap-1 text-secondary font-medium text-ink-600 hover:text-primary-700"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Back to customers
      </Link>

      <PageHeader
        title={displayName}
        description={displayPhone || 'No phone number on file'}
        actions={
          <button className="btn-primary" disabled={totalOwed <= 0} onClick={() => setRepayOpen(true)}>
            <Receipt className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Record repayment
          </button>
        }
      />

      <MetricRail columns={3} bleed>
        <Metric
          label="Outstanding"
          prefix="KES"
          value={amountOnly(totalOwed)}
        />
        <Metric label="Credit purchases" value={sorted.length} />
        <Metric label="Repayments" value={repayments.length} />
      </MetricRail>

      {sorted.length > 0 && (
        <Section title="Credit purchases">
          <DataTable
            bleed
            caption="Credit purchases made by this customer"
            rows={sorted}
            rowKey={(cs) => cs.id}
            mobileLayout="row"
            columns={[
              {
                key: 'productName',
                header: 'Purchase',
                primary: true,
                render: (cs) => {
                  const reversed = cs.status === 'cancelled' || cs.status === 'refunded';
                  return (
                    <span className={reversed ? 'text-ink-400 line-through' : 'text-ink-900'}>
                      <span className="num">{cs.quantity}</span> × {cs.productName}
                    </span>
                  );
                },
              },
              { key: 'soldAt', header: 'Date', render: (cs) => <span className="text-ink-600">{formatDateTime(cs.soldAt)}</span> },
              {
                key: 'status',
                header: 'Status',
                mobileTrailing: true,
                render: (cs) => (
                  <StatusPill
                    tone={
                      cs.status === 'paid' ? 'positive'
                      : cs.status === 'partial' ? 'caution'
                      : cs.status === 'cancelled' || cs.status === 'refunded' ? 'neutral'
                      : 'caution'
                    }
                  >
                    {cs.status === 'paid' ? 'Paid'
                      : cs.status === 'partial' ? 'Part paid'
                      : cs.status === 'cancelled' ? 'Cancelled'
                      : cs.status === 'refunded' ? 'Refunded'
                      : 'Unpaid'}
                  </StatusPill>
                ),
              },
              {
                key: 'totalAmount',
                header: 'Amount',
                numeric: true,
                mobileTrailing: true,
                render: (cs) => {
                  const reversed = cs.status === 'cancelled' || cs.status === 'refunded';
                  return (
                    <span className={`font-semibold ${reversed ? 'text-ink-400 line-through' : ''}`}>
                      <Money value={cs.totalAmount} />
                    </span>
                  );
                },
              },
            ]}
            rowActions={(cs) => {
              const reversed = cs.status === 'cancelled' || cs.status === 'refunded';
              if (!isAdmin || reversed) return null;
              const refunding = Number(cs.amountPaid) > 0.005;
              return (
                <button
                  className="btn-ghost !px-2 text-ink-500 hover:text-danger-700"
                  title={refunding ? 'Refund this sale' : 'Cancel this sale'}
                  aria-label={`${refunding ? 'Refund' : 'Cancel'} the sale of ${cs.productName}`}
                  onClick={() => (refunding ? setRefundTarget(cs) : setCancelTarget(cs))}
                >
                  <Undo2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              );
            }}
          />
        </Section>
      )}

      {repayments.length > 0 && (
        <Section title="Repayment history">
          <DataTable
            bleed
            caption="Repayments received from this customer"
            rows={repayments}
            rowKey={(r) => r.id}
            mobileLayout="row"
            columns={[
              {
                key: 'method',
                header: 'Method',
                primary: true,
                render: (r) => (
                  <span className="inline-flex items-center gap-1.5 text-ink-900">
                    {r.method === 'Cash'
                      ? <Banknote className="h-4 w-4 text-ink-500" strokeWidth={1.75} aria-hidden="true" />
                      : <Smartphone className="h-4 w-4 text-ink-500" strokeWidth={1.75} aria-hidden="true" />}
                    {r.method === 'Cash' ? 'Cash' : `M-Pesa${r.mpesaCode ? ` (${r.mpesaCode})` : ''}`}
                  </span>
                ),
              },
              { key: 'paidAt', header: 'Date', render: (r) => <span className="text-ink-600">{formatDateTime(r.paidAt)}</span> },
              {
                key: 'paymentReference',
                header: 'Reference',
                render: (r) => <span className="num text-ink-600">{r.paymentReference || '-'}</span>,
              },
              {
                key: 'amount',
                header: 'Amount',
                numeric: true,
                mobileTrailing: true,
                render: (r) => <span className="font-semibold"><Money value={r.amount} tone="positive" /></span>,
              },
            ]}
          />
        </Section>
      )}

      <RepaymentModal open={repayOpen} customer={{ name: displayName }} totalOwed={totalOwed} onClose={() => setRepayOpen(false)} onSubmit={handleRepayment} />
      <RefundModal open={!!refundTarget} creditSale={refundTarget} onClose={() => setRefundTarget(null)} onSubmit={(opts) => handleRefund(refundTarget, opts)} />
      <DebtPaymentReceiptModal open={!!receiptData} receipt={receiptData} onClose={() => setReceiptData(null)} />
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
