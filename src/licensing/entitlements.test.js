// src/licensing/entitlements.test.js
//
// The commercial model, asserted rather than described.
//
// Everything in this file is a rule somebody could lose money or lose
// software over, so each test is named as the promise it protects rather
// than as the function it calls. If one of these fails, a customer is
// being treated worse (or better) than what FlowBiz sold them.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveEntitlements,
  computeIncludedServicePeriod,
  computeRenewedExpiry,
  lastCoveredDay,
  reminderStageFor,
  noticeLevelFor,
  addMonths,
  daysUntil,
  toDate,
  SERVICE_STATUS,
  CLOUD_STATUS,
  LICENSE_STATUS,
  ENTITLEMENTS,
} from './entitlements.js';
import {
  LIFETIME_LICENSE_PRICE_KES,
  ANNUAL_SERVICE_PRICE_KES,
  INCLUDED_SERVICE_MONTHS,
  GRACE_PERIOD_DAYS,
  RENEWAL_REMINDER_DAYS,
  formatPrice,
} from './config.js';

// The worked example from the commercial brief, used throughout so the
// arithmetic is checked against a case a human agreed to in words.
const PURCHASE = new Date('2026-09-07T09:00:00Z');
const { serviceStartDate: START, serviceExpiryDate: FIRST_EXPIRY } = computeIncludedServicePeriod(PURCHASE);

/** A business document as the Worker would have written it after a purchase. */
function lifetimeBusiness(overrides = {}) {
  return {
    subscription: { plan: 'lifetime', status: 'active', expiresAt: null, purchasedAt: PURCHASE },
    licensing: {
      licenseType: 'lifetime',
      licenseStatus: 'active',
      licensePurchasedAt: PURCHASE,
      serviceStartDate: START,
      serviceExpiryDate: FIRST_EXPIRY,
      graceDays: GRACE_PERIOD_DAYS,
      renewalCount: 0,
      cloudSuspended: false,
      ...overrides,
    },
  };
}

// ── 1-3. What a purchase creates ──────────────────────────────────────

test('a lifetime purchase creates a permanent licence, not a subscription', () => {
  const e = resolveEntitlements(lifetimeBusiness(), PURCHASE);
  assert.equal(e.license.owned, true);
  assert.equal(e.license.type, 'lifetime');
  assert.equal(e.license.status, LICENSE_STATUS.ACTIVE);
  assert.equal(e.plan, 'lifetime');
});

test('THE LICENCE HAS NO EXPIRY, and nothing can give it one', () => {
  // Not at purchase, not a decade later, not after the service period has
  // lapsed, not while suspended.
  const cases = [
    ['at purchase', lifetimeBusiness(), PURCHASE],
    ['ten years later', lifetimeBusiness(), new Date('2036-09-07T09:00:00Z')],
    ['services long expired', lifetimeBusiness(), new Date('2030-01-01T00:00:00Z')],
    ['cloud suspended', lifetimeBusiness({ cloudSuspended: true }), new Date('2027-01-01T00:00:00Z')],
  ];
  for (const [label, business, now] of cases) {
    const e = resolveEntitlements(business, now);
    assert.equal(e.license.expiresAt, null, `${label}: a perpetual licence must have no expiry`);
    assert.equal(e.license.owned, true, `${label}: the licence must still be owned`);
  }
});

test('the purchase includes exactly 12 months of annual services', () => {
  assert.equal(INCLUDED_SERVICE_MONTHS, 12);
  const e = resolveEntitlements(lifetimeBusiness(), PURCHASE);
  assert.equal(e.service.status, SERVICE_STATUS.ACTIVE);
  assert.equal(e.service.startDate.toISOString(), PURCHASE.toISOString());
  assert.equal(e.service.expiryDate.toISOString(), '2027-09-07T09:00:00.000Z');
});

// ── 4. Expiry arithmetic ──────────────────────────────────────────────

