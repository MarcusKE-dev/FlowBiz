// src/platform/playBilling.js
//
// Google Play Billing, the JavaScript half. The native half is
// android/app/src/main/java/com/abcsystems/flowbiz/billing/FlowBizBillingPlugin.java.
//
// THE FLOW, and where trust sits at each step:
//
//   1. purchase(plan)       Play's own purchase sheet. The purchase is tagged
//                           with a hash of the business id.
//   2. POST …/verify        the Worker asks GOOGLE whether the token is a
//                           real purchase, for this business, and grants the
//                           plan through the same settlement Paystack uses.
//   3. consume              a Pro or services pass is consumed only AFTER the
//                           Worker confirmed it, so a crash in between leaves
//                           the purchase restorable rather than lost.
//
// The plan reaches the screen the way every purchase always has: through
// the business document's listener in AuthContext.
//
// restorePurchases() replays step 2 for everything Play still holds —
// the licence on a new phone, or a pass whose confirmation never arrived.

import { registerPlugin } from '@capacitor/core';
import { auth } from '../firebase';
import { googlePlayProductForPlan, googlePlayProduct, playAccountTag } from '../billing/catalog';
import { hasNativePlugin } from './platform';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

const FlowBizBilling = registerPlugin('FlowBizBilling');

export function playBillingAvailable() {
  return hasNativePlugin('FlowBizBilling');
}

/** Errors a person can act on, from the plugin's codes. */
const MESSAGES = {
  USER_CANCELED: null, // not an error
  ITEM_ALREADY_OWNED: 'You already own this. Tap "Restore purchases" to apply it.',
  ITEM_UNAVAILABLE: 'This purchase is not available in Google Play yet.',
  BILLING_UNAVAILABLE: 'Google Play purchases are not available on this device or account.',
  NETWORK: 'Could not reach Google Play. Check your connection and try again.',
  IN_PROGRESS: 'A purchase is already open.',
  DEVELOPER_ERROR: 'Google Play could not start this purchase. Please update FlowBiz and try again.',
};

export function playErrorMessage(err) {
  const code = err?.code;
  if (code && Object.prototype.hasOwnProperty.call(MESSAGES, code)) return MESSAGES[code];
  return 'The purchase could not be completed. You have not been charged twice; try "Restore purchases" if it went through.';
}

async function verifyWithFlowBiz(productId, purchaseToken) {
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/billing/google-play/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, purchaseToken }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function settle(productId, purchase) {
  const verified = await verifyWithFlowBiz(productId, purchase.purchaseToken);
  if (verified.status === 202) return { status: 'pending' };
  if (!verified.ok) return { status: 'failed', error: verified.data?.error || 'FlowBiz could not confirm this purchase.' };
  if (googlePlayProduct(productId)?.type === 'consumable') {
    await FlowBizBilling.consume({ purchaseToken: purchase.purchaseToken }).catch(() => {
      // Left unconsumed, it is simply restorable later; the entitlement is already written.
    });
  }
  return { status: 'success', plan: verified.data.plan };
}

/**
 * Buy `plan` through Google Play for `businessId`.
 * @returns {Promise<{status: 'success'|'pending'|'cancelled'|'failed', error?: string}>}
 */
export async function purchaseWithPlay(plan, businessId) {
  const productId = googlePlayProductForPlan(plan);
  if (!productId) return { status: 'failed', error: 'This plan is not sold in the app.' };
  let purchase;
  try {
    purchase = await FlowBizBilling.purchase({ productId, accountTag: await playAccountTag(businessId) });
  } catch (err) {
    const message = playErrorMessage(err);
    return message === null ? { status: 'cancelled' } : { status: 'failed', error: message, code: err?.code };
  }
  if (purchase.purchaseState === 'pending') return { status: 'pending' };
  return settle(productId, purchase);
}

/** Apply everything Play still holds for this user. Returns how many were applied. */
export async function restorePlayPurchases() {
  const { purchases } = await FlowBizBilling.queryPurchases();
  let applied = 0;
  let pending = 0;
  for (const purchase of purchases || []) {
    const productId = purchase.productIds?.find((id) => googlePlayProduct(id));
    if (!productId) continue;
    if (purchase.purchaseState === 'pending') { pending += 1; continue; }
    const result = await settle(productId, purchase);
    if (result.status === 'success') applied += 1;
  }
  return { applied, pending };
}

/** Play's localised price strings, for display. { [plan]: '$119.00' } */
export async function playPrices() {
  const ids = ['pro', 'lifetime', 'annual_services'].map(googlePlayProductForPlan);
  const { products } = await FlowBizBilling.getProducts({ productIds: ids });
  const out = {};
  for (const p of products || []) {
    const entry = googlePlayProduct(p.productId);
    if (entry && p.formattedPrice) out[entry.plan] = p.formattedPrice;
  }
  return out;
}
