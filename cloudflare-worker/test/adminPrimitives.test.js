// Security + query behaviour tests for the FlowBiz admin API.
//
// Firestore and Google auth are stubbed at the fetch boundary, so these
// exercise the real handler code paths: authorisation, id validation,
// tenant scoping, cursor pagination and projection.

import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = new URL('../src/', import.meta.url).href;

// ── Stub the network ─────────────────────────────────────────────────
const calls = [];
let fixtures = {};

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  let body = null;
  if (init.body) { try { body = JSON.parse(init.body); } catch { body = String(init.body); } }
  if (!u.includes('oauth2.googleapis.com')) calls.push({ url: u, method: init.method || 'GET', body });

  if (u.includes('oauth2.googleapis.com') || u.includes('/token')) {
    return new Response(JSON.stringify({ access_token: 'stub', expires_in: 3600 }), { status: 200 });
  }
  if (u.includes(':runAggregationQuery')) {
    return new Response(JSON.stringify([
      { result: { aggregateFields: { count: { integerValue: '7' }, total: { doubleValue: 1234 }, avg: { doubleValue: 12 } } } },
    ]), { status: 200 });
  }
  if (u.includes(':runQuery')) {
    const coll = body?.structuredQuery?.from?.[0]?.collectionId;
    const docs = (fixtures[coll] || []).map((d) => ({
      document: {
        name: `projects/p/databases/(default)/documents/${coll}/${d.id}`,
        fields: Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, v])),
      },
    }));
    return new Response(JSON.stringify(docs), { status: 200 });
  }
  // Single document GET
  const m = u.match(/documents\/([^/?]+)\/([^/?]+)/);
  if (m) {
    const [, coll, id] = m;
    const doc = (fixtures[`${coll}/${decodeURIComponent(id)}`]);
    if (!doc) return new Response('', { status: 404 });
    return new Response(JSON.stringify({ fields: doc }), { status: 200 });
  }
  return new Response('{}', { status: 200 });
};

// crypto.randomUUID exists in node 19+; Response/Request are global in 18+.
// A real (throwaway) RSA key, because googleAuth signs a JWT for real
// before it ever reaches the stubbed token endpoint.
import { generateKeyPairSync } from 'node:crypto';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  FIREBASE_PROJECT_ID: 'p',
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }),
  ADMIN_EMAILS: '',
};

// ── Stub the Google token minting (googleAuth uses jose-less crypto) ──
const firestore = await import(`${BASE}lib/firestore.js`);


// ── validate.js — id validation ──
const { assertBusinessId, intParam, enumParam, dateParam } =
  await import(`${BASE}lib/validate.js`);

test('accepts a normal Firestore id', () => {
  assert.equal(assertBusinessId('abc123_XY-z'), 'abc123_XY-z');
});
for (const bad of ['../users', 'a/b', '..', '.', 'a/../b', '%2e%2e%2fusers', '', 'x'.repeat(129), 'a b', 'a.b']) {
  test(`rejects ${JSON.stringify(bad)}`, () => {
    assert.throws(() => assertBusinessId(bad), /Invalid business id/);
  });
}
test('rejects non-strings', () => {
  assert.throws(() => assertBusinessId(null));
  assert.throws(() => assertBusinessId({ toString: () => 'ok' }));
});
test('intParam clamps out-of-range input', () => {
  const url = new URL('https://x/?limit=99999&neg=-5');
  assert.equal(intParam(url, 'limit', { fallback: 25, min: 5, max: 100 }), 100);
  assert.equal(intParam(url, 'neg', { fallback: 25, min: 5, max: 100 }), 5);
  assert.equal(intParam(url, 'missing', { fallback: 25, min: 5, max: 100 }), 25);
  assert.equal(intParam(new URL('https://x/?limit=abc'), 'limit', { fallback: 7, min: 1, max: 10 }), 7);
});
test('enumParam refuses values outside the allow-list', () => {
  const url = new URL('https://x/?plan=DROP+TABLE');
  assert.equal(enumParam(url, 'plan', ['all', 'free'], 'all'), 'all');
});
test('dateParam returns null for junk', () => {
  assert.equal(dateParam(new URL('https://x/?from=notadate'), 'from'), null);
  assert.ok(dateParam(new URL('https://x/?from=2026-01-01'), 'from') instanceof Date);
});

// ── adminAuth.js — role model ──
const { PERMISSIONS, requirePermission, can, permissionsFor, ROLES } =
  await import(`${BASE}lib/adminAuth.js`);

