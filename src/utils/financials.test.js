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