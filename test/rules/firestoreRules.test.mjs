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

// ── Ticket lines: four actions, four permissions ─────────────────────
//
// A line is its own document precisely so that a restaurant is safe on
// more than one device, and that means four DIFFERENT things can happen
// to it — amend, fire, void, move — each behind its own permission. The
// whole point of separating them is defeated if one rule waves all four
// through, so these tests exist to prove it does not.

async function seedLine(id = 'l1', extra = {}) {
  await seed(`orders/o1`, { businessId: B, status: 'open', lineModel: 'lines', totalAmount: 500 });
  await seed(`orderLines/${id}`, {
    businessId: B, orderId: 'o1', productId: 'p1', quantity: 1,
    lineTotal: 500, lineCost: 200, fulfillment: 'new', voided: false, open: true, seq: 1,
    ...extra,
  });
}

test('a cashier may ring items onto a ticket and amend them by default', async () => {
  await setup(null);
  await seedLine();
  assert.ok(await write('cash1', 'orderLines/l2', {
    businessId: B, orderId: 'o1', productId: 'p1', quantity: 2, lineTotal: 1000, open: true,
  }), 'add a line');
  assert.ok(await write('cash1', 'orderLines/l1', { quantity: 3, lineTotal: 1500 }), 'change a line');
});

test('THE KITCHEN CAN ONLY WORK THE KITCHEN', async () => {
  // A tablet on a kitchen wall is not a till. With `kitchen.update` and
  // nothing else, a line can be advanced and NOTHING about it that is
  // money can be touched.
  await setup({
    'orders.view': true, 'orders.update': false, 'orders.create': false,
    'kitchen.update': true, 'sales.record': false,
  });
  await seedLine();
  assert.ok(await write('cash1', 'orderLines/l1', { fulfillment: 'sent', firedAt: 'now' }), 'fire it');
  assert.ok(await write('cash1', 'orderLines/l1', { fulfillment: 'ready' }), 'call it ready');
  assert.ok(!await write('cash1', 'orderLines/l1', { lineTotal: 1 }), 'a price is not a kitchen stage');
  assert.ok(!await write('cash1', 'orderLines/l1', { quantity: 99 }), 'nor is a quantity');
  assert.ok(!await write('cash1', 'orderLines/l1', { voided: true }), 'nor is taking it off the bill');
  assert.ok(!await write('cash1', 'orderLines/l2', { businessId: B, orderId: 'o1' }), 'and it may not ring anything');
});

test('VOIDING IS NOT AMENDING, and orders.update does not grant it', async () => {
  // Ring it, serve it, void it, keep the cash is the oldest trick in
  // hospitality. `orders.update` is ON by default, so if it also let a
  // cashier void, the permission an owner most wants to withhold would
  // be one nobody ever had.
  await setup(null);
  await seedLine();
  assert.ok(!await write('cash1', 'orderLines/l1', {
    voided: true, voidedBy: 'cash1', voidReason: 'oops',
  }), 'voiding without the permission');

  await setup({ 'orders.void': true });
  await seedLine();
  assert.ok(await write('cash1', 'orderLines/l1', {
    voided: true, voidedBy: 'cash1', voidedByName: 'Cash', voidReason: 'oops',
  }), 'voiding with it');
});

test('a void may not smuggle a price change in with it', async () => {
  await setup({ 'orders.void': true, 'orders.update': false });
  await seedLine();
  assert.ok(!await write('cash1', 'orderLines/l1', { voided: true, lineTotal: 99999 }),
    'the void branch is hasOnly for a reason');
});

test('moving a line between bills is its own permission', async () => {
  await setup({ 'orders.move': false });
  await seedLine();
  assert.ok(!await write('cash1', 'orderLines/l1', { orderId: 'o2' }), 'without it');

  await setup(null);   // on by default: ordinary floor work
  await seedLine();
  assert.ok(await write('cash1', 'orderLines/l1', { orderId: 'o2' }), 'with it');
});

