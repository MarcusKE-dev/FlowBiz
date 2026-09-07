import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus, MessageCircle, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useSettings } from '../contexts/SettingsContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import AddCustomerModal from '../components/customers/AddCustomerModal';
import PageHeader from '../components/ui/PageHeader';
import Toolbar from '../components/ui/Toolbar';
import DataTable from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Money from '../components/ui/Money';
import { createCustomer, updateCustomer } from '../utils/customers';
import { formatKES } from '../utils/currency';
import { formatDate } from '../utils/dateRanges';
import { openWhatsApp, buildDebtReminderMessage, isValidWhatsAppPhone } from '../utils/whatsapp';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Customers() {
  const { businessId, isPro } = useAuth();
  const { settings } = useSettings();

  const customersQ = useMemo(() => businessId ? tenantQuery('customers', businessId) : null, [businessId]);
  const creditQ = useMemo(() => businessId ? tenantQuery('creditSales', businessId) : null, [businessId]);

  const { data: customers, loading: custLoading } = useFirestoreCollection(customersQ);
  const { data: creditSales, loading: credLoading } = useFirestoreCollection(creditQ);
  
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const customerList = useMemo(() => {
    const map = {};
    for (const c of customers) {
      map[c.id] = { customerId: c.id, name: c.name, phone: c.phone, totalOwed: 0, purchaseCount: 0, lastPurchase: null, raw: c };
    }
    for (const cs of creditSales) {
      if (!cs.customerId) continue;
      if (!map[cs.customerId]) {
        map[cs.customerId] = { customerId: cs.customerId, name: cs.customerName, phone: cs.customerPhone, totalOwed: 0, purchaseCount: 0, lastPurchase: null, raw: null };
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

  const handleSaveCustomer = async ({ name, phone }) => {
    try {
      if (editingCustomer) {
        const { queuedOffline } = await updateCustomer(editingCustomer.customerId, { name, phone }, businessId);
        toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Customer updated successfully.');
      } else {
        const { queuedOffline } = await createCustomer({ name, phone }, businessId);
        toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Customer saved successfully.');
      }
      setModalOpen(false);
      setEditingCustomer(null);
    } catch (error) {
      toast.error(friendlyErrorMessage(error, { fallback: 'Unable to save customer. Please try again.' }));
    }
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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Customers"
        description={<>Total outstanding <Money value={totalOut} tone={totalOut > 0 ? 'negative' : undefined} /></>}
        actions={
          <button
            type="button"
            onClick={() => { setEditingCustomer(null); setModalOpen(true); }}
            className="btn-primary"
          >
            <UserPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Add customer
          </button>
        }
      />

      <Toolbar>
        <input
          className="input sm:max-w-sm"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search customers"
        />
      </Toolbar>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          caption="Customers and outstanding balances"
          rows={customerList}
          rowKey={(d) => d.customerId}
          mobileLayout="row"
          columns={[
            {
              key: 'name',
              header: 'Customer',
              primary: true,
              render: (d) => (
                <Link to={`/customers/${d.customerId}`} className="font-medium text-ink-900 hover:text-primary-700 hover:underline">
                  {d.name}
                </Link>
              ),
            },
            { key: 'phone', header: 'Phone', render: (d) => <span className="num text-ink-600">{d.phone || 'No phone'}</span> },
            {
              key: 'purchaseCount',
              header: 'Purchases',
              numeric: true,
              render: (d) => <span className="text-ink-600">{d.purchaseCount}</span>,
            },
            {
              key: 'lastPurchase',
              header: 'Last purchase',
              render: (d) => <span className="text-ink-600">{d.lastPurchase ? formatDate(d.lastPurchase) : '-'}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              mobileTrailing: true,
              render: (d) =>
                d.totalOwed > 0
                  ? <StatusPill tone="caution">Owing</StatusPill>
                  : d.purchaseCount > 0
                    ? <StatusPill tone="positive">Settled</StatusPill>
                    : <StatusPill tone="neutral">No history</StatusPill>,
            },
            {
              key: 'totalOwed',
              header: 'Outstanding',
              numeric: true,
              mobileTrailing: true,
              render: (d) => (
                <span className="font-semibold">
                  <Money value={d.totalOwed} tone={d.totalOwed > 0 ? 'negative' : 'muted'} />
                </span>
              ),
            },
          ]}
          rowActions={(d) => (
            <>
              {d.totalOwed > 0 && (
                <button
                  type="button"
                  onClick={() => handleSendReminder(d)}
                  className="btn-ghost !px-2 text-ink-600"
                  title={isPro ? 'Send a reminder on WhatsApp' : 'Reminders are a FlowBiz Pro feature'}
                  aria-label={`Send a payment reminder to ${d.name}`}
                >
                  <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
              <button
                type="button"
                onClick={() => { setEditingCustomer(d); setModalOpen(true); }}
                className="btn-ghost !px-2 text-ink-500 hover:text-ink-900"
                aria-label={`Edit ${d.name}`}
              >
                <Pencil className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </>
          )}
          empty={
            <EmptyState
              title={search ? 'No customers match that search' : 'No customers yet'}
              description={search ? 'Try another name or phone number.' : "Add a customer, or they'll appear here after a credit sale."}
            />
          }
        />
      )}

      <AddCustomerModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingCustomer(null); }}
        onSave={handleSaveCustomer}
        initialData={editingCustomer ? { name: editingCustomer.name, phone: editingCustomer.phone } : null}
        existingCustomers={customerList.map(d => ({ name: d.name, phone: d.phone }))}
      />
    </div>
  );
}