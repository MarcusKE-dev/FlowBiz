// src/domain/fnb/check.test.js
//
// The check: discounts, service charges and split payments — and, above
// everything else, the property that made all three safe to add.
//
// THE COMPATIBILITY CONTRACT. `totalAmount` on a sale means "the money
// this sale brought in", and it meant that before any of this existed.
// Every test below that touches a total is really testing that contract,
// because it is what lets a restaurant discount a bill and split the
// payment three ways while a duka's close-of-day arithmetic stays
// byte-for-byte what it was.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeCheck, normalizeDiscount, discountAmountOn, normalizeServiceChargeRate,
  checkSaleFields, DISCOUNT_TYPES, MAX_SERVICE_CHARGE_PERCENT,
} from './check.js';
import {
  normalizeTenders, tenderProblem, saleTenders, tenderedIn, dominantMethod,
  tenderSaleFields, tendersTotal,
} from '../../utils/tenders.js';
import { computeFinancials } from '../../utils/financials.js';

const lines = [
  { lineTotal: 1000, lineCost: 400 },
  { lineTotal: 500, lineCost: 150 },
];

// ── Order of operations ──────────────────────────────────────────────

test('a plain check is its lines, and nothing is invented', () => {
  const check = computeCheck(lines);
  assert.equal(check.grossAmount, 1500);
  assert.equal(check.discountAmount, 0);
  assert.equal(check.netSales, 1500);
  assert.equal(check.serviceChargeAmount, 0);
  assert.equal(check.totalAmount, 1500);
  assert.equal(check.costOfGoodsSold, 550);
  assert.equal(check.grossProfit, 950);
});

test('the service charge is taken on the DISCOUNTED amount, not the gross', () => {
  // The only order that is defensible to a customer reading the bill, and
  // the order every hospitality system uses.
  const check = computeCheck(lines, {
    discount: { type: DISCOUNT_TYPES.AMOUNT, value: 500 },
    serviceChargeRate: 10,
  });
  assert.equal(check.grossAmount, 1500);
  assert.equal(check.netSales, 1000);
  assert.equal(check.serviceChargeAmount, 100, '10% of 1000, not of 1500');
  assert.equal(check.totalAmount, 1100);
});

test('a discount does not make the food cheaper to buy', () => {
  const check = computeCheck(lines, { discount: { type: 'percent', value: 50 } });
  assert.equal(check.costOfGoodsSold, 550, 'cost is untouched by a discount');
  assert.equal(check.netSales, 750);
  assert.equal(check.grossProfit, 200, 'the margin genuinely fell, and that is the fact to show');
});

test('a discount can take a check to zero and never below it', () => {
  // A sale that pays the customer would put the till out by the
  // difference and nobody would know where to look.
  assert.equal(discountAmountOn(1500, { type: 'amount', value: 99999 }), 1500);
  const check = computeCheck(lines, { discount: { type: 'amount', value: 99999 } });
  assert.equal(check.totalAmount, 0);
  assert.ok(check.totalAmount >= 0);
});

test('a percentage discount is bounded at a hundred', () => {
  assert.equal(normalizeDiscount({ type: 'percent', value: 500 }).value, 100);
});

test('a malformed discount is NO discount, never a partial one', () => {
  for (const bad of [null, undefined, {}, { type: 'percent' }, { value: 'lots' }, { type: 'percent', value: -5 }, { type: 'amount', value: 0 }]) {
    assert.equal(normalizeDiscount(bad), null, `${JSON.stringify(bad)} must not become a discount`);
  }
});

test('a service-charge rate is bounded, because it multiplies into every bill', () => {
  assert.equal(normalizeServiceChargeRate(999), MAX_SERVICE_CHARGE_PERCENT);
  assert.equal(normalizeServiceChargeRate(-5), 0);
  assert.equal(normalizeServiceChargeRate('abc'), 0);
  assert.equal(normalizeServiceChargeRate(10), 10);
});

test('a check with no discount and no service charge writes NEITHER field', () => {
  // This is the compatibility guarantee in one assertion: a retail sale is
  // byte-for-byte the document it always was.
  assert.deepEqual(checkSaleFields(computeCheck(lines)), {});
});

test('a discounted check records what it was before, and why', () => {
  const check = computeCheck(lines, { discount: { type: 'amount', value: 200, reason: 'Cold main' } });
  const fields = checkSaleFields(check);
  assert.equal(fields.grossAmount, 1500);
  assert.equal(fields.discountAmount, 200);
  assert.equal(fields.discountReason, 'Cold main');
});

// ── Tenders ──────────────────────────────────────────────────────────

test('a legacy sale is one tender, exactly as its payment method always meant', () => {
  const legacy = { paymentMethod: 'M-Pesa', totalAmount: 1500 };
  assert.deepEqual(saleTenders(legacy), [{ method: 'M-Pesa', amount: 1500 }]);
  assert.equal(tenderedIn(legacy, 'M-Pesa'), 1500);
  assert.equal(tenderedIn(legacy, 'Cash'), 0);
});

test('a split sale reports each method separately', () => {
  const split = { paymentMethod: 'Cash', totalAmount: 3500, tenders: [
    { method: 'Cash', amount: 2000 }, { method: 'M-Pesa', amount: 1500 },
  ] };
  assert.equal(tenderedIn(split, 'Cash'), 2000);
  assert.equal(tenderedIn(split, 'M-Pesa'), 1500);
  assert.equal(tendersTotal(saleTenders(split)), 3500);
});

