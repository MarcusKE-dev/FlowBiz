// Direct M-Pesa (STK) payments, against the real handlers.
//
// Only the network is stubbed: Firestore by the harness, Paystack by the
// layer below. The ID tokens are genuinely signed and verified.
//
// THE RULE THIS FILE EXISTS TO HOLD: an STK prompt that was sent but not
// paid grants nothing. Every scenario below that is not an explicit,
// Paystack-verified, amount-matching success asserts the business is
// exactly as it started.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { installStub, env as baseEnv, mintIdToken } from './helpers/adminHarness.js';
import { handleMpesaCharge, handleMpesaStatus, reconcileStaleMpesaPayments } from '../src/routes/mpesaPayments.js';
import { handlePaystackWebhook } from '../src/routes/paystackWebhook.js';
import { handlePaystackInitialize } from '../src/routes/paystackInitialize.js';
import {
  normalizeKenyanMsisdn,
  maskMsisdn,
  classifyPaystackStatus,
  MPESA_IN_FLIGHT_MS,
  isValidReference,
  mpesaReference,
} from '../src/lib/mpesa.js';

const SECRET = 'sk_test_secret';
const env = { ...baseEnv, PAYSTACK_SECRET_KEY: SECRET };
const PRO_KOBO = 59900;
const LIFETIME_KOBO = 1555000;

// ── Phone numbers ─────────────────────────────────────────────────────

test('every common way of typing a Kenyan M-Pesa number normalises to +254…', () => {
  for (const input of ['0712345678', '712345678', '254712345678', '+254712345678', '00254712345678', '0712 345 678', '+254 712-345-678', '(0712) 345678']) {
    assert.equal(normalizeKenyanMsisdn(input), '+254712345678', input);
  }
  for (const input of ['0112345678', '254112345678', '+254112345678', '112345678']) {
    assert.equal(normalizeKenyanMsisdn(input), '+254112345678', input);
  }
});

test('anything that is not a Kenyan mobile number is refused before Paystack sees it', () => {
  for (const input of [
    '', '   ', null, undefined, {}, '07123', '07123456789', '0212345678', '0812345678',
    '+255712345678', '+1 712 345 678', '0712abc678', '+254+712345678', '2547123456', '0712345678; DROP',
    '9'.repeat(30),
  ]) {
    assert.equal(normalizeKenyanMsisdn(input), null, String(input));
  }
});

test('a number is shown masked, never in full', () => {
  assert.equal(maskMsisdn('+254712345678'), '0712 *** 678');
  assert.equal(maskMsisdn('0112345678'), '0112 *** 678');
  assert.equal(maskMsisdn('nonsense'), null);
});

test('M-Pesa references use only the characters Paystack /charge accepts', () => {
  const ref = mpesaReference();
  assert.match(ref, /^[A-Za-z0-9.=-]+$/);
  assert.ok(isValidReference(ref));
  assert.equal(isValidReference('../payments/x'), false);
  assert.equal(isValidReference('a/b/c/d/e/f'), false);
});

test('abandoned is only failure once the prompt can no longer be answered', () => {
  assert.deepEqual(classifyPaystackStatus('abandoned', 30_000), { outcome: 'pending' });
  assert.deepEqual(classifyPaystackStatus('abandoned', MPESA_IN_FLIGHT_MS + 1), { outcome: 'failed', reason: 'expired' });
  assert.deepEqual(classifyPaystackStatus('ongoing', MPESA_IN_FLIGHT_MS * 10), { outcome: 'pending' });
  assert.equal(classifyPaystackStatus('failed', 1).outcome, 'failed');
  assert.equal(classifyPaystackStatus('success', 1).outcome, 'success');
});

// ── Harness ───────────────────────────────────────────────────────────

/**
 * Firestore stub + a Paystack stub whose answers each test sets.
 * `ps.tx[reference]` is what /transaction/verify returns (absent → 404).
 */
