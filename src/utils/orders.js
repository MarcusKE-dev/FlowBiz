// src/utils/orders.js
//
// Open orders — a saved, unpaid, reopenable ticket. The food family's
// central primitive, and the one thing a retail POS genuinely does not
// have.
//
// THE DESIGN DECISION THAT MATTERS: an open order holds NO INVENTORY.
// Stock moves when the order is charged, in the same write batch that
// creates the sale, exactly as a walk-up cart sale does today. The
// alternative — reserving stock when a ticket is opened — needs a
// reservation ledger, a release path for every abandoned ticket, and a
// reconciliation job for the ones that are never released. A busy
// restaurant abandons tickets constantly. It is the wrong trade for the
// scale FlowBiz serves.
//
// The second decision: charging an order writes an ORDINARY SALE. Not a
// parallel record type, not an order-shaped sale. The same `sales`
// document, the same fields, the same `computeFinancials()`. That is what
// keeps reports, close-day, the admin inspector, exports and every
// financial calculation in the product working for a restaurant without a
// single change — and it is why turning `orders` off later leaves a
// restaurant's whole trading history perfectly readable.
//
// Tables are predefined ticket NAMES on the settings document, not a
// floor plan and not a collection. That is how Loyverse models them, it
// is what the brief asked for, and it means enabling tables costs zero
// reads and zero new documents.

import { roundMoney } from './currency.js';
import { buildLineItem, sumLineTotals, sumLineCosts, summaryQuantity } from './lineItems.js';
import { modifierRowKey } from './modifiers.js';

export const ORDER_STATUS = { OPEN: 'open', COMPLETED: 'completed', CANCELLED: 'cancelled' };

// A deliberately short kitchen state machine. Four states is what a
// kitchen actually signals; anything more is a screen nobody updates.
export const KITCHEN_STATUSES = ['new', 'preparing', 'ready', 'served'];
export const KITCHEN_LABELS = {
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
};

export const DINING_MODES = [
  { id: 'dine-in',  label: 'Dine in'  },
  { id: 'takeaway', label: 'Takeaway' },
  { id: 'delivery', label: 'Delivery' },
];
export const DEFAULT_DINING_MODE = 'takeaway';

export function isKnownDiningMode(value) {
  return DINING_MODES.some((mode) => mode.id === value);
}

export function diningModeLabel(value) {
  return DINING_MODES.find((mode) => mode.id === value)?.label || 'Takeaway';
}

export function nextKitchenStatus(current) {
  const index = KITCHEN_STATUSES.indexOf(current);
  if (index < 0) return KITCHEN_STATUSES[1];
  return KITCHEN_STATUSES[Math.min(index + 1, KITCHEN_STATUSES.length - 1)];
}

/**
 * The cart row key for a food line. Two burgers with different modifiers
 * are two rows; two identical burgers are one row of quantity two.
 */
export function orderRowKey({ productId, variantId, modifiers }) {
  return [productId, variantId || '', modifierRowKey(modifiers)].filter(Boolean).join('::');
}

/**
 * Table names, cleaned. Stored on businessSettings as a plain list of
 * labels — there is no table document, no status field and no floor plan.
 * A table is "occupied" precisely when an open order carries its name,
 * which is derived, cannot drift, and needs no cleanup.
 */
export const MAX_TABLES = 100;

