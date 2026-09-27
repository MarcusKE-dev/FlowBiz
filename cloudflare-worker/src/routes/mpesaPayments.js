// src/routes/mpesaPayments.js
//
// Direct M-Pesa payments: the customer stays in FlowBiz, types their
// phone number, and approves an STK prompt on their phone. Paystack is
// still the processor — this uses Paystack's Charge API
// (POST https://api.paystack.co/charge, mobile_money.provider "mpesa")
// instead of its hosted checkout.
//
//   POST /api/paystack/mpesa/charge   { plan, phone }
//   GET  /api/paystack/mpesa/status?reference=…
//
// ── The rule everything here is built around ──────────────────────────
//
// A PROMPT SENT IS NOT MONEY RECEIVED. Paystack answering /charge with
// `pay_offline` means only that the phone was asked. The customer can
// ignore it, cancel it, mistype the PIN or run out of balance. Nothing in
// this file grants anything on the strength of the charge call. The
// entitlement is applied only by lib/paymentSettlement.js, and only after
// Paystack's /transaction/verify says `success` AND the amount and
// currency match what was recorded here before the prompt was sent.
//
// ── Why the status route talks to Paystack at all ─────────────────────
//
// Paystack only webhooks success. A declined or expired prompt is found
// by asking /transaction/verify, so the status route does that — server-
// side, throttled per payment, never from the browser. When verify says
// success before the webhook has landed, the status route settles the
// payment itself through the same code the webhook uses; the settlement
// claim makes whichever arrives second a no-op.
//
// ── One prompt at a time ──────────────────────────────────────────────
//
// `paymentLocks/{businessId}` points at the payment currently in flight.
// A second "Send prompt" for the same plan while it is live resumes the
// existing one instead of ringing the phone again; a different plan is
// refused until the first settles or expires. Creating the lock is an
// atomic Firestore create, so two taps racing each other get one prompt.

import { json, errorResponse } from '../lib/response.js';
import { authorizeBillingOwner, purchaseRefusal, chargeForBusiness } from '../lib/purchaseGuard.js';
import {
  getDocument,
  createDocument,
  patchDocument,
  deleteDocument,
  queryCollection,
} from '../lib/firestore.js';
import { recordOpsEvent, EVENT_TYPES } from '../lib/opsEvents.js';
import { PLAN_PRICES, isPurchasablePlan } from '../lib/licensing.js';
import {
  MPESA_IN_FLIGHT_MS,
  MPESA_VERIFY_INTERVAL_MS,
  normalizeKenyanMsisdn,
  maskMsisdn,
  mpesaReference,
  isValidReference,
  classifyPaystackStatus,
} from '../lib/mpesa.js';
import {
  verifyPaystackTransaction,
  transactionMismatch,
  applyVerifiedPayment,
} from '../lib/paymentSettlement.js';

export const MPESA_CHANNEL = 'mpesa_stk';

const COULD_NOT_SEND = "We couldn't send the M-Pesa prompt. Please try again.";

function ms(value) {
  if (!value) return NaN;
  if (value instanceof Date) return value.getTime();
  return Date.parse(value);
}

/** Exactly what the browser is allowed to see about a payment. */
function publicView(reference, payment, extra = {}) {
  const createdMs = ms(payment.createdAt);
  return {
    reference,
    plan: payment.plan,
    amountKes: payment.amountKes,
    currency: 'KES',
    status: payment.status === 'success' ? 'success' : payment.status === 'failed' ? 'failed' : 'pending',
    reason: payment.status === 'failed' ? (payment.failureReason || 'declined') : null,
    phoneMasked: payment.phoneMasked || null,
    expiresAt: Number.isFinite(createdMs) ? new Date(createdMs + MPESA_IN_FLIGHT_MS).toISOString() : null,
    ...extra,
  };
}

// ── Reconciliation ─────────────────────────────────────────────────────

/**
 * Bring one pending payment up to date with Paystack. Used by the status
 * route, by the charge route before it decides a payment is in flight,
 * and by the daily cron for payments nobody is watching any more.
 *
 * @returns the payment as it now stands, plus `review: true` when Paystack
 *   reports success for something that does not match what was charged.
 */
