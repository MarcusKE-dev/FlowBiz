// src/utils/returns.js
//
// Returning a completed cash or M-Pesa sale.
//
// WHAT WAS MISSING, AND WHY IT MATTERED. FlowBiz had exactly two ways to
// undo a sale, and neither of them is a return:
//
//   VOID restores stock and records no money at all. It is the right
//   answer for a mistake rung up thirty seconds ago — nothing was really
//   sold, so nothing was really paid. It is the wrong answer for a
//   customer coming back on Thursday with a shirt, because the shop DID
//   take the money and IS handing it back, and a void leaves the till
//   short with nothing to explain it.
//
//   A CREDIT REFUND handles a sale that was never paid for in cash.
//
// So a customer returning something they paid for had no correct path.
// This is that path, and it is deliberately small: full or partial line
// return, one reason, one refund record.
//
// TWO THINGS IT DOES NOT DO, on purpose:
//
//   It does not invent a second money path. The refund it writes is an
//   ORDINARY `refunds` document — the same collection, the same fields,
//   the same `computeFinancials()` that credit refunds have always gone
//   through. Till reconciliation, close day and every report pick it up
//   with no change, because there is nothing new for them to know about.
//
//   It does not invent a second inventory engine. The stock it restores
//   is `resolveStockDeltas(..., { reverse: true })` over the returned
//   lines, so a version goes back to its version, a batch goes back to
//   its batch and a recipe's components go back to the components.
//
// Everything here is pure. No Firestore, no React.

import { roundMoney } from './currency.js';
import { roundQuantity, DEFAULT_UNIT } from '../industry/units.js';

export const MAX_RETURN_REASON = 200;

/** The line items on a sale, in the one shape the rest of this file uses. */
export function saleLineItems(sale) {
  if (Array.isArray(sale?.items) && sale.items.length > 0) return sale.items;
  // A sale written before carts existed carries its one product on the
  // document itself. Returning those has to work exactly as well.
  if (!sale?.productId) return [];
  return [{
    productId: sale.productId,
    productName: sale.productName,
    quantity: Number(sale.quantity) || 0,
    unitPrice: Number(sale.soldPricePerUnit) || 0,
    costPrice: Number(sale.costPricePerUnit) || 0,
    lineTotal: Number(sale.totalAmount) || 0,
    lineCost: Number(sale.costOfGoodsSold) || 0,
    unit: sale.unit,
    // What the sale recorded moving, carried so a reversal of a one-line
    // sale puts back exactly what the sale took.
    ...(sale.variantId ? { variantId: sale.variantId } : {}),
    ...(Array.isArray(sale.batchAllocations) ? { batchAllocations: sale.batchAllocations } : {}),
    ...(Array.isArray(sale.componentUsage) ? { componentUsage: sale.componentUsage } : {}),
  }];
}

/** How much of each line has already gone back, across earlier returns. */
export function alreadyReturned(sale) {
  const byIndex = {};
  for (const [index, quantity] of Object.entries(sale?.returnedQuantities || {})) {
    const value = Number(quantity) || 0;
    if (value > 0) byIndex[index] = value;
  }
  return byIndex;
}

/**
 * The rows a return screen shows: every line, what it was, and the most
 * that can still come back on it.
 *
 * A line that has already been fully returned has a `returnable` of zero
 * rather than being hidden, because a shop needs to see that it was
 * returned rather than wonder where it went.
 */
export function returnableLines(sale) {
  const returned = alreadyReturned(sale);
  return saleLineItems(sale).map((item, index) => {
    const unit = item.unit || DEFAULT_UNIT;
    const sold = roundQuantity(Number(item.quantity) || 0, unit);
    const already = roundQuantity(Number(returned[index]) || 0, unit);
    return {
      index,
      item,
      unit,
      sold,
      already,
      returnable: roundQuantity(Math.max(0, sold - already), unit),
    };
  });
}

export function isFullyReturned(sale) {
  const lines = returnableLines(sale);
  return lines.length > 0 && lines.every((line) => line.returnable <= 0);
}

/**
 * How much of this sale has come back: 'none', 'partial' or 'full'.
 *
 * The sale history knew this — it hides the Return button once a sale is
 * fully returned — but showed the row as a plain green "Paid" either way,
 * so a cashier counting the till saw a sale marked paid in full that had
 * been half handed back. The status pill needs the middle case, and this
 * is it, derived from the same `returnedQuantities` map everything else
 * on this page reads.
 */
export function returnState(sale) {
  const lines = returnableLines(sale);
  if (lines.length === 0) return 'none';
  if (lines.every((line) => line.returnable <= 0)) return 'full';
  return lines.some((line) => line.already > 0) ? 'partial' : 'none';
}

