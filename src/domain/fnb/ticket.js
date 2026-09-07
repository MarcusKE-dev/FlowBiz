// src/domain/fnb/ticket.js
//
// THE TICKET — the aggregate a table, a tab or a queue number actually
// is, and the one place that knows how to read one whichever way it was
// stored.
//
// FlowBiz has written open orders as a single document with an `items`
// array since the food profiles shipped. Those documents exist, in real
// businesses, right now. This domain moves the truth to one document per
// line (see lines.js and the reasoning there), and the ONE rule that
// makes that safe is here:
//
//   A TICKET IS READ THROUGH readTicket(), AND readTicket() ACCEPTS BOTH.
//
// A ticket written the old way presents exactly the same object as a
// ticket written the new way — same lines, same totals, same everything
// downstream — with its array lines marked as belonging to the legacy
// shape so nothing tries to update them individually. Nothing migrates,
// nothing is rewritten, no history is touched. A legacy ticket is charged
// and closed by the same code path it always was, and every ticket opened
// from here on is a lines ticket. See MIGRATION at the bottom.
//
// The ticket is also where the RESTAURANT-SHAPED reads live: what is
// waiting to be fired, what the kitchen is holding, what is on the pass,
// what each course is doing, and whether a table is genuinely free. All
// of it derived — nothing about the state of a room is stored, so nothing
// about the state of a room can be stale.

import { roundMoney } from '../../utils/currency.js';
import {
  FULFILLMENT, FULFILLMENT_ORDER, fulfillmentOf, isLive, isVoided,
  sortLines, recomputeHeader,
} from './lines.js';

