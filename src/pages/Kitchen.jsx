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

import { useEffect, useMemo, useState } from 'react';
import { writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ChefHat, Clock, Flame, CheckCheck, Check, Loader2 } from 'lucide-react';
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
import { advanceTicketLine, advanceLegacyTicket } from '../domain/fnb/ticketWrites';
import { stationOptions, stationName, linesForStation, DEFAULT_STATION } from '../domain/fnb/stations';
import { diningModeLabel } from '../utils/orders';
import { toMillis } from '../domain/fnb/display';

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

/**
 * How long the kitchen has had this ticket.
 *
 * A line written by the new engine records the moment it was FIRED,
 * which is the honest answer. A legacy ticket has no such stamp — it
 * stores its lines as an array and nothing on them is a timestamp — so
 * it falls back to when the ticket was OPENED. That is an over-estimate
 * of the kitchen's time and a better one than the alternative, which was
 * `null`: a rail sorted oldest-first was putting every legacy ticket at
 * the very end regardless of age, because a missing timestamp compared
 * as Infinity. The oldest thing in the room was sorting last.
 */
function firedMillis(lines, ticket) {
  let oldest = Infinity;
  for (const line of lines) {
    const ms = toMillis(line?.firedAt);
    if (ms !== null) oldest = Math.min(oldest, ms);
  }
  if (oldest !== Infinity) return oldest;
  return toMillis(ticket?.openedAt) ?? Infinity;
}

/**
 * THE ONE CONTROL A COOK TOUCHES, and it has to answer three questions
 * without anybody reading a word: did my tap register, is it still
 * working, and did it actually happen.
 *
 * The old button answered none of them. It rendered "Ready", took a tap,
 * and then sat there looking identical for however long the write took,
 * so the natural thing to do was tap it again, and again. The screen
 * disabled EVERY button on the rail while any one write was in flight,
 * which made a busy kitchen feel broken.
 *
 * Three states now, and the middle one is the point:
 *
 *   IDLE     "Ready" / "Served", tappable.
 *   PENDING  A spinner in the button itself, and only this button is
 *            disabled. The rest of the rail keeps working, because a
 *            second cook bumping a different line is not a conflict.
 *   DONE     A tick and the past tense, held for a moment so the person
 *            who tapped sees the result of their own tap even when the
 *            snapshot has already moved the line somewhere else.
 *
 * The DONE state matters more than it looks. Marking the last item on a
 * ticket ready removes that whole ticket card from the rail, so without
 * it the only feedback for a successful tap is the thing you tapped
 * vanishing, which reads exactly like a crash.
 */
function BumpButton({ stage, pending, justDone, disabled, onClick }) {
  if (justDone) {
    return (
      <span className="btn-secondary pointer-events-none shrink-0 gap-1.5 border-primary-200 bg-primary-50 text-primary-800">
        <Check className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        {stage === FULFILLMENT.SENT ? 'Ready' : 'Served'}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`shrink-0 gap-1.5 ${stage === FULFILLMENT.SENT ? 'btn-primary' : 'btn-secondary'}`}
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending && (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} aria-hidden="true" />
      )}
      {pending
        ? 'Saving'
        : stage === FULFILLMENT.SENT ? 'Ready' : 'Served'}
    </button>
  );
}