test('only an owner may DELETE a line — a void is the record, and it is kept', async () => {
  await setup({ 'orders.void': true });
  await seedLine();
  const del = async (uid) => (await fetch(`${BASE}/orderLines/l1`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token(uid)}` },
  })).status === 200;
  assert.ok(!await del('cash1'), 'a cashier may not erase what they voided');
  assert.ok(await del('owner1'));
});

test('A TICKET LINE IS NOT A PASSPORT INTO ANOTHER BUSINESS', async () => {
  await setup(null);
  await seedLine();
  assert.ok(!await read('cash2', 'orderLines/l1'), 'read across the boundary');
  assert.ok(!await write('cash2', 'orderLines/l1', { quantity: 99 }), 'write across it');
  assert.ok(!await write('cash1', 'orderLines/l9', { businessId: OTHER, orderId: 'x' }),
    'a line may not be created into somebody else\'s business');
  assert.ok(!await write('cash1', 'orderLines/l1', { businessId: OTHER }),
    'nor moved into one');
});

// ── Waste ────────────────────────────────────────────────────────────

test('recording waste is on by default, and is a record once written', async () => {
  await setup(null);
  assert.ok(await write('cash1', 'waste/w1', {
    businessId: B, productId: 'p1', quantity: 2, totalCost: 100, reason: 'spoilage',
  }), 'the person who drops the tray records it');
  assert.ok(!await write('cash1', 'waste/w1', { totalCost: 0 }), 'and cannot then rewrite it');
  assert.ok(await write('owner1', 'waste/w1', { totalCost: 90 }), 'the owner can correct it');
});

test('an owner can switch waste recording off', async () => {
  await setup({ 'stock.waste': false });
  assert.ok(!await write('cash1', 'waste/w1', { businessId: B, productId: 'p1', quantity: 2 }));
});

test('waste does not cross a business boundary either', async () => {
  await setup(null);
  await seed('waste/w1', { businessId: B, productId: 'p1', quantity: 1, totalCost: 50 });
  assert.ok(!await read('cash2', 'waste/w1'));
  assert.ok(!await write('cash2', 'waste/w1', { totalCost: 0 }));
  assert.ok(!await write('cash1', 'waste/w9', { businessId: OTHER, quantity: 1 }));
});

// ── The settings a kitchen and a check are configured with ───────────

test('only an owner configures sections, courses and the service charge', async () => {
  await setup(null);
  assert.ok(!await write('cash1', `businessSettings/${B}`, { serviceChargeRate: 0 }),
    'a cashier cannot zero the service charge');
  assert.ok(await write('owner1', `businessSettings/${B}`, { serviceChargeRate: 10 }));
  assert.ok(!await write('owner1', `businessSettings/${B}`, { serviceChargeRate: 500 }),
    'and it is bounded, because it multiplies into every bill');
  assert.ok(!await write('owner1', `businessSettings/${B}`, { serviceChargeRate: -5 }));
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

// ── JOINING A BUSINESS IS A TENANT BOUNDARY ──────────────────────────
//
// Creating your own /users profile is the act of joining a business. The
// rule once accepted `role: 'owner'` with ANY businessId, so a freshly
// signed-up account could point a profile at somebody else's business and
// inherit read, write and delete over that business's whole workspace.
// `businessId` is not a secret — staffInvites are world readable so the
// join link works before sign-in — so the id alone must never be enough.

const DOC_ROOT = `projects/${PROJECT}/databases/(default)/documents`;

/**
 * Several writes committed ATOMICALLY as `uid`, which is what sign-up
 * actually does. It matters here because the business does not exist yet
 * when the profile write is evaluated, so the rule has to reason about the
 * state the commit is proposing rather than the state on disk.
 */
async function commit(uid, writes) {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token(uid)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: writes.map(([path, data]) => ({
        update: { name: `${DOC_ROOT}/${path}`, fields: fields(data) },
        updateMask: { fieldPaths: Object.keys(data) },
      })),
    }),
  });
  return res.status === 200;
}

const freeSub = { plan: 'free', status: 'active', expiresAt: null };

test('SIGN-UP STILL WORKS: business, profile and settings in one commit', async () => {
  await clearDatabase();
  assert.ok(
    await commit('newowner', [
      [`businesses/NEWBIZ`, { name: 'New Shop', createdBy: 'newowner', ownerIds: ['newowner'], subscription: freeSub }],
      [`users/newowner`, { uid: 'newowner', businessId: 'NEWBIZ', role: 'owner', active: true }],
      [`businessSettings/NEWBIZ`, { businessId: 'NEWBIZ', shopName: 'New Shop' }],
    ]),
    'a genuine sign-up must still go through',
  );
});

test('AN OUTSIDER MAY NOT MAKE ITSELF THE OWNER OF AN EXISTING BUSINESS', async () => {
  await setup(null);
  assert.ok(
    !await write('attacker', `users/attacker`, { uid: 'attacker', businessId: B, role: 'owner', active: true }),
    'claiming ownership of a business you did not create must be refused',
  );
  // And the takeover must not be reachable a step at a time either.
  assert.ok(!await read('attacker', 'products/p1'), 'no read into the victim business');
  assert.ok(!await write('attacker', 'products/p1', { name: 'PWNED' }), 'no write into the victim business');
  assert.ok(!await read('attacker', `businessSettings/${B}`), 'no read of victim settings');
});

test('an owner profile may not be created for a business somebody else made', async () => {
  await clearDatabase();
  await seed(`businesses/VICTIM`, { name: 'Victim', createdBy: 'victim1', ownerIds: ['victim1'], subscription: freeSub });
  assert.ok(
    !await write('attacker', `users/attacker`, { uid: 'attacker', businessId: 'VICTIM', role: 'owner', active: true }),
    'createdBy is the proof, and it does not name the attacker',
  );
});

test('a business may not be created in somebody else\'s name', async () => {
  await clearDatabase();
  assert.ok(
    !await write('attacker', `businesses/FORGED`, { name: 'Forged', createdBy: 'victim1', ownerIds: ['victim1'], subscription: freeSub }),
    'createdBy must be the caller, or the profile rule above is built on sand',
  );
});

test('a cashier still joins on a valid invite, and only on a valid invite', async () => {
  await clearDatabase();
  await seed(`businesses/${B}`, { name: 'Shop', createdBy: 'owner1', ownerIds: ['owner1'], subscription: freeSub });
  await seed(`staffInvites/inv1`, { businessId: B, role: 'cashier', claimed: false });
  assert.ok(
    await write('joiner', `users/joiner`, {
      uid: 'joiner', businessId: B, role: 'cashier', active: true, claimedFromInviteId: 'inv1',
    }),
    'a real invite still lets a cashier join',
  );
  assert.ok(
    !await write('joiner2', `users/joiner2`, {
      uid: 'joiner2', businessId: B, role: 'cashier', active: true, claimedFromInviteId: 'nope',
    }),
    'an invite id that does not exist is not a way in',
  );
});

// ═══════════════════════════════════════════════════════════════════════
// LICENSING AND CLOUD SERVICE ENTITLEMENT
// ═══════════════════════════════════════════════════════════════════════
//
// The client half of this lives in src/licensing/. What is tested here is
// the ONLY half that actually stops anything: a browser cannot grant
// itself a licence, cannot move its own expiry date, and cannot spend
// cloud storage after its service period and grace window have closed.
//
// The other half of the design matters just as much and is asserted just
// as hard: an expired or suspended business must keep every record it
// has, keep reading them, and keep recording sales. Withholding a hosted
// convenience is a legitimate way to collect a service fee. Losing a
// shop's takings is not.

const DAY_MS = 86400000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY_MS).toISOString();

/**
 * Every business carrying a `licensing.cloudEntitledUntil` is by
 * definition a perpetual-licence holder — that field is written by the
 * Worker when it sells one — so the fixture says so. The subscription is
 * a parameter because the LICENSED half of the rules reads it, and the
 * two halves are tested separately: `subscription` decides whether the
 * business may have product photos at all, `licensing` decides whether
 * its hosted services are still running.
 */
const lifetimeSub = { plan: 'lifetime', status: 'active', expiresAt: null };
const proSub = { plan: 'pro', status: 'active', expiresAt: null };

/** A timestamp value, which `toValue` above would otherwise send as a string. */
async function seedBusinessLicensing(licensing, subscription = lifetimeSub) {
  const data = { name: 'Shop', createdBy: 'owner1', ownerIds: ['owner1'], subscription };
  await seed(`businesses/${B}`, data);
  if (licensing === null) return;

  // Written through the REST API directly so `cloudEntitledUntil` lands
  // as a real timestamp, which is what `request.time <` compares against.
  const fieldsMap = { fields: {} };
  if ('cloudSuspended' in licensing) fieldsMap.fields.cloudSuspended = { booleanValue: licensing.cloudSuspended };
  if ('cloudEntitledUntil' in licensing) {
    fieldsMap.fields.cloudEntitledUntil = licensing.cloudEntitledUntil === null
      ? { nullValue: null }
      : { timestampValue: licensing.cloudEntitledUntil };
  }
  const res = await fetch(`${BASE}/businesses/${B}?updateMask.fieldPaths=licensing`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { licensing: { mapValue: fieldsMap } } }),
  });
  if (!res.ok) throw new Error(`seed licensing failed: ${res.status} ${await res.text()}`);
}

/** The full tenant fixture plus a business document carrying `licensing`. */
async function setupLicensed(licensing, subscription = lifetimeSub) {
  await setup(null);
  await seedBusinessLicensing(licensing, subscription);
  await seed('productImages/img_existing', { businessId: B, productId: 'p1', dataUrl: 'data:image/webp;base64,AAAA' });
  await seed('sharedDocuments/tok_existing', { businessId: B, documentType: 'receipt', documentId: 's1' });
  await seed('payments/pay_1', { businessId: B, plan: 'lifetime', amountKes: 1, status: 'success' });
  await seed('payments/pay_other', { businessId: OTHER, plan: 'pro', amountKes: 1, status: 'success' });
}

const ENTITLED = { cloudSuspended: false, cloudEntitledUntil: iso(200) };
const LAPSED = { cloudSuspended: false, cloudEntitledUntil: iso(-1) };
const SUSPENDED = { cloudSuspended: true, cloudEntitledUntil: iso(200) };

// ── A client may not write its own entitlements ───────────────────────

test('AN OWNER MAY NOT GRANT ITSELF A LICENCE', async () => {
  await setupLicensed(ENTITLED);
  assert.ok(
    !await write('owner1', `businesses/${B}`, {
      licensing: { licenseType: 'lifetime', licenseStatus: 'active', cloudSuspended: false },
    }),
    'a browser writing `licensing` would be a browser writing its own bill',
  );
});

test('an owner may not move its own service expiry, or lift its own suspension', async () => {
  await setupLicensed(SUSPENDED);
  assert.ok(
    !await write('owner1', `businesses/${B}`, { licensing: { cloudEntitledUntil: iso(3650) } }),
    'ten free years must not be one PATCH away',
  );
  assert.ok(
    !await write('owner1', `businesses/${B}`, { licensing: { cloudSuspended: false } }),
    'a suspension an administrator applied must not be self-serve reversible',
  );
});

test('an owner may not change the subscription plan either', async () => {
  // Seeded FREE on purpose, so writing a lifetime plan is a genuine
  // escalation rather than a no-op that `diff()` would see no keys in.
  await setupLicensed(ENTITLED, freeSub);
  assert.ok(
    !await write('owner1', `businesses/${B}`, { subscription: { plan: 'lifetime', status: 'active', expiresAt: null } }),
    'the monthly plan record stays server-written too',
  );
  assert.ok(
    !await write('owner1', `businesses/${B}`, { subscription: { plan: 'pro', status: 'active', expiresAt: null } }),
    'nor may it grant itself the Pro feature set, product photos included',
  );
});

test('an owner may still edit the parts of the business document that are theirs', async () => {
  await setupLicensed(ENTITLED);
  assert.ok(
    await write('owner1', `businesses/${B}`, { name: 'Duka Bora Ltd' }),
    'blocking the billing fields must not freeze the whole document',
  );
});

test('a cashier may not touch the business document at all', async () => {
  await setupLicensed(ENTITLED);
  assert.ok(!await write('cash1', `businesses/${B}`, { name: 'Nope' }));
  assert.ok(!await write('cash1', `businesses/${B}`, { licensing: { cloudSuspended: false } }));
});

// ── Cloud storage follows the entitlement ─────────────────────────────

test('an entitled business may store a product photo', async () => {
  await setupLicensed(ENTITLED);
  assert.ok(
    await write('owner1', 'productImages/img_new', {
      businessId: B, productId: 'p2', dataUrl: 'data:image/webp;base64,BBBB',
    }),
    'this is the ordinary case and must keep working',
  );
});

test('a business with NO licensing record at all is entitled, exactly as before', async () => {
  // Every monthly Pro account, and every licensed business created before
  // the annual service model existed. Nothing has a service period to be
  // past, so nothing about hosted services can refuse the write.
  await setupLicensed(null, proSub);
  assert.ok(
    await write('owner1', 'productImages/img_new', {
      businessId: B, productId: 'p2', dataUrl: 'data:image/webp;base64,BBBB',
    }),
    'the absence of a service period is not the expiry of one',
  );
});

test('CLOUD STORAGE STOPS WHEN THE SERVICE PERIOD AND GRACE WINDOW HAVE CLOSED', async () => {
  await setupLicensed(LAPSED);
  assert.ok(
    !await write('owner1', 'productImages/img_new', {
      businessId: B, productId: 'p2', dataUrl: 'data:image/webp;base64,BBBB',
    }),
    'a new photo consumes hosted storage and needs an active entitlement',
  );
  assert.ok(
    !await write('owner1', 'productImages/img_existing', { dataUrl: 'data:image/webp;base64,CCCC' }),
    'and so does replacing one',
  );
});

test('an administrative suspension stops cloud storage too', async () => {
  await setupLicensed(SUSPENDED);
  assert.ok(
    !await write('owner1', 'productImages/img_new', {
      businessId: B, productId: 'p2', dataUrl: 'data:image/webp;base64,BBBB',
    }),
  );
});

test('EXISTING PRODUCT PHOTOS ARE STILL READABLE WHEN SERVICES LAPSE', async () => {
  await setupLicensed(LAPSED);
  assert.ok(await read('owner1', 'productImages/img_existing'), 'the owner keeps their own photos');
  assert.ok(await read('cash1', 'productImages/img_existing'), 'and so does the till');
});

test('a lapsed business may still DELETE its own photos', async () => {
  await setupLicensed(LAPSED);
  const res = await fetch(`${BASE}/productImages/img_existing`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token('owner1')}` },
  });
  assert.equal(res.status, 200, 'tidying your own catalogue is not a hosted service');
});