test('the service period runs 7 September 2026 to 6 September 2027, as sold', () => {
  // The stored expiry is the EXCLUSIVE instant; the last day the customer
  // is covered for is the day before it, and that is what the UI shows.
  assert.equal(FIRST_EXPIRY.toISOString(), '2027-09-07T09:00:00.000Z');
  assert.equal(lastCoveredDay(FIRST_EXPIRY).toISOString(), '2027-09-06T09:00:00.000Z');
});

test('calendar months, not 30-day blocks, and month ends clamp rather than roll over', () => {
  assert.equal(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString(), '2026-02-28T00:00:00.000Z');
  assert.equal(addMonths(new Date('2024-02-29T00:00:00Z'), 12).toISOString(), '2025-02-28T00:00:00.000Z');
  assert.equal(addMonths(new Date('2026-03-31T00:00:00Z'), 12).toISOString(), '2027-03-31T00:00:00.000Z');
});

test('status moves active → grace → expired at exactly the right instants', () => {
  const business = lifetimeBusiness();
  const graceEnd = new Date(FIRST_EXPIRY.getTime() + GRACE_PERIOD_DAYS * 86400000);

  const oneSecond = 1000;
  const at = (d) => resolveEntitlements(business, d);

  assert.equal(at(new Date(FIRST_EXPIRY.getTime() - oneSecond)).service.status, SERVICE_STATUS.ACTIVE);
  assert.equal(at(FIRST_EXPIRY).service.status, SERVICE_STATUS.GRACE);
  assert.equal(at(new Date(graceEnd.getTime() - oneSecond)).service.status, SERVICE_STATUS.GRACE);
  assert.equal(at(graceEnd).service.status, SERVICE_STATUS.EXPIRED);
});

// ── 5. Reminder staging ───────────────────────────────────────────────

test('the renewal notice appears at 30 days and not before', () => {
  const business = lifetimeBusiness();
  const daysBefore = (n) => new Date(FIRST_EXPIRY.getTime() - n * 86400000);

  assert.equal(resolveEntitlements(business, daysBefore(31)).renewal.stage, null,
    '31 days out is silence');
  assert.equal(resolveEntitlements(business, daysBefore(30)).renewal.stage, 30,
    'exactly 30 days out is the 30-day stage');
  assert.equal(resolveEntitlements(business, daysBefore(15)).renewal.stage, 30,
    '15 days out is still the 30-day stage');
  assert.equal(resolveEntitlements(business, daysBefore(14)).renewal.stage, 14);
  assert.equal(resolveEntitlements(business, daysBefore(7)).renewal.stage, 7);
  assert.equal(resolveEntitlements(business, daysBefore(3)).renewal.stage, 3);
  assert.equal(resolveEntitlements(business, daysBefore(1)).renewal.stage, 1);
});

test('every configured reminder stage is reachable, and expiry has its own', () => {
  for (const threshold of RENEWAL_REMINDER_DAYS) {
    assert.equal(reminderStageFor(threshold), threshold);
  }
  assert.equal(reminderStageFor(0), 'expired');
  assert.equal(reminderStageFor(-40), 'expired');
  assert.equal(reminderStageFor(400), null);
  assert.equal(noticeLevelFor(30), 'info');
  assert.equal(noticeLevelFor(7), 'warning');
  assert.equal(noticeLevelFor(1), 'urgent');
  assert.equal(noticeLevelFor('expired'), 'expired');
  assert.equal(noticeLevelFor(null), 'none');
});

// ── 6-7. Renewal, and the early-renewal promise ───────────────────────

test('THE WORKED EXAMPLE: paying on 20 August 2027 extends to 7 September 2028', () => {
  // Bought 7 Sep 2026. Covered to 6 Sep 2027. Renewed early, on 20 Aug
  // 2027. The new cover must run to 6 Sep 2028, NOT to 19 Aug 2028.
  const renewed = computeRenewedExpiry(FIRST_EXPIRY, new Date('2027-08-20T00:00:00Z'));
  assert.equal(renewed.toISOString(), '2028-09-07T09:00:00.000Z');
  assert.equal(lastCoveredDay(renewed).toISOString(), '2028-09-06T09:00:00.000Z');
});

