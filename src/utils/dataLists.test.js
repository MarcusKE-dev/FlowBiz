// The three collection lists must agree with each other and with the
// rules, because drift between them is silent and expensive.
//
// What drift cost before this test existed: `orders`, `productions` and
// `productBatches` were added to the app (and to firestore.rules) and to
// none of these lists. A restaurant's tickets, a bakery's production runs
// and a pharmacy's batch and expiry ledger were therefore absent from a
// backup that promises "everything this business has stored", could not
// be restored, and survived a "delete everything" reset that said they
// would not.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

// All three lists are read from source rather than imported: their
// modules pull in src/firebase.js, which needs Vite's import.meta.env and
// a live SDK. A list of string literals does not need either to be
// checked, and this suite has to keep running under plain `node --test`.
function listFrom(file, name) {
  const src = readFileSync(new URL(file, import.meta.url), 'utf8');
  const body = src.slice(src.indexOf(`${name} = [`));
  return body
    .slice(0, body.indexOf('];'))
    .split('\n')
    // The lists carry explanatory comments, and an apostrophe in one of
    // those ("a bakery's runs") would otherwise be read as a collection.
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
    .match(/'([^']+)'/g)
    .map((s) => s.slice(1, -1));
}

const EXPORT_COLLECTIONS = listFrom('./dataExport.js', 'export const EXPORT_COLLECTIONS');
const IMPORT_COLLECTIONS = listFrom('./dataImport.js', 'export const IMPORT_COLLECTIONS');
const resetCollections = () => listFrom('./businessReset.js', 'const RESET_COLLECTIONS');

/**
 * Every collection the rules scope to one business by a `businessId`
 * FIELD. Collections keyed BY business id (businessSettings,
 * productCodeCounters) and platform-only collections are handled
 * separately or not at all, so they are named here rather than inferred.
 */
const NOT_A_TENANT_COLLECTION = new Set([
  // `databases` is the outermost rules match, not a collection.
  'databases',
  'systemAdmins', 'adminAuditLogs', 'opsEvents', 'loginEvents',
  // Keyed BY business id, or owned by the platform rather than the shop.
  'businesses', 'businessSettings', 'users', 'productCodeCounters',
]);

function tenantCollectionsInRules() {
  const names = [...rules.matchAll(/match \/(\w+)\/\{/g)].map((m) => m[1]);
  return [...new Set(names)].filter((name) => !NOT_A_TENANT_COLLECTION.has(name));
}

/**
 * Deliberately absent from a backup, each for a stated reason. Listing
 * them here is what makes the exclusion a decision rather than an
 * oversight: anything NOT named here and not exported fails the test.
 */
const NOT_BACKED_UP = {
  // Derived bookkeeping, rebuilt by the product save path. Restoring a
  // stale index would refuse barcodes that are actually free.
  barcodeIndex: 'derived from products',
  // Device credentials, not shop records. Restoring them into another
  // business would resurrect sign-ins nobody granted.
  sessions: 'device credentials, never restored',
};

test('every tenant collection the rules know about can be exported', () => {
  for (const name of tenantCollectionsInRules()) {
    if (name in NOT_BACKED_UP) continue;
    assert.ok(
      EXPORT_COLLECTIONS.includes(name),
      `${name} is business data the rules protect, but a backup would not contain it`
    );
  }
});

test('every tenant collection the rules know about is cleared by a reset', () => {
  const reset = resetCollections();
  for (const name of tenantCollectionsInRules()) {
    assert.ok(
      reset.includes(name),
      `${name} is business data, but "delete everything" would leave it behind`
    );
  }
});

test('anything that can be exported can be imported back', () => {
  assert.deepEqual([...EXPORT_COLLECTIONS].sort(), [...IMPORT_COLLECTIONS].sort());
});

test('the reset covers everything a backup does, and the two bookkeeping collections besides', () => {
  const reset = resetCollections();
  for (const name of EXPORT_COLLECTIONS) {
    if (name === 'businessSettings') continue; // reset rewrites it rather than deleting it
    assert.ok(reset.includes(name), `${name} is exported but never cleared`);
  }
  // Written alongside a product and a session, and owned by the business,
  // so a reset has to take them even though a backup does not carry them.
  assert.ok(reset.includes('barcodeIndex'));
  assert.ok(reset.includes('sessions'));
});

test('no list names a collection that does not exist in the rules', () => {
  const known = new Set([...rules.matchAll(/match \/(\w+)\/\{/g)].map((m) => m[1]));
  known.add('businessSettings');
  for (const [label, list] of [['export', EXPORT_COLLECTIONS], ['import', IMPORT_COLLECTIONS], ['reset', resetCollections()]]) {
    for (const name of list) {
      assert.ok(known.has(name), `the ${label} list names ${name}, which firestore.rules has no rule for`);
    }
  }
});
