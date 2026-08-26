import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFinancials, computeExpectedTillBalances, computeSupplierBalances } from './financials.js';

test('1. Cash Sale creates immediate revenue, COGS, gross profit, and cash receipts', () => {
  const sale = {
    id: 's1',
    totalAmount: 1500,
    costPricePerUnit: 1000,
    quantity: 1,
    paymentMethod: 'Cash',
    isVoided: false,
  };
  const summary = computeFinancials({ sales: [sale] });

  assert.equal(summary.revenue, 1500);
  assert.equal(summary.costOfGoodsSold, 1000);
  assert.equal(summary.grossProfit, 500);
  assert.equal(summary.totalCashReceipts, 1500);
  assert.equal(summary.totalMpesaReceipts, 0);
});

test('2. Unpaid Credit Sale contributes zero revenue, COGS, and profit', () => {
  const creditSale = {
    id: 'c1',
    costPricePerUnit: 2000,
    quantity: 1,
    totalAmount: 3000,
    status: 'pending',
    amountPaid: 0,
  };
  const summary = computeFinancials({
    creditSales: [creditSale],
    allCreditSales: [creditSale],
  });

  assert.equal(summary.totalCreditSales, 3000);
  assert.equal(summary.revenue, 0);
  assert.equal(summary.costOfGoodsSold, 0);
  assert.equal(summary.grossProfit, 0);
  assert.equal(summary.netProfit, 0);
});

test('3. Partial Debt Repayment recognizes proportional revenue and COGS', () => {
  const creditSale = {
    id: 'c1',
    costPricePerUnit: 2000,
    quantity: 1,
    totalAmount: 3000,
    status: 'partial',
    amountPaid: 1000,
  };
  const summary = computeFinancials({
    creditSales: [creditSale],
    allCreditSales: [creditSale],
    debtRepayments: [{ id: 'r1', creditSaleId: 'c1', amount: 1000, method: 'Cash' }],
  });

  assert.equal(summary.revenue, 1000);
  assert.equal(Math.round(summary.costOfGoodsSold * 100) / 100, 666.67);
  assert.equal(Math.round(summary.grossProfit * 100) / 100, 333.33);
  assert.equal(summary.totalCashReceipts, 1000);
});

test('4. Full Debt Repayment recognizes full revenue and COGS', () => {
  const creditSale = {
    id: 'c1',
    costPricePerUnit: 2000,
    quantity: 1,
    totalAmount: 3000,
    status: 'paid',
    amountPaid: 3000,
  };
  const summary = computeFinancials({
    allCreditSales: [creditSale],
    debtRepayments: [
      { id: 'r1', creditSaleId: 'c1', amount: 1000, method: 'Cash' },
      { id: 'r2', creditSaleId: 'c1', amount: 2000, method: 'M-Pesa' },
    ],
  });

  assert.equal(summary.revenue, 3000);
  assert.equal(summary.costOfGoodsSold, 2000);
  assert.equal(summary.grossProfit, 1000);
  assert.equal(summary.totalCashReceipts, 1000);
  assert.equal(summary.totalMpesaReceipts, 2000);
});

test('5. Net Refund Exceeding Sales correctly produces negative net revenue and profit without zero-clamping', () => {
  const creditSale = {
    id: 'c1',
    costPricePerUnit: 3000,
    quantity: 1,
    totalAmount: 5000,
    status: 'refunded',
  };
  const summary = computeFinancials({
    sales: [{ totalAmount: 1000, costPricePerUnit: 600, quantity: 1, paymentMethod: 'Cash', isVoided: false }],
    allCreditSales: [creditSale],
    refunds: [{ id: 'ref1', creditSaleId: 'c1', amount: 5000, method: 'Cash' }],
  });

  assert.equal(summary.revenue, -4000);
  assert.equal(summary.costOfGoodsSold, -2400);
  assert.equal(summary.grossProfit, -1600);
  assert.equal(summary.totalCashReceipts, -4000);
});

