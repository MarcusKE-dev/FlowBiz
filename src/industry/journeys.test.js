// The per-industry user journey, walked in code (Phase E and F1).
//
// Each test below is one trade's actual working day — add the thing, take
// it in, sell it, hand it back, count it — resolved through the SAME
// three modules every screen uses: resolveIndustryConfig for what is
// offered, utils/inventory.js for what moves, utils/financials.js for
// what it is worth.
//
// The point is not to re-test those modules. It is to prove that a real
// sequence for a real trade holds the invariants at the END of it: the
// ledgers agree, the money is right, and General Retail is untouched.

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIndustryConfig } from './config.js';
import { roundQuantity } from './units.js';
import {
  resolveStockDeltas, resolveReceiptDeltas, resolveCountDeltas,
  resolveProductionDeltas, productionUnitCost, stockWriteOps, isStockItem,
} from '../utils/inventory.js';
import { buildLineItem, sumLineTotals, sumLineCosts, validateAgainstStock } from '../utils/lineItems.js';
import { totalVariantStock } from '../utils/variants.js';
import { allocateFefo } from '../utils/batches.js';
import { buildReturn, buildRefundDocument } from '../utils/returns.js';
import { computeFinancials } from '../utils/financials.js';
import { buildOrderDocument, orderToCart, orderToSaleFields, summarizeOpenOrders } from '../utils/orders.js';

// A shop that applies deltas the way Firestore increments would, so a
// journey is checked on real arithmetic rather than on intentions.
function shop(products, batches = []) {
  const state = {
    products: products.map((p) => ({ ...p, variantStock: p.variantStock ? { ...p.variantStock } : undefined })),
    batches: batches.map((b) => ({ ...b })),
  };
  state.apply = (deltas) => {
    for (const op of stockWriteOps(deltas)) {
      if (op.collection === 'products') {
        const product = state.products.find((p) => p.id === op.id);
        for (const [field, value] of Object.entries(op.fields)) {
          if (field === 'stock') {
            product.stock = roundQuantity((Number(product.stock) || 0) + value, product.unit);
          } else {
            const id = field.slice('variantStock.'.length);
            product.variantStock = product.variantStock || {};
            product.variantStock[id] = roundQuantity((Number(product.variantStock[id]) || 0) + value, product.unit);
          }
        }
      } else {
        const batch = state.batches.find((b) => b.id === op.id);
        batch.remainingQuantity = roundQuantity((Number(batch.remainingQuantity) || 0) + op.fields.remainingQuantity, batch.unit);
      }
    }
    return state;
  };
  state.get = (id) => state.products.find((p) => p.id === id);
  return state;
}

// ── BOUTIQUE ─────────────────────────────────────────────────────────

test('BOUTIQUE: receive a size, sell it, return one, count the rail', () => {
  const config = resolveIndustryConfig({ industryProfile: 'BOUTIQUE' });
  assert.equal(config.can('variants'), true);

  const shirt = {
    id: 'shirt', name: 'Shirt', sellingPrice: 900, costPrice: 500, stock: 0,
    variants: [{ id: 'black__m', label: 'Black / M' }, { id: 'black__l', label: 'Black / L' }],
    variantStock: { black__m: 0, black__l: 0 },
  };
  const s = shop([shirt]);

  // Receive six M and four L — the thing a boutique could not do at all
  // before this phase.
  s.apply(resolveReceiptDeltas([{ productId: 'shirt', variantId: 'black__m', quantity: 6 }], s.products));
  s.apply(resolveReceiptDeltas([{ productId: 'shirt', variantId: 'black__l', quantity: 4 }], s.products));
  assert.equal(s.get('shirt').stock, 10);
  assert.equal(totalVariantStock(s.get('shirt')), 10);

  // Sell two M. The counter checks the VERSION's stock, not the total.
  const cart = [{ productId: 'shirt', productName: 'Shirt', quantity: 2, unitPrice: 900, costPrice: 500, variantId: 'black__m', variantLabel: 'Black / M' }];
  assert.equal(validateAgainstStock(cart, s.products), null);
  assert.ok(
    validateAgainstStock([{ ...cart[0], quantity: 9 }], s.products)?.includes('Black / M'),
    'nine M cannot be sold when only six exist, even though ten shirts do'
  );

  const lineItems = cart.map(buildLineItem);
  s.apply(resolveStockDeltas(lineItems, s.products));
  assert.equal(s.get('shirt').variantStock.black__m, 4);
  assert.equal(s.get('shirt').stock, 8);

  // One comes back.
  const sale = { id: 'sale1', items: lineItems, totalAmount: 1800, costOfGoodsSold: 1000, paymentMethod: 'Cash' };
  const returned = buildReturn(sale, { 0: 1 });
  s.apply(resolveStockDeltas(returned.rows, s.products, { reverse: true }));
  assert.equal(s.get('shirt').variantStock.black__m, 5, 'it goes back to M, not to L');
  assert.equal(s.get('shirt').variantStock.black__l, 4);

  // Count the rail, per version.
  s.apply(resolveCountDeltas([
    { productId: 'shirt', variantId: 'black__m', counted: 5 },
    { productId: 'shirt', variantId: 'black__l', counted: 3 },
  ], s.products));
  assert.equal(s.get('shirt').stock, 8);
  assert.equal(totalVariantStock(s.get('shirt')), 8, 'the versions still sum to the total');
});

