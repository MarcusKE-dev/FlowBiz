// Phase 3 gate — decimal and measured quantities.
//
// The brief's instruction for Hardware is "do not proceed until quantity
// accuracy is demonstrated". This file is that demonstration: the exact
// arithmetic a hardware sale performs, against the exact rounding rules,
// including the floating-point cases that would otherwise silently steal
// or invent money.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLineItem, normalizeQuantity, minimumQuantity, productUnit,
  sumLineTotals, sumLineCosts, summaryQuantity, saleQuantityLabel,
  validateAgainstStock, lineItemDetail,
} from './lineItems.js';
import { buildOrderDocument } from './orders.js';
import { roundMoney } from './currency.js';
import { roundQuantity } from '../industry/units.js';

// ── The piece workflow must be bit-for-bit what it always was ────────

test('a product with no unit field is a piece, exactly as before units existed', () => {
  assert.equal(productUnit({ name: 'Sukari' }), 'piece');
  assert.equal(productUnit({ name: 'Sukari', unit: null }), 'piece');
  assert.equal(productUnit({ name: 'Sukari', unit: '' }), 'piece');
  assert.equal(productUnit(null), 'piece');
});

test('a piece line item is identical to the pre-units shape, with no unit field added', () => {
  const item = buildLineItem({
    productId: 'p1', productName: 'Sukari 1kg', quantity: 3,
    unitPrice: 150, costPrice: 120, barcode: '600123',
  });
  assert.deepEqual(item, {
    productId: 'p1', productName: 'Sukari 1kg', quantity: 3,
    unitPrice: 150, costPrice: 120,
    lineTotal: 450, lineCost: 360, lineProfit: 90,
    barcode: '600123',
  });
  assert.equal('unit' in item, false, 'piece must not add a field to every line in the country');
});

test('a fractional quantity in pieces floors — half a tin is not a sale', () => {
  assert.equal(normalizeQuantity(2.7, 'piece'), 2);
  assert.equal(normalizeQuantity(0.5, 'piece'), 0);
  assert.equal(buildLineItem({ quantity: 2.9, unitPrice: 100, costPrice: 0 }).lineTotal, 200);
});

// ── Measured quantities ──────────────────────────────────────────────

test('2.5 metres of cable at 120/m is 300, not 299.99999999999994', () => {
  const item = buildLineItem({ productName: 'Cable', quantity: 2.5, unitPrice: 120, costPrice: 80, unit: 'metre' });
  assert.equal(item.quantity, 2.5);
  assert.equal(item.unit, 'metre');
  assert.equal(item.lineTotal, 300);
  assert.equal(item.lineCost, 200);
  assert.equal(item.lineProfit, 100);
});

test('3.5 kilograms of nails at 185/kg is 647.50 to the cent', () => {
  const item = buildLineItem({ productName: 'Nails', quantity: 3.5, unitPrice: 185, costPrice: 140, unit: 'kilogram' });
  assert.equal(item.lineTotal, 647.5);
  assert.equal(item.lineCost, 490);
  assert.equal(item.lineProfit, 157.5);
});

test('8 feet of timber prices exactly, and 0.1 + 0.2 metres is 0.3', () => {
  assert.equal(buildLineItem({ quantity: 8, unitPrice: 45, costPrice: 30, unit: 'foot' }).lineTotal, 360);
  assert.equal(normalizeQuantity(0.1 + 0.2, 'metre'), 0.3);
});

test('a price that lands on a third of a cent is rounded once, as money', () => {
  // 0.333 kg at 33.33/kg = 11.098... -> 11.10
  const item = buildLineItem({ quantity: 1 / 3, unitPrice: 33.33, costPrice: 0, unit: 'kilogram' });
  assert.equal(item.quantity, 0.333);
  assert.equal(item.lineTotal, roundMoney(0.333 * 33.33));
  assert.equal(item.lineTotal, 11.1);
});

test('quantity precision follows the unit, not a global setting', () => {
  assert.equal(buildLineItem({ quantity: 1.23456, unitPrice: 10, unit: 'metre' }).quantity, 1.235);
  assert.equal(buildLineItem({ quantity: 1.23456, unitPrice: 10, unit: 'foot' }).quantity, 1.23);
  assert.equal(buildLineItem({ quantity: 1.23456, unitPrice: 10, unit: 'gram' }).quantity, 1.2);
  assert.equal(buildLineItem({ quantity: 1.23456, unitPrice: 10, unit: 'piece' }).quantity, 1);
});

