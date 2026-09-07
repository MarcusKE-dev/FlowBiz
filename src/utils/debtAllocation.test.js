// Spreading one debt repayment across a customer's open credit sales.
//
// Two failures this file exists to prevent, both of which only appear on
// the accounts a business can least afford to get wrong:
//
//   A lump sum spanning 250+ invoices used to build a Firestore batch
//   past the 500-operation ceiling, and the whole payment was refused
//   after the cashier had taken the cash.
//
//   A surplus used to vanish: the loop stopped at zero debt, but the
//   receipt was written for the full amount handed over, so the
//   `repayments` total and the customer's receipt disagreed and the till
//   never reconciled.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOpenCreditSale, openCreditSales, totalOutstanding,
  allocateRepayment, batchAllocations, SALES_PER_BATCH, CENT,
} from './debtAllocation.js';

const at = (ms) => ({ toMillis: () => ms });
const sale = (id, remainingBalance, extra = {}) => ({
  id, remainingBalance, amountPaid: 0, soldAt: at(Number(id.replace(/\D/g, '')) || 0), ...extra,
});

// ── What counts as open ──────────────────────────────────────────────

test('cancelled and refunded sales are never paid against', () => {
  assert.equal(isOpenCreditSale(sale('s1', 500)), true);
  assert.equal(isOpenCreditSale(sale('s2', 500, { status: 'cancelled' })), false);
  assert.equal(isOpenCreditSale(sale('s3', 500, { status: 'refunded' })), false);
  assert.equal(isOpenCreditSale(sale('s4', 0)), false);
  assert.equal(isOpenCreditSale(sale('s5', 0.004)), false, 'sub-cent is rounding noise, not debt');
  assert.equal(isOpenCreditSale(null), false);
});

test('open sales come back oldest first — the allocation order', () => {
  const sales = [sale('s3', 100), sale('s1', 100), sale('s2', 100)];
  assert.deepEqual(openCreditSales(sales).map((s) => s.id), ['s1', 's2', 's3']);
});

test('the outstanding total ignores what a payment cannot touch', () => {
  const sales = [sale('s1', 300), sale('s2', 200, { status: 'cancelled' }), sale('s3', 500)];
  assert.equal(totalOutstanding(openCreditSales(sales)), 800);
});

// ── Allocation ───────────────────────────────────────────────────────

test('a payment clears the oldest invoice first', () => {
  const open = openCreditSales([sale('s1', 300), sale('s2', 500)]);
  const { allocations, allocated, surplus } = allocateRepayment(open, 400);

  assert.equal(allocated, 400);
  assert.equal(surplus, 0);
  assert.deepEqual(allocations.map((a) => [a.sale.id, a.portion, a.status]), [
    ['s1', 300, 'paid'],
    ['s2', 100, 'partial'],
  ]);
  assert.equal(allocations[1].newBalance, 400);
});

test('the portions always add up to what was allocated', () => {
  const open = openCreditSales([sale('s1', 33.33), sale('s2', 66.67), sale('s3', 10)]);
  const { allocations, allocated } = allocateRepayment(open, 100);
  const summed = allocations.reduce((n, a) => n + a.portion, 0);
  assert.equal(Math.abs(summed - allocated) < CENT, true);
  assert.equal(allocated, 100);
});

test('an existing part payment is added to, not replaced', () => {
  const open = openCreditSales([sale('s1', 400, { amountPaid: 600 })]);
  const { allocations } = allocateRepayment(open, 400);
  assert.equal(allocations[0].newPaid, 1000);
  assert.equal(allocations[0].newBalance, 0);
  assert.equal(allocations[0].status, 'paid');
});