// ── Product photos follow the LICENCE, not the service period ─────────
//
// A DIFFERENT QUESTION FROM THE ONE ABOVE, and the tests are separate
// because the answers are. Cloud storage is a hosted service that lapses;
// product photos are a Pro feature that is bought. A Starter shop with
// perfectly healthy cloud services still may not have one, and a lifetime
// customer whose services lapsed has not lost the entitlement — only the
// storage to exercise it with.
//
// This is the layer that actually stops a Starter business. The product
// form declines politely; devtools, a hand-built SDK call and an offline
// write that syncs an hour later all arrive here.

/** A subscription whose `expiresAt` lands as a real timestamp. */
async function seedSubscription(plan, status, expiresAtIso) {
  const fieldsMap = {
    fields: {
      plan: { stringValue: plan },
      status: { stringValue: status },
      expiresAt: expiresAtIso === null ? { nullValue: null } : { timestampValue: expiresAtIso },
    },
  };
  const res = await fetch(`${BASE}/businesses/${B}?updateMask.fieldPaths=subscription`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { subscription: { mapValue: fieldsMap } } }),
  });
  if (!res.ok) throw new Error(`seed subscription failed: ${res.status} ${await res.text()}`);
}

const newPhoto = { businessId: B, productId: 'p2', dataUrl: 'data:image/webp;base64,BBBB' };

