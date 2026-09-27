// Google Play Billing: the Worker, not the app, decides what a Play
// purchase grants — and it grants through the same settlement Paystack uses.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { installStub, env as baseEnv, mintIdToken } from './helpers/adminHarness.js';
import { handleGooglePlayVerify, handleGooglePlayRtdn, playReference } from '../src/routes/googlePlayBilling.js';
import { playAccountTag, googlePlayProductForPlan, GOOGLE_PLAY_PRODUCTS, billingProvidersFor } from '../../src/billing/catalog.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PLAY_SA = JSON.stringify({
  client_email: 'play@example.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});
const env = {
  ...baseEnv,
  GOOGLE_PLAY_PACKAGE_NAME: 'com.abcsystems.flowbiz',
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: PLAY_SA,
  GOOGLE_PLAY_RTDN_TOKEN: 'rtdn-secret-123',
};

const TOKEN = 'play-token-abcdefghijklmnop';

async function setup({ purchase, businessId = 'BIZ' } = {}) {
  const state = installStub();
  const inner = globalThis.fetch;
  state.playCalls = [];
  const tag = await playAccountTag(businessId);
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('androidpublisher.googleapis.com')) {
      state.playCalls.push({ url: u, method: init?.method || 'GET' });
      if (u.endsWith(':acknowledge')) return new Response('{}', { status: 200 });
      if (purchase === 404) return new Response('{"error":{}}', { status: 404 });
      return new Response(JSON.stringify({
        purchaseState: 0, acknowledgementState: 0, orderId: 'GPA.1234-5678',
        obfuscatedExternalAccountId: tag, regionCode: 'US', ...(purchase || {}),
      }), { status: 200 });
    }
    return inner(url, init);
  };
  state.store['users/owner1'] = { uid: 'owner1', role: 'owner', active: true, businessId: 'BIZ', email: 'o@shop.com' };
  state.store['users/owner2'] = { uid: 'owner2', role: 'owner', active: true, businessId: 'OTHER', email: 'o2@shop.com' };
  state.store['businesses/BIZ'] = { subscription: { plan: 'free', status: 'active', expiresAt: null } };
  state.store['businesses/OTHER'] = { subscription: { plan: 'free', status: 'active', expiresAt: null } };
  return state;
}

const verify = (body, uid = 'owner1') => new Request('https://api.test/api/billing/google-play/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintIdToken({ uid, email: `${uid}@shop.com` })}` },
  body: JSON.stringify(body),
});

test('the catalogue maps each plan to exactly one Play product', () => {
  const plans = Object.values(GOOGLE_PLAY_PRODUCTS).map((p) => p.plan).sort();
  assert.deepEqual(plans, ['annual_services', 'lifetime', 'pro']);
  assert.equal(GOOGLE_PLAY_PRODUCTS[googlePlayProductForPlan('lifetime')].type, 'non_consumable');
  assert.equal(GOOGLE_PLAY_PRODUCTS[googlePlayProductForPlan('pro')].type, 'consumable');
});

test('Android always uses Play Billing; the web keeps Paystack and M-Pesa', () => {
  assert.equal(billingProvidersFor({ platform: 'android', pricingRegion: 'KE' }).primary, 'google_play');
  assert.deepEqual(billingProvidersFor({ platform: 'android', pricingRegion: 'KE' }).alternatives, []);
  assert.equal(billingProvidersFor({ platform: 'web', pricingRegion: 'KE' }).primary, 'mpesa');
  assert.equal(billingProvidersFor({ platform: 'web', pricingRegion: 'INTL' }).primary, 'paystack');
  assert.equal(billingProvidersFor({ platform: 'ios', pricingRegion: 'INTL' }), null);
});

test('the account tag is a 64-character hash, stable, and different per business', async () => {
  const a = await playAccountTag('BIZ');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, await playAccountTag('BIZ'));
  assert.notEqual(a, await playAccountTag('OTHER'));
});

test('not configured: refused cleanly, nothing called', async () => {
  const state = await setup();
  const res = await handleGooglePlayVerify(verify({ productId: 'flowbiz_lifetime_licence', purchaseToken: TOKEN }), baseEnv);
  assert.equal(res.status, 503);
  assert.equal(state.playCalls.length, 0);
});

