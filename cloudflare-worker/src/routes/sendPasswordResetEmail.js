// src/routes/sendPasswordResetEmail.js
//
// POST /api/auth/send-password-reset  { email }
//
// Unauthenticated by necessity — someone requesting a reset usually isn't
// signed in. ALWAYS responds with the same generic { success: true }
// shape regardless of whether the email actually belongs to an account,
// whether Firebase found it, or whether Resend succeeded — this is what
// stops the endpoint being used to check who has a FlowBiz account
// (mirrors the enumeration protection ForgotPassword.jsx already had
// client-side, now enforced where it actually matters: server-side).
//
// RATE LIMITING NOTE: the in-memory map below is best-effort only — a
// Cloudflare Worker can run many isolates in parallel across edge
// locations, each with its OWN copy of this map, so it does not provide
// a real global rate limit. For production-grade protection on this
// endpoint, add a Cloudflare Rate Limiting Rule in the dashboard
// (Security → WAF → Rate limiting rules) targeting
// POST /api/auth/send-password-reset — that's enforced at the edge,
// globally, with no code changes needed here.

import { json, errorResponse } from '../lib/response.js';
import { generateActionLink } from '../lib/identityToolkit.js';
import { sendEmail } from '../lib/resend.js';
import { passwordResetEmail } from '../lib/emailTemplates.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort, single-isolate throttle — see note above.
const recentRequests = new Map(); // email -> last request timestamp (ms)
const MIN_INTERVAL_MS = 60 * 1000;

export async function handleSendPasswordReset(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const email = String(body?.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return errorResponse('Enter a valid email address.', 400);
  }

  const now = Date.now();
  const last = recentRequests.get(email);
  if (last && now - last < MIN_INTERVAL_MS) {
    // Still a generic success — never let timing or response shape leak
    // whether this is a real throttle vs. a real send.
    return json({ success: true });
  }
  recentRequests.set(email, now);

const continueUrl = `${env.APP_BASE_URL}/auth/action?flow=resetPassword`;

  try {
    const result = await generateActionLink(env, {
      requestType: 'PASSWORD_RESET',
      email,
      continueUrl,
    });
    const { subject, html, text } = passwordResetEmail(result.oobLink);
    await sendEmail(env, { to: email, subject, html, text });
  } catch (err) {
    // EMAIL_NOT_FOUND is expected and common (a mistyped address, or
    // someone probing for registered accounts) — it must never produce a
    // different response than success. Anything else gets logged for
    // diagnosis (e.g. a real Resend/Identity Toolkit outage).
    if (err.identityToolkitCode !== 'EMAIL_NOT_FOUND') {
      console.error('[send-password-reset] failed:', err.identityToolkitCode || err.message);
    }
  }

  return json({ success: true });
}