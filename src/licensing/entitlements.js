// src/licensing/entitlements.js
//
// THE ONE PLACE THAT ANSWERS "what is this business entitled to?".
//
// Two ideas do all the work here, and both are deliberate:
//
//   STORE FACTS, DERIVE STATUS. Firestore holds dates and flags — when
//   the licence was bought, when the service period ends, whether an
//   administrator suspended cloud services. It does NOT hold the word
//   "expired", because nothing writes to a document at the moment a date
//   passes, so a stored status is a status that goes stale. Every status
//   in this file is computed from a fact and a clock.
//
//   A LICENCE IS NOT A SUBSCRIPTION. `subscription` (plan/status/
//   expiresAt) is FlowBiz's original billing record and still drives the
//   monthly Pro plan exactly as it always did. `licensing` is the new,
//   separate record of a perpetual licence and its renewable annual
//   service entitlement. The two never collapse into one another: a
//   lifetime customer whose annual services lapsed still owns their
//   software, and this resolver says so.
//
// TOTALITY. This function never throws and never returns a partial
// object. Its input is a Firestore document that an older client, a
// future client or a corrupt write may have produced, and the safe
// direction to fail in is "the customer keeps working" — so garbage
// resolves to a free business with cloud services on and no licence,
// never to a locked-out one.
//
// PURITY. Same input, same output, no I/O. That is what lets the result
// be memoised per business snapshot and read by every component free.

import {
  ANNUAL_SERVICE_PRICE_KES,
  GRACE_PERIOD_DAYS,
  INCLUDED_SERVICE_MONTHS,
  RENEWAL_SERVICE_MONTHS,
  RENEWAL_REMINDER_DAYS,
} from './config.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The licence a customer can own outright. */
export const LICENSE_TYPES = { LIFETIME: 'lifetime' };
export const LICENSE_STATUS = { ACTIVE: 'active', REVOKED: 'revoked', NONE: 'none' };

/**
 * The annual services entitlement, which is the ONLY thing here that
 * expires.
 *
 *   not_applicable — this business has no perpetual licence, so the
 *                    annual service model does not apply to it. Free and
 *                    monthly-Pro businesses land here and are unaffected
 *                    by every date in this file.
 *   grandfathered  — a lifetime licence bought before the annual service
 *                    model existed and not yet migrated. Fully entitled.
 *                    Never downgraded automatically; see docs/LICENSING.md.
 *   active         — inside the paid service period.
 *   grace          — past the expiry instant, inside the grace window.
 *   expired        — past the grace window.
 */
export const SERVICE_STATUS = {
  NOT_APPLICABLE: 'not_applicable',
  GRANDFATHERED: 'grandfathered',
  ACTIVE: 'active',
  GRACE: 'grace',
  EXPIRED: 'expired',
};

/** What cloud services are doing right now, and why. */
export const CLOUD_STATUS = {
  ACTIVE: 'active',
  GRACE: 'grace',
  SUSPENDED_BY_ADMIN: 'suspended_by_admin',
  SUSPENDED_SERVICE_EXPIRED: 'suspended_service_expired',
};

