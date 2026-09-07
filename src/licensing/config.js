// src/licensing/config.js
//
// EVERY commercial value FlowBiz charges, includes or counts down lives
// here and nowhere else. A price that appears in a component is a price
// that will be wrong in six months, so components read these constants
// (or the server's copy of them, which is the authority) and never spell
// a number out.
//
// The server's copy is cloudflare-worker/src/lib/licensing.js. It is a
// deliberate copy, exactly as the industry layer is, because the Worker
// must be able to price a checkout without trusting anything the browser
// shipped. cloudflare-worker/test/licensingDrift.test.js imports both and
// fails the moment the two disagree.
//
// ── The commercial model, in one paragraph ────────────────────────────
//
// KES 15,550 buys a PERPETUAL LICENCE to use the FlowBiz application.
// That licence never expires and is not a subscription. Bundled with it
// is the first 12 months of ANNUAL CLOUD SERVICES, MAINTENANCE, UPDATES
// AND SUPPORT. From the second year those hosted services cost KES 3,000
// a year. Not renewing ends the hosted services after a grace period; it
// does not end the licence, and it never deletes the customer's data.

/** The perpetual software licence. One payment, no expiry. */
export const LIFETIME_LICENSE_PRICE_KES = 15550;

/** Cloud services, maintenance, updates and support, per year, from year two. */
export const ANNUAL_SERVICE_PRICE_KES = 3000;

/** How much service the lifetime purchase itself includes. */
export const INCLUDED_SERVICE_MONTHS = 12;

/** How much service one KES 3,000 renewal adds. */
export const RENEWAL_SERVICE_MONTHS = 12;

/**
 * After the service period ends, how long hosted services keep running
 * while the customer is told, repeatedly, that renewal is due.
 * Configurable here; stored per business so a changed default never
 * silently shortens a grace window a customer is already inside.
 */
export const GRACE_PERIOD_DAYS = 30;

/**
 * Reminder stages, in days remaining. The customer-facing notice appears
 * at the first of these and sharpens as the number falls; the reminder
 * emailer sends at most one message per stage per service period.
 */
export const RENEWAL_REMINDER_DAYS = [30, 14, 7, 3, 1];

/** The banner threshold. Kept as its own name because the copy quotes it. */
export const RENEWAL_NOTICE_THRESHOLD_DAYS = RENEWAL_REMINDER_DAYS[0];

/** The monthly plan that predates all of this, and must keep working. */
export const PRO_PLAN_PRICE_KES = 599;
export const PRO_PLAN_PERIOD_DAYS = 30;

/** Purchasable things. `plan` is what /api/paystack/initialize is given. */
export const PURCHASE_PLANS = {
  pro: {
    id: 'pro',
    label: 'FlowBiz Pro',
    amountKes: PRO_PLAN_PRICE_KES,
    periodDays: PRO_PLAN_PERIOD_DAYS,
    kind: 'subscription',
  },
  lifetime: {
    id: 'lifetime',
    label: 'FlowBiz Lifetime Licence',
    amountKes: LIFETIME_LICENSE_PRICE_KES,
    periodDays: null,
    kind: 'perpetual_license',
  },
  annual_services: {
    id: 'annual_services',
    label: 'Cloud Services, Maintenance, Updates and Support',
    amountKes: ANNUAL_SERVICE_PRICE_KES,
    periodMonths: RENEWAL_SERVICE_MONTHS,
    kind: 'service_renewal',
  },
};

/** The plan id the renewal button sends. Named so nothing types it twice. */
export const ANNUAL_SERVICE_PLAN_ID = 'annual_services';
export const LIFETIME_PLAN_ID = 'lifetime';
export const PRO_PLAN_ID = 'pro';

// ── What the annual fee actually buys ─────────────────────────────────
//
// This list is the single source for the checkout, the settings panel,
// the renewal banner, the landing page and the reminder email. If a
// service is added or withdrawn commercially, it changes here once.
export const ANNUAL_SERVICE_INCLUSIONS = [
  'FlowBiz cloud services',
  'Cloud synchronisation across your devices',
  'Cloud-hosted business data services',
  'Cloud storage for supported features, including product photos',
  'Cloud backups where applicable',
  'Software maintenance',
  'Software updates and new versions',
  'Eligible new features',
  'Security and bug-fix updates',
  'Technical and customer support',
];

/**
 * What a customer keeps for good once the licence is paid for. Quoted in
 * the UI so the promise and the code cannot drift apart.
 */
export const LIFETIME_LICENSE_INCLUSIONS = [
  'A permanent right to use the licensed FlowBiz application',
  'No expiry date on the licence itself',
  'The first 12 months of cloud services, maintenance, updates and support',
  'Every feature your licence covers, including the advanced analytics and inventory tools',
];

// ── What suspension actually withdraws ────────────────────────────────
//
// Read docs/LICENSING.md before changing this. The list is deliberately
// short, and the reasoning is the whole design: FlowBiz records sales
// into a local Firestore cache that syncs when it can, so withdrawing
// core record synchronisation would mean a rejected write, a reverted
// local mutation, and a sale that a shop recorded but no longer has.
// Losing a customer's takings to collect KES 3,000 is not an acceptable
// enforcement mechanism, so the entitlements that lapse are the hosted
// services that cost real money and can be withheld without destroying
// anything: cloud storage, cloud-hosted document publishing, backups,
// maintenance, updates and support.
export const WITHDRAWN_ON_SUSPENSION = [
  'cloud.access',
  'cloud.sync',
  'cloud.storage',
  'cloud.backup',
  'maintenance',
  'updates',
  'support',
];

/** Never withdrawn, by any code path, for any reason short of revocation. */
export const NEVER_WITHDRAWN = ['software.license', 'features.pro', 'features.productPhotos'];

/** Currency everything above is quoted in. */
export const CURRENCY = 'KES';

/** `KES 15,550` — the one formatting of a price in the product. */
export function formatPrice(amountKes, currency = CURRENCY) {
  const n = Number(amountKes);
  if (!Number.isFinite(n)) return '';
  return `${currency} ${n.toLocaleString('en-KE')}`;
}
