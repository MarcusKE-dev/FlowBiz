// src/domain/fnb/floor.test.js
//
// The floor plan is arrangement ONLY. Every test below is really one
// assertion in two halves: nothing about a table's state is stored, and
// a plan that has drifted from the table list never renders a lie.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFloorPlan, defaultFloorPlan, readFloor, floorZones, floorPlanField,
  FLOOR_COLUMNS, FLOOR_ROWS, MAX_FLOOR_TABLES,
} from './floor.js';
import { readRoom, TICKET_STATUS } from './ticket.js';

// ── Normalisation ────────────────────────────────────────────────────

test('a plan is bounded on every axis, exactly as the rules bound it', () => {
  const huge = Array.from({ length: 250 }, (_, i) => ({ name: `T${i}`, x: 99, y: 99 }));
  const clean = normalizeFloorPlan(huge);
  assert.equal(clean.length, MAX_FLOOR_TABLES, 'the stored list is capped');
  for (const table of clean) {
    assert.ok(table.x >= 0 && table.x < FLOOR_COLUMNS, 'x stays on the grid');
    assert.ok(table.y >= 0 && table.y < FLOOR_ROWS, 'y stays on the grid');
  }
});

test('anything unusable is dropped rather than stored', () => {
  const clean = normalizeFloorPlan([
    { name: '  Table 1  ', x: 2, y: 3, seats: 4, zone: '  Terrace ' },
    { name: '' },                       // no name: cannot be reconciled
    { name: 'Table 1' },                // duplicate: first placement wins
    null,
    'not an object',
    { name: 'Table 2', seats: 0 },      // a table seating nobody
    { name: 'Table 3', seats: 9999 },   // clamped
  ]);
  assert.deepEqual(clean.map((t) => t.name), ['Table 1', 'Table 2', 'Table 3']);
  assert.equal(clean[0].zone, 'Terrace', 'trimmed');
  assert.equal(clean[0].seats, 4);
  assert.equal(clean[0].x, 2);
  assert.equal(clean[1].seats, undefined, 'a seat count of zero is not stored');
  assert.equal(clean[2].seats, 40, 'clamped to the ceiling');
});

test('a table picture must be an https URL or it is not stored', () => {
  const [a, b, c] = normalizeFloorPlan([
    { name: 'A', image: 'https://example.com/t.jpg' },
    { name: 'B', image: 'javascript:alert(1)' },
    { name: 'C', image: 'http://example.com/t.jpg' },
  ]);
  assert.equal(a.image, 'https://example.com/t.jpg');
  assert.equal(b.image, undefined, 'a script URL is never stored');
  assert.equal(c.image, undefined, 'plain http is not stored either');
});

test('an empty plan clears the field rather than storing an empty list', () => {
  assert.deepEqual(floorPlanField([]), { floorPlan: null });
  assert.deepEqual(floorPlanField([{ name: 'T1', x: 0, y: 0 }]).floorPlan.length, 1);
});

test('the default layout is reading order, which is the order the names are in', () => {
  const plan = defaultFloorPlan(['T1', 'T2', 'T3']);
  assert.deepEqual(plan, [
    { name: 'T1', x: 0, y: 0 },
    { name: 'T2', x: 1, y: 0 },
    { name: 'T3', x: 2, y: 0 },
  ]);
});

test('zones are listed once, in the order they first appear', () => {
  assert.deepEqual(
    floorZones([
      { name: 'A', zone: 'Terrace' },
      { name: 'B', zone: 'Main' },
      { name: 'C', zone: 'Terrace' },
      { name: 'D' },
    ]),
    ['Terrace', 'Main']
  );
});

// ── Reconciliation, which is the whole point ─────────────────────────

