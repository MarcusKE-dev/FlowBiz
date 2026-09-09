// src/domain/fnb/wiring.test.js
//
// THE FAILURE MODE THIS FILE EXISTS FOR, and it is not a bug in any
// function: every unit test in src/domain/fnb passed, the engine was
// correct, and almost none of it was CONNECTED TO ANYTHING.
//
// What that cost, found by reading the tree rather than by running it:
//
//   `catalog.js` was imported by no screen, so an ingredient was still
//   sellable on the till and the add form still demanded a price for a
//   tomato — the exact defect the module was written to fix.
//
//   `sellingUnitCost` was imported by no screen, so every sale booked
//   COGS at the stored `costPrice`, which is meaningless for a dish
//   assembled to order. The recipe engine computed the right number and
//   the ledger ignored it.
//
//   `orderLines` and `waste` had Firestore INDEXES and no RULES, which in
//   Firestore means denied. Both features were dark in production.
//
//   `Waste.jsx` was a finished page with no route.
//
//   The kitchen screen read the raw `orderLines` query rather than the
//   tickets, so it was permanently empty for every ticket the counter
//   actually writes.
//
// A unit test cannot catch any of that, because each individual piece
// was right. These are static assertions over the source — the same
// technique src/legal/legalLinks.test.js uses, and for the same reason:
// they run under plain `node --test` with no browser and no emulator,
// and they fail the moment somebody disconnects a wire during a
// refactor, which is exactly when it happens.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const REPO = new URL('../../..', import.meta.url).pathname;
const read = (path) => readFileSync(`${REPO}${path}`, 'utf8');

// ── Every page has a route ───────────────────────────────────────────

test('EVERY PAGE IS REACHABLE — a finished screen with no route is dead code', () => {
  const router = read('src/router/AppRouter.jsx');
  const pages = readdirSync(`${REPO}src/pages`)
    .filter((f) => f.endsWith('.jsx'))
    .map((f) => f.replace('.jsx', ''));

  const orphans = pages.filter((page) => !router.includes(`pages/${page}'`));
  assert.deepEqual(orphans, [],
    'these pages exist and nothing routes to them — Waste.jsx sat like this through a whole audit');
});

// ── The engine is actually used ──────────────────────────────────────

/**
 * Each entry is a function the F&B engine exports, and the screen whose
 * correctness depends on it calling it. A pure-function test proves the
 * function is right; only this proves anybody asks it.
 */
const MUST_BE_WIRED = [
  ['sellableProducts', 'src/pages/Counter.jsx',
    'ingredients must not appear on the till grid'],
  ['isIngredientOnly', 'src/pages/Counter.jsx',
    'scanning an ingredient must say so rather than ringing it up'],
  ['sellingUnitCost', 'src/pages/Counter.jsx',
    'a made-to-order dish must book its RECIPE cost, not its stored costPrice'],
  ['catalogRoleField', 'src/components/products/ProductFormModal.jsx',
    'an owner must be able to mark a row as an ingredient'],
  ['recipeComponentGroups', 'src/components/products/RecipeEditor.jsx',
    'the component picker must say which entries are ingredients'],
  ['tracksOwnStock', 'src/components/pos/ProductGrid.jsx',
    'a made-to-order dish has stock 0 by design and must not be disabled'],
  ['stationOptions', 'src/components/products/ProductFormModal.jsx',
    'a product must be routable to a kitchen section'],
  ['linesForStation', 'src/pages/Kitchen.jsx',
    'the kitchen screen must filter by station'],
  ['advanceLegacyTicket', 'src/pages/Kitchen.jsx',
    'the Ready button must work on the tickets the counter actually writes'],
  ['readFloor', 'src/pages/Floor.jsx',
    'the waiter screen must read the room'],
  ['readFloor', 'src/pages/CustomerDisplay.jsx',
    'the customer display must show the tables'],
  ['readOrderBoard', 'src/pages/CustomerDisplay.jsx',
    'the customer display must show the queue'],
  ['readMenuReel', 'src/pages/CustomerDisplay.jsx',
    'the customer display must show the menu'],
];