function TicketCard({ ticket, lines, onAdvance, pendingId, doneId, readOnly, showStation, stations, now }) {
  const since = firedMillis(lines, ticket);
  const waiting = since === Infinity ? null : Math.max(0, Math.floor((now - since) / 60000));
  // A ticket stored the old way carries ONE status for everything on it,
  // so a cook needs to know that the button in front of them is not a
  // per-item control before they use it.
  const wholeTicketOnly = lines.some((line) => line?.readOnlyLine);
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
        {waiting !== null && (
          <span className={`num flex shrink-0 items-center gap-1 text-secondary ${ageTone(waiting)}`}>
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            {waiting}m
          </span>
        )}
      </div>

      {wholeTicketOnly && lines.length > 1 && (
        <p className="text-label text-ink-400">
          This ticket moves as one. Marking any item ready marks the whole order.
        </p>
      )}

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
              <BumpButton
                stage={stage}
                pending={pendingId === line.id}
                justDone={doneId === line.id}
                disabled={readOnly}
                onClick={() => onAdvance(line, target, ticket)}
              />
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
  const { tickets, loading, enabled } = useTickets();

  const [station, setStation] = useState(null);   // null = the expeditor's pass
  // The line currently being written, and the line whose tick is still
  // showing. Both are ids rather than booleans so one cook bumping an
  // item never disables the button in front of another.
  const [pendingId, setPendingId] = useState(null);
  const [doneId, setDoneId] = useState(null);
  // THE CLOCK, and it is not decoration. This screen exists to say how
  // long something has been waiting, and until this state existed the
  // ages were read from `Date.now()` during render — so they changed only
  // when something else caused a re-render and a quiet kitchen showed a
  // frozen "4m" indefinitely. Every thirty seconds, which is twice the
  // resolution of the number displayed.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const stationsOn = industry.can('kitchenStations');
  const stations = useMemo(
    () => (stationsOn ? stationOptions(settings.stations) : []),
    [stationsOn, settings.stations]
  );

  const ticketById = useMemo(() => new Map(tickets.map((t) => [t.id, t])), [tickets]);

  // Everything fired and not yet served, oldest first. A ticket whose
  // lines are all still unfired is not the kitchen's problem yet; a ticket
  // that has been charged has left the live query entirely.
  //
  // READ FROM THE TICKETS, NOT FROM THE RAW `orderLines` QUERY. This is
  // the difference between a kitchen screen that works and one that is
  // permanently empty. `readTicket()` presents a ticket's lines whichever
  // way it stores them — one document each for a ticket written by the
  // new engine, and the order document's own `items` array for one
  // written by the counter, which is currently all of them. Filtering the
  // raw collection instead meant the screen only ever saw tickets that
  // nothing in the application writes yet.
  const working = useMemo(() => {
    const fired = tickets.flatMap((ticket) => ticket.lines).filter((line) => {
      if (!isLive(line)) return false;
      const stage = fulfillmentOf(line);
      return stage === FULFILLMENT.SENT || stage === FULFILLMENT.READY;
    });
    return linesForStation(fired, station);
  }, [tickets, station]);

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
        firedAt: firedMillis(group, ticketById.get(orderId)),
      }))
      .sort((a, b) => a.firedAt - b.firedAt);
  }, [working, ticketById]);

  const readyCount = working.filter((l) => fulfillmentOf(l) === FULFILLMENT.READY).length;
  const preparingCount = working.length - readyCount;

  /**
   * Move one line forward.
   *
   * PER LINE, NOT PER SCREEN. The old version held a single `busy` flag
   * for the whole page, so bumping one item disabled every button on the
   * rail until the write came back. In a kitchen with three cooks that is
   * indistinguishable from the screen freezing.
   *
   * The guard is now the line's own id, which also makes a double tap on
   * the SAME button a no-op while still letting a different cook bump a
   * different line in the same second.
   */
  const advance = async (line, target, ticket = null) => {
    if (!line?.id || pendingId === line.id) return;
    setPendingId(line.id);
    try {
      const batch = writeBatch(db);
      // Forward-only, and idempotent: two cooks tapping "Ready" at the
      // same moment agree, and a double tap does nothing.
      //
      // A LEGACY TICKET HAS NO LINE DOCUMENT, so there is nothing to
      // advance and `advanceTicketLine` refuses. Until the counter writes
      // one document per line, that is every ticket in the business — so
      // the fallback moves the whole ticket, which is the only
      // granularity the stored order actually has. Without it a cook taps
      // "Ready" and nothing happens at all.
      const wrote = line?.readOnlyLine
        ? advanceLegacyTicket(batch, ticket, target)
        : advanceTicketLine(batch, line, target);
      if (!wrote) return;
      const { error, queuedOffline } = await raceWithTimeout(batch.commit(), 4000);
      if (error) throw error;

      // SAY WHAT HAPPENED, by name. A kitchen screen can hold a dozen
      // identical-looking rows, so "Ready" on its own does not tell the
      // person who tapped which of them moved.
      const what = line.kitchenName || line.productName || 'Item';
      const verb = target === FULFILLMENT.READY ? 'ready' : 'served';
      toast.success(
        queuedOffline
          ? `${what} marked ${verb}. It will sync when you reconnect.`
          : `${what} marked ${verb}.`,
        { duration: 1800 }
      );

      // Hold the tick on the button briefly. Bumping the last item on a
      // ticket removes the whole card, so without this the only feedback
      // for a successful tap is the thing you tapped disappearing.
      setDoneId(line.id);
      window.setTimeout(() => {
        setDoneId((current) => (current === line.id ? null : current));
      }, 1400);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPendingId((current) => (current === line.id ? null : current));
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
              now={now}
              pendingId={pendingId}
              doneId={doneId}
              readOnly={readOnly}
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
