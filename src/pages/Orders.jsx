// src/pages/Orders.jsx
//
// Everything happening in the room right now: which tables are taken,
// which tickets are open, and where each one is in the kitchen.
//
// This is a VIEW over the orders the counter creates, not a second place
// to create them. There is exactly one order engine, and it lives at the
// counter; this page reads the same collection, advances a kitchen
// status, and hands a ticket back to the counter to be added to or
// charged. Building an ordering flow here as well is how a product ends
// up with two subtly different ways to take an order.
//
// The page is only reachable when the `orders` capability is on — see
// navConfig.js — so nothing here needs to check the profile.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp, orderBy, where, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ChefHat, Clock, Utensils } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useIndustry } from '../hooks/useIndustry';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import MetricRail, { Metric } from '../components/ui/MetricRail';
import EmptyState from '../components/ui/EmptyState';
import StatusPill from '../components/ui/StatusPill';
import Money from '../components/ui/Money';
import SegmentedControl from '../components/ui/SegmentedControl';
import { amountOnly } from '../components/ui/format';
import { formatDateTime } from '../utils/dateRanges';
import { describeModifiers } from '../utils/modifiers';
import { formatQuantityWithUnit } from '../industry/units';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';
import {
  ORDER_STATUS, KITCHEN_STATUSES, KITCHEN_LABELS, nextKitchenStatus,
  diningModeLabel, tableStates, summarizeOpenOrders,
} from '../utils/orders';

const KITCHEN_TONE = { new: 'caution', preparing: 'info', ready: 'positive', served: 'neutral' };

