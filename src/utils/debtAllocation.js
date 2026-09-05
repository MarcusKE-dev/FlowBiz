// src/utils/debtAllocation.js
//
// How one debt repayment is spread across a customer's open credit sales.
//
// This was inline in CustomerDetail and did two things wrong at once,
// both of which only show up on the accounts that matter most — the
// long-standing wholesale customer with a year of unpaid invoices.
//
//   IT COULD EXCEED A FIRESTORE BATCH. Each settled sale costs two
//   writes (the sale, and its repayment record), so a lump sum spanning
//   250 sales built a 501-operation batch and Firestore refused the
//   whole thing. The cashier had taken the money and the app could not
//   record a shilling of it.
//
//   IT COULD SILENTLY SWALLOW A SURPLUS. The loop stopped when the debt
//   ran out, but the receipt was written for the full amount handed
//   over. Pay KES 1,200 against KES 1,000 of debt and the `repayments`
//   collection held 1,000 while the customer's receipt said 1,200 —
//   so the till never reconciled and the difference had no name.
//
// The arithmetic therefore lives here, pure and tested, and the page
// writes what it is given. `allocate()` is the whole contract: what it
// reports as `allocated` is exactly the sum of the portions it hands
// back, and `surplus` is what the open balances could not absorb.

import { roundMoney } from './currency.js';

// Money below this is rounding noise, not a balance. Matches the epsilon
// CustomerDetail and RepaymentModal already compared against.
export const CENT = 0.005;

// A Firestore batch caps at 500 operations. Two per settled sale, plus
// the single receipt document, so 200 sales per batch leaves generous
// headroom and keeps each commit small enough to sync quickly on a slow
// connection.
export const SALES_PER_BATCH = 200;

/** Is this credit sale one a payment can still be applied to? */
export function isOpenCreditSale(sale) {
  if (!sale) return false;
  if (sale.status === 'cancelled' || sale.status === 'refunded') return false;
  return (Number(sale.remainingBalance) || 0) > CENT;
}

/**
 * The open credit sales a payment applies to, OLDEST FIRST — the app's
 * allocation rule, unchanged, and the reason a customer's oldest invoice
 * clears before their newest.
 */
export function openCreditSales(creditSales) {
  return (creditSales || [])
    .filter(isOpenCreditSale)
    .sort((a, b) => (a.soldAt?.toMillis?.() ?? 0) - (b.soldAt?.toMillis?.() ?? 0));
}

/** Everything the given sales could absorb. */
export function totalOutstanding(openSales) {
  return roundMoney((openSales || []).reduce((sum, s) => sum + (Number(s.remainingBalance) || 0), 0));
}

/**
 * Spread `amount` across `openSales`, oldest first.
 *
 * @returns {{allocations: Array, allocated: number, surplus: number}}
 *   `allocations` — one entry per sale the payment touches, carrying the
 *   new stored values so the caller does no arithmetic of its own.
 *   `allocated` — the sum of those portions.
 *   `surplus`   — what the open balances could not absorb. A caller must
 *                 refuse a payment with a surplus rather than write one:
 *                 a repayment record that does not add up to the receipt
 *                 beside it is an unexplainable difference at close of
 *                 day, and there is no customer-credit ledger to put it
 *                 in.
 */
export function allocateRepayment(openSales, amount) {
  const allocations = [];
  let remaining = roundMoney(amount);
  if (!(remaining > CENT)) return { allocations, allocated: 0, surplus: 0 };

  for (const sale of openSales || []) {
    if (remaining <= CENT) break;
    const owed = roundMoney(Number(sale.remainingBalance) || 0);
    if (owed <= CENT) continue;

    const portion = roundMoney(Math.min(owed, remaining));
    const newBalance = roundMoney(owed - portion);
    allocations.push({
      sale,
      portion,
      newPaid: roundMoney((Number(sale.amountPaid) || 0) + portion),
      newBalance,
      status: newBalance <= CENT ? 'paid' : 'partial',
    });
    remaining = roundMoney(remaining - portion);
  }

  const allocated = roundMoney(allocations.reduce((sum, a) => sum + a.portion, 0));
  return { allocations, allocated, surplus: roundMoney(Math.max(0, remaining)) };
}

/**
 * Split allocations into groups small enough that each becomes one
 * Firestore batch. Preserves order, so the oldest invoices are still
 * settled first if a later commit fails.
 */
export function batchAllocations(allocations, size = SALES_PER_BATCH) {
  const groups = [];
  const step = Math.max(1, size);
  for (let start = 0; start < (allocations || []).length; start += step) {
    groups.push(allocations.slice(start, start + step));
  }
  return groups.length > 0 ? groups : [[]];
}