test('6. Expected Till Balances maintain exact cash and M-Pesa float reconciliation', () => {
  const balances = computeExpectedTillBalances({
    openingCashFloat: 2000,
    openingMpesaFloat: 5000,
    totalCashSales: 4500,
    totalMpesaSales: 8000,
    totalDebtRepaymentsCash: 1500,
    totalDebtRepaymentsMpesa: 2000,
    totalExpensesCash: 800,
    totalExpensesMpesa: 500,
    totalCashOutflows: 1200, // stock purchases + supplier payments + refunds
    totalMpesaOutflows: 0,
  });

  // Expected Cash: 2000 + 4500 + 1500 - 800 - 1200 = 6000
  assert.equal(balances.expectedCashAtClose, 6000);
  // Expected M-Pesa: 5000 + 8000 + 2000 - 500 - 0 = 14500
  assert.equal(balances.expectedMpesaAtClose, 14500);
});

test('7. Supplier balance aggregation correctly matches purchases and payments', () => {
  const purchases = [
    { supplierId: 's1', totalCost: 10000, paymentStatus: 'pending_supplier_credit' },
    { supplierId: 's1', totalCost: 5000, paymentStatus: 'pending_supplier_credit' },
    { supplierId: 's2', totalCost: 8000, paymentStatus: 'paid' },
  ];
  const payments = [
    { supplierId: 's1', amount: 6000 },
  ];
  const suppliers = [
    { id: 's1', name: 'Wholesaler Alpha' },
    { id: 's2', name: 'Wholesaler Beta' },
  ];

  const balances = computeSupplierBalances(purchases, payments, suppliers);
  assert.equal(balances.length, 1);
  assert.equal(balances[0].supplierId, 's1');
  assert.equal(balances[0].balance, 9000);
});

test('8. Multi-item cart sale uses costOfGoodsSold aggregate properly', () => {
  const multiSale = {
    id: 's_multi',
    totalAmount: 2250,
    costOfGoodsSold: 1320,
    profit: 930,
    quantity: 6,
    paymentMethod: 'Cash',
    isVoided: false,
    items: [
      { productId: 'p1', productName: 'Book', quantity: 3, unitPrice: 500, costPrice: 300, lineTotal: 1500, lineCost: 900 },
      { productId: 'p2', productName: 'Storybook', quantity: 2, unitPrice: 350, costPrice: 200, lineTotal: 700, lineCost: 400 },
      { productId: 'p3', productName: 'Pen', quantity: 1, unitPrice: 50, costPrice: 20, lineTotal: 50, lineCost: 20 },
    ]
  };
  const summary = computeFinancials({ sales: [multiSale] });
  assert.equal(summary.revenue, 2250);
  assert.equal(summary.costOfGoodsSold, 1320);
  assert.equal(summary.grossProfit, 930);
});

test('9. Voided sales are excluded from active calculations', () => {
  const voidedSale = {
    id: 's_void',
    totalAmount: 5000,
    costPricePerUnit: 3000,
    quantity: 1,
    paymentMethod: 'Cash',
    isVoided: true,
  };
  const validSale = {
    id: 's_valid',
    totalAmount: 2000,
    costPricePerUnit: 1200,
    quantity: 1,
    paymentMethod: 'Cash',
    isVoided: false,
  };
  const summary = computeFinancials({ sales: [voidedSale, validSale] });
  assert.equal(summary.revenue, 2000);
  assert.equal(summary.costOfGoodsSold, 1200);
  assert.equal(summary.grossProfit, 800);
  assert.equal(summary.totalCashReceipts, 2000);
});

test('10. Expenses exclude supplier payments and stock purchases to prevent double-counting', () => {
  const expenses = [
    { id: 'e1', category: 'Rent', amount: 15000, paymentMethod: 'Cash' },
    { id: 'e2', category: 'Electricity', amount: 2500, paymentMethod: 'M-Pesa' },
    { id: 'e3', category: 'Supplier Payment', description: 'Supplier payment to Alpha', amount: 6000, paymentMethod: 'Cash' },
    { id: 'e4', category: 'Other', description: 'Stock Purchase direct', amount: 4000, paymentMethod: 'Cash' },
  ];
  const summary = computeFinancials({ expenses });
  assert.equal(summary.totalExpenses, 17500);
  assert.equal(summary.totalExpensesCash, 15000);
  assert.equal(summary.totalExpensesMpesa, 2500);
});