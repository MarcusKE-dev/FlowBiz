// src/domain/fnb/ticket.test.js
//
// The ticket domain. These tests are about CORRECTNESS OF THE MODEL, not
// coverage: each one pins a property the rest of the food-service
// architecture is built on, and most of them describe a way the previous
// single-document design was silently wrong.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FULFILLMENT, buildTicketLine, fulfillmentOf, isLive, canAdvanceTo,
  headerDelta, recomputeHeader, lineToSaleItem, sortLines, lineRowKey,
} from './lines.js';
import {
  readTicket, ticketStage, planLineMove, readRoom, summarizeTickets,
  chargeProblem, chargeableLines, groupByCourse, LINE_MODEL,
} from './ticket.js';

const row = (over = {}) => ({
  productId: 'p1', productName: 'Burger', quantity: 2,
  unitPrice: 500, costPrice: 200, ...over,
});

const line = (over = {}) => ({
  id: 'l1', orderId: 'o1', productId: 'p1', productName: 'Burger',
  quantity: 1, unitPrice: 500, costPrice: 200,
  lineTotal: 500, lineCost: 200, lineProfit: 300,
  seq: 1, fulfillment: FULFILLMENT.NEW, voided: false, ...over,
});

// ── The line ─────────────────────────────────────────────────────────

test('a ticket line is priced by the same function a sale line is', () => {
  const built = buildTicketLine(row(), { orderId: 'o1' });
  assert.equal(built.lineTotal, 1000);
  assert.equal(built.lineCost, 400);
  assert.equal(built.lineProfit, 600);
  assert.equal(built.orderId, 'o1');
  assert.equal(built.fulfillment, FULFILLMENT.NEW);
  assert.equal(built.voided, false);
});

test('a line stores neither a course nor a station when it has neither', () => {
  const built = buildTicketLine(row(), { orderId: 'o1' });
  assert.ok(!('courseId' in built), 'an absent course must not be stored as null');
  assert.ok(!('station' in built), 'an absent station must not be stored as null');
});

test('a line projects back to exactly the sale line shape FlowBiz writes', () => {
  const built = buildTicketLine(row({ modifiers: [{ groupId: 'g', groupName: 'G', id: 'o', name: 'Extra cheese', priceDelta: 50 }] }), { orderId: 'o1', station: 'grill' });
  const item = lineToSaleItem({ ...built, fulfillment: FULFILLMENT.SERVED });
  // Everything a ticket knows and a sale must not.
  for (const ticketOnly of ['orderId', 'seq', 'fulfillment', 'voided', 'station', 'addedAt']) {
    assert.ok(!(ticketOnly in item), `${ticketOnly} must not reach the sale document`);
  }
  // Everything a sale has always had.
  for (const field of ['productId', 'productName', 'quantity', 'unitPrice', 'costPrice', 'lineTotal', 'lineCost', 'lineProfit', 'barcode']) {
    assert.ok(field in item, `${field} must survive onto the sale`);
  }
  assert.deepEqual(item.modifiers, built.modifiers, 'the choices made must survive onto the receipt');
});

test('fulfillment only ever moves forward', () => {
  const cooking = line({ fulfillment: FULFILLMENT.READY });
  assert.equal(canAdvanceTo(cooking, FULFILLMENT.SERVED), true);
  assert.equal(canAdvanceTo(cooking, FULFILLMENT.SENT), false, 'a ready dish cannot go back to the pan');
  assert.equal(canAdvanceTo(cooking, FULFILLMENT.READY), false, 'a second tap is not a change');
});

test('a voided line cannot be advanced at all', () => {
  const gone = line({ voided: true });
  assert.equal(canAdvanceTo(gone, FULFILLMENT.SENT), false);
  assert.equal(isLive(gone), false);
});

test('an unknown or missing fulfillment reads as not yet fired', () => {
  assert.equal(fulfillmentOf({}), FULFILLMENT.NEW);
  assert.equal(fulfillmentOf({ fulfillment: 'nonsense' }), FULFILLMENT.NEW);
  assert.equal(fulfillmentOf(null), FULFILLMENT.NEW);
});

// ── The header cache ─────────────────────────────────────────────────

