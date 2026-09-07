// src/pages/Kitchen.jsx
//
// THE KITCHEN DISPLAY — what has been fired, what it is for, and how long
// it has been waiting.
//
// This screen is ITEM-LEVEL, and that is the whole difference between it
// and the "kitchen status" it replaces. FlowBiz used to keep one status
// on the whole order, so a kitchen had to describe a table with a single
// word while the drinks were poured, the steak was on the grill and the
// dessert had not been started. Every serious platform routes and tracks
// per item for exactly that reason, and so does this.
//
// WHAT IT IS NOT. It is not a second place to take an order, change a
// price, or charge anything. A cook can do precisely two things here —
// start something and finish it — and the security rule behind the screen
// (`kitchen.update`) permits precisely those two fields and nothing else,
// so a tablet bolted to a wall in a kitchen is not a till.
//
// SORTED BY HOW LONG IT HAS WAITED, oldest first, always. Not by table,
// not by ticket, not by the order it was rung. A kitchen works the oldest
// thing on the rail, and a screen that sorts any other way is a screen
// that has to be re-read every time it changes.

import { useMemo, useState } from 'react';
import { writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ChefHat, Clock, Flame, CheckCheck } from 'lucide-react';
import { db } from '../firebase';
import { useSettings } from '../contexts/SettingsContext';
import { useIndustry } from '../hooks/useIndustry';
import { usePermissions } from '../hooks/usePermissions';
import { useTickets } from '../hooks/useTickets';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import SegmentedControl from '../components/ui/SegmentedControl';
import { formatQuantityWithUnit } from '../industry/units';
import { describeModifiers } from '../utils/modifiers';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';
import { FULFILLMENT, fulfillmentOf, isLive } from '../domain/fnb/lines';
import { advanceTicketLine } from '../domain/fnb/ticketWrites';
import { stationOptions, stationName, linesForStation, DEFAULT_STATION } from '../domain/fnb/stations';
import { diningModeLabel } from '../utils/orders';

/** Minutes since a timestamp, whatever shape Firestore handed it back in. */
function minutesSince(value) {
  if (!value) return null;
  const ms = value?.toMillis?.() ?? (value instanceof Date ? value.getTime() : Date.parse(value));
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 60000));
}

/**
 * The one thing a kitchen screen has to communicate at a glance, and the
 * only place colour is used here: how late this is.
 *
 * The thresholds are deliberately generic — ten and twenty minutes — and
 * deliberately not configurable. A per-station target time is a real
 * feature in a large operation; in a business this size it is one more
 * setting nobody fills in, and a wrong target is worse than an honest
 * count of minutes.
 */
function ageTone(minutes) {
  if (minutes === null) return 'text-ink-400';
  if (minutes >= 20) return 'text-danger-700 font-semibold';
  if (minutes >= 10) return 'text-warning-700 font-semibold';
  return 'text-ink-500';
}

