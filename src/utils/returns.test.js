// Returning a completed cash or M-Pesa sale (Phase E).
//
// The two properties this file exists to pin down:
//
//   THE MONEY IS RIGHT. A return refunds exactly what the returned lines
//   were sold for and reverses exactly what they cost — never a
//   proportion of the sale total, which is wrong the moment two lines
//   have different margins.
//
//   IT CANNOT HAPPEN TWICE. Returning two of three, then two more, must
//   give back one — not two, and never more than was sold.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  returnableLines, buildReturn, buildRefundDocument, isFullyReturned,
  saleLineItems, alreadyReturned, MAX_RETURN_REASON, returnState,
} from './returns.js';
import { computeFinancials } from './financials.js';
import { resolveStockDeltas } from './inventory.js';

// A three-line sale with deliberately DIFFERENT margins, because that is
// what makes proportioning the total wrong.
const SALE = () => ({
  id: 'sale1',
  businessId: 'BIZ',
  paymentMethod: 'Cash',
  totalAmount: 2100,
  costOfGoodsSold: 1100, // 900 + 200 + 0, the sum of the line costs
  isVoided: false,
  items: [
    { productId: 'shirt', productName: 'Shirt', quantity: 3, unitPrice: 500, costPrice: 300, lineTotal: 1500, lineCost: 900, variantId: 'black__m', variantLabel: 'Black / M' },
    { productId: 'soap',  productName: 'Soap',  quantity: 2, unitPrice: 200, costPrice: 100, lineTotal: 400,  lineCost: 200 },
    { productId: 'cut',   productName: 'Haircut', quantity: 1, unitPrice: 200, costPrice: 0, lineTotal: 200, lineCost: 0 },
  ],
});

// ── Reading a sale ───────────────────────────────────────────────────

test('a sale written before carts existed can still be returned', () => {
  const legacy = {
    id: 'old', productId: 'sugar', productName: 'Sugar 1kg', quantity: 2,
    soldPricePerUnit: 180, costPricePerUnit: 150, totalAmount: 360, costOfGoodsSold: 300,
  };
  const lines = saleLineItems(legacy);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].productId, 'sugar');
  assert.equal(lines[0].unitPrice, 180);

  const returned = buildReturn(legacy, { 0: 2 });
  assert.equal(returned.amount, 360);
  assert.equal(returned.costOfGoodsSold, 300);
});

test('a sale with nothing on it produces no returnable lines rather than throwing', () => {
  for (const sale of [null, undefined, {}, { items: [] }, 'sale']) {
    assert.doesNotThrow(() => returnableLines(sale));
    assert.deepEqual(returnableLines(sale), []);
    assert.equal(isFullyReturned(sale), false);
  }
});

// ── The money ────────────────────────────────────────────────────────

test('a returned line refunds its OWN price and reverses its OWN cost', () => {
  // One shirt back out of a 2,100 sale. Proportioning the total would
  // give 500/2100 of 1,150 = 273.81 of cost; the truth is 300.
  const returned = buildReturn(SALE(), { 0: 1 });
  assert.equal(returned.amount, 500);
  assert.equal(returned.costOfGoodsSold, 300);
  assert.equal(returned.items.length, 1);
  assert.equal(returned.items[0].variantLabel, 'Black / M');
});

test('returning a whole sale gives back exactly what was taken', () => {
  const sale = SALE();
  const returned = buildReturn(sale, { 0: 3, 1: 2, 2: 1 });
  assert.equal(returned.amount, sale.totalAmount);
  assert.equal(returned.costOfGoodsSold, sale.costOfGoodsSold);
});

test('a returned service refunds its price and reverses no cost at all', () => {
  const returned = buildReturn(SALE(), { 2: 1 });
  assert.equal(returned.amount, 200);
  assert.equal(returned.costOfGoodsSold, 0, 'a haircut has no cost of goods to reverse');
});

