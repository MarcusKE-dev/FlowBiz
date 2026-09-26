// cloudflare-worker/src/lib/mpesa.js
//
// The pieces of the direct M-Pesa flow that are pure: phone numbers,
// references, and what a Paystack transaction status means for a
// payment that was started with an STK prompt.
//
// Paystack's Charge API (POST /charge with `mobile_money.provider:
// "mpesa"`) wants a Kenyan number WITH its country code, "+2547XXXXXXXX".
// The customer has 180 seconds to answer the prompt on their phone, after
// which Paystack fails the transaction. Only `charge.success` is sent as
// a webhook — a declined, cancelled or ignored prompt is found out by
// asking /transaction/verify, which is what the status route does.

/** How long Paystack gives the customer to answer the STK prompt. */
export const MPESA_AUTH_WINDOW_MS = 180 * 1000;

/**
 * How long past that window a payment stays "in flight" — the time a
 * second STK is refused for the same business, and after which a payment
 * Paystack still calls abandoned is treated as expired. The margin covers
 * M-Pesa's own settlement lag, so a prompt answered in second 179 is not
 * written off before its confirmation lands.
 */
export const MPESA_IN_FLIGHT_MS = MPESA_AUTH_WINDOW_MS + 60 * 1000;

/** The status route asks Paystack at most this often per payment. */
export const MPESA_VERIFY_INTERVAL_MS = 8 * 1000;

// Phone numbers have ONE implementation, shared with the browser's form,
// for the same reason the licensing arithmetic does (see licensing.js).
export { normalizeKenyanMsisdn, maskMsisdn } from '../../../src/licensing/mpesa.js';

/**
 * A reference for a direct charge. Paystack's /charge accepts only
 * alphanumerics, '-', '.' and '='; the checkout references use '_', so
 * this flow mints its own. It carries no business id: the payments
 * document it names is what ties it to a business, server-side.
 */
export function mpesaReference() {
  return `fbm-${crypto.randomUUID()}`;
}

/** What any stored reference may look like before it touches a path. */
export function isValidReference(reference) {
  return typeof reference === 'string' && /^[A-Za-z0-9._=-]{8,120}$/.test(reference);
}

/**
 * Paystack's verify status → what FlowBiz does with a pending payment.
 *
 *   'success'  → settle it (after the amount and currency checks)
 *   'failed'   → terminal; nothing is granted
 *   'pending'  → keep waiting
 *
 * `abandoned` is NOT failure while the prompt can still be answered:
 * Paystack reports it until the customer acts. Only once the in-flight
 * window has passed does it become expiry. A payment marked failed here
 * can still be settled later by a verified `charge.success` — the webhook
 * trusts Paystack's verify, not this record's status.
 */
export function classifyPaystackStatus(txStatus, ageMs) {
  if (txStatus === 'success') return { outcome: 'success' };
  if (txStatus === 'failed') return { outcome: 'failed', reason: 'declined' };
  if (txStatus === 'reversed') return { outcome: 'failed', reason: 'reversed' };
  if (txStatus === 'abandoned' && ageMs > MPESA_IN_FLIGHT_MS) return { outcome: 'failed', reason: 'expired' };
  return { outcome: 'pending' };
}