export async function reconcilePayment(env, reference, payment, { force = false, now = Date.now() } = {}) {
  if (payment.status === 'success') return payment;
  // Only STK payments are ever failed or expired here. A hosted checkout
  // can be retried by the customer inside the same reference, so for
  // those this only ever settles a success the webhook missed.
  const isStk = payment.channel === MPESA_CHANNEL;
  if (payment.status === 'failed' && !force) return payment;
  if (payment.needsReview) return { ...payment, review: true };

  const lastVerified = ms(payment.lastVerifiedAt);
  if (!force && Number.isFinite(lastVerified) && now - lastVerified < MPESA_VERIFY_INTERVAL_MS) {
    return payment;
  }
  await patchDocument(env, 'payments', reference, { lastVerifiedAt: new Date(now) });

  const ageMs = now - ms(payment.createdAt);
  const { httpOk, httpStatus, apiOk, tx } = await verifyPaystackTransaction(env, reference);

  if (httpOk && apiOk && tx) {
    const { outcome, reason } = classifyPaystackStatus(tx.status, ageMs);

    if (outcome === 'success') {
      const mismatch = transactionMismatch(payment, reference, tx);
      if (mismatch) {
        await recordOpsEvent(env, {
          type: EVENT_TYPES.WEBHOOK_AMOUNT_MISMATCH,
          severity: 'error',
          source: 'payment',
          message: 'A verified Paystack transaction did not match the amount FlowBiz recorded when the M-Pesa prompt was sent; nothing was activated.',
          businessId: payment.businessId || null,
          reference,
          context: mismatch,
        });
        await patchDocument(env, 'payments', reference, { needsReview: true });
        return { ...payment, needsReview: true, review: true };
      }
      const { result } = await applyVerifiedPayment(env, reference, payment, tx, { source: 'status' });
      if (result === 'business_missing') return { ...payment, review: true };
      if (result === 'already') {
        // Someone else is settling it right now. Report what is stored;
        // the next poll will read `success`.
        return (await getDocument(env, 'payments', reference)) || payment;
      }
      return { ...payment, status: 'success' };
    }

    if (outcome === 'failed' && isStk && payment.status !== 'failed') {
      await patchDocument(env, 'payments', reference, {
        status: 'failed',
        failureReason: reason,
        failedAt: new Date(now),
        paystackStatus: String(tx.status || '').slice(0, 40),
      });
      return { ...payment, status: 'failed', failureReason: reason };
    }
    return payment;
  }

  // Paystack has never heard of this reference. That happens only when
  // the /charge call itself never reached Paystack; once the window a
  // prompt could have been answered in has passed, it is safe to say so.
  if (isStk && httpStatus === 404 && ageMs > MPESA_IN_FLIGHT_MS && payment.status !== 'failed') {
    await patchDocument(env, 'payments', reference, {
      status: 'failed',
      failureReason: 'not_started',
      failedAt: new Date(now),
    });
    return { ...payment, status: 'failed', failureReason: 'not_started' };
  }
  return payment;
}

// ── POST /api/paystack/mpesa/charge ──────────────────────────────────