// ── RESTAURANT ───────────────────────────────────────────────────────

test('RESTAURANT: open a ticket with modifiers, reopen it, charge it, and the kitchen keeps its choices', () => {
  const config = resolveIndustryConfig({ industryProfile: 'RESTAURANT' });
  assert.equal(config.categoryFilterThreshold, 0, 'a menu groups from the first item');

  const bun = { id: 'bun', name: 'Bun', stock: 50 };
  const patty = { id: 'patty', name: 'Patty', stock: 30 };
  const burger = {
    id: 'burger', name: 'Cheeseburger', sellingPrice: 550, stock: 0,
    recipe: [{ componentId: 'bun', quantity: 1 }, { componentId: 'patty', quantity: 1 }],
  };
  const s = shop([bun, patty, burger]);

  const row = {
    productId: 'burger', productName: 'Cheeseburger', quantity: 2,
    basePrice: 550, unitPrice: 600, costPrice: 200,
    modifiers: [{ groupId: 'extras', groupName: 'Extras', id: 'cheese', name: 'Extra cheese', priceDelta: 50 }],
    note: 'no onions',
  };

  const order = buildOrderDocument([row], { tableName: 'Table 3', diningMode: 'dine-in' });
  assert.equal(order.totalAmount, 1200);
  assert.equal(order.items[0].modifiers[0].name, 'Extra cheese');
  assert.equal(order.items[0].note, 'no onions');
  // An open ticket holds NO inventory.
  assert.equal(bun.stock, 50);

  // Reopened at the counter, the choices survive the round trip.
  const reopened = orderToCart({ ...order, id: 'o1' });
  assert.equal(reopened[0].modifiers[0].name, 'Extra cheese');
  assert.equal(reopened[0].note, 'no onions');
  assert.equal(reopened[0].basePrice, 550);

  // Charged. It becomes an ORDINARY sale, and the ingredients move.
  const charged = reopened.map(buildLineItem);
  assert.deepEqual(charged, order.items, 'charging is a copy, not a translation');
  s.apply(resolveStockDeltas(charged, s.products, { recipes: true }));
  assert.equal(s.get('bun').stock, 48);
  assert.equal(s.get('patty').stock, 28);
  assert.equal(s.get('burger').stock, 0, 'the menu item itself never moves');

  const saleFields = orderToSaleFields({ id: 'o1', name: 'Table 3', tableName: 'Table 3', diningMode: 'dine-in' });
  assert.equal(saleFields.tableName, 'Table 3');
  const summary = computeFinancials({
    sales: [{ items: charged, totalAmount: 1200, costOfGoodsSold: 400, paymentMethod: 'Cash', ...saleFields }],
  });
  assert.equal(summary.revenue, 1200, 'a restaurant sale is read by the same engine a shop sale is');
});

// ── BAR ──────────────────────────────────────────────────────────────

