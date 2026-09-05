// Changing a business's industry, from the administrative side.
//
// This is the operation the merchant app deliberately does NOT offer: the
// business type is chosen once, at setup, and a correction afterwards
// goes through a platform administrator so that it is permissioned and
// audited. What has to be true of it is narrow and absolute —
//
//   IT DESTROYS NOTHING. Not a product, not a sale, not a customer, not a
//   category, not a batch, not an invoice. A correction to what FlowBiz
//   OFFERS a business must never touch what the business HAS.
//
//   IT CANNOT REACH THE PLAN. Two-field patch, on one document; nothing
//   in it can arrive at `businesses/{id}.subscription`.
//
//   IT IS AUTHORISED SERVER-SIDE and audited, every time.
//
// The stub applies its writes, so the assertions below are about the
// documents that are actually left behind.

import test from 'node:test';
import assert from 'node:assert/strict';
import { installStub, mintIdToken, adminRequest, env } from './helpers/adminHarness.js';

const BASE = new URL('../src/', import.meta.url).href;
const state = installStub();

const { handleAdminIndustryUpdate } = await import(`${BASE}routes/admin/adminIndustry.js`);

const post = (body, token) => adminRequest('/api/admin/businesses/BIZ_A/industry', { method: 'POST', body, token });

const asAdmin = (role = 'SUPER_ADMIN') => {
  state.store['systemAdmins/admin-uid'] = { uid: 'admin-uid', email: 'ops@flowbiz.co.ke', role, active: true };
  return mintIdToken();
};

/** An electronics shop with a year of trade behind it. */
function reset() {
  state.store = {};
  state.identityCalls = [];
  state.store['businesses/BIZ_A'] = {
    name: 'Duka Electronics', createdBy: 'owner-a', status: 'active',
    subscription: { plan: 'pro', status: 'active' },
  };
  state.store['businessSettings/BIZ_A'] = {
    businessId: 'BIZ_A',
    shopName: 'Duka Electronics',
    industryProfile: 'ELECTRONICS',
    capabilityOverrides: { variants: false },
    // The business's own half of its category list — see
    // src/industry/categories.js.
    customCategories: ['Solar Kits', 'Repairs Bench'],
    hiddenCategories: ['Storage'],
    categoryOrder: ['Phones', 'Solar Kits'],
    cashierPermissions: { 'sales.return': true },
  };
  state.store['products/p1'] = { businessId: 'BIZ_A', name: 'Phone Charger', category: 'Cables & Chargers', stock: 12 };
  state.store['products/p2'] = { businessId: 'BIZ_A', name: 'Bluetooth Speaker', category: 'TV & Audio', stock: 3 };
  state.store['sales/s1'] = { businessId: 'BIZ_A', total: 4500, productName: 'Bluetooth Speaker' };
  state.store['customers/c1'] = { businessId: 'BIZ_A', name: 'Mama Njeri' };
  state.store['suppliers/su1'] = { businessId: 'BIZ_A', name: 'Nairobi Electronics' };
  state.store['purchases/pu1'] = { businessId: 'BIZ_A', total: 30000 };
  state.store['expenses/e1'] = { businessId: 'BIZ_A', amount: 500 };
  state.store['creditSales/cs1'] = { businessId: 'BIZ_A', total: 900 };
  state.store['refunds/r1'] = { businessId: 'BIZ_A', amount: 200 };
  state.store['productBatches/b1'] = { businessId: 'BIZ_A', batchNumber: 'X1' };
  state.store['orders/o1'] = { businessId: 'BIZ_A', status: 'open' };
}

const businessDocs = () => Object.keys(state.store).filter((k) => !k.startsWith('adminAuditLogs/')).sort();

// ── Authorisation ────────────────────────────────────────────────────

test('an unauthenticated caller cannot change a business type', async () => {
  reset();
  const res = await handleAdminIndustryUpdate(post({ industryProfile: 'PHARMACY' }), env, 'BIZ_A');
  assert.equal(res.status, 401);
  assert.equal(state.store['businessSettings/BIZ_A'].industryProfile, 'ELECTRONICS');
});

test('a SUPPORT administrator cannot change a business type', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  const res = await handleAdminIndustryUpdate(post({ industryProfile: 'PHARMACY' }, token), env, 'BIZ_A');
  assert.equal(res.status, 403);
  assert.equal(state.store['businessSettings/BIZ_A'].industryProfile, 'ELECTRONICS');
});

test('an invented industry is refused rather than stored', async () => {
  reset();
  const token = asAdmin();
  const res = await handleAdminIndustryUpdate(post({ industryProfile: 'CASINO' }, token), env, 'BIZ_A');
  assert.equal(res.status, 400);
  assert.equal(state.store['businessSettings/BIZ_A'].industryProfile, 'ELECTRONICS');
});

// ── Electronics → Pharmacy ───────────────────────────────────────────