export async function handleMpesaCharge(request, env) {
  const auth = await authorizeBillingOwner(request, env);
  if (auth.response) return auth.response;
  const { caller, profile } = auth;
  const businessId = profile.businessId;

  const body = await request.json().catch(() => ({}));

  // Unlike /initialize there is no default plan: a request that does not
  // say what it is buying is refused rather than guessed at.
  if (!isPurchasablePlan(body?.plan)) return errorResponse('Choose a plan to pay for.', 400);
  const plan = body.plan;
  // M-Pesa is a Kenyan rail and charges in shillings, so only a business
  // on the Kenyan price book may use it. An international business pays
  // by card through /api/paystack/initialize instead.
  const planPrice = await chargeForBusiness(env, businessId, plan);
  if (!planPrice || planPrice.currency !== 'KES') {
    return errorResponse('M-Pesa payment is only available to businesses registered in Kenya.', 409);
  }

  const msisdn = normalizeKenyanMsisdn(body?.phone);
  if (!msisdn) return errorResponse('Enter a valid Kenyan M-Pesa number.', 400);

  const business = await getDocument(env, 'businesses', businessId);
  const refusal = purchaseRefusal(plan, business);
  if (refusal) return refusal;

  const email = profile.email || caller.email;
  if (!email) return errorResponse('No email on file for this account.', 400);

  const now = Date.now();

  // ── Is a prompt already in flight for this business? ────────────────
  const lock = await getDocument(env, 'paymentLocks', businessId);
  if (lock?.reference && isValidReference(lock.reference)) {
    let existing = await getDocument(env, 'payments', lock.reference);
    if (existing && existing.status === 'pending') {
      // Ask Paystack before deciding: a prompt the customer already
      // declined should not block them from trying again.
      existing = await reconcilePayment(env, lock.reference, existing, { now });
    }
    // A lock with no payment behind it yet is a tap still being handled —
    // the other request has the lock and is writing its payment now.
    const lockFresh = now - ms(lock.createdAt) < MPESA_IN_FLIGHT_MS;
    if (!existing && lockFresh) {
      return errorResponse('An M-Pesa prompt is already being sent. Check your phone.', 409);
    }
    const live = existing
      && existing.status === 'pending'
      && now - ms(existing.createdAt) < MPESA_IN_FLIGHT_MS;
    if (live) {
      if (existing.plan === plan) {
        return json(publicView(lock.reference, existing, { resumed: true }));
      }
      return errorResponse(
        'Another M-Pesa payment is still waiting for confirmation. Please wait for it to finish before starting a new one.',
        409,
      );
    }
    if (existing?.status === 'success' && existing.plan === plan && now - ms(existing.confirmedAt) < MPESA_IN_FLIGHT_MS) {
      // The payment this tab is about to repeat has just been confirmed.
      // Show it rather than charge again.
      return json(publicView(lock.reference, existing, { resumed: true }));
    }
  }

  const reference = mpesaReference();
  if (lock) await deleteDocument(env, 'paymentLocks', businessId);
  try {
    await createDocument(env, 'paymentLocks', businessId, {
      businessId,
      reference,
      plan,
      createdAt: new Date(now),
      expiresAt: new Date(now + MPESA_IN_FLIGHT_MS),
    });
  } catch (err) {
    if (err?.message === 'DOCUMENT_ALREADY_EXISTS') {
      // Another tap won the race a moment ago.
      return errorResponse('An M-Pesa prompt is already being sent. Check your phone.', 409);
    }
    throw err;
  }

  const phoneMasked = maskMsisdn(msisdn);
  const payment = {
    businessId,
    plan,
    kind: planPrice.kind,
    description: planPrice.label,
    amountKes: planPrice.amountKes,
    amount: planPrice.amount,
    currency: 'KES',
    pricingRegion: planPrice.pricingRegion,
    billingPlatform: 'web',
    status: 'pending',
    channel: MPESA_CHANNEL,
    provider: 'mpesa',
    // Masked on purpose: support can recognise the number, a leaked
    // record cannot be used to target the customer.
    phoneMasked,
    createdAt: new Date(now),
    initializedBy: caller.uid,
  };

  // Recorded BEFORE Paystack is asked to ring the phone, so a webhook
  // that beats our own response still finds something authoritative to
  // check the money against.
  await createDocument(env, 'payments', reference, payment);

  let chargeRes;
  let chargeData;
  try {
    chargeRes = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        amount: String(planPrice.amountKes * 100),
        currency: 'KES',
        reference,
        mobile_money: { phone: msisdn, provider: 'mpesa' },
        metadata: { businessId, plan, channel: MPESA_CHANNEL },
      }),
    });
    chargeData = await chargeRes.json().catch(() => null);
  } catch (err) {
    // The request may or may not have reached Paystack, so the phone may
    // or may not be ringing. Leave the payment pending: the status route
    // asks Paystack, and a reference Paystack never saw is failed as
    // `not_started` once the window has passed.
    await recordOpsEvent(env, {
      type: EVENT_TYPES.PAYMENT_INIT_FAILED,
      severity: 'error',
      source: 'payment',
      message: 'Could not reach Paystack to send an M-Pesa prompt. The payment was left pending for reconciliation.',
      businessId,
      reference,
      context: { plan, reason: err?.message || 'network' },
    });
    return json(publicView(reference, payment, { uncertain: true }), { status: 202 });
  }

  const chargeStatus = chargeData?.data?.status;
  // Anything else — an OTP, a birthday, a redirect — is a step this
  // screen cannot complete, so it is treated as a failure to start.
  const started = chargeRes.ok && chargeData?.status && ['pay_offline', 'pending', 'success'].includes(chargeStatus);

  if (!started) {
    await patchDocument(env, 'payments', reference, {
      status: 'failed',
      failureReason: 'not_started',
      failedAt: new Date(),
      paystackStatus: String(chargeStatus || chargeRes.status).slice(0, 40),
    });
    await deleteDocument(env, 'paymentLocks', businessId).catch(() => {});
    await recordOpsEvent(env, {
      type: EVENT_TYPES.PAYMENT_INIT_FAILED,
      severity: 'error',
      source: 'payment',
      message: 'Paystack did not start an M-Pesa charge.',
      businessId,
      reference,
      context: {
        plan,
        status: chargeRes.status,
        chargeStatus: String(chargeStatus || 'none'),
        message: String(chargeData?.message || '').slice(0, 200),
      },
    });
    return errorResponse(COULD_NOT_SEND, 502);
  }

  await patchDocument(env, 'payments', reference, { paystackStatus: String(chargeStatus) });
  // Deliberately `pending` even when Paystack said `success`: the verify
  // + settle path is the only thing that marks a payment paid.
  return json(publicView(reference, payment));
}

