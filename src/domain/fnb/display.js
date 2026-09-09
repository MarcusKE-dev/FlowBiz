// src/domain/fnb/display.js
//
// WHAT THE CUSTOMER SEES, derived once.
//
// A customer-facing display is the only screen in FlowBiz that people who
// do not work for the business read, and that changes what belongs on it.
// Three rules this module exists to keep:
//
//   NO MONEY. A board on a dining-room wall must never show what a table
//   is spending. The people at Table 4 can read Table 5's screen.
//
//   NO STAFF NAMES, NO NOTES, NO MODIFIERS. "No onions — allergy" is
//   medical information about a stranger; "rush this, they complained" is
//   worse. The board shows what is happening, never why.
//
//   NO PRODUCT NAMES AGAINST A TABLE. What a named table ordered is that
//   party's business. A COUNTER queue is different — a token board saying
//   "42: Ready" names nobody — and the two cases are separated below.
//
// Everything here is a pure function of the tickets, so what a television
// in the corner of the room shows can be asserted in a unit test instead
// of being reviewed by looking at it.

import { FULFILLMENT, fulfillmentOf } from './lines.js';
import { ticketStage } from './ticket.js';

/**
 * The four words a customer sees, and they are deliberately not the four
 * the kitchen uses. A kitchen says "sent"; a customer wants to know
 * whether anybody has started.
 */
export const DISPLAY_STAGE = Object.freeze({
  ORDERED: 'ordered',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
});

export const DISPLAY_STAGE_LABELS = Object.freeze({
  ordered: 'Ordered',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
});

/**
 * A customer's word for a kitchen's state.
 *
 *   new    → Ordered    "we have it, nobody has started"
 *   sent   → Preparing  "it is being made"
 *   ready  → Ready      "come and get it" / "it is coming out"
 *   served → Served
 */
export function displayStage(fulfillment) {
  if (fulfillment === FULFILLMENT.SENT) return DISPLAY_STAGE.PREPARING;
  if (fulfillment === FULFILLMENT.READY) return DISPLAY_STAGE.READY;
  if (fulfillment === FULFILLMENT.SERVED) return DISPLAY_STAGE.SERVED;
  return DISPLAY_STAGE.ORDERED;
}

/** Milliseconds out of whatever shape Firestore handed a timestamp back in. */
export function toMillis(value) {
  if (!value) return null;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * How long this ticket has been waiting, in whole minutes.
 *
 * Measured from when the order was PLACED, not from when the kitchen
 * started it, because that is the number the customer is counting. A
 * ticket with no timestamp returns null and the screen prints nothing
 * rather than "0m", which would be a lie about a ticket that has been
 * sitting there since before the clock was readable.
 */
export function waitingMinutes(ticket, now = Date.now()) {
  const opened = toMillis(ticket?.openedAt) ?? toMillis(ticket?.order?.openedAt);
  if (opened === null) return null;
  return Math.max(0, Math.floor((now - opened) / 60000));
}

/**
 * THE ORDER BOARD — the queue, as a customer reads it.
 *
 * Two lists, and the split is the whole design. Anything READY goes at
 * the top in the largest type on the screen, because that is the only row
 * that asks somebody to do something. Everything still cooking goes below
 * it, oldest first, so a customer can see their place in the queue rather
 * than scanning for their own name.
 *
 * A ticket nobody has fired yet appears under "preparing" as *Ordered*.
 * Hiding it would mean a customer who has just paid sees nothing at all
 * and concludes the order was lost.
 */
export function readOrderBoard(tickets, { now = Date.now(), limit = 24 } = {}) {
  const live = (tickets || []).filter((t) => t && t.liveLines?.length > 0);

  const entries = live.map((ticket) => {
    const stage = displayStage(ticketStage(ticket));
    return {
      id: ticket.id,
      // The ticket's own name — a table name, a counter token, the time it
      // was opened. Never a customer's name and never a member of staff's.
      label: ticket.name || ticket.tableName || 'Order',
      tableName: ticket.tableName || null,
      diningMode: ticket.diningMode || null,
      stage,
      waiting: waitingMinutes(ticket, now),
      // How much of the ticket is done, for a progress reading that does
      // not require naming a single dish.
      itemsTotal: ticket.liveLines.length,
      itemsReady: ticket.liveLines.filter(
        (l) => fulfillmentOf(l) === FULFILLMENT.READY || fulfillmentOf(l) === FULFILLMENT.SERVED
      ).length,
    };
  });

  const byAge = (a, b) => (b.waiting ?? 0) - (a.waiting ?? 0);

  return {
    ready: entries.filter((e) => e.stage === DISPLAY_STAGE.READY).sort(byAge).slice(0, limit),
    // Served but not yet charged is not the customer's problem and is not
    // shown: the food is on the table, and a board that keeps saying so
    // fills up with rows nobody is waiting on.
    working: entries
      .filter((e) => e.stage === DISPLAY_STAGE.PREPARING || e.stage === DISPLAY_STAGE.ORDERED)
      .sort(byAge)
      .slice(0, limit),
  };
}

/**
 * THE MENU REEL — what rotates in the middle of the screen.
 *
 * Photographed items first, and that is not a cosmetic preference: this
 * panel is the size of a television and an item with no picture renders
 * as a name floating in a large empty rectangle. A business that has
 * photographed six of its forty dishes gets a reel of those six rather
 * than a reel that is mostly blank.
 *
 * Items with no photo are still included when there are too few
 * photographed ones to fill a rotation, because a menu board with three
 * items on a loop is worse than a plain one.
 */
export function readMenuReel(products, { limit = 24, minimum = 6 } = {}) {
  const sellable = (products || []).filter(
    (p) => p && !p.deleted && Number(p.sellingPrice) > 0
  );
  const hasPhoto = (p) => Boolean(p.imageUrl || p.imagePath || p.imageUpdatedAt);

  const photographed = sellable.filter(hasPhoto);
  const rest = sellable.filter((p) => !hasPhoto(p));

  const reel = photographed.length >= minimum
    ? photographed
    : [...photographed, ...rest.slice(0, Math.max(0, minimum - photographed.length))];

  return reel.slice(0, limit).map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category || null,
    price: Number(product.sellingPrice) || 0,
    product,
    photographed: hasPhoto(product),
  }));
}

/**
 * The ids currently on the pass, as a Set.
 *
 * The customer display rings a chime when something becomes ready, and
 * the obvious implementation — comparing how MANY are ready — is wrong in
 * the case that matters: one ticket collected and another finished in the
 * same snapshot leaves the count unchanged and the new one is announced
 * to nobody. Comparing identities is the honest question, and it is here
 * rather than in the component so it can be tested.
 */
export function readyIds(board) {
  return new Set((board?.ready || []).map((entry) => entry.id));
}

/** Which ids are newly ready since the last snapshot. */
export function newlyReady(previous, current) {
  const before = previous instanceof Set ? previous : new Set(previous || []);
  return [...(current instanceof Set ? current : new Set(current || []))]
    .filter((id) => !before.has(id));
}
