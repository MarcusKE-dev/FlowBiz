// The licence and annual services lifecycle, against the real handlers.
//
// Everything here goes through handlePaystackWebhook and the admin
// licensing route with a Firestore stub that APPLIES its writes, so each
// test asserts the STATE a confirmed payment or an administrative action
// actually leaves behind — not which HTTP calls were made.
//
// The rules these protect are the ones a customer would take FlowBiz to
// court over: a licence that quietly expired, a renewal that was charged
// twice, or a shop's software switched off because a service fee lapsed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { installStub, env as baseEnv, mintIdToken, adminRequest } from './helpers/adminHarness.js';
import { handlePaystackWebhook } from '../src/routes/paystackWebhook.js';
import { handleAdminLicensingRead, handleAdminLicensingAction } from '../src/routes/admin/adminLicensing.js';
import {
  resolveEntitlements,
  LIFETIME_LICENSE_PRICE_KES,
  ANNUAL_SERVICE_PRICE_KES,
  GRACE_PERIOD_DAYS,
} from '../src/lib/licensing.js';

const SECRET = 'sk_test_secret';
const env = { ...baseEnv, PAYSTACK_SECRET_KEY: SECRET };
const DAY = 86400000;

function webhookRequest(payload, { signature } = {}) {
  const raw = JSON.stringify(payload);
  const sig = signature ?? createHmac('sha512', SECRET).update(raw).digest('hex');
  return new Request('https://api.test/api/paystack/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sig },
    body: raw,
  });
}

/** Installs the store stub and layers Paystack's verify endpoint on top. */
function setup({ verifyAmountKes = LIFETIME_LICENSE_PRICE_KES, verifyStatus = 'success', currency = 'KES' } = {}) {
  const state = installStub();
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.paystack.co/transaction/verify/')) {
      return new Response(JSON.stringify({
        status: true,
        data: { id: 4242, status: verifyStatus, amount: verifyAmountKes * 100, currency },
      }), { status: 200 });
    }
    return inner(url, init);
  };
  return state;
}

const chargeSuccess = (reference) => ({ event: 'charge.success', data: { reference } });

/** A pending payment as /api/paystack/initialize would have recorded it. */
function pendingPayment(state, reference, { plan, amountKes, businessId = 'BIZ' }) {
  state.store[`payments/${reference}`] = {
    businessId, plan, amountKes, status: 'pending', createdAt: new Date(),
  };
}

function licensingOf(state, businessId = 'BIZ') {
  return state.store[`businesses/${businessId}`].licensing;
}

// ── 1-3. The purchase ─────────────────────────────────────────────────

test('a confirmed Lifetime payment creates a PERPETUAL licence with no expiry', async () => {
  const state = setup();
  state.store['businesses/BIZ'] = { name: 'Duka', subscription: { plan: 'free', status: 'active' } };
  pendingPayment(state, 'ref-lt', { plan: 'lifetime', amountKes: LIFETIME_LICENSE_PRICE_KES });

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-lt')), env);
  assert.equal(res.status, 200);

  const lic = licensingOf(state);
  assert.equal(lic.licenseType, 'lifetime');
  assert.equal(lic.licenseStatus, 'active');
  assert.equal(lic.licenseRevokedAt, null);
  // There is no licence expiry field at all, and there must never be one.
  assert.ok(!('licenseExpiresAt' in lic), 'a perpetual licence must have no expiry field');
  assert.ok(!('licenseExpiryDate' in lic));

  // And the legacy subscription mirror still says what every existing
  // reader expects.
  assert.equal(state.store['businesses/BIZ'].subscription.plan, 'lifetime');
  assert.equal(state.store['businesses/BIZ'].subscription.expiresAt, null);
});