test('the header moves by the DIFFERENCE a change makes, never by the total', () => {
  // This is the whole multi-device story. Two devices each adding a round
  // send +500 and +300, and both land whichever order they arrive in.
  const added = headerDelta({ before: null, after: line() });
  assert.deepEqual(added, { totalAmount: 500, costOfGoodsSold: 200 });

  const removed = headerDelta({ before: line(), after: null });
  assert.deepEqual(removed, { totalAmount: -500, costOfGoodsSold: -200 });

  const doubled = headerDelta({
    before: line(),
    after: line({ quantity: 2, lineTotal: 1000, lineCost: 400 }),
  });
  assert.deepEqual(doubled, { totalAmount: 500, costOfGoodsSold: 200 });
});

test('voiding a line takes its money off the header and nothing else', () => {
  const before = line();
  const after = line({ voided: true });
  assert.deepEqual(headerDelta({ before, after }), { totalAmount: -500, costOfGoodsSold: -200 });
});

test('the header can always be recomputed exactly from the lines', () => {
  const lines = [line(), line({ id: 'l2', lineTotal: 300, lineCost: 100 }), line({ id: 'l3', voided: true, lineTotal: 900, lineCost: 400 })];
  assert.deepEqual(recomputeHeader(lines), {
    totalAmount: 800, costOfGoodsSold: 300, profit: 500, lineCount: 2,
  });
});

// ── Reading a ticket, both ways ──────────────────────────────────────

test('a legacy items-array ticket reads exactly like a lines ticket', () => {
  const legacy = readTicket({
    id: 'o1', status: 'open', kitchenStatus: 'preparing',
    totalAmount: 800,
    items: [
      { productId: 'p1', productName: 'Burger', quantity: 1, unitPrice: 500, costPrice: 200, lineTotal: 500, lineCost: 200 },
      { productId: 'p2', productName: 'Chips', quantity: 1, unitPrice: 300, costPrice: 100, lineTotal: 300, lineCost: 100 },
    ],
  });
  const modern = readTicket(
    { id: 'o2', status: 'open', lineModel: 'lines', totalAmount: 800 },
    [line({ id: 'a', orderId: 'o2', fulfillment: FULFILLMENT.SENT }),
     line({ id: 'b', orderId: 'o2', productId: 'p2', productName: 'Chips', lineTotal: 300, lineCost: 100, seq: 2, fulfillment: FULFILLMENT.SENT })]
  );
  assert.equal(legacy.totalAmount, modern.totalAmount);
  assert.equal(legacy.lines.length, modern.lines.length);
  assert.equal(ticketStage(legacy), ticketStage(modern));
});

test('a legacy line is marked read-only, so nothing tries to update a document that does not exist', () => {
  const ticket = readTicket({ id: 'o1', status: 'open', items: [{ productId: 'p1', quantity: 1, lineTotal: 100, lineCost: 40 }] });
  assert.equal(ticket.lineModel, LINE_MODEL.ARRAY);
  assert.equal(ticket.lines[0].readOnlyLine, true);
});

test("the legacy order-level kitchen status is read onto its lines, because it is what the kitchen was told", () => {
  const ticket = readTicket({ id: 'o1', status: 'open', kitchenStatus: 'ready', items: [{ productId: 'p1', quantity: 1, lineTotal: 100, lineCost: 0 }] });
  assert.equal(fulfillmentOf(ticket.lines[0]), FULFILLMENT.READY);
});

test('a lines ticket ignores lines belonging to another ticket', () => {
  const ticket = readTicket({ id: 'o1', lineModel: 'lines', status: 'open' }, [
    line({ id: 'a', orderId: 'o1' }),
    line({ id: 'b', orderId: 'SOMEONE_ELSE', lineTotal: 99999 }),
  ]);
  assert.equal(ticket.lines.length, 1);
  assert.equal(ticket.totalAmount, 500);
});

test('a drifted header cache is reported, never silently believed', () => {
  const ticket = readTicket({ id: 'o1', lineModel: 'lines', status: 'open', totalAmount: 12345 }, [line()]);
  assert.equal(ticket.totalAmount, 500, 'the lines are the truth');
  assert.equal(ticket.cachedTotal, 12345);
  assert.equal(ticket.cacheStale, true);
});

test('a legacy ticket is never reported as having a stale cache — it has no lines to disagree with', () => {
  const ticket = readTicket({ id: 'o1', status: 'open', totalAmount: 999, items: [] });
  assert.equal(ticket.cacheStale, false);
});

test('readTicket on nothing is null, not a crash', () => {
  assert.equal(readTicket(null), null);
  assert.equal(readTicket(undefined, []), null);
});

// ── The stage a ticket shows on a list ───────────────────────────────

