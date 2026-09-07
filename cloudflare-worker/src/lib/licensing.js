// cloudflare-worker/src/lib/licensing.js
//
// The server half of the licensing layer.
//
// WHY THIS IMPORTS THE BROWSER MODULE INSTEAD OF COPYING IT. The industry
// layer keeps a deliberate copy of its two lists here, because those are
// short allow-lists and the Worker must be able to refuse a bad profile
// without trusting the client bundle. Licensing is a different shape: it
// is date arithmetic and a status machine, and a Worker that computed
// "expired" one day earlier than the browser would show a customer an
// active service period and refuse their renewal in the same breath. So
// the arithmetic has exactly one implementation, in src/licensing/, which
// is pure, dependency-free and imports nothing from React, Firebase or
// import.meta. Wrangler's bundler follows the relative path; a test
// asserts the module stays free of browser-only imports.
//
// What lives HERE and nowhere else is the part only a server may do:
// pricing a checkout, and turning a confirmed payment into the exact
// Firestore document the licence and service period are recorded in.

export {
  LIFETIME_LICENSE_PRICE_KES,
  ANNUAL_SERVICE_PRICE_KES,
  INCLUDED_SERVICE_MONTHS,
  RENEWAL_SERVICE_MONTHS,
  GRACE_PERIOD_DAYS,
  RENEWAL_REMINDER_DAYS,
  RENEWAL_NOTICE_THRESHOLD_DAYS,
  PRO_PLAN_PRICE_KES,
  PRO_PLAN_PERIOD_DAYS,
  ANNUAL_SERVICE_PLAN_ID,
  LIFETIME_PLAN_ID,
  PRO_PLAN_ID,
  ANNUAL_SERVICE_INCLUSIONS,
  CURRENCY,
  formatPrice,
} from '../../../src/licensing/config.js';

export {
  LICENSE_TYPES,
  LICENSE_STATUS,
  SERVICE_STATUS,
  CLOUD_STATUS,
  ENTITLEMENTS,
  ENTITLEMENT_KEYS,
  resolveEntitlements,
  computeRenewedExpiry,
  computeIncludedServicePeriod,
  lastCoveredDay,
  daysUntil,
  addDays,
  addMonths,
  toDate,
  reminderStageFor,
  noticeLevelFor,
  serviceStatusLabel,
  DAY_MS,
} from '../../../src/licensing/entitlements.js';

import {
  LIFETIME_LICENSE_PRICE_KES,
  ANNUAL_SERVICE_PRICE_KES,
  INCLUDED_SERVICE_MONTHS,
  RENEWAL_SERVICE_MONTHS,
  GRACE_PERIOD_DAYS,
  PRO_PLAN_PRICE_KES,
  PRO_PLAN_PERIOD_DAYS,
} from '../../../src/licensing/config.js';

import {
  LICENSE_TYPES,
  LICENSE_STATUS,
  addDays,
  addMonths,
  computeIncludedServicePeriod,
  computeRenewedExpiry,
  resolveEntitlements,
  toDate,
} from '../../../src/licensing/entitlements.js';

// ── Pricing, decided server-side and only server-side ─────────────────
//
// The browser picks WHICH plan. It never says what one costs, and the
// webhook re-checks the amount it was actually paid against the amount
// recorded here at initialisation. A client that posts
// `{ plan: 'lifetime', amountKes: 1 }` is charged 15,550.
export const PLAN_PRICES = {
  pro: {
    amountKes: PRO_PLAN_PRICE_KES,
    periodDays: PRO_PLAN_PERIOD_DAYS,
    kind: 'subscription',
    label: 'FlowBiz Pro, 30 days',
  },
  lifetime: {
    amountKes: LIFETIME_LICENSE_PRICE_KES,
    periodDays: null,
    periodMonths: INCLUDED_SERVICE_MONTHS,
    kind: 'perpetual_license',
    label: 'FlowBiz Lifetime Licence, including the first 12 months of cloud services',
  },
  annual_services: {
    amountKes: ANNUAL_SERVICE_PRICE_KES,
    periodDays: null,
    periodMonths: RENEWAL_SERVICE_MONTHS,
    kind: 'service_renewal',
    label: 'Cloud Services, Maintenance, Updates and Support, 12 months',
  },
};

