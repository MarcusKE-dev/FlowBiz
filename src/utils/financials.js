// src/utils/financials.js
//
// THE ONE PLACE MONEY IS ADDED UP. Close of day, the dashboard, every
// report and every export read this function, so a mistake here is a
// mistake everywhere and it is a mistake about cash.
//
// Three things it used to get wrong, all of them about a sale that is not
// the simplest possible sale:
//
//   SPLIT TENDER. A sale paid 2,000 cash and 1,500 M-Pesa was filed under
//   `paymentMethod`, which holds the method that paid the LARGER share —
//   so the whole 3,500 landed under cash. Revenue was right and the till
//   was wrong, which is the worst combination: the totals reconcile, so
//   nothing looks broken, and the cashier is 1,500 short at close of day
//   with no way to explain it. Cash and M-Pesa are now allocated from the
//   sale's actual tenders (utils/tenders.js), which for every sale that
//   has only ever had one payment method returns exactly what
//   `paymentMethod` always meant.
//
//   WASTE NEVER REACHED PROFIT. Stock thrown away is money gone. Leaving
//   it out made a business that binned a crate of milk look MORE
//   profitable than one that sold it at cost.
//
//   DISCOUNTS AND SERVICE CHARGES WERE INVISIBLE. Both are already inside
//   `totalAmount` — the total is what was actually collected and that
//   does not change — but neither was reported, so there was no way to
//   see how much had been given away, and no way to measure margin
//   against net sales rather than against a total inflated by a service
//   charge.
//
// WHAT DID NOT CHANGE, and must not: `totalAmount` still means "the money
// this sale brought in", `revenue` is still the sum of what was received,
// and a business with no tenders, no discounts and no waste reports
// exactly what it always did, to the cent.

import { tenderedIn } from './tenders.js';
import { roundMoney } from './currency.js';

function sumBy(rows, field) {
  return rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
}

function getCostOfSale(row) {
  if (row && typeof row.costOfGoodsSold === 'number' && Number.isFinite(row.costOfGoodsSold)) {
    return row.costOfGoodsSold;
  }
  const costPerUnit = Number(row?.costPricePerUnit) || 0;
  const quantity = Number(row?.quantity) || 0;
  return costPerUnit * quantity;
}

export function isExpenseExcluded(expense) {
  const category = String(expense?.category || '').toLowerCase();
  const description = String(expense?.description || '').toLowerCase();
  return (
    category === 'stock purchase' ||
    category === 'supplier payment' ||
    description.includes('stock purchase') ||
    description.includes('supplier payment')
  );
}

function isCreditSaleReversed(creditSale) {
  return creditSale?.status === 'cancelled' || creditSale?.status === 'refunded';
}

function recognizeRepayment(repayment, creditSaleById) {
  const amount = Number(repayment?.amount) || 0;
  const creditSale = creditSaleById.get(repayment?.creditSaleId);
  if (!creditSale) {
    return { revenue: amount, cogs: 0 };
  }
  const totalAmount = Number(creditSale.totalAmount) || 0;
  const totalCost = getCostOfSale(creditSale);
  const ratio = totalAmount > 0 ? amount / totalAmount : 0;
  const cogs = totalCost * ratio;
  return { revenue: amount, cogs };
}

function recognizeRefund(refund, creditSaleById) {
  const amount = Number(refund?.amount) || 0;

  // SMALLEST SAFE EXTENSION to the financial engine, and the reason for
  // it. A credit refund can derive the cost it is reversing from the
  // credit sale it points at, in proportion to how much was paid. A
  // RETURN of a completed cash or M-Pesa sale has no such document to
  // look at — and it may be a PARTIAL return, so proportioning the whole
  // sale would be wrong anyway.
  //
  // So a return states the cost of exactly the goods that came back, and
  // this reads it when it is there. Every refund written before this — and
  // every credit refund written after it — carries no such field and
  // falls through to precisely the behaviour it has always had.
  const stated = Number(refund?.costOfGoodsSold);
  if (Number.isFinite(stated) && stated >= 0) {
    return { revenue: amount, cogs: stated };
  }

  const creditSale = creditSaleById.get(refund?.creditSaleId);
  if (!creditSale) {
    return { revenue: amount, cogs: 0 };
  }
  const totalAmount = Number(creditSale.totalAmount) || 0;
  const totalCost = getCostOfSale(creditSale);
  const ratio = totalAmount > 0 ? amount / totalAmount : 0;
  const cogs = totalCost * ratio;
  return { revenue: amount, cogs };
}