test('the purchase starts the first 12-month annual services period', async () => {
  const state = setup();
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active' } };
  pendingPayment(state, 'ref-lt2', { plan: 'lifetime', amountKes: LIFETIME_LICENSE_PRICE_KES });

  await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-lt2')), env);

  const lic = licensingOf(state);
  const start = new Date(lic.serviceStartDate);
  const expiry = new Date(lic.serviceExpiryDate);
  const months = (expiry.getFullYear() - start.getFullYear()) * 12 + (expiry.getMonth() - start.getMonth());
  assert.equal(months, 12, 'exactly twelve calendar months of service');
  assert.equal(lic.graceDays, GRACE_PERIOD_DAYS);
  assert.equal(lic.renewalCount, 0);
  // The single field firestore.rules reads.
  const graceEnd = new Date(lic.cloudEntitledUntil);
  assert.equal(Math.round((graceEnd - expiry) / DAY), GRACE_PERIOD_DAYS);
});

test('the purchase is recorded with an auditable payment reference', async () => {
  const state = setup();
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active' } };
  pendingPayment(state, 'ref-audit', { plan: 'lifetime', amountKes: LIFETIME_LICENSE_PRICE_KES });

  await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-audit')), env);

  const payment = state.store['payments/ref-audit'];
  assert.equal(payment.status, 'success');
  assert.equal(payment.applied, true);
  assert.equal(payment.paystackTransactionId, '4242');
  assert.ok(payment.confirmedAt);
  assert.equal(licensingOf(state).licensePurchaseReference, 'ref-audit');

  // And the money trail exists as an operational event.
  const events = Object.entries(state.store).filter(([k]) => k.startsWith('opsEvents/'));
  const types = events.map(([, v]) => v.type);
  assert.ok(types.includes('licensing.license_activated'), 'the activation must be recorded');
  assert.ok(types.includes('licensing.service_started'), 'the service period must be recorded');
});

// ── 6-8. Renewal ──────────────────────────────────────────────────────

/** A business one month into a licence bought a year ago. */
function licensedBusiness(state, { expiryOffsetDays = 30, businessId = 'BIZ', extra = {} } = {}) {
  const expiry = new Date(Date.now() + expiryOffsetDays * DAY);
  state.store[`businesses/${businessId}`] = {
    subscription: { plan: 'lifetime', status: 'active', expiresAt: null },
    licensing: {
      licenseType: 'lifetime',
      licenseStatus: 'active',
      licensePurchasedAt: new Date(expiry.getTime() - 365 * DAY),
      serviceStartDate: new Date(expiry.getTime() - 365 * DAY),
      serviceExpiryDate: expiry,
      graceDays: GRACE_PERIOD_DAYS,
      renewalCount: 0,
      cloudSuspended: false,
      ...extra,
    },
  };
  return expiry;
}

test('AN EARLY RENEWAL EXTENDS THE EXISTING EXPIRY, IT DOES NOT RESTART FROM TODAY', async () => {
  const state = setup({ verifyAmountKes: ANNUAL_SERVICE_PRICE_KES });
  // 30 days still to run. Renewing today must give 12 months ON TOP of
  // those 30 days, not 12 months from today.
  const expiry = licensedBusiness(state, { expiryOffsetDays: 30 });
  pendingPayment(state, 'ref-early', { plan: 'annual_services', amountKes: ANNUAL_SERVICE_PRICE_KES });

  await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-early')), env);

  const after = new Date(licensingOf(state).serviceExpiryDate);
  const expected = new Date(expiry);
  expected.setUTCFullYear(expected.getUTCFullYear() + 1);
  assert.equal(after.toISOString(), expected.toISOString(),
    'the customer keeps the 30 days they already paid for');
  assert.ok(after.getTime() - Date.now() > 390 * DAY, 'more than a plain year from today');
  assert.equal(licensingOf(state).renewalCount, 1);
});

test('a renewal after the period has lapsed runs from the payment date', async () => {
  const state = setup({ verifyAmountKes: ANNUAL_SERVICE_PRICE_KES });
  licensedBusiness(state, { expiryOffsetDays: -100 });
  pendingPayment(state, 'ref-late', { plan: 'annual_services', amountKes: ANNUAL_SERVICE_PRICE_KES });

  await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-late')), env);

  const after = new Date(licensingOf(state).serviceExpiryDate);
  const daysAhead = (after.getTime() - Date.now()) / DAY;
  assert.ok(daysAhead > 360 && daysAhead < 370, `expected ~12 months from today, got ${daysAhead} days`);
});

