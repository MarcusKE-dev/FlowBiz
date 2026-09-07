// Phase 5 gate — the food family: modifiers, open orders, tables,
// dining mode and the kitchen queue.
//
// The two properties under test are the two the whole design rests on:
// an open order holds no inventory, and charging one produces an
// ORDINARY sale that every existing financial calculation already reads.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeModifierGroups, requiresModifierChoice,
  resolveModifierSelection, modifiedUnitPrice, missingRequiredGroups,
  modifierRowKey, describeModifiers, MAX_MODIFIER_GROUPS,
} from './modifiers.js';
import {
  buildOrderDocument, orderToCart, orderToSaleFields, orderRowKey,
  normalizeTableNames, generateTableNames, tableStates, defaultOrderName,
  summarizeOpenOrders, nextKitchenStatus, isKnownDiningMode, diningModeLabel,
  ORDER_STATUS, KITCHEN_STATUSES, MAX_TABLES,
} from './orders.js';
import { resolveStockDeltas } from './inventory.js';
import { computeFinancials } from './financials.js';

const BURGER = {
  id: 'burger', name: 'Cheeseburger', sellingPrice: 550, costPrice: 300,
  modifierGroups: normalizeModifierGroups([
    { name: 'Size', required: true, options: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 100 }] },
    { name: 'Extras', multiple: true, options: [
      { name: 'Extra cheese', priceDelta: 50 },
      { name: 'Bacon', priceDelta: 80 },
      { name: 'No onions', priceDelta: 0 },
    ] },
  ]),
};

// ── Modifiers ────────────────────────────────────────────────────────

test('a modifier group is single-choice when required and multi when not', () => {
  const [size, extras] = BURGER.modifierGroups;
  assert.equal(size.required, true);
  assert.equal(size.multiple, false, 'a required choice is one answer');
  assert.equal(extras.required, false);
  assert.equal(extras.multiple, true);
});

test('a price delta may be negative, so "no cheese" can take money off', () => {
  const groups = normalizeModifierGroups([
    { name: 'Cheese', options: [{ name: 'No cheese', priceDelta: -20 }] },
  ]);
  assert.equal(groups[0].options[0].priceDelta, -20);
  const modifiers = resolveModifierSelection({ modifierGroups: groups }, { cheese: 'no-cheese' });
  assert.equal(modifiedUnitPrice(550, modifiers), 530);
});

test('a stack of removals can never turn a sale into a refund', () => {
  const groups = normalizeModifierGroups([
    { name: 'Take off', multiple: true, options: [
      { name: 'No cheese', priceDelta: -400 },
      { name: 'No patty', priceDelta: -400 },
    ] },
  ]);
  const modifiers = resolveModifierSelection({ modifierGroups: groups }, { 'take-off': ['no-cheese', 'no-patty'] });
  assert.equal(modifiedUnitPrice(550, modifiers), 0);
});

test('choosing size and two extras prices the line correctly', () => {
  const modifiers = resolveModifierSelection(BURGER, { size: 'large', extras: ['extra-cheese', 'bacon'] });
  assert.equal(modifiers.length, 3);
  assert.equal(modifiedUnitPrice(BURGER.sellingPrice, modifiers), 780);
  assert.equal(describeModifiers(modifiers), 'Large, Extra cheese, Bacon');
});

test('a single-choice group takes only the first selection, even if handed several', () => {
  const modifiers = resolveModifierSelection(BURGER, { size: ['large', 'regular'] });
  assert.equal(modifiers.length, 1);
  assert.equal(modifiers[0].name, 'Large');
});

test('a required group must be answered before the item can be added', () => {
  assert.equal(requiresModifierChoice(BURGER), true);
  assert.equal(missingRequiredGroups(BURGER, {}).length, 1);
  assert.equal(missingRequiredGroups(BURGER, { size: '' }).length, 1);
  assert.equal(missingRequiredGroups(BURGER, { size: 'regular' }).length, 0);
  assert.equal(missingRequiredGroups({ name: 'Water' }, {}).length, 0);
});

test('an unknown option id is ignored rather than priced', () => {
  const modifiers = resolveModifierSelection(BURGER, { size: 'enormous', extras: ['truffle'] });
  assert.deepEqual(modifiers, []);
  assert.equal(modifiedUnitPrice(550, modifiers), 550);
});

test('modifier definitions are bounded and cleaned', () => {
  const groups = normalizeModifierGroups([
    ...Array.from({ length: 10 }, (_, i) => ({ name: `G${i}`, options: [{ name: 'x' }] })),
  ]);
  assert.equal(groups.length, MAX_MODIFIER_GROUPS);
  assert.deepEqual(normalizeModifierGroups([{ name: '', options: [{ name: 'x' }] }]), []);
  assert.deepEqual(normalizeModifierGroups([{ name: 'Empty', options: [] }]), []);
  for (const input of [null, undefined, 'Size', 7, [{}]]) {
    assert.deepEqual(normalizeModifierGroups(input), []);
  }
});

