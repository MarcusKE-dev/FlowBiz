// src/billing/catalog.js
//
// HOW FLOWBIZ IS PAID FOR, SEPARATED INTO THREE QUESTIONS THAT USED TO BE
// ONE:
//
//   1. WHAT IS SHOWN     the price book (src/licensing/config.js)
//   2. WHO TAKES MONEY   the billing provider (this file)
//   3. WHAT IT BUYS      the entitlement (src/licensing/entitlements.js)
//
// A purchase through ANY provider ends in the same place: the Worker
// verifies it with the provider, then calls applyVerifiedPayment() in
// cloudflare-worker/src/lib/paymentSettlement.js, which is the single
// exactly-once path that extends a subscription or grants a licence. No
// provider has its own grant logic, so a Play purchase and a Paystack
// purchase of the same plan cannot produce different entitlements.
//
// Pure: imported by the app and by the Worker.

/** Billing providers. The value is what payment records store as `provider`. */
export const BILLING_PROVIDERS = Object.freeze({
  PAYSTACK: 'paystack',
  MPESA: 'mpesa',
  GOOGLE_PLAY: 'google_play',
});

/** Where the purchase was made. Payment records store it as `billingPlatform`. */
export const BILLING_PLATFORMS = Object.freeze({
  WEB: 'web',
  ANDROID: 'android',
});

/**
 * GOOGLE PLAY PRODUCTS. One Play product per FlowBiz plan, and the IDs
 * here must match the products created in Play Console exactly (see
 * docs/BILLING.md). They are one-time products, not Play subscriptions,
 * on purpose:
 *
 *   lifetime         NON-CONSUMABLE. Bought once, owned forever — the
 *                    perpetual licence. Restorable on a new device.
 *   pro              CONSUMABLE. A 30-day prepaid pass; buying it again
 *                    extends from the current expiry, exactly as Paystack.
 *   annual_services  CONSUMABLE. A 12-month prepaid services pass,
 *                    extending from the existing expiry.
 *
 * Using Play subscriptions instead would change the commercial model
 * (auto-renewal, Play-managed expiry) for Android customers only, and
 * give the same plan two different lifecycles depending on where it was
 * bought. Prepaid one-time products keep one model everywhere.
 */
export const GOOGLE_PLAY_PRODUCTS = Object.freeze({
  flowbiz_pro_30_days: { plan: 'pro', type: 'consumable' },
  flowbiz_lifetime_licence: { plan: 'lifetime', type: 'non_consumable' },
  flowbiz_annual_services_12_months: { plan: 'annual_services', type: 'consumable' },
});

/** Play product id for a plan, or null. */
export function googlePlayProductForPlan(plan) {
  for (const [productId, entry] of Object.entries(GOOGLE_PLAY_PRODUCTS)) {
    if (entry.plan === plan) return productId;
  }
  return null;
}

/** { plan, type } for a Play product id, or null for one FlowBiz does not sell. */
export function googlePlayProduct(productId) {
  return Object.prototype.hasOwnProperty.call(GOOGLE_PLAY_PRODUCTS, productId)
    ? GOOGLE_PLAY_PRODUCTS[productId]
    : null;
}

/**
 * WHICH PROVIDER A CHECKOUT USES.
 *
 * Inside the Android app, digital goods are sold through Google Play
 * Billing: Play policy requires it for in-app purchases of digital
 * features, and a Paystack card form inside the Play build would be a
 * policy violation that can get the app removed. On the web, Kenya pays
 * by M-Pesa (card as an alternative) and everyone else by card.
 *
 * @param {{ platform: 'web'|'android'|'ios', pricingRegion: 'KE'|'INTL' }} context
 * @returns {{ primary: string, alternatives: string[] } | null}
 *   null when no provider can take payment on this platform (iOS, until
 *   App Store billing exists).
 */
export function billingProvidersFor({ platform, pricingRegion }) {
  if (platform === 'android') return { primary: BILLING_PROVIDERS.GOOGLE_PLAY, alternatives: [] };
  if (platform === 'ios') return null;
  if (pricingRegion === 'KE') return { primary: BILLING_PROVIDERS.MPESA, alternatives: [BILLING_PROVIDERS.PAYSTACK] };
  return { primary: BILLING_PROVIDERS.PAYSTACK, alternatives: [] };
}

/**
 * The value a Play purchase is tagged with (BillingFlowParams
 * .setObfuscatedAccountId) and the Worker checks it against: a SHA-256 of
 * the business id, hex. It ties a purchase token to the business that
 * made it, so a token lifted from one account cannot be replayed to
 * unlock another. Hashed because Play forbids personal data in this
 * field, and 64 hex characters is exactly Play's limit.
 */
export async function playAccountTag(businessId) {
  const bytes = new TextEncoder().encode(`flowbiz:${String(businessId || '')}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