function TicketCard({ ticket, lines, onAdvance, busy, showStation, stations }) {
  const waiting = minutesSince(lines[0]?.firedAt);
  return (
    <div className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-section-title text-ink-900">{ticket?.name || 'Order'}</p>
          {/* The label, not the stored id: the pass read "DINE-IN" where
              every other screen says "Dine in". */}
          {ticket?.diningMode && (
            <p className="text-label uppercase text-ink-400">{diningModeLabel(ticket.diningMode)}</p>
          )}
        </div>
        <span className={`num flex shrink-0 items-center gap-1 text-secondary ${ageTone(waiting)}`}>
          <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {waiting === null ? '—' : `${waiting}m`}
        </span>
      </div>

      <ul className="space-y-1.5 border-t border-divider pt-2">
        {lines.map((line) => {
          const stage = fulfillmentOf(line);
          const target = stage === FULFILLMENT.SENT ? FULFILLMENT.READY : FULFILLMENT.SERVED;
          return (
            <li key={line.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-body text-ink-900">
                  <span className="num font-semibold">
                    {formatQuantityWithUnit(line.quantity, line.unit)}
                  </span>
                  {/* The kitchen's word for it when there is one. */}
                  {' × '}{line.kitchenName || line.productName}
                </p>
                {(line.modifiers?.length > 0 || line.note || line.variantLabel) && (
                  <p className="text-secondary text-ink-600">
                    {[line.variantLabel, describeModifiers(line.modifiers), line.note]
                      .filter(Boolean).join(' · ')}
                  </p>
                )}
                {showStation && (
                  <p className="text-label uppercase text-ink-400">
                    {stationName(line.station || DEFAULT_STATION.id, stations)}
                  </p>
                )}
              </div>
              <button
                type="button"
                className={stage === FULFILLMENT.SENT ? 'btn-primary shrink-0' : 'btn-secondary shrink-0'}
                onClick={() => onAdvance(line, target)}
                disabled={busy}
              >
                {stage === FULFILLMENT.SENT ? 'Ready' : 'Served'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Kitchen() {
  const { settings } = useSettings();
  const industry = useIndustry();
  const permissions = usePermissions();
  const { tickets, lines, loading, enabled } = useTickets();

  const [station, setStation] = useState(null);   // null = the expeditor's pass
  const [busy, setBusy] = useState(false);

  const stationsOn = industry.can('kitchenStations');
  const stations = useMemo(
    () => (stationsOn ? stationOptions(settings.stations) : []),
    [stationsOn, settings.stations]
  );

  const ticketById = useMemo(() => new Map(tickets.map((t) => [t.id, t])), [tickets]);

  // Everything fired and not yet served, oldest first. A ticket whose
  // lines are all still unfired is not the kitchen's problem yet; a ticket
  // that has been charged has left the live query entirely.
  const working = useMemo(() => {
    const fired = lines.filter((line) => {
      if (!isLive(line)) return false;
      const stage = fulfillmentOf(line);
      return stage === FULFILLMENT.SENT || stage === FULFILLMENT.READY;
    });
    return linesForStation(fired, station);
  }, [lines, station]);

  // Grouped back onto their tickets, because a cook plates a table rather
  // than an item — but ordered by the OLDEST thing each ticket is still
  // waiting on, so the rail runs oldest-first however the tickets fall.
  const grouped = useMemo(() => {
    const byTicket = new Map();
    for (const line of working) {
      const list = byTicket.get(line.orderId) || [];
      list.push(line);
      byTicket.set(line.orderId, list);
    }
    return [...byTicket.entries()]
      .map(([orderId, group]) => ({
        orderId,
        ticket: ticketById.get(orderId),
        lines: group,
        firedAt: group.reduce((oldest, l) => {
          const ms = l.firedAt?.toMillis?.() ?? (l.firedAt instanceof Date ? l.firedAt.getTime() : Infinity);
          return Math.min(oldest, ms);
        }, Infinity),
      }))
      .sort((a, b) => a.firedAt - b.firedAt);
  }, [working, ticketById]);

  const readyCount = working.filter((l) => fulfillmentOf(l) === FULFILLMENT.READY).length;
  const preparingCount = working.length - readyCount;

  const advance = async (line, target) => {
    if (busy) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      // Forward-only, and idempotent: two cooks tapping "Ready" at the
      // same moment agree, and a double tap does nothing.
      if (!advanceTicketLine(batch, line, target)) return;
      const { error } = await raceWithTimeout(batch.commit(), 4000);
      if (error) throw error;
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Kitchen" />
        <EmptyState icon={ChefHat} title="This business does not keep open orders" />
      </div>
    );
  }
  if (loading) return <LoadingSpinner label="Loading the kitchen…" />;

  const readOnly = !permissions.can('kitchen.update');

  return (
    // Full width: the ticket grid below simply fits more tickets per row
    // the wider it gets. The 1800px ceiling lives in AppShell.
    <div className="space-y-5">
      <PageHeader
        title="Kitchen"
        description={
          working.length === 0
            ? 'Nothing is cooking.'
            : `${preparingCount} preparing, ${readyCount} on the pass.`
        }
      />

      {stationsOn && stations.length > 1 && (
        <SegmentedControl
          ariaLabel="Kitchen section"
          value={station === null ? '__all' : station}
          onChange={(value) => setStation(value === '__all' ? null : value)}
          options={[
            // The expeditor's view: every section, which is the pass.
            { value: '__all', label: 'All' },
            ...stations.map((s) => ({
              value: s.id,
              label: `${s.name}${
                linesForStation(working, s.id).length > 0
                  ? ` (${linesForStation(working, s.id).length})` : ''
              }`,
            })),
          ]}
        />
      )}

      {readOnly && (
        <p className="rounded-panel border border-line bg-ink-50 px-3 py-2 text-secondary text-ink-600">
          You can see what the kitchen is working on. Marking items ready is not one of your permissions.
        </p>
      )}

      {grouped.length === 0 ? (
        <EmptyState
          icon={Flame}
          title="Nothing fired"
          description="Items appear here the moment they are sent from the counter."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {grouped.map((group) => (
            <TicketCard
              key={group.orderId}
              ticket={group.ticket}
              lines={group.lines}
              onAdvance={advance}
              busy={busy || readOnly}
              showStation={stationsOn && station === null}
              stations={settings.stations}
            />
          ))}
        </div>
      )}

      {readyCount > 0 && (
        <p className="flex items-center gap-1.5 text-secondary text-ink-500">
          <CheckCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {readyCount} {readyCount === 1 ? 'item is' : 'items are'} on the pass waiting to be run.
        </p>
      )}
    </div>
  );
}
