import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { formatKES } from '../utils/currency';
import { formatDate } from '../utils/dateRanges';

export default function Customers() {
  const { businessId } = useAuth();
  
  const customersQ = useMemo(() => businessId ? tenantQuery('customers', businessId, orderBy('name')) : null, [businessId]);
  const creditQ = useMemo(() => businessId ? tenantQuery('creditSales', businessId) : null, [businessId]);

  const { data: customers, loading: custLoading } = useFirestoreCollection(customersQ);
  const { data: creditSales, loading: credLoading } = useFirestoreCollection(creditQ);
  
  const [search, setSearch] = useState('');

  const customerList = useMemo(() => {
    const map = {};
    for (const c of customers) {
      map[c.id] = { customerId: c.id, name: c.name, phone: c.phone, totalOwed: 0, purchaseCount: 0, lastPurchase: null };
    }
    for (const cs of creditSales) {
      if (!cs.customerId) continue;
      if (!map[cs.customerId]) {
        map[cs.customerId] = { customerId: cs.customerId, name: cs.customerName, phone: cs.customerPhone, totalOwed: 0, purchaseCount: 0, lastPurchase: null };
      }
      const e = map[cs.customerId];
      if (cs.status === 'pending' || cs.status === 'partial') {
        e.totalOwed += Number(cs.remainingBalance) || 0;
      }
      e.purchaseCount++;
      if (!e.lastPurchase || (cs.soldAt?.toMillis?.() ?? 0) > (e.lastPurchase?.toMillis?.() ?? 0)) {
        e.lastPurchase = cs.soldAt;
      }
    }
    return Object.values(map)
      .filter(d => d.name?.toLowerCase().includes(search.toLowerCase()) || d.phone?.includes(search))
      .sort((a, b) => b.totalOwed - a.totalOwed);
  }, [customers, creditSales, search]);

  const loading = custLoading || credLoading;
  const totalOut = customerList.reduce((acc, d) => acc + d.totalOwed, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-900">Customers</h1>
        <p className="text-sm text-ink-400">Total outstanding debt: <span className="font-semibold text-rust-600">{formatKES(totalOut)}</span></p>
      </div>
      <input className="input" placeholder="Search customer…" value={search} onChange={e => setSearch(e.target.value)} />
      {loading ? <LoadingSpinner /> : customerList.length === 0 ? <EmptyState title="No customers found" description="Customers will appear here when recorded." /> : (
        <div className="space-y-2">
          {customerList.map(d => (
            <Link key={d.customerId} to={`/customers/${d.customerId}`} className="card flex items-center justify-between p-4 hover:shadow-md">
              <div>
                <p className="font-semibold text-ink-800">{d.name}</p>
                <p className="text-xs text-ink-400">{d.phone || 'No phone'} · {d.purchaseCount} purchase{d.purchaseCount > 1 ? 's' : ''} {d.lastPurchase ? `· last ${formatDate(d.lastPurchase)}` : ''}</p>
              </div>
              <span className={`font-display text-base font-bold ${d.totalOwed > 0 ? 'text-rust-600' : 'text-moss-700'}`}>
                {d.totalOwed > 0 ? formatKES(d.totalOwed) : 'Paid'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}