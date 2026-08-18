import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFinancials } from './financials.js';

test('a credit sale alone contributes zero revenue, COGS, and profit until repaid', () => {
  const creditSale = { id: 'c1', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'pending', amountPaid: 0 };
  const summary = computeFinancials({
    sales: [],
    creditSales: [creditSale],
    allCreditSales: [creditSale],
    expenses: [],
    debtRepayments: [],
  });

  assert.equal(summary.totalCreditSales, 15000); // still tracked as business activity
  assert.equal(summary.revenue, 0);
  assert.equal(summary.costOfGoodsSold, 0);
  assert.equal(summary.grossProfit, 0);
  assert.equal(summary.netProfit, 0);
  assert.equal(summary.totalCashReceipts, 0);
  assert.equal(summary.totalMpesaReceipts, 0);
});

test('a full debt repayment recognizes the full sale as revenue, COGS, and profit', () => {
  const creditSale = { id: 'c1', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'paid', amountPaid: 15000 };
  const summary = computeFinancials({
    sales: [],
    creditSales: [],
    allCreditSales: [creditSale],
    expenses: [],
    debtRepayments: [{ id: 'r1', creditSaleId: 'c1', amount: 15000, method: 'Cash' }],
  });

  assert.equal(summary.revenue, 15000);
  assert.equal(summary.costOfGoodsSold, 10000);
  assert.equal(summary.grossProfit, 5000);
  assert.equal(summary.netProfit, 5000);
  assert.equal(summary.totalCashReceipts, 15000);
});

test('a partial debt repayment recognizes revenue, COGS, and profit proportionally', () => {
  const creditSale = { id: 'c1', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'partial', amountPaid: 5000 };
  const summary = computeFinancials({
    sales: [],
    creditSales: [],
    allCreditSales: [creditSale],
    expenses: [],
    debtRepayments: [{ id: 'r1', creditSaleId: 'c1', amount: 5000, method: 'Cash' }],
  });

  // 5000 / 15000 of the sale collected so far → 1/3 of its cost basis
  assert.equal(summary.revenue, 5000);
  assert.ok(Math.abs(summary.costOfGoodsSold - 10000 / 3) < 0.01);
  assert.ok(Math.abs(summary.netProfit - (5000 - 10000 / 3)) < 0.01);
});

test('a repayment on a credit sale from an earlier period still finds its cost basis', () => {
  // Simulates: sale happened last month (not in `creditSales`, which is
  // period-scoped), repayment happens today. `allCreditSales` is what
  // makes the lookup work regardless of period.
  const creditSale = { id: 'c1', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'paid', amountPaid: 15000 };
  const summary = computeFinancials({
    sales: [],
    creditSales: [], // not sold this period
    allCreditSales: [creditSale],
    expenses: [],
    debtRepayments: [{ id: 'r1', creditSaleId: 'c1', amount: 15000, method: 'M-Pesa' }],
  });

  assert.equal(summary.revenue, 15000);
  assert.equal(summary.costOfGoodsSold, 10000);
  assert.equal(summary.netProfit, 5000);
});

test('cancelled and refunded credit sales are excluded from the Credit Sales metric', () => {
  const summary = computeFinancials({
    sales: [],
    creditSales: [
      { id: 'c1', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'cancelled' },
      { id: 'c2', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'refunded' },
    ],
    expenses: [],
    debtRepayments: [],
  });

  assert.equal(summary.totalCreditSales, 0);
  assert.equal(summary.revenue, 0);
  assert.equal(summary.netProfit, 0);
});

test('refunds reduce expected cash/M-Pesa till balance, same as any other outflow', () => {
  const summary = computeFinancials({
    sales: [], creditSales: [], expenses: [], debtRepayments: [],
    refunds: [{ amount: 2000, method: 'Cash' }],
  });

  assert.equal(summary.totalRefundsCash, 2000);
  assert.equal(summary.totalCashOutflows, 2000);
});

test('voided sales do not affect cash sales or profit', () => {
  const summary = computeFinancials({
    sales: [{ id: 's1', paymentMethod: 'Cash', totalAmount: 15000, costPricePerUnit: 10000, quantity: 1, isVoided: true }],
    creditSales: [],
    expenses: [],
    debtRepayments: [],
  });

  assert.equal(summary.totalCashSales, 0);
  assert.equal(summary.netProfit, 0);
});

test('purchase and supplier payments only affect outflows, not profit', () => {
  const summary = computeFinancials({
    sales: [],
    creditSales: [],
    expenses: [{ amount: 50000, paymentMethod: 'Cash', category: 'Stock Purchase' }],
    debtRepayments: [],
    purchases: [{ paymentStatus: 'paid', paymentMethod: 'Cash', totalCost: 50000 }],
    supplierPayments: [{ method: 'Cash', amount: 50000 }],
  });

  assert.equal(summary.totalExpenses, 0);
  assert.equal(summary.netProfit, 0);
  assert.equal(summary.totalCashOutflows, 100000);
});

// ── Multi-product cart (Counter.jsx) ───────────────────────────────────
// A multi-item cart sale stores its aggregate cost of goods sold directly
// on the doc (`costOfGoodsSold`), since a single costPricePerUnit can't
// represent several products at different cost prices in one line.

test('a multi-item cart sale uses its stored costOfGoodsSold instead of costPricePerUnit × quantity', () => {
  // Book ×3 @500 (cost 300) + Storybook ×2 @350 (cost 200) + Pen ×1 @50 (cost 20)
  // revenue = 1500 + 700 + 50 = 2250; cost = 900 + 400 + 20 = 1320
  const cartSale = {
    id: 's1', paymentMethod: 'Cash', quantity: 6, totalAmount: 2250, costOfGoodsSold: 1320,
    profit: 930, isVoided: false,
  };
  const summary = computeFinancials({ sales: [cartSale], creditSales: [], expenses: [], debtRepayments: [] });

  assert.equal(summary.totalCashSales, 2250);
  assert.equal(summary.costOfGoodsSold, 1320);
  assert.equal(summary.grossProfit, 930);
  assert.equal(summary.netProfit, 930);
});

test('a legacy single-product sale without costOfGoodsSold still falls back correctly', () => {
  const legacySale = { id: 's1', paymentMethod: 'Cash', quantity: 2, totalAmount: 1000, costPricePerUnit: 300, isVoided: false };
  const summary = computeFinancials({ sales: [legacySale], creditSales: [], expenses: [], debtRepayments: [] });

  assert.equal(summary.costOfGoodsSold, 600);
  assert.equal(summary.grossProfit, 400);
});

test('a partial repayment on a multi-item credit sale recognizes COGS from the stored aggregate', () => {
  const creditSale = { id: 'c1', quantity: 4, totalAmount: 2000, costOfGoodsSold: 1200, status: 'partial', amountPaid: 1000 };
  const summary = computeFinancials({
    sales: [],
    creditSales: [],
    allCreditSales: [creditSale],
    expenses: [],
    debtRepayments: [{ id: 'r1', creditSaleId: 'c1', amount: 1000, method: 'Cash' }],
  });

  // Half the sale collected → half its aggregate cost basis recognized
  assert.equal(summary.revenue, 1000);
  assert.equal(summary.costOfGoodsSold, 600);
  assert.equal(summary.netProfit, 400);
});