/**
 * Turn "give me back 2 of line 0 and all of line 1" into the two things a
 * return needs: the rows to reverse through the inventory engine, and the
 * money to hand over.
 *
 * `quantities` is `{ [lineIndex]: quantity }`. Anything not asked for,
 * asked for at zero, or asked for beyond what is left is clamped rather
 * than refused, so a fat-fingered box can never refund more than was
 * paid or restore more stock than left the shop.
 *
 * THREE RULES about the money, each of which used to be broken:
 *
 *   A LINE REFUNDS WHAT WAS PAID FOR IT, not its shelf price. A sale
 *   negotiated from 1,000 down to 800 refunds 800 when fully returned.
 *   The paid figure is the line's `netLineTotal` when the sale recorded
 *   one, and otherwise the line's share of the sale's collected total —
 *   which, for every sale that was never discounted, is its line total.
 *
 *   REFUNDS ARE CUMULATIVE, NOT PER-RETURN. Each return refunds
 *   `paid × returnedSoFar/sold − paid × returnedBefore/sold`, each term
 *   rounded, so however many pieces a line is returned in, the pieces add
 *   up to exactly what was paid for it — never a cent more.
 *
 *   COST FOLLOWS THE BOXES. A batched line's allocations are consumed in
 *   the order they were dispensed, so the Nth unit returned goes back to
 *   the batch the Nth unit came from — a second partial return no longer
 *   restores the first batch again — and its cost is that batch's cost.
 */
export function buildReturn(sale, quantities) {
  const lines = returnableLines(sale);
  const rows = [];
  const items = [];
  const returnedQuantities = { ...alreadyReturned(sale) };
  const paid = paidLineTotals(sale);
  let amount = 0;
  let costOfGoodsSold = 0;

  for (const line of lines) {
    const asked = roundQuantity(Number(quantities?.[line.index]) || 0, line.unit);
    const quantity = roundQuantity(Math.min(Math.max(0, asked), line.returnable), line.unit);
    if (quantity <= 0) continue;

    const from = line.already;
    const to = roundQuantity(line.already + quantity, line.unit);
    const sold = line.sold;

    const linePaid = paid[line.index];
    const lineTotal = roundMoney(
      cumulativeShare(linePaid, to, sold) - cumulativeShare(linePaid, from, sold)
    );

    const allocations = Array.isArray(line.item.batchAllocations) && line.item.batchAllocations.length > 0
      ? line.item.batchAllocations
      : null;
    const lineCost = allocations
      ? roundMoney(
        allocationCostUpTo(allocations, to, line.unit, line.item.costPrice)
        - allocationCostUpTo(allocations, from, line.unit, line.item.costPrice)
      )
      : roundMoney(
        cumulativeShare(lineCostOf(line.item), to, sold) - cumulativeShare(lineCostOf(line.item), from, sold)
      );

    const unitPrice = Number(line.item.unitPrice) || 0;
    const unitCost = quantity > 0 ? roundMoney(lineCost / quantity) : 0;

    // What the inventory engine reverses: the right slice of the batches,
    // and the right slice of the ingredients this line recorded using.
    const row = {
      productId: line.item.productId,
      productName: line.item.productName,
      quantity,
      variantId: line.item.variantId,
      unit: line.item.unit,
      batchAllocations: allocations ? sliceAllocations(allocations, from, to, line.unit) : undefined,
    };
    if (Array.isArray(line.item.componentUsage)) {
      row.componentUsage = scaleUsage(line.item.componentUsage, { sold, from, to });
    } else if (Array.isArray(line.item.modifiers)) {
      // A line sold before usage was recorded is reversed against the
      // current recipe — and its modifiers have to ride along, or the
      // extra shot of espresso is never put back.
      row.modifiers = line.item.modifiers;
    }
    rows.push(row);

    items.push({
      productId: line.item.productId,
      productName: line.item.productName,
      quantity,
      unitPrice,
      costPrice: unitCost,
      lineTotal,
      lineCost,
      ...(line.item.unit && line.item.unit !== DEFAULT_UNIT ? { unit: line.item.unit } : {}),
      ...(line.item.variantId ? { variantId: line.item.variantId, variantLabel: line.item.variantLabel } : {}),
    });

    returnedQuantities[line.index] = to;
    amount = roundMoney(amount + lineTotal);
    costOfGoodsSold = roundMoney(costOfGoodsSold + lineCost);
  }

  return {
    rows,
    items,
    returnedQuantities,
    amount,
    costOfGoodsSold,
    isEmpty: rows.length === 0,
  };
}

/**
 * What each line of a sale actually brought in, by index.
 *
 * A line with `netLineTotal` says so itself. For an older sale whose
 * total was edited at checkout, the lines are allocated the collected
 * total in proportion to their list totals, the last line taking the
 * rounding residual — the same rule allocateSaleTotal() now applies at the
 * moment of sale — so the shares always add up to what was collected.
 */