const asRole = (role) => ({ uid: 'u', email: 'e@x.com', name: 'n', role, isSuperAdmin: role === 'SUPER_ADMIN' });

test('SUPPORT cannot suspend a business', () => {
  assert.throws(() => requirePermission(asRole('SUPPORT'), 'business.status'), /not permitted/);
});
test('SUPPORT cannot delete a business', () => {
  assert.throws(() => requirePermission(asRole('SUPPORT'), 'business.delete'));
});
test('SUPPORT cannot email a merchant owner', () => {
  assert.throws(() => requirePermission(asRole('SUPPORT'), 'business.accountEmail'));
});
test('SUPPORT cannot read the audit trail or the admin roster', () => {
  assert.throws(() => requirePermission(asRole('SUPPORT'), 'audit.read'));
  assert.throws(() => requirePermission(asRole('SUPPORT'), 'admins.read'));
});
test('SUPPORT cannot read payment records', () => {
  assert.throws(() => requirePermission(asRole('SUPPORT'), 'payments.read'));
});
test('SUPPORT can inspect a business', () => {
  assert.ok(requirePermission(asRole('SUPPORT'), 'business.inspect'));
});
test('ADMIN can suspend but not manage admins or delete', () => {
  assert.ok(requirePermission(asRole('ADMIN'), 'business.status'));
  assert.throws(() => requirePermission(asRole('ADMIN'), 'admins.manage'));
  assert.throws(() => requirePermission(asRole('ADMIN'), 'business.delete'));
});
test('SUPER_ADMIN holds every capability', () => {
  for (const cap of Object.keys(PERMISSIONS)) assert.ok(can(asRole('SUPER_ADMIN'), cap), cap);
});
test('an unknown role holds nothing', () => {
  const rogue = asRole('GOD_MODE');
  for (const cap of Object.keys(PERMISSIONS)) assert.equal(can(rogue, cap), false, cap);
});
test('FINANCE can read payments but not inspect-only surfaces it should not', () => {
  assert.ok(can(asRole('FINANCE'), 'payments.read'));
  assert.equal(can(asRole('FINANCE'), 'business.status'), false);
  assert.equal(can(asRole('FINANCE'), 'admins.manage'), false);
});
test('permissionsFor covers exactly the PERMISSIONS table', () => {
  const map = permissionsFor(asRole('ADMIN'));
  assert.deepEqual(Object.keys(map).sort(), Object.keys(PERMISSIONS).sort());
});
test('every capability lists only known roles', () => {
  for (const [cap, roles] of Object.entries(PERMISSIONS)) {
    for (const r of roles) assert.ok(ROLES.includes(r), `${cap} -> ${r}`);
  }
});

// ── firestore.js — path encoding and pagination ──
test('a slash in a document id cannot escape its collection', async () => {
  calls.length = 0;
  await firestore.getDocument(env, 'businesses', '../../users/victim').catch(() => {});
  const url = calls.at(-1).url;
  assert.ok(!url.includes('/users/victim'), `path traversal reached Firestore: ${url}`);
  assert.ok(url.includes('%2F') || url.includes('..%2F'), `expected encoding, got ${url}`);
});

test('queryPage always sends the caller-supplied filters and orders by __name__', async () => {
  fixtures = { sales: [] };
  calls.length = 0;
  await firestore.queryPage(env, 'sales', {
    filters: [{ field: 'businessId', op: 'EQUAL', value: 'BIZ_A' }],
    orderBy: 'soldAt', limit: 25,
    select: ['soldAt', 'totalAmount', 'businessId'],
  });
  const q = calls.at(-1).body.structuredQuery;
  assert.equal(q.where.fieldFilter.field.fieldPath, 'businessId');
  assert.equal(q.where.fieldFilter.value.stringValue, 'BIZ_A');
  assert.equal(q.orderBy.at(-1).field.fieldPath, '__name__');
  assert.equal(q.limit, 26, 'fetches one extra row to detect another page');
  assert.ok(!('offset' in q), 'must never use offset — Firestore bills skipped documents');
  const selected = q.select.fields.map((f) => f.fieldPath);
  assert.ok(selected.includes('soldAt'), 'ordering field must be projected for the cursor');
});

