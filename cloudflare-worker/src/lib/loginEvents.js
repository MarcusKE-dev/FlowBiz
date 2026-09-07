// cloudflare-worker/src/lib/loginEvents.js
//
// AUTHENTICATION TELEMETRY, AND AN HONEST ACCOUNT OF WHAT IT CAN PROVE.
//
// FlowBiz signs users in with the Firebase Authentication client SDK.
// There is no FlowBiz server in that path — the browser talks to Google
// directly — so there is no place on our side that OBSERVES a sign-in the
// way a login form on a server would. That fact decides everything below,
// and pretending otherwise would produce a security page that looks
// authoritative and is not.
//
// So each event records HOW MUCH IT PROVES, in `verified`:
//
//   verified: true  — a SUCCESS, proved. The client sent the Firebase ID
//     token it had just obtained, this Worker verified its signature
//     against Google's keys, and the uid and email below come from the
//     VERIFIED CLAIMS, never from the request body. Nobody can forge one
//     of these without actually signing in as that person.
//
//   verified: false — a reported FAILURE. Nothing cryptographic backs it:
//     a failed sign-in produces no token, so the client is the only
//     witness. The metadata that matters most for spotting an attack is
//     still SERVER-OBSERVED — the IP and the user agent come from the
//     request headers, not from the body — and the endpoint is rate
//     limited per IP, but the claim "this email failed to sign in" is the
//     client's word. The admin UI labels these as reported, and no
//     administrative action is ever taken automatically on one.
//
// WHAT WOULD MAKE FAILURES PROVABLE, and why it is not done here: routing
// sign-in through the Worker (Identity Toolkit's signInWithPassword) or
// Firebase blocking functions. The first would put every merchant's
// password through our own infrastructure and change a working production
// auth path; the second needs Identity Platform. Both are decisions for
// a deliberate change, not a side effect of adding a log.
//
// WHAT IS NEVER STORED: passwords, ID tokens, refresh tokens, session
// cookies, OOB codes. The document shape below is fixed and allow-listed,
// so a future caller cannot pass one in by accident.

import { createDocument, queryCollection } from './firestore.js';

/** Failure categories, from Firebase Auth's own error codes. */
export const FAILURE_REASONS = {
  'auth/invalid-credential': 'wrong_password',
  'auth/wrong-password': 'wrong_password',
  'auth/user-not-found': 'no_such_account',
  'auth/invalid-email': 'malformed_email',
  'auth/user-disabled': 'account_disabled',
  'auth/too-many-requests': 'rate_limited',
  'auth/network-request-failed': 'network',
};
export const REASON_VALUES = [...new Set(Object.values(FAILURE_REASONS)), 'unknown'];

export function reasonFor(code) {
  return FAILURE_REASONS[String(code || '').trim()] || 'unknown';
}

/** name@example.com -> n***@example.com. Enough to recognise, not to harvest. */
export function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.toLowerCase().trim().slice(0, 254) : '';
}

/**
 * A stable, non-reversible handle for an attempted email.
 *
 * It is what makes "seventeen attempts against the same account" a
 * question the security page can answer with an equality filter, without
 * storing a list of real email addresses that a failed attempt merely
 * CLAIMED to be. Truncated to 32 hex characters: ample against collision
 * for this purpose, and useless as a dictionary.
 */
export async function emailHandle(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Which FlowBiz account, if any, an attempted email actually belongs to.
 *
 * This is the one place a real email address may be attached to a failed
 * attempt, and it comes from OUR OWN user records rather than from the
 * request — so an administrator sees "someone is hammering this real
 * workspace" without the log ever becoming a place to write arbitrary
 * addresses. An email that matches nothing stays masked forever.
 */
async function resolveTarget(env, rawEmail) {
  const normalized = normalizeEmail(rawEmail);
  if (!normalized) return null;
  try {
    // FlowBiz stores a user's email as it was TYPED at signup — Setup and
    // JoinStaff both trim it and neither lower-cases it — so a lookup on
    // the normalised form alone misses anyone who capitalised anything.
    // Both spellings are tried; an equality filter on `email` needs only
    // the single-field index Firestore maintains automatically.
    const typed = typeof rawEmail === 'string' ? rawEmail.trim().slice(0, 254) : '';
    const candidates = typed && typed !== normalized ? [normalized, typed] : [normalized];

    let user = null;
    for (const candidate of candidates) {
      const matches = await queryCollection(env, 'users', {
        filters: [{ field: 'email', value: candidate }],
        limit: 1,
      });
      if (matches[0]) { user = matches[0]; break; }
    }
    if (!user) return null;
    return {
      uid: user.id || user.uid || null,
      email: user.email || normalized,
      businessId: user.businessId || null,
      displayName: user.displayName || null,
      active: user.active !== false,
    };
  } catch {
    // A telemetry lookup must never break the thing it is observing.
    return null;
  }
}

const MAX_UA = 200;

/**
 * Record one authentication event. Never throws.
 *
 * @param {object} opts
 * @param {'success'|'failure'} opts.outcome
 * @param {boolean} opts.verified   true only for a token-proved success
 * @param {string|null} opts.uid    from VERIFIED claims only
 * @param {string} opts.email       the attempted address
 * @param {string|null} opts.reasonCode  a Firebase error code, for failures
 * @param {string|null} opts.ip     server-observed
 * @param {string|null} opts.userAgent server-observed
 */
export async function recordLoginEvent(env, {
  outcome,
  verified = false,
  uid = null,
  email = '',
  reasonCode = null,
  ip = null,
  userAgent = null,
} = {}) {
  try {
    if (outcome !== 'success' && outcome !== 'failure') return null;

    const handle = await emailHandle(email);
    const target = await resolveTarget(env, email);
    const at = new Date();
    const id = `li_${at.getTime()}_${crypto.randomUUID().slice(0, 8)}`;

    // The WHOLE document. Nothing is spread in from a caller, so nothing a
    // caller happens to be holding can end up in Firestore.
    const doc = {
      outcome,
      verified: verified === true,
      reason: outcome === 'failure' ? reasonFor(reasonCode) : null,

      // Identity. A verified success may name the account outright,
      // because the token proved it. Everything else is masked, plus the
      // handle that makes repetition countable.
      uid: verified && uid ? uid : null,
      emailMasked: maskEmail(email) || maskEmail(target?.email) || null,
      emailHandle: handle,

      // Which FlowBiz account and workspace this attempt was AGAINST, from
      // our own records rather than from the request body.
      targetUid: target?.uid || null,
      targetEmail: target?.email || null,
      targetBusinessId: target?.businessId || null,
      targetName: target?.displayName || null,
      targetActive: target ? target.active : null,
      knownAccount: Boolean(target),

      // Server-observed, on every event including the unverified ones.
      ip: ip || null,
      userAgent: userAgent ? String(userAgent).slice(0, MAX_UA) : null,

      // A plain YYYY-MM-DD, so the security page can group a day with an
      // equality filter instead of a range scan.
      day: at.toISOString().slice(0, 10),
      createdAt: at,

      // Administrative triage state. An event starts open; an
      // administrator may mark it reviewed. See adminSecurity.js.
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
    };

    await createDocument(env, 'loginEvents', id, doc);
    return { id, ...doc };
  } catch (err) {
    console.error('[loginEvents] could not record event:', err?.message);
    return null;
  }
}
