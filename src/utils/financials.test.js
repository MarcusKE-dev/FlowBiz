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

  assert.equal(summary.totalCreditSales, 15000);
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

test('refunding a repaid credit sale reverses revenue, cogs, profit and receipts correctly', () => {
  const creditSale = { id: 'c1', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'refunded', amountPaid: 5000 };
  const summary = computeFinancials({
    sales: [],
    creditSales: [creditSale],
    allCreditSales: [creditSale],
    expenses: [],
    debtRepayments: [{ id: 'r1', creditSaleId: 'c1', amount: 5000, method: 'Cash' }],
    refunds: [{ id: 'ref1', creditSaleId: 'c1', amount: 5000, method: 'Cash' }],
  });

  assert.equal(summary.revenue, 0);
  assert.equal(summary.costOfGoodsSold, 0);
  assert.equal(summary.grossProfit, 0);
  assert.equal(summary.netProfit, 0);
  assert.equal(summary.totalCashReceipts, 0);
});