test('A REDELIVERED WEBHOOK DOES NOT RENEW TWICE', async () => {
  const state = setup({ verifyAmountKes: ANNUAL_SERVICE_PRICE_KES });
  licensedBusiness(state, { expiryOffsetDays: 30 });
  pendingPayment(state, 'ref-dup', { plan: 'annual_services', amountKes: ANNUAL_SERVICE_PRICE_KES });

  await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-dup')), env);
  const afterFirst = licensingOf(state).serviceExpiryDate;
  const countAfterFirst = licensingOf(state).renewalCount;

  // Paystack redelivers. Three times.
  for (let i = 0; i < 3; i++) {
    const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-dup')), env);
    assert.equal(res.status, 200, 'a redelivery is acknowledged, not errored');
  }

  assert.equal(
    new Date(licensingOf(state).serviceExpiryDate).getTime(), new Date(afterFirst).getTime(),
    'the expiry must not move on a redelivery',
  );
  assert.equal(licensingOf(state).renewalCount, countAfterFirst);
  assert.equal(countAfterFirst, 1);
});

test('TWO SEPARATE renewals extend twice, because they are two real payments', async () => {
  const state = setup({ verifyAmountKes: ANNUAL_SERVICE_PRICE_KES });
  const expiry = licensedBusiness(state, { expiryOffsetDays: 30 });
  pendingPayment(state, 'ref-r1', { plan: 'annual_services', amountKes: ANNUAL_SERVICE_PRICE_KES });
  pendingPayment(state, 'ref-r2', { plan: 'annual_services', amountKes: ANNUAL_SERVICE_PRICE_KES });

  await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-r1')), env);
  await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-r2')), env);

  const after = new Date(licensingOf(state).serviceExpiryDate);
  const expected = new Date(expiry);
  expected.setUTCFullYear(expected.getUTCFullYear() + 2);
  assert.equal(after.toISOString(), expected.toISOString());
  assert.equal(licensingOf(state).renewalCount, 2);
});

test('a renewal never touches the licence itself', async () => {
  const state = setup({ verifyAmountKes: ANNUAL_SERVICE_PRICE_KES });
  licensedBusiness(state, { expiryOffsetDays: 5 });
  const purchasedAt = licensingOf(state).licensePurchasedAt;
  pendingPayment(state, 'ref-nl', { plan: 'annual_services', amountKes: ANNUAL_SERVICE_PRICE_KES });

  await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-nl')), env);

  const lic = licensingOf(state);
  assert.equal(lic.licenseType, 'lifetime');
  assert.equal(lic.licenseStatus, 'active');
  assert.equal(new Date(lic.licensePurchasedAt).getTime(), new Date(purchasedAt).getTime());
});

test('an annual services payment for a business with no licence grants nothing', async () => {
  const state = setup({ verifyAmountKes: ANNUAL_SERVICE_PRICE_KES });
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active' } };
  pendingPayment(state, 'ref-orphan', { plan: 'annual_services', amountKes: ANNUAL_SERVICE_PRICE_KES });

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-orphan')), env);

  assert.equal(res.status, 200, 'the money is real, so the event is acknowledged');
  assert.equal(state.store['payments/ref-orphan'].status, 'success');
  assert.equal(state.store['payments/ref-orphan'].applied, false);
  assert.equal(state.store['payments/ref-orphan'].unappliedReason, 'no_lifetime_license');
  assert.equal(state.store['businesses/BIZ'].licensing, undefined, 'no entitlement is invented');
});

test('a wrong amount grants no licence and no service period', async () => {
  // Paid KES 1 for a checkout initialised at the licence price.
  const state = setup({ verifyAmountKes: 1 });
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active' } };
  pendingPayment(state, 'ref-cheap', { plan: 'lifetime', amountKes: LIFETIME_LICENSE_PRICE_KES });

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-cheap')), env);

  assert.equal(res.status, 400);
  assert.equal(state.store['businesses/BIZ'].licensing, undefined);
  assert.equal(state.store['payments/ref-cheap'].status, 'pending');
});

