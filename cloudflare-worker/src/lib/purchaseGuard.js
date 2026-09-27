// cloudflare-worker/src/lib/purchaseGuard.js
//
// Who may buy what — shared by the hosted checkout (/api/paystack/initialize)
// and the direct M-Pesa charge (/api/paystack/mpesa/charge), so the two
// ways of paying cannot drift into two sets of rules.
//
// The caller is identified by their verified Firebase ID token, never by
// anything in the body, and the business is the one on their profile. A
// body cannot name a different business, so there is nothing to IDOR.

import { errorResponse } from './response.js';
import { verifyFirebaseIdToken } from './firebaseIdToken.js';
import { getDocument } from './firestore.js';
import { resolveEntitlements, planCharge, pricingRegionForCountry } from './licensing.js';

/**
 * The price book a business buys from, decided HERE from its stored
 * region and never from the request. A business with no region (every
 * one created before regional settings) is Kenyan.
 */
export async function pricingRegionForBusiness(env, businessId) {
  const settings = await getDocument(env, 'businessSettings', businessId).catch(() => null);
  return pricingRegionForCountry(settings?.region?.country);
}

/** The full charge for `plan` for this business: description, amount and currency. */
export async function chargeForBusiness(env, businessId, plan) {
  return planCharge(plan, await pricingRegionForBusiness(env, businessId));
}

/**
 * Currencies the Paystack account can actually take. Paystack Kenya
 * accounts take KES by default; USD has to be enabled on the account by
 * Paystack first. Until PAYSTACK_CURRENCIES lists it, an international
 * checkout is refused with a clear message instead of failing inside
 * Paystack with an error nobody can act on. See docs/BILLING.md.
 */
export function paystackAcceptsCurrency(env, currency) {
  const list = String(env.PAYSTACK_CURRENCIES || 'KES').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
  return list.includes(String(currency || '').toUpperCase());
}

export function currencyUnavailableRefusal(currency) {
  return errorResponse(
    `Online payment in ${currency} is not available yet. Please contact FlowBiz support to purchase.`,
    409,
  );
}

/** @returns {Promise<{caller, profile} | {response: Response}>} */
export async function authorizeBillingOwner(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return { response: errorResponse('Missing Authorization header.', 401) };

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch {
    return { response: errorResponse('Your session has expired. Please sign in again.', 401) };
  }

  const profile = await getDocument(env, 'users', caller.uid);
  if (!profile) return { response: errorResponse('Profile not found.', 403) };
  if (profile.role !== 'owner') return { response: errorResponse('Only an owner can manage the subscription.', 403) };
  if (profile.active === false) return { response: errorResponse('Your account is deactivated.', 403) };
  if (!profile.businessId) return { response: errorResponse('No business associated with this account.', 400) };

  return { caller, profile };
}

/**
 * Whether this business may start paying for `plan` right now.
 * @returns {Response|null} a refusal, or null when the purchase may start
 */
export function purchaseRefusal(plan, business, now = Date.now()) {
  const entitlements = resolveEntitlements(business, now);

  if (plan === 'lifetime' && entitlements.license.owned) {
    return errorResponse('This business already owns a FlowBiz Lifetime Licence.', 400);
  }
  // A Lifetime licence already includes everything Pro does. The webhook
  // refuses to let a Pro payment touch a licence, so taking the money
  // would buy nothing.
  if (plan === 'pro' && entitlements.license.owned) {
    return errorResponse('This business already owns a FlowBiz Lifetime Licence, which includes Pro.', 400);
  }
  if (plan === 'annual_services') {
    if (entitlements.license.status === 'revoked') {
      return errorResponse('This licence has been revoked. Please contact FlowBiz support.', 403);
    }
    if (!entitlements.license.owned) {
      return errorResponse(
        'Annual Cloud Services renewal is only available to businesses that own a FlowBiz Lifetime Licence.',
        400,
      );
    }
  }
  return null;
}
