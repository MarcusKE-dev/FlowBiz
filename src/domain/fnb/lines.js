// src/domain/fnb/lines.js
//
// THE TICKET LINE — one Firestore document per line on an open ticket.
//
// WHY THIS EXISTS, and it is the single most important decision in this
// domain. FlowBiz's open order was one document carrying an `items`
// ARRAY, rewritten whole every time the ticket changed:
//
//     updateDoc(orders/abc, { items: [...the entire cart...] })
//
// That is correct for exactly one device. It is silently wrong for two.
// Two waiters with the same table open both read `items`, both append
// their own round, and both write the whole array back. Firestore has no
// opinion about which is right — the last write wins, and the earlier
// waiter's drinks are gone from the ticket with no error anywhere. The
// counter tried to prevent this in the UI ("Finish or clear the current
// order first"), but that check is per-device state and cannot see
// another tablet at all.
//
// A restaurant is multi-device by definition. So the unit of WRITE has to
// become the unit of CHANGE: a line. Adding a round creates new
// documents, which can never collide; changing a line touches only that
// line; voiding one sets a flag on it. Two devices working the same table
// now merge instead of clobbering, and they merge OFFLINE too, because
// each is an independent queued mutation rather than a read-modify-write
// of shared state.
//
// WHY NOT OPTIMISTIC CONCURRENCY (a `version` field, the Square model).
// Square's Orders API rejects an update whose `version` is stale, which
// is the textbook answer and the wrong one here: FlowBiz is offline-first
// and Firestore transactions FAIL while offline, while a rules-based
// version guard would let an offline write sit in the queue for an hour
// and then be REJECTED at sync time — losing it after the waiter was told
// it was saved. Conflict-free writes are the only shape that keeps the
// offline promise honest. Append-only lines are conflict-free; a shared
// array is not.
//
// WHAT THIS BUYS BEYOND CORRECTNESS. Once a line is its own document with
// its own id, four workflows that a full-service restaurant genuinely
// needs stop being features and become the same one-line operation —
// changing `orderId`:
//
//     split a check   move some lines to a new ticket
//     merge tickets   move all lines onto one ticket
//     transfer table  move lines (or just rename the header)
//     move an item    sent to the wrong table
//
// That is the payoff for modelling the domain rather than adding screens.
//
// THE LINE SHAPE IS THE SALE LINE SHAPE. Every field utils/lineItems.js
// writes onto a sale line item is written here identically, so charging a
// ticket COPIES its lines into the sale rather than translating them, and
// every existing reader of a sale — receipts, reports, the admin
// inspector, exports, computeFinancials — is untouched.

import { roundMoney } from '../../utils/currency.js';
import { buildLineItem } from '../../utils/lineItems.js';
import { modifierRowKey } from '../../utils/modifiers.js';

/**
 * FULFILLMENT — the state of one line in the kitchen, not the state of
 * the whole ticket.
 *
 * This is the Toast model (`Selection.fulfillmentStatus`: NEW, SENT,
 * READY) and it is the correct one, because a ticket is not in one
 * kitchen state: the drinks are poured while the steak is still on the
 * grill. FlowBiz previously kept a single `kitchenStatus` on the order,
 * which forced a kitchen to describe a table with one word and made
 * courses, stations and progressive ordering impossible to represent.
 *
 *   new     on the ticket, NOT yet sent to the kitchen. The waiter is
 *           still taking the order. Nothing is cooking.
 *   sent    fired. It is on the kitchen screen and being made.
 *   ready   the kitchen has finished it. It is on the pass.
 *   served  it is on the table.
 *
 * Forward-only. A line never goes back a stage, because the kitchen work
 * it represents has already happened; a mistake is a VOID, which is a
 * different and audited thing.
 */
export const FULFILLMENT = Object.freeze({
  NEW: 'new',
  SENT: 'sent',
  READY: 'ready',
  SERVED: 'served',
});

export const FULFILLMENT_ORDER = [
  FULFILLMENT.NEW, FULFILLMENT.SENT, FULFILLMENT.READY, FULFILLMENT.SERVED,
];

export const FULFILLMENT_LABELS = Object.freeze({
  new: 'Not sent',
  sent: 'Preparing',
  ready: 'Ready',
  served: 'Served',
});

/** Anything unknown, absent or malformed is a line nobody has fired. */
export function fulfillmentOf(line) {
  const value = line?.fulfillment;
  return FULFILLMENT_ORDER.includes(value) ? value : FULFILLMENT.NEW;
}

export function isVoided(line) {
  return line?.voided === true;
}