export const PURCHASABLE_PLAN_IDS = Object.keys(PLAN_PRICES);

export function isPurchasablePlan(plan) {
  return typeof plan === 'string' && Object.prototype.hasOwnProperty.call(PLAN_PRICES, plan);
}

// ── Writing the record ────────────────────────────────────────────────
//
// `patchDocument` masks on the top-level `licensing` key, which REPLACES
// the whole map. Every builder below therefore takes the current map and
// returns a complete one: a partial return would silently drop the
// suspension flag, the payment history pointer, or the grace window a
// customer is currently inside.

function currentLicensing(business) {
  const raw = business && typeof business === 'object' ? business.licensing : null;
  return raw && typeof raw === 'object' ? { ...raw } : {};
}

/**
 * The one field firestore.rules reads.
 *
 * Rules cannot run this module, so the whole "are hosted services still
 * entitled?" question is reduced to a single timestamp the rules compare
 * `request.time` against: the instant the grace window closes. Null means
 * "no service period applies" — a free or monthly-Pro business — and the
 * rules treat that as entitled, which is exactly today's behaviour.
 */
function cloudEntitledUntil(serviceExpiryDate, graceDays) {
  const expiry = toDate(serviceExpiryDate);
  return expiry ? addDays(expiry, graceDays) : null;
}

function withDerivedFields(licensing) {
  const graceDays = Number.isFinite(licensing.graceDays) ? licensing.graceDays : GRACE_PERIOD_DAYS;
  return {
    ...licensing,
    graceDays,
    cloudEntitledUntil: cloudEntitledUntil(licensing.serviceExpiryDate, graceDays),
    schemaVersion: 1,
    updatedAt: licensing.updatedAt || new Date(),
  };
}

/**
 * A confirmed KES 15,550 payment.
 *
 * Creates the perpetual licence AND starts the first 12-month service
 * period in one write, because they are one purchase. The licence has no
 * expiry field to set — that is the point of it.
 */
export function lifetimeActivationPayload(business, { now = new Date(), reference = null, amountKes = null } = {}) {
  const existing = currentLicensing(business);
  const { serviceStartDate, serviceExpiryDate } = computeIncludedServicePeriod(now, INCLUDED_SERVICE_MONTHS);

  return withDerivedFields({
    ...existing,
    licenseType: LICENSE_TYPES.LIFETIME,
    licenseStatus: LICENSE_STATUS.ACTIVE,
    licensePurchasedAt: toDate(now),
    licensePurchaseReference: reference,
    licensePurchaseAmountKes: Number.isFinite(amountKes) ? amountKes : LIFETIME_LICENSE_PRICE_KES,
    // Deliberately absent: any licence expiry field. Nothing in FlowBiz
    // may write one, and nothing reads one.
    licenseRevokedAt: null,
    licenseRevokedReason: null,
    serviceStartDate,
    serviceExpiryDate,
    graceDays: GRACE_PERIOD_DAYS,
    lastServicePaymentAt: toDate(now),
    lastServicePaymentReference: reference,
    lastServicePaymentAmountKes: Number.isFinite(amountKes) ? amountKes : LIFETIME_LICENSE_PRICE_KES,
    renewalCount: 0,
    servicePeriodCount: 1,
    // A fresh purchase clears any historical suspension: somebody who
    // buys a licence is not starting it switched off.
    cloudSuspended: false,
    cloudSuspendedAt: null,
    cloudSuspendedBy: null,
    cloudSuspendedReason: null,
    reminderStageSent: null,
    reminderSentAt: null,
    reminderPeriodKey: null,
    updatedAt: toDate(now),
  });
}