test('the change writes the new profile and nothing else on the business', async () => {
  reset();
  const token = asAdmin();
  const res = await handleAdminIndustryUpdate(
    post({ industryProfile: 'PHARMACY', reason: 'set up wrongly at signup' }, token), env, 'BIZ_A'
  );
  assert.equal(res.status, 200);
  assert.equal(state.store['businessSettings/BIZ_A'].industryProfile, 'PHARMACY');
  // The plan is on a different document and is never touched.
  assert.deepEqual(state.store['businesses/BIZ_A'].subscription, { plan: 'pro', status: 'active' });
  assert.equal(state.store['businesses/BIZ_A'].status, 'active');
});

test('NOTHING IS DELETED — every record is exactly where it was', async () => {
  reset();
  const token = asAdmin();
  const before = businessDocs();
  const beforeProducts = JSON.stringify([state.store['products/p1'], state.store['products/p2']]);
  await handleAdminIndustryUpdate(post({ industryProfile: 'PHARMACY' }, token), env, 'BIZ_A');

  assert.deepEqual(businessDocs(), before, 'no document may disappear');
  assert.equal(
    JSON.stringify([state.store['products/p1'], state.store['products/p2']]), beforeProducts,
    'and no product may be rewritten into the new trade'
  );
  assert.equal(state.store['sales/s1'].total, 4500, 'history is untouched');
  assert.equal(state.store['products/p1'].category, 'Cables & Chargers', 'a product keeps the word it was filed under');
});

test('the business\'s OWN categories survive the change; the trade\'s defaults are not stored', async () => {
  reset();
  const token = asAdmin();
  await handleAdminIndustryUpdate(post({ industryProfile: 'PHARMACY' }, token), env, 'BIZ_A');
  const settings = state.store['businessSettings/BIZ_A'];
  assert.deepEqual(settings.customCategories, ['Solar Kits', 'Repairs Bench']);
  assert.deepEqual(settings.hiddenCategories, ['Storage']);
  assert.deepEqual(settings.categoryOrder, ['Phones', 'Solar Kits']);
});

test('cashier permissions are the owner\'s, and a trade correction does not clear them', async () => {
  reset();
  const token = asAdmin();
  await handleAdminIndustryUpdate(post({ industryProfile: 'PHARMACY' }, token), env, 'BIZ_A');
  assert.deepEqual(state.store['businessSettings/BIZ_A'].cashierPermissions, { 'sales.return': true });
});

test('capability overrides ARE cleared, because they were made against the old trade', async () => {
  reset();
  const token = asAdmin();
  await handleAdminIndustryUpdate(post({ industryProfile: 'PHARMACY' }, token), env, 'BIZ_A');
  assert.deepEqual(state.store['businessSettings/BIZ_A'].capabilityOverrides, {});
});

test('a forged override body cannot switch on a capability the profile owns', async () => {
  reset();
  const token = asAdmin();
  await handleAdminIndustryUpdate(
    post({ capabilityOverrides: { orders: true, batches: true, units: true } }, token), env, 'BIZ_A'
  );
  const stored = state.store['businessSettings/BIZ_A'].capabilityOverrides;
  assert.equal(stored.orders, undefined, '`orders` moves only with the profile');
  assert.equal(stored.batches, undefined, 'and so does `batches`');
  assert.equal(stored.units, true, 'an owner-configurable one is fine');
});

test('the change is audited, with the profile it came from and the one it went to', async () => {
  reset();
  const token = asAdmin();
  await handleAdminIndustryUpdate(post({ industryProfile: 'PHARMACY', reason: 'wrong at signup' }, token), env, 'BIZ_A');
  const entry = Object.entries(state.store)
    .filter(([k]) => k.startsWith('adminAuditLogs/'))
    .map(([, v]) => v)
    .find((l) => l.action === 'UPDATE_INDUSTRY_PROFILE');
  assert.ok(entry, 'a privileged configuration change must be audited');
  assert.equal(entry.targetBusinessId, 'BIZ_A');
  assert.equal(entry.details.previousProfile, 'ELECTRONICS');
  assert.equal(entry.details.profile, 'PHARMACY');
  assert.equal(entry.details.reason, 'wrong at signup');
  assert.equal(entry.adminEmail, 'ops@flowbiz.co.ke');
});

test('a business with no settings document at all can still be corrected', async () => {
  reset();
  delete state.store['businessSettings/BIZ_A'];
  const token = asAdmin();
  const res = await handleAdminIndustryUpdate(post({ industryProfile: 'BAR' }, token), env, 'BIZ_A');
  assert.equal(res.status, 200);
  assert.equal(state.store['businessSettings/BIZ_A'].industryProfile, 'BAR');
  assert.equal(state.store['businessSettings/BIZ_A'].businessId, 'BIZ_A', 'and it is stamped so the rules recognise it');
});

test('correcting a business back again is a plain second change', async () => {
  reset();
  const token = asAdmin();
  await handleAdminIndustryUpdate(post({ industryProfile: 'PHARMACY' }, token), env, 'BIZ_A');
  await handleAdminIndustryUpdate(post({ industryProfile: 'ELECTRONICS' }, token), env, 'BIZ_A');
  assert.equal(state.store['businessSettings/BIZ_A'].industryProfile, 'ELECTRONICS');
  assert.deepEqual(state.store['businessSettings/BIZ_A'].customCategories, ['Solar Kits', 'Repairs Bench']);
  assert.equal(state.store['products/p1'].name, 'Phone Charger');
});