test('the smallest sellable quantity is one step of the unit', () => {
  assert.equal(minimumQuantity('piece'), 1);
  assert.equal(minimumQuantity('metre'), 0.001);
  assert.equal(minimumQuantity('foot'), 0.01);
  assert.equal(minimumQuantity('gram'), 0.1);
  assert.equal(minimumQuantity(), 1);
});

// ── Hostile and malformed input ──────────────────────────────────────

test('a negative, zero, empty or nonsense quantity becomes zero, never NaN', () => {
  for (const raw of [-5, -0.5, 0, '', null, undefined, NaN, 'abc', Infinity, -Infinity, {}]) {
    assert.equal(normalizeQuantity(raw, 'metre'), 0, `${JSON.stringify(raw)}`);
    const item = buildLineItem({ quantity: raw, unitPrice: 100, costPrice: 50, unit: 'metre' });
    assert.equal(item.quantity, 0);
    assert.equal(item.lineTotal, 0);
    assert.ok(Number.isFinite(item.lineProfit));
  }
});

test('a negative price cannot be entered into a line total', () => {
  const item = buildLineItem({ quantity: 2, unitPrice: -100, costPrice: -50, unit: 'metre' });
  assert.equal(item.unitPrice, 0);
  assert.equal(item.costPrice, 0);
  assert.equal(item.lineTotal, 0);
});

test('an unknown unit is treated as a piece rather than breaking the sale', () => {
  const item = buildLineItem({ quantity: 2.6, unitPrice: 100, unit: 'furlong' });
  assert.equal(item.quantity, 2);
  assert.equal(item.lineTotal, 200);
});

// ── Cart totals ──────────────────────────────────────────────────────

test('a mixed-unit cart totals to the cent', () => {
  const lines = [
    buildLineItem({ productName: 'Cable',  quantity: 2.5,   unitPrice: 120,   costPrice: 80,  unit: 'metre' }),
    buildLineItem({ productName: 'Nails',  quantity: 3.5,   unitPrice: 185,   costPrice: 140, unit: 'kilogram' }),
    buildLineItem({ productName: 'Timber', quantity: 8,     unitPrice: 45,    costPrice: 30,  unit: 'foot' }),
    buildLineItem({ productName: 'Pipe',   quantity: 4,     unitPrice: 320,   costPrice: 250 }),
  ];
  assert.equal(sumLineTotals(lines), 300 + 647.5 + 360 + 1280);
  assert.equal(sumLineCosts(lines), 200 + 490 + 240 + 1000);
  assert.equal(roundMoney(sumLineTotals(lines) - sumLineCosts(lines)), 657.5);
});

test('accumulating a hundred awkward decimal lines does not drift by a cent', () => {
  const lines = Array.from({ length: 100 }, () =>
    buildLineItem({ quantity: 0.1, unitPrice: 0.1, costPrice: 0.05, unit: 'metre' })
  );
  // 100 lines of 0.1 m at 0.10/m: each line rounds to 0.01, so 1.00.
  assert.equal(sumLineTotals(lines), 1);
  assert.equal(sumLineCosts(lines), 1, '0.005 rounds up to 0.01 per line, consistently');
});

test('the legacy summary quantity never writes floating-point noise', () => {
  const lines = [
    buildLineItem({ quantity: 0.1, unitPrice: 1, unit: 'metre' }),
    buildLineItem({ quantity: 0.2, unitPrice: 1, unit: 'metre' }),
  ];
  assert.equal(summaryQuantity(lines), 0.3);
  assert.equal(summaryQuantity([]), 0);
  assert.equal(summaryQuantity(null), 0);
});

// ── Display ──────────────────────────────────────────────────────────

test('a one-line sale reads in its own unit; anything else reads as a number', () => {
  assert.equal(saleQuantityLabel({ items: [{ quantity: 2.5, unit: 'metre' }] }), '2.5 m');
  assert.equal(saleQuantityLabel({ items: [{ quantity: 3 }] }), '3');
  assert.equal(saleQuantityLabel({ items: [{ quantity: 1, unit: 'metre' }, { quantity: 2 }] }), '3');
});

