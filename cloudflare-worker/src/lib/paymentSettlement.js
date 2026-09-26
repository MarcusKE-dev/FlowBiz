// cloudflare-worker/src/lib/paymentSettlement.js
//
// Turning a Paystack transaction into a FlowBiz entitlement, in ONE place.
//
// Two callers reach this: the signed webhook, and the M-Pesa status route
// when Paystack's own /transaction/verify already says success but the
// webhook has not arrived yet. Both go through exactly the same checks
// and the same arithmetic, so a payment cannot be applied one way when
// the webhook is fast and another way when it is slow.
//
// ── What a confirmed payment does ─────────────────────────────────────
//
//   pro             → extends the monthly subscription by 30 days, from
//                     the current expiry while one is still running.
//   lifetime        → creates the PERPETUAL LICENCE and starts the first
//                     12-month annual services period, in one write.
//   annual_services → extends the annual services period by 12 months,
//                     FROM THE EXISTING EXPIRY when one is still running.
//
// Nothing here can ever expire, revoke or shorten a licence.
//
// ── Exactly once ──────────────────────────────────────────────────────
//
// `payments/{ref}.status === 'success'` stops a redelivered event that
// arrives AFTER the first one finished. It does not stop two that arrive
// together — a webhook redelivery racing the status route, say — because
// both read `pending` before either writes. The claim document closes
// that gap: Firestore's create fails if the document exists, so exactly
// one caller per reference gets past it. If applying then fails, the
// claim is released so Paystack's retry can try again.

import { getDocument, patchDocument, createDocument, deleteDocument } from './firestore.js';
import { recordOpsEvent, EVENT_TYPES } from './opsEvents.js';
import {
  lifetimeActivationPayload,
  serviceRenewalPayload,
  resolveEntitlements,
  toDate,
} from './licensing.js';

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Paystack's own view of a reference. Never throws. */
export async function verifyPaystackTransaction(env, reference) {
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
    });
    const body = await res.json().catch(() => null);
    return { httpOk: res.ok, httpStatus: res.status, apiOk: Boolean(body?.status), tx: body?.data || null };
  } catch {
    return { httpOk: false, httpStatus: 0, apiOk: false, tx: null };
  }
}

/**
 * Does a Paystack-successful transaction match what FlowBiz charged?
 * Returns null when it does, or a description of the mismatch.
 */
export function transactionMismatch(paymentRecord, reference, tx) {
  const expectedKobo = Math.round((paymentRecord.amountKes || 0) * 100);
  if (tx.reference && tx.reference !== reference) {
    return { expectedKobo, receivedKobo: tx.amount, currency: tx.currency, referenceMismatch: true };
  }
  if (tx.amount !== expectedKobo || tx.currency !== 'KES') {
    return { expectedKobo, receivedKobo: tx.amount, currency: tx.currency };
  }
  return null;
}

/**
 * Apply a VERIFIED, AMOUNT-CHECKED successful transaction.
 *
 * @returns {Promise<{ result: 'applied'|'already'|'recorded'|'business_missing' }>}
 *   'applied'  — the entitlement was granted/extended by this call
 *   'already'  — another call settled (or is settling) this reference
 *   'recorded' — the money is recorded as successful but deliberately
 *                granted nothing (see the two guarded branches below)
 */
export async function applyVerifiedPayment(env, reference, paymentRecord, tx, { source = 'webhook' } = {}) {
  if (paymentRecord.status === 'success') return { result: 'already' };

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
    return { result: 'business_missing' };
  }

  // The one-winner gate. See the header.
  try {
    await createDocument(env, 'paymentSettlements', reference, {
      businessId,
      plan: paymentRecord.plan,
      claimedAt: new Date(),
      source,
    });
  } catch (err) {
    if (err?.message === 'DOCUMENT_ALREADY_EXISTS') return { result: 'already' };
    throw err;
  }

  const progress = { granted: false };
  try {
    return await applyClaimed(env, reference, paymentRecord, tx, business, progress);
  } catch (err) {
    // Nothing was granted, so let the next delivery try again rather than
    // leaving a paid customer stuck behind a claim nobody finished. Once
    // the business write has landed the claim is KEPT: releasing it then
    // would let a retry grant the same payment twice.
    if (!progress.granted) {
      await deleteDocument(env, 'paymentSettlements', reference).catch(() => {});
    }
    throw err;
  }
}

async function applyClaimed(env, reference, paymentRecord, tx, business, progress) {
  const businessId = paymentRecord.businessId;
  const now = new Date();
  const entitlements = resolveEntitlements(business, now);
  const holdsLifetime = entitlements.license.owned;
  const successFields = {
    status: 'success',
    confirmedAt: now,
    paystackTransactionId: String(tx.id || ''),
    // What Paystack actually used — 'mobile_money' for an STK charge,
    // 'card' and so on for checkout. Reporting reads this.
    paystackChannel: typeof tx.channel === 'string' ? tx.channel.slice(0, 40) : null,
    failureReason: null,
  };

  // A CONFIRMED PRO PAYMENT MUST NEVER DEMOTE A LIFETIME LICENCE.
  //
  // /initialize refuses to start a Pro checkout for a business that
  // already holds Lifetime, but that check happens when the checkout
  // OPENS, and this one happens when it is PAID. The payment is real and
  // stays recorded as successful; what it must not do is take away
  // something the business already bought outright.
  if (holdsLifetime && paymentRecord.plan === 'pro') {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.WEBHOOK_VERIFY_FAILED,
      severity: 'warning',
      source: 'webhook',
      message: 'A confirmed Pro payment arrived for a business that already holds a Lifetime licence. The payment is recorded; the licence was left alone.',
      businessId,
      reference,
    });
    await patchDocument(env, 'payments', reference, { ...successFields, supersededByLifetime: true });
    return { result: 'recorded' };
  }

  const updates = {};
  const events = [];

  if (paymentRecord.plan === 'lifetime') {
    if (holdsLifetime) {
      // Two lifetime purchases, both paid. The customer-favourable,
      // non-destructive answer is to treat the money as service time
      // rather than reset the licence — resetting would recompute the
      // service period from today and could SHORTEN one already extended.
      updates.licensing = serviceRenewalPayload(business, {
        now, reference, amountKes: paymentRecord.amountKes,
      });
      events.push({
        type: EVENT_TYPES.SERVICE_RENEWED,
        severity: 'warning',
        message: 'A second Lifetime payment arrived for a business that already owns a licence. It was applied as a 12-month service extension rather than re-creating the licence.',
      });
    } else {
      updates.licensing = lifetimeActivationPayload(business, {
        now, reference, amountKes: paymentRecord.amountKes,
      });
      // `subscription` is a MIRROR of the licence for every existing
      // reader, never the authority for it.
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
      // Silently extending a service period for a business that owns
      // nothing would invent an entitlement. Recorded; a human decides.
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
        ...successFields,
        applied: false,
        unappliedReason: 'no_lifetime_license',
      });
      return { result: 'recorded' };
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
  progress.granted = true;

  await patchDocument(env, 'payments', reference, {
    ...successFields,
    applied: true,
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

  return { result: 'applied' };
}
