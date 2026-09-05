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
  
  // 1. Parse the ugly Firebase link
  const originalUrl = new URL(data.oobLink);
  
  // 2. Extract the query parameters (?mode=...&oobCode=...&apiKey=...)
  const queryParams = originalUrl.search;
  
  // 3. Attach those exact parameters to your FlowBiz React URL
  // This uses the env.APP_BASE_URL from your worker environment
  const customLink = `${env.APP_BASE_URL}/auth/action${queryParams}`;

  // 4. Return the custom link to your Resend email template
  return { oobLink: customLink, email: data.email };
}

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
