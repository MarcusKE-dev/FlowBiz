// src/utils/productPerformance.js
//
// What each product sold, earned and returned over a period — the one
// place the product tables on Reports and Analytics are added up.
//
// Both pages used to sum each sale line's SHELF price and never looked at
// returns, so a product sold and fully returned within the month still
// showed its whole revenue and profit while the headline figure beside it
// (computeFinancials, which does net refunds) showed zero. And a sale
// negotiated down at checkout credited each line its full list price.
//
// So a line contributes what it was actually PAID (its share of a
// negotiated total — see returns.paidLineTotals), and a return subtracts
// the quantity, money and cost that came back. Credit sales contribute
// quantity only, because under the collection policy this product
// implements their revenue is recognised as it is paid, not per product.

import { roundMoney } from './currency.js';
import { roundQuantity } from '../industry/units.js';
import { paidLineTotals, saleLineItems } from './returns.js';

export function productPerformance({ sales = [], creditSales = [], refunds = [] } = {}) {
  const rows = new Map();
  const ensure = (productId, name) => {
    const key = productId || name || 'Unnamed product';
    if (!rows.has(key)) {
      rows.set(key, {
        key, productId: productId || null, name: name || 'Unnamed product',
        qty: 0, revenue: 0, cost: 0, profit: 0, returnedQty: 0, returnedRevenue: 0,
      });
    }
    return rows.get(key);
  };

  for (const sale of sales || []) {
    if (sale?.isVoided) continue;
    const items = saleLineItems(sale);
    const paid = paidLineTotals(sale);
    items.forEach((item, index) => {
      const row = ensure(item.productId, item.productName);
      const cost = Number.isFinite(Number(item.lineCost))
        ? Number(item.lineCost)
        : (Number(item.costPrice) || 0) * (Number(item.quantity) || 0);
      row.qty += Number(item.quantity) || 0;
      row.revenue += Number(paid[index]) || 0;
      row.cost += cost;
    });
  }

  for (const cs of creditSales || []) {
    if (cs?.status === 'cancelled' || cs?.status === 'refunded') continue;
    for (const item of saleLineItems(cs)) {
      ensure(item.productId, item.productName).qty += Number(item.quantity) || 0;
    }
  }

  // A return of a cash or M-Pesa sale names what came back, line by line.
  // A credit refund carries no lines — its sale is already excluded above.
  for (const refund of refunds || []) {
    if (!Array.isArray(refund?.items)) continue;
    for (const item of refund.items) {
      const row = ensure(item.productId, item.productName);
      const quantity = Number(item.quantity) || 0;
      const money = Number(item.lineTotal) || 0;
      row.qty -= quantity;
      row.returnedQty += quantity;
      row.revenue -= money;
      row.returnedRevenue += money;
      row.cost -= Number(item.lineCost) || 0;
    }
  }

  return [...rows.values()].map((row) => ({
    ...row,
    qty: roundQuantity(row.qty, 'metre'),
    returnedQty: roundQuantity(row.returnedQty, 'metre'),
    revenue: roundMoney(row.revenue),
    returnedRevenue: roundMoney(row.returnedRevenue),
    cost: roundMoney(row.cost),
    profit: roundMoney(row.revenue - row.cost),
  }));
}
