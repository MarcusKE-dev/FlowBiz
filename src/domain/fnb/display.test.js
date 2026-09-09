// src/domain/fnb/display.test.js
//
// A customer display is read by people who do not work for the business,
// so what it must NOT show is as much of a requirement as what it shows.
// The privacy assertions below are the reason this derivation is a pure
// function in the domain rather than JSX in a component.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPLAY_STAGE, displayStage, waitingMinutes, readOrderBoard, readMenuReel,
  readyIds, newlyReady, toMillis,
} from './display.js';

const NOW = Date.parse('2026-09-08T19:30:00.000Z');
const minutesAgo = (n) => new Date(NOW - n * 60000);

const line = (fulfillment, over = {}) => ({ id: over.id || 'l1', fulfillment, ...over });

const ticket = (over = {}) => {
  const lines = over.lines || [line('sent')];
  const live = lines.filter((l) => !l.voided);
  return {
    id: over.id || 't1',
    name: over.name || 'Table 4',
    tableName: 'tableName' in over ? over.tableName : 'Table 4',
    diningMode: over.diningMode || 'dine-in',
    openedAt: over.openedAt || minutesAgo(12),
    liveLines: live,
    unfired: live.filter((l) => (l.fulfillment || 'new') === 'new'),
    preparing: live.filter((l) => l.fulfillment === 'sent'),
    ready: live.filter((l) => l.fulfillment === 'ready'),
    served: live.filter((l) => l.fulfillment === 'served'),
    // What must never reach the screen.
    totalAmount: 4850,
    openedByName: 'Grace',
    note: 'regular, comped last time',
  };
};

// ── The customer's vocabulary ────────────────────────────────────────

test('the kitchen says "sent"; a customer is told "preparing"', () => {
  assert.equal(displayStage('new'), DISPLAY_STAGE.ORDERED);
  assert.equal(displayStage('sent'), DISPLAY_STAGE.PREPARING);
  assert.equal(displayStage('ready'), DISPLAY_STAGE.READY);
  assert.equal(displayStage('served'), DISPLAY_STAGE.SERVED);
  assert.equal(displayStage(undefined), DISPLAY_STAGE.ORDERED, 'anything unknown is not yet started');
});

test('waiting is measured from when the order was PLACED, which is what the customer is counting', () => {
  assert.equal(waitingMinutes(ticket({ openedAt: minutesAgo(7) }), NOW), 7);
  assert.equal(waitingMinutes(ticket({ openedAt: minutesAgo(0) }), NOW), 0);
  assert.equal(waitingMinutes({ }, NOW), null, 'no timestamp prints nothing, never a false zero');
  // A clock that has gone backwards must not print a negative wait.
  assert.equal(waitingMinutes(ticket({ openedAt: new Date(NOW + 60000) }), NOW), 0);
});

test('a Firestore timestamp, a Date and an ISO string all read the same', () => {
  const iso = '2026-09-08T19:00:00.000Z';
  assert.equal(toMillis({ toMillis: () => 42 }), 42);
  assert.equal(toMillis(new Date(iso)), Date.parse(iso));
  assert.equal(toMillis(iso), Date.parse(iso));
  assert.equal(toMillis(null), null);
  assert.equal(toMillis('not a date'), null);
});

// ── The board ────────────────────────────────────────────────────────

test('READY GOES FIRST — it is the only row that asks somebody to do something', () => {
  const board = readOrderBoard([
    ticket({ id: 'a', lines: [line('sent')] }),
    ticket({ id: 'b', lines: [line('ready')] }),
  ], { now: NOW });

  assert.deepEqual(board.ready.map((e) => e.id), ['b']);
  assert.deepEqual(board.working.map((e) => e.id), ['a']);
});

test('an order nobody has fired yet is still shown, as Ordered', () => {
  const board = readOrderBoard([ticket({ id: 'a', lines: [line('new')] })], { now: NOW });
  assert.equal(board.working.length, 1, 'a customer who has just paid must not see nothing');
  assert.equal(board.working[0].stage, DISPLAY_STAGE.ORDERED);
});

test('a ticket that is entirely served has left the board', () => {
  const board = readOrderBoard([ticket({ id: 'a', lines: [line('served')] })], { now: NOW });
  assert.equal(board.ready.length, 0);
  assert.equal(board.working.length, 0, 'the food is on the table; nobody is waiting on it');
});

test('the oldest wait is at the top of each list', () => {
  const board = readOrderBoard([
    ticket({ id: 'new', openedAt: minutesAgo(2) }),
    ticket({ id: 'old', openedAt: minutesAgo(25) }),
    ticket({ id: 'mid', openedAt: minutesAgo(11) }),
  ], { now: NOW });
  assert.deepEqual(board.working.map((e) => e.id), ['old', 'mid', 'new']);
});

