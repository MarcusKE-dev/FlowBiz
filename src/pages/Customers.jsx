import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { UserPlus, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useSettings } from '../hooks/useSettings';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import AddCustomerModal from '../components/customers/AddCustomerModal';
import { formatKES } from '../utils/currency';
import { formatDate } from '../utils/dateRanges';
import { openWhatsApp, buildDebtReminderMessage, isValidWhatsAppPhone } from '../utils/whatsapp';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Customers() {
  const { businessId, isPro } = useAuth();
  const { settings } = useSettings();

  const customersQ = useMemo(() => businessId ? tenantQuery('customers', businessId, orderBy('name')) : null, [businessId]);
  const creditQ = useMemo(() => businessId ? tenantQuery('creditSales', businessId) : null, [businessId]);

  const { data: customers, loading: custLoading } = useFirestoreCollection(customersQ);
  const { data: creditSales, loading: credLoading } = useFirestoreCollection(creditQ);
  
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Customers shown here come from two sources: customers created
  // directly (Part 1) and customers implied by a past credit sale that
  // predates this feature. Both resolve to ONE canonical entry keyed by
  // customerId — a credit sale never creates a second record for a
  // customer that already has one (Part 3).
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

  const handleAddCustomer = async ({ name, phone }) => {
    const write = addDoc(tenantCollection('customers'), withBusiness({
      name, phone: phone || '', email: '', address: '', notes: '', createdAt: serverTimestamp(),
    }, businessId));
    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    if (error) {
      toast.error(friendlyErrorMessage(error, { fallback: 'Unable to save customer. Please try again.' }));
      throw error;
    }
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Customer saved successfully.');
  };

  const handleSendReminder = (d) => {
    if (!isPro) {
      toast.error('WhatsApp sharing is available on FlowBiz Pro.');
      return;
    }
    if (!d.phone || !isValidWhatsAppPhone(d.phone)) {
      toast.error('Add a valid phone number for this customer before sending a WhatsApp reminder.');
      return;
    }
    const message = buildDebtReminderMessage({
      shopName: settings.shopName || 'FlowBiz Store',
      customerName: d.name,
      outstandingAmount: d.totalOwed,
      businessPhone: settings.phone,
      formatKES,
    });
    const opened = openWhatsApp(d.phone, message);
    toast[opened ? 'success' : 'error'](opened ? 'WhatsApp opened.' : 'WhatsApp could not be opened.');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Customers</h1>
          <p className="text-sm text-ink-400">Total outstanding debt: <span className="font-semibold text-rust-600">{formatKES(totalOut)}</span></p>
        </div>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 shadow-sm hover:bg-ink-50 active:bg-ink-100"
          aria-label="Add customer"
          title="Add customer"
        >
          <UserPlus className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
      <input className="input" placeholder="Search customer…" value={search} onChange={e => setSearch(e.target.value)} />
      {loading ? <LoadingSpinner /> : customerList.length === 0 ? (
        <EmptyState title="No customers found" description="Add a customer, or they'll appear here after a credit sale." />
      ) : (
        <div className="space-y-2">
          {customerList.map(d => (
            <div key={d.customerId} className="card flex items-center justify-between gap-2 p-4 hover:shadow-md">
              <Link to={`/customers/${d.customerId}`} className="min-w-0 flex-1">
                <p className="font-semibold text-ink-800 truncate">{d.name}</p>
                <p className="text-xs text-ink-400">{d.phone || 'No phone'} · {d.purchaseCount} purchase{d.purchaseCount !== 1 ? 's' : ''} {d.lastPurchase ? `· last ${formatDate(d.lastPurchase)}` : ''}</p>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                {d.totalOwed > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSendReminder(d)}
                    className="flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50"
                    title={isPro ? 'Send reminder via WhatsApp' : 'FlowBiz Pro feature'}
                  >
                    <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Remind{!isPro && <span className="text-amber-600"> · PRO</span>}
                  </button>
                )}
                <Link to={`/customers/${d.customerId}`} className={`font-display text-base font-bold ${d.totalOwed > 0 ? 'text-rust-600' : 'text-moss-700'}`}>
                  {d.totalOwed > 0 ? formatKES(d.totalOwed) : 'Paid'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <AddCustomerModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddCustomer}
        existingCustomers={customerList.map(d => ({ name: d.name, phone: d.phone }))}
      />
    </div>
  );
}