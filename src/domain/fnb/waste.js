// src/domain/fnb/waste.js
//
// WASTE — stock that left the business without being sold.
//
// THE HOLE THIS FILLS. FlowBiz had exactly two ways for stock to go down:
// a sale, and a stock take. Everything a kitchen actually loses — a
// dropped tray, a burnt batch, a spoiled crate of milk, a bottle broken
// behind the bar, a tub of yoghurt past its date — had to be entered as a
// stock take "correction" with a free-text reason, or not entered at all.
//
// That is wrong twice over. It is wrong in the STOCK ledger, because a
// count is not a movement: recording spoilage as a count says "the shelf
// holds nine" and loses the fact that one was thrown away. And it is
// wrong in the MONEY, because cost of goods sold in FlowBiz is computed
// from what was sold, so stock that vanished without a sale carried no
// cost at all and the business's recorded profit was overstated by
// exactly the value of everything it threw away.
//
// Recorded waste is a real cost of trading, so it reaches the profit
// figure — see financials.js, `totalWasteCost`. It is kept OUT of cost of
// goods sold, deliberately, because COGS in this product means "the cost
// of the things we sold" and gross margin on sales has to stay comparable
// across every industry. Waste is its own line, which is also how a
// kitchen wants to read it: nobody improves a food cost they cannot see
// separately from a sale.
//
// WHY THIS IS SHARED F&B AND NOT BAKERY-ONLY OR BAR-ONLY. Every one of
// the five food profiles loses stock the same way and needs the same four
// facts — what, how much, why, what it cost. A bakery's stale bread, a
// bar's breakage and a restaurant's spoilage are one movement with one
// shape. Three implementations of that would be three places to get the
// costing wrong.
//
// It is offered to RETAIL profiles too, and that is not scope creep: a
// supermarket throws away more produce than most kitchens, and the
// movement is identical. It is a capability, so a business that does not
// want it never sees it.

import { roundMoney } from '../../utils/currency.js';
import { roundQuantity, DEFAULT_UNIT } from '../../industry/units.js';
import { tracksOwnStock } from '../../utils/inventory.js';
import { hasVariants } from '../../utils/variants.js';

/**
 * WHY IT WAS THROWN AWAY. A short, fixed list, because the point of the
 * field is to be COUNTABLE — "spoilage was 4% of purchases this month" is
 * a sentence an owner can act on, and free text is not. `other` carries
 * the note for everything the list does not cover.
 *
 * These are the categories food-service cost control actually separates:
 * things that went off, things that got broken, things that were made
 * wrong, things given away, and things that ran out of date.
 */
export const WASTE_REASONS = [
  { id: 'spoilage',  label: 'Spoiled or went off' },
  { id: 'expiry',    label: 'Past its date' },
  { id: 'breakage',  label: 'Broken or spilled' },
  { id: 'prep',      label: 'Prep loss or trim' },
  { id: 'mistake',   label: 'Made wrong / sent back' },
  { id: 'staff',     label: 'Staff meal or comp' },
  { id: 'other',     label: 'Something else' },
];

export const WASTE_REASON_IDS = WASTE_REASONS.map((r) => r.id);
export const DEFAULT_WASTE_REASON = 'spoilage';
export const MAX_WASTE_NOTE = 200;

export function isKnownWasteReason(id) {
  return WASTE_REASON_IDS.includes(id);
}

export function wasteReasonLabel(id) {
  return WASTE_REASONS.find((r) => r.id === id)?.label || 'Something else';
}

/**
 * Can this product be wasted? Only something that has stock of its own.
 *
 * A SERVICE cannot be thrown away. A MADE-TO-ORDER DISH cannot either —
 * it has no stock, and wasting "one burger" would deduct nothing at all
 * while looking like it had worked. What was actually lost in that case
 * is the ingredients, and they are what gets recorded. This is the same
 * `tracksOwnStock` rule the whole inventory foundation is built on, so
 * waste can never move a number a sale would not have moved.
 */
export function isWastable(product) {
  return tracksOwnStock(product);
}

/**
 * Build a waste record from an entered row.
 *
 * The cost is SNAPSHOTTED from the product's cost price at the moment it
 * is recorded, exactly as a sale line snapshots its cost. A waste record
 * from March has to keep saying what that flour cost in March after the
 * price moves in April, or every historical waste figure silently
 * rewrites itself.
 *
 * Returns null for anything that cannot be a real record, so a caller
 * cannot half-write one.
 */