test('BAR: receive bottles as tots, run a tab, and see what is open', () => {
  const config = resolveIndustryConfig({ industryProfile: 'BAR' });
  assert.equal(config.terms.openOrders, 'Open tabs');
  assert.equal(config.can('packSizes'), true);

  // A 750ml bottle poured as 25ml tots is 30 tots.
  const gin = { id: 'gin', name: 'Gin', unit: 'tot', packUnit: 'bottle', packSize: 30, sellingPrice: 250, costPrice: 47, stock: 0 };
  const s = shop([gin]);

  s.apply(resolveReceiptDeltas([{ productId: 'gin', quantity: 4, pack: true }], s.products, { packSizes: true }));
  assert.equal(s.get('gin').stock, 120, 'four bottles is a hundred and twenty tots');

  // Two tabs running at once.
  const tabA = { ...buildOrderDocument([{ productId: 'gin', productName: 'Gin', quantity: 3, unitPrice: 250, costPrice: 47 }], { tableName: 'Table 1' }), id: 'a', status: 'open' };
  const tabB = { ...buildOrderDocument([{ productId: 'gin', productName: 'Gin', quantity: 2, unitPrice: 250, costPrice: 47 }], { tableName: 'Table 2' }), id: 'b', status: 'open' };
  const open = summarizeOpenOrders([tabA, tabB]);
  assert.equal(open.count, 2);
  assert.equal(open.total, 1250, 'the two tabs come to 750 and 500');
  assert.equal(open.tablesOccupied, 2);
  assert.equal(s.get('gin').stock, 120, 'an open tab still holds no stock');

  // Charge the first tab: five tots leave, in tots.
  s.apply(resolveStockDeltas(tabA.items, s.products, { recipes: true, packSizes: true }));
  assert.equal(s.get('gin').stock, 117);
});

test('BAR: a cocktail consumes the spirits it is made from, and never itself', () => {
  const gin = { id: 'gin', name: 'Gin', unit: 'tot', stock: 100 };
  const lime = { id: 'lime', name: 'Lime', unit: 'millilitre', stock: 2000 };
  const dawa = {
    id: 'dawa', name: 'Dawa', sellingPrice: 400, stock: 0,
    recipe: [{ componentId: 'gin', quantity: 2 }, { componentId: 'lime', quantity: 30, unit: 'millilitre' }],
  };
  const s = shop([gin, lime, dawa]);
  s.apply(resolveStockDeltas([{ productId: 'dawa', quantity: 3 }], s.products, { recipes: true }));
  assert.equal(s.get('gin').stock, 94, 'three doubles');
  assert.equal(s.get('lime').stock, 1910);
  assert.equal(s.get('dawa').stock, 0);
});

// ── HARDWARE ─────────────────────────────────────────────────────────

test('HARDWARE: buy, sell, count and value a decimal quantity end to end, with no drift', () => {
  const config = resolveIndustryConfig({ industryProfile: 'HARDWARE' });
  assert.equal(config.can('units'), true);
  assert.ok(config.units.includes('metre'));

  const cable = { id: 'cable', name: 'Cable', unit: 'metre', costPrice: 80, sellingPrice: 120, stock: 0 };
  const s = shop([cable]);

  // Receive 100.5 m.
  s.apply(resolveReceiptDeltas([{ productId: 'cable', quantity: 100.5 }], s.products));
  assert.equal(s.get('cable').stock, 100.5);

  // Sell 2.5 m, priced on the ALREADY-ROUNDED quantity.
  const line = buildLineItem({ productId: 'cable', productName: 'Cable', quantity: 2.5, unitPrice: 120, costPrice: 80, unit: 'metre' });
  assert.equal(line.quantity, 2.5);
  assert.equal(line.lineTotal, 300);
  assert.equal(line.lineCost, 200);
  assert.equal(line.unit, 'metre');
  s.apply(resolveStockDeltas([line], s.products));
  assert.equal(s.get('cable').stock, 98);

  // Thirty more short cuts, which is where float error would show up.
  for (let i = 0; i < 30; i += 1) {
    s.apply(resolveStockDeltas([{ productId: 'cable', quantity: 0.1 }], s.products));
  }
  assert.equal(s.get('cable').stock, 95, 'thirty 0.1 m cuts is exactly 3 m');

  // Count 94.75 on the reel.
  s.apply(resolveCountDeltas([{ productId: 'cable', counted: 94.75 }], s.products));
  assert.equal(s.get('cable').stock, 94.75);

  // Inventory valuation is the same arithmetic every other trade uses.
  const value = s.products.filter(isStockItem).reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  assert.equal(value, 7580);

  const summary = computeFinancials({ sales: [{ items: [line], totalAmount: 300, costOfGoodsSold: 200, paymentMethod: 'Cash' }] });
  assert.equal(summary.grossProfit, 100);
});