function setup({ business = { subscription: { plan: 'free', status: 'active' } } } = {}) {
  const state = installStub();
  const ps = {
    chargeCalls: [],
    verifyCalls: 0,
    chargeReply: { status: true, message: 'Charge attempted', data: { status: 'pay_offline', display_text: 'Please complete authorization process on your mobile phone' } },
    chargeHttp: 200,
    chargeThrows: false,
    tx: {},
  };
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u === 'https://api.paystack.co/charge') {
      ps.chargeCalls.push(JSON.parse(init.body));
      if (ps.chargeThrows) throw new TypeError('network down');
      return new Response(JSON.stringify(ps.chargeReply), { status: ps.chargeHttp });
    }
    if (u.includes('api.paystack.co/transaction/verify/')) {
      ps.verifyCalls += 1;
      const ref = decodeURIComponent(u.split('/').pop());
      const tx = ps.tx[ref];
      if (!tx) return new Response(JSON.stringify({ status: false, message: 'Transaction reference not found' }), { status: 404 });
      return new Response(JSON.stringify({ status: true, data: { id: 777, reference: ref, currency: 'KES', channel: 'mobile_money', ...tx } }), { status: 200 });
    }
    return inner(url, init);
  };

  state.store['users/owner-1'] = { role: 'owner', businessId: 'BIZ', email: 'owner@shop.test', active: true };
  state.store['users/cashier-1'] = { role: 'cashier', businessId: 'BIZ', email: 'c@shop.test', active: true };
  state.store['users/owner-2'] = { role: 'owner', businessId: 'OTHER', email: 'o2@shop.test', active: true };
  state.store['businesses/BIZ'] = structuredClone(business);
  state.store['businesses/OTHER'] = { subscription: { plan: 'free', status: 'active' } };
  return { state, ps };
}

function charge(body, { uid = 'owner-1' } = {}) {
  return handleMpesaCharge(new Request('https://api.test/api/paystack/mpesa/charge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintIdToken({ uid, email: `${uid}@shop.test` })}` },
    body: JSON.stringify(body),
  }), env);
}

function status(reference, { uid = 'owner-1', token } = {}) {
  const url = new URL(`https://api.test/api/paystack/mpesa/status?reference=${encodeURIComponent(reference)}`);
  const auth = token === null ? {} : { Authorization: `Bearer ${token ?? mintIdToken({ uid, email: `${uid}@shop.test` })}` };
  return handleMpesaStatus(new Request(url, { headers: auth }), env, url);
}

function webhook(reference) {
  const raw = JSON.stringify({ event: 'charge.success', data: { reference } });
  return handlePaystackWebhook(new Request('https://api.test/api/paystack/webhook', {
    method: 'POST',
    headers: { 'x-paystack-signature': createHmac('sha512', SECRET).update(raw).digest('hex') },
    body: raw,
  }), env);
}

/** Pretend the payment was started `msAgo` and has not been checked since. */
function age(state, reference, msAgo) {
  state.store[`payments/${reference}`].createdAt = new Date(Date.now() - msAgo);
  state.store[`payments/${reference}`].lastVerifiedAt = null;
}
const recheck = (state, reference) => { state.store[`payments/${reference}`].lastVerifiedAt = null; };

const snapshot = (state) => JSON.stringify(state.store['businesses/BIZ']);

// ── Starting a payment ────────────────────────────────────────────────

