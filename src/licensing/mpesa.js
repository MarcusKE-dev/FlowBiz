// src/licensing/mpesa.js
//
// The M-Pesa checkout's pure half: phone numbers and the screen's state
// machine. No React, no Firebase, no Vite env access — the Worker imports the
// phone functions from here (cloudflare-worker/src/lib/mpesa.js), exactly
// as it imports the licensing arithmetic, so the browser can never accept
// a number the server would refuse or the other way round.
//
// The browser's check is for the customer's benefit only. The Worker
// normalises the number again and is the one that decides.

/**
 * Any common way a Kenyan types their M-Pesa number, to the format
 * Paystack's Charge API accepts ("+2547XXXXXXXX" / "+2541XXXXXXXX").
 * Null for anything that is not a Kenyan mobile number.
 *
 *   0712345678, 712345678, 254712345678, +254712345678, 00254712345678
 *   0112345678, 112345678, 254112345678, +254112345678
 */
export function normalizeKenyanMsisdn(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const raw = String(input).trim();
  if (!raw || raw.length > 24) return null;
  // Spaces, dashes, dots and brackets are how people group numbers.
  // Anything else (letters, a second '+') makes it not a phone number.
  if (!/^\+?[\d\s\-().]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('00254')) digits = digits.slice(5);
  else if (digits.startsWith('254')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  else if (raw.startsWith('+')) return null; // another country's code

  if (!/^[17]\d{8}$/.test(digits)) return null;
  return `+254${digits}`;
}

/** "+254712345678" → "0712 *** 678". */
export function maskMsisdn(msisdn) {
  const n = normalizeKenyanMsisdn(msisdn);
  if (!n) return null;
  const local = `0${n.slice(4)}`;
  return `${local.slice(0, 4)} *** ${local.slice(-3)}`;
}

export const INVALID_PHONE_MESSAGE = 'Enter a valid Kenyan M-Pesa number.';
export const COULD_NOT_SEND_MESSAGE = "We couldn't send the M-Pesa prompt. Please try again.";
export const OFFLINE_MESSAGE = 'An internet connection is required to complete this payment.';

// ── The screen's state machine ────────────────────────────────────────
//
//   form ──send──▶ sending ──accepted──▶ waiting ──success──▶ success
//     ▲              │                     │  │
//     └──refused─────┘                     │  └──failed──▶ failed ──retry──▶ form
//                                          ▼
//                                       delayed ──success──▶ success
//
// The one thing it must never do is turn "we have not heard yet" into
// "failed". A network error while polling, a slow webhook, a Paystack
// verify that still says pending — all of those keep the customer in
// waiting/delayed, where the copy says do NOT pay again. Only a verdict
// the SERVER reports as failed reaches `failed`, and only `failed` offers
// a retry.

export const MPESA_PHASES = ['form', 'sending', 'waiting', 'delayed', 'success', 'failed', 'review'];

export function initialMpesaState(plan) {
  return { phase: 'form', plan, error: null, payment: null };
}

/** A server payment view → the phase it puts the screen in. */
export function phaseForPayment(payment) {
  switch (payment?.status) {
    case 'success': return 'success';
    case 'failed': return 'failed';
    case 'review': return 'review';
    case 'pending': return payment.delayed ? 'delayed' : 'waiting';
    default: return null;
  }
}

export function mpesaReducer(state, action) {
  switch (action.type) {
    case 'send':
      if (state.phase !== 'form' && state.phase !== 'failed') return state; // one prompt at a time
      return { ...state, phase: 'sending', error: null };

    case 'refused':
      // The server said no before any prompt was sent (bad number, plan
      // not allowed, Paystack would not start it). Safe to fix and resend.
      return { ...state, phase: 'form', error: action.error || COULD_NOT_SEND_MESSAGE };

    case 'payment': {
      // Where the screen is in the lifecycle only moves forward: once a
      // payment has succeeded, a stale poll answering "pending" must not
      // put the customer back into waiting.
      if (state.phase === 'success') return state;
      const phase = phaseForPayment(action.payment);
      if (!phase) return state;
      return { ...state, phase, error: null, payment: { ...state.payment, ...action.payment } };
    }

    case 'retry':
      if (state.phase !== 'failed') return state;
      return { ...state, phase: 'form', error: null, payment: null };

    case 'reset':
      return initialMpesaState(action.plan ?? state.plan);

    default:
      return state;
  }
}

/** Customer-facing copy for a failed payment's reason. */
export function failureCopy(reason) {
  switch (reason) {
    case 'expired':
      return 'The M-Pesa prompt expired before it was answered. No money was taken.';
    case 'not_started':
      return "The M-Pesa prompt couldn't be sent. No money was taken.";
    default:
      return "The payment wasn't completed. No money was taken.";
  }
}

/** Poll quickly while the prompt can be answered, then back off. */
export function pollDelayMs(phase) {
  return phase === 'delayed' ? 10_000 : 4_000;
}