export const TICKET_STATUS = Object.freeze({
  OPEN: 'open',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

/**
 * How this ticket stores its lines.
 *
 *   'lines'  one document per line in `orderLines`. Everything opened
 *            after this domain shipped.
 *   'array'  the legacy `items` array on the order document itself.
 *
 * Marked explicitly on the ticket when it is written, and INFERRED when
 * it is absent, so a document from before the field existed is read
 * correctly rather than being guessed at from whether lines happened to
 * load yet.
 */
export const LINE_MODEL = Object.freeze({ LINES: 'lines', ARRAY: 'array' });

export function lineModelOf(order) {
  return order?.lineModel === LINE_MODEL.LINES ? LINE_MODEL.LINES : LINE_MODEL.ARRAY;
}

/**
 * Present a legacy `items` entry as a ticket line.
 *
 * `readOnlyLine: true` is the important field. A legacy line has no
 * document of its own, so it cannot be voided, fired, moved to another
 * ticket or advanced through the kitchen individually — every screen
 * checks this flag and offers the whole-ticket action instead. The
 * alternative, silently rewriting a live business's open tickets into a
 * new collection on first read, is a migration performed by whichever
 * device happened to open the screen, and it is not one this project is
 * going to do behind an owner's back.
 */
function legacyLine(item, index, order) {
  return {
    ...item,
    id: `${order?.id || 'order'}#${index}`,
    orderId: order?.id || null,
    seq: index,
    // The legacy document carried ONE kitchen status for the whole
    // ticket. Reading it onto every line is the honest translation: it is
    // what the kitchen was actually told.
    fulfillment: legacyFulfillment(order?.kitchenStatus),
    voided: false,
    readOnlyLine: true,
  };
}

/**
 * The old order-level `kitchenStatus` had four values — new, preparing,
 * ready, served — and they map one-for-one onto the line states, because
 * the line states were chosen to be the same four words a kitchen
 * already used. 'preparing' is what this domain calls 'sent'.
 */
function legacyFulfillment(kitchenStatus) {
  if (kitchenStatus === 'preparing') return FULFILLMENT.SENT;
  if (FULFILLMENT_ORDER.includes(kitchenStatus)) return kitchenStatus;
  return FULFILLMENT.NEW;
}

/**
 * THE ONE READ. Give it the order document and (for a lines ticket) the
 * lines that belong to it; get back a ticket every screen can work with
 * without knowing or caring how it was stored.
 *
 * Totals are computed from the LINES, never read from the header, because
 * the header figure is a cache maintained by commutative increments and
 * the check screen must be exact. `cachedTotal` is carried alongside so a
 * list view that has not loaded lines still has something to show, and so
 * a drifted cache can be detected rather than believed.
 */
export function readTicket(order, allLines = null) {
  if (!order) return null;
  const model = lineModelOf(order);

  const lines = model === LINE_MODEL.LINES
    ? sortLines((allLines || []).filter((line) => line?.orderId === order.id))
    : (Array.isArray(order.items) ? order.items : []).map((item, i) => legacyLine(item, i, order));

  const live = lines.filter(isLive);
  const totals = recomputeHeader(lines);

  return {
    id: order.id,
    order,
    lineModel: model,
    status: order.status || TICKET_STATUS.OPEN,
    name: order.name || null,
    tableName: order.tableName || null,
    diningMode: order.diningMode || null,
    note: order.note || '',
    openedAt: order.openedAt || null,
    openedByName: order.openedByName || null,

    lines,
    liveLines: live,
    voidedLines: lines.filter(isVoided),

    ...totals,
    cachedTotal: Number(order.totalAmount) || 0,
    // True when the header cache and the lines disagree by more than a
    // cent. Surfaced rather than silently corrected: a screen that has
    // the lines can heal it, and one that has not should not pretend.
    cacheStale: model === LINE_MODEL.LINES
      && Math.abs((Number(order.totalAmount) || 0) - totals.totalAmount) > 0.005,

    // What the room needs to know, all derived.
    unfired: live.filter((l) => fulfillmentOf(l) === FULFILLMENT.NEW),
    preparing: live.filter((l) => fulfillmentOf(l) === FULFILLMENT.SENT),
    ready: live.filter((l) => fulfillmentOf(l) === FULFILLMENT.READY),
    served: live.filter((l) => fulfillmentOf(l) === FULFILLMENT.SERVED),
  };
}

/**
 * The one word a ticket gets in a list, derived from its lines rather
 * than stored.
 *
 * The precedence is what a floor manager actually looks for, in the order
 * they look for it: something waiting to be collected beats something
 * still cooking, and anything at all beats a ticket nobody has fired.
 */
export function ticketStage(ticket) {
  if (!ticket || ticket.liveLines.length === 0) return FULFILLMENT.NEW;
  if (ticket.ready.length > 0) return FULFILLMENT.READY;
  if (ticket.preparing.length > 0) return FULFILLMENT.SENT;
  if (ticket.unfired.length > 0) return FULFILLMENT.NEW;
  return FULFILLMENT.SERVED;
}

/** Is there anything on this ticket the kitchen has not been told about? */
export function hasUnfired(ticket) {
  return (ticket?.unfired?.length || 0) > 0;
}

/**
 * COURSES — the order dishes reach the table in.
 *
 * Modelled as a LABEL ON A LINE plus a fire-by-course action, and nothing
 * else. A course is not an entity: it has no lifecycle of its own, owns
 * no money, and the only question anyone asks of it is "has this course
 * gone yet". Making it a document would be a collection to create,
 * secure, list, garbage-collect and keep in step with a line's own state,
 * in exchange for nothing.
 *
 * Lines with no course fall into a final unnamed group, so a restaurant
 * that never configures courses sees one group and never learns the
 * feature exists.
 */
export function groupByCourse(ticket, courses = []) {
  const known = (courses || []).filter((c) => c && c.id);
  const groups = known.map((course) => ({
    id: course.id,
    name: course.name,
    lines: (ticket?.liveLines || []).filter((l) => l.courseId === course.id),
  }));
  const uncoursed = (ticket?.liveLines || []).filter(
    (l) => !l.courseId || !known.some((c) => c.id === l.courseId)
  );
  if (uncoursed.length > 0) {
    groups.push({ id: null, name: known.length > 0 ? 'No course' : null, lines: uncoursed });
  }
  return groups.filter((group) => group.lines.length > 0);
}

/**
 * THE STATE OF THE ROOM. One pass over the open tickets produces every
 * table's occupancy, its value and what the kitchen is doing with it.
 *
 * Nothing about a table is stored — not a status field, not an occupancy
 * flag, not a "needs cleaning" state. A table is taken precisely while an
 * open ticket carries its name. That is derived, so it cannot drift, and
 * clearing a table is charging or cancelling its ticket rather than
 * remembering to press something afterwards. A stored table state is a
 * second source of truth about the same fact, and the failure mode is a
 * restaurant that cannot seat anybody because six tables are stuck
 * "occupied" from last Friday.
 *
 * A table with MORE THAN ONE open ticket is a real situation (two parties
 * sharing a long table, or a split check not yet charged) rather than an
 * error, so the shape carries a list.
 */
export function readRoom(tableNames, tickets) {
  const open = (tickets || []).filter((t) => t && t.status === TICKET_STATUS.OPEN);
  const byTable = new Map();
  for (const ticket of open) {
    if (!ticket.tableName) continue;
    const list = byTable.get(ticket.tableName) || [];
    list.push(ticket);
    byTable.set(ticket.tableName, list);
  }

  const tables = (tableNames || []).map((name) => {
    const seated = byTable.get(name) || [];
    return {
      name,
      tickets: seated,
      occupied: seated.length > 0,
      total: roundMoney(seated.reduce((sum, t) => sum + t.totalAmount, 0)),
      stage: seated.length > 0 ? ticketStage(seated[0]) : null,
      // A table where something is sitting on the pass is the one a
      // manager wants highlighted, whichever of its tickets it is on.
      needsRunning: seated.some((t) => t.ready.length > 0),
    };
  });

  return {
    tables,
    occupied: tables.filter((t) => t.occupied).length,
    // Tickets with no table: takeaway, delivery, a counter queue number,
    // or a bar tab in a house that does not use table names.
    untabled: open.filter((t) => !t.tableName),
  };
}

/** Totals across the open tickets, for the counter bar and the dashboard. */
export function summarizeTickets(tickets) {
  const open = (tickets || []).filter((t) => t && t.status === TICKET_STATUS.OPEN);
  const stages = Object.fromEntries(FULFILLMENT_ORDER.map((s) => [s, 0]));
  let unfiredLines = 0;
  let readyLines = 0;
  for (const ticket of open) {
    stages[ticketStage(ticket)] += 1;
    unfiredLines += ticket.unfired.length;
    readyLines += ticket.ready.length;
  }
  return {
    count: open.length,
    total: roundMoney(open.reduce((sum, t) => sum + t.totalAmount, 0)),
    byStage: stages,
    unfiredLines,
    readyLines,
    tablesOccupied: new Set(open.map((t) => t.tableName).filter(Boolean)).size,
  };
}

/**
 * MOVING LINES — the one primitive behind splitting a check, merging two
 * tickets, transferring a table and correcting an item rung on the wrong
 * ticket.
 *
 * It returns a PLAN rather than performing anything: which line documents
 * change `orderId`, and what each of the two header caches must be
 * adjusted by. The caller turns that into one write batch, so a move is
 * atomic and cannot leave a line belonging to nothing.
 *
 * Refusals are returned, not thrown, because every one of them is a
 * button that should have been disabled:
 *
 *   a legacy ticket has no line documents to move;
 *   a voided line is not moved, it is already gone;
 *   moving a line to the ticket it is already on is a no-op, not an error.
 */
export function planLineMove(lines, { toOrderId, fromOrderId } = {}) {
  const moving = (lines || []).filter(
    (line) => line && !line.readOnlyLine && isLive(line) && line.orderId !== toOrderId
  );
  if (!toOrderId || moving.length === 0) {
    return { moves: [], fromDelta: null, toDelta: null, moved: 0 };
  }
  const total = roundMoney(moving.reduce((sum, l) => sum + (Number(l.lineTotal) || 0), 0));
  const cost = roundMoney(moving.reduce((sum, l) => sum + (Number(l.lineCost) || 0), 0));
  return {
    moves: moving.map((line) => ({ id: line.id, orderId: toOrderId })),
    fromDelta: fromOrderId
      ? { id: fromOrderId, totalAmount: roundMoney(-total), costOfGoodsSold: roundMoney(-cost) }
      : null,
    toDelta: { id: toOrderId, totalAmount: total, costOfGoodsSold: cost },
    moved: moving.length,
  };
}

/**
 * What a ticket may still be charged for: its live lines, projected into
 * sale line items.
 *
 * VOIDED LINES ARE NOT HERE, and that is the entire point of voiding
 * rather than deleting. The line stays on the ticket as a record that
 * something was rung and taken off — who did it, when, and why — and the
 * money and the stock behave as though it never happened. A restaurant
 * that cannot answer "how many steaks were voided last night, and by
 * whom" has no way to tell a mistake from a theft.
 */
export function chargeableLines(ticket) {
  return (ticket?.liveLines || []);
}

/**
 * Is this ticket safe to charge? Returns a reason, or null.
 *
 * Firing is deliberately NOT required. A bar tab is rung and charged
 * without a kitchen ever being involved, and a café hands over a cake
 * from the counter. What is refused is charging nothing at all.
 */
export function chargeProblem(ticket) {
  if (!ticket) return 'That ticket is no longer open.';
  if (ticket.status !== TICKET_STATUS.OPEN) return 'That ticket has already been closed.';
  if (chargeableLines(ticket).length === 0) return 'There is nothing left on this ticket to charge.';
  return null;
}
