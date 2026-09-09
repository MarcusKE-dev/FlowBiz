// src/domain/fnb/ticketWrites.js
//
// THE FIRESTORE ADAPTER FOR THE TICKET DOMAIN, and nothing else.
//
// The same split utils/stockWrites.js makes, for the same reason: every
// module in src/domain/fnb is pure and testable without a database, and
// this one file is the only place any of it becomes a write. So there is
// exactly one answer to "how does a ticket change", and it is auditable
// in ninety lines instead of being spread across a page component.
//
// TWO RULES EVERY FUNCTION HERE KEEPS.
//
//   THE CALLER OWNS THE BATCH. Every function takes a `writeBatch` the
//   caller made and adds to it. A line and the header adjustment it
//   implies therefore land in ONE atomic commit — they can never diverge,
//   and offline the whole thing queues as a single mutation that applies
//   or does not.
//
//   ONE WRITE PER DOCUMENT PER BATCH. Never two. utils/stockWrites.js
//   holds the same rule for the same reason: a batch containing two
//   operations on one document makes the order they apply in matter, and
//   an increment followed by an assignment — or a create followed by an
//   update — is then a coin toss. Every function here that could produce
//   a second write on a document another one already touched takes an
//   option to fold its change into that one instead. `skipHeader`,
//   `closed` and `closeTicket`'s `totals` all exist for this and nothing
//   else.
//
//   THE HEADER TOTAL MOVES BY INCREMENT, NEVER BY ASSIGNMENT. This is the
//   whole multi-device story in one line of code. `increment(+450)` from
//   one tablet and `increment(+300)` from another both land, in either
//   order, online or offline. `set(totalAmount: 450)` from one and
//   `set(totalAmount: 300)` from the other means one of them is wrong and
//   nobody finds out. The header figure is a CACHE for list views; the
//   check screen totals the lines themselves.