// ── WINES AND SPIRITS ────────────────────────────────────────────────

test('WINES_AND_SPIRITS: receive crates, sell bottles, and be warned when the shelf runs low', () => {
  const config = resolveIndustryConfig({ industryProfile: 'WINES_AND_SPIRITS' });
  assert.equal(config.can('barcodeLabels'), true);
  assert.equal(config.can('ageRestriction'), true);
  assert.equal(config.can('orders'), false, 'nothing is left open in a liquor shop');

  // A Kenyan beer crate is 25 bottles.
  const beer = {
    id: 'beer', name: 'Tusker 500ml', unit: 'bottle', packUnit: 'crate', packSize: 25,
    costPrice: 180, sellingPrice: 250, lowStockThreshold: 12, stock: 0,
    barcode: '6161100000000', ageRestricted: true,
  };
  const s = shop([beer]);

  s.apply(resolveReceiptDeltas([{ productId: 'beer', quantity: 2, pack: true }], s.products, { packSizes: true }));
  assert.equal(s.get('beer').stock, 50);

  // Sold one bottle at a time.
  const line = buildLineItem({ productId: 'beer', productName: 'Tusker 500ml', quantity: 6, unitPrice: 250, costPrice: 180, unit: 'bottle' });
  s.apply(resolveStockDeltas(line ? [line] : [], s.products, { packSizes: true }));
  assert.equal(s.get('beer').stock, 44);

  // Low stock is the same rule every retail profile uses — no bottle,
  // crate or carton arithmetic leaks into it, because stock is held in
  // ONE base unit.
  const isLow = (p) => p.stock <= (p.lowStockThreshold ?? 5);
  assert.equal(isLow(s.get('beer')), false);
  s.apply(resolveStockDeltas([{ productId: 'beer', quantity: 33 }], s.products));
  assert.equal(s.get('beer').stock, 11);
  assert.equal(isLow(s.get('beer')), true);
});

// ── PHARMACY ─────────────────────────────────────────────────────────

test('PHARMACY: receive a box, dispense FEFO, reconcile the batch, and never lose the ledger', () => {
  const config = resolveIndustryConfig({ industryProfile: 'PHARMACY' });
  assert.equal(config.can('batches'), true);
  assert.equal(config.can('expiryAlerts'), true);
  assert.equal(config.can('packSizes'), true);

  // A box of 30 tablets, dispensed one tablet at a time.
  const drug = { id: 'amox', name: 'Amoxicillin', unit: 'piece', packUnit: 'box', packSize: 30, costPrice: 8, sellingPrice: 20, stock: 0 };
  const s = shop([drug], [
    { id: 'lotA', productId: 'amox', batchNumber: 'A1', expiryDate: '2026-11-30', quantity: 60, remainingQuantity: 60, costPrice: 8 },
    { id: 'lotB', productId: 'amox', batchNumber: 'B2', expiryDate: '2027-06-30', quantity: 30, remainingQuantity: 30, costPrice: 9 },
  ]);
  // Three boxes of thirty = ninety tablets, matching the two lots above.
  s.apply(resolveReceiptDeltas([{ productId: 'amox', quantity: 3, pack: true }], s.products, { packSizes: true }));
  assert.equal(s.get('amox').stock, 90);

  // Dispense 70, earliest expiry first, expired stock never chosen.
  const { allocations, shortfall } = allocateFefo(s.batches, 70, { today: '2026-09-04' });
  assert.equal(shortfall, 0);
  assert.deepEqual(allocations.map((a) => [a.batchId, a.quantity]), [['lotA', 60], ['lotB', 10]]);

  s.apply(resolveStockDeltas([{ productId: 'amox', quantity: 70, batchAllocations: allocations }], s.products));
  assert.equal(s.get('amox').stock, 20);
  const batchTotal = () => s.batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
  assert.equal(batchTotal(), 20, 'the batch ledger sums to the product stock');

  // A physical count, PER LOT — the thing that used to break this.
  s.apply(resolveCountDeltas([{ productId: 'amox', batchId: 'lotB', counted: 18 }], s.products, { batches: s.batches }));
  assert.equal(s.get('amox').stock, 18);
  assert.equal(batchTotal(), 18, 'the invariant holds after a stock take');
  assert.equal(s.batches.find((b) => b.id === 'lotA').remainingQuantity, 0);
});

