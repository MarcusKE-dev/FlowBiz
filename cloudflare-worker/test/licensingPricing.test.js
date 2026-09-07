// Pricing is decided on the server, and only on the server.
//
// The browser sends a plan name. If it could send an amount — or if the
// Worker ever read one out of a request body — a customer could buy a
// perpetual licence for one shilling. These tests hold that line, and
// hold the two published prices to the numbers FlowBiz actually sells at.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installStub, env as baseEnv, mintIdToken } from './helpers/adminHarness.js';
import { handlePaystackInitialize } from '../src/routes/paystackInitialize.js';
import { handlePricing, handleProPrice } from '../src/routes/proPrice.js';
import {
  PLAN_PRICES,
  isPurchasablePlan,
  LIFETIME_LICENSE_PRICE_KES,
  ANNUAL_SERVICE_PRICE_KES,
  PRO_PLAN_PRICE_KES,
  GRACE_PERIOD_DAYS,
  INCLUDED_SERVICE_MONTHS,
} from '../src/lib/licensing.js';

const env = { ...baseEnv, PAYSTACK_SECRET_KEY: 'sk_test', PAYSTACK_CALLBACK_URL: 'https://app/pro' };

function setup() {
  const state = installStub();
  const inner = globalThis.fetch;
  state.paystackCalls = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.paystack.co/transaction/initialize')) {
      state.paystackCalls.push(JSON.parse(init.body));
      return new Response(JSON.stringify({
        status: true, data: { authorization_url: 'https://pay/x', access_code: 'ac_1' },
      }), { status: 200 });
    }
    return inner(url, init);
  };
  return state;
}

function ownerRequest(body) {
  return new Request('https://api.test/api/paystack/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mintIdToken({ uid: 'owner1', email: 'owner@shop.co.ke' })}`,
    },
    body: JSON.stringify(body),
  });
}

function owner(state, { licensing = undefined, plan = 'free' } = {}) {
  state.store['users/owner1'] = { uid: 'owner1', role: 'owner', active: true, businessId: 'BIZ', email: 'owner@shop.co.ke' };
  state.store['businesses/BIZ'] = {
    subscription: { plan, status: 'active', expiresAt: null },
    ...(licensing ? { licensing } : {}),
  };
}

const ACTIVE_LICENCE = {
  licenseType: 'lifetime',
  licenseStatus: 'active',
  serviceStartDate: new Date(Date.now() - 300 * 86400000),
  serviceExpiryDate: new Date(Date.now() + 65 * 86400000),
  graceDays: GRACE_PERIOD_DAYS,
};

test('the two published prices are KES 15,550 and KES 3,000', () => {
  assert.equal(LIFETIME_LICENSE_PRICE_KES, 15550);
  assert.equal(ANNUAL_SERVICE_PRICE_KES, 3000);
  assert.equal(PLAN_PRICES.lifetime.amountKes, 15550);
  assert.equal(PLAN_PRICES.annual_services.amountKes, 3000);
  assert.equal(PLAN_PRICES.lifetime.periodDays, null, 'a licence has no period');
  assert.equal(PLAN_PRICES.annual_services.periodMonths, 12);
  assert.equal(INCLUDED_SERVICE_MONTHS, 12);
});

test('/api/pricing publishes the licence and the annual service separately', async () => {
  const body = await (await handlePricing()).json();
  assert.equal(body.currency, 'KES');
  assert.equal(body.lifetime.amountKes, LIFETIME_LICENSE_PRICE_KES);
  assert.equal(body.lifetime.periodDays, null);
  assert.equal(body.lifetime.includedServiceMonths, 12);
  assert.equal(body.annualServices.amountKes, ANNUAL_SERVICE_PRICE_KES);
  assert.equal(body.annualServices.gracePeriodDays, GRACE_PERIOD_DAYS);
  assert.ok(Array.isArray(body.annualServices.includes) && body.annualServices.includes.length > 0);
  // The old monthly-only shape still answers, for anything still on it.
  assert.equal((await (await handleProPrice()).json()).amountKes, PRO_PLAN_PRICE_KES);
});