test('a decimal quantity returns exactly, with no float drift', () => {
  const sale = {
    id: 's', items: [
      { productId: 'cable', productName: 'Cable', quantity: 12.5, unitPrice: 120, costPrice: 80, unit: 'metre' },
    ],
  };
  const returned = buildReturn(sale, { 0: 2.5 });
  assert.equal(returned.rows[0].quantity, 2.5);
  assert.equal(returned.amount, 300);
  assert.equal(returned.costOfGoodsSold, 200);
});

// ── It cannot happen twice ───────────────────────────────────────────

test('a partial return leaves exactly the rest available, and no more', () => {
  const sale = SALE();
  const first = buildReturn(sale, { 0: 2 });
  assert.equal(first.amount, 1000);
  assert.deepEqual(first.returnedQuantities, { 0: 2 });

  const afterFirst = { ...sale, returnedQuantities: first.returnedQuantities };
  const lines = returnableLines(afterFirst);
  assert.equal(lines[0].returnable, 1, 'one shirt left');

  // Asking for five more can only give one.
  const second = buildReturn(afterFirst, { 0: 5 });
  assert.equal(second.amount, 500);
  assert.equal(second.rows[0].quantity, 1);
  assert.deepEqual(second.returnedQuantities, { 0: 3 });
});

test('a fully returned sale offers nothing more, however it is asked', () => {
  const sale = { ...SALE(), returnedQuantities: { 0: 3, 1: 2, 2: 1 } };
  assert.equal(isFullyReturned(sale), true);
  const attempt = buildReturn(sale, { 0: 3, 1: 2, 2: 1 });
  assert.equal(attempt.isEmpty, true);
  assert.equal(attempt.amount, 0);
});

test('a hostile or fat-fingered quantity can never refund more than was paid', () => {
  const sale = SALE();
  for (const quantity of [999, Infinity, '999', -5, 'lots', null, undefined, {}, NaN]) {
    const returned = buildReturn(sale, { 0: quantity });
    assert.ok(returned.amount <= 1500, `${String(quantity)} must be clamped to what was sold`);
    assert.ok(returned.amount >= 0, `${String(quantity)} must never be a negative refund`);
  }
});

test('an empty request is an empty return, not a zero-value refund document', () => {
  for (const quantities of [null, undefined, {}, { 0: 0 }, { 9: 5 }, 'nope']) {
    assert.equal(buildReturn(SALE(), quantities).isEmpty, true);
  }
});

// ── Stock goes back where it came from ───────────────────────────────

test('a returned version goes back to that version, not to the product at large', () => {
  const shirt = {
    id: 'shirt', name: 'Shirt', stock: 7,
    variants: [{ id: 'black__m', label: 'Black / M' }, { id: 'white__m', label: 'White / M' }],
    variantStock: { black__m: 4, white__m: 3 },
  };
  const returned = buildReturn(SALE(), { 0: 2 });
  const deltas = resolveStockDeltas(returned.rows, [shirt], { reverse: true });
  assert.equal(deltas.shirt.total, 2);
  assert.equal(deltas.shirt.variants.black__m, 2);
  assert.equal(deltas.shirt.variants.white__m, undefined, 'the other size is untouched');
});

test('a partial return of a batched line goes back to the boxes it came out of, earliest first', () => {
  const sale = {
    id: 's', items: [{
      productId: 'amox', productName: 'Amoxicillin', quantity: 60, unitPrice: 20, costPrice: 8,
      batchAllocations: [
        { batchId: 'lotA', quantity: 50, costPrice: 8 },
        { batchId: 'lotB', quantity: 10, costPrice: 9 },
      ],
    }],
  };
  const returned = buildReturn(sale, { 0: 55 });
  assert.deepEqual(
    returned.rows[0].batchAllocations.map((a) => [a.batchId, a.quantity]),
    [['lotA', 50], ['lotB', 5]],
    'the first fifty go back to lot A, the next five to lot B'
  );

  const drug = { id: 'amox', name: 'Amoxicillin', stock: 60 };
  const deltas = resolveStockDeltas(returned.rows, [drug], { reverse: true });
  assert.equal(deltas.amox.total, 55);
  assert.equal(deltas.amox.batches.lotA, 50);
  assert.equal(deltas.amox.batches.lotB, 5);
});