/** Every entitlement the application may ask about, by name. */
export const ENTITLEMENTS = {
  /** The perpetual right to run the licensed software. Never expires. */
  SOFTWARE_LICENSE: 'software.license',
  /** The feature set the licence or subscription paid for. */
  PRO_FEATURES: 'features.pro',
  /**
   * Product photos on the catalogue — a LICENSED feature, not a hosted
   * one. Starter has no photos at all; Pro and Lifetime do, and a
   * Lifetime customer whose annual services lapsed keeps the
   * entitlement exactly as they keep every other licensed feature.
   *
   * Naming it separately from `features.pro` is what lets a component
   * ask the question it actually has ("may this business use product
   * photos?") instead of asking about a plan, and is how the next
   * licensed feature should be added too.
   *
   * It answers only "is this business entitled to the feature". STORING
   * a new photo also consumes hosted storage, so the write path checks
   * `cloud.storage` as well; the two are separate questions and stay
   * separate. See docs/LICENSING.md §7.
   */
  PRODUCT_PHOTOS: 'features.productPhotos',
  /** Hosted FlowBiz cloud services as a whole. */
  CLOUD_ACCESS: 'cloud.access',
  /** Synchronising business records between devices through the cloud. */
  CLOUD_SYNC: 'cloud.sync',
  /** Cloud storage for product photos and other stored files. */
  CLOUD_STORAGE: 'cloud.storage',
  /** Cloud backups, where the plan provides them. */
  CLOUD_BACKUP: 'cloud.backup',
  /** Cloud-hosted document publishing (public receipt and invoice links). */
  CLOUD_DOCUMENTS: 'cloud.documents',
  /** Ongoing software maintenance. */
  MAINTENANCE: 'maintenance',
  /** Software updates, new versions and eligible new features. */
  UPDATES: 'updates',
  /** Technical and customer support. */
  SUPPORT: 'support',
};

export const ENTITLEMENT_KEYS = Object.values(ENTITLEMENTS);

/**
 * The entitlements a lapsed or suspended service period withdraws.
 * `software.license` and `features.pro` are absent on purpose and must
 * stay absent: they are what the customer bought outright.
 */
export const SERVICE_DEPENDENT_ENTITLEMENTS = [
  ENTITLEMENTS.CLOUD_ACCESS,
  ENTITLEMENTS.CLOUD_SYNC,
  ENTITLEMENTS.CLOUD_STORAGE,
  ENTITLEMENTS.CLOUD_BACKUP,
  ENTITLEMENTS.CLOUD_DOCUMENTS,
  ENTITLEMENTS.MAINTENANCE,
  ENTITLEMENTS.UPDATES,
  ENTITLEMENTS.SUPPORT,
];

// ── Date helpers ──────────────────────────────────────────────────────

/**
 * Anything Firestore, the Worker or an admin form can hand us, as a Date.
 * Returns null rather than an Invalid Date, so a caller can test for it.
 */
export function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof value.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? new Date(ms) : null;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Calendar months, not 30-day blocks. A year of service bought on the
 * 31st of January ends on the 31st of January, and one bought on the 29th
 * of February in a leap year clamps to the 28th rather than silently
 * rolling into March.
 */
export function addMonths(date, months) {
  const base = toDate(date);
  if (!base || !Number.isFinite(months)) return null;
  const day = base.getUTCDate();
  const out = new Date(Date.UTC(
    base.getUTCFullYear(), base.getUTCMonth() + months, 1,
    base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds(), base.getUTCMilliseconds(),
  ));
  const lastDayOfTarget = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, lastDayOfTarget));
  return out;
}

export function addDays(date, days) {
  const base = toDate(date);
  if (!base || !Number.isFinite(days)) return null;
  return new Date(base.getTime() + days * DAY_MS);
}

/**
 * WHERE A RENEWAL STARTS FROM, and the single most important arithmetic
 * in this file.
 *
 * A customer who renews EARLY must not lose the days they had already
 * paid for, so a renewal extends the CURRENT EXPIRY, not the payment
 * date. It only falls back to `now` when the period has already run out —
 * you cannot extend a window that closed, and back-dating one would sell
 * a customer time in the past.
 *
 *   expiry 7 Sep 2027, paid 20 Aug 2027 → 7 Sep 2028   (extended)
 *   expiry 7 Sep 2027, paid 20 Nov 2027 → 20 Nov 2028  (restarted)
 */
export function computeRenewedExpiry(currentExpiry, now = Date.now(), months = RENEWAL_SERVICE_MONTHS) {
  const nowDate = toDate(now) || new Date();
  const current = toDate(currentExpiry);
  const base = current && current.getTime() > nowDate.getTime() ? current : nowDate;
  return addMonths(base, months);
}

