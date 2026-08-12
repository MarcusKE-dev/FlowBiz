function sumBy(rows, field) {
  return rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
}

function getCostOfSale(row) {
  const costPerUnit = Number(row?.costPricePerUnit) || 0;
  const quantity = Number(row?.quantity) || 0;
  return costPerUnit * quantity;
}

export function isExpenseExcluded(expense) {
  const category = String(expense?.category || '').toLowerCase();
  const description = String(expense?.description || '').toLowerCase();
  return category === 'stock purchase' || category === 'supplier payment' || description.includes('stock purchase') || description.includes('supplier payment');
}

// A credit sale that was cancelled (nothing was ever paid on it) or
// refunded (goods returned, whatever was paid handed back) no longer
// represents real business — it must not contribute to Outstanding Debt
// or the Credit Sales metric. Same precedent as `isVoided` on cash sales.
function isCreditSaleReversed(creditSale) {
  return creditSale?.status === 'cancelled' || creditSale?.status === 'refunded';
}

// HYBRID MODEL (FINAL business decision): a credit sale is NOT realized
// revenue until the customer actually pays. The moment a credit sale is
// recorded, Inventory Value drops and Outstanding Debt / Credit Sales
// rise — but Revenue, COGS, and Profit all stay at ZERO for that sale.
// Only a Debt Repayment converts a portion of it into Revenue, COGS, and
// Profit — proportional to how much of THAT specific credit sale has
// just been collected. `creditSaleById` must be built from the FULL,
// all-time credit sales list (not just the reporting period's), because
// a repayment can land in a different period than the original sale.
function recognizeRepayment(repayment, creditSaleById) {
  const amount = Number(repayment?.amount) || 0;
  const creditSale = creditSaleById.get(repayment?.creditSaleId);
  if (!creditSale) {
    // Originating credit sale not found (shouldn't normally happen) —
    // recognize the cash as revenue with no cost basis rather than
    // silently dropping it from the books.
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
} = {}) {
  const activeSales = (sales || []).filter((sale) => !sale?.isVoided);
  const activeCreditSales = (creditSales || []).filter((cs) => !isCreditSaleReversed(cs));

  const cashSales  = activeSales.filter(s => s.paymentMethod === 'Cash');
  const mpesaSales = activeSales.filter(s => s.paymentMethod === 'M-Pesa');
  const totalCashSales  = sumBy(cashSales,  'totalAmount');
  const totalMpesaSales = sumBy(mpesaSales, 'totalAmount');

  // "Credit Sales" is a business-activity metric — total value of goods
  // sold on credit this period. It intentionally does NOT feed into
  // Revenue / COGS / Profit below (see recognizeRepayment()). This is the
  // core of the FINAL decision: the owner should never see profit that
  // has not yet been collected.
  const totalCreditSales = sumBy(activeCreditSales, 'totalAmount');

  const cashRepayments  = debtRepayments.filter(r => r.method === 'Cash');
  const mpesaRepayments = debtRepayments.filter(r => r.method === 'M-Pesa');
  const totalDebtRepaymentsCash  = sumBy(cashRepayments,  'amount');
  const totalDebtRepaymentsMpesa = sumBy(mpesaRepayments, 'amount');
  const totalDebtRepayments = totalDebtRepaymentsCash + totalDebtRepaymentsMpesa;

  // Lookup of EVERY credit sale (not just this period's) so a repayment
  // can find its cost basis even when the sale happened earlier. Falls
  // back to the period-scoped `creditSales` if the caller didn't supply
  // the full list.
  const creditSaleSource = allCreditSales || creditSales || [];
  const creditSaleById = new Map(creditSaleSource.map((cs) => [cs.id, cs]));

  let repaymentRevenue = 0;
  let repaymentCogs = 0;
  (debtRepayments || []).forEach((r) => {
    const { revenue, cogs } = recognizeRepayment(r, creditSaleById);
    repaymentRevenue += revenue;
    repaymentCogs += cogs;
  });

  // Direct (cash/M-Pesa) sales realize revenue and COGS the instant they
  // happen. Credit sales contribute ZERO here directly — only the
  // repaymentRevenue / repaymentCogs recognized above, at the moment the
  // customer actually pays.
  const directSalesCostOfGoodsSold = activeSales.reduce((acc, s) => acc + getCostOfSale(s), 0);
  const costOfGoodsSold = directSalesCostOfGoodsSold + repaymentCogs;

  // "Gross sales revenue" — total value of everything SOLD this period
  // regardless of payment method. Informational only (Sales Summary) —
  // it is NOT used for profit. See `revenue` below.
  const grossSalesRevenue = totalCashSales + totalMpesaSales + totalCreditSales;

  // Realized revenue — what actually counts toward profit, per the FINAL
  // business decision: cash + M-Pesa sales, plus whatever portion of
  // credit sales (from any period) was actually collected this period.
  const revenue = totalCashSales + totalMpesaSales + repaymentRevenue;
  const grossProfit = revenue - costOfGoodsSold;

  const filteredExpenses = (expenses || []).filter((expense) => !isExpenseExcluded(expense));
  const cashExpenses  = filteredExpenses.filter(e => e.paymentMethod === 'Cash');
  const mpesaExpenses = filteredExpenses.filter(e => e.paymentMethod === 'M-Pesa');
  const totalExpensesCash  = sumBy(cashExpenses,  'amount');
  const totalExpensesMpesa = sumBy(mpesaExpenses, 'amount');
  const totalExpenses = totalExpensesCash + totalExpensesMpesa;
  const netProfit     = grossProfit - totalExpenses;

  // CASH POSITION: strictly real money movement, independent of the
  // revenue-recognition timing above. This is what Cash Received Today /
  // M-Pesa Received Today and the Close Day till reconciliation rely on.
  const totalCashReceipts  = totalCashSales  + totalDebtRepaymentsCash;
  const totalMpesaReceipts = totalMpesaSales + totalDebtRepaymentsMpesa;

  const cashRefunds  = (refunds || []).filter(r => r.method === 'Cash');
  const mpesaRefunds = (refunds || []).filter(r => r.method === 'M-Pesa');
  const totalRefundsCash  = sumBy(cashRefunds,  'amount');
  const totalRefundsMpesa = sumBy(mpesaRefunds, 'amount');
  const totalRefunds = totalRefundsCash + totalRefundsMpesa;

  const purchasePaymentsCash  = (purchases || []).filter((p) => p.paymentStatus === 'paid' && p.paymentMethod === 'Cash');
  const purchasePaymentsMpesa = (purchases || []).filter((p) => p.paymentStatus === 'paid' && p.paymentMethod === 'M-Pesa');
  const supplierPaymentsCash  = (supplierPayments || []).filter((p) => p.method === 'Cash');
  const supplierPaymentsMpesa = (supplierPayments || []).filter((p) => p.method === 'M-Pesa');
  // Refunds are cash/M-Pesa leaving the till, just like an expense or a
  // supplier payment — folded into the same outflow totals so Close Day's
  // till reconciliation stays correct without any formula change there.
  const totalCashOutflows  = sumBy(purchasePaymentsCash,  'totalCost') + sumBy(supplierPaymentsCash,  'amount') + totalRefundsCash;
  const totalMpesaOutflows = sumBy(purchasePaymentsMpesa, 'totalCost') + sumBy(supplierPaymentsMpesa, 'amount') + totalRefundsMpesa;

  return {
    grossSalesRevenue, totalCashSales, totalMpesaSales, totalCreditSales,
    revenue, costOfGoodsSold, grossProfit,
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