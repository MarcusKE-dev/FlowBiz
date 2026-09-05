// The Paystack webhook, against the real handler.
//
// The three protections it already had (HMAC, idempotency, server-side
// re-verification with an amount cross-check) are exercised here so they
// cannot be regressed, alongside the one this file was added for: a
// confirmed PRO payment must never overwrite a LIFETIME licence.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { installStub, env as baseEnv } from './helpers/adminHarness.js';
import { handlePaystackWebhook } from '../src/routes/paystackWebhook.js';

const SECRET = 'sk_test_secret';
const env = { ...baseEnv, PAYSTACK_SECRET_KEY: SECRET };

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
function setup({ verifyAmountKobo = 59900, verifyStatus = 'success', currency = 'KES' } = {}) {
  const state = installStub();
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.paystack.co/transaction/verify/')) {
      return new Response(JSON.stringify({
        status: true,
        data: { id: 4242, status: verifyStatus, amount: verifyAmountKobo, currency },
      }), { status: 200 });
    }
    return inner(url, init);
  };
  return state;
}

const chargeSuccess = (reference) => ({ event: 'charge.success', data: { reference } });

test('an unsigned or wrongly signed webhook is refused and changes nothing', async () => {
  const state = setup();
  state.store['payments/ref1'] = { businessId: 'BIZ', plan: 'pro', amountKes: 599, status: 'pending' };
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active' } };

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref1'), { signature: 'deadbeef' }), env);

  assert.equal(res.status, 401);
  assert.equal(state.store['payments/ref1'].status, 'pending');
  assert.equal(state.store['businesses/BIZ'].subscription.plan, 'free');
});

test('a correctly signed pro payment activates Pro for 30 days', async () => {
  const state = setup();
  state.store['payments/ref2'] = { businessId: 'BIZ', plan: 'pro', amountKes: 599, status: 'pending' };
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active' } };

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref2')), env);

  assert.equal(res.status, 200);
  const sub = state.store['businesses/BIZ'].subscription;
  assert.equal(sub.plan, 'pro');
  assert.equal(sub.status, 'active');
  const days = (new Date(sub.expiresAt) - Date.now()) / 86400000;
  assert.ok(days > 29.9 && days < 30.1, `expected ~30 days, got ${days}`);
  assert.equal(state.store['payments/ref2'].status, 'success');
});

test('an amount that does not match what was initialised activates nothing', async () => {
  const state = setup({ verifyAmountKobo: 100 }); // paid KES 1, charged KES 599
  state.store['payments/ref3'] = { businessId: 'BIZ', plan: 'pro', amountKes: 599, status: 'pending' };
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active' } };

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref3')), env);

  assert.equal(res.status, 400);
  assert.equal(state.store['businesses/BIZ'].subscription.plan, 'free');
  assert.equal(state.store['payments/ref3'].status, 'pending');
});

test('a redelivered webhook does not extend the subscription twice', async () => {
  const state = setup();
  state.store['payments/ref4'] = { businessId: 'BIZ', plan: 'pro', amountKes: 599, status: 'pending' };
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active' } };

  await handlePaystackWebhook(webhookRequest(chargeSuccess('ref4')), env);
  const firstExpiry = state.store['businesses/BIZ'].subscription.expiresAt;

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref4')), env);

  assert.equal(res.status, 200);
  assert.equal(String(state.store['businesses/BIZ'].subscription.expiresAt), String(firstExpiry));
});

test('a lifetime payment grants a perpetual licence with no expiry', async () => {
  const state = setup({ verifyAmountKobo: 1555000 });
  state.store['payments/ref5'] = { businessId: 'BIZ', plan: 'lifetime', amountKes: 15550, status: 'pending' };
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active' } };

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref5')), env);

  assert.equal(res.status, 200);
  const sub = state.store['businesses/BIZ'].subscription;
  assert.equal(sub.plan, 'lifetime');
  assert.equal(sub.expiresAt, null);
});

test('A CONFIRMED PRO PAYMENT NEVER DEMOTES A LIFETIME LICENCE', async () => {
  // The sequence this guards: a merchant opens a Pro checkout, abandons
  // it, buys Lifetime instead, then goes back and pays the old Pro tab.
  // /initialize refuses to OPEN that checkout for a lifetime business,
  // but the refusal happens at checkout time and this happens at payment
  // time, so the webhook has to hold the line as well.
  const state = setup();
  state.store['payments/ref6'] = { businessId: 'BIZ', plan: 'pro', amountKes: 599, status: 'pending' };
  state.store['businesses/BIZ'] = { subscription: { plan: 'lifetime', status: 'active', expiresAt: null } };

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref6')), env);

  assert.equal(res.status, 200, 'Paystack is acknowledged, not retried at');
  const sub = state.store['businesses/BIZ'].subscription;
  assert.equal(sub.plan, 'lifetime', 'the perpetual licence survives');
  assert.equal(sub.expiresAt, null, 'and gains no expiry date');
  // The money is real and is still recorded as received.
  assert.equal(state.store['payments/ref6'].status, 'success');
  assert.equal(state.store['payments/ref6'].supersededByLifetime, true);
});

test('a second lifetime payment is still idempotent and still perpetual', async () => {
  const state = setup({ verifyAmountKobo: 1555000 });
  state.store['payments/ref7'] = { businessId: 'BIZ', plan: 'lifetime', amountKes: 15550, status: 'pending' };
  state.store['businesses/BIZ'] = { subscription: { plan: 'lifetime', status: 'active', expiresAt: null } };

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('ref7')), env);

  assert.equal(res.status, 200);
  assert.equal(state.store['businesses/BIZ'].subscription.plan, 'lifetime');
  assert.equal(state.store['businesses/BIZ'].subscription.expiresAt, null);
});

test('a webhook for a payment reference FlowBiz never issued is refused', async () => {
  const state = setup();
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active' } };

  const res = await handlePaystackWebhook(webhookRequest(chargeSuccess('forged-ref')), env);

  assert.equal(res.status, 404);
  assert.equal(state.store['businesses/BIZ'].subscription.plan, 'free');
});