export function computeFinancials({
  sales = [],
  creditSales = [],
  allCreditSales = null,
  expenses = [],
  debtRepayments = [],
  purchases = [],
  supplierPayments = [],
  refunds = [],
  wasteRecords = [],
} = {}) {
  const activeSales = (sales || []).filter((sale) => !sale?.isVoided);
  const activeCreditSales = (creditSales || []).filter((cs) => !isCreditSaleReversed(cs));

  // ALLOCATED FROM THE TENDERS, not from `paymentMethod`.
  //
  // saleTenders() is the compatibility accessor: a sale with no `tenders`
  // array — which is every sale FlowBiz wrote before split payment
  // existed, and every single-method sale it writes now — yields the one
  // tender its `paymentMethod` and `totalAmount` have always meant. So
  // this is identical arithmetic for an ordinary shop, and correct
  // arithmetic for a bill settled two ways.
  const totalCashSales  = roundMoney(activeSales.reduce((acc, s) => acc + tenderedIn(s, 'Cash'), 0));
  const totalMpesaSales = roundMoney(activeSales.reduce((acc, s) => acc + tenderedIn(s, 'M-Pesa'), 0));

  const totalCreditSales = sumBy(activeCreditSales, 'totalAmount');

  const cashRepayments  = debtRepayments.filter(r => r.method === 'Cash');
  const mpesaRepayments = debtRepayments.filter(r => r.method === 'M-Pesa');
  const totalDebtRepaymentsCash  = sumBy(cashRepayments,  'amount');
  const totalDebtRepaymentsMpesa = sumBy(mpesaRepayments, 'amount');
  const totalDebtRepayments = totalDebtRepaymentsCash + totalDebtRepaymentsMpesa;

  const cashRefunds  = (refunds || []).filter(r => r.method === 'Cash');
  const mpesaRefunds = (refunds || []).filter(r => r.method === 'M-Pesa');
  const totalRefundsCash  = sumBy(cashRefunds,  'amount');
  const totalRefundsMpesa = sumBy(mpesaRefunds, 'amount');
  const totalRefunds = totalRefundsCash + totalRefundsMpesa;

  const creditSaleSource = allCreditSales || creditSales || [];
  const creditSaleById = new Map(creditSaleSource.map((cs) => [cs.id, cs]));

  let repaymentRevenue = 0;
  let repaymentCogs = 0;
  (debtRepayments || []).forEach((r) => {
    const { revenue, cogs } = recognizeRepayment(r, creditSaleById);
    repaymentRevenue += revenue;
    repaymentCogs += cogs;
  });

  let refundRevenue = 0;
  let refundCogs = 0;
  (refunds || []).forEach((ref) => {
    const { revenue, cogs } = recognizeRefund(ref, creditSaleById);
    refundRevenue += revenue;
    refundCogs += cogs;
  });

  const directSalesCostOfGoodsSold = activeSales.reduce((acc, s) => acc + getCostOfSale(s), 0);
  const costOfGoodsSold = directSalesCostOfGoodsSold + repaymentCogs - refundCogs;

  const grossSalesRevenue = totalCashSales + totalMpesaSales + totalCreditSales;
  const revenue = totalCashSales + totalMpesaSales + repaymentRevenue - refundRevenue;
  const grossProfit = revenue - costOfGoodsSold;

  // WHAT WAS GIVEN AWAY, and what was charged for service. Both are
  // already inside `totalAmount` and neither is subtracted again here —
  // they are reported so they can be SEEN. A sale with neither field
  // contributes zero, which is every retail sale.
  const totalDiscounts = roundMoney(activeSales.reduce(
    (acc, s) => acc + (Number(s?.discountAmount) || 0), 0));
  const totalServiceCharges = roundMoney(activeSales.reduce(
    (acc, s) => acc + (Number(s?.serviceChargeAmount) || 0), 0));

  // Net sales — the trade itself, with a service charge held out of it.
  // Margin measured against a total inflated by service charge flatters
  // the food cost, so this is the figure that ratio is taken against.
  const netSales = roundMoney(revenue - totalServiceCharges);

  // STOCK THROWN AWAY IS MONEY GONE. It does not touch gross profit —
  // the margin on what was SOLD is unaffected by what was binned — but it
  // absolutely reaches net profit, or a business that wastes a crate of
  // milk looks more profitable for having done it.
  const totalWasteCost = roundMoney(sumBy(wasteRecords || [], 'totalCost'));

  const filteredExpenses = (expenses || []).filter((expense) => !isExpenseExcluded(expense));
  const cashExpenses  = filteredExpenses.filter(e => e.paymentMethod === 'Cash');
  const mpesaExpenses = filteredExpenses.filter(e => e.paymentMethod === 'M-Pesa');
  const totalExpensesCash  = sumBy(cashExpenses,  'amount');
  const totalExpensesMpesa = sumBy(mpesaExpenses, 'amount');
  const totalExpenses = totalExpensesCash + totalExpensesMpesa;
  const netProfit     = roundMoney(grossProfit - totalExpenses - totalWasteCost);

  // Realized net receipts by tender method
  const totalCashReceipts  = totalCashSales  + totalDebtRepaymentsCash  - totalRefundsCash;
  const totalMpesaReceipts = totalMpesaSales + totalDebtRepaymentsMpesa - totalRefundsMpesa;

  const purchasePaymentsCash  = (purchases || []).filter((p) => p.paymentStatus === 'paid' && p.paymentMethod === 'Cash');
  const purchasePaymentsMpesa = (purchases || []).filter((p) => p.paymentStatus === 'paid' && p.paymentMethod === 'M-Pesa');
  const supplierPaymentsCash  = (supplierPayments || []).filter((p) => p.method === 'Cash');
  const supplierPaymentsMpesa = (supplierPayments || []).filter((p) => p.method === 'M-Pesa');

  const totalCashOutflows  = sumBy(purchasePaymentsCash,  'totalCost') + sumBy(supplierPaymentsCash,  'amount') + totalRefundsCash;
  const totalMpesaOutflows = sumBy(purchasePaymentsMpesa, 'totalCost') + sumBy(supplierPaymentsMpesa, 'amount') + totalRefundsMpesa;

  return {
    grossSalesRevenue, totalCashSales, totalMpesaSales, totalCreditSales,
    revenue, costOfGoodsSold, grossProfit,
    netSales, totalDiscounts, totalServiceCharges, totalWasteCost,
    totalCashReceipts, totalMpesaReceipts,
    totalDebtRepaymentsCash, totalDebtRepaymentsMpesa, totalDebtRepayments,
    totalExpensesCash, totalExpensesMpesa, totalExpenses, netProfit,
    totalRefundsCash, totalRefundsMpesa, totalRefunds,
    totalCashOutflows, totalMpesaOutflows,
  };
}