test('an OVERPAYMENT is reported as surplus and never quietly dropped', () => {
  const open = openCreditSales([sale('s1', 1000)]);
  const { allocations, allocated, surplus } = allocateRepayment(open, 1200);

  assert.equal(allocated, 1000);
  assert.equal(surplus, 200, 'the caller must refuse this, not write it');
  assert.equal(allocations.length, 1);
  // The invariant that makes the till reconcile: the receipt figure is
  // `allocated`, and it is exactly the sum of the repayment records.
  assert.equal(allocations.reduce((n, a) => n + a.portion, 0), allocated);
});

test('paying the exact balance leaves no surplus and clears everything', () => {
  const open = openCreditSales([sale('s1', 250.5), sale('s2', 749.5)]);
  const { allocated, surplus, allocations } = allocateRepayment(open, 1000);
  assert.equal(allocated, 1000);
  assert.equal(surplus, 0);
  assert.deepEqual(allocations.map((a) => a.status), ['paid', 'paid']);
});

test('a zero or negative amount allocates nothing', () => {
  const open = openCreditSales([sale('s1', 100)]);
  for (const amount of [0, -50, 0.004, null, undefined, NaN]) {
    const { allocations, allocated, surplus } = allocateRepayment(open, amount);
    assert.deepEqual(allocations, [], `amount ${amount}`);
    assert.equal(allocated, 0);
    assert.equal(surplus, 0);
  }
});

test('a payment with no open sales is all surplus', () => {
  const { allocations, allocated, surplus } = allocateRepayment([], 500);
  assert.deepEqual(allocations, []);
  assert.equal(allocated, 0);
  assert.equal(surplus, 500);
});

test('repeated part payments converge on zero without rounding drift', () => {
  let sales = [sale('s1', 100)];
  for (let i = 0; i < 3; i++) {
    const { allocations } = allocateRepayment(openCreditSales(sales), 33.33);
    sales = sales.map((s) => {
      const hit = allocations.find((a) => a.sale.id === s.id);
      return hit ? { ...s, remainingBalance: hit.newBalance, amountPaid: hit.newPaid } : s;
    });
  }
  assert.equal(sales[0].remainingBalance, 0.01);
  const { allocated, surplus } = allocateRepayment(openCreditSales(sales), 0.01);
  assert.equal(allocated, 0.01);
  assert.equal(surplus, 0);
});

// ── Batching ─────────────────────────────────────────────────────────

test('a settlement bigger than one Firestore batch is split, in order', () => {
  // 300 invoices is 600 writes plus a receipt — 101 past the ceiling.
  const sales = Array.from({ length: 300 }, (_, i) => sale(`s${1000 + i}`, 100));
  const open = openCreditSales(sales);
  const { allocations, allocated, surplus } = allocateRepayment(open, 30000);

  assert.equal(allocations.length, 300);
  assert.equal(allocated, 30000);
  assert.equal(surplus, 0);

  const groups = batchAllocations(allocations);
  assert.equal(groups.length, 2);

  for (const group of groups) {
    // Two writes per sale, and the receipt rides in the last batch.
    assert.ok(group.length * 2 + 1 <= 500, `a batch of ${group.length} exceeds Firestore's limit`);
  }
  assert.equal(groups.flat().length, 300, 'nothing is lost in the split');
  assert.deepEqual(
    groups.flat().map((a) => a.sale.id),
    allocations.map((a) => a.sale.id),
    'oldest-first order survives the split',
  );
});

test('249 invoices — the old breaking point — is one batch, and 250 is two', () => {
  const build = (n) => batchAllocations(
    allocateRepayment(openCreditSales(Array.from({ length: n }, (_, i) => sale(`s${1000 + i}`, 10))), n * 10).allocations
  );
  assert.equal(build(SALES_PER_BATCH).length, 1);
  assert.equal(build(SALES_PER_BATCH + 1).length, 2);
  assert.equal(build(249).length, 2);
  assert.equal(build(250).length, 2);
});

test('an empty allocation still yields one batch, so the receipt has a home', () => {
  assert.deepEqual(batchAllocations([]), [[]]);
});