/** The first service period a lifetime purchase includes. */
export function computeIncludedServicePeriod(purchasedAt, months = INCLUDED_SERVICE_MONTHS) {
  const start = toDate(purchasedAt) || new Date();
  return { serviceStartDate: start, serviceExpiryDate: addMonths(start, months) };
}

/**
 * The last day the customer is actually covered for.
 *
 * `serviceExpiryDate` is an EXCLUSIVE instant: a period starting 7 Sep
 * 2026 ends at 7 Sep 2027, and the last covered day is 6 Sep 2027. Every
 * "active until" in the UI shows this, not the raw instant, because "your
 * services end on 7 September" reads as though the 7th is covered.
 */
export function lastCoveredDay(expiryDate) {
  const expiry = toDate(expiryDate);
  return expiry ? new Date(expiry.getTime() - DAY_MS) : null;
}

/** Whole days from `now` to `target`, rounded up. Negative once past. */
export function daysUntil(target, now = Date.now()) {
  const end = toDate(target);
  const from = toDate(now) || new Date();
  if (!end) return null;
  return Math.ceil((end.getTime() - from.getTime()) / DAY_MS);
}

// ── Reminder staging ──────────────────────────────────────────────────

/**
 * Which reminder stage a given number of days remaining falls into, or
 * null when renewal is not yet worth mentioning.
 *
 * Stages are the thresholds in config: 90 days out is silence, 30 days
 * out is the 30-day stage, 8 days out is still the 14-day stage, 2 days
 * out is the 3-day stage. One stage, one message.
 */
export function reminderStageFor(daysRemaining, thresholds = RENEWAL_REMINDER_DAYS) {
  if (!Number.isFinite(daysRemaining)) return null;
  if (daysRemaining <= 0) return 'expired';
  const ordered = [...thresholds].sort((a, b) => a - b);
  for (const threshold of ordered) {
    if (daysRemaining <= threshold) return threshold;
  }
  return null;
}

/** How loudly the UI should say it. */
export function noticeLevelFor(stage) {
  if (stage === 'expired') return 'expired';
  if (stage === null || stage === undefined) return 'none';
  if (stage <= 3) return 'urgent';
  if (stage <= 14) return 'warning';
  return 'info';
}

// ── The resolver ──────────────────────────────────────────────────────

function safeString(value, max = 300) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

function allOf(keys, value) {
  const out = {};
  for (const key of keys) out[key] = value;
  return out;
}

/**
 * Reads the two billing records on a business document and answers every
 * licensing question the product can ask.
 *
 * @param {object|null|undefined} business the `businesses/{id}` document,
 *   or anything at all — this function is total.
 * @param {Date|number} [now]
 * @returns {object} see the shape built at the bottom of this function.
 */