test('an unsigned webhook grants nothing', async () => {
  const state = setup();
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active' } };
  pendingPayment(state, 'ref-forged', { plan: 'lifetime', amountKes: LIFETIME_LICENSE_PRICE_KES });

  const res = await handlePaystackWebhook(
    webhookRequest(chargeSuccess('ref-forged'), { signature: 'deadbeef' }), env,
  );

  assert.equal(res.status, 401);
  assert.equal(state.store['businesses/BIZ'].licensing, undefined);
});

// ── 16. Existing customers ────────────────────────────────────────────

test('AN EXISTING PRO SUBSCRIBER RENEWS EXACTLY AS BEFORE, WITH NO LICENSING RECORD', async () => {
  const state = setup({ verifyAmountKes: 599 });
  state.store['businesses/BIZ'] = { subscription: { plan: 'pro', status: 'active', expiresAt: null } };
  pendingPayment(state, 'ref-pro', { plan: 'pro', amountKes: 599 });

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-pro')), env);

  assert.equal(res.status, 200);
  const sub = state.store['businesses/BIZ'].subscription;
  assert.equal(sub.plan, 'pro');
  const days = (new Date(sub.expiresAt) - Date.now()) / DAY;
  assert.ok(days > 29.9 && days < 30.1, `expected ~30 days, got ${days}`);
  assert.equal(state.store['businesses/BIZ'].licensing, undefined,
    'a Pro payment must not create a licensing record');
});

test('a confirmed Pro payment never demotes a Lifetime licence', async () => {
  const state = setup({ verifyAmountKes: 599 });
  licensedBusiness(state, { expiryOffsetDays: 200 });
  pendingPayment(state, 'ref-stale-pro', { plan: 'pro', amountKes: 599 });

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-stale-pro')), env);

  assert.equal(res.status, 200);
  assert.equal(state.store['businesses/BIZ'].subscription.plan, 'lifetime');
  assert.equal(licensingOf(state).licenseStatus, 'active');
  assert.equal(state.store['payments/ref-stale-pro'].supersededByLifetime, true);
});

test('a second Lifetime payment extends services rather than shortening them', async () => {
  const state = setup();
  // Already licensed with a long service period. A stale second checkout
  // must not recompute the period from today.
  const expiry = licensedBusiness(state, { expiryOffsetDays: 700 });
  pendingPayment(state, 'ref-lt-again', { plan: 'lifetime', amountKes: LIFETIME_LICENSE_PRICE_KES });

  await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-lt-again')), env);

  const after = new Date(licensingOf(state).serviceExpiryDate);
  assert.ok(after.getTime() > expiry.getTime(), 'the period may only grow');
});

// ── 10. Data preservation ─────────────────────────────────────────────

test('NOTHING A PAYMENT PATH DOES EVER DELETES BUSINESS DATA', async () => {
  const state = setup({ verifyAmountKes: ANNUAL_SERVICE_PRICE_KES });
  licensedBusiness(state, { expiryOffsetDays: -400 }); // long expired
  state.store['products/p1'] = { businessId: 'BIZ', name: 'Sugar 1kg' };
  state.store['productImages/BIZ__p1'] = { businessId: 'BIZ', dataUrl: 'data:image/webp;base64,AAA' };
  state.store['sales/s1'] = { businessId: 'BIZ', totalAmount: 250 };
  state.store['customers/c1'] = { businessId: 'BIZ', name: 'Mama Njeri' };
  const before = Object.keys(state.store).length;

  pendingPayment(state, 'ref-preserve', { plan: 'annual_services', amountKes: ANNUAL_SERVICE_PRICE_KES });
  await handlePaystackWebhook(webhookRequest(chargeSuccess('ref-preserve')), env);

  assert.ok(state.store['products/p1'], 'products survive');
  assert.ok(state.store['productImages/BIZ__p1'], 'product photos survive');
  assert.ok(state.store['sales/s1'], 'sales survive');
  assert.ok(state.store['customers/c1'], 'customers survive');
  assert.ok(Object.keys(state.store).length >= before, 'nothing was removed');
});