test('a returned service restores no stock at all', () => {
  const haircut = { id: 'cut', name: 'Haircut', kind: 'service', stock: 0 };
  const returned = buildReturn(SALE(), { 2: 1 });
  assert.deepEqual(resolveStockDeltas(returned.rows, [haircut], { reverse: true }), {});
});

// ── The refund document, and the ONE money path ──────────────────────

test('a return writes an ordinary refund — the same fields the engine has always read', () => {
  const sale = SALE();
  const returned = buildReturn(sale, { 0: 1, 1: 2 });
  const refund = buildRefundDocument({
    sale, returned, method: 'Cash', reason: 'wrong size',
    refundedBy: 'u1', refundedByName: 'Amina',
  });
  assert.equal(refund.amount, 900, '500 + 400');
  assert.equal(refund.costOfGoodsSold, 500, '300 + 200');
  assert.equal(refund.method, 'Cash');
  assert.equal(refund.saleId, 'sale1');
  assert.equal(refund.kind, 'sale-return');
  assert.equal(refund.reason, 'wrong size');
  // The two fields computeFinancials() has always keyed on.
  assert.equal(typeof refund.amount, 'number');
  assert.ok(['Cash', 'M-Pesa'].includes(refund.method));
});

test('a return reason is bounded, so a refund document cannot be grown', () => {
  const returned = buildReturn(SALE(), { 0: 1 });
  const refund = buildRefundDocument({ sale: SALE(), returned, method: 'Cash', reason: 'z'.repeat(2000) });
  assert.equal(refund.reason.length, MAX_RETURN_REASON);
});

test('the till and the reports account for a cash return with no change of their own', () => {
  const sale = SALE();
  const returned = buildReturn(sale, { 0: 1 });
  const refund = { ...buildRefundDocument({ sale, returned, method: 'Cash', reason: '' }), id: 'r1' };

  const before = computeFinancials({ sales: [sale] });
  const after = computeFinancials({ sales: [sale], refunds: [refund] });

  assert.equal(before.revenue, 2100);
  assert.equal(before.costOfGoodsSold, 1100);
  assert.equal(before.grossProfit, 1000);

  assert.equal(after.revenue, 1600, 'the refunded 500 is no longer revenue');
  assert.equal(after.costOfGoodsSold, 800, 'the returned shirt cost 300, and it is back on the shelf');
  assert.equal(after.grossProfit, 800, 'the shop lost exactly the 200 margin on that shirt');
  assert.equal(after.totalCashReceipts, 1600, 'the till is 500 lighter');
  assert.equal(after.totalRefundsCash, 500);
  assert.equal(after.totalCashOutflows, 500);
});

test('an M-Pesa return comes out of the M-Pesa float, not the cash drawer', () => {
  const sale = { ...SALE(), paymentMethod: 'M-Pesa' };
  const returned = buildReturn(sale, { 1: 2 });
  const refund = { ...buildRefundDocument({ sale, returned, method: 'M-Pesa', reason: '' }), id: 'r1' };
  const after = computeFinancials({ sales: [sale], refunds: [refund] });
  assert.equal(after.totalRefundsMpesa, 400);
  assert.equal(after.totalRefundsCash, 0);
  assert.equal(after.totalMpesaReceipts, 1700);
});

test('a credit refund written before returns existed is recognised exactly as it always was', () => {
  // The financial engine gained one branch. This proves the old branch is
  // untouched: a refund with no stated cost still derives it from the
  // credit sale, in proportion to how much had been paid.
  const creditSale = {
    id: 'cs1', totalAmount: 1000, costOfGoodsSold: 600,
    status: 'refunded', amountPaid: 400,
  };
  const legacyRefund = { id: 'r0', creditSaleId: 'cs1', amount: 400, method: 'Cash' };
  const summary = computeFinancials({
    creditSales: [creditSale], allCreditSales: [creditSale], refunds: [legacyRefund],
  });
  assert.equal(summary.totalRefundsCash, 400);
  assert.equal(summary.costOfGoodsSold, -240, '400/1000 of a 600 cost, reversed');
});