export function normalizeTableNames(raw) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(raw) ? raw : []) {
    if (out.length >= MAX_TABLES) break;
    const name = String(value ?? '').trim().slice(0, 24);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** "Table 1" … "Table N", for the one-tap setup a new restaurant wants. */
export function generateTableNames(count, prefix = 'Table') {
  const total = Math.min(MAX_TABLES, Math.max(0, Math.floor(Number(count) || 0)));
  return Array.from({ length: total }, (_, i) => `${prefix} ${i + 1}`);
}

/**
 * The state of each table, derived entirely from the open orders. Nothing
 * is stored, so nothing can be stale, and clearing a table is simply
 * charging or cancelling its order.
 */
export function tableStates(tableNames, openOrders) {
  const byTable = new Map();
  for (const order of openOrders || []) {
    if (order?.status !== ORDER_STATUS.OPEN || !order.tableName) continue;
    byTable.set(order.tableName, order);
  }
  return normalizeTableNames(tableNames).map((name) => {
    const order = byTable.get(name);
    return {
      name,
      order: order || null,
      occupied: Boolean(order),
      total: order ? Number(order.totalAmount) || 0 : 0,
      kitchenStatus: order?.kitchenStatus || null,
    };
  });
}

/** A ticket's default name: its table, or the time it was opened. */
export function defaultOrderName({ tableName, at = new Date() } = {}) {
  if (tableName) return tableName;
  const date = at instanceof Date ? at : new Date(at);
  return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Build the stored order document from a cart. Deliberately the same line
 * items a sale stores, so charging is a copy rather than a translation.
 */
export function buildOrderDocument(cart, {
  tableName = null,
  diningMode = DEFAULT_DINING_MODE,
  name = null,
  note = '',
  kitchenStatus = 'new',
  openedBy = null,
  openedByName = null,
  at = new Date(),
} = {}) {
  // buildLineItem now carries modifiers, the note and the pre-modifier
  // price itself, so an open ticket and the sale it becomes are built by
  // exactly the same function — which is what stopped a direct sale
  // losing the choices a saved order kept.
  const items = (cart || []).map(buildLineItem);

  const totalAmount = sumLineTotals(items);
  const costOfGoodsSold = sumLineCosts(items);

  return {
    items,
    productName: items.length === 1 ? items[0].productName : `${items[0]?.productName ?? 'Order'}${items.length > 1 ? ` +${items.length - 1} more` : ''}`,
    quantity: summaryQuantity(items),
    totalAmount,
    costOfGoodsSold,
    profit: roundMoney(totalAmount - costOfGoodsSold),
    name: name || defaultOrderName({ tableName, at }),
    tableName: tableName || null,
    diningMode: isKnownDiningMode(diningMode) ? diningMode : DEFAULT_DINING_MODE,
    status: ORDER_STATUS.OPEN,
    kitchenStatus: KITCHEN_STATUSES.includes(kitchenStatus) ? kitchenStatus : 'new',
    note: String(note || '').slice(0, 300),
    openedBy,
    openedByName,
    openedAt: at,
    updatedAt: at,
  };
}

/** Turn a stored order back into editable cart rows. */
export function orderToCart(order) {
  return (order?.items || []).map((item) => ({
    rowKey: orderRowKey({ productId: item.productId, variantId: item.variantId, modifiers: item.modifiers }),
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    basePrice: item.basePrice ?? item.unitPrice,
    costPrice: item.costPrice,
    barcode: item.barcode || null,
    unit: item.unit,
    variantId: item.variantId,
    variantLabel: item.variantLabel,
    modifiers: item.modifiers || [],
    note: item.note || '',
  }));
}

/**
 * The sale document an order becomes when it is charged.
 *
 * The order's own fields ride along so a restaurant's sales history can
 * still say which table it was and whether it was eaten in — but they are
 * ADDITIONS to the existing sale shape, never replacements. Every field
 * `computeFinancials()` reads is exactly where it has always been.
 */
export function orderToSaleFields(order) {
  const fields = {};
  if (order?.id) fields.orderId = order.id;
  if (order?.name) fields.orderName = order.name;
  if (order?.tableName) fields.tableName = order.tableName;
  if (order?.diningMode) fields.diningMode = order.diningMode;
  if (order?.note) fields.orderNote = order.note;
  return fields;
}

/** Totals across the open tickets, for the counter and the dashboard. */
export function summarizeOpenOrders(orders) {
  const open = (orders || []).filter((o) => o?.status === ORDER_STATUS.OPEN);
  return {
    count: open.length,
    total: roundMoney(open.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)),
    byKitchenStatus: KITCHEN_STATUSES.reduce((acc, status) => {
      acc[status] = open.filter((o) => (o.kitchenStatus || 'new') === status).length;
      return acc;
    }, {}),
    tablesOccupied: new Set(open.map((o) => o.tableName).filter(Boolean)).size,
  };
}