// ── SALON, BARBER, GENERAL SERVICES ──────────────────────────────────

test('SALON: a service sale earns money and touches no inventory anywhere', () => {
  const config = resolveIndustryConfig({ industryProfile: 'SALON' });
  assert.equal(config.can('services'), true);

  const catalogue = [
    { id: 'cut', name: 'Haircut', kind: 'service', sellingPrice: 500, costPrice: 0, stock: 0, lowStockThreshold: 5 },
    // A service somebody left a stale cost and stock figure on.
    { id: 'braid', name: 'Braiding', kind: 'service', sellingPrice: 1500, costPrice: 400, stock: 9, lowStockThreshold: 5 },
    { id: 'shampoo', name: 'Shampoo', sellingPrice: 800, costPrice: 500, stock: 6, lowStockThreshold: 5 },
  ];
  const s = shop(catalogue);

  const lines = [
    buildLineItem({ productId: 'cut', productName: 'Haircut', quantity: 1, unitPrice: 500, costPrice: 0 }),
    buildLineItem({ productId: 'shampoo', productName: 'Shampoo', quantity: 1, unitPrice: 800, costPrice: 500 }),
  ];
  s.apply(resolveStockDeltas(lines, s.products));
  assert.equal(s.get('cut').stock, 0, 'a haircut does not run out');
  assert.equal(s.get('shampoo').stock, 5, 'the product it was sold with does');

  // A stock take does not offer services as rows.
  assert.deepEqual(resolveCountDeltas([{ productId: 'cut', counted: 3 }], s.products), {});
  assert.deepEqual(s.products.filter(isStockItem).map((p) => p.id), ['shampoo']);

  // Neither valuation nor low stock ever sees one.
  const value = s.products.filter(isStockItem).reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  assert.equal(value, 2500, 'the stale 9 × 400 on a service is not inventory');
  const low = s.products.filter(isStockItem).filter((p) => p.stock <= (p.lowStockThreshold ?? 5));
  assert.deepEqual(low.map((p) => p.id), ['shampoo']);

  // The money: full revenue, and cost only on the thing that had one.
  assert.equal(sumLineTotals(lines), 1300);
  assert.equal(sumLineCosts(lines), 500);
  const summary = computeFinancials({
    sales: [{ items: lines, totalAmount: 1300, costOfGoodsSold: 500, paymentMethod: 'Cash' }],
  });
  assert.equal(summary.revenue, 1300);
  assert.equal(summary.grossProfit, 800);
});

test('GENERAL_SERVICES: the stock pages are not offered, and nothing is blocked', () => {
  const config = resolveIndustryConfig({ industryProfile: 'GENERAL_SERVICES' });
  assert.deepEqual(config.hiddenNav, ['/purchases', '/suppliers', '/stock-take']);
  // Hiding navigation is presentation. It never decides who may read or
  // write anything — the route still resolves, and the rules are what
  // actually decide.
  assert.equal(config.can('services'), true);
});

// ── BAKERY ───────────────────────────────────────────────────────────

test('BAKERY: a production run moves stock once and updates what the loaf really costs', () => {
  const config = resolveIndustryConfig({ industryProfile: 'BAKERY' });
  assert.equal(config.can('production'), true);

  const flour = { id: 'flour', name: 'Flour', unit: 'kilogram', stock: 50, costPrice: 120 };
  const loaf = {
    id: 'loaf', name: 'White loaf', stock: 0, costPrice: 12, sellingPrice: 70,
    producedInAdvance: true,
    recipe: [{ componentId: 'flour', quantity: 0.5, unit: 'kilogram' }],
  };
  const s = shop([flour, loaf]);

  const unitCost = productionUnitCost(loaf, 1, s.products);
  assert.equal(unitCost, 60, 'half a kilo of 120/kg flour');
  assert.notEqual(unitCost, loaf.costPrice, 'the typed figure was stale, which is the defect');

  s.apply(resolveProductionDeltas(loaf, 20, s.products));
  assert.equal(s.get('loaf').stock, 20);
  assert.equal(s.get('flour').stock, 40);

  // Production writes the real cost back, so profit is on the flour.
  s.get('loaf').costPrice = unitCost;
  const line = buildLineItem({ productId: 'loaf', productName: 'White loaf', quantity: 5, unitPrice: 70, costPrice: s.get('loaf').costPrice });
  assert.equal(line.lineCost, 300);
  assert.equal(line.lineProfit, 50, 'ten shillings a loaf, which is the truth');

  // Selling the loaf takes the LOAF and not the flour a second time.
  s.apply(resolveStockDeltas([line], s.products, { recipes: true }));
  assert.equal(s.get('loaf').stock, 15);
  assert.equal(s.get('flour').stock, 40, 'the flour was already taken at production time');
});