// ── 11-14. Administrative controls ────────────────────────────────────

/** Registers an administrator with `role` and returns their token. */
function admin(state, role, { uid = 'adm', email = 'ops@flowbiz.co.ke' } = {}) {
  state.store[`systemAdmins/${uid}`] = { uid, email, name: 'Ops', role, active: true };
  return mintIdToken({ uid, email });
}

async function licensingAction(state, token, body, businessId = 'BIZ') {
  return handleAdminLicensingAction(
    adminRequest(`/api/admin/businesses/${businessId}/licensing`, { token, method: 'POST', body }),
    env,
    businessId,
  );
}

test('AN ADMIN CAN SUSPEND CLOUD SERVICES WITHOUT REVOKING THE LICENCE', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 200 });
  const token = admin(state, 'ADMIN');

  const res = await licensingAction(state, token, {
    action: 'suspend-cloud', reason: 'Chargeback under investigation, ticket 991',
  });
  assert.equal(res.status, 200);

  const lic = licensingOf(state);
  assert.equal(lic.cloudSuspended, true);
  assert.equal(lic.cloudSuspendedBy, 'ops@flowbiz.co.ke');
  assert.equal(lic.cloudSuspendedReason, 'Chargeback under investigation, ticket 991');

  // THE POINT OF THE WHOLE TEST: the licence is untouched.
  assert.equal(lic.licenseType, 'lifetime');
  assert.equal(lic.licenseStatus, 'active');
  assert.equal(lic.licenseRevokedAt ?? null, null);

  const e = resolveEntitlements(state.store['businesses/BIZ'], Date.now());
  assert.equal(e.license.owned, true);
  assert.equal(e.cloud.entitled, false);
  assert.equal(e.can('features.pro'), true, 'licensed features survive a suspension');
  assert.equal(e.localApplicationAvailable, true);
});

test('suspension deletes nothing and touches no other business', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 200 });
  licensedBusiness(state, { expiryOffsetDays: 200, businessId: 'OTHER' });
  state.store['products/p1'] = { businessId: 'BIZ', name: 'Sugar' };
  state.store['productImages/BIZ__p1'] = { businessId: 'BIZ', dataUrl: 'data:...' };
  const token = admin(state, 'ADMIN');

  await licensingAction(state, token, { action: 'suspend-cloud', reason: 'Test' });

  assert.ok(state.store['products/p1']);
  assert.ok(state.store['productImages/BIZ__p1'], 'product photos are never deleted by a suspension');
  assert.equal(licensingOf(state, 'OTHER').cloudSuspended, false, 'another business is unaffected');
});

test('an admin can restore cloud services, and the history of both is kept', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 200 });
  const token = admin(state, 'ADMIN');

  await licensingAction(state, token, { action: 'suspend-cloud', reason: 'Payment dispute' });
  const res = await licensingAction(state, token, { action: 'restore-cloud', reason: 'Dispute resolved' });
  assert.equal(res.status, 200);

  const lic = licensingOf(state);
  assert.equal(lic.cloudSuspended, false);
  assert.equal(lic.cloudRestoredBy, 'ops@flowbiz.co.ke');
  assert.equal(lic.cloudRestoredReason, 'Dispute resolved');
  // The suspension is still on the record; a restore is not an erasure.
  assert.equal(lic.cloudSuspendedReason, 'Payment dispute');
  assert.ok(lic.cloudSuspendedAt);

  assert.equal(resolveEntitlements(state.store['businesses/BIZ'], Date.now()).cloud.entitled, true);
});