test('a ticket shows the stage a floor manager is looking for first', () => {
  const base = { id: 'o1', lineModel: 'lines', status: 'open' };
  const ready = readTicket(base, [
    line({ id: 'a', fulfillment: FULFILLMENT.SENT }),
    line({ id: 'b', fulfillment: FULFILLMENT.READY }),
  ]);
  assert.equal(ticketStage(ready), FULFILLMENT.READY, 'something on the pass beats something cooking');

  const cooking = readTicket(base, [
    line({ id: 'a', fulfillment: FULFILLMENT.NEW }),
    line({ id: 'b', fulfillment: FULFILLMENT.SENT }),
  ]);
  assert.equal(ticketStage(cooking), FULFILLMENT.SENT);

  const done = readTicket(base, [line({ fulfillment: FULFILLMENT.SERVED })]);
  assert.equal(ticketStage(done), FULFILLMENT.SERVED);
});

test('a voided line does not hold a ticket at an earlier stage', () => {
  const ticket = readTicket({ id: 'o1', lineModel: 'lines', status: 'open' }, [
    line({ id: 'a', fulfillment: FULFILLMENT.SERVED }),
    line({ id: 'b', fulfillment: FULFILLMENT.NEW, voided: true }),
  ]);
  assert.equal(ticketStage(ticket), FULFILLMENT.SERVED);
});

// ── Split, merge, transfer ───────────────────────────────────────────

test('moving lines is one primitive, and it balances both headers exactly', () => {
  const lines = [line({ id: 'a' }), line({ id: 'b', lineTotal: 300, lineCost: 100 })];
  const plan = planLineMove(lines, { fromOrderId: 'o1', toOrderId: 'o2' });
  assert.equal(plan.moved, 2);
  assert.deepEqual(plan.fromDelta, { id: 'o1', totalAmount: -800, costOfGoodsSold: -300 });
  assert.deepEqual(plan.toDelta, { id: 'o2', totalAmount: 800, costOfGoodsSold: 300 });
  // What comes off one ticket must land on the other, to the cent.
  assert.equal(plan.fromDelta.totalAmount + plan.toDelta.totalAmount, 0);
});

test('a voided line is never moved — it is already gone', () => {
  const plan = planLineMove([line({ id: 'a', voided: true })], { fromOrderId: 'o1', toOrderId: 'o2' });
  assert.equal(plan.moved, 0);
  assert.deepEqual(plan.moves, []);
});

test('a legacy line cannot be moved, because there is no document to move', () => {
  const plan = planLineMove([{ ...line(), readOnlyLine: true }], { fromOrderId: 'o1', toOrderId: 'o2' });
  assert.equal(plan.moved, 0);
});

test('moving a line to the ticket it is already on is a no-op, not an error', () => {
  const plan = planLineMove([line({ orderId: 'o2' })], { fromOrderId: 'o2', toOrderId: 'o2' });
  assert.equal(plan.moved, 0);
});

// ── The room ─────────────────────────────────────────────────────────

test('a table is taken exactly while an open ticket carries its name', () => {
  const tickets = [
    readTicket({ id: 'o1', lineModel: 'lines', status: 'open', tableName: 'Table 1' }, [line()]),
    readTicket({ id: 'o2', lineModel: 'lines', status: 'completed', tableName: 'Table 2' }, [line({ id: 'x', orderId: 'o2' })]),
  ];
  const room = readRoom(['Table 1', 'Table 2', 'Table 3'], tickets);
  assert.equal(room.tables[0].occupied, true, 'an open ticket takes the table');
  assert.equal(room.tables[1].occupied, false, 'a charged ticket releases it, with nothing to remember to press');
  assert.equal(room.tables[2].occupied, false);
  assert.equal(room.occupied, 1);
});

test('two open tickets on one table is a real situation, not an error', () => {
  const tickets = [
    readTicket({ id: 'o1', lineModel: 'lines', status: 'open', tableName: 'Table 1' }, [line({ id: 'a', orderId: 'o1' })]),
    readTicket({ id: 'o2', lineModel: 'lines', status: 'open', tableName: 'Table 1' }, [line({ id: 'b', orderId: 'o2', lineTotal: 300, lineCost: 100 })]),
  ];
  const room = readRoom(['Table 1'], tickets);
  assert.equal(room.tables[0].tickets.length, 2);
  assert.equal(room.tables[0].total, 800, 'a split check still totals the table');
});

