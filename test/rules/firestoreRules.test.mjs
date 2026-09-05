// Security-rule tests, run against the real Firestore emulator.
//
//     npm run test:rules
//
// These are the tests that answer the only question that matters about a
// permission: is the write actually REFUSED, or is the button merely
// hidden? Everything here talks to the emulator over the Firestore REST
// API as a specific signed-in user, so what is being exercised is
// firestore.rules itself — not a JavaScript copy of it.
//
// They are deliberately NOT part of `npm test`: that runs anywhere,
// instantly, with no Java and no emulator. This suite needs both, so it
// gets its own script.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const PROJECT = process.env.GCLOUD_PROJECT || 'flowbiz-rules-test';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/**
 * An emulator ID token. The emulator does not verify the signature — it
 * reads the claims — which is exactly what makes it possible to test the
 * rules as any user without standing up an auth emulator too.
 */
function token(uid) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    user_id: uid, sub: uid, aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    iat: now, exp: now + 3600,
    email: `${uid}@example.test`, email_verified: true,
    firebase: { sign_in_provider: 'password', identities: {} },
  })}.`;
}

const toValue = (v) =>
  typeof v === 'string' ? { stringValue: v }
  : typeof v === 'boolean' ? { booleanValue: v }
  : typeof v === 'number' ? { integerValue: String(v) }
  : v === null || v === undefined ? { nullValue: null }
  : Array.isArray(v) ? { arrayValue: { values: v.map(toValue) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };

const fields = (data) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)]));

// A REST PATCH with no update mask REPLACES the document. Every write in
// this file is a merge — which is what the app does, and what `resource`
// vs `request.resource` in the rules is about — so the mask is always sent.
const mask = (data) => Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');

/** Writes as the emulator's owner credential, bypassing the rules. */
async function seed(path, data) {
  const res = await fetch(`${BASE}/${path}?${mask(data)}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fields(data) }),
  });
  if (!res.ok) throw new Error(`seed ${path} failed: ${res.status} ${await res.text()}`);
}