/** A line that still counts: not voided. Voided lines are kept, never deleted. */
export function isLive(line) {
  return !isVoided(line);
}

/** Has this line been sent to the kitchen? Firing is what makes it real work. */
export function isFired(line) {
  return fulfillmentOf(line) !== FULFILLMENT.NEW;
}

/**
 * Does this line reach a kitchen screen? Absent means yes — every line
 * written before routing was carried, and every ordinary dish.
 */
export function isRoutedToKitchen(line) {
  return line?.routed !== false;
}

/**
 * Forward-only advance. Returns the same state at the end of the line
 * rather than wrapping, so a double-tap on "Ready" is harmless.
 */
export function nextFulfillment(current) {
  const index = FULFILLMENT_ORDER.indexOf(current);
  if (index < 0) return FULFILLMENT.SENT;
  return FULFILLMENT_ORDER[Math.min(index + 1, FULFILLMENT_ORDER.length - 1)];
}

/**
 * May this line move to `target`? Forward only, and never off a voided
 * line. Returned as a boolean rather than throwing because every caller
 * is a button that should be disabled, not a crash.
 */
export function canAdvanceTo(line, target) {
  if (!FULFILLMENT_ORDER.includes(target)) return false;
  if (isVoided(line)) return false;
  return FULFILLMENT_ORDER.indexOf(target) > FULFILLMENT_ORDER.indexOf(fulfillmentOf(line));
}

/**
 * The row key a cart uses to decide whether two additions are the same
 * line. Unchanged from utils/orders.js — two burgers with different
 * modifiers are two lines; two identical burgers are one line of two.
 */
export function lineRowKey({ productId, variantId, modifiers }) {
  return [productId, variantId || '', modifierRowKey(modifiers)].filter(Boolean).join('::');
}

/**
 * Build the stored ticket-line document from a cart row.
 *
 * The priced part comes from buildLineItem() — the ONE place line
 * arithmetic lives — so a ticket line and the sale line it becomes are
 * built by the same function and cannot disagree by a rounding step.
 * Everything this adds is ticket context: where it goes, when it was
 * fired, who added it.
 *
 * Every added field is optional-with-a-safe-default on read, so a line
 * written by an older client (or a ticket migrated from the legacy
 * `items` array) resolves identically.
 */
export function buildTicketLine(row, {
  orderId,
  courseId = null,
  station = null,
  // DOES THIS REACH A KITCHEN SCREEN? A bottle taken from the fridge and
  // a packet of crisps are ordered, charged and served like anything
  // else, and nobody cooks them. `isRoutable` on the product has always
  // said so; until now nothing carried the answer onto the LINE, so the
  // routing decision could not survive to the screen that had to make it
  // and every beer filled the pass with work that did not exist.
  //
  // Snapshotted for the same reason the station is: turning routing off
  // for an item must not lift the ones already cooking off the screen.
  routed = true,
  addedBy = null,
  addedByName = null,
  at = new Date(),
  seq = null,
} = {}) {
  const priced = buildLineItem(row);
  const line = {
    ...priced,
    orderId: orderId || null,
    // IS THIS LINE STILL IN PLAY? True until its ticket is charged or
    // abandoned, and it is what the floor and the kitchen listen on.
    //
    // It exists because `fulfillment` cannot answer the question. A table
    // that has eaten and not yet paid has every line at `served`, and a
    // live query written against the fulfillment stages would drop the
    // ticket off the floor at precisely the moment somebody needs to
    // charge it. A line is live until its TICKET closes, which is a
    // different fact and now has its own field.
    open: true,
    // A stable ordering hint. Firestore has no insertion order, and
    // `addedAt` is a serverTimestamp that is null on the local snapshot
    // for a moment — a ticket whose lines jump around while it saves
    // looks broken. `seq` is a client clock reading, good enough to sort
    // by and never used for anything that has to be exact.
    seq: Number.isFinite(seq) ? seq : (at instanceof Date ? at.getTime() : Date.now()),
    fulfillment: FULFILLMENT.NEW,
    voided: false,
    addedBy,
    addedByName,
    addedAt: at,
    updatedAt: at,
  };
  // Absent rather than null when they say nothing, for the same reason
  // lineItems.js omits `unit: 'piece'`: a ticket in a shop that uses
  // neither courses nor stations stores neither field.
  if (courseId) line.courseId = courseId;
  if (station) line.station = station;
  // THE KITCHEN'S NAME FOR IT. A menu reads "Ocean's Bounty"; the pass
  // needs "grilled tilapia", and a cook who has to translate the menu
  // under pressure is a cook who plates the wrong thing. Every serious
  // platform separates the two names, and this is the smaller half of
  // that: one optional field, snapshotted at ring time so renaming an
  // item does not rewrite the tickets already cooking.
  //
  // It never reaches the sale — lineToSaleItem() does not copy it — so a
  // receipt still says what the customer ordered.
  if (row?.kitchenName) line.kitchenName = String(row.kitchenName).slice(0, 40);
  // Absent means routed, which is the safe direction: a line whose
  // routing could not be resolved reaches a screen rather than nobody.
  if (routed === false) line.routed = false;
  return line;
}