test('tenders must settle the bill exactly — no overpayment, no shortfall', () => {
  const exact = [{ method: 'Cash', amount: 600 }, { method: 'M-Pesa', amount: 400 }];
  assert.equal(tenderProblem(exact, 1000), null);
  assert.match(tenderProblem([{ method: 'Cash', amount: 1200 }], 1000), /more than the bill/i);
  assert.match(tenderProblem([{ method: 'Cash', amount: 800 }], 1000), /still unpaid/i);
  assert.match(tenderProblem([], 1000), /at least one payment/i);
});

test('a split sale is filed under the method that paid the most', () => {
  assert.equal(dominantMethod([{ method: 'Cash', amount: 100 }, { method: 'M-Pesa', amount: 900 }]), 'M-Pesa');
  assert.equal(dominantMethod([{ method: 'Cash', amount: 900 }, { method: 'M-Pesa', amount: 100 }]), 'Cash');
  assert.equal(dominantMethod([{ method: 'Cash', amount: 500 }, { method: 'M-Pesa', amount: 500 }]), 'Cash', 'ties go to cash');
  assert.equal(dominantMethod([]), 'Cash');
});

test('a single-tender sale stores no tenders array at all', () => {
  assert.deepEqual(tenderSaleFields([{ method: 'Cash', amount: 500 }]), {});
  assert.ok('tenders' in tenderSaleFields([{ method: 'Cash', amount: 300 }, { method: 'M-Pesa', amount: 200 }]));
});

test('rubbish in a tender list is dropped, not stored', () => {
  const clean = normalizeTenders([
    { method: 'Cash', amount: 100 },
    { method: 'Bitcoin', amount: 500 },
    { method: 'M-Pesa', amount: 0 },
    { method: 'M-Pesa', amount: -50 },
    null,
  ]);
  assert.deepEqual(clean, [{ method: 'Cash', amount: 100 }]);
});

// ── The financial engine, before and after ───────────────────────────

const legacySales = [
  { paymentMethod: 'Cash', totalAmount: 1000, costOfGoodsSold: 400 },
  { paymentMethod: 'M-Pesa', totalAmount: 500, costOfGoodsSold: 200 },
  { paymentMethod: 'Cash', totalAmount: 300, costOfGoodsSold: 100, isVoided: true },
];

test('NOTHING MOVED: a business with no tenders, discounts or waste reports what it always did', () => {
  const summary = computeFinancials({ sales: legacySales });
  assert.equal(summary.totalCashSales, 1000);
  assert.equal(summary.totalMpesaSales, 500);
  assert.equal(summary.revenue, 1500);
  assert.equal(summary.costOfGoodsSold, 600);
  assert.equal(summary.grossProfit, 900);
  assert.equal(summary.netProfit, 900, 'no expenses, no waste');
  assert.equal(summary.totalWasteCost, 0);
  assert.equal(summary.totalDiscounts, 0);
  assert.equal(summary.totalServiceCharges, 0);
  assert.equal(summary.netSales, 1500);
});

test('a split-tender sale reaches the till in the right proportions', () => {
  const summary = computeFinancials({ sales: [{
    paymentMethod: 'Cash', totalAmount: 3500, costOfGoodsSold: 1000,
    tenders: [{ method: 'Cash', amount: 2000 }, { method: 'M-Pesa', amount: 1500 }],
  }] });
  assert.equal(summary.totalCashSales, 2000, 'not the whole 3500 under cash');
  assert.equal(summary.totalMpesaSales, 1500);
  assert.equal(summary.revenue, 3500, 'and the revenue is still the whole bill, once');
  assert.equal(summary.totalCashReceipts, 2000);
  assert.equal(summary.totalMpesaReceipts, 1500);
});

test('a discount is already inside the total, and is reported so it can be seen', () => {
  // The sale was 1500 gross, 200 off, so 1300 was collected. Revenue must
  // be 1300 — the discount must NOT be subtracted a second time.
  const summary = computeFinancials({ sales: [{
    paymentMethod: 'Cash', totalAmount: 1300, grossAmount: 1500,
    discountAmount: 200, costOfGoodsSold: 550,
  }] });
  assert.equal(summary.revenue, 1300);
  assert.equal(summary.totalDiscounts, 200);
  assert.equal(summary.grossProfit, 750);
});

test('a service charge is revenue, and is held out of net sales', () => {
  const summary = computeFinancials({ sales: [{
    paymentMethod: 'Cash', totalAmount: 1100, grossAmount: 1000,
    serviceChargeAmount: 100, costOfGoodsSold: 400,
  }] });
  assert.equal(summary.revenue, 1100, 'the business did receive it');
  assert.equal(summary.totalServiceCharges, 100);
  assert.equal(summary.netSales, 1000, 'food cost percentage is measured against this');
});

test('WASTE REACHES PROFIT, because stock thrown away is money gone', () => {
  const withoutWaste = computeFinancials({ sales: legacySales });
  const withWaste = computeFinancials({
    sales: legacySales,
    wasteRecords: [{ totalCost: 250 }, { totalCost: 100 }],
  });
  assert.equal(withWaste.totalWasteCost, 350);
  assert.equal(withWaste.grossProfit, withoutWaste.grossProfit, 'margin on what was SOLD is unchanged');
  assert.equal(withWaste.netProfit, withoutWaste.netProfit - 350,
    'a business that bins a crate of milk must not look more profitable for it');
});
