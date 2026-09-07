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
 * The money is worked out from the line's OWN unit price and cost, not
 * from a proportion of the sale total. A three-line sale where one line
 * is returned must refund that line's price exactly, and reverse that
 * line's cost exactly — proportioning would be wrong the moment the lines
 * have different margins, which is every sale in a real shop.
 */
export function buildReturn(sale, quantities) {
  const lines = returnableLines(sale);
  const rows = [];
  const items = [];
  const returnedQuantities = { ...alreadyReturned(sale) };
  let amount = 0;
  let costOfGoodsSold = 0;

  for (const line of lines) {
    const asked = roundQuantity(Number(quantities?.[line.index]) || 0, line.unit);
    const quantity = roundQuantity(Math.min(Math.max(0, asked), line.returnable), line.unit);
    if (quantity <= 0) continue;

    const unitPrice = Number(line.item.unitPrice) || 0;
    const unitCost = Number(line.item.costPrice) || 0;
    const lineTotal = roundMoney(quantity * unitPrice);
    const lineCost = roundMoney(quantity * unitCost);

    // What the inventory engine reverses. The batch allocations ride
    // along so a partial return of a batched line goes back to the very
    // boxes it came out of — scaled to the quantity actually returned,
    // earliest batch first, which is the order it was taken in.
    rows.push({
      productId: line.item.productId,
      productName: line.item.productName,
      quantity,
      variantId: line.item.variantId,
      unit: line.item.unit,
      batchAllocations: scaleAllocations(line.item.batchAllocations, quantity, line.unit),
    });

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

    returnedQuantities[line.index] = roundQuantity(line.already + quantity, line.unit);
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
 * Spread a partial return across the batches the line was taken from,
 * earliest first — the same order FEFO dispensed them in, so returning
 * two of five puts them back where the first two came from.
 *
 * Returns null when the line had no batch allocation, which is every line
 * in a shop that does not track batches.
 */
function scaleAllocations(allocations, quantity, unit) {
  if (!Array.isArray(allocations) || allocations.length === 0) return undefined;
  const out = [];
  let remaining = roundQuantity(quantity, unit);
  for (const allocation of allocations) {
    if (remaining <= 0) break;
    const available = roundQuantity(Number(allocation?.quantity) || 0, unit);
    if (available <= 0) continue;
    const take = roundQuantity(Math.min(available, remaining), unit);
    out.push({ ...allocation, quantity: take });
    remaining = roundQuantity(remaining - take, unit);
  }
  return out.length > 0 ? out : undefined;
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