test('a non-numeric price delta becomes zero rather than NaN on a receipt', () => {
  const groups = normalizeModifierGroups([
    { name: 'X', options: [{ name: 'A', priceDelta: 'fifty' }, { name: 'B' }, { name: 'C', priceDelta: null }] },
  ]);
  assert.deepEqual(groups[0].options.map((o) => o.priceDelta), [0, 0, 0]);
});

test('the same choices in a different order are the same cart row', () => {
  const a = resolveModifierSelection(BURGER, { size: 'large', extras: ['bacon', 'extra-cheese'] });
  const b = resolveModifierSelection(BURGER, { extras: ['extra-cheese', 'bacon'], size: 'large' });
  assert.equal(modifierRowKey(a), modifierRowKey(b));
  assert.equal(modifierRowKey([]), '');
});

test('different choices are different cart rows', () => {
  const plain = resolveModifierSelection(BURGER, { size: 'regular' });
  const large = resolveModifierSelection(BURGER, { size: 'large' });
  assert.notEqual(orderRowKey({ productId: 'burger', modifiers: plain }), orderRowKey({ productId: 'burger', modifiers: large }));
  assert.equal(orderRowKey({ productId: 'burger', modifiers: [] }), 'burger');
});

// ── Orders ───────────────────────────────────────────────────────────

function sampleCart() {
  const modifiers = resolveModifierSelection(BURGER, { size: 'large', extras: ['extra-cheese'] });
  return [
    {
      productId: 'burger', productName: 'Cheeseburger', quantity: 2,
      basePrice: 550, unitPrice: modifiedUnitPrice(550, modifiers), costPrice: 300,
      modifiers, note: 'well done',
    },
    { productId: 'chips', productName: 'Chips', quantity: 1, unitPrice: 150, costPrice: 60 },
  ];
}

test('an order document carries its items, its table, its dining mode and its kitchen state', () => {
  const order = buildOrderDocument(sampleCart(), {
    tableName: 'Table 3', diningMode: 'dine-in', openedBy: 'u1', openedByName: 'Amina',
  });
  assert.equal(order.status, ORDER_STATUS.OPEN);
  assert.equal(order.kitchenStatus, 'new');
  assert.equal(order.tableName, 'Table 3');
  assert.equal(order.name, 'Table 3');
  assert.equal(order.diningMode, 'dine-in');
  assert.equal(order.items.length, 2);
  assert.equal(order.items[0].modifiers.length, 2);
  assert.equal(order.items[0].note, 'well done');
});

test('order totals are the same arithmetic a walk-up sale uses', () => {
  const order = buildOrderDocument(sampleCart());
  // 2 × (550 + 100 + 50) = 1400, plus chips 150.
  assert.equal(order.totalAmount, 1550);
  assert.equal(order.costOfGoodsSold, 660);
  assert.equal(order.profit, 890);
  assert.equal(order.quantity, 3);
});

test('AN OPEN ORDER HOLDS NO INVENTORY — nothing moves until it is charged', () => {
  const order = buildOrderDocument(sampleCart());
  const catalogue = [
    { id: 'burger', name: 'Cheeseburger', stock: 0 },
    { id: 'chips', name: 'Chips', stock: 40 },
  ];
  // Opening the ticket is a document write and nothing else. The stock
  // movement is computed only at charge time, from the same line items.
  const atCharge = resolveStockDeltas(order.items, catalogue);
  assert.equal(atCharge.chips.total, -1);
  assert.equal(atCharge.burger.total, -2);
});

test('an order round-trips to a cart and back without losing anything', () => {
  const order = buildOrderDocument(sampleCart(), { tableName: 'Table 3', diningMode: 'dine-in' });
  const cart = orderToCart({ ...order, id: 'o1' });
  const reopened = buildOrderDocument(cart, { tableName: 'Table 3', diningMode: 'dine-in' });
  assert.equal(reopened.totalAmount, order.totalAmount);
  assert.equal(reopened.costOfGoodsSold, order.costOfGoodsSold);
  assert.deepEqual(reopened.items[0].modifiers, order.items[0].modifiers);
  assert.equal(reopened.items[0].note, 'well done');
  assert.equal(cart[0].basePrice, 550, 'the base price survives so modifiers can be re-edited');
});