export function buildWasteRecord(row, product, {
  recordedBy = null,
  recordedByName = null,
  at = new Date(),
} = {}) {
  if (!product || !isWastable(product)) return null;

  const unit = product.unit || DEFAULT_UNIT;
  const quantity = roundQuantity(Number(row?.quantity) || 0, unit);
  if (quantity <= 0) return null;

  const reason = isKnownWasteReason(row?.reason) ? row.reason : DEFAULT_WASTE_REASON;
  // The cost of the thing ACTUALLY thrown away: a batch bought at 20 is
  // not worth the product's current 12, and a version may carry its own
  // price. The caller passes that when it knows it; otherwise the
  // product's cost is the best figure there is.
  const stated = Number(row?.unitCost);
  const unitCost = roundMoney(Math.max(0, Number.isFinite(stated) && row?.unitCost !== null && row?.unitCost !== '' ? stated : (Number(product.costPrice) || 0)));

  const record = {
    productId: product.id,
    productName: product.name,
    quantity,
    reason,
    unitCost,
    totalCost: roundMoney(unitCost * quantity),
    recordedBy,
    recordedByName,
    recordedAt: at,
  };
  if (unit !== DEFAULT_UNIT) record.unit = unit;
  if (row?.variantId) {
    record.variantId = row.variantId;
    if (row.variantLabel) record.variantLabel = row.variantLabel;
  }
  if (row?.batchId) {
    record.batchId = row.batchId;
    if (row.batchLabel) record.batchLabel = row.batchLabel;
  }
  const note = String(row?.note ?? '').trim().slice(0, MAX_WASTE_NOTE);
  if (note) record.note = note;
  return record;
}

/**
 * The stock movement a set of waste records implies, in the delta shape
 * utils/inventory.js produces and utils/stockWrites.js writes.
 *
 * Built HERE rather than through resolveStockDeltas() for one reason that
 * matters: waste is recorded against a SPECIFIC batch when the business
 * tracks batches — you throw away the box that went off, not the earliest
 * one — so it must not be routed through FEFO allocation. Everything else
 * about the shape, and every rounding rule, is identical, and it is
 * written by the same single adapter, so there is still exactly one
 * answer to "how does stock get written".
 */
/**
 * Why a waste entry cannot be recorded as entered, or null.
 *
 * A product with versions keeps a quantity PER VERSION alongside its
 * total, and one tracked by batch keeps one per batch. Waste that moved
 * only the total left the version map and the batch ledger claiming stock
 * that had been thrown in the bin — so the version, or the batch, has to
 * be named.
 */
export function wasteSubledgerProblem(row, product, { batches = [] } = {}) {
  if (!product) return 'Choose what was thrown away.';
  if (hasVariants(product) && !row?.variantId) return `Choose which version of ${product.name} was thrown away.`;
  const lots = (batches || []).filter((b) => b?.productId === product.id && (Number(b.remainingQuantity ?? b.quantity) || 0) > 0);
  if (lots.length > 0 && !row?.batchId) return `Choose which batch of ${product.name} was thrown away.`;
  return null;
}

export function resolveWasteDeltas(records, products) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const deltas = {};

  for (const record of records || []) {
    const product = byId.get(record?.productId);
    if (!product || !tracksOwnStock(product)) continue;
    const unit = product.unit || DEFAULT_UNIT;
    const quantity = roundQuantity(Number(record?.quantity) || 0, unit);
    if (quantity <= 0) continue;

    if (!deltas[product.id]) deltas[product.id] = { total: 0, variants: {}, batches: {} };
    const entry = deltas[product.id];
    entry.total = roundQuantity(entry.total - quantity, unit);
    if (record.variantId) {
      entry.variants[record.variantId] = roundQuantity(
        (entry.variants[record.variantId] || 0) - quantity, unit
      );
    }
    if (record.batchId) {
      entry.batches[record.batchId] = roundQuantity(
        (entry.batches[record.batchId] || 0) - quantity, unit
      );
    }
  }
  return deltas;
}

/** What a period's waste cost, split by why it happened. */
export function summarizeWaste(records) {
  const byReason = Object.fromEntries(WASTE_REASON_IDS.map((id) => [id, 0]));
  let totalCost = 0;
  for (const record of records || []) {
    const cost = roundMoney(Number(record?.totalCost) || 0);
    totalCost = roundMoney(totalCost + cost);
    const reason = isKnownWasteReason(record?.reason) ? record.reason : 'other';
    byReason[reason] = roundMoney(byReason[reason] + cost);
  }
  return { totalCost, byReason, count: (records || []).length };
}

/** What a period's waste cost, per product, worst first. */
export function wasteByProduct(records) {
  const byProduct = new Map();
  for (const record of records || []) {
    const id = record?.productId;
    if (!id) continue;
    const existing = byProduct.get(id) || {
      productId: id, productName: record.productName, unit: record.unit, quantity: 0, totalCost: 0,
    };
    existing.quantity = roundQuantity(existing.quantity + (Number(record.quantity) || 0), record.unit);
    existing.totalCost = roundMoney(existing.totalCost + (Number(record.totalCost) || 0));
    byProduct.set(id, existing);
  }
  return [...byProduct.values()].sort((a, b) => b.totalCost - a.totalCost);
}
