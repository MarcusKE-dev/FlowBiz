// src/routes/paystackWebhook.js
//
// POST /api/paystack/webhook — called directly by Paystack, not by
// FlowBiz's frontend. It is the authoritative completion path for BOTH
// the hosted checkout and the direct M-Pesa STK charge; they share one
// reference space and one `payments` collection. Protections, all required:
//   1. HMAC signature check (proves the request really came from Paystack)
//   2. Idempotency (a redelivered webhook must not extend twice) — the
//      payment status check, plus the one-winner settlement claim in
//      lib/paymentSettlement.js for deliveries that arrive together
//   3. Server-side re-verification against Paystack's own API, with the
//      amount and currency cross-checked against what FlowBiz recorded when
//      the payment was started (proves the payment was for what we
//      actually charged, not whatever the payload claims)
//
// What a confirmed payment grants is decided in lib/paymentSettlement.js.

import { errorResponse } from '../lib/response.js';
import { getDocument } from '../lib/firestore.js';
// Observation only. Every recordOpsEvent() call below runs AFTER the
// decision it reports has already been made and cannot throw.
import { recordOpsEvent, EVENT_TYPES } from '../lib/opsEvents.js';
import {
  verifyPaystackTransaction,
  transactionMismatch,
  applyVerifiedPayment,
} from '../lib/paymentSettlement.js';

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Compared in constant time so the check leaks nothing about how much of
// a forged signature was right.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyPaystackSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return safeEqual(bytesToHex(new Uint8Array(mac)), signatureHeader.trim().toLowerCase());
}

export async function handlePaystackWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  const validSignature = await verifyPaystackSignature(rawBody, signature, env.PAYSTACK_SECRET_KEY);
  if (!validSignature) {
    // Either Paystack's secret has been rotated out from under us, or
    // something is impersonating Paystack. The signature is never recorded.
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
  if (!reference || typeof reference !== 'string') return errorResponse('Missing reference.', 400);

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

  // IDEMPOTENCY, first line — the common redelivery after a completed
  // settlement. The claim inside applyVerifiedPayment is the second.
  if (paymentRecord.status === 'success') {
    return new Response('ok', { status: 200 });
  }

  // Re-verify directly against Paystack rather than trusting the payload.
  const { httpOk, apiOk, tx } = await verifyPaystackTransaction(env, reference);

  if (!httpOk || !apiOk || tx?.status !== 'success') {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.WEBHOOK_VERIFY_FAILED,
      severity: 'error',
      source: 'webhook',
      message: 'Paystack re-verification did not confirm this transaction as successful; no entitlement was granted.',
      businessId: paymentRecord.businessId || null,
      reference,
      context: { paystackStatus: tx?.status || 'none', httpOk },
    });
    return errorResponse('Transaction could not be verified as successful.', 400);
  }

  const mismatch = transactionMismatch(paymentRecord, reference, tx);
  if (mismatch) {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.WEBHOOK_AMOUNT_MISMATCH,
      severity: 'error',
      source: 'webhook',
      message: 'A verified Paystack transaction did not match the amount FlowBiz recorded at initialisation; nothing was activated.',
      businessId: paymentRecord.businessId || null,
      reference,
      context: mismatch,
    });
    return errorResponse('Amount or currency mismatch. The subscription was not activated.', 400);
  }

  const { result } = await applyVerifiedPayment(env, reference, paymentRecord, tx, { source: 'webhook' });
  if (result === 'business_missing') return errorResponse('Business not found for this payment.', 404);
  return new Response('ok', { status: 200 });
}