test('a legacy sale document with no items array still reads correctly', () => {
  assert.equal(saleQuantityLabel({ quantity: 4, productName: 'Sukari' }), '4');
  assert.equal(saleQuantityLabel({ quantity: 2.5, unit: 'metre' }), '2.5 m');
  assert.equal(saleQuantityLabel({}), '0');
  assert.equal(saleQuantityLabel(null), '0');
});

// ── Stock validation ─────────────────────────────────────────────────

const CABLE = { id: 'c', name: 'Cable', unit: 'metre', stock: 12.5 };
const TIN = { id: 't', name: 'Paint 4L', stock: 3 };

test('a decimal quantity is checked against decimal stock', () => {
  assert.equal(validateAgainstStock([{ productId: 'c', quantity: 12.5 }], [CABLE]), null);
  assert.equal(validateAgainstStock([{ productId: 'c', quantity: 12.499 }], [CABLE]), null);
  assert.match(validateAgainstStock([{ productId: 'c', quantity: 12.501 }], [CABLE]), /Only 12.5 m of Cable/);
});

test('selling the exact remaining stock is allowed; one step more is not', () => {
  assert.equal(validateAgainstStock([{ productId: 't', quantity: 3 }], [TIN]), null);
  assert.match(validateAgainstStock([{ productId: 't', quantity: 4 }], [TIN]), /Only 3 pc of Paint 4L/);
});

test('floating-point stock does not falsely block a sale of everything left', () => {
  // A shop that has sold 0.1 + 0.2 off a 10 m roll has 9.7 left — and a
  // naive subtraction would leave 9.699999999999999.
  const drifted = { id: 'c', name: 'Cable', unit: 'metre', stock: 10 - 0.1 - 0.2 };
  assert.equal(validateAgainstStock([{ productId: 'c', quantity: 9.7 }], [drifted]), null);
});

test('a product that has vanished from the catalogue stops the sale', () => {
  assert.match(validateAgainstStock([{ productId: 'gone', productName: 'Ghost', quantity: 1 }], [CABLE]), /no longer available/);
});

test('a service has nothing to run out of', () => {
  const haircut = { id: 'h', name: 'Haircut', kind: 'service', stock: 0 };
  assert.equal(validateAgainstStock([{ productId: 'h', quantity: 5 }], [haircut]), null);
});

test('an empty cart validates', () => {
  assert.equal(validateAgainstStock([], [CABLE]), null);
  assert.equal(validateAgainstStock(null, null), null);
});

// ── Inventory arithmetic across a whole day ──────────────────────────

test('a day of decimal sales leaves stock exactly where the arithmetic says', () => {
  // A 100 m drum, sold down in awkward lengths.
  const sales = [2.5, 0.75, 12.125, 0.001, 33.333, 1.1, 0.2, 0.3];
  let stock = 100;
  for (const qty of sales) {
    const line = buildLineItem({ quantity: qty, unitPrice: 120, costPrice: 80, unit: 'metre' });
    stock = roundQuantity(stock - line.quantity, 'metre');
  }
  const sold = roundQuantity(sales.reduce((a, b) => a + b, 0), 'metre');
  assert.equal(sold, 50.309);
  assert.equal(stock, 49.691);
  assert.equal(roundQuantity(stock + sold, 'metre'), 100, 'nothing was created or destroyed');
});

test('revenue over that day matches quantity times price to the cent', () => {
  const sales = [2.5, 0.75, 12.125, 33.333, 1.1];
  const lines = sales.map((quantity) => buildLineItem({ quantity, unitPrice: 120, costPrice: 80, unit: 'metre' }));
  const expected = roundMoney(sales.map((q) => roundMoney(q * 120)).reduce((a, b) => a + b, 0));
  assert.equal(sumLineTotals(lines), expected);
  assert.equal(sumLineTotals(lines), 5976.96);
});

// ── The stored sale document ─────────────────────────────────────────
//
// The counter builds a sale from these functions and hands it to
// Firestore. These assert the document itself is internally consistent,
// because a sale whose totalAmount disagrees with its own line items is
// a financial defect that no UI test would catch.

function buildSaleDocument(cart) {
  const items = cart.map(buildLineItem);
  const totalAmount = sumLineTotals(items);
  const costOfGoodsSold = sumLineCosts(items);
  return {
    items,
    quantity: summaryQuantity(items),
    totalAmount,
    costOfGoodsSold,
    profit: roundMoney(totalAmount - costOfGoodsSold),
  };
}