test('a part-finished ticket reports how much of it is done, without naming a dish', () => {
  const board = readOrderBoard([ticket({
    id: 'a',
    lines: [line('ready', { id: '1' }), line('sent', { id: '2' }), line('sent', { id: '3' })],
  })], { now: NOW });
  const entry = board.ready[0];
  assert.equal(entry.itemsTotal, 3);
  assert.equal(entry.itemsReady, 1);
});

test('THE BOARD CARRIES NO MONEY, NO STAFF NAME, NO NOTE AND NO DISH', () => {
  const board = readOrderBoard([ticket({ id: 'a', lines: [line('ready')] })], { now: NOW });
  const serialised = JSON.stringify(board);
  // The ticket handed in carries all four. None may survive the read.
  assert.ok(!serialised.includes('4850'), 'a dining room must never read what another table is spending');
  assert.ok(!serialised.includes('Grace'), 'no member of staff is named on a public screen');
  assert.ok(!serialised.includes('comped'), 'an internal note is not customer-facing');
  assert.ok(!/productName|kitchenName|modifiers/.test(serialised), 'what a table ordered is that party’s business');

  // And the fields it DOES carry are exactly the ones a queue needs.
  assert.deepEqual(Object.keys(board.ready[0]).sort(), [
    'diningMode', 'id', 'itemsReady', 'itemsTotal', 'label', 'stage', 'tableName', 'waiting',
  ]);
});

test('the board is bounded, because a screen has a bottom edge', () => {
  const many = Array.from({ length: 60 }, (_, i) =>
    ticket({ id: `t${i}`, lines: [line('sent')] }));
  const board = readOrderBoard(many, { now: NOW, limit: 10 });
  assert.equal(board.working.length, 10);
});

test('a ticket with nothing live on it is not on the board at all', () => {
  const board = readOrderBoard([
    { id: 'x', name: 'Table 9', liveLines: [], unfired: [], preparing: [], ready: [], served: [] },
    null,
  ], { now: NOW });
  assert.equal(board.ready.length + board.working.length, 0);
});

// ── The menu reel ────────────────────────────────────────────────────

const item = (over) => ({
  id: over.id, name: over.name || over.id, sellingPrice: 500,
  category: 'Mains', ...over,
});

test('PHOTOGRAPHED ITEMS FIRST — a name floating in an empty rectangle is not a menu board', () => {
  const products = [
    item({ id: 'a' }),
    item({ id: 'b', imageUrl: 'https://x/1.webp' }),
    item({ id: 'c', imageUpdatedAt: 1 }),
  ];
  const reel = readMenuReel(products, { minimum: 2 });
  assert.deepEqual(reel.map((r) => r.id), ['b', 'c'], 'the two with pictures, and no filler');
  assert.ok(reel.every((r) => r.photographed));
});

test('too few photographs falls back to unphotographed items rather than a three-item loop', () => {
  const products = [
    item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' }),
    item({ id: 'p', imageUrl: 'https://x/1.webp' }),
  ];
  const reel = readMenuReel(products, { minimum: 3 });
  assert.equal(reel.length, 3);
  assert.equal(reel[0].id, 'p', 'the photographed one still leads');
});

test('nothing unpriced, nothing deleted, ever reaches a customer-facing menu', () => {
  const reel = readMenuReel([
    item({ id: 'free', sellingPrice: 0 }),
    item({ id: 'gone', deleted: true, imageUrl: 'https://x/1.webp' }),
    item({ id: 'ok', imageUrl: 'https://x/2.webp' }),
  ], { minimum: 1 });
  assert.deepEqual(reel.map((r) => r.id), ['ok']);
});

test('an empty or malformed catalogue produces an empty reel, not a crash', () => {
  assert.deepEqual(readMenuReel(null), []);
  assert.deepEqual(readMenuReel([null, undefined]), []);
});

// ── The chime ────────────────────────────────────────────────────────

test('THE CHIME COMPARES IDENTITIES, NOT COUNTS', () => {
  // The case a count gets wrong: one ticket collected and another
  // finished between two snapshots. The count is unchanged, and a
  // count-based chime announces the new one to nobody.
  const before = readyIds({ ready: [{ id: 'a' }] });
  const after = readyIds({ ready: [{ id: 'b' }] });
  assert.deepEqual(newlyReady(before, after), ['b']);
  assert.equal(before.size, after.size, 'the counts were equal the whole time');
});

test('nothing new means no chime, and a collected order never re-announces', () => {
  assert.deepEqual(newlyReady(new Set(['a', 'b']), new Set(['a', 'b'])), []);
  assert.deepEqual(newlyReady(new Set(['a', 'b']), new Set(['a'])), []);
  assert.deepEqual(newlyReady(undefined, new Set(['a'])), ['a'], 'the first snapshot announces');
});
