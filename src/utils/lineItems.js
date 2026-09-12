// src/utils/lineItems.js
//
// The arithmetic of a cart line, in one tested place.
//
// This exists because of hardware shops. FlowBiz has always assumed a
// quantity is a whole number of pieces, and that assumption was spread
// across the counter as `parseInt`, `type="number"` with no step, and
// `quantity * unitPrice` inline in the render. Selling 2.5 m of cable or
// 3.125 kg of nails breaks all three, and it breaks them QUIETLY: an
// input that floors 2.5 to 2 undercharges by 20% and nobody notices for
// a month.
//
// Two rounding rules, and they are not the same rule:
//
//   QUANTITY rounds to the unit's own precision — 3 decimals for metres
//   and kilograms, 0 for pieces. `roundQuantity` in industry/units.js.
//
//   MONEY rounds to 2 decimals, always. `roundMoney` in utils/currency.js.
//
// Applying them in the wrong order is where money goes missing. A line
// total is computed from the ALREADY-ROUNDED quantity, then rounded as
// money — never from a raw float, and never rounded twice.
//
// Everything here is pure. No Firestore, no React, no dates.

import { roundMoney } from './currency.js';
import { tracksOwnStock } from './inventory.js';
import { roundQuantity, unitDecimals, DEFAULT_UNIT, formatQuantityWithUnit } from '../industry/units.js';

/**
 * The unit a product is sold in. A product written before units existed
 * has no `unit` field, and is a piece — which is what it always was.
 */
export function productUnit(product) {
  const unit = product?.unit;
  return typeof unit === 'string' && unit ? unit : DEFAULT_UNIT;
}

/**
 * Coerce whatever came out of a quantity input into a quantity this
 * product can actually be sold in.
 *
 * Pieces floor: half a tin of paint is not a thing the counter should
 * ever silently record. Measured units round to the unit's precision.
 * The result is never negative, and never NaN.
 */
export function normalizeQuantity(raw, unit = DEFAULT_UNIT) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, roundQuantity(value, unit));
}

/** The smallest quantity of this unit that can be sold — one step. */
export function minimumQuantity(unit = DEFAULT_UNIT) {
  const decimals = unitDecimals(unit);
  return decimals === 0 ? 1 : Number((10 ** -decimals).toFixed(decimals));
}

/**
 * Build the stored line item for a cart row.
 *
 * The shape is EXACTLY the one FlowBiz already writes — productId,
 * productName, quantity, unitPrice, costPrice, lineTotal, lineCost,
 * lineProfit, barcode — plus `unit`. Nothing was renamed and nothing was
 * removed, so every existing receipt, report, export and admin inspector
 * reads a new line item exactly as it reads an old one.
 */
export function buildLineItem(row) {
  const unit = row?.unit || DEFAULT_UNIT;
  const quantity = normalizeQuantity(row?.quantity, unit);
  const unitPrice = Math.max(0, Number(row?.unitPrice) || 0);
  const costPrice = Math.max(0, Number(row?.costPrice) || 0);
  const lineTotal = roundMoney(quantity * unitPrice);
  const lineCost = roundMoney(quantity * costPrice);

  const item = {
    productId: row?.productId,
    productName: row?.productName,
    quantity,
    unitPrice,
    costPrice,
    lineTotal,
    lineCost,
    lineProfit: roundMoney(lineTotal - lineCost),
    barcode: row?.barcode || null,
  };
  // Only carried when it says something. A `unit: 'piece'` field on every
  // line of every sale in every shop in the country is pure storage and
  // bandwidth for information the reader already assumes.
  if (unit !== DEFAULT_UNIT) item.unit = unit;
  // Which version was sold, for a product that has versions. Stored on the
  // line rather than derived later, because the option list can change
  // and a receipt from March must still say what left the shop in March.
  if (row?.variantId) {
    item.variantId = row.variantId;
    if (row.variantLabel) item.variantLabel = row.variantLabel;
  }
  // The choices made on this line — "extra cheese", "no onions" — and the
  // note that went with it. Copied onto the line for the same reason the
  // version is: the option list and its prices change, and a receipt has
  // to keep saying what was actually served and what it was charged at.
  //
  // Both are ABSENT when empty, never `[]` or `''`, so a sale from a shop
  // that has never used modifiers is byte-for-byte the document it always
  // was and every existing reader is unaffected.
  if (Array.isArray(row?.modifiers) && row.modifiers.length > 0) item.modifiers = row.modifiers;
  if (row?.note) item.note = String(row.note).slice(0, 200);
  // The pre-modifier price, kept so a receipt can show "Burger 500" with
  // "+ Extra cheese 50" under it rather than an unexplained 550.
  if (row?.basePrice !== undefined && Number(row.basePrice) !== unitPrice) {
    item.basePrice = Math.max(0, Number(row.basePrice) || 0);
  }
  return item;
}

/**
 * "Extra cheese, No onions · no salt" — everything a line says beyond its
 * name, for a receipt line, a kitchen ticket or a cart row. Empty string
 * when the line is a plain one, which is every line in a shop that does
 * not use modifiers.
 */