// ── GET /api/paystack/mpesa/status?reference=… ───────────────────────

export async function handleMpesaStatus(request, env, url) {
  const auth = await authorizeBillingOwner(request, env);
  if (auth.response) return auth.response;
  const { profile } = auth;

  const reference = url.searchParams.get('reference');
  if (!isValidReference(reference)) return errorResponse('Payment not found.', 404);

  let payment = await getDocument(env, 'payments', reference);
  // Another business's payment is indistinguishable from one that does
  // not exist: a guessed reference learns nothing.
  if (!payment || payment.businessId !== profile.businessId) {
    return errorResponse('Payment not found.', 404);
  }

  const now = Date.now();
  if (payment.status !== 'success') {
    payment = await reconcilePayment(env, reference, payment, { now });
  }

  const view = publicView(reference, payment);
  // Paystack says paid, but not what FlowBiz charged. Nothing was granted
  // and the customer must not be told to pay again; support resolves it.
  if (payment.review) view.status = 'review';
  view.delayed = view.status === 'pending' && now - ms(payment.createdAt) > MPESA_IN_FLIGHT_MS;
  return json(view);
}

// ── Cron: payments nobody is watching any more ───────────────────────

/**
 * A customer who closes FlowBiz mid-payment leaves a pending row. If they
 * paid, the webhook settles it; this catches the rest — a webhook that
 * never arrived, a prompt that expired — so the admin view does not fill
 * with payments that are not really pending. It only ever asks Paystack;
 * it cannot grant anything Paystack does not confirm.
 */
export async function reconcileStaleMpesaPayments(env, { limit = 50, now = Date.now() } = {}) {
  const rows = await queryCollection(env, 'payments', {
    filters: [
      { field: 'status', value: 'pending' },
      { field: 'channel', value: MPESA_CHANNEL },
    ],
    limit,
  });
  let settled = 0;
  let failed = 0;
  for (const row of rows) {
    if (!(now - ms(row.createdAt) > MPESA_IN_FLIGHT_MS)) continue;
    try {
      const after = await reconcilePayment(env, row.id, row, { force: true, now });
      if (after.status === 'success') settled += 1;
      else if (after.status === 'failed') failed += 1;
    } catch (err) {
      console.warn('[mpesa reconcile]', row.id, err?.message);
    }
  }
  return { checked: rows.length, settled, failed };
}