test('two returns of the same sale are two refunds and never one doubled', () => {
  const sale = SALE();
  const first = buildReturn(sale, { 0: 1 });
  const afterFirst = { ...sale, returnedQuantities: first.returnedQuantities };
  const second = buildReturn(afterFirst, { 0: 2 });

  const refunds = [
    { ...buildRefundDocument({ sale, returned: first, method: 'Cash', reason: '' }), id: 'r1' },
    { ...buildRefundDocument({ sale: afterFirst, returned: second, method: 'Cash', reason: '' }), id: 'r2' },
  ];
  const summary = computeFinancials({ sales: [sale], refunds });
  assert.equal(summary.totalRefundsCash, 1500, 'three shirts, once each');
  assert.equal(summary.revenue, 600, 'the soap and the haircut are all that is left');
});

test('alreadyReturned ignores anything that is not a real quantity', () => {
  assert.deepEqual(alreadyReturned({ returnedQuantities: { 0: 2, 1: 0, 2: -1, 3: 'x', 4: null } }), { 0: 2 });
  assert.deepEqual(alreadyReturned({}), {});
  assert.deepEqual(alreadyReturned(null), {});
});


// ── What the sale history shows ──────────────────────────────────────
//
// A returned sale used to read as a plain green "Paid" in the counter's
// history, so a cashier reconciling the till saw a sale marked paid in
// full that had been half handed back over the counter.

test('an untouched sale has come back not at all', () => {
  assert.equal(returnState(SALE()), 'none');
});

test('a sale with one line partly back reads as partly returned', () => {
  const sale = { ...SALE(), returnedQuantities: { 0: 1 } };
  assert.equal(returnState(sale), 'partial');
  assert.equal(isFullyReturned(sale), false);
});

test('a sale with one line FULLY back is still only partly returned', () => {
  const sale = { ...SALE(), returnedQuantities: { 1: 2 } };
  assert.equal(returnState(sale), 'partial');
});

test('a sale with every line back reads as fully returned', () => {
  const sale = { ...SALE(), returnedQuantities: { 0: 3, 1: 2, 2: 1 } };
  assert.equal(returnState(sale), 'full');
  assert.equal(isFullyReturned(sale), true);
});

test('a zero entry in the map is not a return', () => {
  assert.equal(returnState({ ...SALE(), returnedQuantities: { 0: 0 } }), 'none');
});

test('a sale with nothing on it has no return state to report', () => {
  for (const sale of [null, undefined, {}, { items: [] }]) {
    assert.equal(returnState(sale), 'none');
  }
});

// ── Audit regressions: negotiated totals, batches, cumulative rounding ──

import { allocateSaleTotal, sumLineTotals } from './lineItems.js';
import { resolveReversalDeltas } from './inventory.js';

test('A NEGOTIATED SALE NEVER REFUNDS MORE THAN WAS COLLECTED (H01)', () => {
  // Listed at 1,000, cost 600, settled at 800.
  const line = { productId: 'p', productName: 'Chair', quantity: 1, unitPrice: 1000, costPrice: 600, lineTotal: 1000, lineCost: 600 };
  const sale = { id: 's', totalAmount: 800, costOfGoodsSold: 600, items: [line], isVoided: false, paymentMethod: 'Cash' };
  const returned = buildReturn(sale, { 0: 1 });
  assert.equal(returned.amount, 800, 'refund what was paid, not the shelf price');
  assert.equal(returned.costOfGoodsSold, 600);

  const refund = buildRefundDocument({ sale, returned, method: 'Cash', reason: '' });
  const summary = computeFinancials({ sales: [sale], refunds: [refund] });
  assert.equal(summary.revenue, 0);
  assert.equal(summary.costOfGoodsSold, 0);
  assert.equal(summary.grossProfit, 0);
});

test('a sale recorded with netLineTotal refunds each line its own share', () => {
  const items = allocateSaleTotal([
    { productId: 'a', quantity: 1, unitPrice: 600, lineTotal: 600, lineCost: 300 },
    { productId: 'b', quantity: 1, unitPrice: 400, lineTotal: 400, lineCost: 200 },
  ], 900);
  assert.equal(items[0].netLineTotal, 540);
  assert.equal(items[1].netLineTotal, 360);
  assert.equal(sumLineTotals(items), 1000, 'the list prices are left as they were');
  const sale = { id: 's', totalAmount: 900, items };
  assert.equal(buildReturn(sale, { 1: 1 }).amount, 360);
  assert.equal(buildReturn(sale, { 0: 1, 1: 1 }).amount, 900);
});