export function lineItemDetail(item) {
  const parts = [];
  if (item?.variantLabel) parts.push(item.variantLabel);
  const modifiers = Array.isArray(item?.modifiers) ? item.modifiers : [];
  for (const modifier of modifiers) {
    const name = modifier?.name;
    if (name) parts.push(String(name));
  }
  if (item?.note) parts.push(String(item.note));
  return parts.join(', ');
}

/** Sum line totals as money — rounded once, at the end. */
export function sumLineTotals(lineItems) {
  return roundMoney((lineItems || []).reduce((sum, item) => sum + (Number(item?.lineTotal) || 0), 0));
}

export function sumLineCosts(lineItems) {
  return roundMoney((lineItems || []).reduce((sum, item) => sum + (Number(item?.lineCost) || 0), 0));
}

/**
 * Apply a negotiated final checkout total only at the sale-commit boundary.
 *
 * The cart line items and cost-of-goods arithmetic stay untouched. This helper
 * lets the checkout modal override the stored sale total and the derived profit,
 * without touching stock, inventory writes, or the product item structure.
 */
export function applySalePriceOverride({ totalAmount, costOfGoodsSold, finalTotalAmount }) {
  const candidate = Number(finalTotalAmount);
  if (!Number.isFinite(candidate) || candidate < 0 || finalTotalAmount === '' || finalTotalAmount === null || finalTotalAmount === undefined) {
    return {
      totalAmount: roundMoney(totalAmount),
      costOfGoodsSold: roundMoney(costOfGoodsSold),
      profit: roundMoney(roundMoney(totalAmount) - roundMoney(costOfGoodsSold)),
    };
  }

  const normalizedTotal = roundMoney(candidate);
  return {
    totalAmount: normalizedTotal,
    costOfGoodsSold: roundMoney(costOfGoodsSold),
    profit: roundMoney(normalizedTotal - roundMoney(costOfGoodsSold)),
  };
}

/**
 * The legacy `quantity` summary field on a sale document.
 *
 * Adding 2.5 metres to 3 pieces is meaningless, and always was — the
 * field is a rough "how many things" that predates units. It is kept
 * because reports, the activity feed and the admin inspector all read it,
 * and it is rounded to three places so that a mixed-unit sale cannot
 * write 5.500000000000001 into a document.
 */
export function summaryQuantity(lineItems) {
  return roundQuantity((lineItems || []).reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0), 'metre');
}

/**
 * How a quantity should read on a receipt, a table row or an activity
 * line. A sale of one product in a real unit shows that unit; anything
 * else shows the plain number, exactly as it always did.
 */
export function saleQuantityLabel(sale) {
  const items = Array.isArray(sale?.items) ? sale.items : null;
  if (items && items.length === 1) {
    return formatQuantityWithUnit(items[0].quantity, items[0].unit);
  }
  if (!items && sale?.unit) {
    return formatQuantityWithUnit(sale.quantity, sale.unit);
  }
  const stored = Number(sale?.quantity);
  // A multi-line sale falls back to its own summary field, and derives one
  // from the lines if the caller handed over a record that has not been
  // stamped with it yet.
  const quantity = Number.isFinite(stored) ? stored : summaryQuantity(items);
  return String(roundQuantity(quantity, 'metre'));
}

/**
 * Check a cart against live stock. Returns the first problem as a
 * message, or null. Kept as a pure function so the same rule can be
 * tested and reused by the counter, the order screen and anything else
 * that turns a cart into a sale.
 */
export function validateAgainstStock(rows, products, { allowNegative = false } = {}) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  // Two rows of the same product — two sizes of the same shirt, say —
  // must be checked against the shared figure TOGETHER. Checking them one
  // at a time would happily sell 3 + 3 of something there are 4 of.
  const wantedTotal = new Map();

  for (const row of rows || []) {
    const product = byId.get(row?.productId);
    if (!product) return `${row?.productName || 'That product'} is no longer available.`;
    // A service has nothing to run out of, and neither does a dish
    // assembled to order — its ingredients do, and those are checked by
    // validateComponentStock in utils/inventory.js.
    if (allowNegative || !tracksOwnStock(product)) continue;

    const unit = productUnit(product);
    const wanted = normalizeQuantity(row?.quantity, unit);
    if (wanted <= 0) continue;

    // A version carries its own stock; the parent's `stock` is their sum.
    const key = row.variantId ? `${product.id}::${row.variantId}` : product.id;
    const runningTotal = roundQuantity((wantedTotal.get(key) || 0) + wanted, unit);
    wantedTotal.set(key, runningTotal);

    const available = row.variantId
      ? roundQuantity(Number(product.variantStock?.[row.variantId]) || 0, unit)
      : roundQuantity(Number(product.stock) || 0, unit);

    if (runningTotal > available) {
      const label = row.variantLabel ? `${product.name} (${row.variantLabel})` : product.name;
      return `Only ${formatQuantityWithUnit(available, unit, { showPiece: true })} of ${label} left in stock.`;
    }
  }
  return null;
}