test('A STARTER BUSINESS MAY NOT STORE A PRODUCT PHOTO', async () => {
  // Cloud services entirely healthy. The refusal is the licence, and
  // nothing else.
  await setupLicensed(ENTITLED, freeSub);
  assert.ok(
    !await write('owner1', 'productImages/img_new', newPhoto),
    'product photos are a Pro feature, and this is the only line that means it',
  );
  assert.ok(
    !await write('owner1', 'productImages/img_existing', { dataUrl: 'data:image/webp;base64,CCCC' }),
    'nor may it overwrite one that is already there',
  );
});

test('a monthly Pro subscriber may store a product photo', async () => {
  await setupLicensed(ENTITLED, proSub);
  assert.ok(await write('owner1', 'productImages/img_new', newPhoto));
});

test('A LIFETIME LICENCE CARRIES THE PHOTO ENTITLEMENT', async () => {
  // Both records a licence can be written in: the modern `licensing` map
  // and the `subscription.plan` every licence sold before it used.
  await setupLicensed(ENTITLED, lifetimeSub);
  assert.ok(await write('owner1', 'productImages/img_new', newPhoto),
    'a legacy lifetime record is still a licence');

  await setupLicensed(ENTITLED, freeSub);
  await seed(`businesses/${B}`, { licensing: { licenseType: 'lifetime', licenseStatus: 'active' } });
  assert.ok(await write('owner1', 'productImages/img_new', newPhoto),
    'and so is the modern one, with no subscription record at all');
});