test('EARLY RENEWAL NEVER SHORTENS OR RESETS THE PERIOD', () => {
  // Renew on every single day of the period and check the customer never
  // ends up with less than a full extra year on top of what they had.
  for (let dayOffset = 1; dayOffset < 365; dayOffset += 7) {
    const payDay = new Date(START.getTime() + dayOffset * 86400000);
    const renewed = computeRenewedExpiry(FIRST_EXPIRY, payDay);
    assert.ok(
      renewed.getTime() > FIRST_EXPIRY.getTime(),
      `renewing on day ${dayOffset} must extend, never shorten`,
    );
    assert.equal(
      renewed.toISOString(), '2028-09-07T09:00:00.000Z',
      `renewing on day ${dayOffset} must land on the same extended expiry`,
    );
  }
});

test('a renewal after the period has run out starts from the payment date', () => {
  // You cannot extend a window that closed, and back-dating one would
  // sell somebody time in the past.
  const late = new Date('2027-11-20T00:00:00Z');
  const renewed = computeRenewedExpiry(FIRST_EXPIRY, late);
  assert.equal(renewed.toISOString(), '2028-11-20T00:00:00.000Z');
});

test('renewing during the grace period still extends from the original expiry', () => {
  // The grace period is a courtesy, not a second service period. A
  // customer who renews four days late is paying for the year that
  // started when the last one ended.
  const inGrace = new Date(FIRST_EXPIRY.getTime() + 4 * 86400000);
  const renewed = computeRenewedExpiry(FIRST_EXPIRY, inGrace);
  // Past the expiry instant, so the base is `now` — the customer is not
  // charged for the four days they had for free.
  assert.ok(renewed.getTime() > FIRST_EXPIRY.getTime());
  assert.equal(renewed.toISOString(), addMonths(inGrace, 12).toISOString());
});

// ── 9-11. What expiry and suspension must NEVER do ────────────────────

test('EXPIRED ANNUAL SERVICES DO NOT REVOKE THE LIFETIME LICENCE', () => {
  const wellPastGrace = new Date('2029-01-01T00:00:00Z');
  const e = resolveEntitlements(lifetimeBusiness(), wellPastGrace);

  assert.equal(e.service.status, SERVICE_STATUS.EXPIRED);
  assert.equal(e.license.owned, true, 'the licence survives');
  assert.equal(e.license.status, LICENSE_STATUS.ACTIVE);
  assert.equal(e.license.revokedAt, null);
  assert.equal(e.localApplicationAvailable, true, 'the software still runs');
});

test('EXPIRED ANNUAL SERVICES DO NOT WITHDRAW LICENSED FEATURES', () => {
  // Advanced analytics and inventory intelligence were bought with the
  // licence. A lapsed maintenance entitlement does not take back software
  // somebody already owns.
  const e = resolveEntitlements(lifetimeBusiness(), new Date('2029-01-01T00:00:00Z'));
  assert.equal(e.can(ENTITLEMENTS.PRO_FEATURES), true);
  assert.equal(e.isPro, true);
});

test('expiry withdraws hosted services, and only hosted services', () => {
  const e = resolveEntitlements(lifetimeBusiness(), new Date('2029-01-01T00:00:00Z'));

  // Withdrawn.
  for (const key of [
    ENTITLEMENTS.CLOUD_ACCESS, ENTITLEMENTS.CLOUD_SYNC, ENTITLEMENTS.CLOUD_STORAGE,
    ENTITLEMENTS.CLOUD_BACKUP, ENTITLEMENTS.CLOUD_DOCUMENTS,
    ENTITLEMENTS.MAINTENANCE, ENTITLEMENTS.UPDATES, ENTITLEMENTS.SUPPORT,
  ]) {
    assert.equal(e.can(key), false, `${key} must lapse with the service period`);
  }

  // Kept.
  assert.equal(e.can(ENTITLEMENTS.SOFTWARE_LICENSE), true);
  assert.equal(e.can(ENTITLEMENTS.PRO_FEATURES), true);
});