async function clearDatabase() {
  await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

/** A write attempted as `uid`. Returns true if the rules allowed it. */
async function write(uid, path, data) {
  const res = await fetch(`${BASE}/${path}?${mask(data)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token(uid)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fields(data) }),
  });
  return res.status === 200;
}

/** A read attempted as `uid`. */
async function read(uid, path) {
  const res = await fetch(`${BASE}/${path}`, { headers: { Authorization: `Bearer ${token(uid)}` } });
  return res.status === 200;
}

const B = 'BIZ_A';
const OTHER = 'BIZ_B';

/**
 * One business, one owner, one cashier — plus a second business that must
 * never be reachable from the first.
 */
async function setup(cashierPermissions) {
  await clearDatabase();
  await seed(`users/owner1`, { uid: 'owner1', businessId: B, role: 'owner', active: true });
  await seed(`users/cash1`, { uid: 'cash1', businessId: B, role: 'cashier', active: true });
  await seed(`users/cash2`, { uid: 'cash2', businessId: OTHER, role: 'cashier', active: true });
  await seed(`businessSettings/${B}`, {
    businessId: B,
    ...(cashierPermissions ? { cashierPermissions } : {}),
  });
  await seed(`businessSettings/${OTHER}`, { businessId: OTHER });
  await seed(`products/p1`, { businessId: B, name: 'Sukari', stock: 10 });
  await seed(`customers/c1`, { businessId: B, name: 'Mama Njeri' });
  await seed(`dailySessions/${B}_2026-09-04`, { businessId: B, date: '2026-09-04', closedAt: null });
}

// ── The defaults a business that has configured nothing runs on ───────

test('a cashier may do the counter job by default', async () => {
  await setup(null);
  assert.ok(await write('cash1', 'sales/s1', { businessId: B, total: 100 }), 'sell');
  assert.ok(await write('cash1', 'creditSales/cs1', { businessId: B, total: 100 }), 'sell on credit');
  assert.ok(await write('cash1', 'customers/c2', { businessId: B, name: 'New' }), 'add a customer');
  assert.ok(await write('cash1', 'repayments/rp1', { businessId: B, amount: 50 }), 'take a repayment');
  assert.ok(await write('cash1', 'expenses/e1', { businessId: B, amount: 50 }), 'record an expense');
  assert.ok(await write('cash1', 'orders/o1', { businessId: B, status: 'open' }), 'open an order');
  assert.ok(await write('cash1', `dailySessions/${B}_x`, { businessId: B, date: 'x' }), 'open the counter');
});

test('a cashier may NOT do the owner\'s job by default', async () => {
  await setup(null);
  assert.ok(!await write('cash1', 'refunds/r1', { businessId: B, amount: 100 }), 'refund');
  assert.ok(!await write('cash1', 'products/p2', { businessId: B, name: 'New' }), 'create a product');
  assert.ok(!await write('cash1', 'purchases/pu1', { businessId: B, total: 500 }), 'receive stock');
  assert.ok(!await write('cash1', 'stockAdjustments/sa1', { businessId: B, delta: 5 }), 'adjust stock');
  assert.ok(!await write('cash1', 'suppliers/su1', { businessId: B, name: 'S' }), 'add a supplier');
  assert.ok(!await write('cash1', 'productions/pr1', { businessId: B, qty: 5 }), 'record production');
  assert.ok(!await write('cash1', 'productBatches/b1', { businessId: B, batchNo: 'X' }), 'receive a batch');
});

test('a cashier may change a product\'s STOCK but nothing else about it', async () => {
  await setup(null);
  assert.ok(await write('cash1', 'products/p1', { stock: 9 }), 'a sale has to move the quantity');
  assert.ok(!await write('cash1', 'products/p1', { sellingPrice: 1 }), 'a price is not a quantity');
});

test('a cashier may not close the day by default, and may still work the session', async () => {
  await setup(null);
  assert.ok(await write('cash1', `dailySessions/${B}_2026-09-04`, { totalCashSales: 500 }), 'ordinary session updates');
  assert.ok(!await write('cash1', `dailySessions/${B}_2026-09-04`, { closedAt: '2026-09-04T18:00:00Z' }), 'closing');
});

// ── What an owner grants ─────────────────────────────────────────────

test('a granted permission actually opens the write', async () => {
  await setup({ 'sales.return': true, 'catalogue.manage': true, 'stock.receive': true, 'day.close': true });
  assert.ok(await write('cash1', 'refunds/r1', { businessId: B, amount: 100 }));
  assert.ok(await write('cash1', 'products/p2', { businessId: B, name: 'New' }));
  assert.ok(await write('cash1', 'products/p1', { sellingPrice: 250 }));
  assert.ok(await write('cash1', 'purchases/pu1', { businessId: B, total: 500 }));
  assert.ok(await write('cash1', `dailySessions/${B}_2026-09-04`, { closedAt: '2026-09-04T18:00:00Z' }));
});

test('a revoked permission actually closes a write that is on by default', async () => {
  await setup({ 'sales.record': false, 'expenses.record': false, 'customers.manage': false, 'orders.create': false });
  assert.ok(!await write('cash1', 'sales/s9', { businessId: B, total: 100 }));
  assert.ok(!await write('cash1', 'expenses/e9', { businessId: B, amount: 10 }));
  assert.ok(!await write('cash1', 'customers/c9', { businessId: B, name: 'X' }));
  assert.ok(!await write('cash1', 'orders/o9', { businessId: B, status: 'open' }));
});

test('the legacy cashierCanRecordExpenses flag is still honoured', async () => {
  await clearDatabase();
  await seed('users/cash1', { uid: 'cash1', businessId: B, role: 'cashier', active: true });
  await seed(`businessSettings/${B}`, { businessId: B, cashierCanRecordExpenses: false });
  assert.ok(!await write('cash1', 'expenses/e1', { businessId: B, amount: 10 }), 'the old switch still means no');

  await seed(`businessSettings/${B}`, { cashierPermissions: { 'expenses.record': true } });
  assert.ok(await write('cash1', 'expenses/e2', { businessId: B, amount: 10 }), 'a new permission overrules it');
});

test('a business with NO settings document at all runs on the defaults', async () => {
  await clearDatabase();
  await seed('users/cash1', { uid: 'cash1', businessId: B, role: 'cashier', active: true });
  assert.ok(await write('cash1', 'sales/s1', { businessId: B, total: 100 }), 'selling still works');
  assert.ok(!await write('cash1', 'refunds/r1', { businessId: B, amount: 100 }), 'refunding still does not');
});

// ── An owner is never locked out by a permission map ──────────────────

test('an owner holds everything, whatever the permission map says', async () => {
  await setup({
    'sales.record': false, 'expenses.record': false, 'customers.manage': false,
    'catalogue.manage': false, 'day.close': false, 'orders.create': false,
  });
  assert.ok(await write('owner1', 'sales/s1', { businessId: B, total: 100 }));
  assert.ok(await write('owner1', 'expenses/e1', { businessId: B, amount: 10 }));
  assert.ok(await write('owner1', 'products/p3', { businessId: B, name: 'N' }));
  assert.ok(await write('owner1', 'refunds/r1', { businessId: B, amount: 10 }));
  assert.ok(await write('owner1', `dailySessions/${B}_2026-09-04`, { closedAt: 'x' }));
});

// ── Nothing here may become a way to grant yourself something ─────────

test('a cashier may not write the permission map', async () => {
  await setup(null);
  assert.ok(!await write('cash1', `businessSettings/${B}`, { cashierPermissions: { 'sales.return': true } }));
  assert.ok(!await write('cash1', `businessSettings/${B}`, { cashierCanRecordExpenses: true }));
});

test('a cashier may not promote themselves', async () => {
  await setup(null);
  assert.ok(!await write('cash1', 'users/cash1', { role: 'owner' }));
  assert.ok(!await write('cash1', 'users/cash1', { businessId: OTHER }));
});

test('an owner may not store an invented permission key', async () => {
  await setup(null);
  assert.ok(!await write('owner1', `businessSettings/${B}`, { cashierPermissions: { 'business.delete': true } }));
  assert.ok(!await write('owner1', `businessSettings/${B}`, { cashierPermissions: { 'sales.record': 'yes' } }));
  assert.ok(await write('owner1', `businessSettings/${B}`, { cashierPermissions: { 'sales.return': true } }));
});

// ── Charging a ticket is not amending one ────────────────────────────

test('orders.close actually decides who may CHARGE a ticket', async () => {
  // It used to decide nothing. Closing a ticket writes `saleId` and
  // `closedAt` on the order plus a sales document, and both were already
  // covered by `orders.update` and `sales.record`, so an owner switching
  // "Charge a ticket" off changed nothing at all.
  await setup({ 'orders.close': false });
  await seed('orders/o1', { businessId: B, status: 'open' });
  await seed('orders/o2', { businessId: B, status: 'open' });

  assert.ok(await write('cash1', 'orders/o1', { updatedAt: 'x' }), 'amending an open ticket still works');
  assert.ok(
    await write('cash1', 'orders/o2', { status: 'cancelled', cancelledAt: 'x', cancelledBy: 'cash1' }),
    'and so does cancelling one: it takes no money'
  );
  assert.ok(
    !await write('cash1', 'orders/o1', { status: 'completed', closedAt: 'x', saleId: 's1' }),
    'but charging it is refused'
  );
});

test('with orders.close granted, charging a ticket goes through', async () => {
  await setup({ 'orders.close': true });
  await seed('orders/o1', { businessId: B, status: 'open' });
  assert.ok(await write('cash1', 'orders/o1', { status: 'completed', closedAt: 'x', saleId: 's1' }));
});

test('an owner charges a ticket whatever the permission map says', async () => {
  await setup({ 'orders.close': false });
  await seed('orders/o1', { businessId: B, status: 'open' });
  assert.ok(await write('owner1', 'orders/o1', { status: 'completed', closedAt: 'x', saleId: 's1' }));
});

// ── The expense category list is the owner's, like every other list ───

test('an owner may store the expense category diff; a cashier may not', async () => {
  await setup(null);
  assert.ok(await write('owner1', `businessSettings/${B}`, {
    customExpenseCategories: ['Water', 'Boda'],
    hiddenExpenseCategories: ['Security'],
    expenseCategoryOrder: ['Water', 'Rent'],
  }), 'the owner may save it');
  assert.ok(!await write('cash1', `businessSettings/${B}`, { customExpenseCategories: ['Mine'] }), 'a cashier may not');
  assert.ok(!await write('owner1', `businessSettings/${B}`, {
    customExpenseCategories: Array.from({ length: 61 }, (_, i) => `C${i}`),
  }), 'and it stays bounded');
});

// ── Business isolation is untouched by any of this ────────────────────

test('a permission is not a passport into another business', async () => {
  await setup({ 'catalogue.manage': true, 'sales.return': true, 'stock.receive': true });
  assert.ok(!await write('cash1', 'products/other1', { businessId: OTHER, name: 'X' }));
  assert.ok(!await write('cash1', 'refunds/other1', { businessId: OTHER, amount: 10 }));
  assert.ok(!await read('cash1', 'businessSettings/' + OTHER));
  assert.ok(!await write('cash2', 'sales/s-cross', { businessId: B, total: 10 }));
});

// ── A suspended workspace is enforced by the rules, not by a screen ───

test('a deactivated account can do nothing at all, permissions or not', async () => {
  await setup({ 'sales.record': true, 'expenses.record': true, 'catalogue.manage': true });
  await seed('users/cash1', { active: false, deactivatedByWorkspace: true, deactivationReason: 'workspace_suspended' });
  assert.ok(!await write('cash1', 'sales/s2', { businessId: B, total: 100 }));
  assert.ok(!await write('cash1', 'expenses/e2', { businessId: B, amount: 10 }));
  assert.ok(!await read('cash1', 'products/p1'));
});

test('a suspended account cannot switch ITSELF back on', async () => {
  // The hole this closes: `active` was not in the self-update branch's
  // exclusion list, so a workspace suspension (and an owner standing a
  // cashier down) could be undone by the account it was applied to,
  // straight from the browser, with one PATCH on its own user document.
  await setup(null);
  await seed('users/cash1', { active: false, deactivatedByWorkspace: true, deactivationReason: 'workspace_suspended' });

  assert.ok(!await write('cash1', 'users/cash1', { active: true }), 'no self-reactivation');
  assert.ok(!await write('cash1', 'users/cash1', { deactivatedByWorkspace: false }), 'and no clearing the stamp');
  assert.ok(!await write('cash1', 'users/cash1', { deactivationReason: null }), 'or the reason');
  assert.ok(!await write('cash1', 'sales/s-after', { businessId: B, total: 100 }), 'still blocked');

  // An owner standing someone down is the same answer.
  await seed('users/cash1', { active: false, deactivatedByWorkspace: false, deactivationReason: 'owner_deactivated' });
  assert.ok(!await write('cash1', 'users/cash1', { active: true }), 'not this way either');
});

test('an ACTIVE account still cannot flip its own switch, and can still fix its own details', async () => {
  await setup(null);
  assert.ok(!await write('cash1', 'users/cash1', { active: false }), 'active is never self-written');
  assert.ok(await write('cash1', 'users/cash1', { displayName: 'Njeri W.' }), 'ordinary details still work');
});

test('reactivating the account restores exactly what it had before', async () => {
  await setup(null);
  await seed('users/cash1', { active: false, deactivatedByWorkspace: true, deactivationReason: 'workspace_suspended' });
  assert.ok(!await write('cash1', 'sales/s2', { businessId: B, total: 100 }), 'blocked while suspended');
  await seed('users/cash1', { active: true, deactivatedByWorkspace: false, deactivationReason: null });
  assert.ok(await write('cash1', 'sales/s3', { businessId: B, total: 100 }), 'and working again after');
  assert.ok(!await write('cash1', 'refunds/r2', { businessId: B, amount: 10 }), 'with no more than before');
});

// ── The category model is bounded but never restricted by trade ───────

test('an owner may store the category diff; a cashier may not', async () => {
  await setup(null);
  assert.ok(await write('owner1', `businessSettings/${B}`, {
    customCategories: ['Solar Kits'], hiddenCategories: ['Other'], categoryOrder: ['Solar Kits'],
  }));
  assert.ok(!await write('cash1', `businessSettings/${B}`, { customCategories: ['Mine'] }));
  assert.ok(!await write('owner1', `businessSettings/${B}`, {
    customCategories: Array.from({ length: 61 }, (_, i) => `C${i}`),
  }), 'and it stays bounded');
});