test('a lapsed ANNUAL SERVICE PERIOD is not a lost photo entitlement', async () => {
  // The storage write is refused — hosted storage costs money and the
  // service period paid for it — but the refusal is cloudServicesActive(),
  // not the licence. The licence is intact, which is what lets the photo
  // the business already owns keep rendering and lets a renewal restore
  // uploads without re-buying anything.
  await setupLicensed(LAPSED, lifetimeSub);
  assert.ok(!await write('owner1', 'productImages/img_new', newPhoto));
  assert.ok(await read('owner1', 'productImages/img_existing'),
    'and every photo it already has stays readable');
});

test('an EXPIRED monthly Pro subscription no longer carries the entitlement', async () => {
  await setupLicensed(ENTITLED, freeSub);
  await seedSubscription('pro', 'active', iso(-1));
  assert.ok(!await write('owner1', 'productImages/img_new', newPhoto),
    'a prepaid month that ran out is a Starter business again');

  await seedSubscription('pro', 'active', iso(10));
  assert.ok(await write('owner1', 'productImages/img_new', newPhoto),
    'and a month still running is not');
});

test('a REVOKED licence carries no photo entitlement either', async () => {
  await setupLicensed(ENTITLED, lifetimeSub);
  await seed(`businesses/${B}`, {
    licensing: { licenseType: 'lifetime', licenseStatus: 'revoked' },
  });
  assert.ok(!await write('owner1', 'productImages/img_new', newPhoto));
});