// ── GENERAL RETAIL, the protected baseline ───────────────────────────

test('GENERAL_RETAIL: the whole journey is exactly what it always was', () => {
  const config = resolveIndustryConfig(null);
  const sugar = { id: 'sugar', name: 'Sugar 1kg', stock: 20, costPrice: 150, sellingPrice: 180, lowStockThreshold: 5 };
  const s = shop([sugar]);

  // Nothing is offered that was not offered before.
  assert.deepEqual(config.units, ['piece']);
  assert.equal(config.terms.catalogue, 'Products');
  assert.deepEqual(config.dashboard, ['moneyToday', 'position', 'activity']);
  assert.deepEqual(config.hiddenNav, []);

  // A line item is byte-for-byte the document it always was.
  const line = buildLineItem({ productId: 'sugar', productName: 'Sugar 1kg', quantity: 2, unitPrice: 180, costPrice: 150 });
  assert.deepEqual(Object.keys(line).sort(), [
    'barcode', 'costPrice', 'lineCost', 'lineProfit', 'lineTotal',
    'productId', 'productName', 'quantity', 'unitPrice',
  ]);

  // Receive, sell, count — all whole numbers, no variant map, no batch.
  s.apply(resolveReceiptDeltas([{ productId: 'sugar', quantity: 10 }], s.products));
  assert.equal(s.get('sugar').stock, 30);
  const deltas = resolveStockDeltas([line], s.products);
  assert.deepEqual(deltas.sugar, { total: -2, variants: {}, batches: {} });
  s.apply(deltas);
  assert.equal(s.get('sugar').stock, 28);
  assert.equal(s.get('sugar').variantStock, undefined, 'no variant map is ever created');

  s.apply(resolveCountDeltas([{ productId: 'sugar', counted: 27 }], s.products));
  assert.equal(s.get('sugar').stock, 27);

  // And exactly one write per product, with exactly one field.
  assert.deepEqual(
    stockWriteOps(resolveStockDeltas([line], s.products)),
    [{ collection: 'products', id: 'sugar', fields: { stock: -2 } }]
  );

  const summary = computeFinancials({ sales: [{ items: [line], totalAmount: 360, costOfGoodsSold: 300, paymentMethod: 'Cash' }] });
  assert.equal(summary.revenue, 360);
  assert.equal(summary.grossProfit, 60);
});

// ── Returns apply to every profile, because they are not an industry ──

test('every profile can return a sale, because a return is retail and not an industry', () => {
  for (const profileId of ['GENERAL_RETAIL', 'BOUTIQUE', 'RESTAURANT', 'BAR', 'PHARMACY', 'SALON', 'WINES_AND_SPIRITS']) {
    const config = resolveIndustryConfig({ industryProfile: profileId });
    const sale = {
      id: 's', paymentMethod: 'Cash', totalAmount: 500, costOfGoodsSold: 300,
      items: [{ productId: 'x', productName: 'Thing', quantity: 1, unitPrice: 500, costPrice: 300, lineTotal: 500, lineCost: 300 }],
    };
    const returned = buildReturn(sale, { 0: 1 });
    const refund = { ...buildRefundDocument({ sale, returned, method: 'Cash', reason: '' }), id: 'r' };
    const summary = computeFinancials({ sales: [sale], refunds: [refund] });
    assert.equal(summary.revenue, 0, `${profileId}: the refund reverses the revenue`);
    assert.equal(summary.grossProfit, 0, `${profileId}: and the cost with it`);
    assert.equal(summary.totalCashReceipts, 0, `${profileId}: the till is square`);
    assert.equal(typeof config.can, 'function');
  }
});
