// cloudflare-worker/src/lib/opsEvents.js
//
// A deliberately small operational event log.
//
// FlowBiz had NO error monitoring before this file: a Paystack webhook
// that failed its signature check, or a verification that came back with
// the wrong amount, returned an HTTP error to a machine and vanished. The
// admin console could not answer "is anything broken right now?" because
// nothing was ever recorded.
//
// The temptation is to fix that with telemetry. This is not that. The
// rules it holds itself to:
//
//   * ONLY operationally meaningful FAILURES and security events are
//     recorded. Never a page view, never a successful request, never a
//     Firestore read, never a button click.
//   * Identical events are suppressed inside a short window, so a
//     misconfigured integration retrying in a loop writes a handful of
//     documents, not thousands.
//   * The payload is a fixed, small, allow-listed shape. No request
//     bodies, no headers, no tokens, no signatures, no keys, no emails
//     beyond the masked form. If a field is not on the list it does not
//     get written.
//   * Every write is best-effort. Monitoring must never break the thing
//     it is monitoring — recordOpsEvent cannot throw.
//
// Expected volume on a healthy platform: single digits per day.

import { createDocument } from './firestore.js';

export const SEVERITIES = ['info', 'warning', 'error'];

export const EVENT_TYPES = {
  WEBHOOK_SIGNATURE_INVALID: 'webhook.signature_invalid',
  WEBHOOK_UNKNOWN_REFERENCE: 'webhook.unknown_reference',
  WEBHOOK_VERIFY_FAILED: 'webhook.verify_failed',
  WEBHOOK_AMOUNT_MISMATCH: 'webhook.amount_mismatch',
  WEBHOOK_BUSINESS_MISSING: 'webhook.business_missing',
  PAYMENT_INIT_FAILED: 'payment.initialize_failed',
  EMAIL_SEND_FAILED: 'email.send_failed',
  ADMIN_ACCESS_DENIED: 'admin.access_denied',
  ADMIN_ROUTE_ERROR: 'admin.route_error',
};

// type|businessId -> last write time, per isolate.
const recent = new Map();
const SUPPRESS_WINDOW_MS = 2 * 60 * 1000;

// Anything that could carry a credential is dropped before it is written,
// even if a future caller passes it by mistake.
const FORBIDDEN_KEY = /(secret|token|key|password|signature|authorization|cookie|bearer)/i;

function sanitizeContext(context) {
  const out = {};
  if (!context || typeof context !== 'object') return out;
  let n = 0;
  for (const [rawKey, rawValue] of Object.entries(context)) {
    if (n >= 10) break;
    if (FORBIDDEN_KEY.test(rawKey)) continue;
    if (rawValue === null || rawValue === undefined) continue;
    const type = typeof rawValue;
    if (type === 'number' || type === 'boolean') {
      out[rawKey] = rawValue;
      n++;
    } else if (type === 'string') {
      out[rawKey] = rawValue.slice(0, 200);
      n++;
    }
  }
  return out;
}

/** name@example.com -> n***@example.com. Enough to correlate, not to harvest. */
export function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Records one operational event. Never throws, never blocks a decision
 * that has already been made.
 *
 * @returns {Promise<boolean>} true if a document was written
 */
export async function recordOpsEvent(env, {
  type,
  severity = 'error',
  source = 'worker',
  message = '',
  businessId = null,
  reference = null,
  context = {},
} = {}) {
  try {
    if (!type) return false;
    const key = `${type}|${businessId || '-'}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < SUPPRESS_WINDOW_MS) return false;

    if (recent.size > 200) {
      for (const [k, t] of recent) if (now - t >= SUPPRESS_WINDOW_MS) recent.delete(k);
    }
    recent.set(key, now);

    const at = new Date(now);
    const id = `evt_${now}_${crypto.randomUUID().slice(0, 8)}`;

    await createDocument(env, 'opsEvents', id, {
      type: String(type).slice(0, 80),
      severity: SEVERITIES.includes(severity) ? severity : 'error',
      source: String(source).slice(0, 40),
      message: String(message || '').slice(0, 300),
      businessId: businessId || null,
      reference: reference ? String(reference).slice(0, 120) : null,
      context: sanitizeContext(context),
      // A plain YYYY-MM-DD lets the health page group by day with an
      // equality filter instead of a range scan.
      day: at.toISOString().slice(0, 10),
      createdAt: at,
    });
    return true;
  } catch (err) {
    console.error('[opsEvents] could not record event:', err?.message);
    return false;
  }
}
