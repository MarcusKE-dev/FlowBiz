// src/components/licensing/licensingCopy.js
//
// The words FlowBiz uses about its own commercial model, in one file.
//
// This exists because the distinction between a PERPETUAL LICENCE and a
// RENEWABLE SERVICE ENTITLEMENT is easy to blur by accident, and a blurred
// version of it is a misleading one. "Lifetime updates", "lifetime cloud",
// "everything forever" are all things FlowBiz does not sell, and none of
// them can be written into a component by hand if every screen quotes
// from here.

import {
  ANNUAL_SERVICE_PRICE_KES,
  LIFETIME_LICENSE_PRICE_KES,
  ANNUAL_SERVICE_INCLUSIONS,
  formatPrice,
} from '../../licensing';

export const LICENSE_PRICE_LABEL = formatPrice(LIFETIME_LICENSE_PRICE_KES);
export const SERVICE_PRICE_LABEL = formatPrice(ANNUAL_SERVICE_PRICE_KES);
export const SERVICE_PRICE_PER_YEAR = `${SERVICE_PRICE_LABEL} per year`;

export const RENEW_BUTTON_LABEL = `Renew for ${SERVICE_PRICE_LABEL}`;

/** The one-sentence version, used wherever there is room for one line. */
export const LICENCE_IS_PERMANENT =
  'Your Lifetime Licence is permanent. It does not expire, and it is not affected by this.';

/** The reassurance that has to accompany every expiry or suspension message. */
export const DATA_IS_SAFE =
  'Your products, sales, stock, customers and product photos stay exactly where they are. '
  + 'Nothing is deleted because a service period ended.';

export const WHAT_RENEWAL_PROVIDES = ANNUAL_SERVICE_INCLUSIONS;

/** What still works when hosted services are not entitled. */
export const OFFLINE_FALLBACK_SUMMARY = [
  { label: 'Lifetime Licence', value: 'Active' },
  { label: 'FlowBiz on your devices', value: 'Available' },
  { label: 'Your business records', value: 'Kept' },
  { label: 'Cloud synchronisation', value: 'Paused' },
  { label: 'Cloud storage for new photos', value: 'Paused' },
  { label: 'Updates and new features', value: 'Paused' },
  { label: 'Support', value: 'Paused' },
];

/** A date the way FlowBiz writes dates. */
export function formatServiceDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "312 days" / "1 day" / "today". */
export function formatDaysRemaining(days) {
  if (!Number.isFinite(days)) return null;
  if (days <= 0) return 'today';
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * The headline for a renewal notice, written for the stage it is at.
 * Every one of them leads with the licence being safe.
 */
export function renewalHeadline(entitlements) {
  const { service } = entitlements;
  if (service.status === 'grace') return 'Your cloud services have ended, and are in their grace period';
  if (service.status === 'expired') return 'Your cloud services are paused';
  const days = formatDaysRemaining(service.daysRemaining);
  return `Your cloud services, maintenance, updates and support renew in ${days}`;
}

export function renewalBody(entitlements) {
  const { service, cloud } = entitlements;

  if (cloud.suspendedByAdmin) {
    return 'FlowBiz has suspended cloud services for this business. Your Lifetime Licence is still active and '
      + 'FlowBiz keeps running on your devices. Please contact FlowBiz support.';
  }
  if (service.status === 'expired') {
    return `Your Lifetime Licence remains active and your business data is intact. Renew Cloud Services, `
      + `Maintenance, Updates and Support for ${SERVICE_PRICE_PER_YEAR} to switch them back on.`;
  }
  if (service.status === 'grace') {
    const graceDays = formatDaysRemaining(service.daysRemainingInGrace);
    return `Your annual services period ended on ${formatServiceDate(service.lastCoveredDay)}. `
      + `Cloud services keep running for another ${graceDays} while you renew. `
      + `Your Lifetime Licence is permanent and is not affected.`;
  }
  return `Your Lifetime Licence is permanent and does not expire. Your annual Cloud Services, Maintenance, `
    + `Updates and Support period ends on ${formatServiceDate(service.lastCoveredDay)}. `
    + `Renewing costs ${SERVICE_PRICE_PER_YEAR}.`;
}