function OrderCard({ order, showKitchen, onAdvance, onOpen, onCancel, busy, openLabel = 'Open at counter' }) {
  const status = order.kitchenStatus || 'new';
  return (
    <div className="space-y-3 rounded-panel border border-line bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-section-title text-ink-900">{order.name}</p>
          <p className="text-secondary text-ink-500">
            {order.diningMode ? `${diningModeLabel(order.diningMode)} · ` : ''}
            {formatDateTime(order.openedAt)}
            {order.openedByName ? ` · ${order.openedByName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showKitchen && (
            <StatusPill tone={KITCHEN_TONE[status] || 'neutral'}>{KITCHEN_LABELS[status]}</StatusPill>
          )}
          <span className="text-body font-semibold text-ink-900"><Money value={order.totalAmount} /></span>
        </div>
      </div>

      <ul className="space-y-1">
        {(order.items || []).map((item, index) => (
          <li key={`${item.productId}-${index}`} className="text-secondary text-ink-700">
            <span className="num font-semibold text-ink-900">
              {formatQuantityWithUnit(item.quantity, item.unit)}
            </span>
            {' × '}{item.productName}
            {item.modifiers?.length > 0 && (
              <span className="text-ink-500"> · {describeModifiers(item.modifiers)}</span>
            )}
            {item.note && <span className="italic text-ink-500"> · {item.note}</span>}
          </li>
        ))}
      </ul>

      {order.note && <p className="text-secondary italic text-ink-500">{order.note}</p>}

      <div className="flex flex-wrap gap-2 border-t border-divider pt-2.5">
        {showKitchen && status !== 'served' && (
          <button type="button" className="btn-secondary" onClick={() => onAdvance(order)} disabled={busy}>
            <ChefHat className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Mark {KITCHEN_LABELS[nextKitchenStatus(status)].toLowerCase()}
          </button>
        )}
        <button type="button" className="btn-primary" onClick={() => onOpen(order)} disabled={busy}>
          {openLabel}
        </button>
        <button
          type="button"
          className="btn-ghost text-ink-600 hover:text-danger-700"
          onClick={() => onCancel(order)}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Orders() {
  const { businessId, profile } = useAuth();
  const { settings } = useSettings();
  const industry = useIndustry();
  const navigate = useNavigate();

  const [kitchenFilter, setKitchenFilter] = useState('all');
  const [pendingCancel, setPendingCancel] = useState(null);
  const [busy, setBusy] = useState(false);

  const ordersQ = useMemo(
    () => (businessId
      ? tenantQuery('orders', businessId, where('status', '==', ORDER_STATUS.OPEN), orderBy('openedAt', 'desc'), limit(200))
      : null),
    [businessId]
  );
  const { data: orders, loading } = useFirestoreCollection(ordersQ);

  const showKitchen = industry.can('kitchen');
  const showTables = industry.can('tables');

  const summary = useMemo(() => summarizeOpenOrders(orders), [orders]);
  const tables = useMemo(
    () => (showTables ? tableStates(settings.tables, orders) : []),
    [showTables, settings.tables, orders]
  );

  const visible = useMemo(
    () => (kitchenFilter === 'all' ? orders : orders.filter((o) => (o.kitchenStatus || 'new') === kitchenFilter)),
    [orders, kitchenFilter]
  );

  const advance = async (order) => {
    setBusy(true);
    const write = updateDoc(doc(db, 'orders', order.id), {
      kitchenStatus: nextKitchenStatus(order.kitchenStatus || 'new'),
      updatedAt: serverTimestamp(),
    });
    const { error } = await raceWithTimeout(write, 4000);
    setBusy(false);
    if (error) toast.error(friendlyErrorMessage(error));
  };

  const cancel = async () => {
    const order = pendingCancel;
    setBusy(true);
    // Cancelled, never deleted. An abandoned ticket is a thing that
    // happened, and it holds no stock to release — nothing was ever taken.
    const write = updateDoc(doc(db, 'orders', order.id), {
      status: ORDER_STATUS.CANCELLED,
      cancelledAt: serverTimestamp(),
      cancelledBy: profile.uid,
      updatedAt: serverTimestamp(),
    });
    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    setBusy(false);
    setPendingCancel(null);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(queuedOffline ? 'Cancelled offline. It will sync when you reconnect.' : 'Order cancelled.');
  };

  // Handing a ticket to the counter, which is the one place an order is
  // edited or charged.
  const openAtCounter = (order) => navigate('/counter', { state: { openOrderId: order.id } });

  if (loading) return <LoadingSpinner label="Loading open orders…" />;

  return (
    // Full width. The tables and strips below run to the edge of the
    // content area, which a centred column would stop short of; the
    // 1800px ceiling lives in AppShell so every page shares one.
    <div className="space-y-6">
      <PageHeader
        title={industry.terms.orders}
        description="Every ticket that is still open, and where it is in the kitchen."
      />

      <MetricRail columns={showTables ? 3 : 2} bleed>
        <Metric label={industry.terms.openOrders} value={summary.count} />
        <Metric label="Value on the floor" prefix="KES" value={amountOnly(summary.total)} />
        {showTables && (
          <Metric label="Tables in use" value={`${summary.tablesOccupied} of ${tables.length}`} />
        )}
      </MetricRail>

      {showTables && tables.length > 0 && (
        <Section title="Tables" hint={`A table is taken exactly while a ${industry.terms.order} is open on it.`}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {tables.map((table) => (
              <button
                key={table.name}
                type="button"
                disabled={!table.occupied}
                onClick={() => openAtCounter(table.order)}
                className={`flex flex-col items-start gap-0.5 rounded-panel border px-2.5 py-2 text-left transition-colors ${
                  table.occupied
                    ? 'border-warning-200 bg-warning-50 hover:border-warning-400'
                    : 'border-line bg-surface'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate text-secondary font-medium text-ink-900">
                  <Utensils className="h-3.5 w-3.5 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
                  {table.name}
                </span>
                <span className="num text-label text-ink-500">
                  {table.occupied ? <Money value={table.total} /> : 'Free'}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section
        title={industry.terms.openOrders}
        action={showKitchen && orders.length > 0 ? (
          <SegmentedControl
            ariaLabel="Filter by kitchen status"
            value={kitchenFilter}
            onChange={setKitchenFilter}
            options={[
              { value: 'all', label: 'All' },
              ...KITCHEN_STATUSES.map((status) => ({
                value: status,
                label: `${KITCHEN_LABELS[status]}${summary.byKitchenStatus[status] ? ` (${summary.byKitchenStatus[status]})` : ''}`,
              })),
            ]}
          />
        ) : undefined}
      >
        {visible.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={orders.length === 0 ? 'Nothing open' : 'Nothing at this stage'}
            description={
              orders.length === 0
                ? `${industry.terms.orders} saved at the counter appear here until they are charged.`
                : 'Try another kitchen stage.'
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visible.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                showKitchen={showKitchen}
                onAdvance={advance}
                onOpen={openAtCounter}
                onCancel={setPendingCancel}
                busy={busy}
                openLabel={`Open ${industry.terms.order} at counter`}
              />
            ))}
          </div>
        )}
      </Section>

      <ConfirmDialog
        open={!!pendingCancel}
        title={`Cancel this ${industry.terms.order}?`}
        message={`"${pendingCancel?.name}" will be closed without being charged. No stock was taken, and the record is kept.`}
        confirmLabel={busy ? 'Cancelling…' : 'Cancel order'}
        confirmDisabled={busy}
        danger
        onConfirm={cancel}
        onCancel={() => setPendingCancel(null)}
      />
    </div>
  );
}