test('services stay fully available throughout the grace period', () => {
  const inGrace = new Date(FIRST_EXPIRY.getTime() + 10 * 86400000);
  const e = resolveEntitlements(lifetimeBusiness(), inGrace);

  assert.equal(e.service.status, SERVICE_STATUS.GRACE);
  assert.equal(e.service.inGracePeriod, true);
  assert.equal(e.cloud.status, CLOUD_STATUS.GRACE);
  assert.equal(e.can(ENTITLEMENTS.CLOUD_SYNC), true, 'a grace period is a courtesy, not a cut-off');
  assert.equal(e.can(ENTITLEMENTS.CLOUD_STORAGE), true);
  assert.equal(e.service.daysRemainingInGrace, GRACE_PERIOD_DAYS - 10);
});

test('a configurable grace period is honoured per business', () => {
  const generous = lifetimeBusiness({ graceDays: 90 });
  const at = new Date(FIRST_EXPIRY.getTime() + 60 * 86400000);
  assert.equal(resolveEntitlements(generous, at).service.status, SERVICE_STATUS.GRACE);
  assert.equal(resolveEntitlements(lifetimeBusiness(), at).service.status, SERVICE_STATUS.EXPIRED);
});

test('ADMINISTRATIVE CLOUD SUSPENSION IS NOT LICENCE REVOCATION', () => {
  const suspended = lifetimeBusiness({
    cloudSuspended: true,
    cloudSuspendedBy: 'ops@flowbiz.co.ke',
    cloudSuspendedReason: 'Chargeback under investigation',
  });
  // Mid-service-period: the paid entitlement is still running, and the
  // suspension is the only thing switching anything off.
  const e = resolveEntitlements(suspended, PURCHASE);

  assert.equal(e.license.owned, true, 'the licence is untouched');
  assert.equal(e.license.status, LICENSE_STATUS.ACTIVE);
  assert.equal(e.service.status, SERVICE_STATUS.ACTIVE, 'the paid period is untouched');
  assert.equal(e.cloud.status, CLOUD_STATUS.SUSPENDED_BY_ADMIN);
  assert.equal(e.can(ENTITLEMENTS.CLOUD_SYNC), false);
  assert.equal(e.can(ENTITLEMENTS.CLOUD_STORAGE), false);
  assert.equal(e.can(ENTITLEMENTS.PRO_FEATURES), true, 'licensed features survive a suspension');
  assert.equal(e.localApplicationAvailable, true);
  assert.equal(e.cloud.suspendedReason, 'Chargeback under investigation');
});

test('the state the brief asks for is representable, exactly', () => {
  // License ACTIVE / Annual services EXPIRED / Local app AVAILABLE /
  // Sync SUSPENDED / Storage SUSPENDED / Updates and support NOT AVAILABLE.
  const e = resolveEntitlements(lifetimeBusiness(), new Date('2029-01-01T00:00:00Z'));
  assert.deepEqual(
    {
      license: e.license.status,
      annualServices: e.service.status,
      localApplication: e.localApplicationAvailable,
      sync: e.can(ENTITLEMENTS.CLOUD_SYNC),
      storage: e.can(ENTITLEMENTS.CLOUD_STORAGE),
      updates: e.can(ENTITLEMENTS.UPDATES),
      support: e.can(ENTITLEMENTS.SUPPORT),
    },
    {
      license: 'active',
      annualServices: 'expired',
      localApplication: true,
      sync: false,
      storage: false,
      updates: false,
      support: false,
    },
  );
});

test('an explicitly revoked licence is the ONLY way to stop owning one', () => {
  const revoked = lifetimeBusiness({
    licenseStatus: 'revoked',
    licenseRevokedAt: new Date('2027-02-01T00:00:00Z'),
    licenseRevokedReason: 'Fraudulent payment, ticket 991',
  });
  const e = resolveEntitlements(revoked, new Date('2027-03-01T00:00:00Z'));
  assert.equal(e.license.owned, false);
  assert.equal(e.license.status, LICENSE_STATUS.REVOKED);
  assert.equal(e.license.revokedReason, 'Fraudulent payment, ticket 991');
  // And it is not something an expiry can reach: the revocation had to be
  // written into the document by an administrator.
  assert.equal(resolveEntitlements(lifetimeBusiness(), new Date('2040-01-01T00:00:00Z')).license.owned, true);
});