/**
 * A confirmed KES 3,000 renewal.
 *
 * Extends from the CURRENT EXPIRY when the period is still running, so
 * renewing early adds twelve months rather than throwing away the days
 * already paid for. See computeRenewedExpiry.
 */
export function serviceRenewalPayload(business, { now = new Date(), reference = null, amountKes = null } = {}) {
  const existing = currentLicensing(business);
  const nextExpiry = computeRenewedExpiry(existing.serviceExpiryDate, now, RENEWAL_SERVICE_MONTHS);

  return withDerivedFields({
    ...existing,
    // A renewal never changes the licence. It is written here only so a
    // grandfathered licence that renews gains a proper record.
    licenseType: existing.licenseType || LICENSE_TYPES.LIFETIME,
    licenseStatus: existing.licenseStatus || LICENSE_STATUS.ACTIVE,
    serviceStartDate: toDate(existing.serviceStartDate) || toDate(now),
    serviceExpiryDate: nextExpiry,
    graceDays: Number.isFinite(existing.graceDays) ? existing.graceDays : GRACE_PERIOD_DAYS,
    lastServicePaymentAt: toDate(now),
    lastServicePaymentReference: reference,
    lastServicePaymentAmountKes: Number.isFinite(amountKes) ? amountKes : ANNUAL_SERVICE_PRICE_KES,
    renewalCount: (Number.isFinite(existing.renewalCount) ? existing.renewalCount : 0) + 1,
    servicePeriodCount: (Number.isFinite(existing.servicePeriodCount) ? existing.servicePeriodCount : 1) + 1,
    // A paid-up business is not left suspended for non-payment. An
    // administrative suspension for another reason is NOT cleared here —
    // that takes an explicit administrative restore.
    reminderStageSent: null,
    reminderSentAt: null,
    reminderPeriodKey: null,
    updatedAt: toDate(now),
  });
}

/**
 * An administrator switching hosted services off, or back on.
 *
 * NOT a licence action. `licenseType` and `licenseStatus` are untouched
 * by design: a suspended business still owns its software and still runs
 * locally. See docs/LICENSING.md.
 */
export function cloudSuspensionPayload(business, { suspended, admin, reason = null, now = new Date() }) {
  const existing = currentLicensing(business);
  const who = admin?.email || admin?.uid || 'system';

  return withDerivedFields({
    ...existing,
    cloudSuspended: suspended === true,
    ...(suspended
      ? {
        cloudSuspendedAt: toDate(now),
        cloudSuspendedBy: who,
        cloudSuspendedReason: typeof reason === 'string' ? reason.slice(0, 300) : null,
      }
      : {
        cloudSuspendedAt: existing.cloudSuspendedAt || null,
        cloudRestoredAt: toDate(now),
        cloudRestoredBy: who,
        cloudRestoredReason: typeof reason === 'string' ? reason.slice(0, 300) : null,
      }),
    updatedAt: toDate(now),
  });
}

/**
 * Revoking a perpetual licence. Deliberately separate from suspension and
 * never reachable from an expiry: nothing in FlowBiz revokes a licence
 * because a service fee was not paid, and there is no code path that
 * calls this on a timer.
 */
export function licenseRevocationPayload(business, { revoked, admin, reason = null, now = new Date() }) {
  const existing = currentLicensing(business);
  const who = admin?.email || admin?.uid || 'system';

  return withDerivedFields({
    ...existing,
    licenseType: existing.licenseType || LICENSE_TYPES.LIFETIME,
    licenseStatus: revoked ? LICENSE_STATUS.REVOKED : LICENSE_STATUS.ACTIVE,
    licenseRevokedAt: revoked ? toDate(now) : null,
    licenseRevokedBy: revoked ? who : null,
    licenseRevokedReason: revoked && typeof reason === 'string' ? reason.slice(0, 300) : null,
    licenseReinstatedAt: revoked ? (existing.licenseReinstatedAt || null) : toDate(now),
    licenseReinstatedBy: revoked ? (existing.licenseReinstatedBy || null) : who,
    updatedAt: toDate(now),
  });
}

