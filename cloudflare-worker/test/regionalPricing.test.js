// Regional pricing: Kenya keeps its KES prices exactly; every other
// country buys from the international USD book. The book is chosen from
// the business's STORED region on the server, never from the request.

import test from 'node:test';
import assert from 'node:assert/strict';
import { installStub, env as baseEnv, mintIdToken } from './helpers/adminHarness.js';
import { handlePaystackInitialize } from '../src/routes/paystackInitialize.js';
import { handleMpesaCharge } from '../src/routes/mpesaPayments.js';
import { handlePricing } from '../src/routes/proPrice.js';
import { transactionMismatch } from '../src/lib/paymentSettlement.js';
import {
  PRICE_BOOKS, planCharge, pricingRegionForCountry, amountInMinorUnits,
  lifetimeActivationPayload, serviceRenewalPayload,
  LIFETIME_LICENSE_PRICE_KES,
} from '../src/lib/licensing.js';

const env = { ...baseEnv, PAYSTACK_SECRET_KEY: 'sk_test', PAYSTACK_CALLBACK_URL: 'https://app/pro' };

function setup({ country, currencies } = {}) {
  const state = installStub();
  const inner = globalThis.fetch;
  state.paystackCalls = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.paystack.co/transaction/initialize') || String(url).includes('api.paystack.co/charge')) {
      state.paystackCalls.push(JSON.parse(init.body));
      return new Response(JSON.stringify({
        status: true, data: { authorization_url: 'https://pay/x', access_code: 'ac_1', status: 'send_otp' },
      }), { status: 200 });
    }
    return inner(url, init);
  };
  state.store['users/owner1'] = { uid: 'owner1', role: 'owner', active: true, businessId: 'BIZ', email: 'owner@shop.com' };
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active', expiresAt: null } };
  if (country) state.store['businessSettings/BIZ'] = { businessId: 'BIZ', region: { country, currency: 'USD' } };
  state.env = { ...env, ...(currencies ? { PAYSTACK_CURRENCIES: currencies } : {}) };
  return state;
}

const request = (path, body) => new Request(`https://api.test${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintIdToken({ uid: 'owner1', email: 'owner@shop.com' })}` },
  body: JSON.stringify(body),
});

test('the price books: Kenya unchanged, international explicit and in USD', () => {
  assert.deepEqual(PRICE_BOOKS.KE.prices, { pro: 599, lifetime: 15550, annual_services: 3000 });
  assert.equal(PRICE_BOOKS.KE.currency, 'KES');
  assert.equal(PRICE_BOOKS.INTL.currency, 'USD');
  for (const plan of ['pro', 'lifetime', 'annual_services']) {
    const amount = PRICE_BOOKS.INTL.prices[plan];
    assert.ok(Number.isFinite(amount) && amount > 0, plan);
    assert.equal(amountInMinorUnits(amount) / 100, amount, `${plan} is a whole number of cents`);
  }
});

test('only Kenya is on the Kenyan book; no country and garbage are Kenya', () => {
  assert.equal(pricingRegionForCountry('KE'), 'KE');
  assert.equal(pricingRegionForCountry('ke'), 'KE');
  assert.equal(pricingRegionForCountry(undefined), 'KE');
  assert.equal(pricingRegionForCountry('US'), 'INTL');
  assert.equal(pricingRegionForCountry('GB'), 'INTL');
  assert.equal(pricingRegionForCountry('UG'), 'INTL');
});

test('planCharge keeps amountKes only on a KES charge', () => {
  const ke = planCharge('lifetime', 'KE');
  assert.equal(ke.amount, LIFETIME_LICENSE_PRICE_KES);
  assert.equal(ke.amountKes, LIFETIME_LICENSE_PRICE_KES);
  const intl = planCharge('lifetime', 'INTL');
  assert.equal(intl.currency, 'USD');
  assert.equal(intl.amountKes, null, 'a USD charge must never look like shillings');
  assert.equal(planCharge('nope', 'KE'), null);
});

test('/api/pricing: default is the Kenyan shape; country and region select a book', async () => {
  const ke = await (await handlePricing(new Request('https://api.test/api/pricing'))).json();
  assert.equal(ke.currency, 'KES');
  assert.equal(ke.lifetime.amountKes, 15550);
  const us = await (await handlePricing(new Request('https://api.test/api/pricing?country=US'))).json();
  assert.equal(us.currency, 'USD');
  assert.equal(us.lifetime.amount, PRICE_BOOKS.INTL.prices.lifetime);
  assert.equal(us.lifetime.amountKes, undefined);
  const byRegion = await (await handlePricing(new Request('https://api.test/api/pricing?region=INTL'))).json();
  assert.equal(byRegion.region, 'INTL');
  const bogus = await (await handlePricing(new Request('https://api.test/api/pricing?region=FREE'))).json();
  assert.equal(bogus.region, 'KE');
});

