import { useEffect, useRef, useState } from 'react';
import { where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { computeFinancials } from '../utils/financials';

export function useFinancialsForRange(start, end) {
  const { businessId } = useAuth();
  const [state, setState] = useState({
    loading: true, error: null,
    sales: [], creditSales: [], expenses: [], repayments: [], purchases: [], supplierPayments: [], refunds: [],
    summary: computeFinancials({}),
  });
  const dataRef = useRef({ sales: [], creditSales: [], allCreditSales: [], expenses: [], repayments: [], purchases: [], supplierPayments: [], refunds: [] });
  const rafRef  = useRef(null);

  useEffect(() => {
    if (!start || !end || !businessId) return;
    let mounted = true;

    const flush = () => {
      if (!mounted) return;
      const { sales, allCreditSales, expenses, repayments, purchases, supplierPayments, refunds } = dataRef.current;
      const startMs = typeof start?.toMillis === 'function' ? start.toMillis() : (start instanceof Date ? start.getTime() : new Date(start).getTime());
      const endMs = typeof end?.toMillis === 'function' ? end.toMillis() : (end instanceof Date ? end.getTime() : new Date(end).getTime());

      const rangeCreditSales = allCreditSales.filter((entry) => {
        const raw = entry?.soldAt;
        const soldAt = raw?.toMillis?.() ?? (raw instanceof Date ? raw.getTime() : (typeof raw === 'number' ? raw : (raw?.toDate?.()?.getTime?.() ?? Date.now())));
        return typeof soldAt === 'number' && soldAt >= startMs && soldAt <= endMs;
      });

      setState({
        loading: false, error: null,
        sales, creditSales: rangeCreditSales, expenses, repayments, purchases, supplierPayments, refunds,
        summary: computeFinancials({ sales, creditSales: rangeCreditSales, allCreditSales, expenses, debtRepayments: repayments, purchases, supplierPayments, refunds }),
      });
    };

    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(flush);
    };

    const onErr = err => mounted && setState(s => ({ ...s, loading: false, error: err.message }));

    const salesQ      = tenantQuery('sales', businessId, where('soldAt','>=',start), where('soldAt','<=',end), orderBy('soldAt','desc'));
    const creditQ     = tenantQuery('creditSales', businessId, orderBy('soldAt','desc'));
    const expensesQ   = tenantQuery('expenses', businessId, where('recordedAt','>=',start), where('recordedAt','<=',end), orderBy('recordedAt','desc'));
    const repaymentsQ = tenantQuery('repayments', businessId, where('paidAt','>=',start), where('paidAt','<=',end), orderBy('paidAt','desc'));
    const purchasesQ  = tenantQuery('purchases', businessId, where('purchasedAt','>=',start), where('purchasedAt','<=',end), orderBy('purchasedAt','desc'));
    const supplierPaymentsQ = tenantQuery('supplierPayments', businessId, where('paidAt','>=',start), where('paidAt','<=',end), orderBy('paidAt','desc'));
    const refundsQ = tenantQuery('refunds', businessId, where('refundedAt','>=',start), where('refundedAt','<=',end), orderBy('refundedAt','desc'));

    const u1 = onSnapshot(salesQ,      s => { dataRef.current.sales      = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u2 = onSnapshot(creditQ,     s => { dataRef.current.allCreditSales = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u3 = onSnapshot(expensesQ,   s => { dataRef.current.expenses   = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u4 = onSnapshot(repaymentsQ, s => { dataRef.current.repayments = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u5 = onSnapshot(purchasesQ,  s => { dataRef.current.purchases  = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u6 = onSnapshot(supplierPaymentsQ, s => { dataRef.current.supplierPayments = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u7 = onSnapshot(refundsQ, s => { dataRef.current.refunds = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);

    return () => {
      mounted = false;
      u1(); u2(); u3(); u4(); u5(); u6(); u7();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [start, end, businessId]);

  return state;
}