test('a hardware sale document is internally consistent to the cent', () => {
  const sale = buildSaleDocument([
    { productId: 'a', productName: 'Cable 2.5mm',  quantity: 2.5,   unitPrice: 120, costPrice: 80,  unit: 'metre' },
    { productId: 'b', productName: 'Nails 3 inch', quantity: 3.5,   unitPrice: 185, costPrice: 140, unit: 'kilogram' },
    { productId: 'c', productName: 'Timber 2x4',   quantity: 8,     unitPrice: 45,  costPrice: 30,  unit: 'foot' },
    { productId: 'd', productName: 'PVC pipe',     quantity: 4,     unitPrice: 320, costPrice: 250 },
  ]);
  assert.equal(sale.totalAmount, roundMoney(sale.items.reduce((s, i) => s + i.lineTotal, 0)));
  assert.equal(sale.costOfGoodsSold, roundMoney(sale.items.reduce((s, i) => s + i.lineCost, 0)));
  assert.equal(sale.profit, roundMoney(sale.totalAmount - sale.costOfGoodsSold));
  assert.equal(sale.profit, roundMoney(sale.items.reduce((s, i) => s + i.lineProfit, 0)));
  assert.equal(sale.totalAmount, 2587.5);
  assert.equal(sale.profit, 657.5);
});

test('a general-retail sale document has no unit fields anywhere in it', () => {
  const sale = buildSaleDocument([
    { productId: 'a', productName: 'Sukari 1kg', quantity: 2, unitPrice: 150, costPrice: 120 },
    { productId: 'b', productName: 'Unga 2kg',   quantity: 1, unitPrice: 210, costPrice: 180 },
  ]);
  assert.equal(JSON.stringify(sale).includes('"unit"'), false);
  assert.equal(sale.totalAmount, 510);
  assert.equal(sale.quantity, 3);
  assert.equal(sale.profit, 90);
});

test('the stock decrement a sale performs is exactly the quantity it charged for', () => {
  // Firestore applies increment(-quantity) to the product. Whatever the
  // line item says was sold has to be what leaves the shelf, or a shop
  // slowly gains or loses stock it never traded.
  const cart = [{ productId: 'a', productName: 'Cable', quantity: 12.3456, unitPrice: 120, costPrice: 80, unit: 'metre' }];
  const sale = buildSaleDocument(cart);
  const soldQuantity = sale.items[0].quantity;
  assert.equal(soldQuantity, 12.346, 'rounded to the unit before both the charge and the decrement');
  assert.equal(sale.totalAmount, roundMoney(12.346 * 120));

  let stock = 20;
  stock = roundQuantity(stock - soldQuantity, 'metre');
  assert.equal(stock, 7.654);
  assert.equal(roundQuantity(stock + soldQuantity, 'metre'), 20);
});

// ── Variant lines ────────────────────────────────────────────────────

test('a variant line records which version was sold', () => {
  const item = buildLineItem({
    productId: 'p1', productName: 'Cotton T-Shirt — Black / M', quantity: 2,
    unitPrice: 800, costPrice: 500, variantId: 'black__m', variantLabel: 'Black / M',
  });
  assert.equal(item.variantId, 'black__m');
  assert.equal(item.variantLabel, 'Black / M');
  assert.equal(item.lineTotal, 1600);
});

test('a variant is checked against its own stock, not the product total', () => {
  const shirt = {
    id: 'p1', name: 'Cotton T-Shirt', stock: 10,
    variants: [{ id: 'black__m', label: 'Black / M' }, { id: 'black__l', label: 'Black / L' }],
    variantStock: { black__m: 2, black__l: 8 },
  };
  assert.equal(validateAgainstStock([{ productId: 'p1', variantId: 'black__m', quantity: 2 }], [shirt]), null);
  assert.match(
    validateAgainstStock([{ productId: 'p1', variantId: 'black__m', variantLabel: 'Black / M', quantity: 3 }], [shirt]),
    /Only 2 pc of Cotton T-Shirt \(Black \/ M\)/
  );
  assert.equal(validateAgainstStock([{ productId: 'p1', variantId: 'black__l', quantity: 8 }], [shirt]), null);
});

