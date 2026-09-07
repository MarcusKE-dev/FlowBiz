// A Firestore + Firebase stub for the admin route tests.
//
// It differs from the one inside adminAccessControl.test.js in one way
// that matters: IT APPLIES ITS WRITES. That is what lets a test assert
// the STATE a handler leaves behind — "the account is active again",
// "no document disappeared" — rather than merely which HTTP calls it
// made, which is the difference between testing a lifecycle and testing
// a call log.
//
// The ID token is genuinely RS256-signed and genuinely verified by the
// code under test; only the network is stubbed.

import { Buffer } from 'node:buffer';
import { generateKeyPairSync, createSign } from 'node:crypto';

export const PROJECT = 'swiftstock-test';
const KID = 'test-kid-1';

const idKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const saKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = idKeys.publicKey.export({ format: 'jwk' });
const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function mintIdToken({ uid = 'admin-uid', email = 'ops@flowbiz.co.ke', kid = KID, aud = PROJECT } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const payload = b64url(JSON.stringify({
    sub: uid, email, aud,
    iss: `https://securetoken.google.com/${aud}`,
    iat: now - 10, exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${b64url(signer.sign(idKeys.privateKey))}`;
}

const toValue = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
};
export const toFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)]));

const fromValue = (v) => {
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]));
  return null;
};

/**
 * Installs the stub on globalThis.fetch and returns the handles a test
 * needs: the store itself, the Identity Toolkit call log, and the env.
 */
export function installStub() {
  const state = { store: {}, identityCalls: [] };

  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    let body = null;
    if (init.body) { try { body = JSON.parse(init.body); } catch { body = String(init.body); } }

    if (u.includes('/jwk/securetoken')) {
      return new Response(JSON.stringify({ keys: [{ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' }] }), { status: 200 });
    }
    if (u.includes('oauth2.googleapis.com')) {
      return new Response(JSON.stringify({ access_token: 'stub', expires_in: 3600 }), { status: 200 });
    }
    if (u.includes('identitytoolkit.googleapis.com')) {
      state.identityCalls.push({ url: u, body });
      return new Response('{}', { status: 200 });
    }
    if (u.includes(':runQuery')) {
      const q = body.structuredQuery;
      const collection = q.from[0].collectionId;
      const wanted = [];
      if (q.where?.fieldFilter) wanted.push(q.where.fieldFilter);
      for (const f of q.where?.compositeFilter?.filters || []) wanted.push(f.fieldFilter);

      let rows = Object.entries(state.store)
        .filter(([k]) => k.startsWith(`${collection}/`))
        .filter(([, v]) => wanted.every((f) => v[f.field.fieldPath] === fromValue(f.value)));

      const order = (q.orderBy || [])[0];
      if (order) {
        const field = order.field.fieldPath;
        const direction = order.direction === 'ASCENDING' ? 1 : -1;
        rows = rows.sort(([, a], [, b]) => {
          const av = a[field] instanceof Date ? a[field].getTime() : (a[field] ?? 0);
          const bv = b[field] instanceof Date ? b[field].getTime() : (b[field] ?? 0);
          return av < bv ? -direction : av > bv ? direction : 0;
        });
      }

      const out = rows
        .slice(q.offset || 0, (q.offset || 0) + (q.limit || 1000))
        .map(([k, v]) => ({
          document: { name: `projects/${PROJECT}/databases/(default)/documents/${k}`, fields: toFields(v) },
        }));
      return new Response(JSON.stringify(out), { status: 200 });
    }

    const m = u.match(/\/documents\/(.+?)(\?|$)/);
    if (m) {
      const path = decodeURIComponent(m[1]);

      // COLLECTION LISTING. A path with no slash is a collection, not a
      // document, and a GET on it is Firestore's `listDocuments`. The stub
      // used to fall through to the document branch, find nothing at the
      // key `businesses`, and answer 404 — which made every handler that
      // walks a whole collection (the admin directory, the renewal
      // reminder job) silently see an empty platform in tests.
      if (!path.includes('/') && (!init.method || init.method === 'GET')) {
        const params = new URL(u).searchParams;
        const pageSize = Number(params.get('pageSize')) || 100;
        const startAfter = params.get('pageToken');

        const keys = Object.keys(state.store)
          .filter((k) => k.startsWith(`${path}/`) && k.split('/').length === 2)
          .sort();
        const from = startAfter ? keys.indexOf(startAfter) + 1 : 0;
        const page = keys.slice(from, from + pageSize);
        const more = from + pageSize < keys.length;

        return new Response(JSON.stringify({
          documents: page.map((k) => ({
            name: `projects/${PROJECT}/databases/(default)/documents/${k}`,
            fields: toFields(state.store[k]),
          })),
          ...(more ? { nextPageToken: page[page.length - 1] } : {}),
        }), { status: 200 });
      }

      if (init.method === 'DELETE') {
        if (!(path in state.store)) return new Response('', { status: 404 });
        delete state.store[path];
        return new Response('{}', { status: 200 });
      }
      if (init.method === 'PATCH') {
        const patch = Object.fromEntries(Object.entries(body.fields || {}).map(([k, v]) => [k, fromValue(v)]));
        state.store[path] = { ...(state.store[path] || {}), ...patch };
        return new Response('{}', { status: 200 });
      }
      if (init.method === 'POST') {
        const documentId = new URL(u).searchParams.get('documentId');
        state.store[`${path.split('?')[0]}/${documentId}`] = Object.fromEntries(
          Object.entries(body.fields || {}).map(([k, v]) => [k, fromValue(v)])
        );
        return new Response('{}', { status: 200 });
      }
      const doc = state.store[path];
      if (!doc) return new Response('', { status: 404 });
      return new Response(JSON.stringify({ fields: toFields(doc) }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };

  return state;
}

export const env = {
  FIREBASE_PROJECT_ID: PROJECT,
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: 'sa@test.iam.gserviceaccount.com',
    private_key: saKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }),
  ADMIN_EMAILS: '',
  ALLOWED_ORIGINS: 'https://admin.flowbiz.co.ke',
  APP_BASE_URL: 'https://app.flowbiz.co.ke',
};

/** A JSON request carrying an administrator's verified token. */
export function adminRequest(path, { token = null, method = 'GET', body = null, headers = {} } = {}) {
  return new Request(`https://api.test${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
