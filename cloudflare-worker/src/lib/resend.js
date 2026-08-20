// src/lib/resend.js
//
// Minimal Resend API client — the ONLY place in this Worker that talks to
// Resend. Every transactional email FlowBiz sends goes through
// sendEmail() below, so there is exactly one code path that ever touches
// env.RESEND_API_KEY. The key never leaves this function: it's read from
// the Worker's own secret binding, used in an Authorization header on a
// server-to-server fetch, and never echoed into any response, log line,
// or thrown error.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'FlowBiz <noreply@flowbiz.co.ke>';

export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    // Fails loudly in logs (so you notice a missing secret immediately)
    // without ever printing the key itself, because there isn't one to print.
    throw new Error('RESEND_API_KEY is not configured on this Worker.');
  }
  if (!to || !subject || !html) {
    throw new Error('sendEmail() requires to, subject, and html.');
  }

  let res;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html,
        text: text || undefined,
      }),
    });
  } catch (err) {
    // Network-level failure reaching Resend itself (not a Resend-side
    // rejection) — never rethrow err.message verbatim in case it ever
    // contains request internals; log a fixed, safe message instead.
    console.error('[resend] network error contacting Resend API');
    throw new Error('Could not reach the email delivery service.');
  }

  if (!res.ok) {
    // Resend's error body is diagnostic-only (it never contains the API
    // key), so it's safe to log — but it's never returned to the caller,
    // which only ever gets a generic message back.
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.message || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => '(no body)');
    }
    console.error(`[resend] send failed (status ${res.status}):`, detail);
    throw new Error('The email could not be sent. Please try again.');
  }

  return true;
}