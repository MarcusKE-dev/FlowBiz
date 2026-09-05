// Phase 8 gate — pharmacy batches, expiry and FEFO.
//
// The failure mode this file is written against is selling an expired
// medicine because the software picked the box that expires soonest
// without checking whether "soonest" was already in the past.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateFefo, sortFefo, expiryStatus, daysToExpiry, daysBetween, todayISO,
  isValidExpiryDate, allocatedUnitCost, batchStockFor, sellableBatchStockFor,
  summarizeExpiry, buildBatchDocument, remainingOf,
  EXPIRY_STATUS, DEFAULT_EXPIRY_WARNING_DAYS,
} from './batches.js';
import { resolveStockDeltas } from './inventory.js';
import { roundMoney } from './currency.js';

const TODAY = '2026-09-04';

// One product, four batches at different expiries and costs.
const BATCHES = [
  { id: 'b1', productId: 'amox', batchNumber: 'A-101', expiryDate: '2026-12-31', quantity: 50, remainingQuantity: 50, costPrice: 120, receivedAt: '2026-01-10' },
  { id: 'b2', productId: 'amox', batchNumber: 'A-102', expiryDate: '2026-10-15', quantity: 30, remainingQuantity: 30, costPrice: 130, receivedAt: '2026-02-20' },
  { id: 'b3', productId: 'amox', batchNumber: 'A-099', expiryDate: '2026-08-01', quantity: 20, remainingQuantity: 20, costPrice: 110, receivedAt: '2025-11-01' },
  { id: 'b4', productId: 'amox', batchNumber: 'A-103', expiryDate: '2027-06-30', quantity: 40, remainingQuantity: 40, costPrice: 125, receivedAt: '2026-03-01' },
];

// ── Dates ────────────────────────────────────────────────────────────

test('an expiry date is a plain calendar date, validated strictly', () => {
  assert.equal(isValidExpiryDate('2026-12-31'), true);
  assert.equal(isValidExpiryDate('2026-02-30'), false, 'February has no 30th');
  assert.equal(isValidExpiryDate('2026-13-01'), false);
  assert.equal(isValidExpiryDate('2026-1-1'), false, 'unpadded is not ISO');
  assert.equal(isValidExpiryDate('31/12/2026'), false);
  assert.equal(isValidExpiryDate(''), false);
  assert.equal(isValidExpiryDate(null), false);
  assert.equal(isValidExpiryDate(20261231), false);
  assert.equal(isValidExpiryDate(new Date()), false);
});

