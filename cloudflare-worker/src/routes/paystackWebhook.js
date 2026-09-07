// src/routes/paystackWebhook.js
//
// POST /api/paystack/webhook — called directly by Paystack, not by
// FlowBiz's frontend. Three layers of protection, all required:
//   1. HMAC signature check (proves the request really came from Paystack)
//   2. Idempotency check (a redelivered webhook must not extend twice)
//   3. Server-side re-verification against Paystack's own API, with the
//      amount cross-checked against what /initialize recorded (proves the
//      payment was for what we actually charged, not whatever the payload
//      claims)
//
// ── What a confirmed payment does ─────────────────────────────────────
//
//   pro             → extends the monthly subscription by 30 days.
//                     Untouched by the licensing work.
//   lifetime        → creates the PERPETUAL LICENCE and starts the first
//                     12-month annual services period, in one write.
//   annual_services → extends the annual services period by 12 months,
//                     FROM THE EXISTING EXPIRY when one is still running.
//                     The licence itself is not involved.
//
// Nothing here can ever expire, revoke or shorten a licence. The only
// licence field this file writes is the one that creates it.

import { errorResponse } from '../lib/response.js';
import { getDocument, patchDocument } from '../lib/firestore.js';
// Observation only. Every recordOpsEvent() call below runs AFTER the
// decision it reports has already been made, is awaited only so it lands
// before the response, and cannot throw (see lib/opsEvents.js). The three
// protections above — HMAC, idempotency, server-side re-verification —
// and the subscription arithmetic are untouched.
import { recordOpsEvent, EVENT_TYPES } from '../lib/opsEvents.js';
import {
  lifetimeActivationPayload,
  serviceRenewalPayload,
  resolveEntitlements,
  toDate,
} from '../lib/licensing.js';

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPaystackSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return bytesToHex(new Uint8Array(mac)) === signatureHeader;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function handlePaystackWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  const validSignature = await verifyPaystackSignature(rawBody, signature, env.PAYSTACK_SECRET_KEY);
  if (!validSignature) {
    // A failed signature check is the one webhook event that is always
    // worth seeing: either Paystack's secret has been rotated out from
    // under us, or something is impersonating Paystack. The signature
    // itself is never recorded.
    await recordOpsEvent(env, {
      type: EVENT_TYPES.WEBHOOK_SIGNATURE_INVALID,
      severity: 'error',
      source: 'webhook',
      message: 'A Paystack webhook failed HMAC signature verification and was rejected.',
      context: { hadSignatureHeader: Boolean(signature) },
    });
    return errorResponse('Invalid signature.', 401);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return errorResponse('Invalid JSON.', 400);
  }

  if (event.event !== 'charge.success') {
    return new Response('ok', { status: 200 }); // acknowledge, ignore other event types
  }

  const reference = event.data?.reference;
  if (!reference) return errorResponse('Missing reference.', 400);

  const paymentRecord = await getDocument(env, 'payments', reference);
  if (!paymentRecord) {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.WEBHOOK_UNKNOWN_REFERENCE,
      severity: 'warning',
      source: 'webhook',
      message: 'A signed Paystack webhook referenced a payment FlowBiz has no record of.',
      reference,
    });
    return errorResponse('Unknown payment reference.', 404);
  }

  // IDEMPOTENCY — Paystack can and does redeliver webhooks.
  //
  // THIS IS THE ONLY THING STANDING BETWEEN A REDELIVERED EVENT AND A
  // DOUBLE RENEWAL. A payment reference is minted once per checkout and
  // its document flips to `success` exactly once, so the twelve months
  // added below can only ever be added once per reference no matter how
  // many times Paystack sends the same event.
  if (paymentRecord.status === 'success') {
    return new Response('ok', { status: 200 });
  }

  // Re-verify directly against Paystack rather than trusting the payload.
  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
  });
  const verifyData = await verifyRes.json();
  const tx = verifyData?.data;

  if (!verifyRes.ok || !verifyData.status || tx?.status !== 'success') {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.WEBHOOK_VERIFY_FAILED,
      severity: 'error',
      source: 'webhook',
      message: 'Paystack re-verification did not confirm this transaction as successful; no entitlement was granted.',
      businessId: paymentRecord.businessId || null,
      reference,
      context: { paystackStatus: tx?.status || 'none', httpOk: verifyRes.ok },
    });
    return errorResponse('Transaction could not be verified as successful.', 400);
  }
  const expectedAmountKobo = Math.round((paymentRecord.amountKes || 0) * 100);
  if (tx.amount !== expectedAmountKobo || tx.currency !== 'KES') {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.WEBHOOK_AMOUNT_MISMATCH,
      severity: 'error',
      source: 'webhook',
      message: 'A verified Paystack transaction did not match the amount FlowBiz recorded at initialisation; nothing was activated.',
      businessId: paymentRecord.businessId || null,
      reference,
      context: { expectedKobo: expectedAmountKobo, receivedKobo: tx.amount, currency: tx.currency },
    });
    return errorResponse('Amount or currency mismatch. The subscription was not activated.', 400);
  }

  const businessId = paymentRecord.businessId;
  const business = await getDocument(env, 'businesses', businessId);
  if (!business) {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.WEBHOOK_BUSINESS_MISSING,
      severity: 'error',
      source: 'webhook',
      message: 'A confirmed payment could not be applied: the business it belongs to no longer exists.',
      businessId,
      reference,
    });
    return errorResponse('Business not found for this payment.', 404);
  }

  const now = new Date();
  const entitlements = resolveEntitlements(business, now);
  const holdsLifetime = entitlements.license.owned;

  // A CONFIRMED PRO PAYMENT MUST NEVER DEMOTE A LIFETIME LICENCE.
  //
  // /initialize refuses to start a Pro checkout for a business that
  // already holds Lifetime, but that check happens when the checkout
  // OPENS, and this one happens when it is PAID. A merchant who opened a
  // Pro checkout, changed their mind, bought Lifetime instead, and then
  // went back and completed the abandoned Pro tab would have had their
  // perpetual licence overwritten with a 30-day subscription by the code
  // below. The payment itself is real and stays recorded as successful;
  // what it must not do is take away something the business already
  // bought outright.
  if (holdsLifetime && paymentRecord.plan === 'pro') {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.WEBHOOK_VERIFY_FAILED,
      severity: 'warning',
      source: 'webhook',
      message: 'A confirmed Pro payment arrived for a business that already holds a Lifetime licence. The payment is recorded; the licence was left alone.',
      businessId,
      reference,
    });
    await patchDocument(env, 'payments', reference, {
      status: 'success',
      confirmedAt: now,
      paystackTransactionId: String(tx.id || ''),
      supersededByLifetime: true,
    });
    return new Response('ok', { status: 200 });
  }

  // ── Apply the payment ────────────────────────────────────────────────
  const updates = {};
  const events = [];

  if (paymentRecord.plan === 'lifetime') {
    if (holdsLifetime) {
      // Two lifetime checkouts, both paid. /initialize refuses the second,
      // so this is a stale tab completed after the first one landed. The
      // customer-favourable, non-destructive answer is to treat the money
      // as service time rather than reset the licence — resetting would
      // recompute the service period from today and could SHORTEN a
      // period they had already extended.
      updates.licensing = serviceRenewalPayload(business, {
        now, reference, amountKes: paymentRecord.amountKes,
      });
      events.push({
        type: EVENT_TYPES.SERVICE_RENEWED,
        severity: 'warning',
        message: 'A second Lifetime payment arrived for a business that already owns a licence. It was applied as a 12-month service extension rather than re-creating the licence.',
      });
    } else {
      // One-time, perpetual — no expiry, no extension math on the licence
      // itself. Idempotency above already guarantees this branch only ever
      // runs once per payment reference.
      updates.licensing = lifetimeActivationPayload(business, {
        now, reference, amountKes: paymentRecord.amountKes,
      });
      // `subscription` is kept in step so every existing reader — the
      // admin directory, an older browser build, the purge tooling — keeps
      // seeing the plan it already understands. It is a MIRROR of the
      // licence, never the authority for it.
      updates.subscription = { plan: 'lifetime', status: 'active', expiresAt: null, purchasedAt: now };
      events.push({
        type: EVENT_TYPES.LICENSE_ACTIVATED,
        severity: 'info',
        message: 'A FlowBiz Lifetime Licence was activated, including the first 12 months of cloud services, maintenance, updates and support.',
      });
      events.push({
        type: EVENT_TYPES.SERVICE_PERIOD_STARTED,
        severity: 'info',
        message: 'The first annual cloud services period started with a Lifetime Licence purchase.',
      });
    }
  } else if (paymentRecord.plan === 'annual_services') {
    if (!holdsLifetime) {
      // A renewal for a business with no licence to renew. The money is
      // real and is recorded as such, but nothing is granted and a human
      // has to look at it — silently extending a service period for a
      // business that owns nothing would invent an entitlement.
      await recordOpsEvent(env, {
        type: EVENT_TYPES.SERVICE_RENEWAL_UNAPPLIED,
        severity: 'error',
        source: 'webhook',
        message: 'An annual services payment was confirmed for a business that does not own a Lifetime Licence. The payment is recorded and needs manual review.',
        businessId,
        reference,
        dedupe: false,
      });
      await patchDocument(env, 'payments', reference, {
        status: 'success',
        confirmedAt: now,
        paystackTransactionId: String(tx.id || ''),
        applied: false,
        unappliedReason: 'no_lifetime_license',
      });
      return new Response('ok', { status: 200 });
    }

    updates.licensing = serviceRenewalPayload(business, {
      now, reference, amountKes: paymentRecord.amountKes,
    });
    events.push({
      type: EVENT_TYPES.SERVICE_RENEWED,
      severity: 'info',
      message: 'Annual cloud services, maintenance, updates and support were renewed for 12 months.',
    });
  } else {
    const currentExpiry = business.subscription?.expiresAt ? new Date(business.subscription.expiresAt) : null;
    // Extend from the current expiry if still active; otherwise start fresh from now.
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    updates.subscription = { plan: 'pro', status: 'active', expiresAt: addDays(base, 30) };
  }

  await patchDocument(env, 'businesses', businessId, updates);

  await patchDocument(env, 'payments', reference, {
    status: 'success',
    confirmedAt: now,
    paystackTransactionId: String(tx.id || ''),
    applied: true,
    // Recorded on the payment so a billing history line can say what the
    // money actually bought without re-deriving it from the licence.
    serviceExpiryAfter: toDate(updates.licensing?.serviceExpiryDate) || null,
  });

  for (const item of events) {
    await recordOpsEvent(env, {
      type: item.type,
      severity: item.severity,
      source: 'webhook',
      message: item.message,
      businessId,
      reference,
      // Every one of these is a distinct financial event. See opsEvents.js.
      dedupe: false,
      context: {
        plan: paymentRecord.plan,
        amountKes: paymentRecord.amountKes || 0,
        serviceExpiry: updates.licensing?.serviceExpiryDate
          ? new Date(updates.licensing.serviceExpiryDate).toISOString()
          : 'none',
      },
    });
  }

  return new Response('ok', { status: 200 });
}