export function resolveEntitlements(business, now = Date.now()) {
  const nowDate = toDate(now) || new Date();
  const doc = business && typeof business === 'object' ? business : {};
  const subscription = doc.subscription && typeof doc.subscription === 'object' ? doc.subscription : {};
  const licensing = doc.licensing && typeof doc.licensing === 'object' ? doc.licensing : {};

  // ── The perpetual licence ───────────────────────────────────────────
  //
  // Two records can say a business owns one. `licensing.licenseType` is
  // the new, authoritative one. `subscription.plan === 'lifetime'` is how
  // every licence sold before this system existed is recorded, and it is
  // still honoured — a customer does not lose what they bought because
  // FlowBiz changed how it writes the record down.
  const legacyLifetime = subscription.plan === 'lifetime' && subscription.status !== 'cancelled';
  const modernLifetime = licensing.licenseType === LICENSE_TYPES.LIFETIME;
  const hasLicenseRecord = modernLifetime || legacyLifetime;

  const licenseRevoked = licensing.licenseStatus === LICENSE_STATUS.REVOKED;
  const ownsLifetimeLicense = hasLicenseRecord && !licenseRevoked;

  const licenseType = hasLicenseRecord ? LICENSE_TYPES.LIFETIME : null;
  const licenseStatus = !hasLicenseRecord
    ? LICENSE_STATUS.NONE
    : licenseRevoked ? LICENSE_STATUS.REVOKED : LICENSE_STATUS.ACTIVE;

  const licensePurchasedAt =
    toDate(licensing.licensePurchasedAt) || toDate(subscription.purchasedAt) || null;

  // ── The monthly subscription, untouched ─────────────────────────────
  const subExpiry = toDate(subscription.expiresAt);
  const proActive =
    subscription.plan === 'pro' &&
    subscription.status === 'active' &&
    (!subExpiry || subExpiry.getTime() > nowDate.getTime());

  const plan = ownsLifetimeLicense ? 'lifetime' : proActive ? 'pro' : 'free';

  // ── The annual services entitlement ─────────────────────────────────
  const graceDays = Number.isFinite(licensing.graceDays) && licensing.graceDays >= 0
    ? licensing.graceDays
    : GRACE_PERIOD_DAYS;

  const serviceStartDate = toDate(licensing.serviceStartDate);
  const serviceExpiryDate = toDate(licensing.serviceExpiryDate);
  const graceEndsAt = serviceExpiryDate ? addDays(serviceExpiryDate, graceDays) : null;

  let serviceStatus;
  if (!ownsLifetimeLicense) {
    // Free and monthly-Pro businesses are not in the annual service
    // model at all. Nothing below can expire for them.
    serviceStatus = SERVICE_STATUS.NOT_APPLICABLE;
  } else if (!serviceExpiryDate) {
    // A licence sold before this model existed. Fully entitled until an
    // administrator migrates it deliberately.
    serviceStatus = SERVICE_STATUS.GRANDFATHERED;
  } else if (nowDate.getTime() < serviceExpiryDate.getTime()) {
    serviceStatus = SERVICE_STATUS.ACTIVE;
  } else if (graceEndsAt && nowDate.getTime() < graceEndsAt.getTime()) {
    serviceStatus = SERVICE_STATUS.GRACE;
  } else {
    serviceStatus = SERVICE_STATUS.EXPIRED;
  }

  const inGracePeriod = serviceStatus === SERVICE_STATUS.GRACE;
  const serviceEntitled =
    serviceStatus === SERVICE_STATUS.NOT_APPLICABLE ||
    serviceStatus === SERVICE_STATUS.GRANDFATHERED ||
    serviceStatus === SERVICE_STATUS.ACTIVE ||
    serviceStatus === SERVICE_STATUS.GRACE;

  // ── Administrative suspension ───────────────────────────────────────
  //
  // Independent of everything above, and never a revocation. An
  // administrator can switch a business's hosted services off; the
  // licence and the licensed features are untouched, and the customer
  // keeps every record they have.
  const cloudSuspended = licensing.cloudSuspended === true;

  const cloudStatus = cloudSuspended
    ? CLOUD_STATUS.SUSPENDED_BY_ADMIN
    : !serviceEntitled
      ? CLOUD_STATUS.SUSPENDED_SERVICE_EXPIRED
      : inGracePeriod
        ? CLOUD_STATUS.GRACE
        : CLOUD_STATUS.ACTIVE;

  const cloudEntitled = !cloudSuspended && serviceEntitled;

  // ── The entitlement map ─────────────────────────────────────────────
  const entitlements = {
    ...allOf(SERVICE_DEPENDENT_ENTITLEMENTS, cloudEntitled),
    // Owned outright. A lapsed service period and an administrative
    // suspension both leave these exactly where they are.
    [ENTITLEMENTS.SOFTWARE_LICENSE]: ownsLifetimeLicense,
    [ENTITLEMENTS.PRO_FEATURES]: ownsLifetimeLicense || proActive,
    // Derived from the LICENCE, never from the service period, which is
    // why it sits beside `features.pro` rather than in the spread above.
    [ENTITLEMENTS.PRODUCT_PHOTOS]: ownsLifetimeLicense || proActive,
  };

  // ── Renewal countdown ───────────────────────────────────────────────
  const daysRemaining = serviceExpiryDate ? daysUntil(serviceExpiryDate, nowDate) : null;
  const daysRemainingInGrace = inGracePeriod && graceEndsAt ? daysUntil(graceEndsAt, nowDate) : null;

  const stage = serviceStatus === SERVICE_STATUS.ACTIVE
    ? reminderStageFor(daysRemaining)
    : (serviceStatus === SERVICE_STATUS.GRACE || serviceStatus === SERVICE_STATUS.EXPIRED)
      ? 'expired'
      : null;

  return {
    // Plan, for everything that already speaks in plans.
    plan,
    isPro: entitlements[ENTITLEMENTS.PRO_FEATURES],
    isLifetime: ownsLifetimeLicense,
    isProSubscriber: proActive,

    // The licence.
    license: {
      type: licenseType,
      status: licenseStatus,
      owned: ownsLifetimeLicense,
      /** A perpetual licence has no expiry. This is always null, by design. */
      expiresAt: null,
      purchasedAt: licensePurchasedAt,
      revokedAt: toDate(licensing.licenseRevokedAt),
      revokedReason: safeString(licensing.licenseRevokedReason),
      purchaseReference: safeString(licensing.licensePurchaseReference, 160),
    },

    // The renewable annual services entitlement.
    service: {
      status: serviceStatus,
      entitled: serviceEntitled,
      startDate: serviceStartDate,
      expiryDate: serviceExpiryDate,
      lastCoveredDay: lastCoveredDay(serviceExpiryDate),
      graceDays,
      graceEndsAt,
      inGracePeriod,
      daysRemaining,
      daysRemainingInGrace,
      renewalPriceKes: ANNUAL_SERVICE_PRICE_KES,
      renewalMonths: RENEWAL_SERVICE_MONTHS,
      lastPaymentAt: toDate(licensing.lastServicePaymentAt),
      lastPaymentReference: safeString(licensing.lastServicePaymentReference, 160),
      renewalCount: Number.isFinite(licensing.renewalCount) ? licensing.renewalCount : 0,
    },

    // Hosted services, and who turned them off.
    cloud: {
      status: cloudStatus,
      entitled: cloudEntitled,
      suspendedByAdmin: cloudSuspended,
      suspendedAt: toDate(licensing.cloudSuspendedAt),
      suspendedBy: safeString(licensing.cloudSuspendedBy, 160),
      suspendedReason: safeString(licensing.cloudSuspendedReason),
      restoredAt: toDate(licensing.cloudRestoredAt),
      restoredBy: safeString(licensing.cloudRestoredBy, 160),
    },

    entitlements,
    /** `can('cloud.storage')`. Unknown keys are false, never a throw. */
    can(key) { return entitlements[key] === true; },

    renewal: {
      stage,
      level: noticeLevelFor(stage),
      /** True once the customer should be told, without being nagged. */
      dueSoon: stage !== null && stage !== undefined,
      priceKes: ANNUAL_SERVICE_PRICE_KES,
    },

    /**
     * The promise the whole model rests on: a licensed customer can always
     * run FlowBiz. Nothing in this file can make it false.
     */
    localApplicationAvailable: true,

    /** A pre-model lifetime licence an administrator has yet to migrate. */
    needsServiceMigration: serviceStatus === SERVICE_STATUS.GRANDFATHERED,
  };
}

/** A short, honest sentence for a status line. Used by UI and by admin. */
export function serviceStatusLabel(resolved) {
  switch (resolved?.service?.status) {
    case SERVICE_STATUS.ACTIVE: return 'Active';
    case SERVICE_STATUS.GRACE: return 'Grace period';
    case SERVICE_STATUS.EXPIRED: return 'Expired';
    case SERVICE_STATUS.GRANDFATHERED: return 'Included';
    default: return 'Not applicable';
  }
}