test('todayISO is a padded calendar date', () => {
  assert.match(todayISO(new Date('2026-01-05T23:30:00')), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(todayISO(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(daysBetween('2026-09-04', '2026-09-11'), 7);
  assert.equal(daysBetween('2026-09-04', '2026-09-04'), 0);
  assert.equal(daysBetween('2026-09-04', '2026-09-01'), -3);
  assert.equal(daysBetween('bad', '2026-09-01'), null);
});

test('a batch is good UNTIL THE END of its printed date, and expired the next day', () => {
  const batch = { expiryDate: '2026-09-04' };
  assert.equal(expiryStatus(batch, { today: '2026-09-03' }), EXPIRY_STATUS.EXPIRING);
  assert.equal(expiryStatus(batch, { today: '2026-09-04' }), EXPIRY_STATUS.EXPIRING, 'the printed day is still good');
  assert.equal(expiryStatus(batch, { today: '2026-09-05' }), EXPIRY_STATUS.EXPIRED);
});

test('the expiry warning window is configurable and defaults to 90 days', () => {
  const batch = { expiryDate: '2026-11-15' }; // 72 days from TODAY
  assert.equal(daysToExpiry(batch, TODAY), 72);
  assert.equal(expiryStatus(batch, { today: TODAY }), EXPIRY_STATUS.EXPIRING);
  assert.equal(expiryStatus(batch, { today: TODAY, warningDays: 30 }), EXPIRY_STATUS.OK);
  assert.equal(DEFAULT_EXPIRY_WARNING_DAYS, 90);
});

test('a batch with no expiry date is unknown, never expired', () => {
  assert.equal(expiryStatus({ expiryDate: null }, { today: TODAY }), EXPIRY_STATUS.UNKNOWN);
  assert.equal(expiryStatus({}, { today: TODAY }), EXPIRY_STATUS.UNKNOWN);
  assert.equal(daysToExpiry({}, TODAY), null);
});

// ── FEFO ordering ────────────────────────────────────────────────────

test('FEFO orders by expiry, earliest first', () => {
  assert.deepEqual(sortFefo(BATCHES).map((b) => b.id), ['b3', 'b2', 'b1', 'b4']);
});

test('a batch with no expiry sorts LAST, not first', () => {
  const withUnknown = [...BATCHES, { id: 'bx', productId: 'amox', expiryDate: null, remainingQuantity: 10 }];
  assert.equal(sortFefo(withUnknown).at(-1).id, 'bx');
});

test('batches expiring on the same day break the tie on which arrived first', () => {
  const sameDay = [
    { id: 'later', expiryDate: '2026-10-01', receivedAt: '2026-05-01' },
    { id: 'earlier', expiryDate: '2026-10-01', receivedAt: '2026-01-01' },
  ];
  assert.deepEqual(sortFefo(sameDay).map((b) => b.id), ['earlier', 'later']);
});

// ── Allocation ───────────────────────────────────────────────────────

test('EXPIRED STOCK IS NEVER ALLOCATED, even though it expires soonest', () => {
  // b3 expired on 2026-08-01, a month before today. It is the earliest
  // expiry in the list and FEFO would reach for it first — it must not.
  const { allocations, allocated, shortfall, usedExpired } = allocateFefo(BATCHES, 10, { today: TODAY });
  assert.equal(usedExpired, false);
  assert.equal(allocations.length, 1);
  assert.equal(allocations[0].batchId, 'b2', 'the earliest UNEXPIRED batch');
  assert.equal(allocated, 10);
  assert.equal(shortfall, 0);
});

test('an allocation splits across batches when one cannot cover the line', () => {
  const { allocations, allocated, shortfall } = allocateFefo(BATCHES, 45, { today: TODAY });
  assert.deepEqual(allocations.map((a) => [a.batchId, a.quantity]), [['b2', 30], ['b1', 15]]);
  assert.equal(allocated, 45);
  assert.equal(shortfall, 0);
});

test('an allocation that cannot be filled reports the shortfall rather than over-allocating', () => {
  // 30 + 50 + 40 sellable = 120. Asking for 200 leaves 80 short.
  const { allocations, allocated, shortfall } = allocateFefo(BATCHES, 200, { today: TODAY });
  assert.equal(allocated, 120);
  assert.equal(shortfall, 80);
  assert.equal(allocations.reduce((s, a) => s + a.quantity, 0), 120);
  assert.equal(allocations.some((a) => a.batchId === 'b3'), false, 'the expired batch is still excluded');
});

test('expired stock can be allocated only when it is deliberately asked for', () => {
  const { allocations, usedExpired } = allocateFefo(BATCHES, 10, { today: TODAY, allowExpired: true });
  assert.equal(allocations[0].batchId, 'b3');
  assert.equal(usedExpired, true, 'and the caller is told, so it can be recorded');
});

test('an empty batch is skipped rather than allocated zero from', () => {
  const drained = [{ id: 'd', productId: 'amox', expiryDate: '2026-09-30', remainingQuantity: 0 }, ...BATCHES];
  const { allocations } = allocateFefo(drained, 5, { today: TODAY });
  assert.equal(allocations.some((a) => a.batchId === 'd'), false);
});

test('allocating zero, nothing, or from no batches never throws', () => {
  for (const quantity of [0, -5, null, undefined, NaN, 'abc']) {
    const result = allocateFefo(BATCHES, quantity, { today: TODAY });
    assert.deepEqual(result.allocations, []);
    assert.equal(result.allocated, 0);
  }
  assert.deepEqual(allocateFefo(null, 5).allocations, []);
  assert.equal(allocateFefo([], 5).shortfall, 5);
});

test('a measured product allocates in its own unit precision', () => {
  const syrup = [
    { id: 's1', productId: 'syr', expiryDate: '2026-10-01', remainingQuantity: 0.5, costPrice: 200 },
    { id: 's2', productId: 'syr', expiryDate: '2026-11-01', remainingQuantity: 2, costPrice: 210 },
  ];
  const { allocations, allocated, shortfall } = allocateFefo(syrup, 1.25, { unit: 'litre', today: TODAY });
  assert.deepEqual(allocations.map((a) => [a.batchId, a.quantity]), [['s1', 0.5], ['s2', 0.75]]);
  assert.equal(allocated, 1.25);
  assert.equal(shortfall, 0);
});

// ── Cost ─────────────────────────────────────────────────────────────

test('the cost of a line is the cost of the batches it actually came from', () => {
  const { allocations } = allocateFefo(BATCHES, 45, { today: TODAY });
  // 30 at 130 and 15 at 120 -> (3900 + 1800) / 45
  assert.equal(allocatedUnitCost(allocations), roundMoney(5700 / 45));
  assert.equal(allocatedUnitCost(allocations), 126.67);
});

test('with no allocation the line falls back to the product cost', () => {
  assert.equal(allocatedUnitCost([], 118), 118);
  assert.equal(allocatedUnitCost(null, 118), 118);
  assert.equal(allocatedUnitCost([], null), 0);
});

// ── Stock across batches ─────────────────────────────────────────────

test('batch stock is the sum of what is left, and sellable stock excludes what has expired', () => {
  assert.equal(batchStockFor(BATCHES, 'amox'), 140);
  assert.equal(sellableBatchStockFor(BATCHES, 'amox', { today: TODAY }), 120, 'the 20 expired are on the shelf but not sellable');
  assert.equal(batchStockFor(BATCHES, 'other'), 0);
  assert.equal(batchStockFor(null, 'amox'), 0);
});

test('remainingQuantity falls back to the received quantity for a freshly written batch', () => {
  assert.equal(remainingOf({ quantity: 30 }), 30);
  assert.equal(remainingOf({ quantity: 30, remainingQuantity: 12 }), 12);
  assert.equal(remainingOf({ quantity: 30, remainingQuantity: 0 }), 0);
  assert.equal(remainingOf(null), 0);
});

// ── The expiry picture ───────────────────────────────────────────────

test('the expiry summary separates expired, expiring and fine, with value at cost', () => {
  const summary = summarizeExpiry(BATCHES, [], { today: TODAY });
  assert.equal(summary.expiredCount, 1);
  assert.deepEqual(summary.expired.map((b) => b.id), ['b3']);
  assert.equal(summary.expiredValue, 20 * 110);
  // b2 (2026-10-15) is 41 days out; b1 (2026-12-31) is 118 — outside 90.
  assert.deepEqual(summary.expiring.map((b) => b.id), ['b2']);
  assert.equal(summary.expiringValue, 30 * 130);
  assert.deepEqual(summary.ok.map((b) => b.id).sort(), ['b1', 'b4']);
});

test('a finished batch cannot expire — it is not counted at all', () => {
  const drained = BATCHES.map((b) => (b.id === 'b3' ? { ...b, remainingQuantity: 0 } : b));
  const summary = summarizeExpiry(drained, [], { today: TODAY });
  assert.equal(summary.expiredCount, 0);
  assert.equal(summary.expiredValue, 0);
});

test('the expiry summary widens and narrows with the warning window', () => {
  assert.equal(summarizeExpiry(BATCHES, [], { today: TODAY, warningDays: 200 }).expiringCount, 2);
  assert.equal(summarizeExpiry(BATCHES, [], { today: TODAY, warningDays: 7 }).expiringCount, 0);
});

test('the summary never throws on missing or malformed input', () => {
  for (const input of [null, undefined, [], [null], [{}], [{ expiryDate: 'soon', remainingQuantity: 5 }]]) {
    assert.doesNotThrow(() => summarizeExpiry(input, null, { today: TODAY }));
  }
  assert.equal(summarizeExpiry([{ expiryDate: 'soon', remainingQuantity: 5 }], [], { today: TODAY }).unknown.length, 1);
});

// ── The stored batch and the stock it moves ──────────────────────────

test('a received batch records source, batch number, expiry and quantity', () => {
  // Exactly the four things the PPB Good Pharmacy Practice guidelines
  // name for stock received.
  const batch = buildBatchDocument({
    productId: 'amox', productName: 'Amoxicillin 500mg',
    batchNumber: ' A-104 ', expiryDate: '2027-01-31',
    quantity: 60, costPrice: 128.456,
    supplierId: 'sup1', supplierName: 'Nairobi Pharma',
    receivedBy: 'u1', receivedByName: 'Wanjiru',
  });
  assert.equal(batch.batchNumber, 'A-104');
  assert.equal(batch.expiryDate, '2027-01-31');
  assert.equal(batch.quantity, 60);
  assert.equal(batch.remainingQuantity, 60, 'a new batch is entirely remaining');
  assert.equal(batch.costPrice, 128.46);
  assert.equal(batch.supplierName, 'Nairobi Pharma');
});

test('an unusable expiry date is stored as absent rather than as garbage', () => {
  assert.equal(buildBatchDocument({ productId: 'x', expiryDate: '31/12/2026', quantity: 1 }).expiryDate, null);
  assert.equal(buildBatchDocument({ productId: 'x', quantity: 1 }).expiryDate, null);
  assert.equal(buildBatchDocument({ productId: 'x', batchNumber: '   ', quantity: 1 }).batchNumber, null);
});

test('a batch-allocated sale moves the product total AND each batch, by the same amounts', () => {
  const product = { id: 'amox', name: 'Amoxicillin 500mg', stock: 140 };
  const { allocations } = allocateFefo(BATCHES, 45, { today: TODAY });
  const deltas = resolveStockDeltas(
    [{ productId: 'amox', quantity: 45, batchAllocations: allocations }],
    [product]
  );
  assert.equal(deltas.amox.total, -45);
  assert.deepEqual(deltas.amox.batches, { b2: -30, b1: -15 });
  // The two must always agree, or the product total and the batch ledger
  // drift apart and no stock take can reconcile them.
  const batchSum = Object.values(deltas.amox.batches).reduce((a, b) => a + b, 0);
  assert.equal(batchSum, deltas.amox.total);
});

test('after a batch-allocated sale, the batch ledger still sums to the product stock', () => {
  const { allocations } = allocateFefo(BATCHES, 45, { today: TODAY });
  const applied = BATCHES.map((batch) => {
    const taken = allocations.find((a) => a.batchId === batch.id)?.quantity || 0;
    return { ...batch, remainingQuantity: batch.remainingQuantity - taken };
  });
  assert.equal(batchStockFor(applied, 'amox'), 140 - 45);
  assert.equal(sellableBatchStockFor(applied, 'amox', { today: TODAY }), 120 - 45);
});
