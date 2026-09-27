// cloudflare-worker/src/routes/googlePlayBilling.js
//
// GOOGLE PLAY BILLING, SERVER SIDE.
//
//   POST /api/billing/google-play/verify   the app, after Play says "purchased"
//   POST /api/billing/google-play/rtdn     Play's real-time developer notifications
//
// The Android app never grants itself anything. When Play reports a
// completed purchase the app sends the purchase token here; this route
// asks Google Play directly whether that token is a real, completed
// purchase of that product, for this business, and only then hands it to
// applyVerifiedPayment() — the same exactly-once settlement Paystack and
// M-Pesa use. So the licence, the service period and the Pro expiry are
// computed by one piece of code whichever store took the money.
//
// WHAT IS CHECKED, in order:
//   1. the caller is a signed-in, active OWNER (authorizeBillingOwner)
//   2. the product id is one FlowBiz sells (src/billing/catalog.js)
//   3. Google Play says the token is PURCHASED (not pending, not cancelled)
//   4. the purchase's obfuscatedExternalAccountId is this business's tag,
//      so a token from one account cannot unlock another
//   5. the reference derived from the token has not already been applied
//
// NOTHING SECRET LIVES IN THE APP. The Play service account is a Worker
// secret (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON); the app holds only a token
// Google gave the user. See docs/BILLING.md for the Play Console setup.

import { json, errorResponse } from '../lib/response.js';
import { authorizeBillingOwner } from '../lib/purchaseGuard.js';
import { getDocument, createDocument, patchDocument } from '../lib/firestore.js';
import { getGoogleAccessToken } from '../lib/googleAuth.js';
import { applyVerifiedPayment } from '../lib/paymentSettlement.js';
import { recordOpsEvent, EVENT_TYPES } from '../lib/opsEvents.js';
import { PLAN_PRICES } from '../lib/licensing.js';
import {
  googlePlayProduct, playAccountTag, BILLING_PROVIDERS, BILLING_PLATFORMS,
} from '../../../src/billing/catalog.js';

const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const PLAY_API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

// purchases.products purchaseState
const PURCHASED = 0;
const PENDING = 2;

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The payments/{reference} id for a Play purchase. Derived from the token
 * (hashed — the token itself is a bearer credential and is never stored),
 * so the same purchase always maps to the same record and can only ever
 * be applied once, however many times the app or a notification retries.
 */
export async function playReference(purchaseToken) {
  return `gplay_${(await sha256Hex(String(purchaseToken))).slice(0, 48)}`;
}