test('EVERY LICENSING ACTION IS AUDITED WITH WHO, WHAT, PREVIOUS AND NEW STATE', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 200 });
  const token = admin(state, 'ADMIN');

  await licensingAction(state, token, { action: 'suspend-cloud', reason: 'Ticket 4821' });

  const logs = Object.entries(state.store)
    .filter(([k]) => k.startsWith('adminAuditLogs/'))
    .map(([, v]) => v);
  const entry = logs.find((l) => l.action === 'SUSPEND_CLOUD_SERVICES');
  assert.ok(entry, 'the action must be in the audit trail');
  assert.equal(entry.adminEmail, 'ops@flowbiz.co.ke');
  assert.equal(entry.adminRole, 'ADMIN');
  assert.equal(entry.targetBusinessId, 'BIZ');
  assert.equal(entry.details.reason, 'Ticket 4821');
  assert.equal(entry.details.previousCloudStatus, 'active');
  assert.equal(entry.details.newCloudStatus, 'suspended_by_admin');
  // And the auditor can see the licence did not move.
  assert.equal(entry.details.previousLicenseStatus, 'active');
  assert.equal(entry.details.newLicenseStatus, 'active');
  assert.ok(entry.timestamp);
});

test('a licensing action without a stated reason is refused', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 200 });
  const token = admin(state, 'ADMIN');

  const res = await licensingAction(state, token, { action: 'suspend-cloud' });
  assert.equal(res.status, 400);
  assert.equal(licensingOf(state).cloudSuspended, false, 'nothing was written');
});

test('a SUPPORT administrator may read licensing but may not change it', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 200 });
  const token = admin(state, 'SUPPORT');

  const read = await handleAdminLicensingRead(
    adminRequest('/api/admin/businesses/BIZ/licensing', { token }), env, 'BIZ',
  );
  assert.equal(read.status, 200);

  for (const action of ['suspend-cloud', 'restore-cloud', 'set-service', 'revoke-license']) {
    const res = await licensingAction(state, token, { action, reason: 'Because I want to' });
    assert.equal(res.status, 403, `${action} must be refused for SUPPORT`);
  }
  assert.equal(licensingOf(state).cloudSuspended, false);
  assert.equal(licensingOf(state).licenseStatus, 'active');
});

test('ONLY A SUPER_ADMIN MAY REVOKE A LICENCE', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 200 });

  for (const role of ['SUPPORT', 'FINANCE', 'ADMIN']) {
    const token = admin(state, role, { uid: `adm-${role}`, email: `${role.toLowerCase()}@flowbiz.co.ke` });
    const res = await licensingAction(state, token, { action: 'revoke-license', reason: 'Fraud' });
    assert.equal(res.status, 403, `${role} must not be able to revoke a licence`);
  }
  assert.equal(licensingOf(state).licenseStatus, 'active');

  const superToken = admin(state, 'SUPER_ADMIN', { uid: 'sa', email: 'sa@flowbiz.co.ke' });
  const ok = await licensingAction(state, superToken, {
    action: 'revoke-license', reason: 'Reversed payment, ticket 77',
  });
  assert.equal(ok.status, 200);
  assert.equal(licensingOf(state).licenseStatus, 'revoked');
  assert.equal(licensingOf(state).licenseRevokedReason, 'Reversed payment, ticket 77');
});

test('an unauthenticated caller cannot change any licensing state', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 200 });

  const res = await handleAdminLicensingAction(
    adminRequest('/api/admin/businesses/BIZ/licensing', {
      method: 'POST', body: { action: 'restore-cloud', reason: 'let me in' },
    }),
    env, 'BIZ',
  );
  assert.equal(res.status, 401);
  assert.equal(licensingOf(state).cloudSuspended, false);
});

test('a deactivated administrator cannot act, whatever their role says', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 200 });
  const token = admin(state, 'SUPER_ADMIN', { uid: 'gone', email: 'gone@flowbiz.co.ke' });
  state.store['systemAdmins/gone'].active = false;

  const res = await licensingAction(state, token, { action: 'revoke-license', reason: 'test' });
  assert.equal(res.status, 403);
  assert.equal(licensingOf(state).licenseStatus, 'active');
});

// ── Service overrides and migration ───────────────────────────────────

