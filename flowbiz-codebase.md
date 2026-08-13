This file is a merged representation of a subset of the codebase, containing files not matching ignore patterns, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching these patterns are excluded: node_modules, dist, build, .next, coverage, .git, .agents, package-lock.json, pnpm-lock.yaml, yarn.lock, firebase-debug.log, firebase-debug.*.log
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
````
cloudflare-worker/
  src/
    lib/
      cors.js
      firebaseIdToken.js
      firestore.js
      googleAuth.js
      identityToolkit.js
      jwt.js
      response.js
    routes/
      deleteStaff.js
      paystackInitialize.js
      paystackWebhook.js
      whatsappSend.js
    index.js
  package.json
  wrangler.toml
public/
  icons/
    icon-128.png
    icon-144.png
    icon-152.png
    icon-180.png
    icon-192.png
    icon-384.png
    icon-512.png
    icon-72.png
    icon-96.png
  _redirects
  favicon-16.png
  favicon-32.png
  favicon.svg
src/
  components/
    charts/
      DonutChart.jsx
      MiniBarChart.jsx
      MiniLineChart.jsx
    common/
      ConfirmDialog.jsx
      ConnectivityIndicator.jsx
      EmptyState.jsx
      ErrorBanner.jsx
      ErrorBoundary.jsx
      ExportCsvButton.jsx
      LoadingSpinner.jsx
      Modal.jsx
      ProtectedRoute.jsx
    debtors/
      RefundModal.jsx
      RepaymentModal.jsx
    layout/
      AppShell.jsx
      BottomNav.jsx
      MobileMoreDrawer.jsx
      navConfig.js
      Sidebar.jsx
      TopHeader.jsx
    pos/
      OpenSessionPrompt.jsx
      ProductGrid.jsx
      SaleCompleteModal.jsx
      SaleModal.jsx
    products/
      ProductFormModal.jsx
    scanner/
      ScanFab.jsx
      ScannerModal.jsx
    suppliers/
      SupplierFormModal.jsx
  constants/
    categories.js
  contexts/
    AuthContext.jsx
  demo/
    demoMode.js
    localAuth.js
    localFirestore.js
    seedData.js
  hooks/
    useCameraScanner.js
    useDailySession.js
    useFinancials.js
    useFirestoreCollection.js
    useHardwareScanner.js
    useOnlineStatus.js
    useSettings.js
    useSetupStatus.js
  lib/
    tenant.js
  pages/
    AdvancedAnalytics.jsx
    AuthAction.jsx
    CloseDay.jsx
    Counter.jsx
    CustomerDetail.jsx
    Customers.jsx
    Dashboard.jsx
    Expenses.jsx
    ForgotPassword.jsx
    HelpGuide.jsx
    InventoryIntelligence.jsx
    JoinStaff.jsx
    Login.jsx
    Pro.jsx
    Products.jsx
    Purchases.jsx
    Reports.jsx
    Settings.jsx
    Setup.jsx
    StockTake.jsx
    Suppliers.jsx
    Users.jsx
  router/
    AppRouter.jsx
    routePrefetch.js
  utils/
    businessReset.js
    csvExport.js
    currency.js
    dateRanges.js
    documentService.js
    errorMessages.js
    financials.js
    financials.test.js
    offlineWrite.js
    products.js
    scannerService.js
  App.jsx
  firebase.js
  index.css
  main.jsx
.env.example
.firebaserc
.gitignore
.nvmrc
.pagesignore
eslint.config.js
firebase.json
firestore.rules
index.html
package.json
postcss.config.js
README.md
skills-lock.json
tailwind.config.js
vite.config.js
````

# Files

## File: src/router/routePrefetch.js
````javascript
const idle = typeof requestIdleCallback === 'function'
  ? requestIdleCallback
  : (fn) => setTimeout(fn, 200);

export function prefetchRoutes(loaders) {
  if (!navigator.onLine) return;
  // Respect Data Saver — never spend someone's mobile data on
  // speculative background fetches if they've asked sites not to.
  if (navigator.connection?.saveData) return;

  loaders.forEach((load, i) => {
    idle(() => { load().catch(() => {}); }, { timeout: 2000 + i * 500 });
  });
}
````

## File: src/utils/errorMessages.js
````javascript
// Central place to turn raw Firebase/network error codes into copy a
// shop owner or cashier can actually act on. Never shows a raw
// "FirebaseError: ..." string or an internal code to the user — the
// original error is still logged to the console for debugging.
const MESSAGES = {
  'permission-denied': "You're not allowed to do that. If you think this is a mistake, check with your business owner.",
  'unauthenticated': 'Your session has expired. Please sign in again.',
  'unavailable': "Can't reach the server right now. Check your connection and try again.",
  'deadline-exceeded': 'That took too long to complete. Please try again.',
  'resource-exhausted': "We're getting too many requests right now. Please wait a moment and try again.",
  'not-found': "That record couldn't be found, it may have been deleted or moved.",
  'already-exists': 'That already exists.',
  'cancelled': 'That was cancelled before it could finish.',
  'aborted': 'That could not be completed, please try again.',
  'internal': 'Something went wrong on our end. Please try again.',
  'auth/network-request-failed': 'Please check your internet connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a bit before trying again.',
  'auth/user-disabled': 'This account has been disabled. Please contact your business owner.',
  'storage/unauthorized': "You're not allowed to upload that file.",
  'storage/canceled': 'The upload was cancelled.',
  'storage/quota-exceeded': 'Storage limit reached, please contact support.',
};

export function friendlyErrorMessage(err, options = {}) {
  const { fallback = 'Something went wrong. Please try again.', overrides = {} } = options;
  const code = err?.code || '';
  if (overrides[code]) return overrides[code];
  if (MESSAGES[code]) return MESSAGES[code];

  const raw = err?.message || '';
  if (/offline|failed to fetch|networkerror/i.test(raw)) {
    return "Can't reach the server, check your internet connection and try again.";
  }
  // A raw Firestore/Firebase SDK error string — never show that verbatim.
  if (/^Firebase|Missing or insufficient permissions|\[code=/i.test(raw)) {
    console.error('[FlowBiz] Unmapped error:', err);
    return fallback;
  }
  // Anything else is almost certainly one of FlowBiz's OWN thrown
  // messages ("Enter a valid phone number.", "Amount exceeds the
  // outstanding balance...") — those are already written for people.
  return raw || fallback;
}
````

## File: src/utils/offlineWrite.js
````javascript
// Resolves within `timeoutMs` no matter what: with the real
// success/failure if the write settles in time, or with
// `{ queuedOffline: true }` if it's still pending once the timeout
// hits. The original promise keeps running in the background so the
// caller can still react if it eventually fails for real.
export function raceWithTimeout(promise, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve({ queuedOffline: true }); }
    }, timeoutMs);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ queuedOffline: false, value });
      },
      (err) => {
        clearTimeout(timer);
        if (!settled) { settled = true; resolve({ queuedOffline: false, error: err }); }
        // else: caller already moved on optimistically — it attaches
        // its own .catch() to the original promise for this case.
      }
    );
  });
}
````

## File: cloudflare-worker/src/lib/cors.js
````javascript
// src/lib/cors.js
//
// CORS handling for the FlowBiz API worker. Only origins listed in the
// ALLOWED_ORIGINS environment variable (comma-separated) are ever allowed
// to read a response — this is what stops some other website from
// silently calling FlowBiz's API using a signed-in user's browser session.

export function corsHeaders(origin, allowedOrigins) {
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function handleOptions(request, allowedOrigins) {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin, allowedOrigins) });
}
````

## File: cloudflare-worker/src/lib/firebaseIdToken.js
````javascript
// src/lib/firebaseIdToken.js
//
// Verifies a Firebase Authentication ID token WITHOUT the Firebase Admin
// SDK (which doesn't reliably run in Cloudflare Workers — see the
// project's audit notes). This follows Firebase's own documented manual
// verification procedure:
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
//
// Every privileged route calls this FIRST. If it throws, the caller isn't
// who they claim to be — full stop, nothing downstream can be trusted.

import { base64UrlToJson, base64UrlToUint8Array, stringToUint8Array } from './jwt.js';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let cachedJwks = null;
let cachedJwksExpiry = 0;

async function getJwks() {
  const now = Date.now();
  if (cachedJwks && now < cachedJwksExpiry) return cachedJwks;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error('Could not fetch Firebase public keys.');
  const data = await res.json();
  cachedJwks = data.keys;
  cachedJwksExpiry = now + 60 * 60 * 1000; // Google rotates these; re-fetch hourly.
  return cachedJwks;
}

async function importPublicKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

export async function verifyFirebaseIdToken(idToken, projectId) {
  if (!idToken || typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    throw new Error('Malformed ID token.');
  }
  const [headerB64, payloadB64, signatureB64] = idToken.split('.');
  const header = base64UrlToJson(headerB64);
  const payload = base64UrlToJson(payloadB64);

  if (header.alg !== 'RS256') throw new Error('Unexpected token algorithm.');
  if (!header.kid) throw new Error('Token missing key id.');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('Token expired.');
  if (typeof payload.iat !== 'number' || payload.iat > now + 60) throw new Error('Token issued in the future.');
  if (payload.aud !== projectId) throw new Error('Token audience mismatch.');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Token issuer mismatch.');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Token missing subject.');

  const jwks = await getJwks();
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('No matching public key for this token.');

  const key = await importPublicKey(jwk);
  const signature = base64UrlToUint8Array(signatureB64);
  const signedData = stringToUint8Array(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData);
  if (!valid) throw new Error('Token signature invalid.');

  return { uid: payload.sub, email: payload.email || null, claims: payload };
}
````

## File: cloudflare-worker/src/lib/firestore.js
````javascript
// src/lib/firestore.js
//
// Minimal Firestore REST API client — just enough for this backend's
// needs (read-by-id, patch-by-id, create-by-id). Deliberately NOT a
// general Firestore SDK: no queries, no transactions. Every route in this
// project only ever needs to read/write documents it already knows the ID
// of (a uid, a businessId, a Paystack reference), so this stays small.
//
// Auth is via the OAuth2 access token from googleAuth.js, which — like
// the Firebase Admin SDK — bypasses Firestore Security Rules entirely.
// That's expected and required: this is the privileged, server-side path.

import { getGoogleAccessToken } from './googleAuth.js';

function fieldsToObject(fields) {
  if (!fields) return {};
  const out = {};
  for (const [key, value] of Object.entries(fields)) out[key] = valueToJs(value);
  return out;
}

function valueToJs(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return value.timestampValue; // ISO string
  if (value.mapValue !== undefined) return fieldsToObject(value.mapValue.fields);
  if (value.arrayValue !== undefined) return (value.arrayValue.values || []).map(valueToJs);
  return null;
}

function jsToValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(jsToValue) } };
  if (typeof value === 'object') return { mapValue: { fields: objectToFields(value) } };
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function objectToFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) fields[key] = jsToValue(value);
  return fields;
}

function baseUrl(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

export async function getDocument(env, collection, docId) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}/${docId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore read failed (${collection}/${docId}): ${await res.text()}`);
  const data = await res.json();
  return { id: docId, ...fieldsToObject(data.fields) };
}

export async function patchDocument(env, collection, docId, updates) {
  const token = await getGoogleAccessToken(env);
  const fields = objectToFields(updates);
  const mask = Object.keys(updates).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}/${docId}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Firestore update failed (${collection}/${docId}): ${await res.text()}`);
  return res.json();
}

export async function createDocument(env, collection, docId, data) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}?documentId=${encodeURIComponent(docId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: objectToFields(data) }),
  });
  if (res.status === 409) throw new Error('DOCUMENT_ALREADY_EXISTS');
  if (!res.ok) throw new Error(`Firestore create failed (${collection}/${docId}): ${await res.text()}`);
  return res.json();
}
````

## File: cloudflare-worker/src/lib/googleAuth.js
````javascript
// src/lib/googleAuth.js
//
// Mints a short-lived Google OAuth2 access token from a service account,
// using the standard "JWT bearer" flow — pure Web Crypto, no Node APIs,
// so it runs fine in a Cloudflare Worker. The resulting token is what lets
// this backend call the Firestore REST API and the Identity Toolkit
// (Firebase Auth admin) REST API on FlowBiz's behalf.

import { pemToDer, stringToUint8Array, uint8ArrayToBase64Url } from './jwt.js';

let cachedToken = null;
let cachedTokenExpiry = 0;

async function importPrivateKey(pem) {
  const der = pemToDer(pem);
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

export async function getGoogleAccessToken(env) {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) return cachedToken;

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON secret is missing or not valid JSON.');
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
    scope: 'https://www.googleapis.com/auth/cloud-platform',
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
  cachedToken = tokenData.access_token;
  cachedTokenExpiry = now + (tokenData.expires_in - 120) * 1000; // refresh a bit early
  return cachedToken;
}
````

## File: cloudflare-worker/src/lib/identityToolkit.js
````javascript
// src/lib/identityToolkit.js
//
// Deletes a Firebase Authentication user by uid. This is the one thing
// FlowBiz's client SDK can never safely do itself — removing another
// person's Auth account requires privileged, server-side credentials.
// This is the actual fix for the staff-deletion bug described in the
// audit: without this, the Firestore profile can be deleted all day and
// the email stays registered in Firebase Authentication forever.

import { getGoogleAccessToken } from './googleAuth.js';

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
````

## File: cloudflare-worker/src/lib/jwt.js
````javascript
// src/lib/jwt.js
//
// Small, dependency-free helpers for working with JWTs and PEM keys using
// only the Web Crypto API — everything here runs in a Cloudflare Worker
// without needing Node.js APIs or npm crypto packages.

export function base64UrlToUint8Array(base64Url) {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64UrlToJson(base64Url) {
  const bytes = base64UrlToUint8Array(base64Url);
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function stringToUint8Array(str) {
  return new TextEncoder().encode(str);
}

export function uint8ArrayToBase64Url(bytes) {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Converts a PEM-encoded key (the format Google service-account JSON files
// use for `private_key`) into the raw DER bytes that crypto.subtle wants.
export function pemToDer(pem) {
  const stripped = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(stripped);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
````

## File: cloudflare-worker/src/lib/response.js
````javascript
// src/lib/response.js
export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message, status = 400) {
  return json({ error: message }, { status });
}
````

## File: cloudflare-worker/src/routes/deleteStaff.js
````javascript
// src/routes/deleteStaff.js
//
// POST /api/auth/delete-staff  { targetUid }
//
// Fixes the staff-deletion bug: deletes the actual Firebase Authentication
// account for a removed staff member, not just their Firestore profile —
// so the same email can be re-invited afterward.

import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { getDocument } from '../lib/firestore.js';
import { deleteAuthUser } from '../lib/identityToolkit.js';

export async function handleDeleteStaff(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return errorResponse('Missing Authorization header.', 401);

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return errorResponse(`Invalid session: ${err.message}`, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }
  const targetUid = body?.targetUid;
  if (!targetUid || typeof targetUid !== 'string') return errorResponse('targetUid is required.', 400);
  if (targetUid === caller.uid) return errorResponse("You can't remove your own account.", 400);

  // Step 1 & 2 — the requester must exist, be active, and be an owner.
  const callerProfile = await getDocument(env, 'users', caller.uid);
  if (!callerProfile) return errorResponse('Caller profile not found.', 403);
  if (callerProfile.role !== 'owner') return errorResponse('Only an owner can remove staff accounts.', 403);
  if (callerProfile.active === false) return errorResponse('Your account is deactivated.', 403);

  // Step 3 — the target must belong to the SAME business. This is what
  // stops one business's owner from deleting another business's staff
  // member by guessing or leaking a uid.
  const targetProfile = await getDocument(env, 'users', targetUid);
  if (!targetProfile) {
    return errorResponse('Target staff profile not found in Firestore — nothing to reconcile.', 404);
  }
  if (targetProfile.businessId !== callerProfile.businessId) {
    return errorResponse('That account does not belong to your business.', 403);
  }

  // Step 4 — the actual fix.
  await deleteAuthUser(env, targetUid);

  return json({ success: true });
}
````

## File: cloudflare-worker/src/routes/paystackInitialize.js
````javascript
// src/routes/paystackInitialize.js
//
// POST /api/paystack/initialize
//
// Starts a Paystack transaction for the FlowBiz Pro plan. The price is
// fixed SERVER-SIDE — the browser never gets to say what the amount is.
// Records a pending payment doc first, so the webhook always has
// something authoritative to check the eventual callback against.

import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { getDocument, createDocument } from '../lib/firestore.js';

const PRO_PLAN_AMOUNT_KES = 500; // Must match what Pro.jsx advertises to the user.

export async function handlePaystackInitialize(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return errorResponse('Missing Authorization header.', 401);

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return errorResponse(`Invalid session: ${err.message}`, 401);
  }

  const callerProfile = await getDocument(env, 'users', caller.uid);
  if (!callerProfile) return errorResponse('Profile not found.', 403);
  if (callerProfile.role !== 'owner') return errorResponse('Only an owner can manage the subscription.', 403);
  if (callerProfile.active === false) return errorResponse('Your account is deactivated.', 403);
  if (!callerProfile.businessId) return errorResponse('No business associated with this account.', 400);

  const email = callerProfile.email || caller.email;
  if (!email) return errorResponse('No email on file for this account.', 400);

  const reference = `flowbiz_${callerProfile.businessId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const amountKobo = PRO_PLAN_AMOUNT_KES * 100;

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      currency: 'KES',
      reference,
      callback_url: env.PAYSTACK_CALLBACK_URL || undefined,
      metadata: { businessId: callerProfile.businessId, plan: 'pro' },
    }),
  });

  const paystackData = await paystackRes.json();
  if (!paystackRes.ok || !paystackData.status) {
    return errorResponse(paystackData.message || 'Could not start payment with Paystack.', 502);
  }

  // Recorded BEFORE handing the reference back to the browser — the
  // webhook checks the eventual payment against this, not the other way
  // around, so nothing the frontend says here needs to be trusted later.
  await createDocument(env, 'payments', reference, {
    businessId: callerProfile.businessId,
    plan: 'pro',
    amountKes: PRO_PLAN_AMOUNT_KES,
    status: 'pending',
    createdAt: new Date(),
    initializedBy: caller.uid,
  });

return json({ authorization_url: paystackData.data.authorization_url, access_code: paystackData.data.access_code, reference });}
````

## File: cloudflare-worker/src/routes/paystackWebhook.js
````javascript
// src/routes/paystackWebhook.js
//
// POST /api/paystack/webhook — called directly by Paystack, not by
// FlowBiz's frontend. Three layers of protection, all required:
//   1. HMAC signature check (proves the request really came from Paystack)
//   2. Idempotency check (a redelivered webhook must not extend twice)
//   3. Server-side re-verification against Paystack's own API, with the
//      amount cross-checked against what /initialize recorded (proves the
//      payment was for what we actually charged, not whatever the payload
//      claims)

import { errorResponse } from '../lib/response.js';
import { getDocument, patchDocument } from '../lib/firestore.js';

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPaystackSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return bytesToHex(new Uint8Array(mac)) === signatureHeader;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function handlePaystackWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  const validSignature = await verifyPaystackSignature(rawBody, signature, env.PAYSTACK_SECRET_KEY);
  if (!validSignature) return errorResponse('Invalid signature.', 401);

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
  if (!reference) return errorResponse('Missing reference.', 400);

  const paymentRecord = await getDocument(env, 'payments', reference);
  if (!paymentRecord) return errorResponse('Unknown payment reference.', 404);

  // IDEMPOTENCY — Paystack can and does redeliver webhooks.
  if (paymentRecord.status === 'success') {
    return new Response('ok', { status: 200 });
  }

  // Re-verify directly against Paystack rather than trusting the payload.
  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
  });
  const verifyData = await verifyRes.json();
  const tx = verifyData?.data;

  if (!verifyRes.ok || !verifyData.status || tx?.status !== 'success') {
    return errorResponse('Transaction could not be verified as successful.', 400);
  }
  const expectedAmountKobo = Math.round((paymentRecord.amountKes || 0) * 100);
  if (tx.amount !== expectedAmountKobo || tx.currency !== 'KES') {
    return errorResponse('Amount/currency mismatch — refusing to activate subscription.', 400);
  }

  const businessId = paymentRecord.businessId;
  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found for this payment.', 404);

  const now = new Date();
  const currentExpiry = business.subscription?.expiresAt ? new Date(business.subscription.expiresAt) : null;
  // Extend from the current expiry if still active; otherwise start fresh from now.
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const newExpiry = addDays(base, 30);

  await patchDocument(env, 'businesses', businessId, {
    subscription: { plan: 'pro', status: 'active', expiresAt: newExpiry },
  });

  await patchDocument(env, 'payments', reference, {
    status: 'success',
    confirmedAt: now,
    paystackTransactionId: String(tx.id || ''),
  });

  return new Response('ok', { status: 200 });
}
````

## File: cloudflare-worker/src/routes/whatsappSend.js
````javascript
// src/routes/whatsappSend.js
//
// POST /api/whatsapp/send  { documentType: 'receipt'|'invoice', saleId, phone }
//
// businessId is deliberately taken from the CALLER'S OWN Firestore
// profile, never from the request body — the frontend used to send
// `businessId: settings.businessId`, which this endpoint ignores on
// purpose (never trust the frontend for authorization-relevant data).

import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { getDocument } from '../lib/firestore.js';

function formatKES(amount) {
  const v = Number(amount) || 0;
  return `KES ${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isBusinessPro(business) {
  return (
    business?.subscription?.plan === 'pro' &&
    business?.subscription?.status === 'active' &&
    (!business.subscription?.expiresAt || new Date(business.subscription.expiresAt) > new Date())
  );
}

export async function handleWhatsAppSend(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return errorResponse('Missing Authorization header.', 401);

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return errorResponse(`Invalid session: ${err.message}`, 401);
  }

  const callerProfile = await getDocument(env, 'users', caller.uid);
  if (!callerProfile) return errorResponse('Profile not found.', 403);
  if (callerProfile.active === false) return errorResponse('Your account is deactivated.', 403);
  if (!callerProfile.businessId) return errorResponse('No business associated with this account.', 400);

  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body.', 400); }

  const { documentType, saleId, phone } = body || {};
  if (!['receipt', 'invoice'].includes(documentType)) return errorResponse('documentType must be "receipt" or "invoice".', 400);
  if (!saleId || typeof saleId !== 'string') return errorResponse('saleId is required.', 400);
  if (!phone || typeof phone !== 'string') return errorResponse('phone is required.', 400);

  const businessId = callerProfile.businessId;

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);
  if (!isBusinessPro(business)) return errorResponse('WhatsApp document sending requires FlowBiz Pro.', 403);

  const saleCollection = documentType === 'invoice' ? 'creditSales' : 'sales';
  const sale = await getDocument(env, saleCollection, saleId);
  if (!sale || sale.businessId !== businessId) return errorResponse('Sale not found for your business.', 404);

  const settings = (await getDocument(env, 'businessSettings', businessId)) || {};
  const shopName = settings.shopName || 'FlowBiz Store';
  const label = documentType === 'invoice' ? 'Invoice' : 'Receipt';
  const amountDue = documentType === 'invoice' ? (sale.remainingBalance ?? sale.totalAmount) : sale.totalAmount;

  const lines = [
    `*${shopName}*`,
    `${label} — ${sale.quantity} × ${sale.productName}`,
    `Total: ${formatKES(sale.totalAmount)}`,
  ];
  if (documentType === 'invoice') lines.push(`Amount due: ${formatKES(amountDue)}`);
  if (settings.phone) lines.push(`Contact: ${settings.phone}`);
  const messageText = lines.join('\n');

  // NOTE (real WhatsApp platform constraint, not a bug in this code):
  // WhatsApp's Cloud API only allows a free-form text message like this
  // inside a 24-hour customer-service window (the customer messaged this
  // number first), or via a pre-approved Message Template otherwise. If
  // delivery fails for that reason, WhatsApp's error surfaces to the
  // cashier via the 502 below — see the deployment README for setting up
  // a template as a follow-up.
  const waRes = await fetch(`https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone.replace(/[^\d+]/g, ''),
      type: 'text',
      text: { body: messageText },
    }),
  });

  if (!waRes.ok) return errorResponse(`WhatsApp delivery failed: ${await waRes.text()}`, 502);

  return json({ success: true });
}
````

## File: cloudflare-worker/src/index.js
````javascript
// src/index.js — the Worker's entry point / router.
//
// Deliberately a plain switch on pathname + method, no router library:
// there are exactly four routes, and a dependency here is a dependency
// every one of FlowBiz's privileged operations now trusts.

import { corsHeaders, handleOptions } from './lib/cors.js';
import { errorResponse } from './lib/response.js';
import { handleDeleteStaff } from './routes/deleteStaff.js';
import { handlePaystackInitialize } from './routes/paystackInitialize.js';
import { handlePaystackWebhook } from './routes/paystackWebhook.js';
import { handleWhatsAppSend } from './routes/whatsappSend.js';

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Paystack calls the webhook directly (server-to-server) — it never
    // needs, and should never get, FlowBiz's browser CORS headers.
    if (url.pathname === '/api/paystack/webhook' && request.method === 'POST') {
      try {
        return await handlePaystackWebhook(request, env);
      } catch (err) {
        console.error('Webhook error:', err);
        return errorResponse('Internal server error.', 500);
      }
    }

    const allowedOrigins = getAllowedOrigins(env);
    if (request.method === 'OPTIONS') return handleOptions(request, allowedOrigins);

    const origin = request.headers.get('Origin') || '';
    const extraHeaders = corsHeaders(origin, allowedOrigins);

    let response;
    try {
      if (url.pathname === '/api/auth/delete-staff' && request.method === 'POST') {
        response = await handleDeleteStaff(request, env);
      } else if (url.pathname === '/api/paystack/initialize' && request.method === 'POST') {
        response = await handlePaystackInitialize(request, env);
      } else if (url.pathname === '/api/whatsapp/send' && request.method === 'POST') {
        response = await handleWhatsAppSend(request, env);
      } else {
        response = errorResponse('Not found.', 404);
      }
    } catch (err) {
      console.error('Unhandled error:', err);
      response = errorResponse('Internal server error.', 500);
    }

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  },
};
````

## File: cloudflare-worker/package.json
````json
{
  "name": "flowbiz-api",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail"
  },
  "devDependencies": {
    "wrangler": "^3.90.0"
  }
}
````

## File: public/_redirects
````
/* /index.html 200
````

## File: public/favicon.svg
````xml
<svg width="512" height="512" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="100" height="100" rx="22" fill="#1E4B3A"/>

  <!-- Monitor bezel -->
  <rect x="14" y="18" width="72" height="50" rx="8" fill="#F6F1E7"/>
  <!-- Screen (dark, so the glyphs read like a lit dashboard) -->
  <rect x="19" y="23" width="62" height="34" rx="5" fill="#1E4B3A"/>
  <!-- Stand -->
  <rect x="44" y="68" width="12" height="8" fill="#F6F1E7"/>
  <rect x="32" y="76" width="36" height="7" rx="3.5" fill="#F6F1E7"/>

  <!-- Dollar sign -->
  <text x="29" y="49" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#F6F1E7" text-anchor="middle">$</text>

  <!-- Ascending bars -->
  <rect x="52" y="46" width="7" height="8" rx="2.5" fill="#F6F1E7"/>
  <rect x="62" y="39" width="7" height="15" rx="2.5" fill="#F6F1E7"/>
  <rect x="72" y="31" width="7" height="23" rx="2.5" fill="#F6F1E7"/>
</svg>
````

## File: src/components/charts/DonutChart.jsx
````javascript
// src/components/charts/DonutChart.jsx
//
// Small part-to-whole breakdown (payment methods, stock health). Always
// paired with a text legend showing exact values and percentages — the
// slices alone are never the only way to read the data.
export default function DonutChart({ segments, size = 148, formatValue = (v) => String(v), centerLabel }) {
  const visible = (segments || []).filter((s) => (Number(s.value) || 0) > 0);
  const total = visible.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) return null;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offsetAccum = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0" role="img" aria-label="Breakdown chart">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-ink-100" strokeWidth="14" />
        {visible.map((s, i) => {
          const value = Number(s.value) || 0;
          const fraction = value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const el = (
            <circle
              key={i}
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="currentColor"
              className={s.colorClassName || 'text-blue-600'}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offsetAccum}
              transform="rotate(-90 50 50)"
            />
          );
          offsetAccum += dash;
          return el;
        })}
        {centerLabel && (
          <text x="50" y="53" textAnchor="middle" fill="currentColor" className="text-ink-900" style={{ fontSize: '11px', fontWeight: 700 }}>
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="w-full space-y-1.5">
        {visible.map((s, i) => {
          const value = Number(s.value) || 0;
          const pct = (value / total) * 100;
          return (
            <li key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink-600">
                <span className={`h-2.5 w-2.5 rounded-full ${s.dotClassName || 'bg-blue-600'}`} />
                {s.label}
              </span>
              <span className="font-semibold text-ink-800">
                {formatValue(value)} <span className="font-normal text-ink-400">({pct.toFixed(0)}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
````

## File: src/components/charts/MiniBarChart.jsx
````javascript
// src/components/charts/MiniBarChart.jsx
//
// Two orientations from one component:
//   - "horizontal" — ranked comparisons (best-selling products, top
//     overstocked items). Defaults to blue: a ranking isn't inherently
//     good or bad, so it stays out of the green/red semantic pair.
//   - "vertical" — a value over time (profit trend). Defaults to
//     green/red per bar based on the sign of the value, since profit
//     being positive or negative IS the meaning here.
export default function MiniBarChart({ data, orientation = 'vertical', height = 160, formatValue = (v) => String(v), ariaLabel }) {
  if (!data || data.length === 0) return null;
  const values = data.map((d) => Number(d.value) || 0);
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);

  if (orientation === 'horizontal') {
    return (
      <div role="img" aria-label={ariaLabel || 'Bar chart'} className="space-y-2.5">
        {data.map((d, i) => {
          const value = Number(d.value) || 0;
          const widthPct = Math.max((Math.abs(value) / maxAbs) * 100, 2);
          return (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-ink-700">{d.label}</span>
                <span className="shrink-0 font-semibold text-ink-800">{formatValue(value)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-ink-100">
                <div className={`h-2 rounded-full ${d.colorClassName || 'bg-blue-600'}`} style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const width = Math.max(data.length * 14, 100);
  const midY = height / 2;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" role="img" aria-label={ariaLabel || 'Bar chart'}>
        <line x1="0" y1={midY} x2={width} y2={midY} stroke="currentColor" className="text-ink-100" strokeWidth="1" />
        {data.map((d, i) => {
          const value = Number(d.value) || 0;
          const gap = width / data.length;
          const barWidth = gap * 0.55;
          const x = i * gap + (gap - barWidth) / 2;
          const barHeight = (Math.abs(value) / maxAbs) * (midY - 8);
          const y = value >= 0 ? midY - barHeight : midY;
          const colorClass = d.colorClassName || (value >= 0 ? 'text-moss-600' : 'text-rust-500');
          return <rect key={i} x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} className={colorClass} fill="currentColor" rx="1.5" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}
````

## File: src/components/charts/MiniLineChart.jsx
````javascript
// src/components/charts/MiniLineChart.jsx
//
// A small, dependency-free SVG line chart. No new npm package needed —
// this project has no chart library installed, and a handful of plain
// SVG components is simpler to install (nothing to install) and audit
// than adding one for three small charts.
//
// Accessible by design rather than by adding interactivity: instead of
// JS-driven hover tooltips, the start/end labels and the overall change
// are always shown as real text under the chart, so the trend is never
// locked behind a color someone might not be able to distinguish.
export default function MiniLineChart({ data, height = 140, colorClassName = 'text-blue-600', formatValue = (v) => String(v), ariaLabel }) {
  if (!data || data.length === 0) return null;

  const width = 300; // viewBox units — scales to container via className="w-full"
  const values = data.map((d) => Number(d.value) || 0);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padY = 10;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * stepX : width / 2;
    const y = height - padY - ((Number(d.value) || 0) - min) / range * (height - padY * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const change = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  const showDots = data.length <= 31;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" role="img" aria-label={ariaLabel || 'Trend chart'}>
        <path d={areaPath} className={colorClassName} fill="currentColor" opacity="0.08" />
        <path d={linePath} className={colorClassName} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {showDots && points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" className={colorClassName} fill="currentColor" />
        ))}
      </svg>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-400">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
      {change !== null && (
        <p className={`mt-1 text-xs font-semibold ${change >= 0 ? 'text-moss-700' : 'text-rust-600'}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% over this period — ending at {formatValue(last)}
        </p>
      )}
    </div>
  );
}
````

## File: src/components/common/ConfirmDialog.jsx
````javascript
import { useEffect } from 'react';
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, confirmDisabled = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = e => { if (e.key === 'Escape' && !confirmDisabled) onCancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel, confirmDisabled]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-4 sm:items-center" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-xl">
        <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
        {message && <p className="mt-2 text-sm text-ink-500">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} disabled={confirmDisabled}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
````

## File: src/components/common/ConnectivityIndicator.jsx
````javascript
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
export default function ConnectivityIndicator() {
  const online = useOnlineStatus();
  return (
    <span className={`badge ${online ? 'bg-moss-100 text-moss-700' : 'bg-rust-100 text-rust-700'}`} title={online ? 'Online' : 'Offline — changes queue until reconnected'}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${online ? 'bg-moss-500' : 'bg-rust-500'}`} />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}
````

## File: src/components/common/EmptyState.jsx
````javascript
export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl2 border border-dashed border-ink-200 bg-white py-14 px-6 text-center">
      <h3 className="font-display text-base font-bold text-ink-800">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
````

## File: src/components/common/ErrorBanner.jsx
````javascript
export default function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="rounded-lg border border-rust-200 bg-rust-50 px-4 py-3 text-sm font-medium text-rust-700">{message}</div>;
}
````

## File: src/components/common/ErrorBoundary.jsx
````javascript
import { Component } from 'react';
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('FlowBiz error:', error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="font-display text-lg font-bold text-ink-900">Something went wrong</h2>
          <p className="text-sm text-ink-500">{this.state.error?.message}</p>
          <button className="btn-primary w-full" onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
}
````

## File: src/components/common/ExportCsvButton.jsx
````javascript
import { Download } from 'lucide-react';
import { exportToCSV } from '../../utils/csvExport';
export default function ExportCsvButton({ filename, rows, label = 'Export CSV' }) {
  return (
    <button className="btn-outline" disabled={!rows || rows.length === 0} onClick={() => exportToCSV(filename, rows)}>
      <Download className="h-4 w-4" strokeWidth={1.75} />{label}
    </button>
  );
}
````

## File: src/components/common/LoadingSpinner.jsx
````javascript
export default function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
````

## File: src/components/common/Modal.jsx
````javascript
import { useEffect, useRef } from 'react';

export default function Modal({
  open,
  title,
  onClose,
  children,
  widthClass = 'max-w-md',
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);

    // Focus only once when the modal opens.
    const firstInput = containerRef.current?.querySelector(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
    );

    firstInput?.focus();

    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        className={`max-h-[92vh] w-full ${widthClass} overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl2`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
````

## File: src/components/common/ProtectedRoute.jsx
````javascript
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoMode } from '../../demo/demoMode';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const {
    firebaseUser, profile, loading, authError, accountRemoved, sessionRevoked,
    isAdmin, isActive, emailVerified, logout, reloadProfile, resendVerificationEmail,
    refreshEmailVerification,
  } = useAuth();
  const demo = isDemoMode();

  useEffect(() => {
    if (authError) console.error('ProtectedRoute captured authError:', authError);
  }, [authError]);

  useEffect(() => {
    if (demo || !firebaseUser || emailVerified) return;

    const handleFocus = () => { refreshEmailVerification(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshEmailVerification();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // FIX: was polling every 5s unconditionally. Each poll calls
    // Firebase's reload(), which internally notifies auth listeners and
    // causes Firestore to tear down and re-open its entire realtime
    // connection every time — even while the tab is in the background
    // and nothing changed. That churn shows up as repeated
    // ERR_BLOCKED_BY_CLIENT noise on connections some ad blockers/proxies
    // flag, and increases the odds of a listener briefly missing an
    // update. focus/visibilitychange above already cover the main case
    // (returning to the tab after clicking the email link); this
    // interval is only a slow fallback for browsers where those events
    // don't fire reliably, so it's slowed down and skipped while hidden.
    const pollId = setInterval(() => {
      if (document.visibilityState === 'visible') refreshEmailVerification();
    }, 20000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(pollId);
    };
  }, [demo, firebaseUser, emailVerified, refreshEmailVerification]);

  if (loading) return <LoadingSpinner label="Checking your session…" />;
  if (!firebaseUser) return <Navigate to="/login" replace />;

  if (sessionRevoked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h2 className="font-display text-lg font-bold text-ink-900">This device was signed out</h2>
          <p className="text-sm text-ink-500">An owner revoked access for this device from Settings → Device Management.</p>
          <button className="btn-primary w-full" onClick={() => (window.location.href = '/login')}>Go to sign in</button>
        </div>
      </div>
    );
  }

  if (accountRemoved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <div className="text-4xl">🚫</div>
          <h2 className="font-display text-lg font-bold text-ink-900">This account has been removed</h2>
          <p className="text-sm text-ink-500">Please contact your business owner.</p>
          <button className="btn-primary w-full" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-md w-full p-6 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="font-display text-lg font-bold text-ink-900">Profile unavailable</h2>
          <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-left">
            <p className="text-xs font-semibold text-rust-700 uppercase tracking-wide">Error details</p>
            <p className="mt-1 text-sm text-rust-700 break-words font-mono">{authError || 'No error captured — check DevTools console'}</p>
          </div>
          <p className="text-sm text-ink-500">If you just updated Firestore rules, your browser may be using a stale offline cache.</p>
          <div className="flex flex-col gap-2">
            <button className="btn-primary w-full" onClick={reloadProfile}>Retry profile load</button>
            <button className="btn-outline w-full" onClick={async () => { await logout(); window.location.href = '/login'; }}>Sign out and return to login</button>
          </div>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm p-6">
          <h2 className="font-display text-lg font-bold text-ink-900">Account deactivated</h2>
          <p className="mt-2 text-sm text-ink-500">Contact a business owner to regain access.</p>
        </div>
      </div>
    );
  }

  if (!demo && !emailVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <div className="text-4xl">📧</div>
          <h2 className="font-display text-lg font-bold text-ink-900">Verify your email</h2>
          <p className="text-sm text-ink-500">We sent a verification link to your email address. Click it, then come back to this tab — FlowBiz will pick it up automatically.</p>
          <div className="flex flex-col gap-2">
            <button
              className="btn-primary w-full"
              onClick={async () => {
                const verified = await refreshEmailVerification();
                if (!verified) toast.error("Not verified yet — check your email and click the link, then try again.");
              }}
            >
              I've verified — check now
            </button>
            <button
              className="btn-outline w-full"
              onClick={async () => {
                try {
                  await resendVerificationEmail();
                  toast.success('Verification email sent.');
                } catch (err) {
                  console.error('[FlowBiz] resendVerificationEmail failed:', err.code || err.name, err.message);
                  toast.error(
                    err.code === 'auth/too-many-requests'
                      ? 'Too many verification attempts. Please wait before requesting another email.'
                      : "Couldn't send the verification email. Please try again in a moment."
                  );
                }
              }}
            >
              Resend verification email
            </button>
            <button className="text-xs text-ink-400 hover:underline" onClick={logout}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  if (adminOnly && !isAdmin) return <Navigate to="/counter" replace />;
  return children;
}
````

## File: src/components/debtors/RefundModal.jsx
````javascript
import { useState } from 'react';
import Modal from '../common/Modal';
import { formatKES } from '../../utils/currency';
import { Banknote, Smartphone } from 'lucide-react';

export default function RefundModal({ open, creditSale, onClose, onSubmit }) {
  const [method, setMethod] = useState('Cash');
  const [busy, setBusy]     = useState(false);
  if (!creditSale) return null;
  const amountPaid = Number(creditSale.amountPaid) || 0;
  const handle = async e => {
    e.preventDefault(); setBusy(true);
    try { await onSubmit({ method }); setMethod('Cash'); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Refund — ${creditSale.productName}`}>
      <form onSubmit={handle} className="space-y-3">
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
          Already collected from customer: <span className="font-semibold text-ink-800">{formatKES(amountPaid)}</span>
          <p className="mt-1 text-xs text-ink-400">This amount will be handed back and recorded as money leaving the till. Stock will be restored.</p>
        </div>
        <div>
          <label className="label">Refund via</label>
          <div className="grid grid-cols-2 gap-2">
            {['Cash','M-Pesa'].map(m=>(
              <button key={m} type="button" onClick={()=>setMethod(m)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${method===m?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>
                {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-danger" disabled={busy}>{busy?'Refunding…':'Confirm refund'}</button>
        </div>
      </form>
    </Modal>
  );
}
````

## File: src/components/debtors/RepaymentModal.jsx
````javascript
import { useState } from 'react';
import Modal from '../common/Modal';
import { formatKES } from '../../utils/currency';
import { Banknote, Smartphone } from 'lucide-react';
export default function RepaymentModal({ open, customer, totalOwed, onClose, onSubmit }) {
  const [amount, setAmount]     = useState('');
  const [method, setMethod]     = useState('Cash');
  const [mpesaCode, setMpesa]   = useState('');
  const [busy, setBusy]         = useState(false);
  if (!customer) return null;
  const numeric = Number(amount) || 0;
  // MP-6 FIX: prevent over-repayment
  const overRepayment = numeric > totalOwed + 0.005;
  const canSubmit = numeric > 0 && !overRepayment && (method !== 'M-Pesa' || mpesaCode.trim()) && !busy;
  const handle = async e => {
    e.preventDefault(); setBusy(true);
    try { await onSubmit({ amount: numeric, method, mpesaCode: method==='M-Pesa'?mpesaCode.trim():null }); setAmount(''); setMpesa(''); onClose(); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Repayment — ${customer.name}`}>
      <form onSubmit={handle} className="space-y-3">
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">Outstanding: <span className="font-semibold text-rust-600">{formatKES(totalOwed)}</span></div>
        <div>
          <label className="label">Amount received (KES)</label>
          <input type="number" min="0.01" max={totalOwed} step="0.01" className="input" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus />
          {overRepayment && <p className="mt-1 text-xs text-rust-600">Amount exceeds the outstanding balance of {formatKES(totalOwed)}.</p>}
        </div>
        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-2 gap-2">
            {['Cash','M-Pesa'].map(m=>(
              <button key={m} type="button" onClick={()=>setMethod(m)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${method===m?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>
                {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
              </button>
            ))}
          </div>
        </div>
        {method==='M-Pesa' && <div><label className="label">M-Pesa code <span className="text-rust-500">*</span></label><input className="input uppercase" value={mpesaCode} onChange={e=>setMpesa(e.target.value.toUpperCase())} placeholder="QWE1234567" /></div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>{busy?'Saving…':'Record repayment'}</button>
        </div>
      </form>
    </Modal>
  );
}
````

## File: src/components/layout/AppShell.jsx
````javascript
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import TopHeader from './TopHeader';
export default function AppShell({ children }) {
  return (
    <div className="flex min-h-screen bg-sand">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <TopHeader />
        <main className="flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:px-6 lg:pb-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
````

## File: src/components/layout/navConfig.js
````javascript
export const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard', icon: 'LayoutDashboard', adminOnly: true  },
  { to: '/counter',    label: 'Counter',   icon: 'ShoppingCart',    adminOnly: false },
  { to: '/customers',  label: 'Customers', icon: 'Users',           adminOnly: false },
  { to: '/expenses',   label: 'Expenses',  icon: 'Receipt',         adminOnly: false },
  { to: '/purchases',  label: 'Purchases', icon: 'Truck',           adminOnly: true  },
  { to: '/products',   label: 'Products',  icon: 'Package',         adminOnly: true  },
  { to: '/suppliers',  label: 'Suppliers', icon: 'Tag',             adminOnly: true  },
  { to: '/stock-take', label: 'Stock Take',icon: 'ClipboardCheck',  adminOnly: true  },
  { to: '/reports',    label: 'Reports',   icon: 'BarChart3',       adminOnly: true  },
  { to: '/close-day',  label: 'Close Day', icon: 'Lock',            adminOnly: true  },
  { to: '/users',      label: 'Team',      icon: 'UsersRound',      adminOnly: true  },
  { to: '/settings',   label: 'Settings',  icon: 'Settings',        adminOnly: true  },
];
export const MOBILE_PRIMARY = {
  admin:   ['/', '/counter', '/customers', '/reports', '/settings'],
  cashier: ['/counter', '/customers', '/expenses'],
};
````

## File: src/components/layout/TopHeader.jsx
````javascript
import { useAuth } from '../../contexts/AuthContext';
import ConnectivityIndicator from '../common/ConnectivityIndicator';
import { isDemoMode } from '../../demo/demoMode';

export default function TopHeader() {
  const { profile, logout } = useAuth();
  const demo = isDemoMode();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-100 bg-sand/95 px-4 py-2 backdrop-blur sm:px-6 safe-top">
      <div className="flex items-center gap-2 lg:hidden">
        <img src="/icons/icon-72.png" alt="FlowBiz" className="h-7 w-7 rounded-lg" />
        <span className="font-display text-sm font-bold text-ink-900">FlowBiz</span>
      </div>
      <div className="hidden text-sm text-ink-500 lg:block">
        Welcome, <span className="font-semibold text-ink-800">{profile?.displayName}</span>
      </div>
      <div className="flex items-center gap-2">
        {demo && (
          <span className="badge bg-amber-100 text-amber-800" title="Sample data only — nothing here touches Firebase">
            Demo
          </span>
        )}
        <ConnectivityIndicator />
        {/* FIX: was checking profile?.role === 'admin', a role value that
            no longer exists anywhere in this app — every owner was
            showing as "Cashier" here. This app's actual roles are
            'owner' and 'cashier'. */}
        <span className={`badge hidden sm:inline-flex ${profile?.role === 'owner' ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-700'}`}>
          {profile?.role === 'owner' ? 'Owner' : 'Cashier'}
        </span>
        {!demo && (
          <button onClick={logout} className="btn-outline !px-3 !py-1.5 text-xs !min-h-0">Sign out</button>
        )}
      </div>
    </header>
  );
}
````

## File: src/components/pos/OpenSessionPrompt.jsx
````javascript
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function OpenSessionPrompt({ onOpen }) {
  const [cash, setCash]     = useState('');
  const [mpesa, setMpesa]   = useState('');
  const [busy, setBusy]     = useState(false);
  const handle = async e => {
    e.preventDefault(); setBusy(true);
    try {
      await onOpen({ openingCashFloat: Number(cash)||0, openingMpesaFloat: Number(mpesa)||0 });
    } catch (err) {
      // FIX: previously any failure here was silently swallowed — the
      // button would just stop spinning with no explanation.
      toast.error(err.message || "Couldn't open the counter. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-sm pt-8">
      <div className="card p-6 space-y-4">
        <div className="text-center"><div className="text-3xl mb-2">🏪</div>
          <h2 className="font-display text-lg font-bold text-ink-900">Open today's counter</h2>
          <p className="text-sm text-ink-400 mt-1">Enter starting balances for accurate end-of-day reconciliation.</p>
        </div>
        <form onSubmit={handle} className="space-y-3">
          <div><label className="label">Opening cash float (KES)</label><input type="number" min="0" className="input" value={cash} onChange={e=>setCash(e.target.value)} placeholder="0" autoFocus /></div>
          <div><label className="label">Opening M-Pesa balance (KES)</label><input type="number" min="0" className="input" value={mpesa} onChange={e=>setMpesa(e.target.value)} placeholder="0" /></div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Opening…' : 'Open counter'}</button>
        </form>
      </div>
    </div>
  );
}
````

## File: src/components/pos/ProductGrid.jsx
````javascript
import { formatKES } from '../../utils/currency';
import { Pencil } from 'lucide-react';
export default function ProductGrid({ products, onSelect, isAdmin=false, onEdit }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map(p => {
        const out = p.stock <= 0;
        const low = !out && p.stock <= (p.lowStockThreshold ?? 5);
        return (
          <div key={p.id} className={`relative flex flex-col rounded-xl border bg-white p-3 transition-shadow ${out ? 'opacity-50 border-ink-100' : low ? 'border-rust-200 shadow-sm' : 'border-ink-100 shadow-sm hover:shadow-md'}`}>
            <button disabled={out} onClick={()=>onSelect(p)} className="flex-1 flex flex-col items-start gap-1 text-left w-full disabled:pointer-events-none">
              <span className="badge bg-ink-100 text-ink-400 text-[10px] mb-0.5">{p.category}</span>
              <span className="font-semibold text-[13px] leading-tight text-ink-800 line-clamp-2">{p.name}</span>
              <span className="font-display text-sm font-bold text-moss-700">{formatKES(p.sellingPrice)}</span>
              <span className={`text-[11px] font-medium ${out ? 'text-rust-600' : low ? 'text-rust-500' : 'text-ink-400'}`}>
                {out ? 'Out of stock' : `${p.stock} left${low ? ' ⚠️' : ''}`}
              </span>
            </button>
            {isAdmin && onEdit && (
              <button onClick={e=>{e.stopPropagation();onEdit(p);}} className="absolute top-1 right-1 p-1 rounded text-ink-300 hover:bg-ink-50 hover:text-ink-600">
                <Pencil className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
````

## File: src/components/pos/SaleModal.jsx
````javascript
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { formatKES } from '../../utils/currency';
import { Banknote, Smartphone, BookOpen } from 'lucide-react';
import { raceWithTimeout } from '../../utils/offlineWrite';
import { friendlyErrorMessage } from '../../utils/errorMessages';

const METHODS = [
  { id: 'Cash',   label: 'Cash',   Icon: Banknote   },
  { id: 'M-Pesa', label: 'M-Pesa', Icon: Smartphone },
  { id: 'Credit', label: 'Credit', Icon: BookOpen   },
];

export default function SaleModal({ open, product, customers, onClose, onConfirmSale, onConfirmCredit, onCreateCustomer }) {
  const [quantity, setQuantity]               = useState(1);
  const [price, setPrice]                     = useState(product?.sellingPrice ?? 0);
  const [method, setMethod]                   = useState('Cash');
  const [mpesaCode, setMpesaCode]             = useState('');
  const [customerId, setCustomerId]           = useState('');
  const [newMode, setNewMode]                 = useState(false);
  const [newName, setNewName]                 = useState('');
  const [newPhone, setNewPhone]               = useState('');
  const [submitting, setSubmitting]           = useState(false);

  useEffect(() => {
    setQuantity(1); setPrice(product?.sellingPrice ?? 0); setMethod('Cash');
    setMpesaCode(''); setCustomerId(''); setNewMode(false); setNewName(''); setNewPhone('');
  }, [product?.id, product?.sellingPrice]);

  if (!product) return null;

  const total        = (Number(price) || 0) * (Number(quantity) || 0);
  const exceedsStock = Number(quantity) > product.stock;
  const needsMpesaCode = method === 'M-Pesa' && !mpesaCode.trim();
  const needsCustomer  = method === 'Credit' && !customerId && !(newMode && newName.trim());
  const canSubmit = Number(quantity) > 0 && !exceedsStock && Number(price) >= 0 && !needsMpesaCode && !needsCustomer && !submitting;

const handleConfirm = async () => {
    setSubmitting(true);
    try {
      let cId = customerId, cName = customers.find(c=>c.id===customerId)?.name, cPhone = customers.find(c=>c.id===customerId)?.phone;
      if (method === 'Credit' && newMode) {
        const cr = await onCreateCustomer({ name: newName.trim(), phone: newPhone.trim() });
        cId = cr.id; cName = cr.name; cPhone = cr.phone;
      }

      const { record, commit } = method === 'Credit'
        ? onConfirmCredit({ product, quantity: Number(quantity), soldPricePerUnit: Number(price), customerId: cId, customerName: cName, customerPhone: cPhone })
        : onConfirmSale({ product, quantity: Number(quantity), soldPricePerUnit: Number(price), paymentMethod: method, mpesaCode: method === 'M-Pesa' ? mpesaCode.trim() : null });

      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      if (queuedOffline) {
        toast.success("Sale saved — it'll sync once you're back online.");
        commit.catch((err) => toast.error(`A sale from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      }
      onClose(record);
    } catch (err) {
      toast.error(friendlyErrorMessage(err, {
        overrides: { 'permission-denied': "That didn't go through — the stock may have just changed, or today's session may have been closed. Please refresh and try again." },
      }));
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={() => onClose(null)} title="Record Sale">
      <div className="space-y-4">
        <div className="rounded-lg bg-ink-50 px-3 py-2.5">
          <p className="font-semibold text-ink-800">{product.name}</p>
          <p className="text-xs text-ink-400">In stock: <span className="font-semibold">{product.stock}</span> · Default {formatKES(product.sellingPrice)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity</label>
            <input type="number" min="1" max={product.stock} className="input" value={quantity} onChange={e=>setQuantity(e.target.value)} />
            {exceedsStock && <p className="mt-1 text-xs font-medium text-rust-600">Only {product.stock} left.</p>}
          </div>
          <div>
            <label className="label">Price / unit (KES)</label>
            <input type="number" min="0" step="0.01" className="input" value={price} onChange={e=>setPrice(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5">
          <span className="text-sm font-medium text-ink-500">Total</span>
          <span className="font-display text-lg font-bold text-ink-900">{formatKES(total)}</span>
        </div>
        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(({id,label,Icon}) => (
              <button key={id} type="button" onClick={()=>setMethod(id)} className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-semibold ${method===id ? 'border-moss-600 bg-moss-50 text-moss-800' : 'border-ink-200 text-ink-500'}`}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />{label}
              </button>
            ))}
          </div>
        </div>
        {method === 'M-Pesa' && (
          <div>
            <label className="label">M-Pesa transaction code <span className="text-rust-500">*</span></label>
            <input className="input uppercase" placeholder="e.g. QWE1234567" value={mpesaCode} onChange={e=>setMpesaCode(e.target.value.toUpperCase())} />
            {needsMpesaCode && <p className="mt-1 text-xs text-rust-600">Transaction code required for M-Pesa sales.</p>}
          </div>
        )}
        {method === 'Credit' && (
          <div className="space-y-2 rounded-lg border border-ink-100 p-3">
            {!newMode ? (
              <>
                <label className="label">Customer (Deni)</label>
                <select className="input" value={customerId} onChange={e=>setCustomerId(e.target.value)}>
                  <option value="">— Select customer —</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}</option>)}
                </select>
                <button type="button" className="text-xs font-semibold text-moss-700 hover:underline" onClick={()=>setNewMode(true)}>+ New customer</button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between"><label className="label">New customer</label><button type="button" className="text-xs text-ink-400 hover:underline" onClick={()=>setNewMode(false)}>Use existing</button></div>
                <input className="input" placeholder="Customer name" value={newName} onChange={e=>setNewName(e.target.value)} />
                <input className="input" placeholder="Phone (07xx...)" value={newPhone} onChange={e=>setNewPhone(e.target.value)} />
              </>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={() => onClose(null)}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!canSubmit} onClick={handleConfirm}>
            {submitting ? 'Recording…' : method==='Credit' ? 'Record credit' : 'Confirm sale'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
````

## File: src/components/scanner/ScanFab.jsx
````javascript
// src/components/scanner/ScanFab.jsx
import { ScanLine } from 'lucide-react';

export default function ScanFab({ onClick, label = 'Scan barcode' }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-moss-700 text-white shadow-xl hover:bg-moss-800 active:scale-95 lg:bottom-6 lg:right-6"
      aria-label={label}
      title={label}
    >
      <ScanLine className="h-6 w-6" strokeWidth={2} />
    </button>
  );
}
````

## File: src/components/scanner/ScannerModal.jsx
````javascript
// src/components/scanner/ScannerModal.jsx
import { useCallback, useEffect, useState } from 'react';
import { X, Zap, ZapOff, AlertTriangle } from 'lucide-react';
import { useCameraScanner } from '../../hooks/useCameraScanner';

export default function ScannerModal({ open, onClose, onDetected }) {
  // Guards against multiple rapid detections firing in the brief window
  // between "we found something" and the parent page actually closing us.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (open) setPaused(false);
  }, [open]);

  const handleDetected = useCallback((text) => {
    if (paused) return;
    setPaused(true);
    onDetected(text);
  }, [paused, onDetected]);

const { videoRef, status, torchOn, torchSupported, toggleTorch, retry } = useCameraScanner({
    onDetected: handleDetected,
    active: open && !paused,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950">
      <div className="flex items-center justify-between px-4 py-3 safe-top">
        <span className="font-display text-sm font-bold text-white">Scan barcode</span>
        <button onClick={onClose} className="rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Close">
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

        {status === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-64 rounded-xl2 border-2 border-moss-400/80" />
          </div>
        )}

        {status === 'denied' && (
          <ScannerMessage
            icon={<AlertTriangle className="h-8 w-8 text-rust-400" strokeWidth={1.75} />}
            title="Camera permission needed"
            body="FlowBiz needs camera access to scan barcodes. Please allow camera access in your browser settings, then try again."
            action={<button type="button" onClick={retry} className="btn-primary mt-2">Try again</button>}
          />
        )}

        {status === 'insecure' && (
          <ScannerMessage
            icon={<AlertTriangle className="h-8 w-8 text-rust-400" strokeWidth={1.75} />}
            title="Camera needs a secure connection"
            body="This page was opened over a plain network address (not HTTPS or localhost), so the browser blocks camera access entirely on this device. Open the app via HTTPS, or via localhost on this device, to use the scanner. You can still find the product by searching its name or code."
          />
        )}

        {status === 'unavailable' && (
          <ScannerMessage
            icon={<AlertTriangle className="h-8 w-8 text-rust-400" strokeWidth={1.75} />}
            title="Camera unavailable"
            body="No usable camera was found on this device. You can still find the product by searching its name or code."
            action={<button type="button" onClick={retry} className="btn-primary mt-2">Try again</button>}
          />
        )}
      </div>

      {torchSupported && status === 'scanning' && (
        <div className="flex justify-center pb-8 pt-4 safe-bottom">
          <button
            onClick={toggleTorch}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${torchOn ? 'bg-amber-400 text-ink-900' : 'bg-white/10 text-white'}`}
          >
            {torchOn ? <Zap className="h-4 w-4" strokeWidth={1.75} /> : <ZapOff className="h-4 w-4" strokeWidth={1.75} />}
            Torch
          </button>
        </div>
      )}
    </div>
  );
}

function ScannerMessage({ icon, title, body, action }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
      {icon}
      <p className="font-display text-base font-bold text-white">{title}</p>
      <p className="text-sm text-white/70">{body}</p>
      {action}
    </div>
  );
}
````

## File: src/components/suppliers/SupplierFormModal.jsx
````javascript
import { useEffect, useState } from 'react';
import Modal from '../common/Modal';

const empty = { name:'', contactPerson:'', phone:'', email:'', address:'', notes:'' };
export default function SupplierFormModal({ open, onClose, onSave, initialSupplier }) {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(initialSupplier ? {...empty,...initialSupplier} : empty); setBusy(false); }, [initialSupplier, open]);
  const set = f => e => setForm(p=>({...p,[f]:e.target.value}));

  const handle = async e => {
    e.preventDefault();
    if (!form.name.trim() || busy) return;
    setBusy(true);
    try {
      await onSave({...form,name:form.name.trim()});
    } catch (err) {
      setBusy(false);
    }
  };
  const handleClose = () => { if (!busy) onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title={initialSupplier ? 'Edit supplier' : 'Add supplier'}>
      <form onSubmit={handle} className="space-y-3">
        <div><label className="label">Business name</label><input className="input" value={form.name} onChange={set('name')} required disabled={busy} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Contact person</label><input className="input" value={form.contactPerson} onChange={set('contactPerson')} disabled={busy} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} placeholder="07xx xxx xxx" disabled={busy} /></div>
        </div>
        <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={set('email')} disabled={busy} /></div>
        <div><label className="label">Address</label><input className="input" value={form.address} onChange={set('address')} disabled={busy} /></div>
        <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} disabled={busy} /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : (initialSupplier ? 'Save changes' : 'Add supplier')}</button>
        </div>
      </form>
    </Modal>
  );
}
````

## File: src/constants/categories.js
````javascript
// FIX: Removed 'Stock Purchase' and 'Supplier Payment' to prevent manual double-entry
export const EXPENSE_CATEGORIES = ['Rent','Electricity','Transport','Wages','Airtime Float','Shop Supplies','Security','County Fees','Other'];
export const PAYMENT_METHODS = ['Cash','M-Pesa'];
````

## File: src/demo/demoMode.js
````javascript
// src/demo/demoMode.js
// The single source of truth for "are we in Demo Mode right now?". Every
// other demo-aware piece of code (src/firebase.js, AuthContext, businessReset)
// checks this instead of threading a prop/flag through the component tree.
const FLAG_KEY = 'flowbiz_demo_mode';

export function isDemoMode() {
  try {
    return localStorage.getItem(FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export function enterDemoMode() {
  try { localStorage.setItem(FLAG_KEY, 'true'); } catch { /* storage unavailable — ignore */ }
}

export function exitDemoMode() {
  try { localStorage.removeItem(FLAG_KEY); } catch { /* storage unavailable — ignore */ }
}
````

## File: src/demo/localFirestore.js
````javascript
// src/demo/localFirestore.js
//
// A minimal Firestore-compatible engine backed by localStorage. It exposes
// the same function names/signatures as the subset of the `firebase/firestore`
// SDK this app actually uses (collection, doc, addDoc, setDoc, updateDoc,
// deleteDoc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit,
// writeBatch, runTransaction, increment, serverTimestamp, deleteField) so
// that src/firebase.js can route to either implementation without any
// calling code knowing the difference.
//
// DEMO MODE WIRING: `npm run dev:demo` (vite --mode demo) aliases the
// package name 'firebase/firestore' itself to THIS FILE (see
// vite.config.js). That means every `import { collection, doc, ... } from
// 'firebase/firestore'` anywhere in the app — every page, every hook, and
// src/firebase.js itself — resolves to the functions below instead of the
// real Firebase SDK, with zero changes needed in any of those files. This
// is what actually connects this engine to the rest of the app; previously
// nothing did.
//
// Scope is deliberately limited to the query shapes this app actually
// issues (==, in, >=, <= filters; single orderBy; limit) — this is not a
// general-purpose Firestore clone, just enough to power FlowBiz's demo data
// correctly.

const STORAGE_PREFIX = 'flowbiz_demo_data:';

const cache = new Map();     // collectionName -> Map(docId -> data)
const listeners = new Map(); // collectionName -> Set(callback)
let idCounter = 0;

function generateId() {
  idCounter += 1;
  return `demo_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

// ── Timestamp (mimics Firestore's Timestamp: toDate()/toMillis()) ─────────
function makeTimestamp(millis) {
  return {
    __ts: true,
    millis,
    toDate() { return new Date(millis); },
    toMillis() { return millis; },
  };
}
function reviver(key, value) {
  if (value && typeof value === 'object' && value.__ts === true && typeof value.millis === 'number') {
    return makeTimestamp(value.millis);
  }
  return value;
}

// ── Storage / cache ─────────────────────────────────────────────────────
function ensureLoaded(name) {
  if (!cache.has(name)) {
    let obj = {};
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + name);
      if (raw) obj = JSON.parse(raw, reviver);
    } catch { /* corrupt or missing — start empty */ }
    cache.set(name, new Map(Object.entries(obj)));
  }
  return cache.get(name);
}
function getRaw(name, id) { return ensureLoaded(name).get(id) || null; }
function writeRaw(name, id, data) { ensureLoaded(name).set(id, data); }
function deleteRaw(name, id) { ensureLoaded(name).delete(id); }
function persistTouched(names) {
  names.forEach((name) => {
    const map = ensureLoaded(name);
    localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(Object.fromEntries(map)));
  });
}
function subscribe(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name)?.delete(fn);
}
function notify(names) { names.forEach((name) => listeners.get(name)?.forEach((fn) => fn())); }

// ── Write sentinels ─────────────────────────────────────────────────────
function isSentinel(v, kind) { return !!v && typeof v === 'object' && v.__sentinel === kind; }
function resolveWriteData(data, base) {
  const out = base ? { ...base } : {};
  Object.entries(data).forEach(([k, v]) => {
    if (isSentinel(v, 'serverTimestamp')) out[k] = makeTimestamp(Date.now());
    else if (isSentinel(v, 'increment')) out[k] = (typeof out[k] === 'number' ? out[k] : 0) + v.n;
    else if (isSentinel(v, 'deleteField')) delete out[k];
    else out[k] = v;
  });
  return out;
}
export function increment(n) { return { __sentinel: 'increment', n }; }
export function serverTimestamp() { return { __sentinel: 'serverTimestamp' }; }
export function deleteField() { return { __sentinel: 'deleteField' }; }

// ── Refs ─────────────────────────────────────────────────────────────────
export function collection(_db, name) { return { __type: 'collection', name }; }
export function doc(a, b, c) {
  if (a && a.__type === 'collection') {
    return { __type: 'doc', name: a.name, id: b || generateId() };
  }
  return { __type: 'doc', name: b, id: c || generateId() };
}

// ── Snapshots ────────────────────────────────────────────────────────────
function makeDocSnapshot(id, data) {
  return { id, exists: () => !!data, data: () => (data ? { ...data } : undefined) };
}
function makeQuerySnapshot(rows) {
  const docs = rows.map(([id, data]) => makeDocSnapshot(id, data));
  return { docs, empty: docs.length === 0, size: docs.length, forEach(fn) { docs.forEach(fn); } };
}

// ── Query engine ─────────────────────────────────────────────────────────
function getField(data, field) { return data ? data[field] : undefined; }
function toComparable(v) {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return v;
}
function matchWhere(fieldVal, op, value) {
  const a = toComparable(fieldVal);
  const b = toComparable(value);
  switch (op) {
    case '==': return a === b;
    case '!=': return a !== b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '>':  return a > b;
    case '<':  return a < b;
    case 'in': return Array.isArray(value) && value.includes(fieldVal);
    case 'array-contains': return Array.isArray(fieldVal) && fieldVal.includes(value);
    default: return true;
  }
}
function compareField(a, b) {
  const av = toComparable(a); const bv = toComparable(b);
  if (av == null && bv == null) return 0;
  if (av == null) return -1;
  if (bv == null) return 1;
  if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv);
  return av < bv ? -1 : av > bv ? 1 : 0;
}
function runQuery(target) {
  const name = target.__type === 'query' ? target.__collName : target.name;
  let rows = [...ensureLoaded(name).entries()];
  const constraints = target.__type === 'query' ? target.constraints : [];
  constraints.filter((c) => c.kind === 'where').forEach((c) => {
    rows = rows.filter(([, data]) => matchWhere(getField(data, c.field), c.op, c.value));
  });
  const orderC = constraints.find((c) => c.kind === 'orderBy');
  if (orderC) {
    rows = [...rows].sort(
      (a, b) => compareField(getField(a[1], orderC.field), getField(b[1], orderC.field)) * (orderC.dir === 'desc' ? -1 : 1)
    );
  }
  const limitC = constraints.find((c) => c.kind === 'limit');
  if (limitC) rows = rows.slice(0, limitC.n);
  return rows;
}

export function query(collRef, ...constraints) {
  return { __type: 'query', __collName: collRef.name, constraints };
}
export function where(field, op, value) { return { kind: 'where', field, op, value }; }
export function orderBy(field, dir = 'asc') { return { kind: 'orderBy', field, dir }; }
export function limit(n) { return { kind: 'limit', n }; }

// ── CRUD ─────────────────────────────────────────────────────────────────
export async function addDoc(collRef, data) {
  const id = generateId();
  writeRaw(collRef.name, id, resolveWriteData(data, null));
  persistTouched([collRef.name]);
  notify([collRef.name]);
  return { __type: 'doc', name: collRef.name, id };
}
export async function setDoc(ref, data, opts) {
  const base = opts?.merge ? getRaw(ref.name, ref.id) : null;
  writeRaw(ref.name, ref.id, resolveWriteData(data, base));
  persistTouched([ref.name]);
  notify([ref.name]);
}
export async function updateDoc(ref, data) {
  const existing = getRaw(ref.name, ref.id);
  if (!existing) throw new Error(`[demo] No document to update at ${ref.name}/${ref.id}`);
  writeRaw(ref.name, ref.id, resolveWriteData(data, existing));
  persistTouched([ref.name]);
  notify([ref.name]);
}
export async function deleteDoc(ref) {
  deleteRaw(ref.name, ref.id);
  persistTouched([ref.name]);
  notify([ref.name]);
}
export async function getDoc(ref) {
  return makeDocSnapshot(ref.id, getRaw(ref.name, ref.id));
}
export async function getDocs(target) {
  return makeQuerySnapshot(runQuery(target));
}
export function onSnapshot(target, onNext, onError) {
  const isDocRef = target.__type === 'doc';
  const key = isDocRef ? target.name : target.__collName;
  const deliver = () => {
    try {
      if (isDocRef) onNext(makeDocSnapshot(target.id, getRaw(target.name, target.id)));
      else onNext(makeQuerySnapshot(runQuery(target)));
    } catch (err) {
      onError?.(err);
    }
  };
  const timer = setTimeout(deliver, 0); // async initial delivery, matches real onSnapshot
  const unsub = subscribe(key, deliver);
  return () => { clearTimeout(timer); unsub(); };
}

export function writeBatch() {
  const ops = [];
  return {
    set(ref, data, opts) { ops.push({ type: 'set', ref, data, opts }); },
    update(ref, data) { ops.push({ type: 'update', ref, data }); },
    delete(ref) { ops.push({ type: 'delete', ref }); },
    async commit() {
      const touched = new Set();
      for (const op of ops) {
        if (op.type === 'set') {
          const base = op.opts?.merge ? getRaw(op.ref.name, op.ref.id) : null;
          writeRaw(op.ref.name, op.ref.id, resolveWriteData(op.data, base));
        } else if (op.type === 'update') {
          const existing = getRaw(op.ref.name, op.ref.id) || {};
          writeRaw(op.ref.name, op.ref.id, resolveWriteData(op.data, existing));
        } else if (op.type === 'delete') {
          deleteRaw(op.ref.name, op.ref.id);
        }
        touched.add(op.ref.name);
      }
      persistTouched([...touched]);
      notify([...touched]);
    },
  };
}

export async function runTransaction(_db, updateFn) {
  const touched = new Set();
  const tx = {
    async get(ref) { return makeDocSnapshot(ref.id, getRaw(ref.name, ref.id)); },
    set(ref, data, opts) {
      const base = opts?.merge ? getRaw(ref.name, ref.id) : null;
      writeRaw(ref.name, ref.id, resolveWriteData(data, base));
      touched.add(ref.name);
    },
    update(ref, data) {
      const existing = getRaw(ref.name, ref.id) || {};
      writeRaw(ref.name, ref.id, resolveWriteData(data, existing));
      touched.add(ref.name);
    },
    delete(ref) { deleteRaw(ref.name, ref.id); touched.add(ref.name); },
  };
  const result = await updateFn(tx);
  persistTouched([...touched]);
  notify([...touched]);
  return result;
}

// ── Init-time stubs ──────────────────────────────────────────────────────
// src/firebase.js calls these three real-SDK functions at module load time
// (initializeFirestore(app, {...}), inside a persistentLocalCache(...) with
// a persistentMultipleTabManager()). Because Demo Mode aliases the whole
// 'firebase/firestore' package to this file (see the top-of-file comment),
// those calls resolve here too — without these three stubs, firebase.js
// would throw immediately on import in Demo Mode ("initializeFirestore is
// not exported"). They don't need to do anything: this file's storage is
// already always "local" (localStorage) and doesn't use the real SDK's
// cache/tab-manager concepts at all.
export function initializeFirestore() { return { __demo: true }; }
export function persistentLocalCache() { return {}; }
export function persistentMultipleTabManager() { return {}; }

// ── Seeding helpers (used only by src/demo/seedData.js) ────────────────────
export function seedDoc(name, id, data) { writeRaw(name, id, data); }
export function seedCommit(names) { persistTouched(names); notify(names); }
export function clearAllDemoData() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(STORAGE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
  const touched = [...cache.keys()];
  cache.clear();
  notify(touched);
}
export { makeTimestamp };
````

## File: src/demo/seedData.js
````javascript
// src/demo/seedData.js
import { seedDoc, seedCommit, clearAllDemoData, makeTimestamp } from './localFirestore';
import { DEMO_UID } from './localAuth';

// MULTI-TENANT CHANGE: every collection in the real app is now scoped by
// `businessId`, and `tenantQuery()` throws if it's ever called without
// one. The demo dataset previously seeded documents with no businessId at
// all — under the new architecture that would make every single page's
// queries throw immediately on `npm run dev:demo`. This file now stamps
// a fixed DEMO_BUSINESS_ID onto every seeded document, and the demo
// user's own profile carries that same businessId + the new `role:
// 'owner'` value (replacing the old `role: 'admin'`), exactly mirroring
// what a real signed-up owner's profile looks like.
export const DEMO_BUSINESS_ID = 'demo-business';

const SUPPLIERS = [
  {
    id: 'sup_nairobi_electronics',
    name: 'Nairobi Electronics Wholesale Ltd',
    contactPerson: 'Peter Mwangi',
    phone: '0722 445 108',
    email: 'sales@nairobielectronics.co.ke',
    address: 'River Road, Nairobi',
    notes: 'Main supplier for accessories and cables.',
  },
  {
    id: 'sup_techhub',
    name: 'TechHub Distributors Kenya',
    contactPerson: 'Grace Wanjiru',
    phone: '0733 219 764',
    email: 'orders@techhubke.com',
    address: 'Kimathi Street, Nairobi',
    notes: 'Supplies laptops, monitors, and peripherals.',
  },
];

const PRODUCTS = [
  { name: 'Wireless Mouse',            category: 'Electronics', costPrice: 650,   sellingPrice: 950,   stock: 40, lowStockThreshold: 8,  barcode: '6009880123451', supplierId: 'sup_nairobi_electronics' },
  { name: 'Mechanical Keyboard',       category: 'Electronics', costPrice: 2800,  sellingPrice: 3999,  stock: 15, lowStockThreshold: 5,  barcode: '6009880123452', supplierId: 'sup_techhub' },
  { name: 'USB Flash Disk 32GB',       category: 'Electronics', costPrice: 350,   sellingPrice: 599,   stock: 60, lowStockThreshold: 10, barcode: '6009880123453', supplierId: 'sup_nairobi_electronics' },
  { name: 'External Hard Drive 1TB',   category: 'Electronics', costPrice: 4200,  sellingPrice: 5499,  stock: 12, lowStockThreshold: 4,  barcode: '6009880123454', supplierId: 'sup_techhub' },
  { name: 'Power Bank 10000mAh',       category: 'Electronics', costPrice: 1100,  sellingPrice: 1699,  stock: 25, lowStockThreshold: 6,  barcode: '6009880123455', supplierId: 'sup_nairobi_electronics' },
  { name: 'USB-C Charger 20W',         category: 'Electronics', costPrice: 550,   sellingPrice: 899,   stock: 4,  lowStockThreshold: 8,  barcode: '6009880123456', supplierId: 'sup_nairobi_electronics' },
  { name: 'Phone Charger (Micro-USB)', category: 'Electronics', costPrice: 300,   sellingPrice: 549,   stock: 3,  lowStockThreshold: 8,  barcode: '6009880123457', supplierId: 'sup_nairobi_electronics' },
  { name: 'HDMI Cable 1.5m',           category: 'Electronics', costPrice: 250,   sellingPrice: 449,   stock: 30, lowStockThreshold: 6,  barcode: '6009880123458', supplierId: 'sup_nairobi_electronics' },
  { name: 'Monitor 24" LED',           category: 'Electronics', costPrice: 12500, sellingPrice: 15999, stock: 6,  lowStockThreshold: 3,  barcode: '6009880123459', supplierId: 'sup_techhub' },
  { name: 'Laptop Stand',              category: 'Electronics', costPrice: 900,   sellingPrice: 1450,  stock: 18, lowStockThreshold: 5,  barcode: '6009880123460', supplierId: 'sup_techhub' },
  { name: 'Bluetooth Speaker',         category: 'Electronics', costPrice: 1800,  sellingPrice: 2699,  stock: 2,  lowStockThreshold: 5,  barcode: '6009880123461', supplierId: 'sup_techhub' },
  { name: 'Earbuds (Wireless)',        category: 'Electronics', costPrice: 1200,  sellingPrice: 1899,  stock: 22, lowStockThreshold: 6,  barcode: '6009880123462', supplierId: 'sup_nairobi_electronics' },
  { name: 'Headphones (Over-ear)',     category: 'Electronics', costPrice: 2200,  sellingPrice: 3299,  stock: 10, lowStockThreshold: 4,  barcode: '6009880123463', supplierId: 'sup_techhub' },
  { name: 'Extension Cable (4-way)',   category: 'Electronics', costPrice: 700,   sellingPrice: 1099,  stock: 20, lowStockThreshold: 5,  barcode: '6009880123464', supplierId: 'sup_nairobi_electronics' },
  { name: 'Router (Wireless N)',       category: 'Electronics', costPrice: 2600,  sellingPrice: 3599,  stock: 9,  lowStockThreshold: 4,  barcode: '6009880123465', supplierId: 'sup_techhub' },
  { name: 'Smart Watch',               category: 'Electronics', costPrice: 3500,  sellingPrice: 4999,  stock: 7,  lowStockThreshold: 3,  barcode: '6009880123466', supplierId: 'sup_techhub' },
];

function buildAndSeed() {
  const now = makeTimestamp(Date.now());
  const touched = new Set();

  SUPPLIERS.forEach((s) => {
    const { id, ...data } = s;
    seedDoc('suppliers', id, { ...data, businessId: DEMO_BUSINESS_ID, createdAt: now });
    touched.add('suppliers');
  });

  PRODUCTS.forEach((p, i) => {
    const id = `demo_product_${i + 1}`;
    const internalCode = `FB-${String(i + 1).padStart(6, '0')}`;
    seedDoc('products', id, { ...p, businessId: DEMO_BUSINESS_ID, internalCode, deleted: false, createdAt: now, updatedAt: now });
    // Flat, businessId-prefixed doc id — matches utils/products.js exactly,
    // so a demo-seeded barcode round-trips through the same lookup code a
    // real business's products do.
    seedDoc('barcodeIndex', `${DEMO_BUSINESS_ID}__${p.barcode}`, { businessId: DEMO_BUSINESS_ID, barcode: p.barcode, productId: id });
    touched.add('products');
    touched.add('barcodeIndex');
  });
  seedDoc('productCodeCounters', DEMO_BUSINESS_ID, { businessId: DEMO_BUSINESS_ID, lastNumber: PRODUCTS.length });
  touched.add('productCodeCounters');

  // Business record + owner profile — mirrors exactly what Setup.jsx
  // creates for a real signed-up owner, so nothing downstream needs to
  // special-case Demo Mode.
  seedDoc('businesses', DEMO_BUSINESS_ID, {
    name: 'FlowBiz Demo Store',
    ownerIds: [DEMO_UID],
    createdAt: now,
    createdBy: DEMO_UID,
    subscription: { plan: 'free', status: 'active', expiry: null },
  });
  touched.add('businesses');

  seedDoc('users', DEMO_UID, {
    uid: DEMO_UID, email: 'demo@flowbiz.app', displayName: 'Demo Owner',
    role: 'owner', businessId: DEMO_BUSINESS_ID, active: true, createdAt: now,
  });
  touched.add('users');

  // Replaces the old settings/general + settings/categories docs — see
  // useSettings.js and ProductFormModal.jsx, both of which now read this
  // single per-business document.
  seedDoc('businessSettings', DEMO_BUSINESS_ID, {
    shopName: 'FlowBiz Demo Store',
    cashierCanRecordExpenses: true,
    categories: ['Groceries', 'Beverages', 'Electronics', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other'],
  });
  touched.add('businessSettings');

  // Sales, purchases, expenses, credit sales, repayments, and daily
  // sessions are intentionally left empty — those figures should come
  // from actually using the app, per spec.

  seedCommit([...touched]);
}

export function seedDemoDataIfNeeded() {
  if (localStorage.getItem('flowbiz_demo_seeded_v2') === 'true') return;
  buildAndSeed();
  localStorage.setItem('flowbiz_demo_seeded_v2', 'true');
}

export function resetDemoData() {
  clearAllDemoData();
  buildAndSeed();
  localStorage.setItem('flowbiz_demo_seeded_v2', 'true');
}
````

## File: src/hooks/useCameraScanner.js
````javascript
// src/hooks/useCameraScanner.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

// Dev-only diagnostics — never runs in production, never changes `status`.
const DEV = import.meta.env.DEV;
const devLog = (...args) => { if (DEV) console.log('[Scanner]', ...args); };
const devError = (...args) => { if (DEV) console.error('[Scanner]', ...args); };
const [retryToken, setRetryToken] = useState(0);
const retry = useCallback(() => setRetryToken((t) => t + 1), []);

function getInsecureContextReason() {
  if (typeof window === 'undefined') return null;
  if (window.isSecureContext) return null;
  return { protocol: window.location.protocol, hostname: window.location.hostname };
}

// Fallback cascade instead of a single fixed constraint set — covers
// exact vs ideal facingMode and an environment→user→any-camera fallback,
// so one rejected constraint doesn't fail the whole scan attempt outright.
function buildConstraintAttempts() {
  return [
    { label: 'exact environment', constraints: { video: { facingMode: { exact: 'environment' } } } },
    { label: 'ideal environment', constraints: { video: { facingMode: 'environment' } } },
    { label: 'user-facing', constraints: { video: { facingMode: 'user' } } },
    { label: 'any camera', constraints: { video: true } },
  ];
}

export function useCameraScanner({ onDetected, active }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  // decodeFromConstraints() resolves with an IScannerControls object —
  // THAT is what exposes .stop() for a continuous decode session in this
  // @zxing/browser version. Cleanup must go through it, not the reader.
  const controlsRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | starting | scanning | denied | unavailable | insecure
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stop = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch (err) {
      devError('controls.stop() failed', err);
    }
    controlsRef.current = null;

    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch (err) {
      devError('manual track stop failed', err);
    }
    streamRef.current = null;

    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('starting');

    // Secure-context guard — checked BEFORE touching mediaDevices at all,
    // so the real cause is surfaced instead of a generic "unavailable".
    const insecure = getInsecureContextReason();
    if (insecure) {
      devError(
        'Insecure context — navigator.mediaDevices is unavailable.',
        'protocol:', insecure.protocol,
        'hostname:', insecure.hostname,
        'window.isSecureContext:', window.isSecureContext
      );
      setStatus('insecure');
      return () => { cancelled = true; stop(); };
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      devError('navigator.mediaDevices.getUserMedia is not available in this browser.');
      setStatus('unavailable');
      return () => { cancelled = true; stop(); };
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    if (DEV) {
      devLog(
        'window.isSecureContext:', window.isSecureContext,
        'protocol:', window.location.protocol,
        'hostname:', window.location.hostname
      );
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          const cams = devices.filter((d) => d.kind === 'videoinput');
          devLog(
            'videoinput devices (labels blank until permission is granted):',
            cams.length,
            cams.map((c) => ({ deviceId: c.deviceId, label: c.label || '(hidden)' }))
          );
        })
        .catch((err) => devError('enumerateDevices() failed', err));
    }

    (async () => {
      const attempts = buildConstraintAttempts();
      let lastError = null;

      for (const attempt of attempts) {
        if (cancelled) return;
        devLog(`trying constraints [${attempt.label}]:`, attempt.constraints);
        try {
          // eslint-disable-next-line no-await-in-loop
          const controls = await reader.decodeFromConstraints(
            attempt.constraints,
            videoRef.current,
            (result, err) => {
              if (cancelled) return;
              if (result) {
                onDetected(result.getText());
                return;
              }
              // NotFoundException fires continuously between frames while
              // scanning with nothing in view — that's expected, not an error.
              if (DEV && err && err.name !== 'NotFoundException') {
                devError('decode callback error:', err.name, err.message);
              }
            }
          );

          if (cancelled) {
            try { controls.stop(); } catch (err) { devError('post-cancel controls.stop() failed', err); }
            return;
          }

          controlsRef.current = controls;
          setStatus('scanning');
          streamRef.current = videoRef.current?.srcObject || null;
          const track = streamRef.current?.getVideoTracks?.()[0];
          const capabilities = track?.getCapabilities?.();
          setTorchSupported(!!capabilities?.torch);
          devLog(`camera started using [${attempt.label}] — track:`, track?.label, 'capabilities:', capabilities);
          return; // success — stop trying further constraint attempts
        } catch (err) {
          lastError = err;
          devError(`constraints [${attempt.label}] failed:`, err?.name, err?.message);
          // A denial should stop the cascade immediately — retrying with
          // looser constraints won't change the user's answer.
          if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError') {
            break;
          }
          // Otherwise (OverconstrainedError, NotFoundError, NotReadableError,
          // AbortError, ...) fall through and try the next, looser constraint set.
        }
      }

      if (cancelled) return;
      devError('all camera constraint attempts failed. Last error:', lastError?.name, lastError?.message, lastError);
      const name = lastError?.name;
      setStatus(
        name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
          ? 'denied'
          : 'unavailable'
      );
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, onDetected, stop, retryToken]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || !torchSupported) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (err) {
      // Some devices report torch as supported but reject the constraint
      // anyway — fail silently rather than surface a confusing error for
      // what's meant to be a nice-to-have.
      devError('toggleTorch failed', err);
    }
  }, [torchOn, torchSupported]);

return { videoRef, status, torchOn, torchSupported, toggleTorch, retry };}
````

## File: src/hooks/useDailySession.js
````javascript
import { useEffect, useState, useCallback } from 'react';
import { doc, setDoc, updateDoc, deleteField, serverTimestamp, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { todayKey } from '../utils/dateRanges';

export function useDailySession() {
  const { businessId } = useAuth();
  const [session, setSession] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  const sessionId = businessId ? `${businessId}_${todayKey()}` : null;

  useEffect(() => {
    if (!sessionId) { setSession(null); setLoading(false); return; }
    const ref = doc(db, 'dailySessions', sessionId);
    const unsub = onSnapshot(ref,
      snap => { setSession(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, [sessionId]);

  const isClosed = !!(session?.closedAt);

  const openSession = useCallback(async ({ openingCashFloat, openingMpesaFloat, openedBy }) => {
    if (!sessionId || !businessId) return;
    const ref = doc(db, 'dailySessions', sessionId);
    await setDoc(ref, {
      businessId,
      date: todayKey(),
      openingCashFloat:  Number(openingCashFloat)  || 0,
      openingMpesaFloat: Number(openingMpesaFloat) || 0,
      openedBy, openedAt: serverTimestamp(),
      closedAt: null, closedBy: null,
    }, { merge: true });
    // FIX: don't rely solely on onSnapshot to reflect a write we just
    // made ourselves. If the realtime listener's connection is briefly
    // disrupted (ad blockers / some proxies interfere with Firestore's
    // long-polling channel — see firebase.js), the "Open counter" screen
    // could stay up even though the session doc already exists in
    // Firestore. Read it back directly and update the screen now; the
    // listener will simply confirm the same data whenever it catches up.
    try {
      const fresh = await getDoc(ref);
      if (fresh.exists()) setSession({ id: fresh.id, ...fresh.data() });
    } catch {
      // Non-fatal — the listener will still update the UI once it
      // reconnects.
    }
  }, [sessionId, businessId]);

  const reopenSession = useCallback(async () => {
    if (!isClosed || !sessionId) return;
    const ref = doc(db, 'dailySessions', sessionId);
    await updateDoc(ref, {
      closedAt: deleteField(), closedBy: deleteField(),
    });
    try {
      const fresh = await getDoc(ref);
      if (fresh.exists()) setSession({ id: fresh.id, ...fresh.data() });
    } catch {
      // Non-fatal — see note above.
    }
  }, [isClosed, sessionId]);

  return { session, loading, sessionId, isClosed, openSession, reopenSession };
}
````

## File: src/hooks/useFinancials.js
````javascript
import { useEffect, useRef, useState } from 'react';
import { where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { computeFinancials } from '../utils/financials';

// MULTI-TENANT CHANGE: every query here used to read the WHOLE `sales`,
// `creditSales`, etc. collections (filtered only by date). On a
// multi-tenant project those collections hold every business's
// documents, so each query below now also filters on this business's
// `businessId` via tenantQuery() — the exact same date-range filtering
// as before, just additionally scoped. businessId comes from useAuth()
// internally so every existing caller (Dashboard.jsx, CloseDay.jsx,
// Reports.jsx) needs NO changes to how they call this hook.
export function useFinancialsForRange(start, end) {
  const { businessId } = useAuth();
  const [state, setState] = useState({
    loading: true, error: null,
    sales: [], creditSales: [], expenses: [], repayments: [], purchases: [], supplierPayments: [], refunds: [],
    summary: computeFinancials({}),
  });
  const dataRef = useRef({ sales: [], creditSales: [], allCreditSales: [], expenses: [], repayments: [], purchases: [], supplierPayments: [], refunds: [] });
  const rafRef  = useRef(null);

  useEffect(() => {
    if (!start || !end || !businessId) return;
    let mounted = true;

    const flush = () => {
      if (!mounted) return;
      const { sales, allCreditSales, expenses, repayments, purchases, supplierPayments, refunds } = dataRef.current;
      const startMs = typeof start?.toMillis === 'function' ? start.toMillis() : start.getTime();
      const endMs = typeof end?.toMillis === 'function' ? end.toMillis() : end.getTime();
      const rangeCreditSales = allCreditSales.filter((entry) => {
        const soldAt = entry?.soldAt?.toMillis?.() ?? entry?.soldAt?.toDate?.().getTime?.() ?? entry?.soldAt;
        return typeof soldAt === 'number' && soldAt >= startMs && soldAt <= endMs;
      });
      setState({
        loading: false, error: null,
        sales, creditSales: rangeCreditSales, expenses, repayments, purchases, supplierPayments, refunds,
        summary: computeFinancials({ sales, creditSales: rangeCreditSales, allCreditSales, expenses, debtRepayments: repayments, purchases, supplierPayments, refunds }),
      });
    };
    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(flush);
    };
    const onErr = err => mounted && setState(s => ({ ...s, loading: false, error: err.message }));

    const salesQ      = tenantQuery('sales', businessId, where('soldAt','>=',start), where('soldAt','<=',end), orderBy('soldAt','desc'));
    const creditQ     = tenantQuery('creditSales', businessId, orderBy('soldAt','desc'));
    const expensesQ   = tenantQuery('expenses', businessId, where('recordedAt','>=',start), where('recordedAt','<=',end), orderBy('recordedAt','desc'));
    const repaymentsQ = tenantQuery('repayments', businessId, where('paidAt','>=',start), where('paidAt','<=',end), orderBy('paidAt','desc'));
    const purchasesQ  = tenantQuery('purchases', businessId, where('purchasedAt','>=',start), where('purchasedAt','<=',end), orderBy('purchasedAt','desc'));
    const supplierPaymentsQ = tenantQuery('supplierPayments', businessId, where('paidAt','>=',start), where('paidAt','<=',end), orderBy('paidAt','desc'));
    const refundsQ = tenantQuery('refunds', businessId, where('refundedAt','>=',start), where('refundedAt','<=',end), orderBy('refundedAt','desc'));

    const u1 = onSnapshot(salesQ,      s => { dataRef.current.sales      = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u2 = onSnapshot(creditQ,     s => { dataRef.current.allCreditSales = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u3 = onSnapshot(expensesQ,   s => { dataRef.current.expenses   = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u4 = onSnapshot(repaymentsQ, s => { dataRef.current.repayments = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u5 = onSnapshot(purchasesQ,  s => { dataRef.current.purchases  = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u6 = onSnapshot(supplierPaymentsQ, s => { dataRef.current.supplierPayments = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u7 = onSnapshot(refundsQ, s => { dataRef.current.refunds = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);

    return () => { mounted=false; u1(); u2(); u3(); u4(); u5(); u6(); u7(); if(rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [start, end, businessId]);

  return state;
}
````

## File: src/hooks/useFirestoreCollection.js
````javascript
import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
export function useFirestoreCollection(queryRef) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  useEffect(() => {
    if (!queryRef) { setData([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(queryRef,
      snap => { setData(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); setError(null); },
      err  => { setError(err.message); setLoading(false); }
    );
    return unsub;
  }, [queryRef]);
  return { data, loading, error };
}
````

## File: src/hooks/useHardwareScanner.js
````javascript
// src/hooks/useHardwareScanner.js
import { useEffect, useRef } from 'react';

// USB/Bluetooth barcode scanners behave like a keyboard: they "type" the
// barcode's characters very fast (each keystroke well under 40ms apart)
// and then send Enter. Human typing is much slower per keystroke — that
// timing gap is what tells a scan apart from someone typing in a text
// field, without needing any special driver or pairing step, since the
// OS just sees a generic keyboard either way.
//
// Known limitation: a person typing a short word very fast right before
// hitting Enter could theoretically be misread as a scan. In practice
// this is rare enough not to matter for a POS used by real staff — but
// worth knowing about if you ever see an unexpected scan trigger.
export function useHardwareScanner(onScan, { enabled = true, maxIntervalMs = 40, minLength = 4 } = {}) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= minLength) {
          onScan(code);
        }
        return;
      }

      if (e.key.length !== 1) return; // ignore Shift, Tab, arrow keys, etc.

      // A gap longer than maxIntervalMs means this keystroke isn't part
      // of a fast scanner burst — start the buffer over.
      if (elapsed > maxIntervalMs) {
        bufferRef.current = '';
      }
      bufferRef.current += e.key;
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onScan, maxIntervalMs, minLength]);
}
````

## File: src/hooks/useOnlineStatus.js
````javascript
import { useEffect, useState } from 'react';
export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}
````

## File: src/hooks/useSettings.js
````javascript
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_CATEGORIES = ['Groceries', 'Beverages', 'Hardware', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other'];
const DEFAULTS = { 
  shopName: 'FlowBiz', 
  cashierCanRecordExpenses: true, 
  categories: DEFAULT_CATEGORIES,
  phone: '',
  email: '',
  address: '',
  logoUrl: ''
};

export function useSettings() {
  const { businessId } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading]   = useState(true);

useEffect(() => {
    if (!businessId) { setSettings(DEFAULTS); setLoading(false); return; }
    const unsub = onSnapshot(
      doc(db, 'businessSettings', businessId),
      // BUG FIX (Issue 19): businessId was never included in the returned
      // settings object, so documentService.js's sendWhatsAppDocument was
      // always sending businessId: undefined to the server.
      snap => { setSettings(snap.exists() ? { ...DEFAULTS, ...snap.data(), businessId } : { ...DEFAULTS, businessId }); setLoading(false); },
      () => { setSettings({ ...DEFAULTS, businessId }); setLoading(false); }
    );
    return unsub;
  }, [businessId]);

  return { settings, loading };
}
````

## File: src/hooks/useSetupStatus.js
````javascript
import { useEffect, useState } from "react";
import {
  doc,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";

export function useSetupStatus() {

  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {

    const unsubscribe = onSnapshot(
      doc(db, "meta", "setup"),
      (snap) => {
        setSetupComplete(snap.exists());
        setLoading(false);
      },
      () => {
        setSetupComplete(false);
        setLoading(false);
      }
    );

    return unsubscribe;

  }, []);

  return {
    loading,
    setupComplete
  };

}
````

## File: src/lib/tenant.js
````javascript
// src/lib/tenant.js
//
// Multi-tenant helper. Every "business data" collection (sales, products,
// expenses, ...) stores a `businessId` field on every document, and every
// query MUST filter on it — otherwise you'd be reading every business's
// data mixed together in one list. These two helpers make that mistake
// hard to make: you cannot build a query or a write payload without
// passing a businessId in.
import { collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';

// Use this instead of `query(collection(db, name), ...)` for ANY
// collection that holds business-owned data.
export function tenantQuery(collectionName, businessId, ...constraints) {
  if (!businessId) {
    throw new Error(`tenantQuery('${collectionName}') called with no businessId — is the profile loaded yet?`);
  }
  return query(collection(db, collectionName), where('businessId', '==', businessId), ...constraints);
}

// Use this instead of `collection(db, name)` when you need the raw
// CollectionReference (e.g. to pass to addDoc/doc()).
export function tenantCollection(collectionName) {
  return collection(db, collectionName);
}

// Stamps businessId onto data you're about to write with addDoc/setDoc.
export function withBusiness(data, businessId) {
  if (!businessId) throw new Error('withBusiness() called with no businessId');
  return { ...data, businessId };
}
````

## File: src/pages/AdvancedAnalytics.jsx
````javascript
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useFinancialsForRange } from '../hooks/useFinancials';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { tenantQuery } from '../lib/tenant';
import { startOfDay, endOfDay, buildDateBuckets, toMillisValue } from '../utils/dateRanges';
import { formatKES } from '../utils/currency';
import { computeFinancials } from '../utils/financials';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MiniLineChart from '../components/charts/MiniLineChart';
import MiniBarChart from '../components/charts/MiniBarChart';
import DonutChart from '../components/charts/DonutChart';

const PERIOD_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

function KpiCard({ label, value, tone = 'text-ink-900', deltaPct }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${tone}`}>{value}</p>
      {deltaPct !== null && deltaPct !== undefined && Number.isFinite(deltaPct) && (
        <p className={`mt-1 text-xs font-semibold ${deltaPct >= 0 ? 'text-moss-700' : 'text-rust-600'}`}>
          {deltaPct >= 0 ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}% vs previous period
        </p>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="card p-4 sm:p-5">
      <h2 className="font-display text-sm font-bold text-ink-800">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function NoData({ children }) {
  return <p className="py-6 text-center text-sm text-ink-400">{children}</p>;
}

export default function AdvancedAnalytics() {
  const { isPro, businessId } = useAuth();
  const [periodDays, setPeriodDays] = useState(30);

  const range = useMemo(() => {
    const end = endOfDay();
    const start = startOfDay(new Date(Date.now() - (periodDays - 1) * 86400000));
    return { start, end };
  }, [periodDays]);

  const prevRange = useMemo(() => {
    const prevEnd = endOfDay(new Date(range.start.getTime() - 1));
    const prevStart = startOfDay(new Date(range.start.getTime() - periodDays * 86400000));
    return { start: prevStart, end: prevEnd };
  }, [range, periodDays]);

  const { loading, sales, creditSales, expenses, repayments, summary } = useFinancialsForRange(range.start, range.end);
  const { loading: prevLoading, summary: prevSummary } = useFinancialsForRange(prevRange.start, prevRange.end);

  const allCreditSalesQ = useMemo(() => (businessId ? tenantQuery('creditSales', businessId) : null), [businessId]);
  const { data: allCreditSales } = useFirestoreCollection(allCreditSalesQ);

  const outstandingCreditQ = useMemo(
    () => (businessId ? tenantQuery('creditSales', businessId, where('status', 'in', ['pending', 'partial'])) : null),
    [businessId]
  );
  const { data: outstandingCreditSales } = useFirestoreCollection(outstandingCreditQ);
  const totalOutstanding = useMemo(
    () => outstandingCreditSales.reduce((acc, cs) => acc + (Number(cs.remainingBalance) || 0), 0),
    [outstandingCreditSales]
  );

  const granularity = periodDays > 45 ? 'week' : 'day';
  const buckets = useMemo(() => buildDateBuckets(range.start, range.end, granularity), [range, granularity]);

  const trend = useMemo(() => {
    if (!buckets.length) return [];
    const inBucket = (record, field, bucket) => {
      const t = toMillisValue(record[field]);
      return t !== null && t >= bucket.start.getTime() && t <= bucket.end.getTime();
    };
    return buckets.map((bucket) => {
      const bucketSales = (sales || []).filter((s) => inBucket(s, 'soldAt', bucket));
      const bucketExpenses = (expenses || []).filter((e) => inBucket(e, 'recordedAt', bucket));
      const bucketRepayments = (repayments || []).filter((r) => inBucket(r, 'paidAt', bucket));
      const f = computeFinancials({
        sales: bucketSales,
        creditSales: [],
        allCreditSales,
        expenses: bucketExpenses,
        debtRepayments: bucketRepayments,
      });
      return { label: bucket.label, revenue: f.revenue, netProfit: f.netProfit };
    });
  }, [buckets, sales, expenses, repayments, allCreditSales]);

  // FIX: Properly map credit sales into the active product volume calculation
  const productPerf = useMemo(() => {
    const map = {};
    (sales || []).forEach((s) => {
      if (s.isVoided) return;
      if (!map[s.productName]) map[s.productName] = { name: s.productName, qty: 0, revenue: 0, profit: 0 };
      map[s.productName].qty += Number(s.quantity) || 0;
      map[s.productName].revenue += Number(s.totalAmount) || 0;
      map[s.productName].profit += Number(s.profit) || 0;
    });
    (creditSales || []).forEach((cs) => {
      if (cs.status === 'cancelled' || cs.status === 'refunded') return;
      if (!map[cs.productName]) map[cs.productName] = { name: cs.productName, qty: 0, revenue: 0, profit: 0 };
      map[cs.productName].qty += Number(cs.quantity) || 0;
    });
    return Object.values(map);
  }, [sales, creditSales]);

  const bestSelling = useMemo(() => [...productPerf].sort((a, b) => b.qty - a.qty).slice(0, 5), [productPerf]);
  const mostProfitable = useMemo(() => [...productPerf].sort((a, b) => b.profit - a.profit).slice(0, 5), [productPerf]);

  const staffPerformance = useMemo(() => {
    const m = {};
    (sales || []).forEach((s) => {
      if (s.isVoided) return;
      if (!s.soldByName) return;
      if (!m[s.soldByName]) m[s.soldByName] = { name: s.soldByName, qty: 0, revenue: 0 };
      m[s.soldByName].qty += Number(s.quantity) || 0;
      m[s.soldByName].revenue += Number(s.totalAmount) || 0;
    });
    return Object.values(m).sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  const revenueChangePct = !prevLoading && prevSummary.revenue > 0 ? ((summary.revenue - prevSummary.revenue) / prevSummary.revenue) * 100 : null;
  const profitChangePct = !prevLoading && prevSummary.netProfit !== 0 ? ((summary.netProfit - prevSummary.netProfit) / Math.abs(prevSummary.netProfit)) * 100 : null;

  const insights = useMemo(() => {
    const list = [];
    if (revenueChangePct !== null) {
      list.push({ tone: revenueChangePct >= 0 ? 'positive' : 'negative', text: `Revenue is ${revenueChangePct >= 0 ? 'up' : 'down'} ${Math.abs(revenueChangePct).toFixed(1)}% compared to the previous ${periodDays}-day period.` });
    }
    if (profitChangePct !== null) {
      list.push({ tone: profitChangePct >= 0 ? 'positive' : 'negative', text: `Net profit is ${profitChangePct >= 0 ? 'up' : 'down'} ${Math.abs(profitChangePct).toFixed(1)}% compared to the previous period.` });
    }
    if (mostProfitable[0]) {
      list.push({ tone: 'neutral', text: `"${mostProfitable[0].name}" generated the most gross profit this period (${formatKES(mostProfitable[0].profit)}).` });
    }
    const salesActivity = summary.revenue + summary.totalCreditSales;
    if (salesActivity > 0 && summary.totalCreditSales > 0) {
      const pct = (summary.totalCreditSales / salesActivity) * 100;
      list.push({ tone: pct > 30 ? 'negative' : 'neutral', text: `Credit sales made up ${pct.toFixed(0)}% of this period's sales activity.` });
    }
    if (totalOutstanding > 0) {
      list.push({ tone: 'neutral', text: `${formatKES(totalOutstanding)} is currently outstanding across all customers on credit.` });
    }
    return list;
  }, [revenueChangePct, profitChangePct, mostProfitable, summary, totalOutstanding, periodDays]);

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
        <div className="h-16 w-16 bg-ink-100 text-ink-400 rounded-full flex items-center justify-center mb-4 font-bold text-2xl">?</div>
        <h2 className="font-display text-xl font-bold text-ink-900">FlowBiz Pro Required</h2>
        <p className="mt-2 text-sm text-ink-500">Advanced Analytics gives you deep insights into sales patterns, staff performance, and profit margins. Upgrade to Pro to unlock.</p>
        <Link to="/pro" className="mt-6 btn-primary w-full">Explore Pro</Link>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  const margin = summary.revenue > 0 ? (summary.grossProfit / summary.revenue) * 100 : 0;
  const avgTransactionValue = sales.length > 0 ? summary.revenue / sales.length : 0;
  const hasSalesData = sales.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Advanced Analytics</h1>
          <p className="text-sm text-ink-400">Business health for the selected period</p>
        </div>
        <Link to="/reports" className="btn-outline text-xs">Back to Reports</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setPeriodDays(opt.days)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${periodDays === opt.days ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Revenue" value={formatKES(summary.revenue)} deltaPct={revenueChangePct} />
        <KpiCard label="Gross Profit" value={formatKES(summary.grossProfit)} tone="text-moss-700" />
        <KpiCard label="Net Profit" value={formatKES(summary.netProfit)} tone="text-moss-700" deltaPct={profitChangePct} />
        <KpiCard label="Profit Margin" value={`${margin.toFixed(1)}%`} />
        <KpiCard label="Expenses" value={formatKES(summary.totalExpenses)} tone="text-rust-600" />
        <KpiCard label="Avg Transaction Value" value={hasSalesData ? formatKES(avgTransactionValue) : 'KES 0'} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Sales Trend" subtitle="Recognized revenue per period">
          {hasSalesData ? (
            <MiniLineChart data={trend.map((t) => ({ label: t.label, value: t.revenue }))} formatValue={formatKES} ariaLabel="Sales trend" />
          ) : (
            <NoData>Not enough sales data yet. Continue recording sales to see this trend.</NoData>
          )}
        </Section>
        <Section title="Profit Trend" subtitle="Net profit per period">
          {hasSalesData ? (
            <MiniBarChart data={trend.map((t) => ({ label: t.label, value: t.netProfit }))} orientation="vertical" formatValue={formatKES} ariaLabel="Profit trend" />
          ) : (
            <NoData>Not enough data yet to chart profit over time.</NoData>
          )}
        </Section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Payment Method Breakdown">
          {summary.totalCashSales + summary.totalMpesaSales + summary.totalCreditSales > 0 ? (
            <DonutChart
              formatValue={formatKES}
              segments={[
                { label: 'Cash', value: summary.totalCashSales, colorClassName: 'text-blue-600', dotClassName: 'bg-blue-600' },
                { label: 'M-Pesa', value: summary.totalMpesaSales, colorClassName: 'text-ink-500', dotClassName: 'bg-ink-500' },
                { label: 'Credit', value: summary.totalCreditSales, colorClassName: 'text-rust-400', dotClassName: 'bg-rust-400' },
              ]}
            />
          ) : (
            <NoData>No sales recorded in this period yet.</NoData>
          )}
        </Section>
        <Section title="Credit Intelligence" subtitle="How much money is tied up in credit">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">Credit issued this period</span>
              <span className="font-semibold text-ink-800">{formatKES(summary.totalCreditSales)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">Repayments collected this period</span>
              <span className="font-semibold text-moss-700">{formatKES(summary.totalDebtRepayments)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
              <span className="font-semibold text-ink-700">Outstanding across all customers</span>
              <span className="font-bold text-rust-600">{formatKES(totalOutstanding)}</span>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Best-Selling Products" subtitle="By quantity sold">
          {bestSelling.length > 0 ? (
            <MiniBarChart orientation="horizontal" formatValue={(v) => `${v} sold`} data={bestSelling.map((p) => ({ label: p.name, value: p.qty }))} />
          ) : (
            <NoData>No product sales in this period yet.</NoData>
          )}
        </Section>
        <Section title="Most Profitable Products" subtitle="By gross profit">
          {mostProfitable.length > 0 ? (
            <MiniBarChart orientation="horizontal" formatValue={formatKES} data={mostProfitable.map((p) => ({ label: p.name, value: p.profit, colorClassName: 'bg-moss-600' }))} />
          ) : (
            <NoData>No product sales in this period yet.</NoData>
          )}
        </Section>
      </div>

      <Section title="Business Insights" subtitle="What's changed and what deserves attention">
        {insights.length > 0 ? (
          <ul className="space-y-2.5">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    insight.tone === 'positive' ? 'bg-moss-600' : insight.tone === 'negative' ? 'bg-rust-500' : 'bg-blue-500'
                  }`}
                />
                <span className="text-ink-700">{insight.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <NoData>Insights will appear here once there's enough activity to compare against the previous period.</NoData>
        )}
      </Section>

      <Section title="Staff Sales Performance">
        {staffPerformance.length === 0 ? (
          <NoData>No staff sales data for this period.</NoData>
        ) : (
          <div className="divide-y divide-ink-100">
            {staffPerformance.map((st) => (
              <div key={st.name} className="flex justify-between py-2.5 text-sm">
                <span className="font-semibold text-ink-800">{st.name}</span>
                <span className="text-ink-600">{formatKES(st.revenue)} ({st.qty} items)</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
````

## File: src/pages/CloseDay.jsx
````javascript
// HP-7 FIX: chunk deletions to avoid 500-op batch limit; replace window.location.reload() with React state
import { useMemo, useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDailySession } from '../hooks/useDailySession';
import { useFinancialsForRange } from '../hooks/useFinancials';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner';
import { formatKES } from '../utils/currency';
import { startOfDay, endOfDay } from '../utils/dateRanges';
import { computeExpectedTillBalances } from '../utils/financials';

export default function CloseDay() {
  const { profile } = useAuth();
  const { session, loading:sessLoad, sessionId, isClosed, reopenSession } = useDailySession();
  const today = useMemo(() => ({ start:startOfDay(), end:endOfDay() }), []);
  const { loading:finLoad, error:finErr, summary } = useFinancialsForRange(today.start, today.end);
  const [cash,      setCash]      = useState('');
  const [mpesa,     setMpesa]     = useState('');
  const [submitting,setSubmit]    = useState(false);

  if (sessLoad || finLoad) return <LoadingSpinner />;
  if (!session) return <EmptyState title="No session open today" description="The counter hasn't been opened yet today." />;

  const { expectedCashAtClose, expectedMpesaAtClose } = computeExpectedTillBalances({
    openingCashFloat:         session.openingCashFloat,
    openingMpesaFloat:        session.openingMpesaFloat,
    totalCashSales:           summary.totalCashSales,
    totalMpesaSales:          summary.totalMpesaSales,
    totalDebtRepaymentsCash:  summary.totalDebtRepaymentsCash,
    totalDebtRepaymentsMpesa: summary.totalDebtRepaymentsMpesa,
    totalExpensesCash:        summary.totalExpensesCash,
    totalExpensesMpesa:       summary.totalExpensesMpesa,
    totalCashOutflows:        summary.totalCashOutflows,
    totalMpesaOutflows:       summary.totalMpesaOutflows,
  });

  const cashVar  = (Number(cash) ||0) - expectedCashAtClose;
  const mpesaVar = (Number(mpesa)||0) - expectedMpesaAtClose;

  const handleClose = async () => {
    setSubmit(true);
    try {
      await updateDoc(doc(db,'dailySessions',sessionId), {
        totalCashSales:           summary.totalCashSales,
        totalMpesaSales:          summary.totalMpesaSales,
        totalCreditSales:         summary.totalCreditSales,
        totalDebtRepaymentsCash:  summary.totalDebtRepaymentsCash,
        totalDebtRepaymentsMpesa: summary.totalDebtRepaymentsMpesa,
        totalExpensesCash:        summary.totalExpensesCash,
        totalExpensesMpesa:       summary.totalExpensesMpesa,
        totalRefundsCash:         summary.totalRefundsCash,
        totalRefundsMpesa:        summary.totalRefundsMpesa,
        expectedCashAtClose, actualCashAtClose:Number(cash)||0,
        expectedMpesaAtClose, actualMpesaAtClose:Number(mpesa)||0,
        cashVariance:cashVar, mpesaVariance:mpesaVar,
        closedAt:serverTimestamp(), closedBy:profile.uid,
      });
      toast.success('Day closed. See you tomorrow!');
    } catch(err) { toast.error(friendlyErrorMessage(err)); } finally { setSubmit(false); }
  };

  if (isClosed) return (
    <div className="mx-auto max-w-2xl space-y-4">
      <EmptyState title="Today's session is closed" description="Counting resumes when the counter opens tomorrow." />
      <div className="card divide-y divide-ink-100">
        <SRow label="Expected cash"   value={expectedCashAtClose} />
        <SRow label="Actual cash"     value={session.actualCashAtClose||0} />
        <SRow label="Cash variance"   value={(session.actualCashAtClose||0)-expectedCashAtClose} variance />
        <SRow label="Expected M-Pesa" value={expectedMpesaAtClose} />
        <SRow label="Actual M-Pesa"   value={session.actualMpesaAtClose||0} />
        <SRow label="M-Pesa variance" value={(session.actualMpesaAtClose||0)-expectedMpesaAtClose} variance />
      </div>
      <button className="btn-primary w-full" onClick={reopenSession}>Reopen session</button>
    </div>
  );

  if (finErr) return <ErrorBanner message={`Failed to load figures: ${finErr}`} />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Close Day</h1>
      <div className="card divide-y divide-ink-100">
        <div className="px-4 py-3 text-sm font-bold text-ink-800">Cash drawer</div>
        <Row label="Opening float"             value={session.openingCashFloat} />
        <Row label="+ Cash sales"              value={summary.totalCashSales} />
        <Row label="+ Debt repayments (cash)"  value={summary.totalDebtRepaymentsCash} />
        <Row label="− Expenses (cash)"         value={-summary.totalExpensesCash} />
        <Row label="− Refunds (cash)"          value={-summary.totalRefundsCash} />
        <Row label="= Expected cash"           value={expectedCashAtClose} bold />
      </div>
      <div className="card p-4 space-y-2">
        <label className="label">Actual cash counted (KES)</label>
        <input type="number" className="input" value={cash} onChange={e=>setCash(e.target.value)} placeholder="0" />
        {cash!==''&&<Variance v={cashVar} />}
      </div>
      <div className="card divide-y divide-ink-100">
        <div className="px-4 py-3 text-sm font-bold text-ink-800">M-Pesa till</div>
        <Row label="Opening balance"             value={session.openingMpesaFloat} />
        <Row label="+ M-Pesa sales"              value={summary.totalMpesaSales} />
        <Row label="+ Debt repayments (M-Pesa)"  value={summary.totalDebtRepaymentsMpesa} />
        <Row label="− Expenses (M-Pesa)"         value={-summary.totalExpensesMpesa} />
        <Row label="− Refunds (M-Pesa)"          value={-summary.totalRefundsMpesa} />
        <Row label="= Expected M-Pesa"           value={expectedMpesaAtClose} bold />
      </div>
      <div className="card p-4 space-y-2">
        <label className="label">Actual M-Pesa balance (KES)</label>
        <input type="number" className="input" value={mpesa} onChange={e=>setMpesa(e.target.value)} placeholder="0" />
        {mpesa!==''&&<Variance v={mpesaVar} />}
      </div>
      <button className="btn-primary w-full" disabled={cash===''||mpesa===''||submitting} onClick={handleClose}>{submitting?'Closing…':'Confirm and close day'}</button>
    </div>
  );
}

function Row({ label, value, bold }) {
  return <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${bold?'bg-ink-50/60':''}`}><span className={bold?'font-bold text-ink-900':'text-ink-500'}>{label}</span><span className={bold?'font-bold text-ink-900':'text-ink-700'}>{formatKES(value)}</span></div>;
}
function SRow({ label, value, variance }) {
  const tone = variance ? (value===0?'text-moss-700':value<0?'text-rust-600':'text-amber-600') : 'text-ink-700';
  return <div className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="text-ink-500">{label}</span><span className={`font-semibold ${tone}`}>{formatKES(value)}</span></div>;
}
function Variance({ v }) {
  const tone = v===0?'text-moss-700':v<0?'text-rust-600':'text-amber-600';
  return <p className={`text-sm font-semibold ${tone}`}>{v===0?'✓ Matches exactly':v<0?`Shortage of ${formatKES(Math.abs(v))}`:`Surplus of ${formatKES(v)}`}</p>;
}
````

## File: src/pages/CustomerDetail.jsx
````javascript
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { where, orderBy, doc, writeBatch, increment, getDoc, serverTimestamp, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Receipt, Banknote, Smartphone, Undo2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import RepaymentModal from '../components/debtors/RepaymentModal';
import RefundModal from '../components/debtors/RefundModal';
import { formatKES } from '../utils/currency';
import { formatDateTime } from '../utils/dateRanges';

export default function CustomerDetail() {
  const { customerId } = useParams();
  const { profile, isAdmin, businessId } = useAuth();

  const customerQ   = useMemo(() => businessId ? tenantQuery('customers', businessId, where('__name__','==',customerId)) : null, [customerId, businessId]);
  const creditQ     = useMemo(() => businessId ? tenantQuery('creditSales', businessId, where('customerId','==',customerId)) : null, [customerId, businessId]);
  const repaymentsQ = useMemo(() => businessId ? tenantQuery('repayments', businessId, where('customerId','==',customerId), orderBy('paidAt','desc')) : null, [customerId, businessId]);

  const { data: customerData, loading: custLoad } = useFirestoreCollection(customerQ);
  const { data: creditSales, loading: credLoad, error } = useFirestoreCollection(creditQ);
  const { data: repayments } = useFirestoreCollection(repaymentsQ);
  
  const [repayOpen, setRepayOpen]       = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);

  const customer = customerData[0];
  const sorted = [...creditSales].sort((a,b) => (b.soldAt?.toMillis?.() ?? 0) - (a.soldAt?.toMillis?.() ?? 0));
  const totalOwed = creditSales
    .filter(cs => cs.status !== 'cancelled' && cs.status !== 'refunded')
    .reduce((acc,cs) => acc + (Number(cs.remainingBalance) || 0), 0);

  const handleRepayment = async ({ amount, method, mpesaCode }) => {
    const openSales = [...creditSales]
      .filter(cs => cs.status !== 'cancelled' && cs.status !== 'refunded' && (Number(cs.remainingBalance) || 0) > 0.005)
      .sort((a,b) => (a.soldAt?.toMillis?.() ?? 0) - (b.soldAt?.toMillis?.() ?? 0));

    if (!openSales.length) { toast.error('No outstanding balance.'); return; }
    try {
      const batch = writeBatch(db);
      let remaining = amount;
      for (const cs of openSales) {
        if (remaining <= 0.005) break;
        const owed    = Number(cs.remainingBalance) || 0;
        const portion = Math.min(owed, remaining);
        remaining    -= portion;
        const newPaid = (Number(cs.amountPaid) || 0) + portion;
        const newBal  = owed - portion;
        batch.update(doc(db,'creditSales',cs.id), { amountPaid: newPaid, remainingBalance: newBal, status: newBal <= 0.005 ? 'paid' : 'partial' });
        const repRef = doc(collection(db,'repayments'));
        batch.set(repRef, {
          businessId,
          creditSaleId: cs.id,
          customerId: cs.customerId,
          customerName: cs.customerName,
          productName: cs.productName,
          amount: portion,
          method,
          mpesaCode: mpesaCode || null,
          paidAt: serverTimestamp(),
          recordedBy: profile.uid,
          recordedByName: profile.displayName,
        });
      }
      await batch.commit();
      toast.success(`Recorded ${formatKES(amount)} repayment`);
    } catch (err) { toast.error(friendlyErrorMessage(err)); throw err; }
  };

  const handleCancel = async (cs) => {
    setCancelTarget(null);
    try {
      const batch = writeBatch(db);
      const prodRef = doc(db,'products',cs.productId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        batch.update(prodRef, { stock: increment(cs.quantity), updatedAt: serverTimestamp() });
      }
      batch.update(doc(db,'creditSales',cs.id), {
        status: 'cancelled', remainingBalance: 0,
        cancelledAt: serverTimestamp(), cancelledBy: profile.uid,
      });
      await batch.commit();
      toast.success('Credit sale cancelled and stock restored.');
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
  };

  const handleRefund = async (cs, { method }) => {
    try {
      const batch = writeBatch(db);
      const prodRef = doc(db,'products',cs.productId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        batch.update(prodRef, { stock: increment(cs.quantity), updatedAt: serverTimestamp() });
      }
      batch.update(doc(db,'creditSales',cs.id), {
        status: 'refunded', remainingBalance: 0,
        refundedAt: serverTimestamp(), refundedBy: profile.uid,
      });
      const refundRef = doc(collection(db,'refunds'));
      batch.set(refundRef, {
        businessId,
        creditSaleId: cs.id, customerId: cs.customerId, customerName: cs.customerName,
        productName: cs.productName, amount: Number(cs.amountPaid) || 0, method,
        refundedAt: serverTimestamp(), refundedBy: profile.uid, refundedByName: profile.displayName,
      });
      await batch.commit();
      toast.success('Sale refunded and stock restored.');
      setRefundTarget(null);
    } catch (err) { toast.error(friendlyErrorMessage(err)); throw err; }
  };

  if (custLoad || credLoad) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={`Could not load data. ${error}`} />;
  if (!customer && creditSales.length === 0) return <EmptyState title="Customer not found" />;

  const displayName = customer?.name || creditSales[0]?.customerName || 'Unknown Customer';
  const displayPhone = customer?.phone || creditSales[0]?.customerPhone || 'No phone';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/customers" className="text-sm font-semibold text-ink-400 hover:text-ink-700">← Back to Customers</Link>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">{displayName}</h1>
          <p className="text-sm text-ink-400">{displayPhone}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-400">Outstanding Debt</p>
          <p className={`font-display text-xl font-bold ${totalOwed > 0 ? 'text-rust-600' : 'text-moss-700'}`}>{formatKES(totalOwed)}</p>
        </div>
      </div>
      <button className="btn-primary w-full sm:w-auto" disabled={totalOwed <= 0} onClick={() => setRepayOpen(true)}>
        <Receipt className="h-4 w-4" strokeWidth={1.75}/> Record repayment
      </button>

      {sorted.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-ink-800">Credit purchases</h2>
          <div className="divide-y divide-ink-100">
            {sorted.map(cs => {
              const reversed = cs.status === 'cancelled' || cs.status === 'refunded';
              return (
                <div key={cs.id} className={`flex items-center justify-between gap-2 py-2.5 text-sm ${reversed ? 'opacity-50' : ''}`}>
                  <div>
                    <p className="font-medium text-ink-700">{cs.quantity} × {cs.productName}</p>
                    <p className="text-xs text-ink-400">{formatDateTime(cs.soldAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={`font-semibold ${reversed ? 'line-through text-ink-400' : 'text-ink-800'}`}>{formatKES(cs.totalAmount)}</p>
                      <span className={`badge ${cs.status === 'paid' ? 'bg-moss-100 text-moss-700' : cs.status === 'partial' ? 'bg-rust-100 text-rust-700' : 'bg-ink-100 text-ink-500'}`}>{cs.status}</span>
                    </div>
                    {isAdmin && !reversed && (
                      <button
                        className="rounded-lg p-2 text-ink-400 hover:bg-ink-100"
                        title={Number(cs.amountPaid) > 0.005 ? 'Refund this sale' : 'Cancel this sale'}
                        onClick={() => (Number(cs.amountPaid) > 0.005 ? setRefundTarget(cs) : setCancelTarget(cs))}
                      >
                        <Undo2 className="h-4 w-4" strokeWidth={1.75}/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {repayments.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-ink-800">Repayment history</h2>
          <div className="divide-y divide-ink-100">
            {repayments.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink-700">{r.method === 'Cash' ? <><Banknote className="inline h-4 w-4 mr-1" strokeWidth={1.75}/>Cash</> : <><Smartphone className="inline h-4 w-4 mr-1" strokeWidth={1.75}/>M-Pesa {r.mpesaCode ? `(${r.mpesaCode})` : ''}</>}</p>
                  <p className="text-xs text-ink-400">{formatDateTime(r.paidAt)}</p>
                </div>
                <span className="font-semibold text-moss-700">{formatKES(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RepaymentModal open={repayOpen} customer={{ name: displayName }} totalOwed={totalOwed} onClose={() => setRepayOpen(false)} onSubmit={handleRepayment} />
      <RefundModal open={!!refundTarget} creditSale={refundTarget} onClose={() => setRefundTarget(null)} onSubmit={(opts) => handleRefund(refundTarget, opts)} />
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this credit sale?"
        message={`"${cancelTarget?.productName}" (×${cancelTarget?.quantity}) will be cancelled and stock restored. Nothing has been paid on this sale yet.`}
        confirmLabel="Cancel sale"
        danger
        onConfirm={() => handleCancel(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
````

## File: src/pages/Customers.jsx
````javascript
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { formatKES } from '../utils/currency';
import { formatDate } from '../utils/dateRanges';

export default function Customers() {
  const { businessId } = useAuth();
  
  const customersQ = useMemo(() => businessId ? tenantQuery('customers', businessId, orderBy('name')) : null, [businessId]);
  const creditQ = useMemo(() => businessId ? tenantQuery('creditSales', businessId) : null, [businessId]);

  const { data: customers, loading: custLoading } = useFirestoreCollection(customersQ);
  const { data: creditSales, loading: credLoading } = useFirestoreCollection(creditQ);
  
  const [search, setSearch] = useState('');

  const customerList = useMemo(() => {
    const map = {};
    for (const c of customers) {
      map[c.id] = { customerId: c.id, name: c.name, phone: c.phone, totalOwed: 0, purchaseCount: 0, lastPurchase: null };
    }
    for (const cs of creditSales) {
      if (!cs.customerId) continue;
      if (!map[cs.customerId]) {
        map[cs.customerId] = { customerId: cs.customerId, name: cs.customerName, phone: cs.customerPhone, totalOwed: 0, purchaseCount: 0, lastPurchase: null };
      }
      const e = map[cs.customerId];
      if (cs.status === 'pending' || cs.status === 'partial') {
        e.totalOwed += Number(cs.remainingBalance) || 0;
      }
      e.purchaseCount++;
      if (!e.lastPurchase || (cs.soldAt?.toMillis?.() ?? 0) > (e.lastPurchase?.toMillis?.() ?? 0)) {
        e.lastPurchase = cs.soldAt;
      }
    }
    return Object.values(map)
      .filter(d => d.name?.toLowerCase().includes(search.toLowerCase()) || d.phone?.includes(search))
      .sort((a, b) => b.totalOwed - a.totalOwed);
  }, [customers, creditSales, search]);

  const loading = custLoading || credLoading;
  const totalOut = customerList.reduce((acc, d) => acc + d.totalOwed, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-900">Customers</h1>
        <p className="text-sm text-ink-400">Total outstanding debt: <span className="font-semibold text-rust-600">{formatKES(totalOut)}</span></p>
      </div>
      <input className="input" placeholder="Search customer…" value={search} onChange={e => setSearch(e.target.value)} />
      {loading ? <LoadingSpinner /> : customerList.length === 0 ? <EmptyState title="No customers found" description="Customers will appear here when recorded." /> : (
        <div className="space-y-2">
          {customerList.map(d => (
            <Link key={d.customerId} to={`/customers/${d.customerId}`} className="card flex items-center justify-between p-4 hover:shadow-md">
              <div>
                <p className="font-semibold text-ink-800">{d.name}</p>
                <p className="text-xs text-ink-400">{d.phone || 'No phone'} · {d.purchaseCount} purchase{d.purchaseCount > 1 ? 's' : ''} {d.lastPurchase ? `· last ${formatDate(d.lastPurchase)}` : ''}</p>
              </div>
              <span className={`font-display text-base font-bold ${d.totalOwed > 0 ? 'text-rust-600' : 'text-moss-700'}`}>
                {d.totalOwed > 0 ? formatKES(d.totalOwed) : 'Paid'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
````

## File: src/pages/Expenses.jsx
````javascript
import { useMemo, useState } from 'react';
import { addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Banknote, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useSettings } from '../hooks/useSettings';
import { isExpenseExcluded } from '../utils/financials';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ExportCsvButton from '../components/common/ExportCsvButton';
import { EXPENSE_CATEGORIES } from '../constants/categories';
import { formatKES } from '../utils/currency';
import { formatDateTime, todayKey } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';
const emptyForm = { description:'', category:EXPENSE_CATEGORIES[0], amount:'', paymentMethod:'Cash', mpesaCode:'' };

export default function Expenses() {
  const { profile, isAdmin, businessId } = useAuth();
  const { settings, loading:sLoad } = useSettings();
  const expQ = useMemo(() => businessId ? tenantQuery('expenses', businessId, orderBy('recordedAt','desc'), limit(200)) : null, [businessId]);
  const { data: rawExpenses, loading } = useFirestoreCollection(expQ);
  // FIX: supplier-debt-payment entries are auto-written to `expenses` so
  // till reconciliation math works (see financials.js), but they aren't
  // real operating expenses — showing them here confused the actual
  // expense log. Filter them out with the exact same rule used to
  // exclude them from the Total Expenses figure.
  const expenses = useMemo(() => rawExpenses.filter((e) => !isExpenseExcluded(e)), [rawExpenses]);
  const [form, setForm]   = useState(emptyForm);
  const [busy, setBusy]   = useState(false);
  const set = f => e => setForm(p=>({...p,[f]:e.target.value}));

  if (sLoad) return <LoadingSpinner />;
  if (!isAdmin && !settings.cashierCanRecordExpenses) return <EmptyState title="Expense recording is owner-only" description="Ask your owner to enable cashier expenses in Settings." />;

const handle = async e => {
    e.preventDefault();
    if (!form.description.trim()||!form.amount) return;
    if (form.paymentMethod==='M-Pesa'&&!form.mpesaCode.trim()) { toast.error('Enter M-Pesa transaction code.'); return; }
    setBusy(true);
    const write = addDoc(tenantCollection('expenses'), withBusiness({
      description:form.description.trim(), category:form.category, amount:Number(form.amount),
      paymentMethod:form.paymentMethod, mpesaCode:form.paymentMethod==='M-Pesa'?form.mpesaCode.trim():null,
      recordedBy:profile.uid, recordedByName:profile.displayName, recordedAt:serverTimestamp(),
    }, businessId));

    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    setBusy(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(queuedOffline ? "Expense saved — it'll sync once you're back online." : 'Expense recorded');
    if (queuedOffline) write.catch((err) => toast.error(`An expense from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
    setForm(emptyForm);
  };

  const rows = expenses.map(e=>({ date:formatDateTime(e.recordedAt), description:e.description, category:e.category, amount:e.amount, paymentMethod:e.paymentMethod, mpesaCode:e.mpesaCode||'', recordedBy:e.recordedByName }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Expenses</h1>
      <form onSubmit={handle} className="card space-y-3 p-4">
        <h2 className="font-display text-sm font-bold text-ink-800">Record an expense</h2>
        <div><label className="label">Description</label><input className="input" value={form.description} onChange={set('description')} placeholder="e.g. Rent for July" required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Category</label><select className="input" value={form.category} onChange={set('category')}>{EXPENSE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Amount (KES)</label><input type="number" min="0.01" step="0.01" className="input" value={form.amount} onChange={set('amount')} required /></div>
        </div>
        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-2 gap-2">
            {['Cash','M-Pesa'].map(m=>(
              <button key={m} type="button" onClick={()=>setForm(p=>({...p,paymentMethod:m}))} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.paymentMethod===m?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>
                {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
              </button>
            ))}
          </div>
        </div>
        {form.paymentMethod==='M-Pesa'&&<div><label className="label">M-Pesa code <span className="text-rust-500">*</span></label><input className="input uppercase" value={form.mpesaCode} onChange={set('mpesaCode')} placeholder="QWE1234567" /></div>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy?'Saving…':'Record expense'}</button>
      </form>
      <div className="flex items-center justify-between"><h2 className="font-display text-sm font-bold text-ink-800">Recent expenses</h2><ExportCsvButton filename={`expenses-${todayKey()}.csv`} rows={rows} /></div>
      {loading?<LoadingSpinner />:expenses.length===0?<EmptyState title="No expenses yet" />:(
        <div className="card divide-y divide-ink-100">
          {expenses.map(e=>(
            <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
              <div><p className="font-medium text-ink-700">{e.description}</p><p className="text-xs text-ink-400">{e.category} · {formatDateTime(e.recordedAt)} · {e.recordedByName}</p></div>
              <div className="text-right"><p className="font-semibold text-rust-600">{formatKES(e.amount)}</p><p className="text-xs text-ink-400">{e.paymentMethod}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
````

## File: src/pages/HelpGuide.jsx
````javascript
import { useState } from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  {
    id: 'getting-started',
    title: '1. Getting Started',
    desc: 'The essential daily workflows: adding inventory, recording purchases, making sales, and logging daily expenses.',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          Welcome to FlowBiz! To run your shop efficiently every day, follow these five essential steps:
        </p>
        <div className="space-y-3">
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 1: Add Your Products</h4>
            <p className="text-sm text-ink-600 mt-1">
              Go to <strong className="text-ink-800">Products</strong> and tap <strong className="text-ink-800">+ Add product</strong>. Enter the product name, its buying price (cost), and selling price. If the item has a barcode, scan it using your device's camera or standard USB scanner.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 2: Record Purchases (Restocking)</h4>
            <p className="text-sm text-ink-600 mt-1">
              When a supplier delivers new stock, record it on the <strong className="text-ink-800">Purchases</strong> page. Select the supplier, pick the product, enter the quantity received, and specify if you paid them now or took the stock on credit. FlowBiz will automatically increase your stock levels.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 3: Record Sales (Counter)</h4>
            <p className="text-sm text-ink-600 mt-1">
              On the <strong className="text-ink-800">Counter</strong> page, tap any product card or scan its barcode to sell. Select whether the customer paid in Cash, via M-Pesa, or took it on credit (Deni). Tap confirm, and inventory levels will update in real-time.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 4: Record Expenses</h4>
            <p className="text-sm text-ink-600 mt-1">
              Keep a record of rent, electricity, transport, wages, or airtime float under <strong className="text-ink-800">Expenses</strong>. Logging every small expense ensures your end-of-day net profit calculations remain accurate.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 5: Record Debt Repayments</h4>
            <p className="text-sm text-ink-600 mt-1">
              When a debtor pays off what they owe, go to <strong className="text-ink-800">Debtors</strong>, click their name, and record the repayment amount (Cash or M-Pesa). Do not create a new sale; this updates their remaining balance and logs the cash received.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'understanding-dashboard',
    title: "2. Understanding the Dashboard",
    desc: "A brief guide to today's summary cards, tracking balances, and checking inventory health.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          The dashboard is your shop's cockpit, offering a real-time summary of today's events:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Cash Received Today</span>
            <p className="text-xs text-ink-600 mt-1">All the physical cash collected today from direct cash sales and debtor repayments combined.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">M-Pesa Received Today</span>
            <p className="text-xs text-ink-600 mt-1">All digital payments transferred to your till today from direct M-Pesa sales and debtor repayments.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Today's Net Profit</span>
            <p className="text-xs text-ink-600 mt-1">Today's realized gross profit minus today's recorded shop expenses. Shows exactly what you made in hand.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Today's Expenses</span>
            <p className="text-xs text-ink-600 mt-1">The sum of all shop operational expenses recorded today (excluding purchases made on credit).</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Inventory Value (Cost)</span>
            <p className="text-xs text-ink-600 mt-1">The total buying price of all items currently on your shelves. Helps you see exactly how much capital is tied up in stock.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Outstanding Debt (Deni)</span>
            <p className="text-xs text-ink-600 mt-1">The total amount of money your credit customers still owe you. Keep this number as close to zero as possible!</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'understanding-reports',
    title: '3. Understanding Reports',
    desc: 'How the reports compile and measure credit sales, margins, expenses, and profits over time.',
    content: (
      <div className="space-y-3 text-sm text-ink-600">
        <p>Reports allow you to view the shop's financial performance over preset periods (Today, This Week, This Month, or Custom dates):</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><strong>Gross Revenue:</strong> Represents actual money in your hand, direct cash/M-Pesa sales plus whatever portion of debtor repayments was collected in this period.</li>
          <li><strong>Cost of Goods Sold (COGS):</strong> The total wholesale cost of the items you sold during this period. For credit repayments, COGS is recognized proportionally.</li>
          <li><strong>Gross Profit:</strong> Gross Revenue minus Cost of Goods Sold. Tells you how much markup you earned on items sold.</li>
          <li><strong>Expenses:</strong> Rent, bills, wages, etc., logged during this period.</li>
          <li><strong>Net Profit:</strong> Gross Profit minus Expenses. The ultimate bottom-line earnings of your business during this reporting window.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'credit-sales',
    title: '4. How Credit Sales (Deni) Work',
    desc: 'The cash-flow-first model: why profit stays at zero until money is collected.',
    content: (
      <div className="space-y-4 text-sm text-ink-600">
        <p>
          Most standard software registers revenue the moment you sell an item, even if the customer leaves without empty pockets. This is called *accrual accounting*, but it can be confusing for everyday Kenyan businesses where cash flow is king.
        </p>
        <p>
          <strong>FlowBiz uses a cash-flow-first hybrid model</strong> designed specifically for Kenyan SMEs:
        </p>
        <div className="border-l-2 border-moss-600 pl-4 space-y-2 py-1 font-mono text-xs bg-moss-50/50 rounded-r">
          <div>Customer buys on credit (e.g., KES 15,000)</div>
          <div className="text-ink-400">↓</div>
          <div>Inventory decreases immediately (real-time stock health)</div>
          <div className="text-ink-400">↓</div>
          <div>Outstanding Debt (Deni) increases by KES 15,000</div>
          <div className="text-ink-400">↓</div>
          <div className="text-rust-600 font-semibold">Revenue and Profit remain at KES 0.00 (not collected yet)</div>
          <div className="text-ink-400">↓</div>
          <div>Customer pays KES 5,000 partial payment later</div>
          <div className="text-ink-400">↓</div>
          <div className="text-moss-700 font-semibold">KES 5,000 is recognized as Revenue</div>
          <div className="text-moss-700 font-semibold font-bold">COGS &amp; proportional profit are recognized at last!</div>
          <div className="text-ink-400">↓</div>
          <div>Outstanding Debt reduces to KES 10,000</div>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          This system ensures you only see, report, and spend profits that have actually entered your cash drawer or M-Pesa till.
        </p>
      </div>
    )
  },
  {
    id: 'cash-mpesa',
    title: '5. Cash, M-Pesa, & Close Day',
    desc: 'Reconciling floats, recording withdrawals, and closing today’s session correctly.',
    content: (
      <div className="space-y-3 text-sm text-ink-600">
        <p>
          Every morning, open the Counter by entering your starting balances (the <strong>Opening Float</strong>). This is the cash in your drawer and the float on your phone.
        </p>
        <p>
          During the day, every sale, expense, debtor repayment, and refund adjusts the "Expected" balances inside the system. 
        </p>
        <p>
          At closing time, visit the <strong>Close Day</strong> page:
        </p>
        <ol className="list-decimal pl-5 space-y-1.5 mt-2">
          <li>Count the physical cash in your drawer and type the amount into the input.</li>
          <li>Check your M-Pesa statement balance and type it.</li>
          <li>FlowBiz will instantly compare these to the "Expected" amounts and display a <strong>Shortage</strong> (rust) or <strong>Surplus</strong> (amber) if there's any variance.</li>
          <li>Press <strong>Confirm and Close Day</strong>. This locks the sales log and stores today's records.</li>
        </ol>
      </div>
    )
  },
  {
    id: 'inventory-management',
    title: '6. Inventory & Stock Take',
    desc: 'Understanding stock movements, low stock limits, and discrepancy audits.',
    content: (
      <div className="space-y-3 text-sm text-ink-600">
        <p>Inventory level is updated automatically through three daily events:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Purchases (+):</strong> Increases your stock when you record incoming stock from a supplier.</li>
          <li><strong>Sales &amp; Credit Sales (-):</strong> Decreases your stock the second an item leaves your counter.</li>
          <li><strong>Stock Take (+/-):</strong> Used to override the system count with a physical hand-count (e.g. to adjust for damage, expiration, or theft).</li>
        </ul>
        <div className="rounded bg-rust-50 p-3 text-xs text-rust-700">
          <strong>Discrepancy Note:</strong> Stock Take is purely an auditing tool. Correcting a stock discrepancy does not create cash transactions or expenses automatically. It logs the audit discrepancy under <strong>stockAdjustments</strong> for tracking.
        </div>
      </div>
    )
  },
  {
    id: 'faq',
    title: '7. Frequently Asked Questions',
    desc: 'Troubleshooting and immediate answers to common user questions.',
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Why is my profit still zero after a credit sale?</strong>
          <p className="text-xs text-ink-600 pl-4">A: Since no cash or M-Pesa has been collected yet, no revenue is earned. Once the customer repays, profit is recognized proportionally based on the amount paid.</p>
        </div>
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Why did my inventory reduce before I received any money?</strong>
          <p className="text-xs text-ink-600 pl-4">A: Real-time inventory tracking is crucial. Even on credit, physical stock leaves the shelves, so the system must deduct it immediately to prevent double-selling.</p>
        </div>
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Can I edit or void a closed session?</strong>
          <p className="text-xs text-ink-600 pl-4">A: No. Once a daily session is closed, it is securely saved. If you made an error, an administrator can click "Reopen session" on the Close Day page to make adjustments.</p>
        </div>
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Where do I edit or delete products?</strong>
          <p className="text-xs text-ink-600 pl-4">A: Editing and deleting products is restricted to administrators and must be done on the dedicated <strong>Products</strong> page, keeping the Counter screen clean and secure.</p>
        </div>
      </div>
    )
  },
  {
    id: 'best-practices',
    title: '8. FlowBiz Best Practices',
    desc: 'Golden rules for keeping your shop books accurate and reliable.',
    content: (
      <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-600">
        <li><strong>Record expenses immediately:</strong> Log your County Council fees, electricity, and lunch costs right when they occur so you do not forget at close-of-day.</li>
        <li><strong>Record credit repayments inside Debtors:</strong> Never create a new direct sale to record a repayment, this would double-count your revenue and duplicate items sold.</li>
        <li><strong>Perform Stock Take regularly:</strong> Plan a quick physical stock take every weekend or fortnight to ensure physical inventory matches your screens exactly.</li>
        <li><strong>Keep the general settings updated:</strong> Shop name edits immediately personalize your generated PDF reports for presentation to accountants.</li>
      </ul>
    )
  },
  {
    id: 'about-flowbiz',
    title: '9. About FlowBiz',
    desc: 'Who we are and our vision for empowering Kenyan small businesses.',
    content: (
      <p className="text-sm text-ink-600">
        FlowBiz is a localized, production-ready Business Manager custom-built to meet the unique operational challenges of Kenyan SMBs. By prioritizing cash-flow visibility, offering native barcode scanning, and supporting local transaction models like Deni and M-Pesa, we aim to make day-to-day recordkeeping effortless and stress-free.
      </p>
    )
  }
];

export default function HelpGuide() {
  const [activeTab, setActiveTab] = useState('getting-started');

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900"> Help &amp; Guide</h1>
          <p className="text-sm text-ink-400">FlowBiz user guide and best-practice operating manual.</p>
        </div>
        <Link to="/settings" className="btn-outline text-xs !px-3 !py-1.5 !min-h-0">
          ← Back to Settings
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Navigation panel */}
        <div className="w-full lg:w-1/3 space-y-2">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveTab(sec.id)}
              className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1 min-h-[50px] ${
                activeTab === sec.id
                  ? 'border-moss-600 bg-moss-50 text-moss-800 shadow-sm'
                  : 'border-ink-100 bg-white text-ink-600 hover:bg-ink-50'
              }`}
            >
              <span className="font-semibold text-sm block">{sec.title}</span>
              <span className="text-xs text-ink-400 line-clamp-1">{sec.desc}</span>
            </button>
          ))}
          
          <div className="rounded-lg bg-moss-50/50 border border-dashed border-moss-200 p-4 text-center mt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-moss-800 block">Need more topics?</span>
            <p className="text-[11px] text-ink-500 mt-1">We periodically update this manual. Future sections including Cashiers, eTIMS, VAT, Backup &amp; Restore, and loyalty schemes will appear here automatically.</p>
          </div>
        </div>

        {/* Content Display Panel */}
        <div className="flex-1 card bg-white p-5 sm:p-6 min-h-[300px]">
          {SECTIONS.map((sec) => {
            if (activeTab !== sec.id) return null;
            return (
              <div key={sec.id} className="space-y-4 animate-fade-in">
                <div className="border-b border-ink-100 pb-3">
                  <h2 className="font-display text-lg font-bold text-ink-900">{sec.title}</h2>
                  <p className="text-xs text-ink-400 mt-1">{sec.desc}</p>
                </div>
                <div className="pt-2">{sec.content}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
````

## File: src/pages/InventoryIntelligence.jsx
````javascript
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { formatKES } from '../utils/currency';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MiniBarChart from '../components/charts/MiniBarChart';
import DonutChart from '../components/charts/DonutChart';

function KpiCard({ label, value, tone = 'text-ink-900' }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="card p-4 sm:p-5">
      <h2 className="font-display text-sm font-bold text-ink-800">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function NoData({ children }) {
  return <p className="py-6 text-center text-sm text-ink-400">{children}</p>;
}

export default function InventoryIntelligence() {
  const { isPro, businessId } = useAuth();
  // MINOR CONSISTENCY FIX: every other page that reads `products`
  // (Products.jsx, Counter.jsx, Dashboard.jsx, Purchases.jsx, StockTake.jsx)
  // filters out archived items server-side with `where('deleted','!=',true)`.
  // This page previously fetched every product (including archived ones)
  // and only excluded them inside the metrics calculation below — same
  // end result, just less efficient. Filtering at the query matches the
  // rest of the app and reads less data.
  const productsQ = useMemo(
    () => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null),
    [businessId]
  );
  const { data: products, loading } = useFirestoreCollection(productsQ);

  const metrics = useMemo(() => {
    let totalCost = 0;
    let totalRetail = 0;
    let unitsInStock = 0;
    const overstocked = [];
    const outOfStock = [];
    const lowStock = [];

    (products || []).forEach((p) => {
      const stock = Number(p.stock) || 0;
      const cost = Number(p.costPrice) || 0;
      const retail = Number(p.sellingPrice) || 0;
      const threshold = Number(p.lowStockThreshold) || 5;

      if (stock > 0) {
        totalCost += stock * cost;
        totalRetail += stock * retail;
        unitsInStock += stock;
      }

      if (stock <= 0) {
        outOfStock.push(p);
      } else if (stock > threshold * 5) {
        overstocked.push({ ...p, value: stock * cost });
      } else if (stock <= threshold) {
        lowStock.push(p);
      }
    });

    overstocked.sort((a, b) => b.value - a.value);
    const healthyCount = (products || []).length - outOfStock.length - overstocked.length - lowStock.length;

    return { totalCost, totalRetail, unitsInStock, outOfStock, overstocked, lowStock, healthyCount };
  }, [products]);

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
        <h2 className="font-display text-xl font-bold text-ink-900">FlowBiz Pro Required</h2>
        <p className="mt-2 text-sm text-ink-500">Inventory Intelligence automatically uncovers dead stock, overstock, and capital tie-ups. Upgrade to Pro to unlock.</p>
        <Link to="/pro" className="mt-6 btn-primary w-full">Explore Pro</Link>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  const potentialProfit = metrics.totalRetail - metrics.totalCost;
  const activeProductsCount = (products || []).length;

  const insights = [];
  if (metrics.lowStock.length > 0) {
    insights.push({ tone: 'negative', text: `${metrics.lowStock.length} product${metrics.lowStock.length === 1 ? ' is' : 's are'} low on stock.` });
  }
  if (metrics.outOfStock.length > 0) {
    insights.push({ tone: 'negative', text: `${metrics.outOfStock.length} product${metrics.outOfStock.length === 1 ? ' is' : 's are'} out of stock — restock to avoid missed sales.` });
  }
  if (metrics.overstocked[0]) {
    insights.push({ tone: 'neutral', text: `"${metrics.overstocked[0].name}" is the biggest capital tie-up, holding ${formatKES(metrics.overstocked[0].value)} in stock.` });
  }
  if (insights.length === 0 && activeProductsCount > 0) {
    insights.push({ tone: 'positive', text: 'Stock levels look healthy across your product range right now.' });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Inventory Intelligence</h1>
          <p className="text-sm text-ink-400">Where your stock capital is right now</p>
        </div>
        <Link to="/products" className="btn-outline text-xs">Back to Products</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Capital Tied Up" value={formatKES(metrics.totalCost)} />
        <KpiCard label="Potential Gross Profit" value={formatKES(potentialProfit)} tone="text-moss-700" />
        <KpiCard label="Units in Stock" value={metrics.unitsInStock.toLocaleString()} />
        <KpiCard label="Active Products" value={activeProductsCount.toLocaleString()} />
        <KpiCard label="Low Stock" value={metrics.lowStock.length} tone={metrics.lowStock.length > 0 ? 'text-rust-600' : 'text-ink-900'} />
        <KpiCard label="Out of Stock" value={metrics.outOfStock.length} tone={metrics.outOfStock.length > 0 ? 'text-rust-600' : 'text-ink-900'} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Stock Health">
          {activeProductsCount > 0 ? (
            <DonutChart
              formatValue={(v) => `${v} product${v === 1 ? '' : 's'}`}
              segments={[
                { label: 'Healthy', value: metrics.healthyCount, colorClassName: 'text-moss-600', dotClassName: 'bg-moss-600' },
                { label: 'Low stock', value: metrics.lowStock.length, colorClassName: 'text-amber-500', dotClassName: 'bg-amber-500' },
                { label: 'Out of stock', value: metrics.outOfStock.length, colorClassName: 'text-rust-500', dotClassName: 'bg-rust-500' },
                { label: 'Overstocked', value: metrics.overstocked.length, colorClassName: 'text-blue-600', dotClassName: 'bg-blue-600' },
              ]}
            />
          ) : (
            <NoData>Add products to see stock health here.</NoData>
          )}
        </Section>

        <Section title="Top Capital Tie-Ups" subtitle="Overstocked items holding the most capital">
          {metrics.overstocked.length > 0 ? (
            <MiniBarChart
              orientation="horizontal"
              formatValue={formatKES}
              data={metrics.overstocked.slice(0, 6).map((p) => ({ label: p.name, value: p.value }))}
            />
          ) : (
            <NoData>No overstock detected.</NoData>
          )}
        </Section>
      </div>

      <Section title="Inventory Insights">
        <ul className="space-y-2.5">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  insight.tone === 'positive' ? 'bg-moss-600' : insight.tone === 'negative' ? 'bg-rust-500' : 'bg-blue-500'
                }`}
              />
              <span className="text-ink-700">{insight.text}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
````

## File: src/pages/JoinStaff.jsx
````javascript
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';
import { doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';

export default function JoinStaff() {
  const { inviteId } = useParams();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [invite, setInvite]     = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'staffInvites', inviteId));
        if (cancelled) return;
        if (!snap.exists()) { setNotFound(true); setChecking(false); return; }
        setInvite({ id: snap.id, ...snap.data() });
      } catch (err) {
        setNotFound(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inviteId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setSubmitting(true);

    let freshSnap;
    try {
      freshSnap = await getDoc(doc(db, 'staffInvites', inviteId));
      if (!freshSnap.exists()) throw new Error('This invite is no longer valid.');
      if (freshSnap.data().claimed) throw new Error('This invite has already been used.');
    } catch (err) {
      setError(err.message || 'This invite could not be validated. Please try again.');
      setSubmitting(false);
      return;
    }
    const { businessId, role, displayName } = freshSnap.data();

    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const message =
        err.code === 'auth/email-already-in-use' ? "An account with this email already exists." :
        err.code === 'auth/invalid-email'        ? 'Please enter a valid email address.' :
        err.code === 'auth/weak-password'         ? 'Password is too weak.' :
        'Could not create your account. Please try again.';
      setError(message);
      setSubmitting(false);
      return;
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: email.trim(),
        displayName,
        role,
        businessId,
        active: true,
        createdAt: serverTimestamp(),
        claimedFromInviteId: inviteId,
      });
      batch.update(doc(db, 'staffInvites', inviteId), {
        claimed: true,
        linkedUid: cred.user.uid,
        claimedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      console.error('[JoinStaff] Firestore registration failed after Auth account creation — rolling back:', err.code || err.name, err.message);
      try {
        await deleteUser(cred.user);
      } catch (rollbackErr) {
        console.error('[JoinStaff] Rollback failed — an orphaned Auth account may remain:', rollbackErr);
        setError('Something went wrong finishing your signup, and we could not fully undo it. Please contact your business owner before trying again with this email.');
        setSubmitting(false);
        return;
      }
      setError('Something went wrong finishing your signup. Please try again.');
      setSubmitting(false);
      return;
    }

    // FIX: handleCodeInApp: true routes the verification link through
    // FlowBiz's own /auth/action page instead of Firebase's generic
    // hosted page.
    try {
      await sendEmailVerification(cred.user, {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: true,
      });
      toast.success(`Welcome, ${displayName}! Check your email to verify your account.`);
    } catch (err) {
      console.error('[JoinStaff] sendEmailVerification failed after successful signup:', err.code || err.name, err.message);
      toast.success(
        err.code === 'auth/too-many-requests'
          ? `Welcome, ${displayName}! Your account was created, but too many verification emails have been requested. Use "Resend verification email" in a bit.`
          : `Welcome, ${displayName}! Your account was created, but we couldn't send the verification email. You can request a new one once you're signed in.`,
        { duration: 6000 }
      );
    }

    setSubmitting(false);
    navigate('/', { replace: true });
  };

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4"><p className="text-sm text-ink-400">Checking invite…</p></div>;

  if (notFound || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
        <div className="w-full max-w-sm card p-6 text-center space-y-3">
          <div className="text-3xl">🔗</div>
          <h1 className="font-display text-lg font-bold text-ink-900">Invite not found</h1>
          <p className="text-sm text-ink-500">This link may be wrong, or the invite was cancelled. Ask whoever invited you for a fresh link.</p>
          <Link to="/login" className="btn-outline w-full">Go to sign in</Link>
        </div>
      </div>
    );
  }

  if (invite.claimed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
        <div className="w-full max-w-sm card p-6 text-center space-y-3">
          <div className="text-3xl">✅</div>
          <h1 className="font-display text-lg font-bold text-ink-900">This invite has already been used</h1>
          <p className="text-sm text-ink-500">If this is you, sign in with the email and password you already set.</p>
          <Link to="/login" className="btn-primary w-full">Go to sign in</Link>
        </div>
      </div>
    );
  }

  const roleLabel = invite.role === 'owner' ? 'an owner' : 'a cashier';

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Welcome, {invite.displayName}</h1>
            <p className="text-sm text-ink-400">You've been invited as {roleLabel}. Set up your sign-in below.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Already signed in as the business owner in this browser? Open this invitation link in a different browser or a private/incognito window so your owner session isn't affected.
          </div>
          <div>
            <label className="label">Your email</label>
            <input type="email" className="input" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" />
          </div>
          <div>
            <label className="label">Choose a password</label>
            <input type="password" className="input" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input type="password" className="input" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Setting up…' : 'Create my sign-in'}
          </button>
        </form>
      </div>
    </div>
  );
}
````

## File: src/pages/Pro.jsx
````javascript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import toast from 'react-hot-toast';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

export default function Pro() {
  const { isPro, subscription } = useAuth();
  const [loading, setLoading] = useState(false);

  // FIX: Shifted from missing Firebase Function to the existing Cloudflare Worker API
const handleSubscribe = async () => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const response = await fetch(`${FLOWBIZ_API_URL}/api/paystack/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      const data = await response.json();

      if (data?.access_code && window.PaystackPop) {
        const popup = new window.PaystackPop();
        popup.resumeTransaction(data.access_code, {
          onSuccess: () => toast.success('Payment received — activating your subscription…'),
          onCancel: () => toast('Payment cancelled.'),
        });
      } else if (data?.authorization_url) {
        // Fallback if the Paystack script hasn't loaded yet.
        window.location.href = data.authorization_url;
      } else {
        toast.error(data?.error || "Couldn't initialize payment. Please try again.");
      }
    } catch (err) {
      toast.error(friendlyErrorMessage(err, { fallback: 'Payment initiation failed.' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">FlowBiz Pro</h1>
          <p className="text-sm text-ink-500">Supercharge your shop operations.</p>
        </div>
        <Link to="/" className="btn-outline text-xs">Back to Dashboard</Link>
      </div>

      <div className="card p-8 text-center bg-moss-50 border-moss-200">
        <h2 className="font-display text-3xl font-bold text-moss-800">KSh 500 <span className="text-lg font-normal text-moss-700">/ 30 days</span></h2>
        <p className="mt-2 text-ink-600 max-w-lg mx-auto">No recurring auto-billing. Manual renewal ensures you're always in control of your subscription.</p>
        
        {isPro ? (
          <div className="mt-6 inline-flex flex-col items-center">
            <span className="badge bg-amber-100 text-amber-800 px-4 py-2 text-sm">FlowBiz Pro Active</span>
            {subscription?.expiresAt && <p className="text-xs text-ink-500 mt-2">Expires on {new Date(subscription.expiresAt.toMillis ? subscription.expiresAt.toMillis() : subscription.expiresAt).toLocaleDateString()}</p>}
            <button onClick={handleSubscribe} disabled={loading} className="mt-4 btn-outline">Extend Subscription</button>
          </div>
        ) : (
          <button onClick={handleSubscribe} disabled={loading} className="mt-6 btn-primary px-8 py-3 text-lg">
            {loading ? 'Initializing Payment...' : 'Pay KSh 500'}
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-6 pt-4">
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900 mb-3">Advanced Analytics</h3>
          <ul className="space-y-2 text-sm text-ink-600">
            <li><span className="text-moss-700 mr-2">✓</span>Business Health Dashboard</li>
            <li><span className="text-moss-700 mr-2">✓</span>Sales insights & Profit analysis</li>
            <li><span className="text-moss-700 mr-2">✓</span>Staff Analytics and performance tracking</li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900 mb-3">Inventory Intelligence</h3>
          <ul className="space-y-2 text-sm text-ink-600">
            <li><span className="text-moss-700 mr-2">✓</span>Detect overstocked items holding capital</li>
            <li><span className="text-moss-700 mr-2">✓</span>Predictive stockout warnings</li>
            <li><span className="text-moss-700 mr-2">✓</span>Total capital & potential profit insights</li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900 mb-3">Professional Documents</h3>
          <ul className="space-y-2 text-sm text-ink-600">
            <li><span className="text-moss-700 mr-2">✓</span>Professional invoices and receipts</li>
            <li><span className="text-moss-700 mr-2">✓</span>PDF generation and direct printing</li>
            <li><span className="text-moss-700 mr-2">✓</span>Business logo prominently displayed</li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900 mb-3">Communication & Team</h3>
          <ul className="space-y-2 text-sm text-ink-600">
            <li><span className="text-moss-700 mr-2">✓</span>WhatsApp receipts directly to customers</li>
            <li><span className="text-moss-700 mr-2">✓</span>WhatsApp invoice sending</li>
            <li><span className="text-moss-700 mr-2">✓</span>Unlimited staff members (Free plan limits to 1)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
````

## File: src/pages/Reports.jsx
````javascript
import { useMemo, useState } from 'react';
import { where, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useFinancialsForRange } from '../hooks/useFinancials';
import { useDailySession } from '../hooks/useDailySession';
import { useSettings } from '../hooks/useSettings';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorBanner from '../components/common/ErrorBanner';
import Modal from '../components/common/Modal';
import { formatKES } from '../utils/currency';
import { formatDate, formatDateTime, getRangeForPreset, startOfDay, endOfDay, todayKey } from '../utils/dateRanges';
import { computeSupplierBalances, computeExpectedTillBalances } from '../utils/financials';
import { Printer, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const PRESETS = [{id:'today',label:'Today'},{id:'week',label:'This Week'},{id:'month',label:'This Month'},{id:'custom',label:'Custom'}];

function Card({ label, value, tone='text-ink-900' }) {
  return <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p><p className={`mt-1 font-display text-lg font-bold ${tone}`}>{value}</p></div>;
}

export default function Reports() {
  const { businessId, isPro } = useAuth();
  const [preset, setPreset]         = useState('today');
  const [cStart, setCStart]         = useState('');
  const [cEnd,   setCEnd]           = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const { start, end } = useMemo(() => {
    if (preset==='custom'&&cStart&&cEnd) return { start:startOfDay(new Date(cStart)), end:endOfDay(new Date(cEnd)) };
    return getRangeForPreset(preset==='custom'?'today':preset);
  }, [preset,cStart,cEnd]);

  const { loading, error, sales, creditSales, summary } = useFinancialsForRange(start, end);
  const { session } = useDailySession();
  const { settings } = useSettings();

  // FIX: Matches Dashboard and Products exactly to utilize correct offline index
  const productsQ = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  
  const purchasesQ = useMemo(() => businessId ? tenantQuery('purchases', businessId, where('paymentStatus', '==', 'pending_supplier_credit')) : null, [businessId]);
  const outstandingCreditQ = useMemo(() => businessId ? tenantQuery('creditSales', businessId, where('status', 'in', ['pending', 'partial'])) : null, [businessId]);
  const supplierPaymentsQ = useMemo(() => businessId ? tenantQuery('supplierPayments', businessId) : null, [businessId]);
  const suppliersQ = useMemo(() => businessId ? tenantQuery('suppliers', businessId) : null, [businessId]);

  const { data: products } = useFirestoreCollection(productsQ);
  const { data: purchasesData } = useFirestoreCollection(purchasesQ);
  const { data: outstandingCreditSales } = useFirestoreCollection(outstandingCreditQ);
  const { data: supplierPaymentsData } = useFirestoreCollection(supplierPaymentsQ);
  const { data: suppliersData } = useFirestoreCollection(suppliersQ);

  const totalInventoryValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.stock || 0) * (p.costPrice || 0), 0);
  }, [products]);

  const lowStock = useMemo(() => {
    return products.filter((p) => p.stock <= (p.lowStockThreshold ?? 5));
  }, [products]);

  const supplierBalances = useMemo(
    () => computeSupplierBalances(purchasesData, supplierPaymentsData, suppliersData),
    [purchasesData, supplierPaymentsData, suppliersData]
  );

  // FIX: Added Credit Sales to product performance mapping
  const productPerf = useMemo(() => {
    const m = {};
    const ensure = (name) => {
      if (!m[name]) m[name] = { name, qty: 0, revenue: 0, profit: 0 };
      return m[name];
    };
    sales.forEach((s) => {
      if (s.isVoided) return;
      const row = ensure(s.productName);
      row.qty     += Number(s.quantity) || 0;
      row.revenue += Number(s.totalAmount) || 0;
      row.profit  += Number(s.profit) || 0;
    });
    creditSales.forEach((cs) => {
      if (cs.status === 'cancelled' || cs.status === 'refunded') return;
      const row = ensure(cs.productName);
      row.qty += Number(cs.quantity) || 0;
      // Revenue and Profit are zero until repaid via repayments collection
    });
    return Object.values(m);
  }, [sales, creditSales]);

  const bestSelling    = [...productPerf].sort((a,b)=>b.qty-a.qty).slice(0,5);
  const mostProfitable = [...productPerf].sort((a,b)=>b.profit-a.profit).slice(0,5);

  const { expectedCashAtClose, expectedMpesaAtClose } = computeExpectedTillBalances({
    openingCashFloat:         preset === 'today' ? (session?.openingCashFloat || 0) : 0,
    openingMpesaFloat:        preset === 'today' ? (session?.openingMpesaFloat || 0) : 0,
    totalCashSales:           summary.totalCashSales,
    totalMpesaSales:          summary.totalMpesaSales,
    totalDebtRepaymentsCash:  summary.totalDebtRepaymentsCash,
    totalDebtRepaymentsMpesa: summary.totalDebtRepaymentsMpesa,
    totalExpensesCash:        summary.totalExpensesCash,
    totalExpensesMpesa:       summary.totalExpensesMpesa,
    totalCashOutflows:        summary.totalCashOutflows,
    totalMpesaOutflows:       summary.totalMpesaOutflows,
  });

  const businessName = settings?.shopName || 'FlowBiz Store';

  const doExport = async (action) => {
    if (!isPro) { toast.error("Professional reports require FlowBiz Pro."); return; }
    try {
      const { jsPDF } = await import('jspdf');
      const { loadImageAsDataUrl } = await import('../utils/documentService');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 15;
      let y = 15;

      const logoDataUrl = await loadImageAsDataUrl(settings.logoUrl);
      if (logoDataUrl) {
        const format = logoDataUrl.match(/data:image\/(\w+);/)?.[1]?.toUpperCase() || 'PNG';
        try { doc.addImage(logoDataUrl, format, marginX, y, 18, 18); } catch (err) { console.error('Logo embed failed:', err); }
      }

      const textX = logoDataUrl ? marginX + 24 : marginX;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(businessName, textX, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(`FlowBiz Financial Report · ${formatDate(start)} — ${formatDate(end)}`, textX, y + 13);
      doc.setTextColor(0, 0, 0);
      y += 26;

      doc.setDrawColor(210, 210, 210);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 8;

      const sectionTitle = (title) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(title, marginX, y);
        y += 6;
        doc.setDrawColor(230, 230, 230);
        doc.line(marginX, y - 3.5, pageWidth - marginX, y - 3.5);
      };

      const row = (label, value, opts = {}) => {
        doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
        doc.setFontSize(10);
        doc.text(label, marginX, y);
        doc.text(value, pageWidth - marginX, y, { align: 'right' });
        y += 6.5;
      };

      sectionTitle('Financial Summary');
      row('Cash balance', formatKES(expectedCashAtClose));
      row('M-Pesa balance', formatKES(expectedMpesaAtClose));
      row('Credit sales (this period)', formatKES(summary.totalCreditSales));
      row('Debt repayments collected', formatKES(summary.totalDebtRepayments));
      y += 4;

      sectionTitle('Profit Calculation');
      row('Revenue', formatKES(summary.revenue));
      row('Cost of goods sold', `- ${formatKES(summary.costOfGoodsSold)}`);
      row('Gross profit', formatKES(summary.grossProfit), { bold: true });
      row('Total expenses', `- ${formatKES(summary.totalExpenses)}`);
      row('Net profit', formatKES(summary.netProfit), { bold: true });
      y += 4;

      if (bestSelling.length > 0) {
        sectionTitle('Top Selling Products');
        bestSelling.forEach((p) => row(p.name, `${p.qty} sold · ${formatKES(p.revenue)}`));
        y += 4;
      }

      if (lowStock.length > 0) {
        sectionTitle('Low Stock Alerts');
        lowStock.slice(0, 10).forEach((p) => row(p.name, `${p.stock} left`));
        y += 4;
      }

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated ${formatDateTime(new Date())} · FlowBiz`, marginX, 287);

      if (action === 'download') {
        doc.save(`flowbiz-report-${preset}-${todayKey()}.pdf`);
      } else {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      }
      toast.success('Report generated successfully.');
      setPdfModalOpen(false);
    } catch (err) {
      toast.error('Failed to generate PDF. Check console.');
      console.error(err);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-xl font-bold text-ink-900">Reports</h1>
        <Link to="/advanced-analytics" className="btn-outline">
          <TrendingUp className="h-4 w-4" /> Advanced Analytics
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(p=>(
          <button key={p.id} onClick={()=>setPreset(p.id)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${preset===p.id?'bg-ink-900 text-white':'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>{p.label}</button>
        ))}
        {preset==='custom'&&(
          <div className="flex items-center gap-2">
            <input type="date" className="input !w-auto" value={cStart} onChange={e=>setCStart(e.target.value)} />
            <span className="text-ink-400">to</span>
            <input type="date" className="input !w-auto" value={cEnd} onChange={e=>setCEnd(e.target.value)} />
          </div>
        )}
      </div>

      <ErrorBanner message={error ? `${error}` : null} />
      
      {loading ? <LoadingSpinner /> : (
        <>
          <div>
            <h2 className="mb-2 font-display text-sm font-bold text-ink-800">Financial Summary</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card label="Cash Balance" value={formatKES(expectedCashAtClose)} />
              <Card label="M-Pesa Balance" value={formatKES(expectedMpesaAtClose)} />
              <Card label="Credit Sales" value={formatKES(summary.totalCreditSales)} tone="text-rust-600" />
              <Card label="Repayments Collected" value={formatKES(summary.totalDebtRepayments)} tone="text-moss-700" />
            </div>
          </div>
          <div>
            <h2 className="mb-2 font-display text-sm font-bold text-ink-800">Profit Calculation</h2>
            <div className="card divide-y divide-ink-100">
              {[
                ['Revenue',               summary.revenue,             false],
                ['− Cost of goods sold',  -summary.costOfGoodsSold,    false],
                ['= Gross profit',        summary.grossProfit,          true ],
                ['− Total expenses',      -summary.totalExpenses,       false],
                ['= Net profit',          summary.netProfit,            true ],
              ].map(([label,value,bold],i)=>(
                <div key={label} className={`flex items-center justify-between px-4 py-3 ${bold?'bg-ink-50/60':''}`}>
                  <span className={`text-sm ${bold?'font-bold text-ink-900':'text-ink-600'}`}>{label}</span>
                  <span className={`font-semibold ${value<0?'text-rust-600':i===4?'text-moss-700':'text-ink-800'}`}>{formatKES(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setPdfModalOpen(true)}>
              <Printer className="h-4 w-4" strokeWidth={1.75} /> Get PDF Report
            </button>
          </div>
        </>
      )}

      <Modal open={pdfModalOpen} onClose={() => setPdfModalOpen(false)} title="Get PDF Report">
        <div className="space-y-3">
          <p className="text-sm text-ink-500 mb-4">Choose how you want to export your professional financial report.</p>
          <button className="btn-primary w-full" onClick={() => doExport('download')}>Download PDF</button>
          <button className="btn-outline w-full" onClick={() => doExport('print')}>Print Report</button>
          <button className="btn-secondary w-full mt-2" onClick={() => setPdfModalOpen(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
````

## File: src/pages/Settings.jsx
````javascript
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { resetBusinessData } from '../utils/businessReset';
import { restoreProduct, permanentlyDeleteProduct, cleanupOrphanedBarcodeIndexes } from '../utils/products';
import { isDemoMode } from '../demo/demoMode';
import { resetDemoData } from '../demo/seedData';
import { formatDateTime } from '../utils/dateRanges';
import ConfirmDialog from '../components/common/ConfirmDialog';

const RESET_CONFIRM_PHRASE = 'RESET';

export default function Settings() {
  const { profile, businessId, isOwner, emailVerified, listBusinessSessions, revokeSession, currentSessionId, isPro, subscription } = useAuth();
  const demo = isDemoMode();
  const [loading, setLoading]     = useState(true);
  
  const [shopName, setShopName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [address, setAddress]     = useState('');
  const [logoFile, setLogoFile]   = useState(null);
  const [logoUrl, setLogoUrl]     = useState('');
  const [cashierExp, setCashierExp] = useState(true);
  
  const [saving, setSaving]       = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const [archived, setArchived] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const settingsRef = businessId ? doc(db, 'businessSettings', businessId) : null;

  function compressImage(file, maxDimension = 480, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Could not process image.')); return; }
        resolve(blob);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image file.')); };
    img.src = url;
  });
}

  useEffect(() => {
    if (!settingsRef) return;
    getDoc(settingsRef).then(snap => {
      if (snap.exists()) { 
        const d = snap.data(); 
        setShopName(d.shopName || ''); 
        setPhone(d.phone || '');
        setEmail(d.email || '');
        setAddress(d.address || '');
        setLogoUrl(d.logoUrl || '');
        setCashierExp(d.cashierCanRecordExpenses !== false); 
      }
      setLoading(false);
    });
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    listBusinessSessions().then(setSessions).finally(() => setSessionsLoading(false));
  }, [businessId]);

  const loadArchived = async () => {
    if (!businessId) return;
    setArchivedLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'products'), where('businessId', '==', businessId), where('deleted', '==', true)));
      setArchived(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setArchivedLoading(false);
    }
  };

const handleSave = async e => {
    e.preventDefault(); 
    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;

      // Logo upload gets its OWN try/catch (Issue 8): a slow/failed
      // upload of the (now compressed) image must not block saving the
      // rest of Business Information, which has nothing to do with it.
      if (logoFile) {
        try {
          const compressed = await compressImage(logoFile, 480, 0.75);
          const fileRef = ref(storage, `businesses/${businessId}/logo_${Date.now()}`);
          await uploadBytes(fileRef, compressed);
          finalLogoUrl = await getDownloadURL(fileRef);
        } catch (logoErr) {
          toast.error(`Logo upload failed, but the rest of your settings will still be saved: ${logoErr.message}`);
        }
      }

      await setDoc(settingsRef, { 
        shopName: shopName.trim(), 
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        logoUrl: finalLogoUrl,
      }, { merge: true });
      
      setLogoUrl(finalLogoUrl);
      toast.success('Business information saved'); 
      setLogoFile(null);
    } catch (err) { 
      toast.error(err.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    try {
      await setDoc(settingsRef, { cashierCanRecordExpenses: cashierExp }, { merge: true });
      toast.success('Permissions saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      if (demo) {
        resetDemoData();
        toast.success('Demo data reset. Reloading…');
      } else {
        await resetBusinessData(businessId, profile?.uid);
        toast.success('Business data reset. Reloading…');
      }
      window.location.href = '/';
    } catch (err) {
      toast.error(`Reset failed partway through: ${err.message}`);
      setResetting(false);
      setResetDialogOpen(false);
    }
  };

  const handleRevoke = async (sessionId) => {
    try {
      await revokeSession(sessionId);
      setSessions(s => s.map(x => x.id === sessionId ? { ...x, revoked: true } : x));
      toast.success('Device signed out.');
    } catch (err) { toast.error(err.message); }
  };

  const handleRestore = async (productId) => {
    try { await restoreProduct(productId); setArchived(a => a.filter(p => p.id !== productId)); toast.success('Product restored'); }
    catch (err) { toast.error(err.message); }
  };

  const handlePermanentDelete = async (productId) => {
    const target = archived.find(p => p.id === productId);
    try {
      await permanentlyDeleteProduct(productId, target?.barcode, businessId);
      setArchived(a => a.filter(p => p.id !== productId));
      toast.success('Product permanently deleted');
    } catch (err) { toast.error(err.message); }
  };

  const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const handleCleanupOrphans = async () => {
    setCleaningOrphans(true);
    try {
      const { scanned, removed } = await cleanupOrphanedBarcodeIndexes(businessId);
      toast.success(removed > 0
        ? `Checked ${scanned} barcode record(s), freed ${removed} orphaned barcode(s).`
        : `Checked ${scanned} barcode record(s) — none were orphaned.`);
    } catch (err) { toast.error(err.message); }
    finally { setCleaningOrphans(false); }
  };

  if (loading) return <div className="mx-auto max-w-xl"><p className="text-sm text-ink-400">Loading…</p></div>;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="font-display text-xl font-bold text-ink-900">Settings</h1>

      <div className="card p-5 space-y-2">
        <h2 className="font-display text-base font-bold text-ink-800">Account &amp; Security</h2>
        <Row label="Email verification" value={demo ? 'Not applicable (Demo Mode)' : emailVerified ? 'Verified ✓' : 'Not verified'} tone={!demo && !emailVerified ? 'text-rust-600' : ''} />
        <Row label="Your role" value={profile?.role === 'owner' ? 'Owner' : 'Cashier'} />
        <Row label="Business ID" value={businessId || '—'} mono />
      </div>

      <form onSubmit={handleSave} className="card space-y-4 p-5">
        <h2 className="font-display text-base font-bold text-ink-800">Business Information</h2>
        <p className="text-sm text-ink-500 mb-2">This info dynamically populates your customer-facing documents (receipts, invoices).</p>
        
        <div><label className="label">Business name</label><input className="input" value={shopName} onChange={e=>setShopName(e.target.value)} placeholder="Your Business Name" /></div>
        
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Business Phone</label><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Official Contact Number" /></div>
          <div><label className="label">Business Email</label><input type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="contact@example.com" /></div>
        </div>

        <div><label className="label">Business Address</label><input className="input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Physical location" /></div>
        
        <div>
          <label className="label">Business Logo</label>
          <div className="flex items-center gap-4">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-12 object-cover rounded-lg border border-ink-200" />}
            <input type="file" accept="image/*" className="text-sm" onChange={(e) => setLogoFile(e.target.files[0])} />
          </div>
        </div>

<button type="submit" className="btn-primary w-full" disabled={saving}>{saving?'Saving…':'Save settings'}</button>
      </form>

      <div className="card p-5 space-y-3">
        <h2 className="font-display text-base font-bold text-ink-800">Permissions</h2>
        <div className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-3">
          <div><p className="text-sm font-semibold text-ink-800">Let cashiers record expenses</p><p className="text-xs text-ink-400">Turn off if only owners should log expenses.</p></div>
          <button type="button" onClick={()=>setCashierExp(v=>!v)} className={`h-6 w-11 shrink-0 rounded-full transition-colors ${cashierExp?'bg-moss-600':'bg-ink-200'}`} role="switch" aria-checked={cashierExp}>
            <span className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform ${cashierExp?'translate-x-5':''}`} />
          </button>
        </div>
        <button type="button" className="btn-primary w-full" onClick={handleSavePermissions} disabled={savingPermissions}>
          {savingPermissions ? 'Saving…' : 'Save permissions'}
        </button>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-display text-base font-bold text-ink-800">Team Management</h2>
        <p className="text-sm text-ink-500">Invite owners or cashiers, and manage pending invites and access.</p>
        <Link to="/users" className="btn-outline w-full flex items-center justify-center gap-2">Manage users &amp; invites</Link>
      </div>

      {!demo && (
        <div className="card p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-ink-800">Device Management</h2>
          {sessionsLoading ? <p className="text-sm text-ink-400">Loading…</p> : sessions.length === 0 ? (
            <p className="text-sm text-ink-400">No device sessions recorded yet.</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-ink-700">{s.deviceLabel}{s.id === currentSessionId && <span className="text-xs text-ink-400"> (this device)</span>}</p>
                    <p className="text-xs text-ink-400">Last active {formatDateTime(s.lastActiveAt)}</p>
                  </div>
                  {s.revoked ? (
                    <span className="badge bg-ink-100 text-ink-500">Signed out</span>
                  ) : (
                    <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => handleRevoke(s.id)}>Sign out</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-ink-800">Data</h2>
          <div className="flex gap-2">
            <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={handleCleanupOrphans} disabled={cleaningOrphans}>
              {cleaningOrphans ? 'Checking…' : 'Clean Up Orphaned Barcodes'}
            </button>
            <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => { setArchivedOpen(o => !o); if (!archivedOpen) loadArchived(); }}>
              {archivedOpen ? 'Hide' : 'View archive'}
            </button>
          </div>
        </div>
        <p className="text-sm text-ink-500">Deleted products are archived here first, never destroyed immediately.</p>
        {archivedOpen && (
          archivedLoading ? <p className="text-sm text-ink-400">Loading…</p> : archived.length === 0 ? (
            <p className="text-sm text-ink-400">Nothing archived.</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {archived.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-ink-700">{p.name}</span>
                  <div className="flex gap-2">
                    <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => handleRestore(p.id)}>Restore</button>
                    <button className="btn-danger !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => handlePermanentDelete(p.id)}>Delete forever</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <div className="card p-5 space-y-2">
        <h2 className="font-display text-base font-bold text-ink-800">Subscription</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-500">Status: <span className={`font-semibold ${isPro ? 'text-amber-600' : 'text-ink-600'}`}>{isPro ? 'FlowBiz Pro' : 'Free'}</span></p>
          <Link to="/pro" className="btn-outline text-xs !px-2 !py-1 !min-h-0">Manage</Link>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-display text-base font-bold text-ink-800">Help &amp; Support</h2>
        <Link to="/help" className="btn-outline w-full flex items-center justify-center gap-2"><span>View Help &amp; Guide</span></Link>
      </div>

      <div className="card space-y-3 border-rust-200 p-5">
        <div>
          <h2 className="font-display text-base font-bold text-rust-700">Danger Zone</h2>
          <p className="mt-1 text-sm text-ink-500">
            {demo
              ? 'Demo Reset clears all sample data stored in this browser.'
              : "Business Reset permanently deletes ALL of this business's data. This cannot be undone."}
          </p>
        </div>
        <button type="button" className="btn-danger w-full" onClick={() => { setResetConfirmText(''); setResetDialogOpen(true); }}>
          {demo ? 'Demo Reset' : 'Business Reset'}
        </button>
      </div>

      <ConfirmDialog
        open={resetDialogOpen}
        title={demo ? 'Reset the demo data?' : 'This will permanently delete ALL data for this business'}
        message={
          demo ? (
            <p>All sample data in this browser will be cleared and replaced with the original demo dataset.</p>
          ) : (
            <>
              <p className="mb-2">Everything this business owns will be deleted. This cannot be undone.</p>
              <label className="label mt-3">Type <span className="font-mono font-bold">{RESET_CONFIRM_PHRASE}</span> to confirm</label>
              <input className="input" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} autoFocus />
            </>
          )
        }
        confirmLabel={resetting ? 'Resetting…' : demo ? 'Reset demo data' : 'Delete everything'}
        danger
        onConfirm={demo ? (!resetting ? handleReset : () => {}) : (resetConfirmText === RESET_CONFIRM_PHRASE && !resetting ? handleReset : () => {})}
        onCancel={() => { if (!resetting) setResetDialogOpen(false); }}
      />
    </div>
  );
}

function Row({ label, value, tone = '', mono = false }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className={`font-semibold ${mono ? 'font-mono text-xs' : ''} ${tone || 'text-ink-800'}`}>{value}</span>
    </div>
  );
}
````

## File: src/pages/Setup.jsx
````javascript
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';
import { doc, collection, serverTimestamp, runTransaction } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';

export default function Setup() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName]       = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!businessName.trim() || !ownerName.trim() || !email.trim()) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setSubmitting(true);

    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const message =
        err.code === 'auth/email-already-in-use' ? "An account with this email already exists in Firebase Authentication. If it was used for a business before, sign in with that account instead — the current system can't reuse the exact same email for a brand-new business." :
        err.code === 'auth/invalid-email'         ? 'Please enter a valid email address.' :
        err.code === 'auth/weak-password'          ? 'Password is too weak.' :
        'Could not create your account. Please try again.';
      setError(message);
      setSubmitting(false);
      return;
    }

    const businessRef = doc(collection(db, 'businesses'));
    const userRef      = doc(db, 'users', cred.user.uid);
    try {
      await runTransaction(db, async (tx) => {
        tx.set(businessRef, {
          name: businessName.trim(),
          ownerIds: [cred.user.uid],
          createdAt: serverTimestamp(),
          createdBy: cred.user.uid,
          subscription: { plan: 'free', status: 'active', expiry: null },
        });
        tx.set(userRef, {
          uid: cred.user.uid,
          email: email.trim(),
          displayName: ownerName.trim(),
          role: 'owner',
          businessId: businessRef.id,
          active: true,
          createdAt: serverTimestamp(),
        });
      });
    } catch (err) {
      console.error('[Setup] Business/profile creation failed after Auth account creation — rolling back:', err.code || err.name, err.message);
      try {
        await deleteUser(cred.user);
      } catch (rollbackErr) {
        console.error('[Setup] Rollback failed — an orphaned Auth account may remain:', rollbackErr);
        setError('Something went wrong finishing setup, and we could not fully undo it. Please contact support before trying again with this email.');
        setSubmitting(false);
        return;
      }
      setError('Something went wrong finishing setup. Please try again.');
      setSubmitting(false);
      return;
    }

    // FIX: handleCodeInApp: true routes the verification link through
    // FlowBiz's own /auth/action page instead of Firebase's generic
    // hosted page — see src/pages/AuthAction.jsx.
    try {
      await sendEmailVerification(cred.user, {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: true,
      });
      toast.success(`Welcome, ${ownerName.trim()}! Check your email to verify your account.`);
    } catch (err) {
      console.error('[Setup] sendEmailVerification failed after successful setup:', err.code || err.name, err.message);
      toast.success(
        err.code === 'auth/too-many-requests'
          ? `Welcome, ${ownerName.trim()}! Your business was created, but too many verification emails have been requested. Use "Resend verification email" in a bit.`
          : `Welcome, ${ownerName.trim()}! Your business was created, but we couldn't send the verification email. You can request a new one once you're signed in.`,
        { duration: 6000 }
      );
    }

    setSubmitting(false);
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Create your business</h1>
            <p className="text-sm text-ink-400">Set up a new FlowBiz account for your shop</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
          <div><label className="label">Business name</label><input className="input" required value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="e.g. Mama Njeri General Store" autoComplete="organization" /></div>
          <div><label className="label">Your name</label><input className="input" required value={ownerName} onChange={e=>setOwnerName(e.target.value)} placeholder="e.g. Jane Njeri" autoComplete="name" /></div>
          <div><label className="label">Email</label><input type="email" className="input" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@yourbusiness.co.ke" autoComplete="username" /></div>
          <div><label className="label">Password</label><input type="password" className="input" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" /></div>
          <div><label className="label">Confirm password</label><input type="password" className="input" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" /></div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? 'Setting up…' : 'Create business account'}</button>
        </form>
        <p className="text-center text-sm text-ink-400">Already have a business? <Link to="/login" className="font-semibold text-moss-400 hover:underline">Sign in</Link></p>
      </div>
    </div>
  );
}
````

## File: src/pages/StockTake.jsx
````javascript
import { useMemo, useRef, useState } from 'react';
import { doc, collection, writeBatch, increment, serverTimestamp, orderBy, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';

export default function StockTake() {
  const { profile, businessId } = useAuth();
  const productsQ = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  
  const { data: products, loading } = useFirestoreCollection(productsQ);
  const [counts, setCounts] = useState({});
  const [reasons, setReasons] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const rowRefs = useRef({});

  const getPhysical = (p) => (counts[p.id] !== undefined && counts[p.id] !== '' ? counts[p.id] : p.stock);
  const diffFor = (p) => (counts[p.id] !== undefined && counts[p.id] !== '' ? Number(counts[p.id]) - p.stock : 0);
  const changed = products.filter((p) => diffFor(p) !== 0);

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (!found) { toast.error('Product not found.'); return; }
    rowRefs.current[found.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const inputEl = document.getElementById(`stocktake-count-${found.id}`) || document.getElementById(`stocktake-count-mobile-${found.id}`);
    inputEl?.focus();
    inputEl?.select?.();
  };

  useHardwareScanner(handleScanDetected, { enabled: !scannerOpen && !confirm });

  const handleSave = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      for (const p of changed) {
        const physicalQty = Number(getPhysical(p)) || 0;
        const difference = physicalQty - p.stock;
        const ref = doc(db, 'products', p.id);

        batch.update(ref, { stock: increment(difference), updatedAt: serverTimestamp() });

        const adjRef = doc(collection(db, 'stockAdjustments'));
        batch.set(adjRef, {
          businessId,
          productId: p.id,
          productName: p.name,
          systemQty: p.stock,
          physicalQty,
          difference,
          reason: reasons[p.id] || '',
          adjustedBy: profile.uid,
          adjustedByName: profile.displayName,
          adjustedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      toast.success(`Stock take saved — ${changed.length} product(s) adjusted`);
      setCounts({});
      setReasons({});
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Stock Take</h1>
          <p className="text-sm text-ink-400">Enter physical counts, or scan to jump to a product. Leave blank to keep unchanged.</p>
        </div>
        <button className="btn-primary" disabled={changed.length === 0} onClick={() => setConfirm(true)}>
          Save ({changed.length} changed)
        </button>
      </div>

      <div className="space-y-3 sm:hidden">
        {products.map((p) => {
          const diff = diffFor(p);
          return (
            <div key={p.id} ref={(el) => { rowRefs.current[p.id] = el; }} className={`card p-4 space-y-3 ${diff !== 0 ? 'border-rust-200 bg-rust-50/20' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink-800">{p.name}</span>
                <span className="badge bg-ink-100 text-ink-600 text-xs">System: {p.stock}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Physical count</label>
                  <input id={`stocktake-count-mobile-${p.id}`} type="number" min="0" className="input !py-2" value={counts[p.id] ?? ''} placeholder={String(p.stock)} onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Difference</label>
                  <div className={`input !py-2 flex items-center font-semibold ${diff < 0 ? 'text-rust-600' : diff > 0 ? 'text-moss-600' : 'text-ink-400'}`}>
                    {diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : '0'}
                  </div>
                </div>
              </div>
              {diff !== 0 && (
                <div>
                  <label className="label">Reason for discrepancy</label>
                  <input className="input !py-2" placeholder="e.g. damage, theft, expired" value={reasons[p.id] || ''} onChange={(e) => setReasons((r) => ({ ...r, [p.id]: e.target.value }))} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden sm:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
              <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">System</th><th className="px-4 py-3">Physical count</th><th className="px-4 py-3">Diff</th><th className="px-4 py-3">Reason</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {products.map((p) => {
                const diff = diffFor(p);
                return (
                  <tr key={p.id} ref={(el) => { rowRefs.current[p.id] = el; }} className={diff !== 0 ? 'bg-rust-50/30' : ''}>
                    <td className="px-4 py-3 font-medium text-ink-800">{p.name}</td>
                    <td className="px-4 py-3 text-ink-500">{p.stock}</td>
                    <td className="px-4 py-3">
                      <input id={`stocktake-count-${p.id}`} type="number" min="0" className="input !w-24 !py-1.5" value={counts[p.id] ?? ''} placeholder={String(p.stock)} onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))} />
                    </td>
                    <td className={`px-4 py-3 font-semibold ${diff < 0 ? 'text-rust-600' : diff > 0 ? 'text-moss-600' : 'text-ink-300'}`}>
                      {diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <input className="input !py-1.5" placeholder="e.g. breakage, theft" value={reasons[p.id] || ''} disabled={diff === 0} onChange={(e) => setReasons((r) => ({ ...r, [p.id]: e.target.value }))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <ConfirmDialog
        open={confirm}
        title="Save stock take?"
        message={`${changed.length} product(s) will be updated to match your physical count.`}
        confirmLabel={saving ? 'Saving…' : 'Save'}
        onConfirm={handleSave}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}s
````

## File: src/pages/Suppliers.jsx
````javascript
import { useMemo, useState } from 'react';
import { addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp, orderBy, where, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Banknote, Smartphone } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import { formatKES } from '../utils/currency';
import { computeSupplierBalances } from '../utils/financials';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Suppliers() {
  const { profile, businessId } = useAuth();
  const suppQ   = useMemo(() => businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null, [businessId]);
  const purchQ  = useMemo(() => businessId ? tenantQuery('purchases', businessId, where('paymentStatus', '==', 'pending_supplier_credit')) : null, [businessId]);
  const paymQ   = useMemo(() => businessId ? tenantQuery('supplierPayments', businessId) : null, [businessId]);
  const { data: suppliers, loading } = useFirestoreCollection(suppQ);
  const { data: purchases }          = useFirestoreCollection(purchQ);
  const { data: spayments }          = useFirestoreCollection(paymQ);

  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [pendDel, setPendDel]   = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [selSupp, setSelSupp]   = useState(null);
  const [payAmt, setPayAmt]     = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payCode, setPayCode]   = useState('');
  const [paying, setPaying]     = useState(false);

  const owedList = useMemo(
    () => computeSupplierBalances(purchases, spayments, suppliers),
    [purchases, spayments, suppliers]
  );
  const owedMap = useMemo(
    () => Object.fromEntries(owedList.map((o) => [o.supplierId, o.balance])),
    [owedList]
  );
  const totalOwed = owedList.reduce((a, o) => a + o.balance, 0);

const [deleting, setDeleting] = useState(false);

  const handleSave = async data => {
    const write = editing
      ? updateDoc(doc(db,'suppliers',editing.id), data)
      : addDoc(tenantCollection('suppliers'), withBusiness({ ...data, createdAt:serverTimestamp() }, businessId));

    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); throw error; }
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : (editing ? 'Supplier updated' : 'Supplier added'));
    setModal(false); setEditing(null);
  };

  const handleDel = async () => {
    const balance = owedMap[pendDel.id] || 0;
    if (balance > 0.005) {
      toast.error(`Can't remove "${pendDel.name}" — they still have an outstanding balance of ${formatKES(balance)}. Pay it off first.`);
      setPendDel(null);
      return;
    }
    setDeleting(true);
    const { queuedOffline, error } = await raceWithTimeout(deleteDoc(doc(db,'suppliers',pendDel.id)), 4000);
    setDeleting(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(queuedOffline ? "Removed — it'll sync once you're back online." : 'Supplier removed');
    setPendDel(null);
  };

  const handlePay = async e => {
    e.preventDefault();
    const amount = Number(payAmt);
    const balance = owedMap[selSupp?.id]||0;
    if (amount<=0) { toast.error('Enter a positive amount.'); return; }
    if (amount > balance + 0.005) { toast.error(`Amount exceeds the outstanding balance of ${formatKES(balance)}.`); return; }
    if (payMethod==='M-Pesa'&&!payCode.trim()) { toast.error('Enter M-Pesa code.'); return; }
    setPaying(true);
    const batch = writeBatch(db);
    const expRef = doc(collection(db,'expenses'));
    batch.set(expRef, withBusiness({ description:`Supplier payment to ${selSupp.name}`, category:'Supplier Payment', amount, paymentMethod:payMethod, mpesaCode:payMethod==='M-Pesa'?payCode.trim():null, recordedBy:profile.uid, recordedByName:profile.displayName, recordedAt:serverTimestamp() }, businessId));
    const payRef = doc(collection(db,'supplierPayments'));
    batch.set(payRef, withBusiness({ supplierId:selSupp.id, supplierName:selSupp.name, amount, method:payMethod, mpesaCode:payMethod==='M-Pesa'?payCode.trim():null, paidAt:serverTimestamp(), recordedBy:profile.uid, recordedByName:profile.displayName }, businessId));

    const commit = batch.commit();
    const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
    setPaying(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(queuedOffline ? "Payment saved — it'll sync once you're back online." : `Payment of ${formatKES(amount)} recorded for ${selSupp.name}`);
    if (queuedOffline) commit.catch((err) => toast.error(`A supplier payment from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
    setPayModal(false); setPayAmt(''); setPayCode('');
  };
  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    if (!queuedOffline) setNewSupplierId(ref.id); // offline: won't auto-select until next reload — acceptable trade-off
    setSupplierModal(false);
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Supplier added');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-xl font-bold text-ink-900">Suppliers</h1><p className="text-sm text-ink-400">Total owed: <span className="font-semibold text-rust-600">{formatKES(totalOwed)}</span></p></div>
        <button className="btn-primary" onClick={()=>{setEditing(null);setModal(true);}}>+ Add supplier</button>
      </div>
      {loading?<LoadingSpinner />:suppliers.length===0?<EmptyState title="No suppliers yet" description="Add suppliers to track restocking and balances." />:(
        <div className="space-y-3">
          {suppliers.map(s=>{
            const balance = owedMap[s.id]||0;
            return (
              <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="font-semibold text-ink-800">{s.name}</p><p className="text-xs text-ink-400">{s.contactPerson&&`${s.contactPerson} · `}{s.phone||'No phone'}</p></div>
                <div className="flex items-center gap-3">
                  <div className="text-right"><p className="text-xs text-ink-400">Outstanding</p><p className={`font-semibold ${balance>0?'text-rust-600':'text-moss-600'}`}>{formatKES(balance)}</p></div>
                  {balance>0&&<button className="btn-primary !text-xs !px-3 !py-1.5 !min-h-0" onClick={()=>{setSelSupp(s);setPayModal(true);}}>Pay</button>}
                  <button className="rounded-lg p-2 text-ink-400 hover:bg-ink-100" onClick={()=>{setEditing(s);setModal(true);}}><Pencil className="h-4 w-4" strokeWidth={1.75}/></button>
                  <button className="rounded-lg p-2 text-rust-400 hover:bg-rust-50" onClick={()=>setPendDel(s)}><Trash2 className="h-4 w-4" strokeWidth={1.75}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <SupplierFormModal open={modal} onClose={()=>{setModal(false);setEditing(null);}} onSave={handleSave} initialSupplier={editing} />
<ConfirmDialog
        open={!!pendDel}
        title="Remove supplier?"
        message={(owedMap[pendDel?.id]||0) > 0.005
          ? `"${pendDel?.name}" has an outstanding balance of ${formatKES(owedMap[pendDel?.id]||0)} — pay it off first.`
          : `"${pendDel?.name}" will be removed. Purchase records stay intact.`}
        confirmLabel={deleting ? 'Removing…' : 'Remove'}
        confirmDisabled={deleting}
        danger
        onConfirm={handleDel}
        onCancel={()=>{ if (!deleting) setPendDel(null); }}
      />      <Modal open={payModal} onClose={()=>setPayModal(false)} title={`Pay ${selSupp?.name||''}`}>
        <form onSubmit={handlePay} className="space-y-3">
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">Outstanding: <span className="font-semibold text-rust-600">{formatKES(owedMap[selSupp?.id]||0)}</span></div>
          <div><label className="label">Amount (KES)</label><input type="number" min="0.01" step="0.01" max={owedMap[selSupp?.id]||undefined} className="input" value={payAmt} onChange={e=>setPayAmt(e.target.value)} required autoFocus /></div>
          <div><label className="label">Method</label>
            <div className="grid grid-cols-2 gap-2">
              {['Cash','M-Pesa'].map(m=>(
                <button key={m} type="button" onClick={()=>setPayMethod(m)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${payMethod===m?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>
                  {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
                </button>
              ))}
            </div>
          </div>
          {payMethod==='M-Pesa'&&<div><label className="label">M-Pesa code</label><input className="input uppercase" value={payCode} onChange={e=>setPayCode(e.target.value.toUpperCase())} /></div>}
          <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={()=>setPayModal(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={paying}>{paying?'Recording…':'Record payment'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
````

## File: src/pages/Users.jsx
````javascript
import { useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Trash2, Copy, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { tenantQuery } from '../lib/tenant';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';

export default function Users() {
  const { createStaffInvite, cancelStaffInvite, removeStaffAccount, toggleMemberActive, profile, businessId, isPro } = useAuth();
  const usersQ = useMemo(() => tenantQuery('users', businessId, orderBy('displayName')), [businessId]);
  const { data: users, loading } = useFirestoreCollection(usersQ);

  const invitesQ = useMemo(() => tenantQuery('staffInvites', businessId), [businessId]);
  const { data: allInvites, loading: invitesLoading } = useFirestoreCollection(invitesQ);
  const invites = allInvites.filter((i) => !i.claimed);

  const ownerCount = users.filter((u) => u.role === 'owner' && u.active !== false).length;
  const totalUsersCount = users.filter((u) => u.active !== false).length;

  const [modal, setModal]           = useState(false);
  const [newName, setNewName]       = useState('');
  const [newRole, setNewRole]       = useState('cashier');
  const [busy, setBusy]             = useState(false);
  const [freshInvite, setFreshInvite] = useState(null);
  const [pendToggle, setPendToggle] = useState(null);
  const [pendDelete, setPendDelete] = useState(null);
  const [pendCancelInvite, setPendCancelInvite] = useState(null);

  const inviteLink = (inviteId) => `${window.location.origin}/join/${inviteId}`;

  const copyLink = async (inviteId) => {
    try { await navigator.clipboard.writeText(inviteLink(inviteId)); toast.success('Invite link copied'); }
    catch { toast.error('Could not copy — long-press the link to copy it manually.'); }
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    // Feature 14 - Staff limits enforced in frontend for UX, backend rules would prevent it too
    if (!isPro && (totalUsersCount + invites.length) >= 2) {
      toast.error('Free plan allows a maximum of 1 Owner and 1 additional Staff member. Upgrade to FlowBiz Pro to add more, or cancel a pending invite first.');
      return;
    }

    setBusy(true);
    try {
      const invite = await createStaffInvite({ displayName: newName.trim(), role: newRole });
      setFreshInvite({ id: invite.id, displayName: newName.trim(), role: newRole });
      setNewName('');
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const handleCancelInvite = async () => {
    try { await cancelStaffInvite(pendCancelInvite.id); toast.success('Invite cancelled'); }
    catch (err) { toast.error(friendlyErrorMessage(err)); }
    finally { setPendCancelInvite(null); }
  };

  const handleToggle = async () => {
    if (pendToggle.role === 'owner' && pendToggle.active !== false && ownerCount <= 1) {
      toast.error("This is the only active owner — deactivating them would lock everyone out. Invite another owner first.");
      setPendToggle(null);
      return;
    }
    try {
      await toggleMemberActive(pendToggle.id, pendToggle.active === false);
      toast.success(pendToggle.active !== false ? 'Account deactivated' : 'Account reactivated');
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
    finally { setPendToggle(null); }
  };

  const handleDelete = async () => {
    if (pendDelete.role === 'owner' && ownerCount <= 1) {
      toast.error('You cannot remove the only owner. Invite another owner first.');
      setPendDelete(null);
      return;
    }
    try { await removeStaffAccount(pendDelete.id); toast.success('Account removed.'); }
    catch (err) { toast.error(friendlyErrorMessage(err)); }
    finally { setPendDelete(null); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Team</h1>
          <p className="text-sm text-ink-400">Manage who has access to this business.</p>
        </div>
        <button className="btn-primary" type="button" onClick={() => { setFreshInvite(null); setNewName(''); setNewRole('cashier'); setModal(true); }}>
          + Invite someone
        </button>
      </div>

      {invites.length > 0 && (
        <div className="card p-4 space-y-2">
          <h2 className="font-display text-sm font-bold text-ink-800">Pending invites</h2>
          <div className="divide-y divide-ink-100">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-800">
                    {inv.displayName}
                    <span className={`badge ml-2 ${inv.role === 'owner' ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-700'}`}>{inv.role}</span>
                  </p>
                  <p className="text-xs text-ink-400 truncate font-mono">{inviteLink(inv.id)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => copyLink(inv.id)}>
                    <Copy className="h-3.5 w-3.5" strokeWidth={1.75} /> Copy link
                  </button>
                  <button className="rounded-lg p-2 text-rust-400 hover:bg-rust-50 min-h-[40px] min-w-[40px] flex items-center justify-center" title="Cancel invite" onClick={() => setPendCancelInvite(inv)}>
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading || invitesLoading ? <LoadingSpinner /> : (
        <div className="card divide-y divide-ink-100">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-800">
                  {u.displayName || u.email?.split('@')[0] || 'Unnamed'}
                  {u.id === profile?.uid && <span className="text-xs font-normal text-ink-400"> (you)</span>}
                </p>
                <p className="text-xs text-ink-400 truncate">{u.email || 'No email'}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`badge ${u.role === 'owner' ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-700'}`}>{u.role || '—'}</span>
                <span className={`badge ${u.active !== false ? 'bg-moss-100 text-moss-700' : 'bg-rust-100 text-rust-700'}`}>{u.active !== false ? 'Active' : 'Deactivated'}</span>
                <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => setPendToggle(u)}>
                  {u.active !== false ? 'Deactivate' : 'Reactivate'}
                </button>
                {u.id === profile?.uid ? (
                  <span className="text-xs text-ink-300 px-2 hidden sm:inline">You</span>
                ) : (
                  <button className="rounded-lg p-2 text-rust-400 hover:bg-rust-50 min-h-[44px] min-w-[44px] flex items-center justify-center" title="Remove account" onClick={() => setPendDelete(u)}>
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={freshInvite ? 'Invite ready' : 'Invite someone'}>
        {!freshInvite ? (
          <form onSubmit={handleCreateInvite} className="space-y-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={newName} onChange={e=>setNewName(e.target.value)} required autoComplete="off" autoFocus />
            </div>
            <div>
              <label className="label">Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setNewRole('cashier')} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${newRole==='cashier'?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>Cashier</button>
                <button type="button" onClick={() => setNewRole('owner')} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${newRole==='owner'?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>Owner</button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create invite'}</button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">Send this link to <span className="font-semibold">{freshInvite.displayName}</span> ({freshInvite.role}).</p>
            <div className="flex items-center gap-2">
              <input className="input font-mono text-xs" readOnly value={inviteLink(freshInvite.id)} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn-outline shrink-0" onClick={() => copyLink(freshInvite.id)}>
                <Copy className="h-4 w-4" strokeWidth={1.75} /> Copy
              </button>
            </div>
            <button type="button" className="btn-primary w-full" onClick={() => setModal(false)}>Done</button>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!pendToggle} title="Change Account Status?" confirmLabel="Confirm" onConfirm={handleToggle} onCancel={() => setPendToggle(null)} />
      <ConfirmDialog open={!!pendDelete} title="Remove Account?" confirmLabel="Remove" danger onConfirm={handleDelete} onCancel={() => setPendDelete(null)} />
      <ConfirmDialog open={!!pendCancelInvite} title="Cancel Invite?" confirmLabel="Cancel" danger onConfirm={handleCancelInvite} onCancel={() => setPendCancelInvite(null)} />
    </div>
  );
}
````

## File: src/utils/businessReset.js
````javascript
import { collection, query, where, getDocs, writeBatch, doc, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';

// FIX: added 'staffInvites' — a Business Reset previously left old
// pending invite links valid indefinitely, even after everything else
// about the business had been wiped.
const RESET_COLLECTIONS = [
  'products', 'sales', 'customers', 'suppliers', 'creditSales', 'expenses',
  'purchases', 'dailySessions', 'repayments', 'supplierPayments',
  'stockAdjustments', 'barcodeIndex', 'productCodeCounters', 'refunds',
  'staffInvites',
];

async function deleteTenantCollection(name, businessId, chunkSize = 400) {
  let totalDeleted = 0;
  while (true) {
    const snap = await getDocs(query(collection(db, name), where('businessId', '==', businessId), limit(chunkSize)));
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    totalDeleted += snap.docs.length;
  }
  return totalDeleted;
}

export async function resetBusinessData(businessId, ownerUid) {
  if (!businessId) throw new Error('resetBusinessData() called with no businessId');
  const results = {};

  for (const name of RESET_COLLECTIONS) {
    results[name] = await deleteTenantCollection(name, businessId);
  }

  await deleteDoc(doc(db, 'businessSettings', businessId));
  results.businessSettings = 1;
  results.performedBy = ownerUid || null;

  return results;
}
````

## File: src/utils/csvExport.js
````javascript
// HP-5: Sanitize CSV cells against formula injection attacks
function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Prefix formula-starting chars with a single quote to neutralise Excel/Sheets macros
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
export function exportToCSV(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => escapeCsvCell(r[h])).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.setAttribute('download', filename);
  document.body.appendChild(link); link.click();
  document.body.removeChild(link); URL.revokeObjectURL(url);
}
````

## File: src/utils/currency.js
````javascript
export function formatKES(amount) {
  const v = Number(amount) || 0;
  return `KES ${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function formatKESCompact(amount) {
  return `KES ${Math.round(Number(amount) || 0).toLocaleString('en-KE')}`;
}
````

## File: src/utils/dateRanges.js
````javascript
// Africa/Nairobi is a fixed UTC+3 with no DST, so business-day boundaries
// can be computed with a constant offset instead of the device's own
// (potentially different) local timezone. This keeps "today" consistent
// with todayKey() below, which drives dailySessions doc IDs.
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

export function startOfDay(date = new Date()) {
  const nairobiMs = date.getTime() + NAIROBI_OFFSET_MS;
  const nairobiMidnightMs = Math.floor(nairobiMs / 86400000) * 86400000;
  return new Date(nairobiMidnightMs - NAIROBI_OFFSET_MS);
}
export function endOfDay(date = new Date()) {
  return new Date(startOfDay(date).getTime() + 86400000 - 1);
}
export function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  const nairobiDate = new Date(d.getTime() + NAIROBI_OFFSET_MS);
  const dayOfWeek = nairobiDate.getUTCDay();
  const diff = (dayOfWeek + 6) % 7;
  return new Date(d.getTime() - diff * 86400000);
}
export function startOfMonth(date = new Date()) {
  const nairobiMs = date.getTime() + NAIROBI_OFFSET_MS;
  const nairobiDate = new Date(nairobiMs);
  const firstOfMonthUTC = Date.UTC(nairobiDate.getUTCFullYear(), nairobiDate.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(firstOfMonthUTC - NAIROBI_OFFSET_MS);
}
export function getRangeForPreset(preset) {
  const now = new Date();
  switch (preset) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':  return { start: startOfWeek(now), end: endOfDay(now) };
    case 'month': return { start: startOfMonth(now), end: endOfDay(now) };
    default:      return { start: startOfDay(now), end: endOfDay(now) };
  }
}
export function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}
export function formatDateTime(value) {
  const d = toJsDate(value);
  if (!d) return '—';
  return d.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function formatDate(value) {
  const d = toJsDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short', year: 'numeric' });
}
export function todayKey(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = f.formatToParts(date);
  return `${p.find(x=>x.type==='year').value}-${p.find(x=>x.type==='month').value}-${p.find(x=>x.type==='day').value}`;
}

// ── Added for the Advanced Analytics redesign ──────────────────────────
// Nothing above this line changed. These two helpers are additive only.

// Converts a Firestore Timestamp, JS Date, or date-like value to millis —
// used to sort/bucket raw records (sales, expenses, repayments) by day.
export function toMillisValue(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// Splits [start, end] into consecutive day or week buckets with a short
// display label — used to build trend charts from raw record arrays
// without inventing any data the app doesn't already have.
export function buildDateBuckets(start, end, granularity = 'day') {
  const buckets = [];
  const stepMs = granularity === 'week' ? 7 * 86400000 : 86400000;
  let cursor = startOfDay(start);
  const endBoundary = endOfDay(end);
  while (cursor.getTime() <= endBoundary.getTime()) {
    const bucketEndMs = Math.min(cursor.getTime() + stepMs - 1, endBoundary.getTime());
    const bucketEnd = new Date(bucketEndMs);
    buckets.push({
      start: cursor,
      end: bucketEnd,
      label: cursor.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short' }),
    });
    cursor = new Date(cursor.getTime() + stepMs);
  }
  return buckets;
}
````

## File: src/utils/financials.js
````javascript
function sumBy(rows, field) {
  return rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
}

function getCostOfSale(row) {
  const costPerUnit = Number(row?.costPricePerUnit) || 0;
  const quantity = Number(row?.quantity) || 0;
  return costPerUnit * quantity;
}

export function isExpenseExcluded(expense) {
  const category = String(expense?.category || '').toLowerCase();
  const description = String(expense?.description || '').toLowerCase();
  return category === 'stock purchase' || category === 'supplier payment' || description.includes('stock purchase') || description.includes('supplier payment');
}

// A credit sale that was cancelled (nothing was ever paid on it) or
// refunded (goods returned, whatever was paid handed back) no longer
// represents real business — it must not contribute to Outstanding Debt
// or the Credit Sales metric. Same precedent as `isVoided` on cash sales.
function isCreditSaleReversed(creditSale) {
  return creditSale?.status === 'cancelled' || creditSale?.status === 'refunded';
}

// HYBRID MODEL (FINAL business decision): a credit sale is NOT realized
// revenue until the customer actually pays. The moment a credit sale is
// recorded, Inventory Value drops and Outstanding Debt / Credit Sales
// rise — but Revenue, COGS, and Profit all stay at ZERO for that sale.
// Only a Debt Repayment converts a portion of it into Revenue, COGS, and
// Profit — proportional to how much of THAT specific credit sale has
// just been collected. `creditSaleById` must be built from the FULL,
// all-time credit sales list (not just the reporting period's), because
// a repayment can land in a different period than the original sale.
function recognizeRepayment(repayment, creditSaleById) {
  const amount = Number(repayment?.amount) || 0;
  const creditSale = creditSaleById.get(repayment?.creditSaleId);
  if (!creditSale) {
    // Originating credit sale not found (shouldn't normally happen) —
    // recognize the cash as revenue with no cost basis rather than
    // silently dropping it from the books.
    return { revenue: amount, cogs: 0 };
  }
  const totalAmount = Number(creditSale.totalAmount) || 0;
  const totalCost = getCostOfSale(creditSale);
  const ratio = totalAmount > 0 ? amount / totalAmount : 0;
  const cogs = totalCost * ratio;
  return { revenue: amount, cogs };
}

export function computeFinancials({
  sales = [],
  creditSales = [],
  allCreditSales = null,
  expenses = [],
  debtRepayments = [],
  purchases = [],
  supplierPayments = [],
  refunds = [],
} = {}) {
  const activeSales = (sales || []).filter((sale) => !sale?.isVoided);
  const activeCreditSales = (creditSales || []).filter((cs) => !isCreditSaleReversed(cs));

  const cashSales  = activeSales.filter(s => s.paymentMethod === 'Cash');
  const mpesaSales = activeSales.filter(s => s.paymentMethod === 'M-Pesa');
  const totalCashSales  = sumBy(cashSales,  'totalAmount');
  const totalMpesaSales = sumBy(mpesaSales, 'totalAmount');

  // "Credit Sales" is a business-activity metric — total value of goods
  // sold on credit this period. It intentionally does NOT feed into
  // Revenue / COGS / Profit below (see recognizeRepayment()). This is the
  // core of the FINAL decision: the owner should never see profit that
  // has not yet been collected.
  const totalCreditSales = sumBy(activeCreditSales, 'totalAmount');

  const cashRepayments  = debtRepayments.filter(r => r.method === 'Cash');
  const mpesaRepayments = debtRepayments.filter(r => r.method === 'M-Pesa');
  const totalDebtRepaymentsCash  = sumBy(cashRepayments,  'amount');
  const totalDebtRepaymentsMpesa = sumBy(mpesaRepayments, 'amount');
  const totalDebtRepayments = totalDebtRepaymentsCash + totalDebtRepaymentsMpesa;

  // Lookup of EVERY credit sale (not just this period's) so a repayment
  // can find its cost basis even when the sale happened earlier. Falls
  // back to the period-scoped `creditSales` if the caller didn't supply
  // the full list.
  const creditSaleSource = allCreditSales || creditSales || [];
  const creditSaleById = new Map(creditSaleSource.map((cs) => [cs.id, cs]));

  let repaymentRevenue = 0;
  let repaymentCogs = 0;
  (debtRepayments || []).forEach((r) => {
    const { revenue, cogs } = recognizeRepayment(r, creditSaleById);
    repaymentRevenue += revenue;
    repaymentCogs += cogs;
  });

  // Direct (cash/M-Pesa) sales realize revenue and COGS the instant they
  // happen. Credit sales contribute ZERO here directly — only the
  // repaymentRevenue / repaymentCogs recognized above, at the moment the
  // customer actually pays.
  const directSalesCostOfGoodsSold = activeSales.reduce((acc, s) => acc + getCostOfSale(s), 0);
  const costOfGoodsSold = directSalesCostOfGoodsSold + repaymentCogs;

  // "Gross sales revenue" — total value of everything SOLD this period
  // regardless of payment method. Informational only (Sales Summary) —
  // it is NOT used for profit. See `revenue` below.
  const grossSalesRevenue = totalCashSales + totalMpesaSales + totalCreditSales;

  // Realized revenue — what actually counts toward profit, per the FINAL
  // business decision: cash + M-Pesa sales, plus whatever portion of
  // credit sales (from any period) was actually collected this period.
  const revenue = totalCashSales + totalMpesaSales + repaymentRevenue;
  const grossProfit = revenue - costOfGoodsSold;

  const filteredExpenses = (expenses || []).filter((expense) => !isExpenseExcluded(expense));
  const cashExpenses  = filteredExpenses.filter(e => e.paymentMethod === 'Cash');
  const mpesaExpenses = filteredExpenses.filter(e => e.paymentMethod === 'M-Pesa');
  const totalExpensesCash  = sumBy(cashExpenses,  'amount');
  const totalExpensesMpesa = sumBy(mpesaExpenses, 'amount');
  const totalExpenses = totalExpensesCash + totalExpensesMpesa;
  const netProfit     = grossProfit - totalExpenses;

  // CASH POSITION: strictly real money movement, independent of the
  // revenue-recognition timing above. This is what Cash Received Today /
  // M-Pesa Received Today and the Close Day till reconciliation rely on.
  const totalCashReceipts  = totalCashSales  + totalDebtRepaymentsCash;
  const totalMpesaReceipts = totalMpesaSales + totalDebtRepaymentsMpesa;

  const cashRefunds  = (refunds || []).filter(r => r.method === 'Cash');
  const mpesaRefunds = (refunds || []).filter(r => r.method === 'M-Pesa');
  const totalRefundsCash  = sumBy(cashRefunds,  'amount');
  const totalRefundsMpesa = sumBy(mpesaRefunds, 'amount');
  const totalRefunds = totalRefundsCash + totalRefundsMpesa;

  const purchasePaymentsCash  = (purchases || []).filter((p) => p.paymentStatus === 'paid' && p.paymentMethod === 'Cash');
  const purchasePaymentsMpesa = (purchases || []).filter((p) => p.paymentStatus === 'paid' && p.paymentMethod === 'M-Pesa');
  const supplierPaymentsCash  = (supplierPayments || []).filter((p) => p.method === 'Cash');
  const supplierPaymentsMpesa = (supplierPayments || []).filter((p) => p.method === 'M-Pesa');
  // Refunds are cash/M-Pesa leaving the till, just like an expense or a
  // supplier payment — folded into the same outflow totals so Close Day's
  // till reconciliation stays correct without any formula change there.
  const totalCashOutflows  = sumBy(purchasePaymentsCash,  'totalCost') + sumBy(supplierPaymentsCash,  'amount') + totalRefundsCash;
  const totalMpesaOutflows = sumBy(purchasePaymentsMpesa, 'totalCost') + sumBy(supplierPaymentsMpesa, 'amount') + totalRefundsMpesa;

  return {
    grossSalesRevenue, totalCashSales, totalMpesaSales, totalCreditSales,
    revenue, costOfGoodsSold, grossProfit,
    totalCashReceipts, totalMpesaReceipts,
    totalDebtRepaymentsCash, totalDebtRepaymentsMpesa, totalDebtRepayments,
    totalExpensesCash, totalExpensesMpesa, totalExpenses, netProfit,
    totalRefundsCash, totalRefundsMpesa, totalRefunds,
    totalCashOutflows, totalMpesaOutflows,
  };
}

export function computeExpectedTillBalances({
  openingCashFloat = 0, openingMpesaFloat = 0,
  totalCashSales = 0, totalMpesaSales = 0,
  totalDebtRepaymentsCash = 0, totalDebtRepaymentsMpesa = 0,
  totalExpensesCash = 0, totalExpensesMpesa = 0,
  totalCashOutflows = 0, totalMpesaOutflows = 0,
}) {
  return {
    expectedCashAtClose:  Number(openingCashFloat)  + totalCashSales  + totalDebtRepaymentsCash  - totalExpensesCash - totalCashOutflows,
    expectedMpesaAtClose: Number(openingMpesaFloat) + totalMpesaSales + totalDebtRepaymentsMpesa - totalExpensesMpesa - totalMpesaOutflows,
  };
}

export function computeSupplierBalances(purchases = [], supplierPayments = [], suppliers = []) {
  const balanceById = {};

  (purchases || []).forEach((p) => {
    if (p?.paymentStatus !== 'pending_supplier_credit' || !p?.supplierId) return;
    balanceById[p.supplierId] = (balanceById[p.supplierId] || 0) + (Number(p.totalCost) || 0);
  });

  (supplierPayments || []).forEach((sp) => {
    if (!sp?.supplierId || balanceById[sp.supplierId] === undefined) return;
    balanceById[sp.supplierId] -= Number(sp.amount) || 0;
  });

  const nameById = {};
  (suppliers || []).forEach((s) => { nameById[s.id] = s.name; });

  return Object.entries(balanceById)
    .filter(([, balance]) => (Number(balance) || 0) > 0.005)
    .map(([supplierId, balance]) => ({
      supplierId,
      supplierName:
        nameById[supplierId] ||
        (purchases || []).find((p) => p.supplierId === supplierId)?.supplierName ||
        'Unknown supplier',
      balance,
    }))
    .sort((a, b) => b.balance - a.balance);
}
````

## File: src/utils/financials.test.js
````javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFinancials } from './financials.js';

test('a credit sale alone contributes zero revenue, COGS, and profit until repaid', () => {
  const creditSale = { id: 'c1', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'pending', amountPaid: 0 };
  const summary = computeFinancials({
    sales: [],
    creditSales: [creditSale],
    allCreditSales: [creditSale],
    expenses: [],
    debtRepayments: [],
  });

  assert.equal(summary.totalCreditSales, 15000); // still tracked as business activity
  assert.equal(summary.revenue, 0);
  assert.equal(summary.costOfGoodsSold, 0);
  assert.equal(summary.grossProfit, 0);
  assert.equal(summary.netProfit, 0);
  assert.equal(summary.totalCashReceipts, 0);
  assert.equal(summary.totalMpesaReceipts, 0);
});

test('a full debt repayment recognizes the full sale as revenue, COGS, and profit', () => {
  const creditSale = { id: 'c1', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'paid', amountPaid: 15000 };
  const summary = computeFinancials({
    sales: [],
    creditSales: [],
    allCreditSales: [creditSale],
    expenses: [],
    debtRepayments: [{ id: 'r1', creditSaleId: 'c1', amount: 15000, method: 'Cash' }],
  });

  assert.equal(summary.revenue, 15000);
  assert.equal(summary.costOfGoodsSold, 10000);
  assert.equal(summary.grossProfit, 5000);
  assert.equal(summary.netProfit, 5000);
  assert.equal(summary.totalCashReceipts, 15000);
});

test('a partial debt repayment recognizes revenue, COGS, and profit proportionally', () => {
  const creditSale = { id: 'c1', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'partial', amountPaid: 5000 };
  const summary = computeFinancials({
    sales: [],
    creditSales: [],
    allCreditSales: [creditSale],
    expenses: [],
    debtRepayments: [{ id: 'r1', creditSaleId: 'c1', amount: 5000, method: 'Cash' }],
  });

  // 5000 / 15000 of the sale collected so far → 1/3 of its cost basis
  assert.equal(summary.revenue, 5000);
  assert.ok(Math.abs(summary.costOfGoodsSold - 10000 / 3) < 0.01);
  assert.ok(Math.abs(summary.netProfit - (5000 - 10000 / 3)) < 0.01);
});

test('a repayment on a credit sale from an earlier period still finds its cost basis', () => {
  // Simulates: sale happened last month (not in `creditSales`, which is
  // period-scoped), repayment happens today. `allCreditSales` is what
  // makes the lookup work regardless of period.
  const creditSale = { id: 'c1', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'paid', amountPaid: 15000 };
  const summary = computeFinancials({
    sales: [],
    creditSales: [], // not sold this period
    allCreditSales: [creditSale],
    expenses: [],
    debtRepayments: [{ id: 'r1', creditSaleId: 'c1', amount: 15000, method: 'M-Pesa' }],
  });

  assert.equal(summary.revenue, 15000);
  assert.equal(summary.costOfGoodsSold, 10000);
  assert.equal(summary.netProfit, 5000);
});

test('cancelled and refunded credit sales are excluded from the Credit Sales metric', () => {
  const summary = computeFinancials({
    sales: [],
    creditSales: [
      { id: 'c1', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'cancelled' },
      { id: 'c2', costPricePerUnit: 10000, quantity: 1, totalAmount: 15000, status: 'refunded' },
    ],
    expenses: [],
    debtRepayments: [],
  });

  assert.equal(summary.totalCreditSales, 0);
  assert.equal(summary.revenue, 0);
  assert.equal(summary.netProfit, 0);
});

test('refunds reduce expected cash/M-Pesa till balance, same as any other outflow', () => {
  const summary = computeFinancials({
    sales: [], creditSales: [], expenses: [], debtRepayments: [],
    refunds: [{ amount: 2000, method: 'Cash' }],
  });

  assert.equal(summary.totalRefundsCash, 2000);
  assert.equal(summary.totalCashOutflows, 2000);
});

test('voided sales do not affect cash sales or profit', () => {
  const summary = computeFinancials({
    sales: [{ id: 's1', paymentMethod: 'Cash', totalAmount: 15000, costPricePerUnit: 10000, quantity: 1, isVoided: true }],
    creditSales: [],
    expenses: [],
    debtRepayments: [],
  });

  assert.equal(summary.totalCashSales, 0);
  assert.equal(summary.netProfit, 0);
});

test('purchase and supplier payments only affect outflows, not profit', () => {
  const summary = computeFinancials({
    sales: [],
    creditSales: [],
    expenses: [{ amount: 50000, paymentMethod: 'Cash', category: 'Stock Purchase' }],
    debtRepayments: [],
    purchases: [{ paymentStatus: 'paid', paymentMethod: 'Cash', totalCost: 50000 }],
    supplierPayments: [{ method: 'Cash', amount: 50000 }],
  });

  assert.equal(summary.totalExpenses, 0);
  assert.equal(summary.netProfit, 0);
  assert.equal(summary.totalCashOutflows, 100000);
});
````

## File: src/utils/products.js
````javascript
import { collection, doc, writeBatch, updateDoc, deleteField, serverTimestamp, getDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export async function permanentlyDeleteProduct(productId, barcode, businessId) {
  if (!businessId) throw new Error('permanentlyDeleteProduct() called with no businessId');
  const productRef = doc(db, 'products', productId);
  const trimmedBarcode = barcode ? String(barcode).trim() : null;

  const batch = writeBatch(db);
  if (trimmedBarcode) {
    const idxRef = barcodeIndexRef(businessId, trimmedBarcode);
    const idxSnap = await getDoc(idxRef);
    if (idxSnap.exists() && idxSnap.data().productId === productId) {
      batch.delete(idxRef);
    }
  }
  batch.delete(productRef);
  await batch.commit();
}

export async function cleanupOrphanedBarcodeIndexes(businessId) {
  if (!businessId) throw new Error('cleanupOrphanedBarcodeIndexes() called with no businessId');
  const snap = await getDocs(query(collection(db, 'barcodeIndex'), where('businessId', '==', businessId)));
  let removed = 0;
  for (const idxDoc of snap.docs) {
    const { productId } = idxDoc.data();
    if (!productId) continue;
    const productSnap = await getDoc(doc(db, 'products', productId));
    if (!productSnap.exists()) {
      await deleteDoc(idxDoc.ref);
      removed += 1;
    }
  }
  return { scanned: snap.docs.length, removed };
}

function barcodeIndexRef(businessId, barcode) {
  return doc(db, 'barcodeIndex', `${businessId}__${barcode}`);
}

// FIX: Offline-safe product creation using writeBatch and generated internalCode
export async function createProduct(data, businessId) {
  if (!businessId) throw new Error('createProduct() called with no businessId');
  const barcode = data.barcode ? String(data.barcode).trim() : null;
  const newProductRef = doc(collection(db, 'products'));

  // Offline-safe code generation
  const internalCode = `FB-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;
  
  const batch = writeBatch(db);
  batch.set(newProductRef, {
    ...data,
    businessId,
    barcode: barcode || null,
    internalCode,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (barcode) {
    batch.set(barcodeIndexRef(businessId, barcode), { businessId, barcode, productId: newProductRef.id });
  }
  await batch.commit();

  return { id: newProductRef.id };
}

export async function updateProduct(productId, data, previousBarcode, businessId) {
  if (!businessId) throw new Error('updateProduct() called with no businessId');
  const nextBarcode = data.barcode ? String(data.barcode).trim() : null;
  const prevBarcode = previousBarcode ? String(previousBarcode).trim() : null;
  const productRef = doc(db, 'products', productId);

  const { stock, businessId: _ignored, ...updatePayload } = data;

  const batch = writeBatch(db);
  batch.update(productRef, { ...updatePayload, barcode: nextBarcode || null, updatedAt: serverTimestamp() });
  
  if (prevBarcode && prevBarcode !== nextBarcode) {
    batch.delete(barcodeIndexRef(businessId, prevBarcode));
  }
  if (nextBarcode && nextBarcode !== prevBarcode) {
    batch.set(barcodeIndexRef(businessId, nextBarcode), { businessId, barcode: nextBarcode, productId });
  }
  await batch.commit();
}

export async function softDeleteProduct(productId) {
  await updateDoc(doc(db, 'products', productId), { deleted: true, deletedAt: serverTimestamp() });
}

export async function restoreProduct(productId) {
  await updateDoc(doc(db, 'products', productId), { deleted: false, deletedAt: deleteField() });
}
````

## File: src/utils/scannerService.js
````javascript
// src/utils/scannerService.js
//
// Central place all code-matching logic lives, so camera scans, hardware
// scanner input, and manual search-box typing all resolve to the exact
// same product via the exact same rule. Nothing about sales, purchases,
// or stock take needed to change — this just answers "what product is
// this code?" and hands the answer to whichever existing workflow asked.

export function normalizeCode(raw) {
  return String(raw || '').trim();
}

// Matches a scanned/typed code against a product's manufacturer barcode
// OR its internal FlowBiz code (FB-000001). Barcode match is exact
// (manufacturer barcodes are numeric strings); internal code match is
// case-insensitive (FB-000001 vs fb-000001 should both work when typed).
export function findProductByCode(products, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const lower = code.toLowerCase();
  return (
    (products || []).find(
      (p) =>
        (p.barcode && p.barcode === code) ||
        (p.internalCode && p.internalCode.toLowerCase() === lower)
    ) || null
  );
}

// FUTURE-READY: additional scan payload "kinds" (a QR code pointing at a
// product some other way, a warehouse location label, a price label) can
// be added here as their own small resolver, dispatched on a `kind` field
// embedded in the scanned payload — without ScannerModal or any page that
// uses it needing to change. Today every scan is just a product code.
export function parseScanPayload(rawText) {
  return { kind: 'product-code', code: normalizeCode(rawText) };
}
````

## File: src/App.jsx
````javascript
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import AppRouter from './router/AppRouter';
import ErrorBoundary from './components/common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { fontSize: '14px', borderRadius: '10px', maxWidth: '90vw' },
            success: { iconTheme: { primary: '#1a623c', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#c4441d', secondary: '#fff' } },
            duration: 3000,
          }}
        />
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
````

## File: src/firebase.js
````javascript
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  // FIX: some ad blockers, privacy extensions, and corporate/school
  // network proxies block Firestore's WebChannel long-polling transport
  // (visible in DevTools as ERR_BLOCKED_BY_CLIENT on requests to
  // firestore.googleapis.com). Auto-detecting long polling makes the SDK
  // negotiate whichever transport actually gets through in the current
  // network environment instead of always assuming the fastest one will.
  experimentalAutoDetectLongPolling: true,
});

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export default app;
````

## File: src/main.jsx
````javascript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { enterDemoMode, exitDemoMode } from './demo/demoMode';
import { seedDemoDataIfNeeded } from './demo/seedData';

// `import.meta.env.MODE` is 'demo' only when started via `npm run dev:demo`
// (vite --mode demo). The actual Firebase-vs-local-storage routing is
// decided at build time by vite.config.js's module aliasing — this block
// just does the two things that still need to happen at runtime once we
// know we're in Demo Mode:
//
//  1. Seed realistic sample data on first load (no-ops on later loads —
//     see seedDemoDataIfNeeded's own localStorage check).
//  2. Flip the flag in src/demo/demoMode.js, so the parts of the UI that
//     need to know "are we in Demo Mode?" for display purposes only (the
//     Demo badge in TopHeader, choosing which Business Reset to run in
//     Settings) read it correctly. This flag has NO bearing on whether
//     Firebase is actually used — that's the aliasing above — it's purely
//     cosmetic/UI state.
//
// The `else` branch matters too: without it, a browser that previously ran
// `npm run dev:demo` would keep the demo flag set to true even after
// switching back to `npm run dev`, incorrectly showing the Demo badge (and
// routing Settings' Business Reset to the wrong implementation) in
// Production Mode.
if (import.meta.env.MODE === 'demo') {
  enterDemoMode();
  seedDemoDataIfNeeded();
} else {
  exitDemoMode();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
````

## File: .env.example
````
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
````

## File: .firebaserc
````
{
  "projects": {
    "default": "swiftstock-bc6a3"
  }
}
````

## File: .gitignore
````
node_modules
dist
dist-ssr
*.local
.env
.env.local
.DS_Store
````

## File: .nvmrc
````
20
````

## File: .pagesignore
````
cloudflare-worker/
````

## File: eslint.config.js
````javascript
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
]);
````

## File: firebase.json
````json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log"
      ]
    }
  ],
  "emulators": {
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8080
    },
    "functions": {
      "port": 5001
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
````

## File: firestore.rules
````
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ─────────────────────────────────────────────────────────
    function isSignedIn() { return request.auth != null; }

    function hasProfile() {
      return isSignedIn() && exists(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function myProfile() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isActive() {
      let data = myProfile();
      return !('active' in data) || data.active != false;
    }

    function isStaff() {
      return hasProfile() && isActive();
    }

    function myBusinessId() {
      return myProfile().businessId;
    }

    function isOwner() {
      return isStaff() && myProfile().role == 'owner';
    }

    function owns(data) {
      return isStaff() && data.businessId == myBusinessId();
    }

    function ownsUpdate(existing, incoming) {
      return owns(existing) && owns(incoming);
    }

    // SECURITY FIX — Path B of the users/{userId} create rule below.
    // Binds a new staff account to exactly one real, currently-unclaimed
    // invite whose businessId/role match what's being written. Reads the
    // invite ONCE (not three separate get() calls) and checks it against
    // JoinStaff.jsx's real, non-transactional write order — the invite's
    // `claimed` flag is still false at the moment users/{uid} is created,
    // since JoinStaff.jsx only marks it claimed in a SEPARATE call after.
    function isValidInviteClaim(inviteId, businessId, role) {
      let invite = get(/databases/$(database)/documents/staffInvites/$(inviteId)).data;
      return invite.claimed == false && invite.businessId == businessId && invite.role == role;
    }

    // ── Businesses ──────────────────────────────────────────────────────
    match /businesses/{businessId} {
      allow get: if isStaff() && myBusinessId() == businessId;
      allow create: if isSignedIn();
      allow update: if isOwner() && myBusinessId() == businessId
                    && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['subscription']);
      allow delete: if false;
    }

    match /barcodeIndex/{docId} {
      allow read: if isOwner() && owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
      allow update: if false;
    }
    match /productCodeCounters/{businessId} {
      allow read, write: if isOwner() && myBusinessId() == businessId;
    }

    match /businessSettings/{businessId} {
      allow get: if isStaff() && myBusinessId() == businessId;
      allow write: if isOwner() && myBusinessId() == businessId;
    }

    // ── Users & invites ─────────────────────────────────────────────────
    match /users/{userId} {
      allow get: if isSignedIn() && request.auth.uid == userId;
      allow list: if isOwner() && resource.data.businessId == myBusinessId();

      // SECURITY FIX (CRITICAL): the previous rule only checked
      // `role in ['owner','cashier']` — it never verified businessId
      // actually belonged to a business this request was entitled to,
      // letting any signed-in user grant themselves owner/cashier access
      // to ANY existing business by writing this doc directly. Now there
      // are exactly two provable paths, matching the app's two real
      // write flows:
      allow create: if isSignedIn() && request.auth.uid == userId
                    && request.resource.data.role in ['owner', 'cashier']
                    && (
                      // Path A — Setup.jsx: bootstrapping a BRAND NEW
                      // business. Proven within the SAME transaction:
                      // the business doc did not exist before this write,
                      // and after the transaction commits it exists with
                      // createdBy == this exact uid. Owner-only, matching
                      // Setup.jsx (it never creates a cashier).
                      (
                        request.resource.data.role == 'owner'
                        && !exists(/databases/$(database)/documents/businesses/$(request.resource.data.businessId))
                        && getAfter(/databases/$(database)/documents/businesses/$(request.resource.data.businessId)).data.createdBy == request.auth.uid
                      )
                      ||
                      // Path B — JoinStaff.jsx: claiming a real,
                      // unclaimed invite. The client must now record
                      // WHICH invite it's claiming (claimedFromInviteId),
                      // and that invite must currently be unclaimed and
                      // match the businessId/role being written.
                      (
                        request.resource.data.claimedFromInviteId is string
                        && isValidInviteClaim(request.resource.data.claimedFromInviteId, request.resource.data.businessId, request.resource.data.role)
                      )
                    );
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data) && userId != request.auth.uid;
    }

    match /staffInvites/{inviteId} {
      allow get: if true;
      allow list: if isOwner() && resource.data.businessId == myBusinessId();
      allow create: if isOwner() && request.resource.data.businessId == myBusinessId()
                    && request.resource.data.role in ['owner', 'cashier'];
      allow update: if isSignedIn()
                    && resource.data.claimed == false
                    && request.resource.data.claimed == true
                    && request.resource.data.linkedUid == request.auth.uid
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['claimed', 'linkedUid', 'claimedAt']);
      allow delete: if isOwner() && resource.data.businessId == myBusinessId();
    }

    // ── Device sessions (Settings > Device Management) ────────────────
    match /sessions/{sessionId} {
      // SECURITY FIX: businessId is now required to match the caller's
      // ACTUAL business — previously unchecked, letting a real staff
      // member of one business inject a session doc that shows up in a
      // DIFFERENT business's Device Management list.
      allow create: if isStaff() && request.resource.data.uid == request.auth.uid && request.resource.data.businessId == myBusinessId();

      allow read: if isSignedIn() && (resource.data.uid == request.auth.uid || (isStaff() && resource.data.businessId == myBusinessId()));

      // SECURITY FIX: field-level split, replacing the old rule which let
      // a device (or an owner) touch ANY field on an update, including
      // uid/businessId (spoofing, same class as create above) and,
      // critically, `revoked` — which previously let a device's own
      // routine heartbeat write (AuthContext's registerSession(), which
      // unconditionally resends revoked:false on every profile load)
      // silently un-revoke itself the next time it came online, defeating
      // the whole point of Device Management.
      //   - A device updating its OWN session may only touch heartbeat
      //     fields (lastActiveAt/deviceLabel/userAgent) — never uid,
      //     businessId, or revoked.
      //   - Only an OWNER of the matching business may flip `revoked`,
      //     and only that single field.
      allow update: if isSignedIn() && (
        (resource.data.uid == request.auth.uid
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastActiveAt', 'deviceLabel', 'userAgent']))
        ||
        (isOwner() && resource.data.businessId == myBusinessId()
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['revoked']))
      );
      allow delete: if false;
    }

    // ── Business data ───────────────────────────────────────────────────
    match /products/{id} {
      allow read: if owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow update: if ownsUpdate(resource.data, request.resource.data) && (
        isOwner() ||
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['stock', 'updatedAt'])
      );
      allow delete: if isOwner() && owns(resource.data);
    }

    match /suppliers/{id} {
      allow read: if owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /sales/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /customers/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /creditSales/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /repayments/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /refunds/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /expenses/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /purchases/{id} {
      allow read: if owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /supplierPayments/{id} {
      allow read: if owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /stockAdjustments/{id} {
      allow read: if owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /dailySessions/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }
  }
}
````

## File: index.html
````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
    <link rel="apple-touch-icon" href="/icons/icon-180.png" />
    <!-- PWA meta tags -->
    <meta name="application-name" content="FlowBiz" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="FlowBiz" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#1a623c" />
    <!-- Viewport: cover ensures notch areas are used. PRIORITY 4 FIX: locked
         zoom (maximum-scale=1.0, user-scalable=no) for dedicated
         business-device usage — note this does reduce accessibility for
         anyone who relies on pinch-zoom to read small text. -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="description" content="POS and inventory management for Kenyan businesses" />
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="preconnect" href="https://firestore.googleapis.com" crossorigin />
    <link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossorigin />
    <link rel="preconnect" href="https://securetoken.googleapis.com" crossorigin />
    <title>FlowBiz | Business Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
    <script src="https://js.paystack.co/v2/inline.js"></script>
  </body>
</html>
````

## File: package.json
````json
{
  "name": "flowbiz",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:demo": "vite --mode demo",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@zxing/browser": "^0.2.1",
    "@zxing/library": "^0.23.0",
    "firebase": "^12.15.0",
    "jspdf": "^2.5.1",
    "lucide-react": "^1.22.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-hot-toast": "^2.4.1",
    "react-router-dom": "^6.30.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.2",
    "autoprefixer": "^10.4.20",
    "eslint": "^10.5.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.3",
    "globals": "^17.6.0",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "vite": "^8.1.0",
    "vite-plugin-pwa": "^1.3.0"
  }
}
````

## File: postcss.config.js
````javascript
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
````

## File: README.md
````markdown
# FlowBiz — Business Manager

Production-ready POS and business management app for Kenyan SMBs.

## Setup

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # fill in your Firebase config
npm run dev
```

## Deployment

```bash
npm run build
# Deploy dist/ to Vercel, Netlify, or Firebase Hosting
# firebase deploy --only hosting
```

## First-time Firebase setup

1. Create a Firebase project, enable **Authentication → Email/Password** and **Firestore**
2. Paste the Firestore security rules from `src/firebase.js` into **Console → Firestore → Rules**
3. Create your owner account in Firebase Console (Auth → Add user), then sign in — first account auto-bootstraps as Admin
4. Create the Firestore composite indexes listed in `src/firebase.js` (or let the app prompt you via console links)

## PWA Installation (Chrome)

1. Open the deployed app in Chrome on Android or desktop
2. Chrome shows "Add to Home Screen" banner, or tap **⋮ → Install app**
3. iOS Safari: tap Share → Add to Home Screen

## Fixes applied (v2.0 — full audit pass)

| ID   | Fix |
|------|-----|
| CR-1 | DebtorDetail missing profile + serverTimestamp imports |
| CR-2 | Repayment history reads from `repayments` collection (not stale embedded array) |
| CR-3 | SaleModal missing toast import |
| CR-4 | Reports missing ErrorBanner import |
| CR-5 | Login navigation moved into useEffect (no render-time side effects) |
| CR-6 | Till reconciliation correctly includes debt repayments in expected balances |
| CR-7 | M-Pesa transaction code enforced in sale canSubmit check |
| CR-8 | All POS writes use writeBatch + increment() — offline-first, no runTransaction |
| CR-9 | Staff creation writes profile BEFORE signing admin out |
| HP-1 | limit() added to unbounded queries |
| HP-2 | useFinancialsForRange debounced with requestAnimationFrame — 1 render per write |
| HP-3 | StockTake reads fresh stock inside transaction (no stale-read bugs) |
| HP-4 | Product performance includes credit sales |
| HP-5 | CSV export sanitised against formula injection (=, +, -, @) |
| HP-6 | Users page password input masked (type="password") |
| HP-7 | CloseDay batch deletion chunked at 400 ops; window.location.reload() removed |
| HP-8 | Dashboard "today" range recalculated at midnight via setTimeout |
| HP-9 | ErrorBoundary wraps entire app |
| MP-1 | Modal + ConfirmDialog close on ESC key |
| MP-4 | ProductFormModal validates negative prices and selling below cost |
| MP-5 | Suppliers payment blocked if amount exceeds outstanding balance |
| MP-6 | RepaymentModal blocks over-repayment |
| MP-7 | Bootstrap profile avoids serverTimestamp() sentinel in React state |
| MP-8 | StockTake empty physical count treated as unchanged (not zero) |
| MP-10| All routes lazy-loaded (React.lazy + Suspense) |
| MP-11| useDailySession uses onSnapshot for cross-device real-time updates |

## Firestore composite indexes required

| Collection  | Fields              |
|-------------|---------------------|
| sales       | soldAt              |
| creditSales | soldAt              |
| creditSales | customerId + soldAt |
| expenses    | recordedAt          |
| repayments  | paidAt              |
| repayments  | customerId + paidAt |

Run the app once — Firestore prints console errors with direct auto-create links.
````

## File: skills-lock.json
````json
{
  "version": 1,
  "skills": {
    "extension-to-functions-codebase": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/extension-to-functions-codebase/SKILL.md",
      "computedHash": "4597667cb7548b9906708ff0e5fdc1043a59119d2cb32cba1142c03e8a85f315"
    },
    "firebase-ai-logic-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-ai-logic-basics/SKILL.md",
      "computedHash": "2af723026c6cb09aeedd6d0578421b5f25cd410c72a4e5135b4b174451a5eee9"
    },
    "firebase-app-hosting-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-app-hosting-basics/SKILL.md",
      "computedHash": "e32ac489690e6c04bf6a71ce965918fe65a192e9992e6ed887c572d7733621c2"
    },
    "firebase-auth-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-auth-basics/SKILL.md",
      "computedHash": "25070123c29d59098ac817dee0eee36a73b4a822e6bb925a0ebccab0c78cf1e9"
    },
    "firebase-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-basics/SKILL.md",
      "computedHash": "3a41bf302bfce4dac272575c51a02d0fc1bdac8dcb6cb5496103301b68ffbb67"
    },
    "firebase-crashlytics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-crashlytics/SKILL.md",
      "computedHash": "1316a59236b4e2317e1d265df80e2c6c112e855bc15404ade19f2a2fe9cf2502"
    },
    "firebase-data-connect": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-data-connect-basics/SKILL.md",
      "computedHash": "e4108a3f77cda0a3cd1f883f8f8f1836f7c88af8baaf62875ef5460456aec3a1"
    },
    "firebase-firestore": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-firestore/SKILL.md",
      "computedHash": "7462e16e15fa68b814c17fa6dff22bb1ae970d5638b5e7143e046cbd70084a19"
    },
    "firebase-hosting-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-hosting-basics/SKILL.md",
      "computedHash": "381c7bb4200644d4a09f7f505bc5ba44b499cc74d0365d69bd3e313ea0865297"
    },
    "firebase-remote-config-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-remote-config-basics/SKILL.md",
      "computedHash": "4477c4ed83c5ee33df3d41f7831e7f9254aa436763f20d0c1a62c5c41f1a4564"
    },
    "firebase-security-rules-auditor": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-security-rules-auditor/SKILL.md",
      "computedHash": "69927a1fca3467543feb4eafaa1ff376a9b642db1095b29bfc2160c9a555ca61"
    },
    "xcode-project-setup": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/xcode-project-setup/SKILL.md",
      "computedHash": "0adf19113be8a1966466e629098f4ead7b5de3a7767958f02baf1cddc9e2642e"
    }
  }
}
````

## File: tailwind.config.js
````javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Sora"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f5f6f7', 100: '#e8eaed', 200: '#cfd3da',
          300: '#a6adb9', 400: '#767f8f', 500: '#5a6273',
          600: '#454b5c', 700: '#363b48', 800: '#262a34',
          900: '#15171d', 950: '#0c0d11',
        },
        moss: {
          50: '#f1faf4', 100: '#dcf3e3', 200: '#bbe6c9',
          300: '#8ad2a6', 400: '#54b67c', 500: '#2f9a5e',
          600: '#1f7c4a', 700: '#1a623c', 800: '#194e33', 900: '#16412c',
        },
        rust: {
          50: '#fdf4ef', 100: '#fbe5d9', 200: '#f6c8ae',
          300: '#efa278', 400: '#e87a48', 500: '#dd5a28',
          600: '#c4441d', 700: '#a2331b', 800: '#822b1c', 900: '#6a261b',
        },
        sand: '#faf6ef',
      },
      borderRadius: { xl2: '1.1rem' },
      minHeight: { touch: '44px' },
      minWidth:  { touch: '44px' },
    },
  },
  plugins: [],
};
````

## File: vite.config.js
````javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `defineConfig` accepts a function so we can read the active Vite `mode`
// (set by the --mode flag on the CLI) and branch on it.
export default defineConfig(({ mode }) => ({
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
  },

  // DEMO MODE — this is what actually connects Demo Mode to the app.
  // `npm run dev:demo` runs `vite --mode demo`. When mode is 'demo', every
  // `import ... from 'firebase/firestore'` and `import ... from
  // 'firebase/auth'` ANYWHERE in the codebase — every page, every hook,
  // and src/firebase.js itself — is transparently redirected to our local,
  // localStorage-backed implementations (src/demo/localFirestore.js and
  // src/demo/localAuth.js) instead of the real Firebase SDK. No other file
  // needs to know Demo Mode exists; they all just import from
  // 'firebase/firestore' / 'firebase/auth' as normal and get whichever
  // implementation matches how the dev server was started.
  //
  // `npm run dev` (no --mode) leaves `resolve.alias` empty, so it is
  // 100% unaffected and behaves exactly as before — real Firebase, real
  // Firestore, real Authentication.
  resolve: mode === 'demo' ? {
    alias: {
      'firebase/firestore': path.resolve(__dirname, 'src/demo/localFirestore.js'),
      'firebase/auth': path.resolve(__dirname, 'src/demo/localAuth.js'),
    },
  } : {},

  plugins: [
    react(),

    VitePWA({

      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'favicon-16.png', 'icons/*.png'],
      manifest: {
        name: 'FlowBiz — Business Manager',
        short_name: 'FlowBiz',
        description: 'POS, inventory and finance management for Kenyan SMBs',
        theme_color: '#1a623c',
        background_color: '#faf6ef',
        display: 'standalone',
        orientation: 'natural',
        start_url: '/',
        scope: '/',
        lang: 'en-KE',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: 'icons/icon-72.png',  sizes: '72x72',   type: 'image/png' },
          { src: 'icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
          { src: 'icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icons/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        screenshots: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
}));
````

## File: src/components/layout/BottomNav.jsx
````javascript
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { Menu } from 'lucide-react';
import { NAV_ITEMS, MOBILE_PRIMARY } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import MobileMoreDrawer from './MobileMoreDrawer';

export default function BottomNav() {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const [moreOpen, setMoreOpen] = useState(false);

  const allowedPaths = MOBILE_PRIMARY[isAdmin ? 'admin' : 'cashier'];
  const items = allowedPaths
    .map((path) => NAV_ITEMS.find((item) => item.to === path))
    .filter(Boolean)
    .filter((item) => item.to !== '/expenses' || isAdmin || settings.cashierCanRecordExpenses);

  const Icon = ({ name, className = 'h-5 w-5' }) => {
    const Component = Lucide[name] || Lucide.Circle;
    return <Component className={className} strokeWidth={1.75} />;
  };

  return (
    <>
      {/* Position/visibility unchanged — stays fixed to the bottom on
          mobile (lg:hidden), only the active-tab color moved to blue. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-100 bg-white/95 backdrop-blur lg:hidden">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
              isActive ? 'text-moss-700' : 'text-ink-400'              }`
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-ink-400"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
          More
        </button>
      </nav>

      <MobileMoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
````

## File: src/components/layout/MobileMoreDrawer.jsx
````javascript
import { NavLink } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { X } from 'lucide-react';

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const Component = Lucide[name] || Lucide.Circle;
  return <Component className={className} strokeWidth={1.75} />;
};

// Full page list for phones — the sidebar is desktop-only (lg:flex), and the
// bottom bar only fits a handful of shortcuts, so this covers everything else
// (Products, Purchases, Suppliers, Stock Take, Users, etc.) behind one button.
export default function MobileMoreDrawer({ open, onClose }) {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).filter(
    (item) => item.to !== '/expenses' || isAdmin || settings.cashierCanRecordExpenses
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-xl2 bg-white p-4 pb-8 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-ink-900">All pages</h2>
          <button onClick={onClose} className="p-1.5 rounded text-ink-400 hover:bg-ink-50 hover:text-ink-700">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center text-[11px] font-semibold ${
                 isActive
                    ? 'border-moss-200 bg-moss-50 text-moss-800'
                    : 'border-ink-100 text-ink-500 hover:bg-ink-50'
                }`
              }
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}
````

## File: src/components/layout/Sidebar.jsx
````javascript
import { NavLink } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
const Icon = ({ name, className='h-5 w-5' }) => { const C = Lucide[name]||Lucide.Circle; return <C className={className} strokeWidth={1.75} />; };
export default function Sidebar() {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const items = NAV_ITEMS
    .filter(i => !i.adminOnly || isAdmin)
    .filter(i => i.to !== '/expenses' || isAdmin || settings.cashierCanRecordExpenses);
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-100 bg-white lg:flex">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-ink-100">
        <img src="/icons/icon-72.png" alt="FlowBiz" className="h-9 w-9 rounded-lg" />
        <div><p className="font-display text-sm font-bold leading-tight text-ink-900">FlowBiz</p><p className="text-[11px] leading-tight text-ink-400">Business Manager</p></div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {items.map(item => (
<NavLink key={item.to} to={item.to} end={item.to==='/'} className={({isActive}) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-moss-50 text-moss-800' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'}`}>            <Icon name={item.icon} />{item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
````

## File: src/components/products/ProductFormModal.jsx
````javascript
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

const empty = {
  name: '', category: '', costPrice: '', sellingPrice: '', stock: '',
  lowStockThreshold: '5', supplierId: '', barcode: '', description: '',
};

// FIX: Free plan product limit.
const FREE_PLAN_PRODUCT_LIMIT = 100;

export default function ProductFormModal({
   open, onClose, onSave, suppliers, initialProduct, prefillBarcode, onAddSupplier, newSupplierId,
simplifiedForPurchase = false, productCount = 0,
 }) {
  const { businessId, isPro } = useAuth();
  const [form, setForm] = useState(empty);
  const [categories, setCategories] = useState([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [busy, setBusy] = useState(false);

  // MULTI-TENANT CHANGE: categories used to live in a single global
  // settings/categories doc shared by every business in the project.
  // They now live inside this business's own businessSettings/{businessId}
  // document, alongside shopName and cashierCanRecordExpenses.
  useEffect(() => {
    if (!open || !businessId) return;
    const unsub = onSnapshot(doc(db, 'businessSettings', businessId), (snap) => {
      if (snap.exists() && snap.data().categories) {
        setCategories(snap.data().categories);
      } else {
        const defaults = ['Groceries', 'Beverages', 'Hardware', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other'];
        setCategories(defaults);
        setDoc(doc(db, 'businessSettings', businessId), { categories: defaults }, { merge: true }).catch(console.error);
      }
    });
    return unsub;
  }, [open, businessId]);

  useEffect(() => {
    setBusy(false);
    if (open) {
      if (initialProduct) {
        setForm({
          ...empty, ...initialProduct,
          costPrice: initialProduct.costPrice ?? '',
          sellingPrice: initialProduct.sellingPrice ?? '',
          stock: initialProduct.stock ?? '',
          lowStockThreshold: initialProduct.lowStockThreshold ?? '5',
          supplierId: initialProduct.supplierId ?? '',
          barcode: initialProduct.barcode ?? '',
          description: initialProduct.description ?? '',
        });
      } else {
        setForm({ ...empty, barcode: prefillBarcode || '', category: categories[0] || '' });
      }
    }
  }, [initialProduct, prefillBarcode, open]);

  useEffect(() => {
    if (open && !initialProduct && !form.category && categories.length > 0) {
      setForm(prev => ({ ...prev, category: categories[0] }));
    }
  }, [categories, open, initialProduct, form.category]);

  useEffect(() => {
    if (newSupplierId) setForm((prev) => ({ ...prev, supplierId: newSupplierId }));
  }, [newSupplierId]);

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) { toast.error('Category already exists.'); return; }
    const updated = [...categories, trimmed];
    try {
      await setDoc(doc(db, 'businessSettings', businessId), { categories: updated }, { merge: true });
      setForm(prev => ({ ...prev, category: trimmed }));
      setShowAddCategory(false);
      setNewCategoryName('');
      toast.success('Category added');
    } catch (err) {
      toast.error('Failed to add category: ' + err.message);
    }
  };

  const handle = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.category) return toast.error('Please select or add a category.');
    if (!simplifiedForPurchase && Number(form.costPrice) < 0) return toast.error('Cost price cannot be negative.');
    if (Number(form.sellingPrice) <= 0) return toast.error('Selling price must be greater than zero.');
   if (!initialProduct && !simplifiedForPurchase && Number(form.stock) < 0) return toast.error('Stock cannot be negative.');

    // FIX: Free plan capped at FREE_PLAN_PRODUCT_LIMIT active products —
    // only blocks NEW products, never editing an existing one.
    if (!initialProduct && !isPro && productCount >= FREE_PLAN_PRODUCT_LIMIT) {
      toast.error(`Free plan is limited to ${FREE_PLAN_PRODUCT_LIMIT} products. Upgrade to FlowBiz Pro to add more.`);
      return;
    }

    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(),
        category: form.category,
        costPrice: simplifiedForPurchase ? 0 : Number(form.costPrice),
        sellingPrice: Number(form.sellingPrice),
        stock: initialProduct ? initialProduct.stock : (simplifiedForPurchase ? 0 : Number(form.stock)),
       lowStockThreshold: simplifiedForPurchase ? 5 : (Number(form.lowStockThreshold) || 5),
        supplierId: simplifiedForPurchase ? null : (form.supplierId || null),
        barcode: form.barcode.trim() || null,
        description: form.description.trim(),
      });
    } catch (err) {
      setBusy(false);
    }
  };

  const handleClose = () => { if (!busy) onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title={initialProduct ? 'Edit product' : 'Add product'}>
      <form onSubmit={handle} className="space-y-3">
        <div><label className="label">Product name</label><input className="input" value={form.name} onChange={set('name')} disabled={busy} required /></div>

        {initialProduct?.internalCode && (
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
            Internal code: <span className="font-mono font-semibold text-ink-700">{initialProduct.internalCode}</span>
          </div>
        )}

        <div>
          <label className="label">Barcode <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
          <input className="input font-mono" value={form.barcode} onChange={set('barcode')} placeholder="Scan or type manufacturer barcode" disabled={busy} />
          {!initialProduct && <p className="mt-1 text-xs text-ink-400">Leave blank if this product doesn't have a manufacturer barcode.</p>}
        </div>

        <div className={simplifiedForPurchase ? '' : 'grid grid-cols-2 gap-3'}>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={set('category')} disabled={busy} required>
              <option value="" disabled>— Select Category —</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {showAddCategory ? (
              <div className="mt-2 space-y-2 rounded-lg bg-ink-50 p-2.5">
                <label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wide">New Category</label>
                <input className="input !py-1 !min-h-0 text-xs" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="e.g. Fruits" disabled={busy} autoFocus />
                <div className="flex gap-1.5 justify-end">
                  <button type="button" className="btn-secondary !py-1 !px-2.5 !min-h-0 text-xs" onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} disabled={busy}>Cancel</button>
                  <button type="button" className="btn-primary !py-1 !px-2.5 !min-h-0 text-xs" onClick={handleAddCategory} disabled={busy}>Save</button>
                </div>
              </div>
            ) : (
             <button type="button" className="mt-1.5 text-xs font-semibold text-moss-700 hover:underline block" onClick={() => setShowAddCategory(true)} disabled={busy}>+ Add Category</button>
            )}
          </div>
          {!simplifiedForPurchase && (
           <div>
              <label className="label">Supplier</label>
             <select className="input" value={form.supplierId} onChange={set('supplierId')} disabled={busy}>
                <option value="">— None —</option>
               {(suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {onAddSupplier && <button type="button" className="mt-1.5 text-xs font-semibold text-moss-700 hover:underline block" onClick={onAddSupplier} disabled={busy}>+ Add new supplier</button>}
            </div>
          )}
        </div>

        {simplifiedForPurchase ? (
          <div>
            <label className="label">Selling price (KES)</label>
            <input type="number" min="0.01" step="0.01" className="input" value={form.sellingPrice} onChange={set('sellingPrice')} disabled={busy} required />
            <p className="mt-1 text-xs text-ink-400">Stock starts at 0. Go back to the purchase form to record what was actually received and its cost.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Buying price (KES)</label><input type="number" min="0" step="0.01" className="input" value={form.costPrice} onChange={set('costPrice')} disabled={busy} required /></div>
            <div><label className="label">Selling price (KES)</label><input type="number" min="0.01" step="0.01" className="input" value={form.sellingPrice} onChange={set('sellingPrice')} disabled={busy} required /></div>
          </div>
        )}

        {!simplifiedForPurchase && (
         <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Stock qty</label>
              <input type="number" min="0" className="input disabled:bg-ink-50 disabled:text-ink-400" value={form.stock} onChange={set('stock')} disabled={!!initialProduct || busy} required={!initialProduct} />
              {initialProduct && <p className="mt-1 text-[11px] text-ink-400">Stock quantity is changed via Purchases, Sales, or Stock Take.</p>}
            </div>
            <div><label className="label">Low stock alert</label><input type="number" min="0" className="input" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} disabled={busy} /></div>
          </div>
        )}

        <div>
          <label className="label">Description <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
          <textarea className="input !min-h-[70px]" rows={2} value={form.description} onChange={set('description')} placeholder="Product details or specifications" disabled={busy} />
        </div>

        {Number(form.sellingPrice) > 0 && Number(form.costPrice) > 0 && Number(form.sellingPrice) <= Number(form.costPrice) && (
          <p className="text-xs text-rust-600 font-medium">⚠️ Selling price is at or below cost — you'll make no profit on this item.</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {initialProduct ? 'Saving...' : 'Adding Product...'}
              </span>
            ) : (initialProduct ? 'Save changes' : 'Add product')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
````

## File: src/contexts/AuthContext.jsx
````javascript
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendEmailVerification,
  reload,
} from 'firebase/auth';
import {
  doc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';
const AuthContext = createContext(null);

function getDeviceId() {
  let id = localStorage.getItem('flowbiz_device_id');
  if (!id) {
    id = `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('flowbiz_device_id', id);
  }
  return id;
}

function guessDeviceLabel() {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'Android device';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS device';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh/i.test(ua)) return 'Mac';
  return 'Unknown device';
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState({ plan: 'free', status: 'active' });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [accountRemoved, setAccountRemoved] = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const profileUnsubRef = useRef(null);
  const sessionUnsubRef = useRef(null);
  const businessUnsubRef = useRef(null);

  const stopListeners = useCallback(() => {
    profileUnsubRef.current?.();
    profileUnsubRef.current = null;
    sessionUnsubRef.current?.();
    sessionUnsubRef.current = null;
    businessUnsubRef.current?.();
    businessUnsubRef.current = null;
  }, []);

  const registerSession = useCallback(async (uid, businessId) => {
    const sessionId = getDeviceId();
    const ref = doc(db, 'sessions', sessionId);
    const currentSnap = await getDoc(ref);

    if (!currentSnap.exists()) {
      await setDoc(ref, {
        uid,
        businessId,
        deviceLabel: guessDeviceLabel(),
        userAgent: navigator.userAgent,
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        revoked: false,
      });
    } else {
      await updateDoc(ref, {
        lastActiveAt: serverTimestamp(),
        deviceLabel: guessDeviceLabel(),
        userAgent: navigator.userAgent,
      }).catch(() => {});
    }

    sessionUnsubRef.current = onSnapshot(ref, (sessionSnap) => {
      if (sessionSnap.exists() && sessionSnap.data().revoked === true) {
        setSessionRevoked(true);
        fbSignOut(auth);
      }
    });
  }, []);

  const loadProfile = useCallback((user, retryCount = 0) => {
    stopListeners();
    setAuthError(null);
    setAccountRemoved(false);
    setSessionRevoked(false);

    if (!user) {
      setProfile(null);
      setSubscription({ plan: 'free', status: 'active' });
      setEmailVerified(false);
      setLoading(false);
      return;
    }

    setEmailVerified(!!user.emailVerified);
    setLoading(true);
    const userRef = doc(db, 'users', user.uid);

    profileUnsubRef.current = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          setTimeout(async () => {
            try {
              const recheck = await getDoc(userRef);
              if (!recheck.exists()) {
                setAccountRemoved(true);
                setProfile(null);
                setLoading(false);
              }
            } catch (err) {
              setAuthError(`${err.code || err.name || 'unknown'}: ${err.message}`);
              setProfile(null);
              setLoading(false);
            }
          }, 4000);
          return;
        }
        setAccountRemoved(false);
        const data = { uid: user.uid, ...snap.data() };
        setProfile(data);
        setLoading(false);

        if (data.businessId) {
          registerSession(user.uid, data.businessId).catch(console.error);
          businessUnsubRef.current = onSnapshot(doc(db, 'businesses', data.businessId), (bizSnap) => {
            if (bizSnap.exists()) {
              setSubscription(bizSnap.data().subscription || { plan: 'free', status: 'active' });
            }
          });
        }
      },
      (err) => {
        // FIX: right after createUserWithEmailAndPassword (or any fresh
        // sign-in), Firestore's listener can attach a beat before the
        // fresh ID token is fully live on this connection, producing a
        // ONE-TIME permission-denied even though the rules and the
        // document are both completely fine. Firestore does not
        // auto-retry a listener after an explicit permission-denied (it
        // does retry plain network errors), so without this the app was
        // permanently stuck on "Profile unavailable" right after a
        // successful signup — even though the account and business were
        // created correctly. Auto-retry a few times with backoff before
        // ever surfacing this as a real error.
        if (err.code === 'permission-denied' && retryCount < 3) {
          const delay = 700 * (retryCount + 1);
          console.warn(`[FlowBiz] users/${user.uid} listener got permission-denied — retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
          setTimeout(() => {
            if (auth.currentUser?.uid === user.uid) loadProfile(user, retryCount + 1);
          }, delay);
          return;
        }
        console.error(`[FlowBiz] onSnapshot(users/${user.uid}) failed:`, err.code || err.name, err.message);
        setAuthError(`${err.code || err.name || 'unknown'}: ${err.message}`);
        setProfile(null);
        setLoading(false);
      }
    );
  }, [registerSession, stopListeners]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      loadProfile(user);
    });
    return () => { unsub(); stopListeners(); };
  }, [loadProfile, stopListeners]);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => { stopListeners(); return fbSignOut(auth); };
  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    await sendEmailVerification(auth.currentUser, {
      url: `${window.location.origin}/auth/action`,
      handleCodeInApp: true,
    });
  };

  const refreshEmailVerification = useCallback(async () => {
    if (!auth.currentUser) return false;
    try {
      await reload(auth.currentUser);
    } catch (err) {
      console.error('[FlowBiz] refreshEmailVerification: reload() failed:', err.code || err.name, err.message);
      return auth.currentUser?.emailVerified ?? false;
    }
    const verified = !!auth.currentUser.emailVerified;
    setEmailVerified(verified);
    return verified;
  }, []);

  const createStaffInvite = async ({ displayName, role = 'cashier' }) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can invite staff.');
    if (!['owner', 'cashier'].includes(role)) throw new Error('Invalid role.');
    const trimmed = (displayName || '').trim();
    if (!trimmed) throw new Error('Enter a name.');
    const ref = await addDoc(collection(db, 'staffInvites'), {
      businessId: profile.businessId,
      displayName: trimmed,
      role,
      createdBy: profile.uid,
      createdByName: profile.displayName,
      createdAt: serverTimestamp(),
      claimed: false,
      linkedUid: null,
    });
    return { id: ref.id };
  };

  const cancelStaffInvite = async (inviteId) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can cancel an invite.');
    await deleteDoc(doc(db, 'staffInvites', inviteId));
  };

  const revokeSessionsForStaffMember = useCallback(async (uid) => {
    if (!profile?.businessId) return;
    const snap = await getDocs(query(collection(db, 'sessions'), where('uid', '==', uid), where('businessId', '==', profile.businessId)));
    await Promise.all(
      snap.docs.filter((d) => d.data().revoked !== true).map((d) => updateDoc(doc(db, 'sessions', d.id), { revoked: true }))
    );
  }, [profile]);

  const removeStaffAccount = async (uid) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can remove staff accounts.');
    if (uid === profile.uid) throw new Error("You can't remove your own account here.");
    if (!auth.currentUser) throw new Error('Your session has expired. Please sign in again.');

    const idToken = await auth.currentUser.getIdToken(true);
    await revokeSessionsForStaffMember(uid);

    let response;
    try {
      response = await fetch(`${FLOWBIZ_API_URL}/api/auth/delete-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ targetUid: uid }),
      });
    } catch (networkErr) {
      throw new Error(`Failed to reach the API server. Ensure your Cloudflare Worker is deployed and VITE_FLOWBIZ_API_URL is correctly set. [${networkErr.message}]`);
    }

    let result = null;
    try { result = await response.json(); } catch { }
    if (!response.ok) throw new Error(result?.error || result?.message || `Failed to delete the staff account (${response.status}).`);

    let retries = 3;
    while (retries > 0) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        break;
      } catch (e) {
        retries--;
        if (retries === 0) throw new Error("Staff Auth removed, but profile UI deletion timed out. Refresh the page.");
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };

  const toggleMemberActive = async (uid, active) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can do this.');
    await updateDoc(doc(db, 'users', uid), { active });
    if (active === false) await revokeSessionsForStaffMember(uid);
  };

  const revokeSession = async (sessionId) => {
    await updateDoc(doc(db, 'sessions', sessionId), { revoked: true });
  };

  const listMySessions = async () => {
    if (!profile) return [];
    const snap = await getDocs(query(collection(db, 'sessions'), where('uid', '==', profile.uid)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const listBusinessSessions = async () => {
    if (!profile?.businessId) return [];
    const snap = await getDocs(query(collection(db, 'sessions'), where('businessId', '==', profile.businessId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const isOwner = profile?.role === 'owner';
  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active' &&
                (!subscription.expiresAt || (subscription.expiresAt.toMillis ? subscription.expiresAt.toMillis() : subscription.expiresAt) > Date.now());

  return (
    <AuthContext.Provider
      value={{
        firebaseUser, profile, subscription, isPro, loading, authError, accountRemoved, sessionRevoked,
        businessId: profile?.businessId ?? null, role: profile?.role ?? null, isAdmin: isOwner, isOwner,
        isActive: profile?.active !== false, emailVerified,
        login, logout, resendVerificationEmail, refreshEmailVerification, createStaffInvite, cancelStaffInvite, removeStaffAccount,
        toggleMemberActive, revokeSession, listMySessions, listBusinessSessions, currentSessionId: getDeviceId(),
        reloadProfile: async () => loadProfile(auth.currentUser),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
````

## File: src/pages/AuthAction.jsx
````javascript
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset, reload } from 'firebase/auth';
import { auth } from '../firebase';

export default function AuthAction() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  if (mode === 'resetPassword') {
    return <ResetPasswordPanel oobCode={oobCode} />;
  }
  return <VerifyEmailPanel mode={mode} oobCode={oobCode} />;
}

function Shell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm card p-6 text-center space-y-4">
        <img src="/icons/icon-192.png" alt="FlowBiz" className="mx-auto h-14 w-14 rounded-2xl shadow-lg" />
        {children}
      </div>
    </div>
  );
}

function VerifyEmailPanel({ mode, oobCode }) {
  const [status, setStatus] = useState('working'); // working | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (oobCode && mode === 'verifyEmail') {
        try {
          await applyActionCode(auth, oobCode);
          if (auth.currentUser) {
            try { await reload(auth.currentUser); } catch { /* non-fatal */ }
          }
          if (!cancelled) { setStatus('success'); setMessage('Your email has been verified.'); }
        } catch (err) {
          if (cancelled) return;
          const code = err.code || '';
          // FIX: a "code already used" error is exactly what you'd see if
          // this link was already consumed elsewhere — e.g. an email
          // provider's link-safety scanner opening it before the person
          // clicked it. If this browser is signed in and the server now
          // shows the account as verified, the goal was already achieved
          // — treat it as success instead of an error.
          if (code === 'auth/invalid-action-code' && auth.currentUser) {
            try {
              await reload(auth.currentUser);
              if (auth.currentUser.emailVerified) {
                setStatus('success');
                setMessage('Your email has been verified.');
                return;
              }
            } catch { /* fall through to error below */ }
          }
          setStatus('error');
          setMessage(
            code === 'auth/expired-action-code' ? 'This verification link has expired. Please request a new one from the app.' :
            code === 'auth/invalid-action-code'  ? "This verification link has already been used or has expired. If you're already verified, just sign in." :
            "We couldn't verify your email. Please request a new verification link."
          );
        }
        return;
      }

      // FIX: no oobCode present. This legitimately happens when Firebase's
      // OWN generic hosted verification page completed the verification
      // first, and its "Continue" button lands here as a plain link with
      // no code attached (the code was already consumed on Firebase's
      // side). Rather than assuming failure, check the real, current
      // server-side verification state before showing an error.
      if (auth.currentUser) {
        try {
          await reload(auth.currentUser);
          if (!cancelled && auth.currentUser.emailVerified) {
            setStatus('success');
            setMessage('Your email has been verified.');
            return;
          }
        } catch { /* fall through to error below */ }
      }

      if (!cancelled) {
        setStatus('error');
        setMessage('This link is missing required information. Please request a new verification email.');
      }
    }

    run();
    return () => { cancelled = true; };
  }, [mode, oobCode]);

  return (
    <Shell>
      {status === 'working' && (
        <>
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
          <p className="text-sm text-ink-500">Confirming…</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="text-4xl">✅</div>
          <h1 className="font-display text-lg font-bold text-ink-900">Email verified</h1>
          <p className="text-sm text-ink-500">{message} You can continue to FlowBiz now.</p>
          <Link to="/" className="btn-primary w-full">Continue to FlowBiz</Link>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="text-4xl">⚠️</div>
          <h1 className="font-display text-lg font-bold text-ink-900">Something went wrong</h1>
          <p className="text-sm text-ink-500">{message}</p>
          <Link to="/login" className="btn-outline w-full">Go to sign in</Link>
        </>
      )}
    </Shell>
  );
}

function ResetPasswordPanel({ oobCode }) {
  const [status, setStatus] = useState('checking'); // checking | ready | success | error
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!oobCode) {
      setStatus('error');
      setMessage('This link is missing required information. Please request a new password reset email.');
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        if (cancelled) return;
        setEmail(verifiedEmail);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err.code || '';
        setStatus('error');
        setMessage(
          code === 'auth/expired-action-code' ? 'This reset link has expired. Please request a new one.' :
          code === 'auth/invalid-action-code'  ? 'This reset link has already been used or is invalid. Please request a new one.' :
          'This reset link is invalid. Please request a new one.'
        );
      });
    return () => { cancelled = true; };
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setMessage('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setMessage('Passwords do not match.'); return; }
    setMessage('');
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('success');
    } catch (err) {
      const code = err.code || '';
      setMessage(
        code === 'auth/expired-action-code' ? 'This reset link has expired. Please request a new one.' :
        code === 'auth/weak-password'        ? 'Please choose a stronger password.' :
        "Couldn't reset your password. Please request a new link and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      {status === 'checking' && (
        <>
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
          <p className="text-sm text-ink-500">Checking your link…</p>
        </>
      )}
      {status === 'ready' && (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="text-center">
            <h1 className="font-display text-lg font-bold text-ink-900">Choose a new password</h1>
            <p className="mt-1 text-sm text-ink-500">for <span className="font-semibold">{email}</span></p>
          </div>
          {message && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{message}</div>}
          <div>
            <label className="label">New password</label>
            <input type="password" className="input" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" autoFocus />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" className="input" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? 'Saving…' : 'Save new password'}</button>
        </form>
      )}
      {status === 'success' && (
        <>
          <div className="text-4xl">✅</div>
          <h1 className="font-display text-lg font-bold text-ink-900">Password updated</h1>
          <p className="text-sm text-ink-500">You can now sign in with your new password.</p>
          <Link to="/login" className="btn-primary w-full">Go to sign in</Link>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="text-4xl">⚠️</div>
          <h1 className="font-display text-lg font-bold text-ink-900">Something went wrong</h1>
          <p className="text-sm text-ink-500">{message}</p>
          <Link to="/login" className="btn-outline w-full">Go to sign in</Link>
        </>
      )}
    </Shell>
  );
}
````

## File: src/pages/Counter.jsx
````javascript
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { doc, addDoc, writeBatch, increment, serverTimestamp, orderBy, where, limit, getDoc, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDailySession } from '../hooks/useDailySession';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct, updateProduct } from '../utils/products';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import ProductGrid from '../components/pos/ProductGrid';
import SaleModal from '../components/pos/SaleModal';
import SaleCompleteModal from '../components/pos/SaleCompleteModal';
import OpenSessionPrompt from '../components/pos/OpenSessionPrompt';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES } from '../utils/currency';
import { formatDateTime } from '../utils/dateRanges';

export default function Counter() {
  const { profile, isAdmin, businessId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const productsQ  = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  
  const customersQ = useMemo(() => businessId ? tenantQuery('customers', businessId, orderBy('name')) : null, [businessId]);
  const salesQ     = useMemo(() => businessId ? tenantQuery('sales', businessId, orderBy('soldAt','desc'), limit(100)) : null, [businessId]);
  const creditSalesQ = useMemo(() => businessId ? tenantQuery('creditSales', businessId, orderBy('soldAt','desc'), limit(100)) : null, [businessId]);
  const suppliersQ = useMemo(() => businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null, [businessId]);

  const { data: products,  loading: prodLoading }  = useFirestoreCollection(productsQ);
  const { data: customers }                         = useFirestoreCollection(customersQ);
  const { data: sales,     loading: salesLoading }  = useFirestoreCollection(salesQ);
  const { data: creditSales, loading: creditLoading } = useFirestoreCollection(creditSalesQ);
  const { data: suppliers }                         = useFirestoreCollection(suppliersQ);
  const { session, loading: sessLoading, isClosed, openSession, reopenSession } = useDailySession();

  const [search, setSearch]           = useState('');
  const [activeProduct, setActive]    = useState(null);
  const [completedSale, setCompletedSale] = useState(null);
  const [pendingVoid, setPendingVoid] = useState(null);
  const [editProduct, setEditProd]    = useState(null);
  const [prodModal, setProdModal]     = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState(null);

  useEffect(() => {
    if (location.state?.autoScan && session && !isClosed) {
      setScannerOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, session, isClosed]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search.trim())) ||
    (p.internalCode && p.internalCode.toLowerCase().includes(search.toLowerCase()))
  );

  const mergedSales = useMemo(() => {
    const list = [];
    sales.forEach(s => { list.push({ ...s, isCredit: false, paymentType: s.paymentMethod || 'Cash' }); });
    creditSales.forEach(cs => { list.push({ ...cs, isCredit: true, paymentType: 'Credit' }); });
    return list.sort((a, b) => {
      const aTime = a.soldAt?.toMillis?.() ?? a.soldAt?.toDate?.()?.getTime?.() ?? new Date(a.soldAt || 0).getTime();
      const bTime = b.soldAt?.toMillis?.() ?? b.soldAt?.toDate?.()?.getTime?.() ?? new Date(b.soldAt || 0).getTime();
      return bTime - aTime;
    }).slice(0, 100);
  }, [sales, creditSales]);

  const handleCreateCustomer = async ({ name, phone }) => {
    const ref = await addDoc(tenantCollection('customers'), withBusiness({ name, phone, email:'', address:'', notes:'', createdAt:serverTimestamp() }, businessId));
    return { id:ref.id, name, phone };
  };

  // FIX: Replaced runTransaction with writeBatch(db) and increment() for perfect offline capability.
const handleSale = ({ product, quantity, soldPricePerUnit, paymentMethod, mpesaCode }) => {
    const productRef = doc(db, 'products', product.id);
    const saleRef = doc(collection(db, 'sales'));
    const saleData = withBusiness({
      productId: product.id, productName: product.name, quantity,
      costPricePerUnit: product.costPrice, soldPricePerUnit,
      totalAmount: soldPricePerUnit * quantity,
      profit: (soldPricePerUnit - product.costPrice) * quantity,
      paymentMethod, mpesaCode: mpesaCode || null,
      soldBy: profile.uid, soldByName: profile.displayName,
      soldAt: serverTimestamp(), isCredit: false, isVoided: false,
    }, businessId);

    const batch = writeBatch(db);
    batch.update(productRef, { stock: increment(-quantity), updatedAt: serverTimestamp() });
    batch.set(saleRef, saleData);

    return { record: { id: saleRef.id, ...saleData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleCredit = ({ product, quantity, soldPricePerUnit, customerId, customerName, customerPhone }) => {
    const productRef = doc(db, 'products', product.id);
    const totalAmount = soldPricePerUnit * quantity;
    const creditRef = doc(collection(db, 'creditSales'));
    const creditData = withBusiness({
      customerId, customerName, customerPhone: customerPhone || '',
      productId: product.id, productName: product.name, quantity,
      costPricePerUnit: product.costPrice, soldPricePerUnit, totalAmount,
      soldBy: profile.uid, soldByName: profile.displayName, soldAt: serverTimestamp(),
      status: 'pending', amountPaid: 0, remainingBalance: totalAmount, paymentHistory: [],
      isCredit: true
    }, businessId);

    const batch = writeBatch(db);
    batch.update(productRef, { stock: increment(-quantity), updatedAt: serverTimestamp() });
    batch.set(creditRef, creditData);

    return { record: { id: creditRef.id, ...creditData, soldAt: new Date() }, commit: batch.commit() };
  };

  // FIX: Voiding a Cash Sale now creates a 'refunds' document to correct CloseDay till shortages.
  const handleVoid = async () => {
    const sale = pendingVoid;
    setPendingVoid(null);
    try {
      const batch = writeBatch(db);
      const prodRef = doc(db, 'products', sale.productId);
      const prodSnap = await getDoc(prodRef);

      if (prodSnap.exists()) {
        batch.update(prodRef, { stock: increment(sale.quantity), updatedAt: serverTimestamp() });
      } else {
        toast('Product was deleted; sale voided without stock restoration.', { icon: '⚠️' });
      }

      batch.update(doc(db, 'sales', sale.id), { isVoided: true, voidedAt: serverTimestamp(), voidedBy: profile.uid });

      if (!sale.isCredit) {
        const refundRef = doc(collection(db, 'refunds'));
        batch.set(refundRef, withBusiness({
          saleId: sale.id,
          amount: sale.totalAmount,
          method: sale.paymentMethod,
          refundedAt: serverTimestamp(),
          refundedBy: profile.uid,
          refundedByName: profile.displayName
        }, businessId));
      }

      await batch.commit();
      if (prodSnap.exists()) toast.success('Sale voided and stock restored.');
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
  };

  const handleProductSave = async (data) => {
    try {
      if (editProduct) { await updateProduct(editProduct.id, data, editProduct.barcode, businessId); toast.success('Product updated'); }
      else { await createProduct(data, businessId); toast.success('Product added'); }
      setEditProd(null);
      setProdModal(false);
      setPrefillBarcode(null);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
      throw err;
    }
  };

  const handleSupplierSave = async (supplierData) => {
    try {
      const ref = await addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
      setNewSupplierId(ref.id);
      setSupplierModal(false);
      toast.success('Supplier added');
    } catch (err) { toast.error(err.message); }
  };

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) setActive(found);
    else setNotFoundCode(code);
  };

  useHardwareScanner(handleScanDetected, {
    enabled: !!session && !isClosed && !activeProduct && !prodModal && !supplierModal && !scannerOpen && !notFoundCode && !completedSale,
  });

  if (sessLoading) return <LoadingSpinner label="Loading today's session…" />;
  if (isClosed) return (
    <div className="mx-auto max-w-sm pt-8 space-y-4 text-center">
      <EmptyState title="Today's session is closed" description="Sales are locked. An owner can reopen to continue trading." />
      {isAdmin && <button className="btn-primary w-full" onClick={reopenSession}>Reopen session</button>}
    </div>
  );
  if (!session) return <OpenSessionPrompt onOpen={floats => openSession({ ...floats, openedBy:profile.uid })} />;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="font-display text-xl font-bold text-ink-900">Counter</h1><p className="text-sm text-ink-400">Tap a product, or scan a barcode, to record a sale.</p></div>
        {isAdmin && <button className="btn-outline text-xs" onClick={()=>{setEditProd(null);setPrefillBarcode(null);setProdModal(true);}}>+ Quick add product</button>}
      </div>
      <input className="input" placeholder="Search products or codes…" value={search} onChange={e=>setSearch(e.target.value)} />
      {prodLoading ? <LoadingSpinner /> : filtered.length===0 ? <EmptyState title="No products match" /> :
        <ProductGrid products={filtered} onSelect={setActive} isAdmin={isAdmin} />}

      {isAdmin && (
        <div className="mt-4">
          <h2 className="font-display text-sm font-bold text-ink-800 mb-2">Sales log (last 100)</h2>
          {salesLoading || creditLoading ? <LoadingSpinner /> : mergedSales.length === 0 ? <EmptyState title="No sales recorded" /> : (
            <div className="card divide-y divide-ink-100">
              {mergedSales.map(s=>(
                <div key={s.id} className={`flex items-center justify-between px-4 py-3 text-sm ${s.isVoided?'opacity-40 line-through':''}`}>
                  <div>
                    <p className="font-medium text-ink-700">{s.quantity} × {s.productName} — {formatKES(s.totalAmount)}</p>
                    <p className="text-xs text-ink-400">
                      {s.paymentType === 'Credit' ? `Credit (${s.customerName})` : s.paymentMethod}
                      {s.mpesaCode ? ` (${s.mpesaCode})` : ''} · {formatDateTime(s.soldAt)} · {s.soldByName || 'Staff'}
                    </p>
                  </div>
                  {!s.isVoided && !s.isCredit && isAdmin && (
                    <button onClick={()=>setPendingVoid(s)} className="p-1 text-rust-400 hover:text-rust-600 min-h-[44px] min-w-[44px] flex items-center justify-center" title="Void sale"><Trash2 className="h-4 w-4" strokeWidth={1.75}/></button>
                  )}
                  {s.isCredit && isAdmin && (
                    <Link to={`/customers/${s.customerId}`} className="btn-outline !py-1 !px-2.5 !min-h-0 text-xs text-ink-500 hover:text-ink-700">View Customer</Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={()=>setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!notFoundCode} onClose={()=>setNotFoundCode(null)} title="Product not found" widthClass="max-w-xs">
        <p className="text-sm text-ink-500 mb-4">No product matches barcode <span className="font-mono">{notFoundCode}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={()=>setNotFoundCode(null)}>Cancel</button>
          {isAdmin ? (
            <button className="btn-primary" onClick={()=>{ setEditProd(null); setPrefillBarcode(notFoundCode); setNotFoundCode(null); setProdModal(true); }}>Create Product</button>
          ) : (
            <span className="self-center text-xs text-ink-400">Ask an owner to add this product.</span>
          )}
        </div>
      </Modal>

      <SaleModal 
        open={!!activeProduct} 
        product={activeProduct} 
        customers={customers} 
        onClose={(record) => {
          setActive(null);
          if (record && record.id) {
            setCompletedSale(record);
          }
        }} 
        onConfirmSale={handleSale} 
        onConfirmCredit={handleCredit} 
        onCreateCustomer={handleCreateCustomer} 
      />
      <SaleCompleteModal
        open={!!completedSale}
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
      />

<ProductFormModal
        open={prodModal}
        onClose={()=>{setProdModal(false);setEditProd(null);setPrefillBarcode(null);}}
        onSave={handleProductSave}
        suppliers={suppliers}
        initialProduct={editProduct}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
      />
      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
      <ConfirmDialog open={!!pendingVoid} title="Void this sale?" message={`Stock for "${pendingVoid?.productName}" (×${pendingVoid?.quantity}) will be restored.`} confirmLabel="Void sale" danger onConfirm={handleVoid} onCancel={()=>setPendingVoid(null)} />
    </div>
  );
}
````

## File: src/pages/Dashboard.jsx
````javascript
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, addDoc, writeBatch, increment, serverTimestamp, orderBy, where, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDailySession } from '../hooks/useDailySession';
import { useFinancialsForRange } from '../hooks/useFinancials';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct, updateProduct } from '../utils/products';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import SaleModal from '../components/pos/SaleModal';
import SaleCompleteModal from '../components/pos/SaleCompleteModal';
import OpenSessionPrompt from '../components/pos/OpenSessionPrompt';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES } from '../utils/currency';
import { startOfDay, endOfDay, formatDateTime } from '../utils/dateRanges';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';

function StatCard({ label, value, tone = 'text-ink-900', sub }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-400">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { profile, isAdmin, businessId, isPro } = useAuth();
  const today = useMemo(() => ({ start: startOfDay(), end: endOfDay() }), []);
  const { loading: financialsLoading, summary, sales, creditSales, expenses, repayments, purchases } = useFinancialsForRange(today.start, today.end);

  const productsQuery = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  
  const customersQuery = useMemo(() => businessId ? tenantQuery('customers', businessId, orderBy('name')) : null, [businessId]);
  const suppliersQuery = useMemo(() => businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null, [businessId]);
  const { data: products } = useFirestoreCollection(productsQuery);
  const { data: customers } = useFirestoreCollection(customersQuery);
  const { data: suppliers } = useFirestoreCollection(suppliersQuery);

  const { session, loading: sessionLoading, isClosed, openSession, reopenSession } = useDailySession();
  const [activeProduct, setActiveProduct] = useState(null);
  const [completedSale, setCompletedSale] = useState(null);
  const [editProduct, setEditProd] = useState(null);
  const [prodModal, setProdModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState(null);

  const [privacyMode, setPrivacyMode] = useState(() => {
    try { return localStorage.getItem('flowbiz_dashboard_privacy') === 'true'; }
    catch { return false; }
  });

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => {
      const next = !prev;
      try { localStorage.setItem('flowbiz_dashboard_privacy', String(next)); }
      catch (err) { console.error('Failed to save privacy mode setting', err); }
      return next;
    });
  };

  const formatVal = (val) => (privacyMode ? '••••••••' : formatKES(val));

  const dashboardCashReceived = summary.totalCashReceipts;
  const dashboardMpesaReceived = summary.totalMpesaReceipts;
  const dashboardExpenses = summary.totalExpenses;
  const dashboardNetProfit = summary.netProfit;

  const lowStock = products.filter((p) => p.stock <= (p.lowStockThreshold ?? 5));
  const totalInventoryValue = products.reduce((acc, p) => acc + (p.stock || 0) * (p.costPrice || 0), 0);
  const debtorsQuery = useMemo(() => businessId ? tenantQuery('creditSales', businessId) : null, [businessId]);
  const { data: allCreditSales } = useFirestoreCollection(debtorsQuery);
  const totalOutstanding = allCreditSales.reduce((acc, cs) => acc + (Number(cs.remainingBalance) || 0), 0);

  const recentActivity = useMemo(() => {
    const list = [];
    (sales || []).forEach((s) => {
      if (s.isVoided) return;
      list.push({ id: `sale-${s.id}`, type: 'Sale', title: `${s.quantity} × ${s.productName}`, subtitle: `Sold by ${s.soldByName || 'Staff'}`, amount: s.totalAmount, method: s.paymentMethod, timestamp: s.soldAt, isPositive: true });
    });
    (repayments || []).forEach((r) => {
      list.push({ id: `repayment-${r.id}`, type: 'Debt Repayment', title: `${r.customerName || 'Customer'} — ${r.productName || 'repayment'}`, subtitle: `Recorded by ${r.recordedByName || 'Staff'}`, amount: r.amount, method: r.method, timestamp: r.paidAt, isPositive: true });
    });
    return list.sort((a, b) => {
      const aTime = a.timestamp?.toMillis?.() ?? a.timestamp?.toDate?.()?.getTime?.() ?? new Date(a.timestamp || 0).getTime();
      const bTime = b.timestamp?.toMillis?.() ?? b.timestamp?.toDate?.()?.getTime?.() ?? new Date(b.timestamp || 0).getTime();
      return bTime - aTime;
    }).slice(0, 8);
  }, [sales, repayments]);

  const handleCreateCustomer = async ({ name, phone }) => {
    const ref = await addDoc(tenantCollection('customers'), withBusiness({ name, phone, email: '', address: '', notes: '', createdAt: serverTimestamp() }, businessId));
    return { id: ref.id, name, phone };
  };

  // FIX: Replaced runTransaction with writeBatch(db) for offline-safe Quick-Sale.
  const handleConfirmSale = async ({ product, quantity, soldPricePerUnit, paymentMethod, mpesaCode }) => {
    const productRef = doc(db, 'products', product.id);
    const saleRef = doc(collection(db, 'sales'));
    const saleData = withBusiness({
      productId: product.id, productName: product.name, quantity,
      costPricePerUnit: product.costPrice, soldPricePerUnit,
      totalAmount: soldPricePerUnit * quantity,
      profit: (soldPricePerUnit - product.costPrice) * quantity,
      paymentMethod, mpesaCode: mpesaCode || null,
      soldBy: profile.uid, soldByName: profile.displayName,
      soldAt: serverTimestamp(), isCredit: false, isVoided: false,
    }, businessId);

    const batch = writeBatch(db);
    batch.update(productRef, { stock: increment(-quantity), updatedAt: serverTimestamp() });
    batch.set(saleRef, saleData);
    await batch.commit();

    return { id: saleRef.id, ...saleData, soldAt: new Date() };
  };

  // FIX: Replaced runTransaction with writeBatch(db) for offline-safe Quick Credit.
  const handleConfirmCredit = async ({ product, quantity, soldPricePerUnit, customerId, customerName, customerPhone }) => {
    const productRef = doc(db, 'products', product.id);
    const totalAmount = soldPricePerUnit * quantity;
    const creditRef = doc(collection(db, 'creditSales'));
    const creditData = withBusiness({
      customerId, customerName, customerPhone: customerPhone || '',
      productId: product.id, productName: product.name, quantity,
      costPricePerUnit: product.costPrice, soldPricePerUnit, totalAmount,
      soldBy: profile.uid, soldByName: profile.displayName, soldAt: serverTimestamp(),
      status: 'pending', amountPaid: 0, remainingBalance: totalAmount, paymentHistory: [],
      isCredit: true
    }, businessId);

    const batch = writeBatch(db);
    batch.update(productRef, { stock: increment(-quantity), updatedAt: serverTimestamp() });
    batch.set(creditRef, creditData);
    await batch.commit();

    return { id: creditRef.id, ...creditData, soldAt: new Date() };
  };

  const handleProductSave = async (data) => {
    try {
      if (editProduct) { await updateProduct(editProduct.id, data, editProduct.barcode, businessId); toast.success('Product updated'); }
      else { await createProduct(data, businessId); toast.success('Product added'); }
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
    finally { setEditProd(null); setProdModal(false); setPrefillBarcode(null); }
  };

  const handleSupplierSave = async (supplierData) => {
    try {
      const ref = await addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
      setNewSupplierId(ref.id);
      setSupplierModal(false);
      toast.success('Supplier added');
    } catch (err) { toast.error(err.message); }
  };

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) setActiveProduct(found);
    else setNotFoundCode(code);
  };

  useHardwareScanner(handleScanDetected, {
    enabled: !!session && !isClosed && !activeProduct && !prodModal && !supplierModal && !scannerOpen && !notFoundCode && !completedSale,
  });

  if (sessionLoading) return <LoadingSpinner label="Loading today's session…" />;

  if (isClosed) {
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <EmptyState title="Day is closed" description="Sales are locked until you reopen the session or tomorrow starts." />
        {isAdmin && <button className="btn-primary w-full" onClick={reopenSession}>Reopen today's session</button>}
      </div>
    );
  }
  if (!session) {
    return <OpenSessionPrompt onOpen={(floats) => openSession({ ...floats, openedBy: profile.uid })} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Hello, {profile?.displayName}</h1>
          <div className="flex items-center gap-2 mt-1">
            {isAdmin && (
<Link to="/pro" className={`badge text-[11px] font-bold transition-colors ${isPro ? 'bg-amber-100 text-amber-800' : 'bg-moss-600 text-white hover:bg-moss-700 active:bg-moss-800'}`}>                {isPro ? 'FlowBiz Pro ✓' : 'Explore FlowBiz Pro'}
              </Link>
            )}
            <p className="text-sm text-ink-400">{isAdmin ? "Here's how the shop is doing today." : 'Ready to make a sale.'}</p>
          </div>
        </div>
        <button
          onClick={togglePrivacyMode}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-400 hover:bg-ink-100 hover:text-ink-700 shadow-sm transition-colors"
          title={privacyMode ? 'Show sensitive balances' : 'Hide sensitive balances'}
        >
          {privacyMode ? <EyeOff className="h-5 w-5 text-rust-600 animate-fade-in" strokeWidth={1.75} /> : <Eye className="h-5 w-5 text-moss-700 animate-fade-in" strokeWidth={1.75} />}
        </button>
      </div>

      {isAdmin && (
        <>
          {financialsLoading ? <LoadingSpinner /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-in">
              <StatCard label="Cash Received Today" value={formatVal(dashboardCashReceived)} />
              <StatCard label="M-Pesa Received Today" value={formatVal(dashboardMpesaReceived)} />
              <StatCard label="Today's net profit" value={formatVal(dashboardNetProfit)} tone="text-moss-700" />
              <StatCard label="Today's expenses" value={formatVal(dashboardExpenses)} tone="text-rust-600" />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Inventory value (cost)" value={formatVal(totalInventoryValue)} />
<StatCard label="Outstanding debt (Deni)" value={formatVal(totalOutstanding)} tone="text-rust-600" sub={<Link to="/customers" className="font-semibold text-moss-700 hover:underline">View customers</Link>} />
            <StatCard label="Low stock items" value={lowStock.length} tone={lowStock.length > 0 ? 'text-rust-600' : 'text-moss-700'} sub={<Link to="/products" className="font-semibold text-moss-700 hover:underline">View products</Link>} />
          </div>
        </>
      )}

      <div>
        <h2 className="font-display text-sm font-bold text-ink-800 mb-2">Today's Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-400">No activity recorded today yet.</div>
        ) : (
          <div className="card divide-y divide-ink-100">
            {recentActivity.map((act) => (
              <div key={act.id} className="flex items-center justify-between p-3 text-sm">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-ink-800 truncate">{act.title}</p>
                    <span className="badge bg-moss-100 text-moss-800">{act.type}</span>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">{act.method} · {formatDateTime(act.timestamp)}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-semibold text-moss-700">+{formatVal(act.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SaleModal 
        open={!!activeProduct} 
        product={activeProduct} 
        customers={customers} 
        onClose={(record) => {
          setActiveProduct(null);
          if (record && record.id) setCompletedSale(record);
        }} 
        onConfirmSale={handleConfirmSale} 
        onConfirmCredit={handleConfirmCredit} 
        onCreateCustomer={handleCreateCustomer} 
      />
      <SaleCompleteModal open={!!completedSale} sale={completedSale} onClose={() => setCompletedSale(null)} />

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!notFoundCode} onClose={() => setNotFoundCode(null)} title="Product not found" widthClass="max-w-xs">
        <p className="text-sm text-ink-500 mb-4">No product matches barcode <span className="font-mono">{notFoundCode}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setNotFoundCode(null)}>Cancel</button>
          {isAdmin ? (
            <button className="btn-primary" onClick={() => { setEditProd(null); setPrefillBarcode(notFoundCode); setNotFoundCode(null); setProdModal(true); }}>Create Product</button>
          ) : (
            <span className="self-center text-xs text-ink-400">Ask an owner to add this product.</span>
          )}
        </div>
      </Modal>

<ProductFormModal
        open={prodModal}
        onClose={() => { setProdModal(false); setEditProd(null); setPrefillBarcode(null); }}
        onSave={handleProductSave}
        suppliers={suppliers}
        initialProduct={editProduct}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
      />
      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
    </div>
  );
}
````

## File: src/pages/ForgotPassword.jsx
````javascript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: true,
      });
      setSent(true);
} catch (err) {
      // FIX: previously every error EXCEPT invalid-email/too-many-requests
      // silently showed "sent" — including real failures (unauthorized
      // continue URL, network errors, misconfigured project), which is
      // why resets appeared to silently vanish. Only auth/user-not-found
      // is safe to mask as success; everything else now shows a real
      // message, and every error is logged so DevTools shows the cause.
      console.error('[FlowBiz] sendPasswordResetEmail failed:', err.code || err.name, err.message);
      const message =
        err.code === 'auth/invalid-email'             ? 'Please enter a valid email address.' :
        err.code === 'auth/too-many-requests'         ? 'Too many requests. Please wait a bit before trying again.' :
        err.code === 'auth/unauthorized-continue-uri' ? 'This site is not yet authorized to send reset links. Please contact support.' :
        err.code === 'auth/user-not-found'            ? null :
        "Couldn't send the reset email. Please try again in a moment.";
      if (message === null) {
        setSent(true);
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Reset your password</h1>
            <p className="text-sm text-ink-400">Enter your account email and we'll send you a reset link.</p>
          </div>
        </div>

        {sent ? (
          <div className="card p-6 text-center space-y-3">
            <div className="text-3xl">📧</div>
            <p className="text-sm text-ink-600">If an account exists for <span className="font-semibold">{email.trim()}</span>, a password reset link is on its way. Check your inbox (and spam folder).</p>
            <Link to="/login" className="btn-primary w-full">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4 p-6">
            {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
            <div>
              <label className="label">Email</label>
              <input type="email" required className="input" placeholder="owner@yourbusiness.co.ke" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" autoFocus />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</button>
          </form>
        )}

        <p className="text-center text-sm text-ink-400">
          Remembered it? <Link to="/login" className="font-semibold text-moss-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
````

## File: src/pages/Login.jsx
````javascript
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
export default function Login() {
  const { login, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (firebaseUser) navigate(location.state?.from?.pathname || '/', { replace: true });
  }, [firebaseUser, navigate, location]);

  const handle = async e => {
    e.preventDefault(); setError(null); setSubmitting(true);
try {
  await login(email.trim(), password);
  toast.success('Welcome back!');
}
catch (err) {
  if (
    err.code === 'auth/invalid-credential' ||
    err.code === 'auth/wrong-password' ||
     err.code === 'auth/user-not-found' ||
   err.code === 'auth/invalid-email'
  ) {
    setError('Incorrect email or password.');
  } else if (err.code === 'auth/too-many-requests') {
    setError('Too many login attempts. Please try again later.');
    } else if (err.code === 'auth/user-disabled') {
   setError('This account has been disabled. Please contact your business owner.');
   
  } else {
    setError('Something went wrong signing in. Please try again.');
  }
}
finally {
  setSubmitting(false);
}
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div><h1 className="font-display text-2xl font-bold text-white">FlowBiz</h1><p className="text-sm text-ink-400">Business Manager</p></div>
        </div>
        <form onSubmit={handle} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
          <div><label className="label">Email</label><input type="email" required className="input" placeholder="owner@yourbusiness.co.ke" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" /></div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label !mb-0">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-moss-400 hover:underline mb-1.5">Forgot password?</Link>
            </div>
            <input type="password" required className="input" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting?'Signing in…':'Sign in'}</button>
        </form>
        <p className="text-center text-sm text-ink-400">New to FlowBiz? <Link to="/setup" className="font-semibold text-moss-400 hover:underline">Create a business</Link></p>
      </div>
    </div>
  );
}
````

## File: src/pages/Products.jsx
````javascript
import { useMemo, useState } from 'react';
import { orderBy, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Pencil, Trash2, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, withBusiness, tenantCollection } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct, updateProduct, softDeleteProduct } from '../utils/products';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES } from '../utils/currency';

export default function Products() {
  const { businessId } = useAuth();
  const productsQ = useMemo(
    () => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null,
    [businessId]
  );
  const suppliersQ = useMemo(() => businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null, [businessId]);
  const { data: products, loading, error } = useFirestoreCollection(productsQ);
  const { data: suppliers } = useFirestoreCollection(suppliersQ);
  
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [pendingDel, setPendingDel] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanFoundProduct, setScanFoundProduct] = useState(null);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search.trim())) ||
      (p.internalCode && p.internalCode.toLowerCase().includes(search.toLowerCase()))
  );
  const suppName = (id) => suppliers.find((s) => s.id === id)?.name || '—';

  const closeFormModal = () => { setModal(false); setEditing(null); setPrefillBarcode(null); };

  const handleSave = async (data) => {
    try {
      if (editing) {
        await updateProduct(editing.id, data, editing.barcode, businessId);
        toast.success('Product updated');
      } else {
        await createProduct(data, businessId);
        toast.success('Product added');
      }
      closeFormModal();
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
  };

  const handleSupplierSave = async (supplierData) => {
    try {
      const ref = await addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
      setNewSupplierId(ref.id);
      setSupplierModal(false);
      toast.success('Supplier added');
    } catch (err) { toast.error(err.message); }
  };

  const handleDel = async () => {
    try { await softDeleteProduct(pendingDel.id); toast.success('Product archived'); }
    catch (err) {toast.error(friendlyErrorMessage(err)); }
    finally { setPendingDel(null); }
  };

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) setScanFoundProduct(found);
    else { setEditing(null); setPrefillBarcode(code); setModal(true); }
  };

  useHardwareScanner(handleScanDetected, { enabled: !modal && !supplierModal && !scannerOpen && !scanFoundProduct });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-xl font-bold text-ink-900">Products</h1><p className="text-sm text-ink-400">{products.length} items</p></div>
        <div className="flex gap-2">
          <Link to="/inventory-intelligence" className="btn-outline">
            <TrendingUp className="h-4 w-4" /> Intelligence
          </Link>
          <button className="btn-primary" onClick={() => { setEditing(null); setPrefillBarcode(null); setModal(true); }}>+ Add product</button>
        </div>
      </div>
      <input className="input" placeholder="Search by name, category, or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ErrorBanner message={error} />
      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState title="No products yet" description="Add your first product to start tracking stock." action={<button className="btn-primary" onClick={() => setModal(true)}>+ Add product</button>} />
      ) : (
        <>
          <div className="space-y-2.5 sm:hidden">
            {filtered.map((p) => (
              <div key={p.id} className={`card p-3.5 space-y-2 ${p.stock <= (p.lowStockThreshold ?? 5) ? 'border-rust-200 bg-rust-50/20' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="badge bg-ink-100 text-ink-500 text-[10px] mb-1">{p.category}</span>
                    <h3 className="font-semibold text-ink-800 leading-tight truncate">{p.name}</h3>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100" onClick={() => { setEditing(p); setPrefillBarcode(null); setModal(true); }}><Pencil className="h-4 w-4" strokeWidth={1.75} /></button>
                    <button className="rounded-lg p-1.5 text-rust-400 hover:bg-rust-50" onClick={() => setPendingDel(p)}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-ink-100 text-xs">
                  <div>
                    <span className="text-ink-400">Retail: </span><span className="font-display font-bold text-moss-700">{formatKES(p.sellingPrice)}</span>
                  </div>
                  <span className={`font-semibold ${p.stock <= (p.lowStockThreshold ?? 5) ? 'text-rust-600' : 'text-ink-700'}`}>{p.stock} in stock {p.stock <= (p.lowStockThreshold ?? 5) ? '⚠️' : ''}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Cat.</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Retail</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3 w-16"></th></tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filtered.map((p) => (
                    <tr key={p.id} className={p.stock <= (p.lowStockThreshold ?? 5) ? 'bg-rust-50/40' : ''}>
                      <td className="px-4 py-3 font-semibold text-ink-800">{p.name}</td>
                      <td className="px-4 py-3 text-ink-500">{p.category}</td>
                      <td className="px-4 py-3 text-ink-500">{formatKES(p.costPrice)}</td>
                      <td className="px-4 py-3 font-semibold text-moss-700">{formatKES(p.sellingPrice)}</td>
                      <td className="px-4 py-3"><span className={p.stock <= (p.lowStockThreshold ?? 5) ? 'font-bold text-rust-600' : 'text-ink-700'}>{p.stock}</span></td>
                      <td className="px-4 py-3 text-ink-500">{suppName(p.supplierId)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button className="rounded p-1.5 text-ink-400 hover:bg-ink-100" onClick={() => { setEditing(p); setPrefillBarcode(null); setModal(true); }}><Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /></button>
                          <button className="rounded p-1.5 text-rust-400 hover:bg-rust-50" onClick={() => setPendingDel(p)}><Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!scanFoundProduct} onClose={() => setScanFoundProduct(null)} title="Barcode already registered" widthClass="max-w-xs">
        <p className="text-sm text-ink-500 mb-4">This barcode already belongs to <span className="font-semibold text-ink-800">{scanFoundProduct?.name}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setScanFoundProduct(null)}>Cancel</button>
          <button className="btn-primary" onClick={() => { setEditing(scanFoundProduct); setPrefillBarcode(null); setScanFoundProduct(null); setModal(true); }}>View Product</button>
        </div>
      </Modal>

<ProductFormModal open={modal} onClose={closeFormModal} onSave={handleSave} suppliers={suppliers} initialProduct={editing} prefillBarcode={prefillBarcode} onAddSupplier={() => setSupplierModal(true)} newSupplierId={newSupplierId} productCount={products.length} />      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
      <ConfirmDialog open={!!pendingDel} title="Archive this product?" message={`"${pendingDel?.name}" will be moved to Archived Data. You can restore it later from Settings.`} confirmLabel="Archive" danger onConfirm={handleDel} onCancel={() => setPendingDel(null)} />
    </div>
  );
}
````

## File: src/pages/Purchases.jsx
````javascript
import { useMemo, useState } from 'react';
import { doc, writeBatch, increment, serverTimestamp, orderBy, where, limit, addDoc, collection } from 'firebase/firestore';

import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct } from '../utils/products';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES } from '../utils/currency';
import { formatDateTime } from '../utils/dateRanges';

const empty = { supplierId:'', productId:'', quantity:'', costPricePerUnit:'', paymentStatus:'paid', paymentMethod:'Cash', mpesaCode:'' };

export default function Purchases() {
  const { profile, businessId } = useAuth();
  const productsQ  = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  const suppliersQ = useMemo(() => businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null, [businessId]);
  const purchasesQ = useMemo(() => businessId ? tenantQuery('purchases', businessId, orderBy('purchasedAt','desc'), limit(50)) : null, [businessId]);
  const { data: products }  = useFirestoreCollection(productsQ);
  const { data: suppliers } = useFirestoreCollection(suppliersQ);
  const { data: purchases, loading } = useFirestoreCollection(purchasesQ);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const set = f => e => setForm(p=>({...p,[f]:e.target.value}));

  const selProd = products.find(p=>p.id===form.productId);
  const selSupp = suppliers.find(s=>s.id===form.supplierId);
  const totalCost = (Number(form.quantity)||0)*(Number(form.costPricePerUnit)||0);

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) {
      setForm(p => ({ ...p, productId: found.id }));
      toast.success(`Selected ${found.name}`);
    } else {
      setPrefillBarcode(code);
      setProductModal(true);
    }
  };

  useHardwareScanner(handleScanDetected, { enabled: !productModal && !supplierModal && !scannerOpen });

  const handle = async e => {
    e.preventDefault();
    if (!form.productId||!form.supplierId||!form.quantity||!form.costPricePerUnit) { toast.error('Fill in all fields.'); return; }
    if (form.paymentStatus==='paid'&&form.paymentMethod==='M-Pesa'&&!form.mpesaCode.trim()) { toast.error('Enter M-Pesa code.'); return; }
    setBusy(true);
    try {
      const qty   = Number(form.quantity);
      const cost  = Number(form.costPricePerUnit);
      const total = qty * cost;
      const batch = writeBatch(db);
      batch.update(doc(db,'products',form.productId), { stock:increment(qty), costPrice:cost, updatedAt:serverTimestamp() });
      const purchRef = doc(collection(db,'purchases'));
      batch.set(purchRef, withBusiness({
        supplierId:form.supplierId,
        supplierName:selSupp?.name||'',
        productId:form.productId,
        productName:selProd?.name||'',
        quantity:qty,
        costPricePerUnit:cost,
        totalCost:total,
        purchasedBy:profile.uid,
        purchasedByName:profile.displayName,
        purchasedAt:serverTimestamp(),
        paymentStatus:form.paymentStatus==='paid'?'paid':'pending_supplier_credit',
        paymentMethod:form.paymentStatus==='paid'?form.paymentMethod:null,
        mpesaCode:form.paymentStatus==='paid'&&form.paymentMethod==='M-Pesa'?form.mpesaCode.trim():null,
      }, businessId));
      if (form.paymentStatus==='paid') {
        // NOTE: paid purchases are NOT recorded as an `expenses` doc.
        // Cash/M-Pesa outflow for a paid purchase is already derived from
        // this `purchases` doc directly in utils/financials.js
        // (totalCashOutflows / totalMpesaOutflows), and the purchase gets
        // exactly one Dashboard activity entry. Writing a second `expenses`
        // doc here previously caused a duplicate "Stock Purchase" entry in
        // Recent Activity and incorrectly listed inventory purchases as
        // operating expenses on the Expenses page. 
      }
      await batch.commit();
      toast.success('Purchase recorded and stock updated');
      setForm(empty);
    } catch(err) {toast.error(friendlyErrorMessage(err)); } finally { setBusy(false); }
  };

  const handleSupplierSave = async (data) => {
    try {
      const ref = await addDoc(tenantCollection('suppliers'), withBusiness({ ...data, createdAt:serverTimestamp() }, businessId));
      setNewSupplierId(ref.id);
      setForm(p=>({...p, supplierId: ref.id}));
      setSupplierModal(false);
      toast.success('Supplier added');
    } catch(err) { toast.error(err.message); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Record Purchase</h1>
      <form onSubmit={handle} className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={form.supplierId} onChange={set('supplierId')} required>
              <option value="">— Select —</option>
              {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="button" className="mt-2 text-sm font-semibold text-moss-700" onClick={()=>setSupplierModal(true)}>+ Add new supplier</button>
          </div>
          <div>
            <label className="label">Product</label>
            <select className="input" value={form.productId} onChange={set('productId')} required>
              <option value="">— Select —</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" className="mt-2 text-sm font-semibold text-moss-700" onClick={()=>{setPrefillBarcode(null);setProductModal(true);}}>+ Add new product</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Qty received</label><input type="number" min="1" className="input" value={form.quantity} onChange={set('quantity')} required /></div>
          <div><label className="label">Cost / unit (KES)</label><input type="number" min="0" step="0.01" className="input" value={form.costPricePerUnit} onChange={set('costPricePerUnit')} required /></div>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">Total cost: <span className="font-semibold">{formatKES(totalCost)}</span></div>
        <div>
          <label className="label">Payment status</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={()=>setForm(p=>({...p,paymentStatus:'paid'}))} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.paymentStatus==='paid'?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>Paid now</button>
            <button type="button" onClick={()=>setForm(p=>({...p,paymentStatus:'credit'}))} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.paymentStatus==='credit'?'border-rust-500 bg-rust-50 text-rust-700':'border-ink-200 text-ink-500'}`}>On credit</button>
          </div>
        </div>
        {form.paymentStatus==='paid'&&(
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Paid via</label><select className="input" value={form.paymentMethod} onChange={set('paymentMethod')}><option>Cash</option><option>M-Pesa</option></select></div>
            {form.paymentMethod==='M-Pesa'&&<div><label className="label">M-Pesa code</label><input className="input uppercase" value={form.mpesaCode} onChange={set('mpesaCode')} /></div>}
          </div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy?'Saving…':'Record purchase'}</button>
      </form>
      <h2 className="font-display text-sm font-bold text-ink-800">Recent purchases</h2>

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={()=>setScannerOpen(false)} onDetected={handleScanDetected} />

<ProductFormModal
        open={productModal}
        onClose={()=>{setProductModal(false);setPrefillBarcode(null);}}
        onSave={async (data) => {
          try {
            const { id } = await createProduct(data, businessId);
            setForm(p=>({...p, productId: id}));
            setProductModal(false);
            setPrefillBarcode(null);
            toast.success('Product added');
          } catch (err) { toast.error(friendlyErrorMessage(err)); }
        }}
        suppliers={suppliers}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
        simplifiedForPurchase
      />
      <SupplierFormModal open={supplierModal} onClose={()=>setSupplierModal(false)} onSave={handleSupplierSave} />
      {loading?<LoadingSpinner />:purchases.length===0?<EmptyState title="No purchases yet" />:(
        <div className="card divide-y divide-ink-100">
          {purchases.map(p=>(
            <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
              <div><p className="font-medium text-ink-700">{p.quantity} × {p.productName}</p><p className="text-xs text-ink-400">{p.supplierName} · {formatDateTime(p.purchasedAt)}</p></div>
              <div className="text-right"><p className="font-semibold text-ink-800">{formatKES(p.totalCost)}</p><span className={`badge ${p.paymentStatus==='paid'?'bg-moss-100 text-moss-700':'bg-rust-100 text-rust-700'}`}>{p.paymentStatus==='paid'?'Paid':'On credit'}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
````

## File: src/router/AppRouter.jsx
````javascript
import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import AppShell from '../components/layout/AppShell';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { prefetchRoutes } from './routePrefetch';

// Defined once, reused by both lazy() and the prefetcher below — calling
// the same import() specifier twice is free (the module system dedupes
// it), so the prefetcher just warms the same chunks lazy() will need.
const routeLoaders = {
  setup: () => import('../pages/Setup'),
  login: () => import('../pages/Login'),
  forgotPassword: () => import('../pages/ForgotPassword'),
  joinStaff: () => import('../pages/JoinStaff'),
  authAction: () => import('../pages/AuthAction'),
  dashboard: () => import('../pages/Dashboard'),
  counter: () => import('../pages/Counter'),
  customers: () => import('../pages/Customers'),
  customerDetail: () => import('../pages/CustomerDetail'),
  expenses: () => import('../pages/Expenses'),
  purchases: () => import('../pages/Purchases'),
  products: () => import('../pages/Products'),
  suppliers: () => import('../pages/Suppliers'),
  stockTake: () => import('../pages/StockTake'),
  reports: () => import('../pages/Reports'),
  closeDay: () => import('../pages/CloseDay'),
  users: () => import('../pages/Users'),
  settings: () => import('../pages/Settings'),
  helpGuide: () => import('../pages/HelpGuide'),
  pro: () => import('../pages/Pro'),
  advancedAnalytics: () => import('../pages/AdvancedAnalytics'),
  inventoryIntelligence: () => import('../pages/InventoryIntelligence'),
};

const Setup      = lazy(routeLoaders.setup);
const Login      = lazy(routeLoaders.login);
const ForgotPassword = lazy(routeLoaders.forgotPassword);
const JoinStaff  = lazy(routeLoaders.joinStaff);
const AuthAction = lazy(routeLoaders.authAction);
const Dashboard  = lazy(routeLoaders.dashboard);
const Counter    = lazy(routeLoaders.counter);
const Customers  = lazy(routeLoaders.customers);
const CustomerDetail = lazy(routeLoaders.customerDetail);
const Expenses   = lazy(routeLoaders.expenses);
const Purchases  = lazy(routeLoaders.purchases);
const Products   = lazy(routeLoaders.products);
const Suppliers  = lazy(routeLoaders.suppliers);
const StockTake  = lazy(routeLoaders.stockTake);
const Reports    = lazy(routeLoaders.reports);
const CloseDay   = lazy(routeLoaders.closeDay);
const Users      = lazy(routeLoaders.users);
const Settings   = lazy(routeLoaders.settings);
const HelpGuide  = lazy(routeLoaders.helpGuide);
const Pro        = lazy(routeLoaders.pro);
const AdvancedAnalytics = lazy(routeLoaders.advancedAnalytics);
const InventoryIntelligence = lazy(routeLoaders.inventoryIntelligence);

function Page({ children, adminOnly = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <AppShell>
        <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
      </AppShell>
    </ProtectedRoute>
  );
}

function PublicOnly({ children }) {
  const { firebaseUser, loading } = useAuth();
  if (loading) return <LoadingSpinner label="Starting FlowBiz…" />;
  if (firebaseUser) return <Navigate to="/" replace />;
  return children;
}

function RoutePrefetcher() {
  const { firebaseUser, isAdmin } = useAuth();
  useEffect(() => {
    if (!firebaseUser) return;
    const common = [routeLoaders.counter, routeLoaders.customers, routeLoaders.customerDetail, routeLoaders.expenses, routeLoaders.helpGuide];
    const adminOnly = [routeLoaders.dashboard, routeLoaders.products, routeLoaders.purchases, routeLoaders.suppliers, routeLoaders.stockTake, routeLoaders.reports, routeLoaders.closeDay, routeLoaders.users, routeLoaders.settings, routeLoaders.pro, routeLoaders.advancedAnalytics, routeLoaders.inventoryIntelligence];
    prefetchRoutes(isAdmin ? [...common, ...adminOnly] : common);
  }, [firebaseUser, isAdmin]);
  return null;
}

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner label="Starting FlowBiz…" />}>
      <RoutePrefetcher />
      <Routes>
        <Route path="/setup" element={<PublicOnly><Setup /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        <Route path="/join/:inviteId" element={<JoinStaff />} />
        <Route path="/auth/action" element={<AuthAction />} />

        <Route path="/"             element={<Page adminOnly><Dashboard /></Page>} />
        <Route path="/pro"          element={<Page adminOnly><Pro /></Page>} />
        <Route path="/advanced-analytics" element={<Page adminOnly><AdvancedAnalytics /></Page>} />
        <Route path="/inventory-intelligence" element={<Page adminOnly><InventoryIntelligence /></Page>} />

        <Route path="/counter"      element={<Page><Counter /></Page>} />
        <Route path="/customers"    element={<Page><Customers /></Page>} />
        <Route path="/customers/:customerId" element={<Page><CustomerDetail /></Page>} />
        <Route path="/expenses"     element={<Page><Expenses /></Page>} />
        <Route path="/purchases"    element={<Page adminOnly><Purchases /></Page>} />
        <Route path="/products"     element={<Page adminOnly><Products /></Page>} />
        <Route path="/suppliers"    element={<Page adminOnly><Suppliers /></Page>} />
        <Route path="/stock-take"   element={<Page adminOnly><StockTake /></Page>} />
        <Route path="/reports"      element={<Page adminOnly><Reports /></Page>} />
        <Route path="/close-day"    element={<Page adminOnly><CloseDay /></Page>} />
        <Route path="/users"        element={<Page adminOnly><Users /></Page>} />
        <Route path="/settings"     element={<Page adminOnly><Settings /></Page>} />
        <Route path="/help"         element={<Page><HelpGuide /></Page>} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
````

## File: src/utils/documentService.js
````javascript
import { jsPDF } from 'jspdf';
import { formatKES } from './currency';
import { formatDateTime } from './dateRanges';

export async function loadImageAsDataUrl(url) {
    if (!url) return null;
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.error('Could not load business logo for PDF:', err);
        return null;
    }
}

async function buildDocument(data, settings, typeLabel) {
    const doc = new jsPDF('p', 'mm', [80, 200]);
    let y = 10;
    const centerX = 40;

    const logoDataUrl = await loadImageAsDataUrl(settings.logoUrl);
    if (logoDataUrl) {
        try {
            const format = logoDataUrl.match(/data:image\/(\w+);/)?.[1]?.toUpperCase() || 'PNG';
            doc.addImage(logoDataUrl, format, centerX - 9, y, 18, 18);
            y += 21;
        } catch (err) {
            console.error('Could not embed business logo in PDF:', err);
        }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(settings.shopName || 'Business Receipt', centerX, y, { align: 'center' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (settings.phone) { 
        doc.text(settings.phone, centerX, y, { align: 'center' }); 
        y += 5; 
    }
    if (settings.email) { 
        doc.text(settings.email, centerX, y, { align: 'center' }); 
        y += 5; 
    }
    if (settings.address) { 
        doc.text(settings.address, centerX, y, { align: 'center' }); 
        y += 5; 
    }

    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(5, y, 75, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text(typeLabel, centerX, y, { align: 'center' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${data.id || 'N/A'}`, 5, y); y += 5;
    doc.text(`Date: ${formatDateTime(data.soldAt || data.recordedAt || new Date())}`, 5, y); y += 5;
    if (data.customerName) {
        doc.text(`Customer: ${data.customerName}`, 5, y); y += 5;
    }
    if (data.isCredit) {
        doc.text(`Status: ${data.status === 'partial' ? 'Partially Paid' : 'Unpaid'}`, 5, y); y += 5;
    } else if (data.paymentMethod || data.method) {
        doc.text(`Payment: ${data.paymentMethod || data.method}`, 5, y); y += 5;
    }

    y += 3;
    doc.line(5, y, 75, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Item', 5, y);
    doc.text('Amount', 75, y, { align: 'right' });
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    const itemName = data.productName || data.description || 'Item';
    const splitName = doc.splitTextToSize(itemName, 45);
    doc.text(splitName, 5, y);
    
    const amountStr = formatKES(data.totalAmount || data.amount || 0);
    doc.text(amountStr, 75, y, { align: 'right' });
    
    y += (splitName.length * 4) + 2;
    if (data.quantity) {
        doc.setFontSize(8);
        // FIX: Display selling price (@ soldPricePerUnit), not buying price
        doc.text(`Qty: ${data.quantity} @ ${formatKES(data.soldPricePerUnit || 0)}`, 5, y);
        y += 6;
    }

    y += 2;
    doc.line(5, y, 75, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (data.isCredit) {
        doc.text('AMOUNT DUE:', 5, y);
        doc.text(formatKES(data.remainingBalance ?? data.totalAmount ?? 0), 75, y, { align: 'right' });
    } else {
        doc.text('TOTAL:', 5, y);
        doc.text(amountStr, 75, y, { align: 'right' });
    }

    y += 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(data.isCredit ? 'Payment due — thank you for your business!' : 'Thank you for your business!', centerX, y, { align: 'center' });

    return doc;
}

export async function generateReceiptPDF(sale, settings) {
    const doc = await buildDocument(sale, settings, 'RECEIPT');
    doc.save(`receipt-${sale.id}.pdf`);
}

export async function printReceipt(sale, settings) {
    const doc = await buildDocument(sale, settings, 'RECEIPT');
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
}

export async function generateInvoicePDF(creditSale, settings) {
    const doc = await buildDocument(creditSale, settings, 'INVOICE');
    doc.save(`invoice-${creditSale.id}.pdf`);
}

export async function printInvoice(creditSale, settings) {
    const doc = await buildDocument(creditSale, settings, 'INVOICE');
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
}

function normalizeKenyanPhone(rawPhone) {
    let digits = String(rawPhone || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) digits = '254' + digits.slice(1);
    else if (!digits.startsWith('254') && digits.length === 9) digits = '254' + digits;
    return digits;
}

function buildWhatsAppMessage(sale, settings) {
    const shopName = settings.shopName || 'FlowBiz Store';
    const label = sale.isCredit ? 'Invoice' : 'Receipt';
    const amountDue = sale.isCredit ? (sale.remainingBalance ?? sale.totalAmount) : sale.totalAmount;
    const lines = [
        `*${shopName}*`,
        `${label} — ${sale.quantity} × ${sale.productName}`,
        `Total: ${formatKES(sale.totalAmount)}`,
    ];
    if (sale.isCredit) lines.push(`Amount due: ${formatKES(amountDue)}`);
    if (settings.phone) lines.push(`Contact: ${settings.phone}`);
    lines.push('', sale.isCredit ? 'Payment due — thank you for your business!' : 'Thank you for your business!');
    return lines.join('\n');
}

export function sendWhatsAppDocument(sale, settings, phone) {
    const digits = normalizeKenyanPhone(phone);
    if (!digits) throw new Error('Enter a valid phone number.');
    const message = buildWhatsAppMessage(sale, settings);
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}
````

## File: src/index.css
````css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Prevent double-tap zoom on interactive elements — smooth POS experience */
  * {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    box-sizing: border-box;
  }

  html {
    @apply font-sans text-ink-900;
    /* Prevent iOS bounce / overscroll that breaks fixed bottom nav */
    overscroll-behavior: none;
    -webkit-text-size-adjust: 100%;
  }

  body {
    @apply bg-sand m-0 p-0;
    overscroll-behavior: none;
    /* Safe area insets for notched phones */
    padding-bottom: env(safe-area-inset-bottom);
    padding-left:   env(safe-area-inset-left);
    padding-right:  env(safe-area-inset-right);
  }

  h1, h2, h3, h4 { @apply font-display; }

  /* Smooth scrolling for all scrollable areas */
  * { scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }

  /* Remove iOS input shadows */
  input, select, textarea, button {
    -webkit-appearance: none;
    appearance: none;
  }

  /* Minimum touch target for all interactive elements */
  button, a, [role="button"] {
    min-height: 44px;
    min-width: 44px;
  }
}

@layer components {
  .btn {
    @apply inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold
           transition-colors disabled:opacity-40 disabled:cursor-not-allowed
           min-h-[44px] active:scale-95;
  }
  /* REDESIGN: primary action color moved from green (moss) to blue — green
     stays reserved for success/positive-status meaning (paid, active,
     profit) elsewhere in the app; blue is now the one color that means
     "primary interactive action", matching every .btn-primary / focused
     .input across the whole app in this one place. */
.btn-primary   { @apply btn bg-moss-600  text-white   hover:bg-moss-700  active:bg-moss-800; }
  .btn-secondary { @apply btn bg-ink-100   text-ink-800 hover:bg-ink-200   active:bg-ink-300; }
  .btn-danger    { @apply btn bg-rust-600  text-white   hover:bg-rust-700  active:bg-rust-800; }
  .btn-outline   { @apply btn border border-ink-200 text-ink-700 hover:bg-ink-50 active:bg-ink-100; }

  .input {
    @apply w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900
           placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-moss-500
           focus:border-moss-500 min-h-[44px];
  }
  .label  { @apply block text-xs font-semibold uppercase tracking-wide text-ink-500 mb-1.5; }
  .card   { @apply bg-white rounded-xl2 border border-ink-100 shadow-sm; }
  .badge  { @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold; }

  /* Bottom nav safe area support on iOS notched devices */
  .bottom-nav-safe {
    padding-bottom: max(0.625rem, env(safe-area-inset-bottom));
  }
}
````

## File: src/components/pos/SaleCompleteModal.jsx
````javascript
import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { generateReceiptPDF, printReceipt, generateInvoicePDF, printInvoice, sendWhatsAppDocument } from '../../utils/documentService';
import { useSettings } from '../../hooks/useSettings';
import { useAuth } from '../../contexts/AuthContext';
import { formatKES } from '../../utils/currency';
import { Printer, Download, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SaleCompleteModal({ open, sale, onClose }) {
  const { settings } = useSettings();
  const { isPro } = useAuth();
  const [phone, setPhone] = useState(sale?.customerPhone || '');

  // Keep phone input synced when a new sale is opened
  useEffect(() => {
    if (sale?.customerPhone) {
      setPhone(sale.customerPhone);
    } else {
      setPhone('');
    }
  }, [sale]);

  if (!sale) return null;

  const docLabel = sale.isCredit ? 'Invoice' : 'Receipt';

  const handlePrint = () => {
    if (!isPro) { toast.error(`Professional printing requires FlowBiz Pro.`); return; }
    if (sale.isCredit) printInvoice(sale, settings);
    else printReceipt(sale, settings);
  };

  const handleDownload = () => {
    if (!isPro) { toast.error(`Professional ${docLabel.toLowerCase()}s require FlowBiz Pro.`); return; }
    if (sale.isCredit) generateInvoicePDF(sale, settings);
    else generateReceiptPDF(sale, settings);
  };

  const handleWhatsApp = () => {
    if (!isPro) { toast.error("WhatsApp integration requires FlowBiz Pro."); return; }
    if (!phone.trim()) {
      toast.error("Please enter a valid customer phone number.");
      return;
    }
    try {
      sendWhatsAppDocument(sale, settings, phone.trim());
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={sale.isCredit ? 'Credit Sale Recorded' : 'Sale Complete'}>
      <div className="space-y-4">
        {/* Fixed rounded-xl2 to rounded-2xl */}
        <div className={`flex flex-col items-center justify-center py-4 rounded-2xl border ${sale.isCredit ? 'bg-rust-50 border-rust-200' : 'bg-moss-50 border-moss-200'}`}>
          <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${sale.isCredit ? 'bg-rust-100 text-rust-700' : 'bg-moss-100 text-moss-700'}`}>
            {sale.isCredit ? '⏳' : '✓'}
          </div>
          <h2 className={`font-display font-bold ${sale.isCredit ? 'text-rust-700' : 'text-moss-800'}`}>
            {sale.isCredit ? 'Credit sale recorded' : 'Sale recorded successfully'}
          </h2>
          <p className="text-sm font-semibold mt-2 text-ink-800">{sale.quantity} × {sale.productName}</p>
          {sale.isCredit && sale.customerName && <p className="text-xs text-ink-500">{sale.customerName}</p>}
          <p className="text-lg font-bold text-ink-900">{formatKES(sale.totalAmount)}</p>
          <p className={`text-xs mt-1 font-semibold ${sale.isCredit ? 'text-rust-600' : 'text-ink-500'}`}>
            {sale.isCredit ? 'Payment Status: Unpaid' : sale.paymentMethod}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print {docLabel}
          </button>
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download {docLabel}
          </button>
        </div>

        <div className="rounded-lg border border-ink-100 p-3 space-y-2">
          <label className="label">WhatsApp {docLabel}</label>
          <div className="flex gap-2">
            <input 
              className="input flex-1" 
              placeholder="Customer Phone" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
            />
            <button className="btn-primary flex items-center justify-center gap-2" onClick={handleWhatsApp}>
              <MessageCircle className="h-4 w-4" /> Send via WhatsApp
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-ink-100">
          <button className="btn-secondary w-full" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
````

## File: src/demo/localAuth.js
````javascript
export const DEMO_UID = 'demo-admin';

const DEMO_USER = {
  uid: DEMO_UID,
  email: 'demo@flowbiz.app',
  displayName: 'Demo Owner',
  emailVerified: true,
};

export function getAuth() {
  return { __demo: true, currentUser: DEMO_USER };
}

export function onAuthStateChanged(_auth, callback) {
  const timer = setTimeout(() => callback(DEMO_USER), 0);
  return () => clearTimeout(timer);
}

export async function signInWithEmailAndPassword() {
  return { user: DEMO_USER };
}

export async function signOut() {
  return Promise.resolve();
}

export async function createUserWithEmailAndPassword() {
  throw new Error('Account creation is not available in Demo Mode.');
}

export async function sendEmailVerification() {
  return Promise.resolve();
}

export async function reload() {
  return Promise.resolve();
}

export async function deleteUser() {
  return Promise.resolve();
}

export async function applyActionCode() {
  return Promise.resolve();
}

export async function checkActionCode() {
  return Promise.resolve({});
}

// FIX: ForgotPassword.jsx and AuthAction.jsx's reset-password panel now
// import these. Unreachable in normal Demo Mode use — stubbed only so
// the aliased 'firebase/auth' import never breaks the build.
export async function sendPasswordResetEmail() {
  return Promise.resolve();
}

export async function verifyPasswordResetCode() {
  return Promise.resolve(DEMO_USER.email);
}

export async function confirmPasswordReset() {
  return Promise.resolve();
}
````

## File: cloudflare-worker/wrangler.toml
````toml
name = "flowbiz-api"
main = "src/index.js"
compatibility_date = "2025-01-01"

# Secrets — set these with `wrangler secret put <NAME>`, NEVER written here:
#   FIREBASE_SERVICE_ACCOUNT_JSON   (the full service-account JSON, as one string)
#   PAYSTACK_SECRET_KEY
#   WHATSAPP_ACCESS_TOKEN

[vars]
FIREBASE_PROJECT_ID = "swiftstock-bc6a3"
ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,https://flowbiz.pages.dev"
WHATSAPP_PHONE_NUMBER_ID = "your-whatsapp-phone-number-id"
PAYSTACK_CALLBACK_URL = "https://flowbiz.pages.dev/pro"
````
