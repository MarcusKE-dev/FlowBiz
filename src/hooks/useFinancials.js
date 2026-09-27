import { useEffect, useRef, useState } from 'react';
import { where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { computeFinancials } from '../utils/financials';

// Every collection the money is added up from. WASTE is one of them: the
// engine has always subtracted recorded waste from net profit, but this
// hook — the one the dashboard, reports, close day and analytics all read
// — never subscribed to it, so a business that binned a crate of milk saw
// exactly the profit it would have seen had it sold it.
const SOURCES = ['sales', 'allCreditSales', 'expenses', 'repayments', 'purchases', 'supplierPayments', 'refunds', 'waste'];

const emptyData = () => Object.fromEntries(SOURCES.map((key) => [key, []]));

export function useFinancialsForRange(start, end) {
  const { businessId } = useAuth();
  const [state, setState] = useState({
    loading: true, error: null,
    sales: [], creditSales: [], expenses: [], repayments: [], purchases: [], supplierPayments: [], refunds: [], waste: [],
    summary: computeFinancials({}),
  });
  const dataRef = useRef(emptyData());
  const rafRef  = useRef(null);

  // Which range and business the state currently describes. Until the
  // state belongs to THIS key, it is reported as loading.
  const toMs = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : (v instanceof Date ? v.getTime() : new Date(v).getTime()));
  const rangeKey = `${businessId || ''}|${start ? toMs(start) : ''}|${end ? toMs(end) : ''}`;

  useEffect(() => {
    if (!start || !end || !businessId) return;
    let mounted = true;

    // A NEW RANGE OR A NEW BUSINESS STARTS FROM NOTHING. The previous
    // range's rows used to stay in the buffer, so the first snapshot of a
    // new range was added up against the OLD range's expenses and
    // repayments — and after switching business, against the other
    // business's. Nothing is reported until every source for THIS range
    // has answered at least once.
    dataRef.current = emptyData();
    const arrived = new Set();
    let firstError = null;

    const flush = () => {
      if (!mounted || arrived.size < SOURCES.length) return;
      const { sales, allCreditSales, expenses, repayments, purchases, supplierPayments, refunds, waste } = dataRef.current;
      const startMs = typeof start?.toMillis === 'function' ? start.toMillis() : (start instanceof Date ? start.getTime() : new Date(start).getTime());
      const endMs = typeof end?.toMillis === 'function' ? end.toMillis() : (end instanceof Date ? end.getTime() : new Date(end).getTime());

      const rangeCreditSales = allCreditSales.filter((entry) => {
        const raw = entry?.soldAt;
        const soldAt = raw?.toMillis?.() ?? (raw instanceof Date ? raw.getTime() : (typeof raw === 'number' ? raw : (raw?.toDate?.()?.getTime?.() ?? Date.now())));
        return typeof soldAt === 'number' && soldAt >= startMs && soldAt <= endMs;
      });

      setState({
        key: rangeKey,
        loading: false, error: firstError,
        sales, creditSales: rangeCreditSales, expenses, repayments, purchases, supplierPayments, refunds, waste,
        summary: computeFinancials({
          sales, creditSales: rangeCreditSales, allCreditSales, expenses, debtRepayments: repayments,
          purchases, supplierPayments, refunds, wasteRecords: waste,
        }),
      });
    };

    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(flush);
    };


    const queries = {
      sales:            tenantQuery('sales', businessId, where('soldAt','>=',start), where('soldAt','<=',end), orderBy('soldAt','desc')),
      allCreditSales:   tenantQuery('creditSales', businessId, orderBy('soldAt','desc')),
      expenses:         tenantQuery('expenses', businessId, where('recordedAt','>=',start), where('recordedAt','<=',end), orderBy('recordedAt','desc')),
      repayments:       tenantQuery('repayments', businessId, where('paidAt','>=',start), where('paidAt','<=',end), orderBy('paidAt','desc')),
      purchases:        tenantQuery('purchases', businessId, where('purchasedAt','>=',start), where('purchasedAt','<=',end), orderBy('purchasedAt','desc')),
      supplierPayments: tenantQuery('supplierPayments', businessId, where('paidAt','>=',start), where('paidAt','<=',end), orderBy('paidAt','desc')),
      refunds:          tenantQuery('refunds', businessId, where('refundedAt','>=',start), where('refundedAt','<=',end), orderBy('refundedAt','desc')),
      waste:            tenantQuery('waste', businessId, where('recordedAt','>=',start), where('recordedAt','<=',end), orderBy('recordedAt','desc')),
    };

    const unsubscribers = Object.entries(queries).map(([key, q]) => onSnapshot(
      q,
      (snap) => {
        dataRef.current[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        arrived.add(key);
        schedule();
      },
      (err) => {
        // A source that cannot be read (a rule, a missing index) must not
        // hold the whole screen on a spinner forever. It counts as empty
        // and the error is shown.
        arrived.add(key);
        if (!firstError) firstError = err.message;
        schedule();
      }
    ));

    return () => {
      mounted = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [start, end, businessId, rangeKey]);

  return state.key === rangeKey ? state : { ...state, loading: true };
}
