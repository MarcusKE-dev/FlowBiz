// src/pages/Floor.jsx
//
// THE FLOOR — the waiter's screen.
//
// A waiter's job on a busy service is three questions, asked over and
// over, in this order of urgency:
//
//   WHAT IS ON THE PASS?     Food going cold is the only genuinely
//                            time-critical thing in a restaurant, so it
//                            is at the top and it is unmissable.
//   WHICH TABLES NEED ME?    Seated, ordered, waiting.
//   WHERE CAN I SEAT THESE?  Which tables are free.
//
// The counter answers none of those. It answers "what am I ringing up",
// which is a different job done at a different moment, and a waiter
// holding a tablet in a dining room was being shown a till.
//
// EVERY STATE ON THIS SCREEN IS DERIVED FROM THE OPEN TICKETS. There is
// no table status to set and none to clear — see the header of
// domain/fnb/floor.js for why that is the whole design and not a
// shortcut. Tapping a table is the only action here, and it hands over to
// the counter: an occupied table opens its ticket, a free one starts a
// new one already assigned to it.
//
// IT IS NOT A SECOND TILL. Nothing on this page writes anything. It reads
// the same two listeners the kitchen screen reads (useTickets) and adds
// none of its own, so a restaurant running six waiter tablets pays for
// six subscriptions, not sixty.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, BellRing, Armchair, ShoppingBag, MonitorPlay } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useIndustry } from '../hooks/useIndustry';
import { usePermissions } from '../hooks/usePermissions';
import { useTickets } from '../hooks/useTickets';
import { appPath } from '../lib/appUrl';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import SegmentedControl from '../components/ui/SegmentedControl';
import StatusPill from '../components/ui/StatusPill';
import Money from '../components/ui/Money';
import { diningModeLabel } from '../utils/orders';
import { readRoom, ticketStage } from '../domain/fnb/ticket';
import { readFloor } from '../domain/fnb/floor';
import { FULFILLMENT, FULFILLMENT_LABELS } from '../domain/fnb/lines';
import { waitingMinutes } from '../domain/fnb/display';

/**
 * The tone a stage gets. `ready` is the only one that is loud, because it
 * is the only one that means somebody has to walk somewhere now.
 */
const STAGE_TONE = {
  [FULFILLMENT.NEW]: 'neutral',
  [FULFILLMENT.SENT]: 'caution',
  [FULFILLMENT.READY]: 'positive',
  [FULFILLMENT.SERVED]: 'neutral',
};

