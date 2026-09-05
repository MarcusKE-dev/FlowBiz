// src/routes/paystackInitialize.js
//
// POST /api/paystack/initialize
//
// Starts a Paystack transaction for either the FlowBiz Pro monthly plan or
// the FlowBiz Lifetime one-time perpetual license. The price for both is
// fixed SERVER-SIDE from PLAN_PRICES — the browser only picks which plan,
// never what it costs. Records a pending payment doc first, so the webhook
// always has something authoritative to check the eventual callback
// against.

import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { getDocument, createDocument } from '../lib/firestore.js';

export const PRO_PLAN_AMOUNT_KES = 599;
export const LIFETIME_PLAN_AMOUNT_KES = 15550;

export const PLAN_PRICES = {
  pro: { amountKes: PRO_PLAN_AMOUNT_KES, periodDays: 30 },
  lifetime: { amountKes: LIFETIME_PLAN_AMOUNT_KES, periodDays: null },
};

export async function handlePaystackInitialize(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return errorResponse('Missing Authorization header.', 401);

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return errorResponse(`Invalid session: ${err.message}`, 401);
  }

  let body = {};
  try {
    if (request.headers.get('content-length') !== '0') body = await request.json();
  } catch {
    body = {};
  }
  // Default to 'pro' so existing frontend builds that call this endpoint
  // with no body keep working exactly as before.
  const plan = body?.plan === 'lifetime' ? 'lifetime' : 'pro';
  const planPrice = PLAN_PRICES[plan];

  const callerProfile = await getDocument(env, 'users', caller.uid);
  if (!callerProfile) return errorResponse('Profile not found.', 403);
  if (callerProfile.role !== 'owner') return errorResponse('Only an owner can manage the subscription.', 403);
  if (callerProfile.active === false) return errorResponse('Your account is deactivated.', 403);
  if (!callerProfile.businessId) return errorResponse('No business associated with this account.', 400);

  const business = await getDocument(env, 'businesses', callerProfile.businessId);
  if (business?.subscription?.plan === 'lifetime' && business?.subscription?.status === 'active') {
    return errorResponse('This business already has a FlowBiz Lifetime license.', 400);
  }

  const email = callerProfile.email || caller.email;
  if (!email) return errorResponse('No email on file for this account.', 400);

  const reference = `flowbiz_${callerProfile.businessId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const amountKobo = planPrice.amountKes * 100;

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
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

  const paystackData = await paystackRes.json();
  if (!paystackRes.ok || !paystackData.status) {
    return errorResponse(paystackData.message || 'Could not start payment with Paystack.', 502);
  }

  // Recorded BEFORE handing the reference back to the browser — the
  // webhook checks the eventual payment against this, not the other way
  // around, so nothing the frontend says here needs to be trusted later.
  await createDocument(env, 'payments', reference, {
    businessId: callerProfile.businessId,
    plan,
    amountKes: planPrice.amountKes,
    status: 'pending',
    createdAt: new Date(),
    initializedBy: caller.uid,
  });

  return json({ authorization_url: paystackData.data.authorization_url, access_code: paystackData.data.access_code, reference });
}