import { doc, collection, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { withBusiness } from '../../lib/tenant';
import { roundMoney } from '../../utils/currency';
import {
  buildTicketLine, headerDelta, FULFILLMENT, isLive, isVoided, fulfillmentOf,
  isRoutedToKitchen,
} from './lines.js';
import { TICKET_STATUS } from './ticket.js';

const LINES = 'orderLines';
const ORDERS = 'orders';

/**
 * Adjust a ticket header's cached figures. Skipped entirely when there is
 * nothing to move, so a change that does not touch money — firing a line,
 * for instance — writes nothing to the header at all.
 */
function bumpHeader(batch, orderId, delta) {
  if (!orderId) return;
  const moved = (Number(delta?.totalAmount) || 0) !== 0
    || (Number(delta?.costOfGoodsSold) || 0) !== 0;
  const update = { updatedAt: serverTimestamp() };
  if (moved) {
    update.totalAmount = increment(Number(delta.totalAmount) || 0);
    update.costOfGoodsSold = increment(Number(delta.costOfGoodsSold) || 0);
    update.profit = increment(
      (Number(delta.totalAmount) || 0) - (Number(delta.costOfGoodsSold) || 0)
    );
  }
  batch.update(doc(db, ORDERS, orderId), update);
}

/**
 * Add cart rows to a ticket as new line documents.
 *
 * Returns the built lines with their ids, so the caller can show them
 * immediately rather than waiting for the snapshot to come back — which
 * matters on a phone on a bad connection, and matters absolutely offline,
 * where the snapshot will not come back at all until later.
 */
export function addTicketLines(batch, rows, {
  orderId, businessId, courseId = null, stationFor = null, routedFor = null,
  addedBy = null, addedByName = null, at = new Date(),
  // Adding lines to a ticket that is being CHARGED in this same batch.
  // They are created already served and already out of play, because
  // closeTicket() must not then update documents this call just created —
  // one write per document per batch.
  closed = false,
  // The caller is writing the header itself (healing a drifted cache, or
  // closing the ticket) and will fold these figures into that one write.
  skipHeader = false,
}) {
  const written = [];
  let total = 0;
  let cost = 0;
  // A single base reading, incremented per row, so lines rung in one
  // action keep the order they were rung in even when the clock does not
  // tick between them.
  const base = at instanceof Date ? at.getTime() : Date.now();

  (rows || []).forEach((row, index) => {
    const ref = doc(collection(db, LINES));
    const line = buildTicketLine(row, {
      orderId,
      courseId: row?.courseId ?? courseId,
      station: typeof stationFor === 'function' ? stationFor(row) : (row?.station ?? null),
      routed: typeof routedFor === 'function' ? routedFor(row) !== false : (row?.routed !== false),
      addedBy, addedByName, at, seq: base + index,
    });
    if (closed) {
      line.open = false;
      line.fulfillment = FULFILLMENT.SERVED;
      line.servedAt = at;
    }
    batch.set(ref, withBusiness(line, businessId));
    written.push({ id: ref.id, ...line });
    total += Number(line.lineTotal) || 0;
    cost += Number(line.lineCost) || 0;
  });

  if (!skipHeader) {
    bumpHeader(batch, orderId, { totalAmount: total, costOfGoodsSold: cost });
  }
  written.totals = { totalAmount: roundMoney(total), costOfGoodsSold: roundMoney(cost) };
  return written;
}

/**
 * Change one line — a quantity, a note, a modifier choice.
 *
 * `next` is the REBUILT line, not a patch, because the money on a line is
 * derived from its quantity and price and must be recomputed by the one
 * function that computes it. The header adjustment is the difference
 * between the two, which is why both are needed.
 */
export function updateTicketLine(batch, before, next) {
  if (!before?.id) return;
  const fields = { ...next, updatedAt: serverTimestamp() };
  delete fields.id;
  delete fields.readOnlyLine;
  batch.update(doc(db, LINES, before.id), fields);
  bumpHeader(batch, before.orderId, headerDelta({ before, after: { ...before, ...next } }));
}

/**
 * TAKE A LINE OFF THE BILL.
 *
 * Flagged, never deleted. A restaurant that cannot answer "how many
 * steaks were voided last night, and by whom" cannot tell a mistake from
 * a theft, and the record is the only thing that makes the permission
 * worth having.
 *
 * NO STOCK MOVES. An open ticket has never held any — stock moves when a
 * ticket is CHARGED, in the same batch as the sale — so voiding an item
 * before it is charged has nothing to put back. That is the payoff of not
 * reserving stock at ticket time, and it is why voiding is a one-document
 * write rather than an inventory reversal.
 */
export function voidTicketLine(batch, line, { by = null, byName = null, reason = '', at = new Date() } = {}) {
  if (!line?.id || isVoided(line)) return;
  batch.update(doc(db, LINES, line.id), {
    voided: true,
    voidedAt: at,
    voidedBy: by,
    voidedByName: byName,
    voidReason: String(reason || '').trim().slice(0, 120),
    updatedAt: serverTimestamp(),
  });
  bumpHeader(batch, line.orderId, headerDelta({ before: line, after: null }));
}

/**
 * FIRE — send everything not yet sent to the kitchen.
 *
 * Idempotent by construction: only lines still sitting at `new` are
 * touched, so a second tap, a retry, or two waiters both firing the same
 * table produce the same result and no duplicate kitchen work.
 *
 * Firing moves no money, so the header is not touched at all.
 */
export function fireTicketLines(batch, lines, { at = new Date() } = {}) {
  const firing = (lines || []).filter(
    (line) => line?.id && !line.readOnlyLine && isLive(line) && fulfillmentOf(line) === FULFILLMENT.NEW
  );
  for (const line of firing) {
    // NOTHING TO COOK IS ALREADY DONE. A line the owner has said does not
    // go to the kitchen — a bottle from the fridge — has no preparation
    // to wait for, so parking it at `sent` would leave the waiter
    // watching a beer that no screen is ever going to mark ready, and
    // would hold the whole ticket short of the pass. It goes straight to
    // `ready`, which is the truth: it is on the bar, waiting to be taken.
    const routed = isRoutedToKitchen(line);
    batch.update(doc(db, LINES, line.id), {
      fulfillment: routed ? FULFILLMENT.SENT : FULFILLMENT.READY,
      firedAt: at,
      ...(routed ? {} : { readyAt: at }),
      updatedAt: serverTimestamp(),
    });
  }
  return firing.length;
}

/**
 * Advance a line to a later stage. Forward only — the same guard the
 * domain applies — so a double-tap on a kitchen screen cannot walk a
 * ticket backwards, and two cooks tapping "Ready" at once agree.
 */
export function advanceTicketLine(batch, line, target, { at = new Date() } = {}) {
  if (!line?.id || line.readOnlyLine || isVoided(line)) return false;
  const current = fulfillmentOf(line);
  const order = [FULFILLMENT.NEW, FULFILLMENT.SENT, FULFILLMENT.READY, FULFILLMENT.SERVED];
  if (order.indexOf(target) <= order.indexOf(current)) return false;

  const update = { fulfillment: target, updatedAt: serverTimestamp() };
  // Each stamp is written only when the line actually passes that stage,
  // and never overwritten, so ticket times are measured from what
  // happened rather than from the last time somebody tapped something.
  if (target === FULFILLMENT.SENT && !line.firedAt) update.firedAt = at;
  if (target === FULFILLMENT.READY && !line.readyAt) update.readyAt = at;
  if (target === FULFILLMENT.SERVED && !line.servedAt) update.servedAt = at;
  batch.update(doc(db, LINES, line.id), update);
  return true;
}

/**
 * ADVANCE A WHOLE LEGACY TICKET, because a legacy ticket has no line
 * documents to advance.
 *
 * A ticket written before this domain shipped — and, until the counter is
 * migrated, EVERY ticket the counter writes — stores its lines as an
 * array on the order document and carries ONE `kitchenStatus` for the
 * whole thing. `readTicket()` presents those lines as `readOnlyLine`, and
 * `advanceTicketLine()` correctly refuses them: there is no document to
 * update.
 *
 * That refusal was silent, and it made the kitchen screen a display with
 * dead buttons on it — a cook tapped "Ready" and nothing whatsoever
 * happened, on the only kind of ticket the counter produces. This is the
 * honest fallback: move the whole ticket, because the whole ticket is the
 * only granularity the stored document has.
 *
 * The mapping is one-for-one and lossless — `sent` is what the old model
 * spelled `preparing` — and it is forward-only for the same reason line
 * advancement is: the cooking already happened.
 *
 * Returns true when it wrote something, so a caller can tell an ignored
 * tap from a completed one.
 */
const LEGACY_KITCHEN_STATUS = Object.freeze({
  new: 'new', sent: 'preparing', ready: 'ready', served: 'served',
});
const LEGACY_ORDER = ['new', 'preparing', 'ready', 'served'];

export function advanceLegacyTicket(batch, ticket, target, { at = new Date() } = {}) {
  if (!ticket?.id || ticket.lineModel !== 'array') return false;
  const next = LEGACY_KITCHEN_STATUS[target];
  if (!next) return false;
  const current = LEGACY_KITCHEN_STATUS[
    Object.keys(LEGACY_KITCHEN_STATUS).find((k) => LEGACY_KITCHEN_STATUS[k] === ticket.order?.kitchenStatus)
  ] || (LEGACY_ORDER.includes(ticket.order?.kitchenStatus) ? ticket.order.kitchenStatus : 'new');
  if (LEGACY_ORDER.indexOf(next) <= LEGACY_ORDER.indexOf(current)) return false;
  batch.update(doc(db, ORDERS, ticket.id), {
    kitchenStatus: next,
    kitchenStatusAt: at,
    updatedAt: serverTimestamp(),
  });
  return true;
}

/**
 * SPLIT, MERGE, TRANSFER — apply a plan from planLineMove().
 *
 * All three are the same operation, which is the point: a line's ticket
 * is a field on the line, so moving some lines to a new ticket IS a split
 * check and moving all of them IS a merge. One primitive, one write path,
 * and the two headers adjusted in the same commit so no money is ever in
 * flight between two tickets.
 */
export function applyLineMove(batch, plan, { at = new Date() } = {}) {
  if (!plan || plan.moves.length === 0) return 0;
  for (const move of plan.moves) {
    batch.update(doc(db, LINES, move.id), {
      orderId: move.orderId,
      updatedAt: serverTimestamp(),
    });
  }
  if (plan.fromDelta) bumpHeader(batch, plan.fromDelta.id, plan.fromDelta);
  if (plan.toDelta) bumpHeader(batch, plan.toDelta.id, plan.toDelta);
  void at;
  return plan.moved;
}

/**
 * Open a new ticket. The header carries the cached figures at zero and
 * the lines are added separately (usually in the same batch), so a
 * newly-opened empty ticket is a valid document rather than a half-built
 * one.
 *
 * `lineModel: 'lines'` is what tells every future reader that this
 * ticket's truth is in `orderLines` and its `items` array — which it does
 * not have — is not to be looked for. Tickets written before this exists
 * have no such field and are read from their array, unchanged and
 * un-migrated. See readTicket() in ticket.js.
 */
export function buildTicketHeader({
  name, tableName = null, diningMode = null, note = '',
  openedBy = null, openedByName = null, at = new Date(),
}) {
  return {
    lineModel: 'lines',
    name,
    tableName: tableName || null,
    diningMode: diningMode || null,
    status: TICKET_STATUS.OPEN,
    note: String(note || '').slice(0, 300),
    totalAmount: 0,
    costOfGoodsSold: 0,
    profit: 0,
    openedBy,
    openedByName,
    openedAt: at,
    updatedAt: at,
  };
}

/**
 * CLOSE A TICKET, in the same batch as the sale it became.
 *
 * Two things happen, and both matter:
 *
 *   the header is marked completed and stamped with the sale id, so there
 *   is no window — online or offline — in which a ticket has been paid for
 *   and still shows as open;
 *
 *   every live line is marked SERVED, which is both true and load-bearing:
 *   the floor view and the kitchen screen read the lines that are not yet
 *   served, so a paid ticket leaves both screens by itself rather than
 *   needing a second query that knows about ticket status.
 */
export function closeTicket(batch, ticket, saleId, { at = new Date(), totals = null } = {}) {
  if (!ticket?.id) return;
  const header = {
    status: TICKET_STATUS.COMPLETED,
    saleId: saleId || null,
    closedAt: at,
    updatedAt: serverTimestamp(),
  };
  // The final figures, folded into the SAME update as the status rather
  // than incremented by a separate write — lines added in this batch have
  // already been counted into them by the caller, and a ticket that has
  // been charged has an exact total rather than a cached one.
  if (totals) {
    header.totalAmount = roundMoney(Number(totals.totalAmount) || 0);
    header.costOfGoodsSold = roundMoney(Number(totals.costOfGoodsSold) || 0);
    header.profit = roundMoney(header.totalAmount - header.costOfGoodsSold);
  }
  batch.update(doc(db, ORDERS, ticket.id), header);

  for (const line of ticket.lines || []) {
    // A line created in THIS batch is already written closed and served —
    // updating it here would be a second operation on a document the same
    // commit just created.
    if (line.readOnlyLine || line.open === false) continue;
    const update = { open: false, updatedAt: serverTimestamp() };
    // A live line that was never marked served is served now: it was on
    // the table and it has been paid for. A voided one is left exactly as
    // it is — it was taken off the bill, not eaten.
    if (isLive(line) && fulfillmentOf(line) !== FULFILLMENT.SERVED) {
      update.fulfillment = FULFILLMENT.SERVED;
      if (!line.servedAt) update.servedAt = at;
    }
    batch.update(doc(db, LINES, line.id), update);
  }
}

/**
 * Abandon a ticket. Cancelled, never deleted — an order that was opened
 * and walked away from is a thing that happened, and a restaurant that
 * wants to know how often it happens needs the record to still be there.
 *
 * Its lines are voided rather than served, which is the honest word and
 * also what keeps them off the kitchen screen.
 */
export function cancelTicket(batch, ticket, { by = null, byName = null, reason = '', at = new Date() } = {}) {
  if (!ticket?.id) return;
  batch.update(doc(db, ORDERS, ticket.id), {
    status: TICKET_STATUS.CANCELLED,
    cancelledAt: at,
    cancelledBy: by,
    updatedAt: serverTimestamp(),
  });
  // Its lines are taken out of play, and DELIBERATELY NOT VOIDED. A void
  // is a statement about one item on a bill — somebody took it off, and
  // who did that is the point of the record. A ticket nobody ever charged
  // has no bill to take anything off, and marking its whole contents
  // "voided" would put a manager's abandoned-table count and their
  // voided-item count into the same number, which is exactly the pair a
  // manager is trying to tell apart.
  //
  // What was rung on an abandoned ticket is worth keeping as it was.
  for (const line of ticket.lines || []) {
    if (line.readOnlyLine) continue;
    batch.update(doc(db, LINES, line.id), { open: false, updatedAt: serverTimestamp() });
  }
  void byName;
  void reason;
}

/**
 * Heal a header cache that has drifted from its lines.
 *
 * The cache is maintained by commutative increments, which is what makes
 * it multi-device safe, but an increment that was applied twice (a retried
 * commit) or not at all (a write refused after its sibling landed) leaves
 * it slightly wrong. This is an ASSIGNMENT rather than an increment, on
 * purpose: it is the one place the exact figure is known, because the
 * caller is holding every line.
 *
 * Only ever called by a screen that already has all of a ticket's lines,
 * and only when readTicket() says they disagree.
 */
export function healTicketHeader(batch, ticket, { plus = null } = {}) {
  if (!ticket?.id || !ticket.cacheStale) return false;
  // Anything being added in the same batch is folded in here, because the
  // caller must skip the increment when it heals: one write per document
  // per batch, and an increment applied on top of an assignment would
  // double-count whichever landed second.
  const totalAmount = roundMoney(ticket.totalAmount + (Number(plus?.totalAmount) || 0));
  const costOfGoodsSold = roundMoney(ticket.costOfGoodsSold + (Number(plus?.costOfGoodsSold) || 0));
  batch.update(doc(db, ORDERS, ticket.id), {
    totalAmount,
    costOfGoodsSold,
    profit: roundMoney(totalAmount - costOfGoodsSold),
    updatedAt: serverTimestamp(),
  });
  return true;
}