export function paidLineTotals(sale) {
  const items = saleLineItems(sale);
  if (items.some((item) => Number.isFinite(Number(item?.netLineTotal)))) {
    return items.map((item) => lineNetTotal(item));
  }
  const list = roundMoney(items.reduce((sum, item) => sum + lineListTotal(item), 0));
  const collected = Number(sale?.totalAmount);
  if (!Number.isFinite(collected) || Math.abs(collected - list) < 0.005) {
    return items.map((item) => lineListTotal(item));
  }
  let assigned = 0;
  return items.map((item, index) => {
    const share = index === items.length - 1
      ? roundMoney(collected - assigned)
      : roundMoney(list > 0 ? (lineListTotal(item) / list) * collected : collected / items.length);
    assigned = roundMoney(assigned + share);
    return share;
  });
}

function lineListTotal(item) {
  const stated = Number(item?.lineTotal);
  if (Number.isFinite(stated)) return stated;
  return roundMoney((Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0));
}

function lineNetTotal(item) {
  const net = Number(item?.netLineTotal);
  return Number.isFinite(net) ? net : lineListTotal(item);
}

function lineCostOf(item) {
  const stated = Number(item?.lineCost);
  if (Number.isFinite(stated)) return stated;
  return (Number(item?.costPrice) || 0) * (Number(item?.quantity) || 0);
}

/** `whole × part/sold`, rounded as money; exactly `whole` when part = sold. */
function cumulativeShare(whole, part, sold) {
  const total = Number(whole) || 0;
  if (!(sold > 0) || part <= 0) return 0;
  if (part >= sold) return roundMoney(total);
  return roundMoney((total * part) / sold);
}

/**
 * The cost of the first `upTo` units taken across the allocations. Units
 * beyond what the batches covered — a line sold while batch records were
 * incomplete — carry the line's own cost, not zero.
 */
function allocationCostUpTo(allocations, upTo, unit, fallbackCost = 0) {
  let remaining = roundQuantity(upTo, unit);
  let cost = 0;
  for (const allocation of allocations) {
    if (remaining <= 0) break;
    const available = roundQuantity(Number(allocation?.quantity) || 0, unit);
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    cost += take * (Number(allocation?.costPrice) || 0);
    remaining = roundQuantity(remaining - take, unit);
  }
  if (remaining > 0) cost += remaining * (Number(fallbackCost) || 0);
  return roundMoney(cost);
}

/**
 * The units `from`..`to` of a line, located in the batches they came out
 * of, in dispensing order. Returning units 3–4 of a line that took two
 * from batch A and two from batch B returns them to B.
 */
function sliceAllocations(allocations, from, to, unit) {
  const out = [];
  let cursor = 0;
  for (const allocation of allocations) {
    const size = roundQuantity(Number(allocation?.quantity) || 0, unit);
    if (size <= 0) continue;
    const start = cursor;
    const end = roundQuantity(cursor + size, unit);
    cursor = end;
    const take = roundQuantity(Math.min(end, to) - Math.max(start, from), unit);
    if (take > 0) out.push({ ...allocation, quantity: take });
  }
  return out.length > 0 ? out : undefined;
}

function scaleUsage(usage, { sold, from, to }) {
  if (!(sold > 0)) return [];
  const round3 = (v) => Math.round(((Number(v) || 0) + 1e-9) * 1000) / 1000;
  return usage
    .map((use) => {
      const whole = Number(use?.quantity) || 0;
      const at = (part) => (part >= sold ? round3(whole) : round3((whole * part) / sold));
      return { productId: use.productId, quantity: round3(at(to) - at(from)) };
    })
    .filter((use) => use.quantity !== 0);
}

/**
 * The refund document a return writes.
 *
 * `amount` and `method` are the two fields computeFinancials() has always
 * read, in exactly the same places, so the till reconciliation and the
 * reports need no change at all. Everything else is an ADDITION that
 * lets a shop see what was returned — and `costOfGoodsSold` is the one
 * that makes profit correct, because a credit refund could derive the
 * cost from its credit sale and a cash return has no such document to
 * look at.
 */
export function buildRefundDocument({
  sale, returned, method, reason,
  refundedBy = null, refundedByName = null, at = new Date(),
}) {
  return {
    saleId: sale?.id || null,
    // Absent, not null: a cash return has no credit sale, and the
    // financial engine keys its existing behaviour off this field.
    customerId: sale?.customerId || null,
    customerName: sale?.customerName || null,
    productName: returned.items.length === 1
      ? returned.items[0].productName
      : `${returned.items[0]?.productName ?? 'Return'}${returned.items.length > 1 ? ` +${returned.items.length - 1} more` : ''}`,
    items: returned.items,
    quantity: roundQuantity(
      returned.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0), 'metre'
    ),
    amount: returned.amount,
    // What the returned goods cost. Read by computeFinancials() so a
    // return reverses its own profit rather than only its revenue.
    costOfGoodsSold: returned.costOfGoodsSold,
    method,
    reason: String(reason || '').trim().slice(0, MAX_RETURN_REASON),
    kind: 'sale-return',
    refundedAt: at,
    refundedBy,
    refundedByName,
  };
}