// ── 16. Existing customers must not be disturbed ──────────────────────

test('AN EXISTING MONTHLY PRO SUBSCRIBER IS COMPLETELY UNAFFECTED', () => {
  const future = new Date('2026-10-07T00:00:00Z');
  const pro = { subscription: { plan: 'pro', status: 'active', expiresAt: future } };
  const e = resolveEntitlements(pro, PURCHASE);

  assert.equal(e.plan, 'pro');
  assert.equal(e.isPro, true);
  assert.equal(e.isProSubscriber, true);
  assert.equal(e.license.owned, false);
  // No annual service model applies, so nothing can expire and nothing
  // can nag them.
  assert.equal(e.service.status, SERVICE_STATUS.NOT_APPLICABLE);
  assert.equal(e.renewal.stage, null);
  assert.equal(e.cloud.entitled, true);
  assert.equal(e.can(ENTITLEMENTS.CLOUD_SYNC), true);
});

test('an expired Pro subscription drops to free, exactly as it always did', () => {
  const pro = { subscription: { plan: 'pro', status: 'active', expiresAt: new Date('2026-08-01T00:00:00Z') } };
  const e = resolveEntitlements(pro, PURCHASE);
  assert.equal(e.plan, 'free');
  assert.equal(e.isPro, false);
  // But its cloud access is untouched — a free business is still hosted.
  assert.equal(e.can(ENTITLEMENTS.CLOUD_SYNC), true);
});

test('a free business is hosted and is never shown a renewal notice', () => {
  const free = { subscription: { plan: 'free', status: 'active', expiresAt: null } };
  const e = resolveEntitlements(free, PURCHASE);
  assert.equal(e.plan, 'free');
  assert.equal(e.service.status, SERVICE_STATUS.NOT_APPLICABLE);
  assert.equal(e.renewal.dueSoon, false);
  assert.equal(e.cloud.entitled, true);
  assert.equal(e.can(ENTITLEMENTS.CLOUD_STORAGE), true);
});

// ── 17. Existing lifetime customers ───────────────────────────────────

test('A LIFETIME LICENCE SOLD BEFORE THIS MODEL IS FULLY ENTITLED, INDEFINITELY', () => {
  // The only record such a customer has is the old subscription map.
  // They were never told about an annual fee, so nothing may expire for
  // them until an administrator migrates them deliberately.
  const legacy = { subscription: { plan: 'lifetime', status: 'active', expiresAt: null, purchasedAt: new Date('2025-01-01T00:00:00Z') } };

  for (const now of [new Date('2025-06-01'), new Date('2027-01-01'), new Date('2035-01-01')]) {
    const e = resolveEntitlements(legacy, now);
    assert.equal(e.license.owned, true);
    assert.equal(e.service.status, SERVICE_STATUS.GRANDFATHERED);
    assert.equal(e.needsServiceMigration, true, 'the console must be able to see it needs migrating');
    assert.equal(e.cloud.entitled, true, 'nothing lapses for them by default');
    assert.equal(e.can(ENTITLEMENTS.UPDATES), true);
    assert.equal(e.renewal.stage, null, 'and they are never nagged');
  }
});

test('a grandfathered licence can still be suspended by an administrator', () => {
  const legacy = {
    subscription: { plan: 'lifetime', status: 'active', expiresAt: null },
    licensing: { cloudSuspended: true },
  };
  const e = resolveEntitlements(legacy, PURCHASE);
  assert.equal(e.license.owned, true);
  assert.equal(e.cloud.entitled, false);
  assert.equal(e.cloud.status, CLOUD_STATUS.SUSPENDED_BY_ADMIN);
});

// ── 18. Pricing ───────────────────────────────────────────────────────

