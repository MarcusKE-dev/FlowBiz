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

// The functions the 2026-09-27 audit found correct and disconnected, or
// whose screens bypassed them. These are checked for a CALL, not merely a
// mention — an import that is never invoked is the same orphan.
const MUST_BE_CALLED = [
  ['planProduction', 'src/pages/Production.jsx',
    'a short yield must be costed over what came out, and a missing ingredient refused'],
  ['productionDeltas', 'src/pages/Production.jsx',
    'a sub-recipe must be consumed down to its ingredients'],
  ['buildProductionRecord', 'src/pages/Production.jsx',
    'the run record must carry its plan and yield'],
  ['componentUsage', 'src/pages/Counter.jsx',
    'a sale must record the ingredients it took, so a reversal can put exactly them back'],
  ['resolveReversalDeltas', 'src/pages/Counter.jsx',
    'a void or return must restore ingredients, not filter them out'],
  ['resolveReversalDeltas', 'src/pages/CustomerDetail.jsx',
    'a cancelled credit sale must restore what it recorded taking'],
  ['allocateFefoAcrossLines', 'src/pages/Counter.jsx',
    'two lines of one product must share one batch pool'],
  ['allocateSaleTotal', 'src/pages/Counter.jsx',
    'a negotiated total must be spread over the lines, or a return over-refunds'],
  ['computeCheck', 'src/pages/Counter.jsx',
    'a configured service charge must reach the bill'],
  ['productPerformance', 'src/pages/Reports.jsx',
    'product figures must net out returns'],
  ['productPerformance', 'src/pages/AdvancedAnalytics.jsx',
    'product figures must net out returns'],
  ['wasteSubledgerProblem', 'src/pages/Waste.jsx',
    'waste must name the version or batch it came from'],
  ['remapDocumentReferences', 'src/utils/dataImport.js',
    'a restore into another business must remap nested references'],
  ['inventoryValue', 'src/pages/Dashboard.jsx',
    'inventory must be valued at what its batches cost'],
  ['weightedAverageCost', 'src/pages/Purchases.jsx',
    'a delivery must average the cost, not overwrite it'],
];

for (const [fn, file, why] of MUST_BE_CALLED) {
  test(`${fn}() is CALLED by ${file.split('/').pop()} — ${why}`, () => {
    assert.match(read(file), new RegExp(`\\b${fn}\\s*\\(`),
      `${fn} is not called by ${file}. ${why}`);
  });
}

test('WASTE REACHES PROFIT: the financial hook subscribes to it and passes it on', () => {
  const source = read('src/hooks/useFinancials.js');
  assert.match(source, /tenantQuery\('waste'/);
  assert.match(source, /wasteRecords:\s*waste/);
});

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