const openTicket = (over = {}) => ({
  id: over.id || 't1',
  status: TICKET_STATUS.OPEN,
  tableName: 'tableName' in over ? over.tableName : 'Table 1',
  totalAmount: over.totalAmount ?? 1200,
  liveLines: over.liveLines || [{ id: 'l1', fulfillment: 'sent' }],
  unfired: over.unfired || [],
  preparing: over.preparing || [{ id: 'l1' }],
  ready: over.ready || [],
  served: over.served || [],
});

test('A TABLE NAMED BUT NEVER PLACED STILL APPEARS — an invisible table cannot be seated', () => {
  const floor = readFloor({
    tableNames: ['Table 1', 'Table 2', 'Table 3'],
    plan: [{ name: 'Table 1', x: 5, y: 2 }],
  });
  assert.deepEqual(floor.tables.map((t) => t.name), ['Table 1', 'Table 2', 'Table 3']);
  assert.equal(floor.tables[0].placed, true);
  assert.equal(floor.tables[1].placed, false, 'Table 2 was never arranged');
  assert.ok(floor.tables[1].x >= 0 && floor.tables[1].y >= 0, 'but it still gets a cell');
});

test('an unplaced table never lands on top of a placed one', () => {
  const floor = readFloor({
    tableNames: ['Placed', 'A', 'B', 'C'],
    plan: [{ name: 'Placed', x: 0, y: 0 }],
  });
  const cells = floor.tables.map((t) => `${t.x},${t.y}`);
  assert.equal(new Set(cells).size, cells.length, 'every table has its own cell');
});

test('A PLACEMENT WHOSE TABLE WAS DELETED DISAPPEARS — never offer a seat at a table that is gone', () => {
  const floor = readFloor({
    tableNames: ['Table 1'],
    plan: [{ name: 'Table 1', x: 0, y: 0 }, { name: 'Table 99', x: 1, y: 0 }],
  });
  assert.deepEqual(floor.tables.map((t) => t.name), ['Table 1']);
});

test('OCCUPANCY IS DERIVED FROM THE TICKETS AND IS NEVER STORED', () => {
  const tickets = [openTicket({ tableName: 'Table 2' })];
  const room = readRoom(['Table 1', 'Table 2'], tickets);
  const floor = readFloor({ tableNames: ['Table 1', 'Table 2'], plan: null, room });

  assert.equal(floor.tables[0].occupied, false);
  assert.equal(floor.tables[1].occupied, true);
  assert.equal(floor.tables[1].total, 1200);
  assert.equal(floor.tables[1].stage, 'sent', 'the kitchen is working on it');
  assert.equal(floor.occupied, 1);
  assert.equal(floor.free, 1);

  // Nothing in the plan says anything about state, so a plan written
  // yesterday cannot make a table look taken today.
  for (const key of ['occupied', 'stage', 'total', 'needsRunning']) {
    assert.ok(!(key in normalizeFloorPlan([{ name: 'Table 2', [key]: true }])[0]),
      `${key} must never be storable on a plan entry`);
  }
});

test('a table with something on the pass is the one a manager wants highlighted', () => {
  const tickets = [openTicket({
    tableName: 'Table 1', ready: [{ id: 'l1' }], preparing: [],
  })];
  const room = readRoom(['Table 1'], tickets);
  const floor = readFloor({ tableNames: ['Table 1'], room });
  assert.equal(floor.tables[0].needsRunning, true);
  assert.equal(floor.needsRunning, 1);
});

test('takeaway and delivery tickets are carried, not dropped on the floor', () => {
  const tickets = [openTicket({ id: 'x', tableName: null })];
  const room = readRoom(['Table 1'], tickets);
  const floor = readFloor({ tableNames: ['Table 1'], room });
  assert.equal(floor.tables[0].occupied, false);
  assert.equal(floor.untabled.length, 1, 'a counter order still has to be visible somewhere');
});

test('a business with no tables and no plan reads as an empty room, not a crash', () => {
  const floor = readFloor();
  assert.deepEqual(floor.tables, []);
  assert.equal(floor.occupied, 0);
  assert.equal(floor.free, 0);
  assert.deepEqual(floor.untabled, []);
});
