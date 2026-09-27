// ACCOUNTING DOES NOT DEPEND ON WHERE THE BUSINESS IS.
//
// Regional settings change labels — the currency marker, what the
// non-cash tender is called, which clock a day is counted on. They must
// never change a single number the financial engine produces. These tests
// run the same books under several regions and require identical output,
// and pin the cash-basis invariants in a non-Kenyan business explicitly.

import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFinancials, computeExpectedTillBalances } from './financials.js';
import { setActiveRegion } from '../lib/region/region.js';
import { businessDayKey, startOfBusinessDay, endOfBusinessDay } from '../lib/region/time.js';

const day = new Date('2026-09-26T15:00:00Z');

// A day's books: two cash/"digital" sales, a credit sale, a partial
// repayment, an expense and a refund. Amounts deliberately include cents.
const books = {
  sales: [
    { id: 's1', paymentMethod: 'Cash', totalAmount: 120.5, totalCost: 80.25, soldAt: day },
    { id: 's2', paymentMethod: 'M-Pesa', totalAmount: 99.99, totalCost: 60, soldAt: day },
    { id: 's3', paymentMethod: 'Cash', totalAmount: 50, totalCost: 30, soldAt: day, isVoided: true },
  ],
  creditSales: [
    { id: 'c1', totalAmount: 200, totalCost: 120, amountPaid: 50, remainingBalance: 150, status: 'partial', soldAt: day },
  ],
  debtRepayments: [
    { id: 'r1', creditSaleId: 'c1', amount: 50, method: 'M-Pesa', costPortion: 30, paidAt: day },
  ],
  expenses: [{ id: 'e1', amount: 25.25, paymentMethod: 'Cash', category: 'Transport', recordedAt: day }],
};

const REGIONS = [null, { country: 'US', timezone: 'America/Chicago' }, { country: 'GB' }, { country: 'JP' }, { country: 'UG' }];

test('computeFinancials gives byte-identical results in every region', () => {
  const results = REGIONS.map((region) => {
    setActiveRegion(region);
    try {
      return JSON.stringify(computeFinancials(books));
    } finally {
      setActiveRegion(null);
    }
  });
  for (const r of results) assert.equal(r, results[0]);
});

test('cash basis holds in a US business: credit is not revenue until repaid', () => {
  setActiveRegion({ country: 'US' });
  try {
    const f = computeFinancials(books);
    // Voided sale excluded; credit sale counts only through its repayment.
    assert.equal(f.totalCashSales, 120.5);
    assert.equal(f.totalMpesaSales, 99.99, 'the "Card" tender still totals under the internal M-Pesa key');
    assert.equal(f.totalCreditSales, 200);
    assert.equal(f.totalDebtRepayments, 50);
    const till = computeExpectedTillBalances({
      openingCashFloat: 100, openingMpesaFloat: 0,
      totalCashSales: f.totalCashSales, totalMpesaSales: f.totalMpesaSales,
      totalDebtRepaymentsCash: f.totalDebtRepaymentsCash, totalDebtRepaymentsMpesa: f.totalDebtRepaymentsMpesa,
      totalExpensesCash: f.totalExpensesCash, totalExpensesMpesa: f.totalExpensesMpesa,
    });
    assert.equal(Math.round(till.expectedCashAtClose * 100) / 100, 195.25);
    assert.equal(Math.round(till.expectedMpesaAtClose * 100) / 100, 149.99);
  } finally {
    setActiveRegion(null);
  }
});

test('a sale at 23:30 local time lands in that local business day, not UTC\'s', () => {
  // 04:30Z on the 27th is 23:30 on the 26th in Chicago (CDT, UTC-5).
  const late = new Date('2026-09-27T04:30:00Z');
  const tz = 'America/Chicago';
  assert.equal(businessDayKey(late, tz), '2026-09-26');
  const start = startOfBusinessDay(new Date('2026-09-26T12:00:00Z'), tz);
  const end = endOfBusinessDay(new Date('2026-09-26T12:00:00Z'), tz);
  assert.ok(late >= start && late <= end, 'the late sale is inside the 26th\'s report range');
  // …and in Nairobi the same instant is already the 27th.
  assert.equal(businessDayKey(late, 'Africa/Nairobi'), '2026-09-27');
});