export function playConfigured(env) {
  return Boolean(env.GOOGLE_PLAY_PACKAGE_NAME && env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
}

async function playApi(env, path, { method = 'GET' } = {}) {
  const token = await getGoogleAccessToken(env, {
    secretName: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
    scope: ANDROID_PUBLISHER_SCOPE,
  });
  const res = await fetch(`${PLAY_API}/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

function validToken(token) {
  return typeof token === 'string' && token.length >= 10 && token.length <= 4096 && /^[A-Za-z0-9._\-:]+$/.test(token);
}

// ── POST /api/billing/google-play/verify ─────────────────────────────

export async function handleGooglePlayVerify(request, env) {
  if (!playConfigured(env)) {
    return errorResponse('Google Play purchases are not available yet.', 503);
  }
  const auth = await authorizeBillingOwner(request, env);
  if (auth.response) return auth.response;
  const { caller, profile } = auth;
  const businessId = profile.businessId;

  const body = await request.json().catch(() => ({}));
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  const purchaseToken = body?.purchaseToken;
  const product = googlePlayProduct(productId);
  if (!product) return errorResponse('Unknown product.', 400);
  if (!validToken(purchaseToken)) return errorResponse('Invalid purchase.', 400);

  const reference = await playReference(purchaseToken);

  // Already settled: a restore, a retry after a dropped connection, or a
  // second device. Say so without asking Google again.
  const existing = await getDocument(env, 'payments', reference);
  if (existing?.status === 'success') {
    if (existing.businessId !== businessId) return errorResponse('This purchase belongs to another account.', 403);
    return json({ status: 'success', plan: existing.plan, reference, consumable: product.type === 'consumable', already: true });
  }

  const purchase = await playApi(env, `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`);
  if (!purchase.ok || !purchase.body) {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.PLAY_VERIFY_FAILED,
      severity: 'error',
      source: 'payment',
      message: 'Google Play could not confirm a purchase token the app submitted.',
      businessId,
      reference,
      context: { productId, status: purchase.status },
    });
    return errorResponse('Google Play could not confirm this purchase.', purchase.status === 404 || purchase.status === 400 ? 400 : 502);
  }

  const p = purchase.body;
  if (p.purchaseState === PENDING) {
    return json({ status: 'pending', plan: product.plan, reference }, { status: 202 });
  }
  if (p.purchaseState !== PURCHASED) {
    return errorResponse('This purchase was cancelled.', 409);
  }

  const expectedTag = await playAccountTag(businessId);
  if (p.obfuscatedExternalAccountId !== expectedTag) {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.PLAY_ACCOUNT_MISMATCH,
      severity: 'warning',
      source: 'payment',
      message: 'A Google Play purchase was submitted by a business it was not made for. Nothing was granted.',
      businessId,
      reference,
      context: { productId },
      dedupe: false,
    });
    return errorResponse('This purchase belongs to another account.', 403);
  }

  const planInfo = PLAN_PRICES[product.plan];
  // The money is Google's to report, in whatever currency the buyer's
  // Play account uses; FlowBiz records WHAT was bought and leaves the
  // amount to the Play Console's own financial reports. `amount` and
  // `currency` are null — never a guessed KES figure.
  const record = {
    businessId,
    plan: product.plan,
    kind: planInfo.kind,
    description: planInfo.label,
    amountKes: null,
    amount: null,
    currency: null,
    unpriced: true,
    provider: BILLING_PROVIDERS.GOOGLE_PLAY,
    billingPlatform: BILLING_PLATFORMS.ANDROID,
    channel: 'google_play',
    productId,
    orderId: typeof p.orderId === 'string' ? p.orderId.slice(0, 80) : null,
    playRegionCode: typeof p.regionCode === 'string' ? p.regionCode.slice(0, 4) : null,
    status: 'pending',
    createdAt: new Date(),
    initializedBy: caller.uid,
  };
  if (!existing) {
    try {
      await createDocument(env, 'payments', reference, record);
    } catch (err) {
      if (err?.message !== 'DOCUMENT_ALREADY_EXISTS') throw err;
    }
  }

  const outcome = await applyVerifiedPayment(
    env,
    reference,
    { ...record, ...(existing || {}), status: existing?.status || 'pending' },
    { id: record.orderId || reference, channel: 'google_play' },
    { source: 'google_play' },
  );

  // Play refunds a purchase that is not ACKNOWLEDGED within three days.
  // Acknowledge only once the entitlement is written; a consumable is
  // additionally consumed by the app, which Play allows after this.
  if (p.acknowledgementState !== 1 && (outcome.result === 'applied' || outcome.result === 'already' || outcome.result === 'recorded')) {
    await playApi(env, `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, { method: 'POST' })
      .catch(() => null);
  }

  if (outcome.result === 'business_missing') return errorResponse('Business not found.', 404);
  return json({
    status: 'success',
    plan: product.plan,
    reference,
    consumable: product.type === 'consumable',
    result: outcome.result,
  });
}

// ── POST /api/billing/google-play/rtdn ────────────────────────────────
//
// Play's Real-time Developer Notifications, delivered by a Pub/Sub push
// subscription to this URL with ?token=<GOOGLE_PLAY_RTDN_TOKEN>. Only a
// VOIDED purchase (a refund or chargeback) needs anything from FlowBiz,
// and what it gets is a flag and an error-level event for a person to
// review. It does not revoke a licence automatically: revocation is an
// audited administrative action in this product, never a side effect.

function timingSafeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (!x || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export async function handleGooglePlayRtdn(request, env, url) {
  if (!env.GOOGLE_PLAY_RTDN_TOKEN || !timingSafeEqual(url.searchParams.get('token'), env.GOOGLE_PLAY_RTDN_TOKEN)) {
    return errorResponse('Forbidden.', 403);
  }
  const envelope = await request.json().catch(() => null);
  let note = null;
  try {
    note = JSON.parse(atob(envelope?.message?.data || ''));
  } catch {
    note = null;
  }
  // Acknowledge anything we cannot use, or Pub/Sub retries it forever.
  if (!note || (env.GOOGLE_PLAY_PACKAGE_NAME && note.packageName !== env.GOOGLE_PLAY_PACKAGE_NAME)) {
    return json({ ok: true, ignored: true });
  }

  const voided = note.voidedPurchaseNotification;
  if (voided?.purchaseToken) {
    const reference = await playReference(voided.purchaseToken);
    const payment = await getDocument(env, 'payments', reference);
    if (payment) {
      await patchDocument(env, 'payments', reference, {
        voided: true,
        voidedAt: new Date(),
        voidedRefundType: Number.isFinite(voided.refundType) ? voided.refundType : null,
      });
    }
    await recordOpsEvent(env, {
      type: EVENT_TYPES.PLAY_PURCHASE_VOIDED,
      severity: 'error',
      source: 'payment',
      message: payment
        ? `A Google Play purchase of "${payment.plan}" was refunded or charged back. Review the business's entitlement.`
        : 'Google Play voided a purchase FlowBiz has no record of.',
      businessId: payment?.businessId || null,
      reference,
      dedupe: false,
    });
    return json({ ok: true, voided: Boolean(payment) });
  }
  return json({ ok: true });
}
