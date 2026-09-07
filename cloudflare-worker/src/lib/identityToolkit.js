// src/lib/identityToolkit.js
//
// Deletes a Firebase Authentication user by uid. This is the one thing
// FlowBiz's client SDK can never safely do itself — removing another
// person's Auth account requires privileged, server-side credentials.
// This is the actual fix for the staff-deletion bug described in the
// audit: without this, the Firestore profile can be deleted all day and
// the email stays registered in Firebase Authentication forever.

import { getGoogleAccessToken } from './googleAuth.js';

// Generates a Firebase Auth action link (email verification or password
// reset) via the Identity Toolkit REST API WITHOUT letting Firebase send
// its own email — that's what lets FlowBiz deliver the email itself via
// Resend. returnOobLink:true is only honored for server-authenticated
// (OAuth) callers, never a plain client API key request — same privilege
// tier as deleteAuthUser() below.
export async function generateActionLink(env, { requestType, email, idToken, continueUrl }) {
  const token = await getGoogleAccessToken(env);
  const body = {
    requestType,               // 'VERIFY_EMAIL' | 'PASSWORD_RESET'
    returnOobLink: true,
    continueUrl,
    canHandleCodeInApp: true,  // send users straight to our /auth/action page, never Firebase's hosted page
  };
  if (email) body.email = email;
  if (idToken) body.idToken = idToken;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:sendOobCode`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const code = errBody?.error?.message || 'UNKNOWN_ERROR';
    const err = new Error(code);
    err.identityToolkitCode = code;
    throw err;
  }
  const data = await res.json();
  return { oobLink: flowbizActionLink(env, data.oobLink), email: data.email };
}

// WHAT THE CUSTOMER ACTUALLY SEES IN THE EMAIL.
//
// Identity Toolkit hands back a link on Firebase's own domain carrying
// everything it might ever need:
//
//   https://<project>.firebaseapp.com/__/auth/action?mode=verifyEmail
//     &oobCode=...&apiKey=...&lang=en&continueUrl=https%3A%2F%2F...%3Fflow%3D...
//
// Copying that whole query onto flowbiz.co.ke — which is what this used
// to do — produces a 250-character URL with another URL encoded inside
// it. Behind a button that is merely untidy; in the plain-text part, in a
// link preview, or on the hover status bar of a desktop mail client, it
// is what the customer reads, and it reads like a phishing link.
//
// So the link is REBUILT rather than copied, from the two parameters our
// own /auth/action page actually uses:
//
//   mode    — which flow this is
//   oobCode — the single-use code
//
// Everything else is dropped deliberately:
//   apiKey       the client SDK on our page already has our config, and
//                publishing it in an email adds nothing but length
//   lang         we send one language
//   continueUrl  it told FIREBASE'S hosted page where to go afterwards.
//                We never reach that page — the link comes straight to
//                ours — so it is a redirect target for a redirect that
//                does not happen. Our page decides where to go next.
//
// The result is short, on our own domain, and readable:
//
//   https://flowbiz.co.ke/auth/action?mode=verifyEmail&oobCode=...
function flowbizActionLink(env, oobLink) {
  const base = String(env.APP_BASE_URL || '').replace(/\/+$/, '');

  let source;
  try {
    source = new URL(oobLink);
  } catch {
    // Never seen in practice, but this function must not be the thing
    // that stops an email going out. An unparseable link is passed
    // through exactly as Firebase gave it: ugly beats undeliverable.
    return oobLink;
  }

  const oobCode = source.searchParams.get('oobCode');
  const mode = source.searchParams.get('mode');
  // Without a code there is nothing to shorten and nothing that would
  // work — again, hand back what we were given rather than a broken link.
  if (!oobCode) return oobLink;

  const clean = new URLSearchParams();
  if (mode) clean.set('mode', mode);
  clean.set('oobCode', oobCode);

  return `${base}/auth/action?${clean.toString()}`;
}

export { flowbizActionLink };

export async function deleteAuthUser(env, uid) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:delete`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    // A user that's already gone is not a failure from the caller's point
    // of view — the goal (no orphaned Auth account) is already achieved.
    if (res.status === 400 && errText.includes('USER_NOT_FOUND')) return;
    throw new Error(`Failed to delete Firebase Auth user ${uid}: ${errText}`);
  }
}

// ── Account access control ────────────────────────────────────────────
//
// Two things a platform administrator can genuinely enforce against a
// Firebase Authentication account, both through the same privileged
// endpoint the deletion above uses. They are here rather than in the
// admin route so that the route stays about authorisation and auditing.

/**
 * Disable or re-enable a Firebase Auth account.
 *
 * A disabled account cannot sign in AT ALL — Firebase refuses it before
 * FlowBiz is ever consulted — and its existing ID tokens stop being
 * refreshed. It is reversible: passing `false` restores it exactly, with
 * no data touched either way.
 */
export async function setAuthUserDisabled(env, uid, disabled) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:update`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid, disableUser: disabled === true }),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to ${disabled ? 'disable' : 'enable'} account ${uid}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Invalidate every refresh token this account holds, so every device
 * signed in as it has to authenticate again.
 *
 * `validSince` is set to now; Firebase then refuses any refresh token
 * issued before that moment. It does NOT disable the account — the person
 * can sign in again immediately with their password, which is exactly
 * what "force sign-out" should mean.
 */
export async function revokeRefreshTokens(env, uid) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:update`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid, validSince: String(Math.floor(Date.now() / 1000)) }),
    }
  );
  if (!res.ok) throw new Error(`Failed to revoke sessions for ${uid}: ${await res.text()}`);
  return res.json();
}