// ── The product document's photo pointer is gated too ─────────────────
//
// Storing the image is only half of it. The product carries `hasImage` /
// `imageUpdatedAt` (the sidecar pointer) or `imageUrl` (a plain URL), and
// without this the counter would happily render a picture a Starter
// business pointed at without ever writing one.

test('A STARTER BUSINESS MAY NOT POINT A PRODUCT AT A PHOTO', async () => {
  await setupLicensed(ENTITLED, freeSub);
  assert.ok(
    !await write('owner1', 'products/p1', { hasImage: true, imageUpdatedAt: 1 }),
    'the sidecar pointer is a photo claim',
  );
  assert.ok(
    !await write('owner1', 'products/p1', { imageUrl: 'https://example.test/some.webp' }),
    'and so is reusing a URL it did not have to upload',
  );
  assert.ok(
    !await write('owner1', 'products/p_new', {
      businessId: B, name: 'New', stock: 1, hasImage: true,
    }),
    'including on a brand-new product',
  );
});

test('a Pro business may point a product at a photo', async () => {
  await setupLicensed(ENTITLED, proSub);
  assert.ok(await write('owner1', 'products/p1', { hasImage: true, imageUpdatedAt: 1 }));
  assert.ok(await write('owner1', 'products/p_new', {
    businessId: B, name: 'New', stock: 1, hasImage: true,
  }));
});

test('A BUSINESS THAT LOSES THE ENTITLEMENT KEEPS ITS PRODUCTS EDITABLE', async () => {
  // The whole point of the gate being on the CLAIM and not on the field:
  // a shop whose Pro month lapsed must still be able to run its catalogue,
  // and must still be able to remove a photo it no longer wants. Nothing
  // in these rules deletes or rewrites an image it already stored.
  await setupLicensed(ENTITLED, proSub);
  await seed('products/p_photo', {
    businessId: B, name: 'Soda', stock: 4, hasImage: true, imageUpdatedAt: 1,
  });
  await seedSubscription('free', 'active', null);

  assert.ok(
    await write('owner1', 'products/p_photo', { name: 'Soda 500ml', sellingPrice: 60 }),
    'renaming and repricing a product that has a photo must still go through',
  );
  assert.ok(
    await write('owner1', 'products/p_photo', { stock: 9 }),
    'and so must a sale decrementing its stock',
  );
  assert.ok(
    await write('owner1', 'products/p_photo', { hasImage: false, imageUpdatedAt: null, imageUrl: null }),
    'clearing a photo is tidying your own catalogue, not consuming a feature',
  );
});

