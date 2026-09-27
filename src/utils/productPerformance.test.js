import test from 'node:test';
import assert from 'node:assert/strict';
import { productPerformance } from './productPerformance.js';
import { buildReturn, buildRefundDocument } from './returns.js';

const line = (over = {}) => ({
  productId: 'p', productName: 'Chair', quantity: 1, unitPrice: 1000, costPrice: 600,
  lineTotal: 1000, lineCost: 600, ...over,
});

test('a product sold and fully returned in the period nets to nothing (H21)', () => {
  const sale = { id: 's', totalAmount: 1000, items: [line()] };
  const refund = buildRefundDocument({ sale, returned: buildReturn(sale, { 0: 1 }), method: 'Cash' });
  const [row] = productPerformance({ sales: [sale], refunds: [refund] });
  assert.equal(row.qty, 0);
  assert.equal(row.revenue, 0);
  assert.equal(row.profit, 0);
  assert.equal(row.returnedQty, 1);
  assert.equal(row.returnedRevenue, 1000);
});

test('a negotiated total is credited to the product at what was paid', () => {
  const sale = { id: 's', totalAmount: 800, items: [line()] };
  const [row] = productPerformance({ sales: [sale] });
  assert.equal(row.revenue, 800);
  assert.equal(row.profit, 200);
});

test('a voided sale contributes nothing; a credit sale contributes quantity only', () => {
  const rows = productPerformance({
    sales: [{ id: 'v', isVoided: true, totalAmount: 1000, items: [line()] }],
    creditSales: [{ id: 'c', status: 'pending', totalAmount: 1000, items: [line({ quantity: 2 })] }],
  });
  assert.equal(rows[0].qty, 2);
  assert.equal(rows[0].revenue, 0);
});