test('two lines of the same product are checked against the shared figure together', () => {
  const sukari = { id: 's1', name: 'Sukari', stock: 4 };
  assert.equal(validateAgainstStock([
    { productId: 's1', quantity: 2 },
    { productId: 's1', quantity: 2 },
  ], [sukari]), null);
  assert.match(validateAgainstStock([
    { productId: 's1', quantity: 3 },
    { productId: 's1', quantity: 3 },
  ], [sukari]), /Only 4 pc of Sukari/);
});

// ── Modifiers and notes survive a DIRECT sale (Phase B6) ─────────────
//
// buildLineItem used to drop `modifiers` and `note`, and only
// buildOrderDocument re-added them. So a café that saved a ticket kept
// "oat milk, no sugar" and the identical drink rung up straight through
// the counter lost it — from the stored sale, the receipt, the shared
// link and the kitchen's record of what it actually made.

const LATTE_ROW = {
  productId: 'latte', productName: 'Latte', quantity: 2,
  basePrice: 250, unitPrice: 300, costPrice: 80,
  modifiers: [
    { groupId: 'milk', groupName: 'Milk', id: 'oat', name: 'Oat milk', priceDelta: 50 },
    { groupId: 'sugar', groupName: 'Sugar', id: 'none', name: 'No sugar', priceDelta: 0 },
  ],
  note: 'extra hot',
};

test('a direct sale keeps the choices made on the line', () => {
  const item = buildLineItem(LATTE_ROW);
  assert.deepEqual(item.modifiers, LATTE_ROW.modifiers);
  assert.equal(item.note, 'extra hot');
  assert.equal(item.basePrice, 250, 'the pre-modifier price, so a receipt can explain the 300');
  assert.equal(item.unitPrice, 300);
  assert.equal(item.lineTotal, 600);
});

test('an ordinary line carries no modifier fields at all, so existing sale documents are unchanged', () => {
  const item = buildLineItem({ productId: 'p', productName: 'Sugar 1kg', quantity: 1, unitPrice: 180, costPrice: 150 });
  assert.equal('modifiers' in item, false);
  assert.equal('note' in item, false);
  assert.equal('basePrice' in item, false);
  assert.deepEqual(Object.keys(item).sort(), [
    'barcode', 'costPrice', 'lineCost', 'lineProfit', 'lineTotal',
    'productId', 'productName', 'quantity', 'unitPrice',
  ]);
});

test('empty modifiers and an empty note are absent rather than stored as [] and ""', () => {
  const item = buildLineItem({ productId: 'p', productName: 'X', quantity: 1, unitPrice: 10, modifiers: [], note: '' });
  assert.equal('modifiers' in item, false);
  assert.equal('note' in item, false);
});

test('basePrice is only carried when it actually differs from what was charged', () => {
  const item = buildLineItem({ productId: 'p', productName: 'X', quantity: 1, unitPrice: 250, basePrice: 250 });
  assert.equal('basePrice' in item, false, 'a base price equal to the price says nothing');
});

test('a note is bounded, so a line item cannot be used to grow a sale document', () => {
  const item = buildLineItem({ productId: 'p', productName: 'X', quantity: 1, unitPrice: 10, note: 'z'.repeat(500) });
  assert.equal(item.note.length, 200);
});

// ── What a line says beyond its name ─────────────────────────────────

test('the detail line reads version, then choices, then note', () => {
  assert.equal(
    lineItemDetail({ variantLabel: 'Black / M', modifiers: LATTE_ROW.modifiers, note: 'extra hot' }),
    'Black / M, Oat milk, No sugar, extra hot'
  );
});

test('a plain line has no detail, so a receipt in a plain shop is unchanged', () => {
  assert.equal(lineItemDetail({ productName: 'Sugar 1kg', quantity: 1 }), '');
  assert.equal(lineItemDetail(null), '');
  assert.equal(lineItemDetail({ modifiers: 'not-an-array' }), '');
});

test('an order and the sale it becomes describe the line identically', () => {
  // The failure this pins down: the two used to be built by different
  // code, so charging a ticket and ringing the same thing up directly
  // produced two different documents.
  const fromOrder = buildOrderDocument([LATTE_ROW]).items[0];
  const fromCounter = buildLineItem(LATTE_ROW);
  assert.deepEqual(fromOrder, fromCounter);
  assert.equal(lineItemDetail(fromOrder), lineItemDetail(fromCounter));
});