test('A VERIFIED LIFETIME PURCHASE GRANTS THE LICENCE THROUGH THE SHARED SETTLEMENT, and is acknowledged', async () => {
  const state = await setup();
  const res = await handleGooglePlayVerify(verify({ productId: 'flowbiz_lifetime_licence', purchaseToken: TOKEN }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'success');
  assert.equal(body.consumable, false);
  const biz = state.store['businesses/BIZ'];
  assert.equal(biz.licensing.licenseType, 'lifetime');
  assert.equal(biz.subscription.plan, 'lifetime');
  assert.equal(biz.billing.provider, 'google_play');
  assert.equal(biz.billing.platform, 'android');
  assert.equal(biz.billing.productId, 'flowbiz_lifetime_licence');
  // Unpriced: never a guessed KES figure.
  assert.equal(biz.licensing.licensePurchaseAmountKes, null);
  assert.equal(biz.licensing.licensePurchaseCurrency, null);
  const payment = state.store[`payments/${await playReference(TOKEN)}`];
  assert.equal(payment.status, 'success');
  assert.equal(payment.provider, 'google_play');
  assert.ok(!JSON.stringify(payment).includes(TOKEN), 'the raw purchase token is never stored');
  assert.ok(state.playCalls.some((c) => c.url.endsWith(':acknowledge') && c.method === 'POST'));
});

test('a Pro pass extends by 30 days, and verifying it twice grants it once', async () => {
  const state = await setup();
  await handleGooglePlayVerify(verify({ productId: 'flowbiz_pro_30_days', purchaseToken: TOKEN }), env);
  const first = new Date(state.store['businesses/BIZ'].subscription.expiresAt).getTime();
  const again = await handleGooglePlayVerify(verify({ productId: 'flowbiz_pro_30_days', purchaseToken: TOKEN }), env);
  assert.equal((await again.json()).already, true);
  assert.equal(new Date(state.store['businesses/BIZ'].subscription.expiresAt).getTime(), first, 'no double grant');
  assert.ok(first > Date.now() + 29 * 86400000);
});

test('a pending purchase grants nothing yet', async () => {
  const state = await setup({ purchase: { purchaseState: 2 } });
  const res = await handleGooglePlayVerify(verify({ productId: 'flowbiz_lifetime_licence', purchaseToken: TOKEN }), env);
  assert.equal(res.status, 202);
  assert.equal(state.store['businesses/BIZ'].licensing, undefined);
});

test('a cancelled purchase grants nothing', async () => {
  const state = await setup({ purchase: { purchaseState: 1 } });
  const res = await handleGooglePlayVerify(verify({ productId: 'flowbiz_lifetime_licence', purchaseToken: TOKEN }), env);
  assert.equal(res.status, 409);
  assert.equal(state.store['businesses/BIZ'].licensing, undefined);
});

test('A TOKEN BOUGHT FOR ONE BUSINESS CANNOT UNLOCK ANOTHER', async () => {
  const state = await setup({ businessId: 'BIZ' });
  const res = await handleGooglePlayVerify(verify({ productId: 'flowbiz_lifetime_licence', purchaseToken: TOKEN }, 'owner2'), env);
  assert.equal(res.status, 403);
  assert.equal(state.store['businesses/OTHER'].licensing, undefined);
});

test('...and once settled for one business, it is refused for the other without asking Google', async () => {
  const state = await setup({ businessId: 'BIZ' });
  await handleGooglePlayVerify(verify({ productId: 'flowbiz_lifetime_licence', purchaseToken: TOKEN }), env);
  const calls = state.playCalls.length;
  const res = await handleGooglePlayVerify(verify({ productId: 'flowbiz_lifetime_licence', purchaseToken: TOKEN }, 'owner2'), env);
  assert.equal(res.status, 403);
  assert.equal(state.playCalls.length, calls);
});

test('unknown products and malformed tokens are refused', async () => {
  await setup();
  assert.equal((await handleGooglePlayVerify(verify({ productId: 'free_money', purchaseToken: TOKEN }), env)).status, 400);
  assert.equal((await handleGooglePlayVerify(verify({ productId: 'flowbiz_pro_30_days', purchaseToken: 'x' }), env)).status, 400);
  assert.equal((await handleGooglePlayVerify(verify({ productId: 'flowbiz_pro_30_days', purchaseToken: 'bad token with spaces' }), env)).status, 400);
});

test('a token Google does not recognise grants nothing', async () => {
  const state = await setup({ purchase: 404 });
  const res = await handleGooglePlayVerify(verify({ productId: 'flowbiz_lifetime_licence', purchaseToken: TOKEN }), env);
  assert.equal(res.status, 400);
  assert.equal(state.store['businesses/BIZ'].licensing, undefined);
});

test('a cashier cannot buy', async () => {
  const state = await setup();
  state.store['users/cash1'] = { uid: 'cash1', role: 'cashier', active: true, businessId: 'BIZ' };
  const res = await handleGooglePlayVerify(verify({ productId: 'flowbiz_pro_30_days', purchaseToken: TOKEN }, 'cash1'), env);
  assert.equal(res.status, 403);
});

const rtdn = (note, token = 'rtdn-secret-123') => {
  const url = new URL(`https://api.test/api/billing/google-play/rtdn?token=${token}`);
  return [new Request(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { data: btoa(JSON.stringify(note)) } }),
  }), url];
};

test('RTDN: a wrong or missing token is refused', async () => {
  await setup();
  const [req, url] = rtdn({ packageName: 'com.abcsystems.flowbiz' }, 'wrong');
  assert.equal((await handleGooglePlayRtdn(req, env, url)).status, 403);
  const [req2, url2] = rtdn({ packageName: 'com.abcsystems.flowbiz' });
  assert.equal((await handleGooglePlayRtdn(req2, { ...env, GOOGLE_PLAY_RTDN_TOKEN: '' }, url2)).status, 403);
});

test('RTDN: a refund flags the payment for review and revokes nothing automatically', async () => {
  const state = await setup();
  await handleGooglePlayVerify(verify({ productId: 'flowbiz_lifetime_licence', purchaseToken: TOKEN }), env);
  const [req, url] = rtdn({ packageName: 'com.abcsystems.flowbiz', voidedPurchaseNotification: { purchaseToken: TOKEN, refundType: 1 } });
  const res = await handleGooglePlayRtdn(req, env, url);
  assert.equal((await res.json()).voided, true);
  const payment = state.store[`payments/${await playReference(TOKEN)}`];
  assert.equal(payment.voided, true);
  assert.equal(state.store['businesses/BIZ'].licensing.licenseStatus, 'active', 'revocation is an audited admin action, never a side effect');
});

test('RTDN: another package and garbage are acknowledged and ignored', async () => {
  await setup();
  const [req, url] = rtdn({ packageName: 'com.someone.else', voidedPurchaseNotification: { purchaseToken: TOKEN } });
  assert.equal((await (await handleGooglePlayRtdn(req, env, url)).json()).ignored, true);
});