test('a ticket with no table is not lost — takeaway, delivery and bar tabs land in `untabled`', () => {
  const tickets = [readTicket({ id: 'o1', lineModel: 'lines', status: 'open', diningMode: 'takeaway' }, [line()])];
  const room = readRoom(['Table 1'], tickets);
  assert.equal(room.untabled.length, 1);
  assert.equal(room.occupied, 0);
});

test('the floor summary counts what is waiting to be run and what has not gone yet', () => {
  const tickets = [
    readTicket({ id: 'o1', lineModel: 'lines', status: 'open', tableName: 'T1' }, [
      line({ id: 'a', fulfillment: FULFILLMENT.READY }),
      line({ id: 'b', fulfillment: FULFILLMENT.NEW }),
    ]),
  ];
  const summary = summarizeTickets(tickets);
  assert.equal(summary.count, 1);
  assert.equal(summary.readyLines, 1);
  assert.equal(summary.unfiredLines, 1);
  assert.equal(summary.total, 1000);
});

// ── Courses ──────────────────────────────────────────────────────────

test('a ticket with no courses configured is one unnamed group', () => {
  const ticket = readTicket({ id: 'o1', lineModel: 'lines', status: 'open' }, [line()]);
  const groups = groupByCourse(ticket, []);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, null);
  assert.equal(groups[0].name, null, 'a business that does not use courses never learns the feature exists');
});

test('a line pointing at a course that no longer exists still appears', () => {
  const ticket = readTicket({ id: 'o1', lineModel: 'lines', status: 'open' }, [line({ courseId: 'deleted' })]);
  const groups = groupByCourse(ticket, [{ id: 'starters', name: 'Starters' }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, null);
  assert.equal(groups[0].lines.length, 1, 'a stale course id must never hide an item');
});

// ── Charging ─────────────────────────────────────────────────────────

test('a voided line is never charged for', () => {
  const ticket = readTicket({ id: 'o1', lineModel: 'lines', status: 'open' }, [
    line({ id: 'a' }),
    line({ id: 'b', voided: true, lineTotal: 900 }),
  ]);
  assert.equal(chargeableLines(ticket).length, 1);
  assert.equal(ticket.totalAmount, 500);
});

test('a ticket with nothing left on it cannot be charged', () => {
  const empty = readTicket({ id: 'o1', lineModel: 'lines', status: 'open' }, [line({ voided: true })]);
  assert.match(chargeProblem(empty), /nothing left/i);
});

test('an already-closed ticket cannot be charged twice', () => {
  const closed = readTicket({ id: 'o1', lineModel: 'lines', status: 'completed' }, [line()]);
  assert.match(chargeProblem(closed), /already been closed/i);
});

test('firing is not required before charging — a bar tab never sees a kitchen', () => {
  const tab = readTicket({ id: 'o1', lineModel: 'lines', status: 'open' }, [line({ fulfillment: FULFILLMENT.NEW })]);
  assert.equal(chargeProblem(tab), null);
});

// ── Ordering ─────────────────────────────────────────────────────────

test('lines sort into the order they were rung, and ties break stably', () => {
  const sorted = sortLines([
    line({ id: 'c', seq: 3 }), line({ id: 'a', seq: 1 }), line({ id: 'b', seq: 1 }),
  ]);
  assert.deepEqual(sorted.map((l) => l.id), ['a', 'b', 'c']);
});

test('two of the same item are one row; two with different choices are two', () => {
  const plain = lineRowKey({ productId: 'p1' });
  const same = lineRowKey({ productId: 'p1' });
  const cheesy = lineRowKey({ productId: 'p1', modifiers: [{ groupId: 'g', id: 'cheese' }] });
  assert.equal(plain, same);
  assert.notEqual(plain, cheesy);
});

// ── The `open` flag ──────────────────────────────────────────────────

test('a new line is in play, and that is a different fact from its kitchen stage', () => {
  const built = buildTicketLine(row(), { orderId: 'o1' });
  assert.equal(built.open, true);
  assert.equal(built.fulfillment, FULFILLMENT.NEW);
});

test('a served-but-unpaid table is still on the floor', () => {
  // The bug this flag exists to prevent: a live query written against the
  // fulfillment stages would drop this ticket at exactly the moment
  // somebody needs to charge it.
  const eaten = readTicket({ id: 'o1', lineModel: 'lines', status: 'open', tableName: 'T1' }, [
    line({ fulfillment: FULFILLMENT.SERVED, open: true }),
  ]);
  assert.equal(chargeProblem(eaten), null, 'it can still be charged');
  assert.equal(readRoom(['T1'], [eaten]).tables[0].occupied, true, 'and the table is still taken');
});
