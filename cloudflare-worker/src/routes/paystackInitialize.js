// src/routes/paystackInitialize.js
//
// POST /api/paystack/initialize
//
// Starts a Paystack transaction for one of three things:
//
//   pro             — the monthly FlowBiz Pro subscription (unchanged)
//   lifetime        — the KES 15,550 perpetual software licence, which
//                     includes the first 12 months of cloud services,
//                     maintenance, updates and support
//   annual_services — the KES 3,000 annual renewal of those cloud
//                     services for a business that already owns a licence
//
// The price of all three is fixed SERVER-SIDE from PLAN_PRICES in
// lib/licensing.js. The browser only picks which plan, never what it
// costs, and the webhook re-checks what Paystack actually charged against
// the amount recorded here. A pending payment document is written BEFORE
// the reference is handed back, so the webhook always has something
// authoritative to check the eventual callback against.

import { json, errorResponse } from '../lib/response.js';
import { authorizeBillingOwner, purchaseRefusal } from '../lib/purchaseGuard.js';
import { getDocument, createDocument } from '../lib/firestore.js';
import { recordOpsEvent, EVENT_TYPES } from '../lib/opsEvents.js';
import {
  PLAN_PRICES,
  isPurchasablePlan,
  LIFETIME_LICENSE_PRICE_KES,
  PRO_PLAN_PRICE_KES,
  ANNUAL_SERVICE_PRICE_KES,
} from '../lib/licensing.js';

// Kept as named exports because proPrice.js and the existing tests import
// them. They now read through the licensing config so there is still only
// one place a price is written down.
export const PRO_PLAN_AMOUNT_KES = PRO_PLAN_PRICE_KES;
export const LIFETIME_PLAN_AMOUNT_KES = LIFETIME_LICENSE_PRICE_KES;
export const ANNUAL_SERVICE_AMOUNT_KES = ANNUAL_SERVICE_PRICE_KES;
export { PLAN_PRICES };

export async function handlePaystackInitialize(request, env) {
  const auth = await authorizeBillingOwner(request, env);
  if (auth.response) return auth.response;
  const { caller, profile: callerProfile } = auth;

  let body = {};
  try {
    if (request.headers.get('content-length') !== '0') body = await request.json();
  } catch {
    body = {};
  }
  // Default to 'pro' so existing frontend builds that call this endpoint
  // with no body keep working exactly as before.
  const plan = isPurchasablePlan(body?.plan) ? body.plan : 'pro';
  const planPrice = PLAN_PRICES[plan];

  // What each plan may be bought for, checked here rather than in the
  // browser. The UI hides the buttons; this is what enforces it.
  const business = await getDocument(env, 'businesses', callerProfile.businessId);
  const refusal = purchaseRefusal(plan, business);
  if (refusal) return refusal;

  const email = callerProfile.email || caller.email;
  if (!email) return errorResponse('No email on file for this account.', 400);

  const reference = `flowbiz_${callerProfile.businessId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const amountKobo = planPrice.amountKes * 100;

  let paystackRes;
  let paystackData;
  try {
    paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        currency: 'KES',
        reference,
        callback_url: env.PAYSTACK_CALLBACK_URL || undefined,
        metadata: { businessId: callerProfile.businessId, plan },
      }),
    });
    paystackData = await paystackRes.json();
  } catch (err) {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.PAYMENT_INIT_FAILED,
      severity: 'error',
      source: 'payment',
      message: 'Could not reach Paystack to start a checkout.',
      businessId: callerProfile.businessId,
      context: { plan, reason: err?.message || 'network' },
    });
    return errorResponse('Could not start payment with Paystack.', 502);
  }

  if (!paystackRes.ok || !paystackData.status) {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.PAYMENT_INIT_FAILED,
      severity: 'error',
      source: 'payment',
      message: 'Paystack refused a checkout initialisation.',
      businessId: callerProfile.businessId,
      context: { plan, status: paystackRes.status, message: String(paystackData?.message || '').slice(0, 200) },
    });
    // Paystack's own message is recorded above, not shown: it can name
    // integration settings a customer has no use for.
    return errorResponse('Could not start payment with Paystack.', 502);
  }

  // Recorded BEFORE handing the reference back to the browser — the
  // webhook checks the eventual payment against this, not the other way
  // around, so nothing the frontend says here needs to be trusted later.
  // `kind` and `description` exist so the customer's own billing history
  // can say what a line was for without re-deriving it from the price.
  await createDocument(env, 'payments', reference, {
    businessId: callerProfile.businessId,
    plan,
    kind: planPrice.kind,
    description: planPrice.label,
    amountKes: planPrice.amountKes,
    currency: 'KES',
    status: 'pending',
    // How the payment was started. 'mpesa_stk' rows come from mpesaCharge.js.
    channel: 'checkout',
    createdAt: new Date(),
    initializedBy: caller.uid,
  });

  return json({
    authorization_url: paystackData.data.authorization_url,
    access_code: paystackData.data.access_code,
    reference,
    plan,
    amountKes: planPrice.amountKes,
  });
}