test('an existing business with no region still checks out in KES at the Kenyan price', async () => {
  const state = setup();
  const res = await handlePaystackInitialize(request('/api/paystack/initialize', { plan: 'lifetime' }), state.env);
  assert.equal(res.status, 200);
  assert.equal(state.paystackCalls[0].currency, 'KES');
  assert.equal(state.paystackCalls[0].amount, 1555000);
});

test('an international checkout is REFUSED until the Paystack account takes USD', async () => {
  const state = setup({ country: 'US' });
  const res = await handlePaystackInitialize(request('/api/paystack/initialize', { plan: 'lifetime' }), state.env);
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /USD is not available yet/);
  assert.equal(state.paystackCalls.length, 0);
});

test('with USD enabled, a US business is charged the international price in cents, whatever the body says', async () => {
  const state = setup({ country: 'US', currencies: 'KES,USD' });
  const res = await handlePaystackInitialize(request('/api/paystack/initialize', { plan: 'lifetime', currency: 'KES', amount: 1 }), state.env);
  assert.equal(res.status, 200);
  assert.equal(state.paystackCalls[0].currency, 'USD');
  assert.equal(state.paystackCalls[0].amount, amountInMinorUnits(PRICE_BOOKS.INTL.prices.lifetime));
  const payment = Object.entries(state.store).find(([k]) => k.startsWith('payments/'))[1];
  assert.equal(payment.currency, 'USD');
  assert.equal(payment.amount, PRICE_BOOKS.INTL.prices.lifetime);
  assert.equal(payment.amountKes, null);
  assert.equal(payment.provider, 'paystack');
  assert.equal(payment.billingPlatform, 'web');
});

test('M-Pesa is refused for a business outside Kenya', async () => {
  const state = setup({ country: 'GB', currencies: 'KES,USD' });
  const res = await handleMpesaCharge(request('/api/paystack/mpesa/charge', { plan: 'lifetime', phone: '0741104469' }), state.env);
  assert.equal(res.status, 409);
  assert.equal(state.paystackCalls.length, 0);
});

test('settlement checks the recorded currency, not a hard-coded KES', () => {
  const usd = { amount: 119, currency: 'USD', amountKes: null };
  assert.equal(transactionMismatch(usd, 'r1', { reference: 'r1', amount: 11900, currency: 'USD' }), null);
  assert.ok(transactionMismatch(usd, 'r1', { reference: 'r1', amount: 11900, currency: 'KES' }), 'wrong currency');
  assert.ok(transactionMismatch(usd, 'r1', { reference: 'r1', amount: 100, currency: 'USD' }), 'wrong amount');
  // A record from before regional pricing: amountKes only.
  const legacy = { amountKes: 15550 };
  assert.equal(transactionMismatch(legacy, 'r2', { reference: 'r2', amount: 1555000, currency: 'KES' }), null);
  assert.ok(transactionMismatch(legacy, 'r2', { reference: 'r2', amount: 1555000, currency: 'USD' }));
});

test('a USD licence purchase records dollars, and never a fake KES amount', () => {
  const now = new Date('2026-09-27T10:00:00Z');
  const lic = lifetimeActivationPayload({}, { now, reference: 'r', amount: 119, currency: 'USD', amountKes: null });
  assert.equal(lic.licensePurchaseAmount, 119);
  assert.equal(lic.licensePurchaseCurrency, 'USD');
  assert.equal(lic.licensePurchaseAmountKes, null);
  const renewal = serviceRenewalPayload({ licensing: lic }, { now, reference: 'r2', amount: 24, currency: 'USD' });
  assert.equal(renewal.lastServicePaymentAmount, 24);
  assert.equal(renewal.lastServicePaymentAmountKes, null);
  // And the Kenyan path is exactly as before.
  const ke = lifetimeActivationPayload({}, { now, reference: 'r', amountKes: 15550 });
  assert.equal(ke.licensePurchaseAmountKes, 15550);
  assert.equal(ke.licensePurchaseCurrency, 'KES');
});