function TableCard({ table, onOpen }) {
  const stage = table.stage;
  const waiting = table.tickets.length > 0 ? waitingMinutes(table.tickets[0]) : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(table)}
      className={`flex min-h-[5.5rem] flex-col justify-between rounded-panel border p-3 text-left transition-colors ${
        table.needsRunning
          ? 'border-primary-600 bg-primary-50 hover:border-primary-700'
          : table.occupied
            ? 'border-line bg-surface hover:border-ink-300'
            : 'border-dashed border-line bg-canvas hover:border-ink-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-section-title text-ink-900">{table.name}</span>
        {table.needsRunning && (
          <BellRing className="h-4 w-4 shrink-0 text-primary-700" strokeWidth={2} aria-hidden="true" />
        )}
      </div>

      {table.occupied ? (
        <div className="space-y-1">
          <StatusPill tone={STAGE_TONE[stage] || 'neutral'}>
            {FULFILLMENT_LABELS[stage] || 'Seated'}
          </StatusPill>
          <p className="flex items-baseline justify-between gap-2">
            <Money value={table.total} className="text-secondary font-semibold text-ink-900" />
            {waiting !== null && <span className="num text-label text-ink-500">{waiting}m</span>}
          </p>
          {table.tickets.length > 1 && (
            <p className="text-label text-ink-500">{table.tickets.length} tickets</p>
          )}
        </div>
      ) : (
        <p className="text-secondary text-ink-400">
          Free{table.seats ? ` · seats ${table.seats}` : ''}
        </p>
      )}
    </button>
  );
}

export default function Floor() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const industry = useIndustry();
  const permissions = usePermissions();
  const { tickets, loading, enabled } = useTickets();

  const [zone, setZone] = useState('__all');

  const tablesOn = industry.can('tables');
  const tableNames = useMemo(
    () => (Array.isArray(settings?.tables) ? settings.tables : []),
    [settings]
  );
  const floorPlan = settings?.floorPlan || null;

  const floor = useMemo(
    () => readFloor({ tableNames, plan: floorPlan, room: readRoom(tableNames, tickets) }),
    [tableNames, floorPlan, tickets]
  );

  // EVERYTHING SITTING ON THE PASS, across every table, oldest first.
  // This is the list that decides whether the screen was worth building:
  // a waiter should never have to scan a room to discover that a starter
  // has been ready for six minutes.
  const running = useMemo(() => {
    const open = (tickets || []).filter((t) => t.ready.length > 0);
    return open
      .map((ticket) => ({
        ticket,
        items: ticket.ready.length,
        waiting: waitingMinutes(ticket),
      }))
      .sort((a, b) => (b.waiting ?? 0) - (a.waiting ?? 0));
  }, [tickets]);

  const zones = floor.zones;
  const visibleTables = useMemo(
    () => (zone === '__all' ? floor.tables : floor.tables.filter((t) => t.zone === zone)),
    [floor.tables, zone]
  );

  const openTable = (table) => {
    if (!permissions.can('orders.view')) return;
    // An occupied table opens the ticket it already has; a free one hands
    // its NAME over so the counter starts a cart already seated. A table
    // with two tickets on it opens the first — a split check needs the
    // ticket list, which is the Orders page's job, not this one's.
    if (table.tickets.length > 0) {
      navigate('/counter', { state: { openOrderId: table.tickets[0].id } });
    } else {
      navigate('/counter', { state: { seatTable: table.name } });
    }
  };

  if (!enabled || !tablesOn) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Floor" />
        <EmptyState
          icon={LayoutGrid}
          title="This business does not use tables"
          description="Turn tables on in Customize and name them, and the room appears here."
        />
        <p className="text-center text-secondary text-ink-500">
          The customer display still works without tables. It shows the menu and the order
          queue.{' '}
          <a
            href={appPath('/customer-display')}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary-700 underline underline-offset-2"
          >
            Open it in a new tab
          </a>.
        </p>
      </div>
    );
  }

  if (loading) return <LoadingSpinner label="Reading the room…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Floor"
        description={
          floor.tables.length === 0
            ? 'No tables have been named yet.'
            : `${floor.occupied} seated, ${floor.free} free.`
        }
        /* THE CUSTOMER DISPLAY HAD NO WAY IN. It is a full screen board
           with no navigation on it, by design, so nothing in the app
           linked to it and the only way to reach it was to know the URL.
           A finished screen nobody can find is not a finished screen.

           It opens in a NEW TAB rather than navigating, because it is a
           SECOND SCREEN: the person opening it is at the counter and
           wants it on the television, and replacing the page they are
           working on would be the wrong thing in both places. */
        actions={
          <a
            href={appPath('/customer-display')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <MonitorPlay className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Open customer display
          </a>
        }
      />

      {/* ── The pass ─────────────────────────────────────────────────
          Above the room, always, and shown even when it is empty for the
          first service — a waiter learns where to look once. */}
      {running.length > 0 && (
        <section className="space-y-2 rounded-panel border border-primary-600 bg-primary-50 p-3">
          <p className="flex items-center gap-1.5 text-section-title text-primary-800">
            <BellRing className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            On the pass: {running.length} {running.length === 1 ? 'table' : 'tables'} waiting
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {running.map(({ ticket, items, waiting }) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => navigate('/counter', { state: { openOrderId: ticket.id } })}
                  className="flex w-full items-center justify-between gap-2 rounded-control border border-primary-200 bg-surface px-3 py-2 text-left hover:border-primary-600"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body font-semibold text-ink-900">
                      {ticket.name || ticket.tableName || 'Order'}
                    </span>
                    <span className="block text-secondary text-ink-600">
                      {items} {items === 1 ? 'item' : 'items'} ready
                      {ticket.diningMode ? ` · ${diningModeLabel(ticket.diningMode)}` : ''}
                    </span>
                  </span>
                  {waiting !== null && (
                    <span className="num shrink-0 text-secondary font-semibold text-primary-800">{waiting}m</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Zones ───────────────────────────────────────────────────── */}
      {zones.length > 0 && (
        <SegmentedControl
          ariaLabel="Part of the room"
          value={zone}
          onChange={setZone}
          options={[
            { value: '__all', label: 'Everywhere' },
            ...zones.map((z) => ({ value: z, label: z })),
          ]}
        />
      )}

      {/* ── The room ────────────────────────────────────────────────── */}
      {visibleTables.length === 0 ? (
        <EmptyState
          icon={Armchair}
          title="No tables here"
          description="Name your tables in Customize and arrange them on the floor plan."
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {visibleTables.map((table) => (
            <TableCard key={table.name} table={table} onOpen={openTable} />
          ))}
        </div>
      )}

      {/* ── Everything with no table ───────────────────────────────────
          Takeaway, delivery and counter orders are real work and belong
          to somebody. A floor screen that showed only tables would hide
          them, and they would be found when the customer asked. */}
      {floor.untabled.length > 0 && (
        <section className="space-y-2">
          <p className="flex items-center gap-1.5 text-section-title text-ink-900">
            <ShoppingBag className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Not at a table
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {floor.untabled.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => navigate('/counter', { state: { openOrderId: ticket.id } })}
                  className="flex w-full items-center justify-between gap-2 rounded-panel border border-line bg-surface px-3 py-2 text-left hover:border-ink-300"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body font-medium text-ink-900">
                      {ticket.name || 'Order'}
                    </span>
                    <span className="block text-secondary text-ink-500">
                      {diningModeLabel(ticket.diningMode)}
                    </span>
                  </span>
                  <StatusPill tone={STAGE_TONE[ticketStage(ticket)] || 'neutral'}>
                    {FULFILLMENT_LABELS[ticketStage(ticket)]}
                  </StatusPill>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