test('queryPage reports hasMore and round-trips its cursor', async () => {
  const row = (i) => ({ id: `d${i}`, fields: { soldAt: { timestampValue: `2026-01-0${i}T00:00:00Z` }, businessId: { stringValue: 'BIZ_A' } } });
  fixtures = { sales: [row(1), row(2), row(3)] };
  const page = await firestore.queryPage(env, 'sales', {
    filters: [{ field: 'businessId', value: 'BIZ_A' }], orderBy: 'soldAt', limit: 2,
  });
  assert.equal(page.documents.length, 2, 'trims the probe row');
  assert.equal(page.hasMore, true);
  assert.ok(page.nextCursor);

  calls.length = 0;
  await firestore.queryPage(env, 'sales', {
    filters: [{ field: 'businessId', value: 'BIZ_A' }], orderBy: 'soldAt', limit: 2, cursor: page.nextCursor,
  });
  const q = calls.at(-1).body.structuredQuery;
  assert.ok(q.startAt, 'cursor must produce a startAt');
  assert.equal(q.startAt.before, false, 'must start AFTER the last row, not repeat it');
  // The raw Firestore Value is carried, not a stringified date.
  assert.equal(q.startAt.values[0].timestampValue, '2026-01-02T00:00:00Z');
  assert.ok(q.startAt.values[1].referenceValue.endsWith('/sales/d2'));
});

test('a corrupt cursor is ignored rather than throwing', async () => {
  fixtures = { sales: [] };
  const page = await firestore.queryPage(env, 'sales', {
    filters: [{ field: 'businessId', value: 'BIZ_A' }], orderBy: 'soldAt', limit: 5, cursor: 'not-base64!!',
  });
  assert.equal(page.documents.length, 0);
});

test('safeCount degrades to null instead of throwing when the index is missing', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => (String(u).includes(':runAggregationQuery')
    ? new Response('FAILED_PRECONDITION: index required', { status: 400 })
    : realFetch(u));
  const r = await firestore.safeCount(env, 'sales', [{ field: 'businessId', value: 'X' }]);
  assert.equal(r.value, null);
  assert.equal(r.error, 'unavailable');
  globalThis.fetch = realFetch;
});

test('runAggregation sends COUNT and SUM in one aggregation query', async () => {
  calls.length = 0;
  const out = await firestore.runAggregation(env, 'productImages', {
    filters: [{ field: 'businessId', value: 'BIZ_A' }],
    aggregations: [{ alias: 'count', count: true }, { alias: 'total', sum: 'bytes' }],
  });
  const body = calls.at(-1).body.structuredAggregationQuery;
  assert.deepEqual(body.aggregations.map((a) => a.alias), ['count', 'total']);
  assert.equal(body.aggregations[1].sum.field.fieldPath, 'bytes');
  assert.equal(out.count, 7);
  assert.equal(out.total, 1234);
});

// ── opsEvents.js — payload hygiene ──
const opsEvents = await import(`${BASE}lib/opsEvents.js`);
test('secret-shaped keys never reach Firestore', async () => {
  calls.length = 0;
  await opsEvents.recordOpsEvent(env, {
    type: 'test.hygiene', message: 'x', businessId: 'BIZ_A',
    context: {
      paystackSecret: 'sk_live_deadbeef',
      authorization: 'Bearer abc',
      x_paystack_signature: 'abcdef',
      apiKey: 'k',
      password: 'hunter2',
      safeField: 'keep me',
      expectedKobo: 59900,
    },
  });
  const written = JSON.stringify(calls.at(-1).body);
  for (const secret of ['sk_live_deadbeef', 'Bearer abc', 'abcdef', 'hunter2']) {
    assert.ok(!written.includes(secret), `leaked: ${secret}`);
  }
  assert.ok(written.includes('keep me'));
  assert.ok(written.includes('59900'));
});
test('identical events are suppressed inside the window', async () => {
  calls.length = 0;
  const a = await opsEvents.recordOpsEvent(env, { type: 'test.storm', businessId: 'B' });
  const b = await opsEvents.recordOpsEvent(env, { type: 'test.storm', businessId: 'B' });
  assert.equal(a, true);
  assert.equal(b, false, 'a retry loop must not write thousands of documents');
});
test('maskEmail keeps correlation without harvesting', () => {
  assert.equal(opsEvents.maskEmail('mercy@dukashop.co.ke'), 'm***@dukashop.co.ke');
  assert.equal(opsEvents.maskEmail('not-an-email'), null);
});
test('recordOpsEvent never throws, even when Firestore is down', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network gone'); };
  const r = await opsEvents.recordOpsEvent(env, { type: 'test.down', businessId: 'Z' });
  assert.equal(r, false);
  globalThis.fetch = realFetch;
});