export function computeExpectedTillBalances({
  openingCashFloat = 0, openingMpesaFloat = 0,
  totalCashSales = 0, totalMpesaSales = 0,
  totalDebtRepaymentsCash = 0, totalDebtRepaymentsMpesa = 0,
  totalExpensesCash = 0, totalExpensesMpesa = 0,
  totalCashOutflows = 0, totalMpesaOutflows = 0,
}) {
  return {
    expectedCashAtClose:  Number(openingCashFloat)  + totalCashSales  + totalDebtRepaymentsCash  - totalExpensesCash - totalCashOutflows,
    expectedMpesaAtClose: Number(openingMpesaFloat) + totalMpesaSales + totalDebtRepaymentsMpesa - totalExpensesMpesa - totalMpesaOutflows,
  };
}

export function computeSupplierBalances(purchases = [], supplierPayments = [], suppliers = []) {
  const balanceById = {};

  (purchases || []).forEach((p) => {
    if (p?.paymentStatus !== 'pending_supplier_credit' || !p?.supplierId) return;
    balanceById[p.supplierId] = (balanceById[p.supplierId] || 0) + (Number(p.totalCost) || 0);
  });

  (supplierPayments || []).forEach((sp) => {
    if (!sp?.supplierId || balanceById[sp.supplierId] === undefined) return;
    balanceById[sp.supplierId] -= Number(sp.amount) || 0;
  });

  const nameById = {};
  (suppliers || []).forEach((s) => { nameById[s.id] = s.name; });

  return Object.entries(balanceById)
    .filter(([, balance]) => (Number(balance) || 0) > 0.005)
    .map(([supplierId, balance]) => ({
      supplierId,
      supplierName:
        nameById[supplierId] ||
        (purchases || []).find((p) => p.supplierId === supplierId)?.supplierName ||
        'Unknown supplier',
      balance,
    }))
    .sort((a, b) => b.balance - a.balance);
}