test('STK SENT BUT UNPAID GRANTS NOTHING — not on send, not while waiting', async () => {
  const { state, ps } = setup();
  const before = snapshot(state);

  const res = await charge({ plan: 'lifetime', phone: '0712 345 678' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'pending');
  assert.equal(body.phoneMasked, '0712 *** 678');
  assert.equal(body.amountKes, 15550);
  assert.equal(snapshot(state), before, 'sending the prompt must not touch the business');

  // Paystack's own charge call was exactly what FlowBiz priced.
  assert.equal(ps.chargeCalls.length, 1);
  assert.equal(ps.chargeCalls[0].amount, String(LIFETIME_KOBO));
  assert.equal(ps.chargeCalls[0].currency, 'KES');
  assert.deepEqual(ps.chargeCalls[0].mobile_money, { phone: '+254712345678', provider: 'mpesa' });
  assert.equal(ps.chargeCalls[0].reference, body.reference);

  // Customer is looking at their phone; Paystack says ongoing.
  ps.tx[body.reference] = { status: 'ongoing', amount: LIFETIME_KOBO };
  const polled = await (await status(body.reference)).json();
  assert.equal(polled.status, 'pending');
  assert.equal(polled.delayed, false);
  assert.equal(snapshot(state), before, 'waiting must not touch the business');

  const record = state.store[`payments/${body.reference}`];
  assert.equal(record.status, 'pending');
  assert.equal(record.channel, 'mpesa_stk');
  assert.equal(record.phoneMasked, '0712 *** 678');
  assert.ok(!JSON.stringify(record).includes('712345678'), 'the full number is never stored');
});

test('even a Paystack charge reply of "success" is not trusted until verify confirms it', async () => {
  const { state, ps } = setup();
  ps.chargeReply = { status: true, data: { status: 'success' } };
  const before = snapshot(state);
  const body = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  assert.equal(body.status, 'pending');
  assert.equal(snapshot(state), before);
});

test('the browser cannot set the price: an amount in the body is ignored', async () => {
  const { ps } = setup();
  await charge({ plan: 'lifetime', phone: '0712345678', amount: 100, amountKes: 1 });
  assert.equal(ps.chargeCalls[0].amount, String(LIFETIME_KOBO));
});

test('a tampered or missing plan is refused before Paystack is called', async () => {
  const { ps } = setup();
  for (const plan of ['enterprise', '', undefined, '__proto__', 'constructor', 'lifetime ']) {
    const res = await charge({ plan, phone: '0712345678' });
    assert.equal(res.status, 400, String(plan));
  }
  assert.equal(ps.chargeCalls.length, 0);
});

test('an invalid phone number is refused with the customer-facing copy', async () => {
  const { ps } = setup();
  const res = await charge({ plan: 'pro', phone: '0812345678' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Enter a valid Kenyan M-Pesa number.');
  assert.equal(ps.chargeCalls.length, 0);
});

test('only an owner may start a payment, and only for their own business', async () => {
  const { ps } = setup();
  assert.equal((await charge({ plan: 'pro', phone: '0712345678' }, { uid: 'cashier-1' })).status, 403);
  const noAuth = await handleMpesaCharge(new Request('https://api.test/x', {
    method: 'POST', body: JSON.stringify({ plan: 'pro', phone: '0712345678' }),
  }), env);
  assert.equal(noAuth.status, 401);
  assert.equal(ps.chargeCalls.length, 0);
});

test('a business that owns Lifetime cannot buy Lifetime again, or Pro', async () => {
  const { ps } = setup({ business: { subscription: { plan: 'lifetime', status: 'active', expiresAt: null } } });
  assert.equal((await charge({ plan: 'lifetime', phone: '0712345678' })).status, 400);
  assert.equal((await charge({ plan: 'pro', phone: '0712345678' })).status, 400);
  assert.equal(ps.chargeCalls.length, 0);
});

test('the hosted checkout refuses Pro for a Lifetime business too', async () => {
  setup({ business: { subscription: { plan: 'lifetime', status: 'active', expiresAt: null } } });
  const res = await handlePaystackInitialize(new Request('https://api.test/api/paystack/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mintIdToken({ uid: 'owner-1' })}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: 'pro' }),
  }), env);
  assert.equal(res.status, 400);
});

// ── Completing a payment ──────────────────────────────────────────────

test('Free → Pro: the signed webhook activates Pro and the status route reports it', async () => {
  const { state, ps } = setup();
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();

  ps.tx[reference] = { status: 'success', amount: PRO_KOBO };
  assert.equal((await webhook(reference)).status, 200);

  const sub = state.store['businesses/BIZ'].subscription;
  assert.equal(sub.plan, 'pro');
  const days = (new Date(sub.expiresAt) - Date.now()) / 86400000;
  assert.ok(days > 29.9 && days < 30.1);

  const polled = await (await status(reference)).json();
  assert.equal(polled.status, 'success');
  assert.equal(polled.plan, 'pro');
  assert.equal(state.store[`payments/${reference}`].paystackChannel, 'mobile_money');
});

test('Free → Lifetime: DELAYED WEBHOOK — the status route settles it, and the late webhook changes nothing', async () => {
  const { state, ps } = setup();
  const { reference } = await (await charge({ plan: 'lifetime', phone: '+254712345678' })).json();

  ps.tx[reference] = { status: 'success', amount: LIFETIME_KOBO };
  const polled = await (await status(reference)).json();
  assert.equal(polled.status, 'success');

  const licensing = state.store['businesses/BIZ'].licensing;
  assert.equal(licensing.licenseType, 'lifetime');
  assert.equal(licensing.renewalCount, 0);
  const serviceExpiry = String(licensing.serviceExpiryDate);

  // The webhook finally arrives. It must not be applied a second time
  // (which, for Lifetime, would add another 12 months of services).
  assert.equal((await webhook(reference)).status, 200);
  assert.equal(String(state.store['businesses/BIZ'].licensing.serviceExpiryDate), serviceExpiry);
  assert.equal(state.store['businesses/BIZ'].licensing.renewalCount, 0);
});

test('Pro renewal extends from the current expiry and never shortens it', async () => {
  const current = new Date(Date.now() + 20 * 86400000);
  const { state, ps } = setup({ business: { subscription: { plan: 'pro', status: 'active', expiresAt: current } } });
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'success', amount: PRO_KOBO };
  await webhook(reference);
  const days = (new Date(state.store['businesses/BIZ'].subscription.expiresAt) - Date.now()) / 86400000;
  assert.ok(days > 49.9 && days < 50.1, `expected ~50 days, got ${days}`);
});

test('Pro → Lifetime: an active Pro business can buy the licence', async () => {
  const { state, ps } = setup({ business: { subscription: { plan: 'pro', status: 'active', expiresAt: new Date(Date.now() + 5 * 86400000) } } });
  const { reference } = await (await charge({ plan: 'lifetime', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'success', amount: LIFETIME_KOBO };
  await webhook(reference);
  assert.equal(state.store['businesses/BIZ'].subscription.plan, 'lifetime');
  assert.equal(state.store['businesses/BIZ'].licensing.licenseType, 'lifetime');
});

test('Lifetime owner renews annual services over M-Pesa', async () => {
  const { state, ps } = setup({ business: {
    subscription: { plan: 'lifetime', status: 'active', expiresAt: null },
    licensing: { licenseType: 'lifetime', licenseStatus: 'active', serviceExpiryDate: new Date(Date.now() + 10 * 86400000) },
  } });
  const { reference } = await (await charge({ plan: 'annual_services', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'success', amount: 300000 };
  await webhook(reference);
  assert.equal(state.store['businesses/BIZ'].licensing.renewalCount, 1);
});

// ── Payments that do not complete ────────────────────────────────────

test('STK CANCELLED / WRONG PIN / NO FUNDS: failed, nothing granted, retry allowed', async () => {
  const { state, ps } = setup();
  const before = snapshot(state);
  const first = await (await charge({ plan: 'pro', phone: '0712345678' })).json();

  ps.tx[first.reference] = { status: 'failed', amount: PRO_KOBO, gateway_response: 'Declined' };
  const polled = await (await status(first.reference)).json();
  assert.equal(polled.status, 'failed');
  assert.equal(polled.reason, 'declined');
  assert.equal(snapshot(state), before);

  const retry = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  assert.notEqual(retry.reference, first.reference);
  assert.equal(ps.chargeCalls.length, 2);
});

test('STK IGNORED: pending inside the window, expired after it, nothing granted', async () => {
  const { state, ps } = setup();
  const before = snapshot(state);
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();

  ps.tx[reference] = { status: 'abandoned', amount: PRO_KOBO };
  assert.equal((await (await status(reference)).json()).status, 'pending');

  age(state, reference, MPESA_IN_FLIGHT_MS + 1000);
  const expired = await (await status(reference)).json();
  assert.equal(expired.status, 'failed');
  assert.equal(expired.reason, 'expired');
  assert.equal(snapshot(state), before);
});

test('STK TIMEOUT WITHOUT A VERDICT: reported as delayed, never as failed', async () => {
  const { state, ps } = setup();
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'pending', amount: PRO_KOBO };
  age(state, reference, MPESA_IN_FLIGHT_MS + 1000);
  const polled = await (await status(reference)).json();
  assert.equal(polled.status, 'pending');
  assert.equal(polled.delayed, true);
});

test('a payment marked expired is still honoured if Paystack later confirms it', async () => {
  const { state, ps } = setup();
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'abandoned', amount: PRO_KOBO };
  age(state, reference, MPESA_IN_FLIGHT_MS + 1000);
  await status(reference);
  assert.equal(state.store[`payments/${reference}`].status, 'failed');

  ps.tx[reference] = { status: 'success', amount: PRO_KOBO };
  assert.equal((await webhook(reference)).status, 200);
  assert.equal(state.store['businesses/BIZ'].subscription.plan, 'pro');
});

test('WRONG AMOUNT: Paystack success for the wrong amount grants nothing and needs review', async () => {
  const { state, ps } = setup();
  const before = snapshot(state);
  const { reference } = await (await charge({ plan: 'lifetime', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'success', amount: 100 };
  const polled = await (await status(reference)).json();
  assert.equal(polled.status, 'review');
  assert.equal(snapshot(state), before);
  assert.equal((await webhook(reference)).status, 400);
  assert.equal(snapshot(state), before);
});

test('WRONG CURRENCY: grants nothing', async () => {
  const { state, ps } = setup();
  const before = snapshot(state);
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'success', amount: PRO_KOBO, currency: 'NGN' };
  assert.equal((await (await status(reference)).json()).status, 'review');
  assert.equal(snapshot(state), before);
});

test('INVALID WEBHOOK SIGNATURE for an M-Pesa reference grants nothing', async () => {
  const { state, ps } = setup();
  const before = snapshot(state);
  const { reference } = await (await charge({ plan: 'lifetime', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'success', amount: LIFETIME_KOBO };
  const raw = JSON.stringify({ event: 'charge.success', data: { reference } });
  const res = await handlePaystackWebhook(new Request('https://api.test/w', {
    method: 'POST', headers: { 'x-paystack-signature': createHmac('sha512', 'wrong').update(raw).digest('hex') }, body: raw,
  }), env);
  assert.equal(res.status, 401);
  assert.equal(snapshot(state), before);
});

// ── Duplicates ────────────────────────────────────────────────────────

test('DUPLICATE STK REQUEST: a second tap resumes the live prompt instead of ringing again', async () => {
  const { ps } = setup();
  const first = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[first.reference] = { status: 'ongoing', amount: PRO_KOBO };
  const second = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  assert.equal(second.reference, first.reference);
  assert.equal(second.resumed, true);
  assert.equal(ps.chargeCalls.length, 1);
});

test('a different plan is refused while a prompt is still live', async () => {
  const { ps } = setup();
  const first = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[first.reference] = { status: 'ongoing', amount: PRO_KOBO };
  assert.equal((await charge({ plan: 'lifetime', phone: '0712345678' })).status, 409);
  assert.equal(ps.chargeCalls.length, 1);
});

test('two taps racing each other send exactly one prompt', async () => {
  const { ps } = setup();
  const results = await Promise.all([
    charge({ plan: 'pro', phone: '0712345678' }),
    charge({ plan: 'pro', phone: '0712345678' }),
  ]);
  assert.equal(ps.chargeCalls.length, 1);
  // The loser either resumes the winner's prompt or is told one is on its
  // way — never a second reference.
  const bodies = await Promise.all(results.map((r) => r.json()));
  const refs = new Set(bodies.filter((b) => b.reference).map((b) => b.reference));
  assert.equal(refs.size, 1);
  for (const r of results) assert.ok([200, 409].includes(r.status));
});

test('DUPLICATE WEBHOOK delivered concurrently extends Pro once', async () => {
  const { state, ps } = setup();
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'success', amount: PRO_KOBO };
  await Promise.all([webhook(reference), webhook(reference), status(reference)]);
  const days = (new Date(state.store['businesses/BIZ'].subscription.expiresAt) - Date.now()) / 86400000;
  assert.ok(days > 29.9 && days < 30.1, `expected one 30-day extension, got ${days} days`);
});

test('a just-confirmed payment is shown again rather than charged again', async () => {
  const { ps } = setup();
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'success', amount: PRO_KOBO };
  await webhook(reference);
  const again = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  assert.equal(again.reference, reference);
  assert.equal(again.status, 'success');
  assert.equal(ps.chargeCalls.length, 1);
});

// ── Network trouble ──────────────────────────────────────────────────

test('NETWORK INTERRUPTION on /charge: pending and uncertain, then failed once Paystack has no record', async () => {
  const { state, ps } = setup();
  const before = snapshot(state);
  ps.chargeThrows = true;
  const res = await charge({ plan: 'pro', phone: '0712345678' });
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.status, 'pending');
  assert.equal(body.uncertain, true);

  // Inside the window: Paystack 404 is not yet proof of anything.
  assert.equal((await (await status(body.reference)).json()).status, 'pending');
  age(state, body.reference, MPESA_IN_FLIGHT_MS + 1000);
  const after = await (await status(body.reference)).json();
  assert.equal(after.status, 'failed');
  assert.equal(after.reason, 'not_started');
  assert.equal(snapshot(state), before);
});

test('Paystack refusing the charge is a generic error, releases the lock, and leaks nothing', async () => {
  const { state, ps } = setup();
  ps.chargeHttp = 400;
  ps.chargeReply = { status: false, message: 'Internal integration detail sk_live_xyz' };
  const res = await charge({ plan: 'pro', phone: '0712345678' });
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.ok(!text.includes('sk_live'), 'Paystack messages are not relayed');
  assert.ok(text.includes("couldn't send the M-Pesa prompt"));
  assert.equal(state.store['paymentLocks/BIZ'], undefined);

  ps.chargeHttp = 200;
  ps.chargeReply = { status: true, data: { status: 'pay_offline' } };
  assert.equal((await charge({ plan: 'pro', phone: '0712345678' })).status, 200);
});

// ── Access to status ─────────────────────────────────────────────────

test('UNAUTHORISED STATUS LOOKUP: another business, a cashier, or no session learns nothing', async () => {
  const { ps } = setup();
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'success', amount: PRO_KOBO };
  const verifyBefore = ps.verifyCalls;

  assert.equal((await status(reference, { uid: 'owner-2' })).status, 404);
  assert.equal((await status(reference, { uid: 'cashier-1' })).status, 403);
  assert.equal((await status(reference, { token: null })).status, 401);
  assert.equal((await status('../../users/owner-1')).status, 404);
  assert.equal(ps.verifyCalls, verifyBefore, 'a refused lookup never reaches Paystack');
});

test('the status route asks Paystack at most once per interval', async () => {
  const { state, ps } = setup();
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'ongoing', amount: PRO_KOBO };
  await status(reference);
  await status(reference);
  await status(reference);
  assert.equal(ps.verifyCalls, 1);
  recheck(state, reference);
  await status(reference);
  assert.equal(ps.verifyCalls, 2);
});

// ── The customer who closes the app ──────────────────────────────────

test('BROWSER CLOSED, WEBHOOK LATER: entitlement is active when they return', async () => {
  const { state, ps } = setup();
  const { reference } = await (await charge({ plan: 'lifetime', phone: '0712345678' })).json();
  // …customer approves on the phone and closes FlowBiz. No status polls.
  ps.tx[reference] = { status: 'success', amount: LIFETIME_KOBO };
  await webhook(reference);
  // …they open FlowBiz again. The business document is what the app reads.
  assert.equal(state.store['businesses/BIZ'].licensing.licenseType, 'lifetime');
  assert.equal((await (await status(reference)).json()).status, 'success');
});

test('BROWSER CLOSED, WEBHOOK NEVER ARRIVES: the daily reconciliation settles it', async () => {
  const { state, ps } = setup();
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'success', amount: PRO_KOBO };
  age(state, reference, MPESA_IN_FLIGHT_MS + 60_000);

  const summary = await reconcileStaleMpesaPayments(env);
  assert.equal(summary.settled, 1);
  assert.equal(state.store['businesses/BIZ'].subscription.plan, 'pro');
});

test('the daily reconciliation expires unanswered prompts and grants nothing', async () => {
  const { state, ps } = setup();
  const before = snapshot(state);
  const { reference } = await (await charge({ plan: 'pro', phone: '0712345678' })).json();
  ps.tx[reference] = { status: 'abandoned', amount: PRO_KOBO };
  age(state, reference, MPESA_IN_FLIGHT_MS + 60_000);
  const summary = await reconcileStaleMpesaPayments(env);
  assert.equal(summary.failed, 1);
  assert.equal(state.store[`payments/${reference}`].status, 'failed');
  assert.equal(snapshot(state), before);
});
