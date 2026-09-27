// src/lib/googleAuth.js
//
// Mints a short-lived Google OAuth2 access token from a service account,
// using the standard "JWT bearer" flow — pure Web Crypto, no Node APIs,
// so it runs fine in a Cloudflare Worker. The resulting token is what lets
// this backend call the Firestore REST API and the Identity Toolkit
// (Firebase Auth admin) REST API on FlowBiz's behalf.

import { pemToDer, stringToUint8Array, uint8ArrayToBase64Url } from './jwt.js';

// One cached token per (service account, scope). The Firestore account and
// the Google Play account can be different identities with different
// scopes, and a token for one must never be handed to the other.
const tokenCache = new Map();

async function importPrivateKey(pem) {
  const der = pemToDer(pem);
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

/**
 * @param {object} env
 * @param {{ secretName?: string, scope?: string }} [options] which secret
 *   holds the service-account JSON, and the OAuth scope. The defaults are
 *   the Firestore/Identity Toolkit account every existing caller uses.
 */
export async function getGoogleAccessToken(env, {
  secretName = 'FIREBASE_SERVICE_ACCOUNT_JSON',
  scope = 'https://www.googleapis.com/auth/cloud-platform',
} = {}) {
  const now = Date.now();
  const cacheKey = `${secretName}|${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && now < cached.expiry) return cached.token;

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env[secretName]);
  } catch {
    throw new Error(`${secretName} secret is missing or not valid JSON.`);
  }

  const nowSec = Math.floor(now / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    // cloud-platform is broad on purpose: it's the one scope guaranteed to
    // cover both Firestore and Identity Toolkit without guessing at a
    // narrower scope name. Actual permissions are still constrained by
    // whatever IAM roles are granted to this service account in Google
    // Cloud — see the deployment README for exactly which roles to grant.
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const headerB64 = uint8ArrayToBase64Url(stringToUint8Array(JSON.stringify(header)));
  const claimsB64 = uint8ArrayToBase64Url(stringToUint8Array(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;

  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, stringToUint8Array(signingInput));
  const jwt = `${signingInput}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Failed to mint Google access token: ${await tokenRes.text()}`);
  }
  const tokenData = await tokenRes.json();
  tokenCache.set(cacheKey, {
    token: tokenData.access_token,
    expiry: now + (tokenData.expires_in - 120) * 1000, // refresh a bit early
  });
  return tokenData.access_token;
}