/**
 * Turn a stored ticket line back into an editable cart row. The inverse
 * of buildTicketLine, and deliberately lossy in exactly one direction:
 * it carries the identity and the choices, never the fulfillment state,
 * because editing a line does not un-cook it.
 */
export function lineToCartRow(line) {
  return {
    id: line.id,
    rowKey: lineRowKey(line),
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    basePrice: line.basePrice ?? line.unitPrice,
    costPrice: line.costPrice,
    barcode: line.barcode || null,
    unit: line.unit,
    variantId: line.variantId,
    variantLabel: line.variantLabel,
    modifiers: line.modifiers || [],
    note: line.note || '',
    courseId: line.courseId || null,
    station: line.station || null,
    kitchenName: line.kitchenName || null,
  };
}

/**
 * The sale line item a ticket line becomes. Strips every ticket-only
 * field, so the sale document is byte-for-byte the shape FlowBiz has
 * always written and nothing downstream learns that tickets exist.
 *
 * Voided lines are the caller's problem to filter; this is a projection,
 * not a policy.
 */
export function lineToSaleItem(line) {
  const item = {
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    costPrice: line.costPrice,
    lineTotal: line.lineTotal,
    lineCost: line.lineCost,
    lineProfit: line.lineProfit,
    barcode: line.barcode || null,
  };
  if (line.unit) item.unit = line.unit;
  if (line.variantId) {
    item.variantId = line.variantId;
    if (line.variantLabel) item.variantLabel = line.variantLabel;
  }
  if (Array.isArray(line.modifiers) && line.modifiers.length > 0) item.modifiers = line.modifiers;
  if (line.note) item.note = line.note;
  if (line.basePrice !== undefined && line.basePrice !== line.unitPrice) item.basePrice = line.basePrice;
  if (Array.isArray(line.batchAllocations) && line.batchAllocations.length > 0) {
    item.batchAllocations = line.batchAllocations;
  }
  return item;
}

/** Sort into the order they were rung in. Stable for equal seq values. */
export function sortLines(lines) {
  return [...(lines || [])].sort((a, b) => {
    const left = Number(a?.seq) || 0;
    const right = Number(b?.seq) || 0;
    if (left !== right) return left - right;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

/**
 * What a change to one line does to the ticket header's cached total.
 *
 * The header carries `totalAmount` so the Orders list and the dashboard
 * can show a figure without reading every line of every open ticket. It
 * is maintained with Firestore `increment()` — never by rewriting it —
 * precisely because increment is COMMUTATIVE: two devices adding a round
 * at the same moment both land, in either order, online or offline.
 * Rewriting the field would reintroduce the clobber this whole module
 * exists to remove.
 *
 * It is a CACHE, and it is named as one everywhere it is read. The check
 * screen totals the lines themselves, and `recomputeHeader()` below lets
 * any full read of a ticket heal a cache that drifted.
 */
export function headerDelta({ before = null, after = null } = {}) {
  const value = (line) => (line && isLive(line) ? Number(line.lineTotal) || 0 : 0);
  const cost = (line) => (line && isLive(line) ? Number(line.lineCost) || 0 : 0);
  return {
    totalAmount: roundMoney(value(after) - value(before)),
    costOfGoodsSold: roundMoney(cost(after) - cost(before)),
  };
}

/**
 * The header figures a ticket's live lines actually add up to. Used to
 * heal the cache whenever a screen has read the lines anyway, and by the
 * check screen, which never trusts the cache in the first place.
 */
export function recomputeHeader(lines) {
  const live = (lines || []).filter(isLive);
  const totalAmount = roundMoney(live.reduce((sum, l) => sum + (Number(l.lineTotal) || 0), 0));
  const costOfGoodsSold = roundMoney(live.reduce((sum, l) => sum + (Number(l.lineCost) || 0), 0));
  return {
    totalAmount,
    costOfGoodsSold,
    profit: roundMoney(totalAmount - costOfGoodsSold),
    lineCount: live.length,
  };
}