for (const [fn, file, why] of MUST_BE_WIRED) {
  test(`${fn} is called by ${file.split('/').pop()} — ${why}`, () => {
    assert.match(read(file), new RegExp(`\\b${fn}\\b`),
      `${fn} is exported, tested, and imported by nothing that matters. ${why}`);
  });
}

test('THE KITCHEN READS THE TICKETS, NOT THE RAW LINE QUERY', () => {
  // The single most expensive wiring bug found: `useTickets` returns both
  // `tickets` (lines presented whichever way the ticket stores them) and
  // `lines` (the raw orderLines collection). The kitchen screen filtered
  // the raw collection, so it saw nothing at all for a ticket written as
  // an `items` array — which is every ticket the counter writes today.
  const source = read('src/pages/Kitchen.jsx');
  assert.match(source, /tickets\.flatMap\(/,
    'the kitchen must build its rail from the tickets, so a legacy ticket appears on it');
  assert.ok(!/const \{ tickets, lines,/.test(source),
    'reading the raw line query here is the bug this test exists for');
});

// ── The Firestore boundary ───────────────────────────────────────────

test('EVERY INDEXED COLLECTION HAS A RULE — an index without a rule is a denied query', () => {
  const rules = read('firestore.rules');
  const indexes = JSON.parse(read('firestore.indexes.json'));
  const indexed = new Set((indexes.indexes || []).map((i) => i.collectionGroup));

  // Platform collections written only by the Worker or the admin console.
  const NOT_CLIENT_READABLE = new Set(['adminAuditLogs', 'opsEvents', 'loginEvents']);

  const unruled = [...indexed]
    .filter((name) => !NOT_CLIENT_READABLE.has(name))
    .filter((name) => !rules.includes(`match /${name}/{`));

  assert.deepEqual(unruled, [],
    'these collections have an index and no rule, so every query against them is denied');
});

test('a collection the client writes is on all three data lists', () => {
  // The export/import/reset lists have their own drift test; this one
  // catches the specific pair that was missing, by name, so the reason is
  // recorded rather than inferred from a diff.
  for (const name of ['orderLines', 'waste']) {
    assert.ok(read('src/utils/dataExport.js').includes(`'${name}'`), `${name} must be backed up`);
    assert.ok(read('src/utils/dataImport.js').includes(`'${name}'`), `${name} must be restorable`);
    assert.ok(read('src/utils/businessReset.js').includes(`'${name}'`), `${name} must be cleared by a reset`);
    assert.ok(
      read('cloudflare-worker/src/routes/admin/adminBusinesses.js').includes(`'${name}'`),
      `${name} must be purged when a business is deleted`
    );
  }
});

// ── The three copies of the capability list ──────────────────────────

test('the client, the Worker and the rules agree on the food capabilities', () => {
  const clientSource = read('src/industry/capabilities.js');
  const worker = read('cloudflare-worker/src/lib/industry.js');
  const rules = read('firestore.rules');

  for (const key of ['kitchenStations', 'courses', 'waste']) {
    assert.match(clientSource, new RegExp(`\\b${key}:`), `${key} must exist in the catalogue`);
    assert.ok(worker.includes(`'${key}'`), `the Worker would refuse to store ${key}`);
    assert.ok(rules.includes(`'${key}'`), `firestore.rules would refuse to store ${key}`);
  }
});

// ── The customer display's privacy, at the boundary ──────────────────

test('THE CUSTOMER DISPLAY NEVER RENDERS MONEY OFF A TICKET', () => {
  // domain/fnb/display.test.js proves the derivation drops it. This
  // proves the component does not go around the derivation and read the
  // ticket directly — which is how a screen on a dining-room wall ends up
  // showing what Table 5 is spending.
  const source = read('src/pages/CustomerDisplay.jsx');
  assert.ok(!/ticket\.totalAmount|\.cachedTotal|table\.total\b/.test(source),
    'a customer-facing board must never read a ticket total');
  assert.ok(!/openedByName|\.note\b|describeModifiers/.test(source),
    'nor a member of staff, an order note, or what somebody ordered');
});