test('an administrator can extend a service period, bounded server-side', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 5 });
  const token = admin(state, 'FINANCE', { uid: 'fin', email: 'fin@flowbiz.co.ke' });

  const target = new Date(Date.now() + 200 * DAY).toISOString();
  const res = await licensingAction(state, token, {
    action: 'set-service', serviceExpiryDate: target, reason: 'Goodwill, ticket 12',
  });
  assert.equal(res.status, 200);
  assert.equal(new Date(licensingOf(state).serviceExpiryDate).toISOString(), target);
  assert.equal(licensingOf(state).serviceOverriddenBy, 'fin@flowbiz.co.ke');

  // A century of free service is refused.
  const absurd = new Date(Date.now() + 100 * 365 * DAY).toISOString();
  const refused = await licensingAction(state, token, {
    action: 'set-service', serviceExpiryDate: absurd, reason: 'oops',
  });
  assert.equal(refused.status, 400);
  assert.equal(new Date(licensingOf(state).serviceExpiryDate).toISOString(), target, 'unchanged');
});

test('MIGRATING A PRE-MODEL LICENCE ONLY EVER ADDS TIME', async () => {
  const state = setup();
  // A licence sold before annual services existed: no licensing record at
  // all, only the old subscription map.
  state.store['businesses/OLD'] = {
    subscription: { plan: 'lifetime', status: 'active', expiresAt: null, purchasedAt: new Date('2024-03-01') },
  };
  const token = admin(state, 'FINANCE', { uid: 'fin2', email: 'fin2@flowbiz.co.ke' });

  const before = resolveEntitlements(state.store['businesses/OLD'], Date.now());
  assert.equal(before.service.status, 'grandfathered');
  assert.equal(before.cloud.entitled, true, 'they were fully entitled before migration');

  const res = await licensingAction(state, token, {
    action: 'migrate', months: 12, reason: 'Annual services rollout',
  }, 'OLD');
  assert.equal(res.status, 200);

  const after = resolveEntitlements(state.store['businesses/OLD'], Date.now());
  assert.equal(after.license.owned, true);
  assert.equal(after.service.status, 'active');
  assert.equal(after.cloud.entitled, true, 'a migration must never leave them worse off');
  const days = after.service.daysRemaining;
  assert.ok(days > 360 && days < 370, `expected a fresh 12 months, got ${days} days`);
  assert.equal(state.store['businesses/OLD'].licensing.migratedFrom, 'legacy_lifetime_subscription');

  // Migrating twice is refused rather than silently re-granting.
  const again = await licensingAction(state, token, { action: 'migrate', reason: 'again' }, 'OLD');
  assert.equal(again.status, 400);
});

test('an unknown licensing action is refused before anything is written', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 200 });
  const token = admin(state, 'SUPER_ADMIN', { uid: 'sa2', email: 'sa2@flowbiz.co.ke' });

  for (const action of ['delete-everything', '', null, 'REVOKE-LICENSE', '__proto__']) {
    const res = await licensingAction(state, token, { action, reason: 'x' });
    assert.equal(res.status, 400, `${JSON.stringify(action)} must be refused`);
  }
  assert.equal(licensingOf(state).licenseStatus, 'active');
});

// ── The read endpoint ─────────────────────────────────────────────────

test('the licensing read reports the licence and the services separately', async () => {
  const state = setup();
  licensedBusiness(state, { expiryOffsetDays: 20 });
  const token = admin(state, 'ADMIN');

  const res = await handleAdminLicensingRead(
    adminRequest('/api/admin/businesses/BIZ/licensing', { token }), env, 'BIZ',
  );
  const body = await res.json();

  assert.equal(body.licensing.license.owned, true);
  assert.equal(body.licensing.license.expiresAt, null, 'a licence has no expiry, stated explicitly');
  assert.equal(body.licensing.service.status, 'active');
  assert.equal(body.licensing.service.daysRemaining, 20);
  assert.equal(body.licensing.service.renewalPriceKes, ANNUAL_SERVICE_PRICE_KES);
  assert.equal(body.licensing.localApplicationAvailable, true);
  assert.equal(body.permissions.canSuspendCloud, true);
  assert.equal(body.permissions.canRevokeLicense, false, 'an ADMIN is not a SUPER_ADMIN');
});