/**
 * An administrative override of the service period — a support
 * concession, a goodwill extension, a correction after a failed payment.
 * Bounded, audited, and never able to shorten a licence.
 */
export function serviceOverridePayload(business, { expiryDate, graceDays, admin, reason = null, now = new Date() }) {
  const existing = currentLicensing(business);
  const who = admin?.email || admin?.uid || 'system';
  const expiry = toDate(expiryDate);

  return withDerivedFields({
    ...existing,
    licenseType: existing.licenseType || LICENSE_TYPES.LIFETIME,
    licenseStatus: existing.licenseStatus || LICENSE_STATUS.ACTIVE,
    serviceStartDate: toDate(existing.serviceStartDate) || toDate(now),
    serviceExpiryDate: expiry,
    graceDays: Number.isFinite(graceDays) ? graceDays : (Number.isFinite(existing.graceDays) ? existing.graceDays : GRACE_PERIOD_DAYS),
    serviceOverriddenAt: toDate(now),
    serviceOverriddenBy: who,
    serviceOverrideReason: typeof reason === 'string' ? reason.slice(0, 300) : null,
    reminderStageSent: null,
    reminderSentAt: null,
    reminderPeriodKey: null,
    updatedAt: toDate(now),
  });
}

/**
 * Bringing a licence sold before this model existed into it.
 *
 * The customer bought a perpetual licence with no stated annual service
 * fee, so migration GRANTS a full service period from the migration date
 * rather than back-dating one from the purchase date and handing them an
 * already-expired entitlement. That is the whole safety property: a
 * migration can only ever add time.
 */
export function migrationPayload(business, { now = new Date(), months = INCLUDED_SERVICE_MONTHS, admin = null } = {}) {
  const existing = currentLicensing(business);
  const purchasedAt = toDate(existing.licensePurchasedAt)
    || toDate(business?.subscription?.purchasedAt)
    || toDate(business?.createdAt)
    || toDate(now);

  const granted = addMonths(now, months);
  const current = toDate(existing.serviceExpiryDate);
  // Never shorten. If a period already exists and runs longer, keep it.
  const serviceExpiryDate = current && current.getTime() > granted.getTime() ? current : granted;

  return withDerivedFields({
    ...existing,
    licenseType: LICENSE_TYPES.LIFETIME,
    licenseStatus: existing.licenseStatus === LICENSE_STATUS.REVOKED
      ? LICENSE_STATUS.REVOKED
      : LICENSE_STATUS.ACTIVE,
    licensePurchasedAt: purchasedAt,
    serviceStartDate: toDate(existing.serviceStartDate) || toDate(now),
    serviceExpiryDate,
    graceDays: Number.isFinite(existing.graceDays) ? existing.graceDays : GRACE_PERIOD_DAYS,
    renewalCount: Number.isFinite(existing.renewalCount) ? existing.renewalCount : 0,
    servicePeriodCount: Number.isFinite(existing.servicePeriodCount) ? existing.servicePeriodCount : 1,
    cloudSuspended: existing.cloudSuspended === true,
    migratedAt: toDate(now),
    migratedBy: admin?.email || admin?.uid || 'system',
    migratedFrom: 'legacy_lifetime_subscription',
    updatedAt: toDate(now),
  });
}

/**
 * A stable key for "which service period is this", so the reminder mailer
 * can send one message per stage per period and never repeat itself.
 */
export function servicePeriodKey(licensing) {
  const expiry = toDate(licensing?.serviceExpiryDate);
  return expiry ? expiry.toISOString().slice(0, 10) : 'none';
}

/** Convenience for routes that need the derived view of a raw business. */
export function entitlementsOf(business, now = Date.now()) {
  return resolveEntitlements(business, now);
}