test('the prices are KES 15,550 and KES 3,000, and they are formatted once', () => {
  assert.equal(LIFETIME_LICENSE_PRICE_KES, 15550);
  assert.equal(ANNUAL_SERVICE_PRICE_KES, 3000);
  assert.equal(formatPrice(LIFETIME_LICENSE_PRICE_KES), 'KES 15,550');
  assert.equal(formatPrice(ANNUAL_SERVICE_PRICE_KES), 'KES 3,000');
  // And the resolver quotes the same number back, so a renewal button can
  // never disagree with a checkout.
  const e = resolveEntitlements(lifetimeBusiness(), PURCHASE);
  assert.equal(e.service.renewalPriceKes, ANNUAL_SERVICE_PRICE_KES);
  assert.equal(e.renewal.priceKes, ANNUAL_SERVICE_PRICE_KES);
});

// ── Totality: the input is a Firestore document, not a promise ────────

test('the resolver is TOTAL, and garbage never locks a customer out', () => {
  const hostile = [
    undefined, null, 0, '', 'lifetime', [], true, NaN,
    {}, { subscription: null }, { subscription: 'lifetime' },
    { licensing: 'yes' }, { licensing: [] }, { licensing: { licenseType: 'LIFETIME' } },
    { subscription: { plan: 'lifetime' }, licensing: { serviceExpiryDate: 'not a date' } },
    { licensing: { graceDays: -5 } }, { licensing: { graceDays: 'thirty' } },
    { subscription: { plan: 'pro', status: 'active', expiresAt: 'soon' } },
    { __proto__: { licenseType: 'lifetime' } },
  ];

  for (const input of hostile) {
    let e;
    assert.doesNotThrow(() => { e = resolveEntitlements(input, PURCHASE); }, `${JSON.stringify(input)} must not throw`);
    assert.equal(typeof e.can, 'function');
    assert.equal(e.localApplicationAvailable, true, 'the software always runs');
    // The safe direction to fail in is "the customer keeps working".
    assert.equal(e.license.expiresAt, null);
    assert.ok(['free', 'pro', 'lifetime'].includes(e.plan));
  }
});

test('an unknown entitlement key is false, never a throw', () => {
  const e = resolveEntitlements(lifetimeBusiness(), PURCHASE);
  assert.equal(e.can('cloud.teleportation'), false);
  assert.equal(e.can(undefined), false);
  assert.equal(e.can('__proto__'), false);
  assert.equal(e.can('constructor'), false);
});

test('the resolver is pure: same input, same output, and it mutates nothing', () => {
  const business = lifetimeBusiness();
  const snapshot = JSON.stringify(business);
  const a = resolveEntitlements(business, PURCHASE);
  const b = resolveEntitlements(business, PURCHASE);
  assert.equal(JSON.stringify(business), snapshot, 'the input document must not be mutated');
  assert.deepEqual(a.entitlements, b.entitlements);
  assert.equal(a.service.status, b.service.status);
});

// ── Date coercion, because Firestore hands back four different shapes ──

test('a date is a date whether it arrives as a Timestamp, a Date, an ISO string or millis', () => {
  const iso = '2027-09-07T09:00:00.000Z';
  const ms = Date.parse(iso);
  const shapes = [
    new Date(iso),
    iso,
    ms,
    { toMillis: () => ms },
    { seconds: Math.floor(ms / 1000) },
  ];
  for (const shape of shapes) {
    assert.equal(toDate(shape).getTime(), ms, `${JSON.stringify(shape)} must coerce`);
  }
  for (const bad of [null, undefined, '', 'nonsense', {}, [], NaN]) {
    assert.equal(toDate(bad), null);
  }
});

test('days remaining counts to the expiry instant and goes negative afterwards', () => {
  assert.equal(daysUntil(FIRST_EXPIRY, new Date(FIRST_EXPIRY.getTime() - 5 * 86400000)), 5);
  assert.equal(daysUntil(FIRST_EXPIRY, FIRST_EXPIRY), 0);
  assert.ok(daysUntil(FIRST_EXPIRY, new Date(FIRST_EXPIRY.getTime() + 86400000)) < 0);
});

// ── Product photos: a licensed feature, not a hosted one ──────────────
//
// The distinction this whole file exists to keep is the one product
// photos are most likely to blur, because STORING a photo is a hosted
// service while HAVING the feature is a licence. `features.productPhotos`
// answers only the second question, and these tests pin it to the licence
// in every direction the service entitlement can move.