test('an unedited total adds nothing to the lines', () => {
  const items = [{ productId: 'a', quantity: 2, unitPrice: 50, lineTotal: 100 }];
  assert.equal(allocateSaleTotal(items, 100), items);
});

test('SUCCESSIVE PARTIAL RETURNS RESTORE THE LOTS THE UNITS CAME FROM (H12)', () => {
  const sale = {
    id: 's', totalAmount: 400,
    items: [{
      productId: 'drug', productName: 'Drug', quantity: 4, unitPrice: 100, lineTotal: 400,
      costPrice: 15, lineCost: 60,
      batchAllocations: [
        { batchId: 'A', quantity: 2, costPrice: 10 },
        { batchId: 'B', quantity: 2, costPrice: 20 },
      ],
    }],
  };
  const first = buildReturn(sale, { 0: 2 });
  assert.deepEqual(first.rows[0].batchAllocations.map((a) => [a.batchId, a.quantity]), [['A', 2]]);
  assert.equal(first.costOfGoodsSold, 20, 'the first two came from A at 10');

  const second = buildReturn({ ...sale, returnedQuantities: first.returnedQuantities }, { 0: 2 });
  assert.deepEqual(second.rows[0].batchAllocations.map((a) => [a.batchId, a.quantity]), [['B', 2]]);
  assert.equal(second.costOfGoodsSold, 40, 'the last two came from B at 20');

  const products = [{ id: 'drug', name: 'Drug', stock: 0 }];
  const a = resolveReversalDeltas(first.rows, products);
  const b = resolveReversalDeltas(second.rows, products);
  assert.deepEqual(a.drug.batches, { A: 2 });
  assert.deepEqual(b.drug.batches, { B: 2 });
});

test('CUMULATIVE PARTIAL REFUNDS ADD UP TO THE LINE, NEVER MORE (L01)', () => {
  const sale = {
    id: 's', totalAmount: 1.01,
    items: [{ productId: 'x', quantity: 3, unitPrice: 0.3367, lineTotal: 1.01, costPrice: 0.3333, lineCost: 1.0 }],
  };
  let current = sale;
  let refunded = 0;
  let cost = 0;
  for (let i = 0; i < 3; i++) {
    const r = buildReturn(current, { 0: 1 });
    refunded = Math.round((refunded + r.amount) * 100) / 100;
    cost = Math.round((cost + r.costOfGoodsSold) * 100) / 100;
    current = { ...current, returnedQuantities: r.returnedQuantities };
  }
  assert.equal(refunded, 1.01);
  assert.equal(cost, 1.0);
});

test('a returned recipe line puts back the ingredients it RECORDED using, not today\'s recipe', () => {
  const sale = {
    id: 's', totalAmount: 1500,
    items: [{
      productId: 'burger', productName: 'Burger', quantity: 3, unitPrice: 500, lineTotal: 1500,
      componentUsage: [{ productId: 'bun', quantity: 3 }, { productId: 'beef', quantity: 0.45 }],
    }],
  };
  // The recipe has since changed to 200 g of beef. It must not matter.
  const products = [
    { id: 'burger', name: 'Burger', recipe: [{ componentId: 'bun', quantity: 1 }, { componentId: 'beef', quantity: 0.2 }] },
    { id: 'bun', name: 'Bun', stock: 0 },
    { id: 'beef', name: 'Beef', unit: 'kilogram', stock: 0 },
  ];
  const one = buildReturn(sale, { 0: 1 });
  const deltas = resolveReversalDeltas(one.rows, products, { recipes: true });
  assert.equal(deltas.bun.total, 1);
  assert.equal(deltas.beef.total, 0.15);
  assert.equal(deltas.burger, undefined, 'a dish made to order has no stock of its own');
});
