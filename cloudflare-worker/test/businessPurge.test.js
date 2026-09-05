// Deleting a business must actually delete the business.
//
// The failure mode this guards is silent: a tenant collection gets added
// to firestore.rules and to the client, nobody adds it to the purge list,
// and a "deleted" customer's orders and production runs stay live in the
// database forever. So the first test derives the expected set FROM
// firestore.rules rather than restating it — a new tenant collection
// fails this test until the purge knows about it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installStub, mintIdToken, adminRequest, env } from './helpers/adminHarness.js';

const BASE = new URL('../src/', import.meta.url).href;
const state = installStub();

const { handleAdminDeleteBusiness, PURGE_COLLECTIONS } = await import(`${BASE}routes/admin/adminBusinesses.js`);

// Collections the purge deals with by other means, so their absence from
// PURGE_COLLECTIONS is deliberate rather than an oversight.
const HANDLED_ELSEWHERE = new Set([
  'businesses',          // deleted last, by id
  'businessSettings',    // deleted by id
  'productCodeCounters', // one document, keyed by businessId
  'users',               // paged separately, because auth accounts go too
]);

// Not tenant data: platform-level registers and security telemetry that
// deliberately outlive a tenant.
const NOT_TENANT_DATA = new Set([
  'adminAuditLogs', 'systemAdmins', 'loginEvents', 'opsEvents', 'databases',
]);

function tenantCollectionsFromRules() {
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const names = new Set();
  const matcher = /match \/([a-zA-Z_]+)\/\{[^}]+\}\s*\{([\s\S]*?)\n {4}\}/g;
  let m;
  while ((m = matcher.exec(rules))) {
    const [, name, block] = m;
    if (NOT_TENANT_DATA.has(name) || HANDLED_ELSEWHERE.has(name)) continue;
    // `owns(...)` is the tenant test in this ruleset; a rule that uses it
    // is scoping documents by businessId, which makes them tenant data.
    if (/\bowns(Update)?\(/.test(block)) names.add(name);
  }
  return names;
}

test('every tenant collection in firestore.rules is on the purge list', () => {
  const expected = tenantCollectionsFromRules();
  assert.ok(expected.size > 10, `sanity: parsed only ${expected.size} tenant collections from firestore.rules`);

  const missing = [...expected].filter((c) => !PURGE_COLLECTIONS.includes(c));
  assert.deepEqual(missing, [], `tenant collections missing from PURGE_COLLECTIONS: ${missing.join(', ')}`);
});

function reset() {
  state.store = {};
  state.store['systemAdmins/admin-uid'] = { uid: 'admin-uid', email: 'ops@flowbiz.co.ke', role: 'SUPER_ADMIN', active: true };
  state.store['businesses/BIZ_A'] = { name: 'Duka A', createdBy: 'owner-a', status: 'active' };
  state.store['businesses/BIZ_B'] = { name: 'Duka B', createdBy: 'owner-b', status: 'active' };
  state.store['businessSettings/BIZ_A'] = { businessId: 'BIZ_A', currency: 'KES' };
  state.store['businessSettings/BIZ_B'] = { businessId: 'BIZ_B', currency: 'KES' };
  state.store['users/owner-a'] = { uid: 'owner-a', businessId: 'BIZ_A', role: 'owner', active: true };
  state.store['users/owner-b'] = { uid: 'owner-b', businessId: 'BIZ_B', role: 'owner', active: true };

  // One document per collection the audit found missing, plus a
  // neighbouring tenant's copy of each, which must survive.
  for (const coll of ['orders', 'productions', 'productBatches', 'products', 'sales']) {
    state.store[`${coll}/a1`] = { businessId: 'BIZ_A' };
    state.store[`${coll}/b1`] = { businessId: 'BIZ_B' };
  }
}

const deleteRequest = (text = 'DELETE Duka A') =>
  adminRequest('/api/admin/businesses/BIZ_A', {
    method: 'DELETE', token: mintIdToken(), body: { confirmationText: text },
  });

test('orders, productions and product batches are purged with the business', async () => {
  reset();
  const res = await handleAdminDeleteBusiness(deleteRequest(), env, 'BIZ_A');
  assert.equal(res.status, 200);

  for (const coll of ['orders', 'productions', 'productBatches']) {
    assert.equal(state.store[`${coll}/a1`], undefined, `${coll} was left behind`);
  }
  assert.equal(state.store['businesses/BIZ_A'], undefined);
  assert.equal(state.store['businessSettings/BIZ_A'], undefined);
  assert.equal(state.store['users/owner-a'], undefined);
});

test('the neighbouring business loses nothing', async () => {
  reset();
  await handleAdminDeleteBusiness(deleteRequest(), env, 'BIZ_A');

  for (const coll of ['orders', 'productions', 'productBatches', 'products', 'sales']) {
    assert.ok(state.store[`${coll}/b1`], `${coll} of the other tenant was deleted`);
  }
  assert.ok(state.store['businesses/BIZ_B']);
  assert.ok(state.store['businessSettings/BIZ_B']);
  assert.ok(state.store['users/owner-b']);
});

test('a wrong confirmation phrase deletes nothing', async () => {
  reset();
  const res = await handleAdminDeleteBusiness(deleteRequest('DELETE Duka B'), env, 'BIZ_A');
  assert.equal(res.status, 400);
  assert.ok(state.store['businesses/BIZ_A']);
  assert.ok(state.store['orders/a1']);
});

test('staff beyond the first page of users are still removed', async () => {
  reset();
  for (let i = 0; i < 130; i++) {
    state.store[`users/staff-${i}`] = { uid: `staff-${i}`, businessId: 'BIZ_A', role: 'cashier', active: true };
  }

  const res = await handleAdminDeleteBusiness(deleteRequest(), env, 'BIZ_A');
  assert.equal(res.status, 200);

  const leftBehind = Object.keys(state.store).filter((k) => k.startsWith('users/staff-'));
  assert.deepEqual(leftBehind, [], `${leftBehind.length} staff profiles survived the purge`);
});