test('a Starter business may still read the photos it already owns', async () => {
  await setupLicensed(ENTITLED, freeSub);
  assert.ok(await read('owner1', 'productImages/img_existing'), 'nothing is taken away');
  assert.ok(await read('cash1', 'productImages/img_existing'), 'and the till still shows them');
});

// ── Document publishing follows the entitlement ───────────────────────

test('publishing a new public document link stops when services lapse', async () => {
  await setupLicensed(LAPSED);
  assert.ok(
    !await write('owner1', 'sharedDocuments/tok_new', {
      businessId: B, documentType: 'receipt', documentId: 's2',
    }),
    'a public link is served by FlowBiz, so it is a hosted service',
  );
});

test('links already issued keep working, and stay readable', async () => {
  await setupLicensed(LAPSED);
  assert.ok(await read('owner1', 'sharedDocuments/tok_existing'));
});

test('an entitled business may still publish', async () => {
  await setupLicensed(ENTITLED);
  assert.ok(
    await write('owner1', 'sharedDocuments/tok_new', {
      businessId: B, documentType: 'receipt', documentId: 's2',
    }),
  );
});

// ── THE PROMISE: business records are never withheld ──────────────────

test('A LAPSED BUSINESS CAN STILL RECORD SALES, STOCK, CUSTOMERS AND EXPENSES', async () => {
  // This is the single most important assertion in this file. FlowBiz
  // records a sale into a local cache that syncs later; a rule that
  // refused these writes would mean a rejected mutation, a reverted local
  // write, and a shop's takings gone. A service fee is never collected by
  // destroying a customer's records.
  await setupLicensed(LAPSED);

  assert.ok(await write('cash1', 'sales/s_new', { businessId: B, totalAmount: 250, productName: 'Sukari' }),
    'the till must never stop');
  assert.ok(await write('owner1', 'products/p_new', { businessId: B, name: 'Unga', stock: 4 }),
    'stock must never stop');
  assert.ok(await write('owner1', 'customers/c_new', { businessId: B, name: 'Baba Otieno' }),
    'customers must never stop');
  assert.ok(await write('owner1', 'expenses/e_new', { businessId: B, amount: 100, category: 'Transport' }),
    'expenses must never stop');
  assert.ok(await write('owner1', 'creditSales/cs_new', { businessId: B, totalAmount: 300, customerId: 'c1' }),
    'credit must never stop');
});

test('a SUSPENDED business can still record sales', async () => {
  await setupLicensed(SUSPENDED);
  assert.ok(await write('cash1', 'sales/s_new', { businessId: B, totalAmount: 250, productName: 'Sukari' }));
  assert.ok(await read('owner1', 'products/p1'), 'and still read everything it owns');
});

test('nothing about an expiry deletes a record', async () => {
  await setupLicensed(LAPSED);
  // The rules cannot delete anything on their own; what this asserts is
  // that the records seeded before the expiry are all still readable.
  for (const path of ['products/p1', 'customers/c1', 'productImages/img_existing', 'sharedDocuments/tok_existing']) {
    assert.ok(await read('owner1', path), `${path} must survive an expired service period`);
  }
});

// ── Billing history ───────────────────────────────────────────────────

test('an owner may read their own payment history, and nobody else\'s', async () => {
  await setupLicensed(ENTITLED);
  assert.ok(await read('owner1', 'payments/pay_1'), 'a merchant may see what they paid for');
  assert.ok(!await read('owner1', 'payments/pay_other'), 'and only what they paid for');
});

test('a cashier may not read the shop\'s billing', async () => {
  await setupLicensed(ENTITLED);
  assert.ok(!await read('cash1', 'payments/pay_1'));
});

test('NOBODY MAY WRITE A PAYMENT RECORD FROM A BROWSER', async () => {
  await setupLicensed(ENTITLED);
  assert.ok(
    !await write('owner1', 'payments/pay_forged', {
      businessId: B, plan: 'annual_services', amountKes: 3000, status: 'success',
    }),
    'a merchant who could write here could mint themselves a renewal',
  );
  assert.ok(
    !await write('owner1', 'payments/pay_1', { status: 'success' }),
    'nor edit one that exists',
  );
  assert.ok(!await write('cash1', 'payments/pay_forged', { businessId: B, status: 'success' }));
});