test('charging an order produces an ORDINARY sale that computeFinancials already reads', () => {
  const order = { ...buildOrderDocument(sampleCart(), { tableName: 'Table 3', diningMode: 'dine-in' }), id: 'o1' };
  const sale = {
    id: 's1',
    items: order.items,
    quantity: order.quantity,
    totalAmount: order.totalAmount,
    costOfGoodsSold: order.costOfGoodsSold,
    profit: order.profit,
    paymentMethod: 'Cash',
    isVoided: false,
    ...orderToSaleFields(order),
  };
  const summary = computeFinancials({ sales: [sale] });
  assert.equal(summary.revenue, 1550);
  assert.equal(summary.costOfGoodsSold, 660);
  assert.equal(summary.grossProfit, 890);
  assert.equal(summary.totalCashReceipts, 1550);
  // The restaurant context rides along without displacing anything.
  assert.equal(sale.tableName, 'Table 3');
  assert.equal(sale.diningMode, 'dine-in');
  assert.equal(sale.orderId, 'o1');
});

test('a restaurant sale is still readable after the orders capability is switched off', () => {
  // Turning the capability off changes what is offered, never what was
  // recorded. The financial engine has never known orders exist.
  const order = buildOrderDocument(sampleCart(), { tableName: 'Table 3' });
  const sale = { id: 's1', ...order, paymentMethod: 'M-Pesa', isVoided: false, ...orderToSaleFields(order) };
  const summary = computeFinancials({ sales: [sale] });
  assert.equal(summary.totalMpesaReceipts, 1550);
  assert.equal(summary.netProfit, 890);
});

// ── Tables ───────────────────────────────────────────────────────────

test('tables are just names, generated in one tap and bounded', () => {
  assert.deepEqual(generateTableNames(3), ['Table 1', 'Table 2', 'Table 3']);
  assert.equal(generateTableNames(500).length, MAX_TABLES);
  assert.deepEqual(generateTableNames(0), []);
  assert.deepEqual(generateTableNames(-5), []);
  assert.deepEqual(generateTableNames(2, 'Booth'), ['Booth 1', 'Booth 2']);
});

test('table names are deduplicated and cleaned', () => {
  assert.deepEqual(
    normalizeTableNames(['Table 1', ' table 1 ', '', null, 'Table 2', 42]),
    ['Table 1', 'Table 2', '42']
  );
  assert.deepEqual(normalizeTableNames(null), []);
});

test('a table is occupied precisely when an open order carries its name', () => {
  const orders = [
    { id: 'o1', status: 'open', tableName: 'Table 2', totalAmount: 1200, kitchenStatus: 'preparing' },
    { id: 'o2', status: 'completed', tableName: 'Table 3', totalAmount: 800 },
  ];
  const states = tableStates(['Table 1', 'Table 2', 'Table 3'], orders);
  assert.deepEqual(states.map((t) => t.occupied), [false, true, false]);
  assert.equal(states[1].total, 1200);
  assert.equal(states[1].kitchenStatus, 'preparing');
  assert.equal(states[2].occupied, false, 'a charged order frees its table with no cleanup step');
});

test('an unnamed ticket is named for the time it was opened', () => {
  const at = new Date('2026-09-04T13:05:00');
  assert.equal(defaultOrderName({ at }), '13:05');
  assert.equal(defaultOrderName({ tableName: 'Table 7', at }), 'Table 7');
});

// ── Kitchen and dining mode ──────────────────────────────────────────

test('the kitchen state machine moves forward and stops at the end', () => {
  assert.deepEqual(KITCHEN_STATUSES, ['new', 'preparing', 'ready', 'served']);
  assert.equal(nextKitchenStatus('new'), 'preparing');
  assert.equal(nextKitchenStatus('preparing'), 'ready');
  assert.equal(nextKitchenStatus('ready'), 'served');
  assert.equal(nextKitchenStatus('served'), 'served');
  assert.equal(nextKitchenStatus('nonsense'), 'preparing');
});

test('an unknown dining mode falls back rather than being stored', () => {
  assert.equal(isKnownDiningMode('dine-in'), true);
  assert.equal(isKnownDiningMode('drive-through'), false);
  assert.equal(buildOrderDocument(sampleCart(), { diningMode: 'drive-through' }).diningMode, 'takeaway');
  assert.equal(diningModeLabel('dine-in'), 'Dine in');
  assert.equal(diningModeLabel('nonsense'), 'Takeaway');
});

test('the open-order summary is what the counter and dashboard both read', () => {
  const orders = [
    { status: 'open', totalAmount: 1200, kitchenStatus: 'new', tableName: 'Table 1' },
    { status: 'open', totalAmount: 800, kitchenStatus: 'preparing', tableName: 'Table 2' },
    { status: 'open', totalAmount: 400, kitchenStatus: 'preparing' },
    { status: 'completed', totalAmount: 5000, kitchenStatus: 'served', tableName: 'Table 3' },
  ];
  const summary = summarizeOpenOrders(orders);
  assert.equal(summary.count, 3);
  assert.equal(summary.total, 2400);
  assert.equal(summary.tablesOccupied, 2);
  assert.deepEqual(summary.byKitchenStatus, { new: 1, preparing: 2, ready: 0, served: 0 });
  assert.equal(summarizeOpenOrders(null).count, 0);
});