test('THE BROWSER CANNOT NAME ITS OWN PRICE', async () => {
  const state = setup();
  owner(state);

  await handlePaystackInitialize(ownerRequest({
    plan: 'lifetime', amountKes: 1, amount: 100, price: 1, currency: 'USD',
  }), env);

  assert.equal(state.paystackCalls.length, 1);
  assert.equal(state.paystackCalls[0].amount, LIFETIME_LICENSE_PRICE_KES * 100,
    'the server prices the plan, whatever the body says');
  assert.equal(state.paystackCalls[0].currency, 'KES');
  // And the pending record the webhook checks against carries the server's number.
  const payment = Object.entries(state.store).find(([k]) => k.startsWith('payments/'))[1];
  assert.equal(payment.amountKes, LIFETIME_LICENSE_PRICE_KES);
  assert.equal(payment.status, 'pending');
});

test('a renewal checkout is priced at the annual fee and labelled as a service', async () => {
  const state = setup();
  owner(state, { licensing: ACTIVE_LICENCE, plan: 'lifetime' });

  const res = await handlePaystackInitialize(ownerRequest({ plan: 'annual_services' }), env);
  assert.equal(res.status, 200);
  assert.equal(state.paystackCalls[0].amount, ANNUAL_SERVICE_PRICE_KES * 100);

  const payment = Object.entries(state.store).find(([k]) => k.startsWith('payments/'))[1];
  assert.equal(payment.plan, 'annual_services');
  assert.equal(payment.kind, 'service_renewal');
  assert.match(payment.description, /Cloud Services/);
});

test('a business with no licence cannot buy an annual services renewal', async () => {
  const state = setup();
  owner(state);

  const res = await handlePaystackInitialize(ownerRequest({ plan: 'annual_services' }), env);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Lifetime Licence/);
  assert.equal(state.paystackCalls.length, 0, 'no checkout is opened');
});

test('a business that already owns a licence cannot buy a second one', async () => {
  const state = setup();
  owner(state, { licensing: ACTIVE_LICENCE, plan: 'lifetime' });

  const res = await handlePaystackInitialize(ownerRequest({ plan: 'lifetime' }), env);
  assert.equal(res.status, 400);
  assert.equal(state.paystackCalls.length, 0);
});

test('a revoked licence cannot renew its services', async () => {
  const state = setup();
  owner(state, { licensing: { ...ACTIVE_LICENCE, licenseStatus: 'revoked' }, plan: 'lifetime' });

  const res = await handlePaystackInitialize(ownerRequest({ plan: 'annual_services' }), env);
  assert.equal(res.status, 403);
  assert.equal(state.paystackCalls.length, 0);
});

test('an unknown plan name falls back to Pro rather than to a free licence', async () => {
  const state = setup();
  owner(state);

  for (const plan of ['LIFETIME', 'free', '__proto__', '', null, 42, { plan: 'lifetime' }]) {
    assert.equal(isPurchasablePlan(plan), false, `${JSON.stringify(plan)} must not be purchasable`);
  }

  await handlePaystackInitialize(ownerRequest({ plan: 'gimme_everything' }), env);
  assert.equal(state.paystackCalls[0].amount, PRO_PLAN_PRICE_KES * 100);
});

test('a cashier cannot open any checkout', async () => {
  const state = setup();
  owner(state);
  state.store['users/owner1'].role = 'cashier';

  const res = await handlePaystackInitialize(ownerRequest({ plan: 'lifetime' }), env);
  assert.equal(res.status, 403);
  assert.equal(state.paystackCalls.length, 0);
});

test('NO PRICE IS WRITTEN DOWN IN THE WORKER OUTSIDE THE LICENSING LIB', () => {
  // Same rule as the browser side, enforced separately, because the
  // Worker is the one that actually charges the card.
  const files = [
    'src/routes/paystackInitialize.js',
    'src/routes/paystackWebhook.js',
    'src/routes/proPrice.js',
    'src/routes/admin/adminLicensing.js',
    'src/routes/licensingReminders.js',
    'src/lib/emailTemplates.js',
  ];
  const offenders = [];
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const line of source.split('\n')) {
      const code = line.replace(/\/\/.*$/, '');
      if (/\b15[,.]?550\b/.test(code) || /\b3,000\b/.test(code)) {
        offenders.push(`${file}: ${line.trim().slice(0, 80)}`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'import the price from lib/licensing.js');
});