test('PRODUCT PHOTOS ARE A PRO FEATURE, AND STARTER DOES NOT HAVE IT', () => {
  const free = resolveEntitlements({ subscription: { plan: 'free', status: 'active' } });
  assert.equal(free.can(ENTITLEMENTS.PRODUCT_PHOTOS), false);
  assert.equal(free.can(ENTITLEMENTS.PRO_FEATURES), false);
  // And a free business's cloud services are perfectly healthy, which is
  // exactly why the two questions may not be collapsed into one.
  assert.equal(free.can(ENTITLEMENTS.CLOUD_STORAGE), true);
});

test('a monthly Pro subscriber has the product photo entitlement', () => {
  const pro = resolveEntitlements({
    subscription: { plan: 'pro', status: 'active', expiresAt: new Date('2030-01-01T00:00:00Z') },
  });
  assert.equal(pro.can(ENTITLEMENTS.PRODUCT_PHOTOS), true);

  const lapsed = resolveEntitlements({
    subscription: { plan: 'pro', status: 'active', expiresAt: new Date('2026-01-01T00:00:00Z') },
  });
  assert.equal(lapsed.can(ENTITLEMENTS.PRODUCT_PHOTOS), false,
    'a prepaid month that ran out is a Starter business again');
});

test('A LIFETIME LICENCE INCLUDES PRODUCT PHOTOS, AND KEEPS THEM', () => {
  const owned = resolveEntitlements(lifetimeBusiness(), PURCHASE);
  assert.equal(owned.can(ENTITLEMENTS.PRODUCT_PHOTOS), true);

  // The point of the separation. Years past the grace window, hosted
  // storage is withdrawn and the FEATURE is not — so a renewal restores
  // uploads without the customer re-buying anything, and every photo
  // already stored keeps rendering throughout.
  const expired = resolveEntitlements(lifetimeBusiness(), new Date('2029-01-01T00:00:00Z'));
  assert.equal(expired.can(ENTITLEMENTS.CLOUD_STORAGE), false, 'the hosted half lapses');
  assert.equal(expired.can(ENTITLEMENTS.PRODUCT_PHOTOS), true, 'the licensed half does not');

  // An administrative suspension is not a revocation either.
  const suspended = resolveEntitlements(lifetimeBusiness({ cloudSuspended: true }), PURCHASE);
  assert.equal(suspended.can(ENTITLEMENTS.CLOUD_STORAGE), false);
  assert.equal(suspended.can(ENTITLEMENTS.PRODUCT_PHOTOS), true);
});

test('a revoked licence carries no product photo entitlement', () => {
  const revoked = resolveEntitlements(
    lifetimeBusiness({ licenseStatus: 'revoked' }),
    PURCHASE,
  );
  assert.equal(revoked.can(ENTITLEMENTS.PRODUCT_PHOTOS), false);
  assert.equal(revoked.can(ENTITLEMENTS.PRO_FEATURES), false);
});

test('product photos track features.pro exactly, on every shape of business', () => {
  // One assertion instead of a second, forkable rule: if these two ever
  // disagree, the feature has grown a licensing model of its own.
  const businesses = [
    undefined,
    {},
    { subscription: { plan: 'free', status: 'active' } },
    { subscription: { plan: 'pro', status: 'active', expiresAt: null } },
    { subscription: { plan: 'pro', status: 'cancelled', expiresAt: null } },
    { subscription: { plan: 'lifetime', status: 'active' } },
    { subscription: { plan: 'lifetime', status: 'cancelled' } },
    lifetimeBusiness(),
    lifetimeBusiness({ cloudSuspended: true }),
    lifetimeBusiness({ licenseStatus: 'revoked' }),
  ];
  for (const business of businesses) {
    for (const at of [PURCHASE, new Date('2029-01-01T00:00:00Z')]) {
      const e = resolveEntitlements(business, at);
      assert.equal(
        e.can(ENTITLEMENTS.PRODUCT_PHOTOS),
        e.can(ENTITLEMENTS.PRO_FEATURES),
        `product photos must follow the licensed feature set: ${JSON.stringify(business)}`,
      );
    }
  }
});
