// End-to-end tests for the admin request path: a real signed Firebase ID
// token is verified, the systemAdmins register decides the role, the role
// decides the capability, and only then does anything reach Firestore.
//
// Firebase's JWKS endpoint and the Firestore REST API are stubbed; the
// token is genuinely RS256-signed and genuinely verified, so the auth path
// under test is the real one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { generateKeyPairSync, createSign } from 'node:crypto';

const BASE = new URL('../src/', import.meta.url).href;
const PROJECT = 'swiftstock-test';

// ── Keys: one for the "Firebase" ID token, one for the service account ──
const idKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const saKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-kid-1';
const publicJwk = idKeys.publicKey.export({ format: 'jwk' });

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function mintIdToken({ uid = 'admin-uid', email = 'ops@flowbiz.co.ke', claims = {}, aud = PROJECT, kid = KID } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const payload = b64url(JSON.stringify({
    sub: uid, email, aud,
    iss: `https://securetoken.google.com/${aud}`,
    iat: now - 10, exp: now + 3600,
    ...claims,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const sig = b64url(signer.sign(idKeys.privateKey));
  return `${header}.${payload}.${sig}`;
}

// ── Firestore + network stub ────────────────────────────────────────────
let store = {};        // "collection/docId" -> plain JS object
let queryLog = [];
let writeLog = [];
// Simulates Firestore refusing an ordered query because its composite
// index is missing or still building.
let failOrderedQueries = false;

const toValue = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
};
const toFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)]));

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
  if (u.includes(':runAggregationQuery')) {
    return new Response(JSON.stringify([{ result: { aggregateFields: { count: { integerValue: '3' }, total: { doubleValue: 100 }, avg: { doubleValue: 33 } } } }]), { status: 200 });
  }
  if (u.includes(':runQuery')) {
    const q = body.structuredQuery;
    const coll = q.from[0].collectionId;
    queryLog.push(q);
    if (failOrderedQueries && (q.orderBy || []).some((o) => o.field.fieldPath !== '__name__')) {
      return new Response(
        'FAILED_PRECONDITION: The query requires an index. You can create it here: https://…',
        { status: 400 }
      );
    }
    const out = Object.entries(store)
      .filter(([k]) => k.startsWith(`${coll}/`))
      .map(([k, v]) => ({ document: { name: `projects/${PROJECT}/databases/(default)/documents/${k}`, fields: toFields(v) } }));
    return new Response(JSON.stringify(out), { status: 200 });
  }

  const m = u.match(/\/documents\/(.+?)(\?|$)/);
  if (m) {
    const path = decodeURIComponent(m[1]);
    if (init.method === 'POST') {
      writeLog.push({ path, body });
      return new Response('{}', { status: 200 });
    }
    if (init.method === 'PATCH') {
      writeLog.push({ path, body });
      return new Response('{}', { status: 200 });
    }
    const doc = store[path];
    if (!doc) return new Response('', { status: 404 });
    return new Response(JSON.stringify({ fields: toFields(doc) }), { status: 200 });
  }
  return new Response('{}', { status: 200 });
};

const env = {
  FIREBASE_PROJECT_ID: PROJECT,
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: 'sa@test.iam.gserviceaccount.com',
    private_key: saKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }),
  ADMIN_EMAILS: '',
  ALLOWED_ORIGINS: 'https://admin.flowbiz.co.ke',
};

const req = (path, { token, method = 'GET' } = {}) => new Request(`https://api.test${path}`, {
  method,
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});


const { handleAdminInspect, handleAdminInspectRecord } = await import(`${BASE}routes/admin/adminInspector.js`);
const { handleAdminBusinessUsage } = await import(`${BASE}routes/admin/adminBusinessUsage.js`);
const { handleAdminToggleBusinessStatus } = await import(`${BASE}routes/admin/adminBusinesses.js`);
const { handleAdminAuditLogs } = await import(`${BASE}routes/admin/adminAuditLogs.js`);
const { handleAdminOverview } = await import(`${BASE}routes/admin/adminOverview.js`);

function reset() {
  store = {};
  queryLog = [];
  writeLog = [];
  failOrderedQueries = false;
  store['businesses/BIZ_A'] = { name: 'Duka A', createdAt: new Date('2026-01-01'), createdBy: 'owner-a' };
  store['businesses/BIZ_B'] = { name: 'Duka B', createdAt: new Date('2026-02-01'), createdBy: 'owner-b' };
  // Only BIZ_A's products live in the stub store, so a leak would show up
  // as BIZ_B data appearing in a BIZ_A response.
  store['products/p1'] = { businessId: 'BIZ_A', name: 'Sukari 1kg', stock: 4, costPrice: 120, sellingPrice: 150 };
  store['products/p2'] = { businessId: 'BIZ_A', name: 'Unga 2kg', stock: 0, costPrice: 180, sellingPrice: 210 };
  store['customers/c1'] = { businessId: 'BIZ_A', name: 'Mama Njeri', phone: '0722000000' };
}

const asAdmin = (role) => {
  store['systemAdmins/admin-uid'] = { uid: 'admin-uid', email: 'ops@flowbiz.co.ke', name: 'Ops', role, active: true };
  return mintIdToken();
};

// ── Authentication — nothing runs without a valid token ──
reset();
test('no Authorization header is rejected 401', async () => {
  const res = await handleAdminInspect(req('/x'), env, 'BIZ_A', new URL('https://x/?section=products'));
  assert.equal(res.status, 401);
  assert.equal(queryLog.length, 0, 'no Firestore query may run for an unauthenticated caller');
});
test('a token for another Firebase project is rejected', async () => {
  const token = mintIdToken({ aud: 'someone-elses-project' });
  const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=products'));
  assert.equal(res.status, 401);
});
test('a token signed with an unknown key is rejected', async () => {
  const token = mintIdToken({ kid: 'not-a-real-kid' });
  const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=products'));
  assert.equal(res.status, 401);
});
test('a tampered payload fails the signature check', async () => {
  const token = mintIdToken();
  const [h, p, s] = token.split('.');
  const forged = JSON.parse(Buffer.from(p, 'base64url').toString());
  forged.sub = 'someone-else';
  const tampered = `${h}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${s}`;
  const res = await handleAdminInspect(req('/x', { token: tampered }), env, 'BIZ_A', new URL('https://x/?section=products'));
  assert.equal(res.status, 401);
});

// ── Authorisation — a valid Firebase user is not an administrator ──
test('a signed-in merchant with no systemAdmins entry gets 403', async () => {
  reset();
  const token = mintIdToken({ uid: 'merchant-uid', email: 'shop@duka.co.ke' });
  const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=products'));
  assert.equal(res.status, 403);
  assert.equal(queryLog.length, 0);
});
test('a DEACTIVATED administrator is refused even with a valid token', async () => {
  reset();
  store['systemAdmins/admin-uid'] = { uid: 'admin-uid', email: 'ops@flowbiz.co.ke', role: 'SUPER_ADMIN', active: false };
  const res = await handleAdminInspect(req('/x', { token: mintIdToken() }), env, 'BIZ_A', new URL('https://x/?section=products'));
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /deactivated/i);
});
test('a forged admin CLAIM cannot outrank the systemAdmins register', async () => {
  reset();
  store['systemAdmins/admin-uid'] = { uid: 'admin-uid', email: 'ops@flowbiz.co.ke', role: 'SUPPORT', active: true };
  // The token claims SUPER_ADMIN. The register says SUPPORT. The register wins.
  const token = mintIdToken({ claims: { role: 'SUPER_ADMIN', superAdmin: true, admin: true } });
  const res = await handleAdminToggleBusinessStatus(
    new Request('https://api.test/x', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'suspended' }),
    }), env, 'BIZ_A');
  assert.equal(res.status, 403, 'a SUPPORT admin must not be able to suspend a business');
  assert.equal(writeLog.length, 0, 'nothing may be written');
});
test('a SUPPORT admin cannot read the audit trail', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  const res = await handleAdminAuditLogs(req('/x', { token }), env, new URL('https://x/?limit=50'));
  assert.equal(res.status, 403);
});
test('an ADMIN can suspend, and the suspension is audited', async () => {
  reset();
  const token = asAdmin('ADMIN');
  const res = await handleAdminToggleBusinessStatus(
    new Request('https://api.test/x', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'suspended', reason: 'non-payment' }),
    }), env, 'BIZ_A');
  assert.equal(res.status, 200);
  const audit = writeLog.find((w) => w.path.startsWith('adminAuditLogs'));
  assert.ok(audit, 'a suspension must always write an audit entry');
  assert.equal(audit.body.fields.action.stringValue, 'TOGGLE_BUSINESS_STATUS');
  assert.equal(audit.body.fields.targetBusinessId.stringValue, 'BIZ_A');
  assert.equal(audit.body.fields.adminRole.stringValue, 'ADMIN');
});

// ── Cross-business isolation ──
test('every inspector query is filtered to the requested businessId', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  for (const section of ['products', 'sales', 'customers', 'credits', 'suppliers', 'expenses', 'stock', 'sessions']) {
    queryLog = [];
    const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL(`https://x/?section=${section}`));
    assert.equal(res.status, 200, section);
    const q = queryLog.at(-1);
    const filters = q.where.fieldFilter ? [q.where.fieldFilter] : q.where.compositeFilter.filters.map((f) => f.fieldFilter);
    const tenant = filters.find((f) => f.field.fieldPath === 'businessId');
    assert.ok(tenant, `${section}: no businessId filter`);
    assert.equal(tenant.op, 'EQUAL', section);
    assert.equal(tenant.value.stringValue, 'BIZ_A', section);
  }
});
test('a scope violation in the response is refused, not returned', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  // Simulate a future refactor that loses the filter: the stub returns a
  // BIZ_B document inside a BIZ_A request.
  store['products/leak'] = { businessId: 'BIZ_B', name: 'Other shop item' };
  const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=products'));
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.ok(!text.includes('Other shop item'), 'foreign data must never be serialised');
  assert.match(text, /scope check failed/);
});
test('a record from another business is a 404, not a payload', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  store['sales/s-b'] = { businessId: 'BIZ_B', totalAmount: 900, productName: 'Other shop sale' };
  const res = await handleAdminInspectRecord(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=sales&id=s-b'));
  assert.equal(res.status, 404);
  assert.ok(!(await res.text()).includes('Other shop sale'));
});
test('a record from the requested business is returned', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  store['sales/s-a'] = { businessId: 'BIZ_A', totalAmount: 250, productName: 'Sukari 1kg' };
  const res = await handleAdminInspectRecord(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=sales&id=s-a'));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).record.productName, 'Sukari 1kg');
});

// ── Input handling ──
test('a traversal businessId never reaches Firestore', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  const res = await handleAdminInspect(req('/x', { token }), env, '../../users', new URL('https://x/?section=products'));
  assert.equal(res.status, 400);
  assert.equal(queryLog.length, 0);
});
test('an unknown section is refused before any query runs', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  for (const section of ['users', 'systemAdmins', 'adminAuditLogs', 'opsEvents', '', 'businesses']) {
    queryLog = [];
    const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL(`https://x/?section=${section}`));
    assert.equal(res.status, 400, `section=${section} should not be inspectable`);
    assert.equal(queryLog.length, 0);
  }
});
test('a non-existent business is a 404 before any data query', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  queryLog = [];
  const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_NOPE', new URL('https://x/?section=products'));
  assert.equal(res.status, 404);
  assert.equal(queryLog.length, 0, 'the endpoint must not be usable to probe for live business ids');
});
test('the payments section is refused to a SUPPORT admin', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=payments'));
  assert.equal(res.status, 403);
});
test('the payments section is allowed for FINANCE', async () => {
  reset();
  const token = asAdmin('FINANCE');
  const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=payments'));
  assert.equal(res.status, 200);
});
test('a caller-supplied limit cannot exceed the server cap', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=products&limit=100000'));
  assert.equal(res.status, 200);
  assert.ok(queryLog.at(-1).limit <= 101, `limit was ${queryLog.at(-1).limit}`);
});
test('inspector queries are projected and never use offset', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=sales'));
  const q = queryLog.at(-1);
  assert.ok(q.select, 'the sales list must be field-projected');
  assert.ok(!q.select.fields.some((f) => f.fieldPath === 'items'), 'the line-item array must stay out of list responses');
  assert.equal(q.offset, undefined);
});

// ── Audit behaviour ──
// These use section/business pairs no earlier test touched: the coalescing
// window is process-wide by design, so a pair already inspected above would
// legitimately be suppressed here.
test('repeat inspections of the same resource are coalesced', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  const url = new URL('https://x/?section=repayments');
  await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', url);
  const first = writeLog.filter((w) => w.path.startsWith('adminAuditLogs')).length;
  await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', url);
  await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', url);
  const after = writeLog.filter((w) => w.path.startsWith('adminAuditLogs')).length;
  assert.equal(first, 1, 'the first inspection is recorded');
  assert.equal(after, 1, 'clicking the same tab again must not write more audit documents');
});
test('a different business is audited separately', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=documents'));
  await handleAdminInspect(req('/x', { token }), env, 'BIZ_B', new URL('https://x/?section=documents'));
  const targets = writeLog
    .filter((w) => w.path.startsWith('adminAuditLogs'))
    .map((w) => w.body.fields.targetBusinessId.stringValue);
  assert.deepEqual(targets.sort(), ['BIZ_A', 'BIZ_B']);
});

// ── Usage measurement ──
test('usage is scoped and writes no counters', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  writeLog = [];
  const res = await handleAdminBusinessUsage(req('/x', { token }), env, 'BIZ_A');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.businessId, 'BIZ_A');
  assert.ok(data.usage.counts.products.value >= 0);
  assert.equal(data.provenance.provider.startsWith('None'), true, 'no provider billing may be claimed');
  const nonAudit = writeLog.filter((w) => !w.path.startsWith('adminAuditLogs'));
  assert.equal(nonAudit.length, 0, 'measuring usage must not write telemetry documents');
});



// ── Response contract ──
// The console destructures these paths directly. When the deployed Worker
// was older than the browser, `data.businesses` was undefined and the
// overview page crashed into the error boundary with "Something went
// wrong" — a blank screen where an operator needed a diagnosis. The client
// now detects that shape and says what to deploy; this pins the server end
// of the same contract so the two cannot drift apart silently again.
test('the overview response carries every field the console reads', async () => {
  reset();
  const token = asAdmin('SUPER_ADMIN');
  const res = await handleAdminOverview(req('/x', { token }), env);
  assert.equal(res.status, 200);
  const data = await res.json();

  // AdminOverview.jsx: const { counts, recent, signups30, truncated } = data.businesses;
  assert.ok(data.businesses, 'data.businesses is what the page destructures');
  assert.ok(data.businesses.counts, 'data.businesses.counts drives the metric rail');
  for (const key of ['total', 'active', 'suspended', 'lifetime', 'pro', 'free', 'new7', 'new30']) {
    assert.equal(typeof data.businesses.counts[key], 'number', `counts.${key}`);
  }
  assert.ok(Array.isArray(data.businesses.recent), 'recent businesses list');
  assert.ok(Array.isArray(data.businesses.signups30), 'the 30-day sign-up series');
  assert.equal(data.businesses.signups30.length, 30, 'one bucket per day');

  // The usage band, and the honesty flag the header prints.
  assert.ok(data.usage, 'data.usage feeds the usage band');
  assert.ok(data.usage.documents, 'usage.documents');
  assert.equal(data.realtime, false, 'the page must never claim to be live');
  assert.ok(data.computedAt, 'the page prints when this was computed');
});


// ── Index resilience ──
// Firestore composite indexes build in the background, and report both
// "missing" and "still building" as FAILED_PRECONDITION. An operations
// console that returns an error page for the whole of that window is not
// much use during exactly the rollout it was deployed for, so ordered
// queries fall back to document-id ordering and say so.
test('a section whose index is still building falls back to id ordering', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  store['productImages/BIZ_A__p1'] = { businessId: 'BIZ_A', productId: 'p1', bytes: 40000 };
  failOrderedQueries = true;

  const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=productImages'));
  assert.equal(res.status, 200, 'the tab must still open');
  const data = await res.json();
  assert.equal(data.rows.length, 1, 'and still show the records');
  assert.equal(data.degradedOrdering, true);
  assert.equal(data.orderedBy, '__name__');
  assert.match(data.degradedReason, /still building/i);
});

test('the fallback is still scoped to the requested business', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  store['productImages/BIZ_B__p9'] = { businessId: 'BIZ_B', productId: 'other-shop-photo', bytes: 91234 };
  failOrderedQueries = true;

  // BIZ_B's row reaching a BIZ_A request must trip the scope check, not be
  // served just because the query took the fallback path.
  const res = await handleAdminInspect(req('/x', { token }), env, 'BIZ_A', new URL('https://x/?section=productImages'));
  assert.equal(res.status, 500);
  assert.ok(!(await res.text()).includes('other-shop-photo'));
});

test('a date-filtered query cannot fall back, and names the index to build', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  failOrderedQueries = true;

  // A range filter must order by its own field, so there is no id-ordered
  // form of this query — the only honest answer is which index is missing.
  const res = await handleAdminInspect(
    req('/x', { token }), env, 'BIZ_A',
    new URL('https://x/?section=stock&from=2026-01-01&to=2026-02-01')
  );
  assert.equal(res.status, 503);
  const { error } = await res.json();
  assert.match(error, /stockAdjustments/);
  assert.match(error, /adjustedAt/);
  assert.match(error, /firebase deploy --only firestore:indexes/);
});

test('the audit trail degrades rather than denying the security record', async () => {
  reset();
  const token = asAdmin('ADMIN');
  store['adminAuditLogs/log1'] = {
    adminEmail: 'ops@flowbiz.co.ke', action: 'VIEW_BUSINESS',
    targetBusinessId: 'BIZ_A', timestamp: new Date('2026-03-01'),
  };
  failOrderedQueries = true;

  const res = await handleAdminAuditLogs(req('/x', { token }), env, new URL('https://x/?limit=50'));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.logs.length, 1);
  assert.equal(data.degradedOrdering, true);
});

// ── Industry profile: server-authorised, narrow, and audited ─────────
//
// The industry layer's whole security claim is that it changes what a
// business is OFFERED and can never change what it is ENTITLED to or
// what it has already recorded. These run the real handler against the
// real auth path and check what actually reaches Firestore.

const { handleAdminIndustryUpdate } = await import(`${BASE}routes/admin/adminIndustry.js`);

const industryReq = (token, body) => new Request('https://api.test/x', {
  method: 'POST',
  headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {},
  body: JSON.stringify(body),
});

// Only the settings document may be written. Anything else reaching
// Firestore from this endpoint is the bug this helper exists to catch.
const settingsWrites = () => writeLog.filter((w) => w.path.startsWith('businessSettings/'));
const nonSettingsWrites = () => writeLog.filter(
  (w) => !w.path.startsWith('businessSettings/') && !w.path.startsWith('adminAuditLogs')
);
const patchedFields = () => Object.keys(settingsWrites().at(-1)?.body?.fields || {});

test('changing a profile requires authentication', async () => {
  reset();
  const res = await handleAdminIndustryUpdate(industryReq(null, { industryProfile: 'PHARMACY' }), env, 'BIZ_A');
  assert.equal(res.status, 401);
  assert.equal(writeLog.length, 0, 'nothing may be written for an unauthenticated caller');
});

test('a SUPPORT administrator cannot change a business profile', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  const res = await handleAdminIndustryUpdate(industryReq(token, { industryProfile: 'PHARMACY' }), env, 'BIZ_A');
  assert.equal(res.status, 403);
  assert.equal(writeLog.length, 0);
});

test('an ADMIN can change a profile, and only the profile and its overrides are written', async () => {
  reset();
  const token = asAdmin('ADMIN');
  store['businessSettings/BIZ_A'] = { businessId: 'BIZ_A', shopName: 'Duka A', categories: ['Other'] };

  const res = await handleAdminIndustryUpdate(industryReq(token, { industryProfile: 'PHARMACY' }), env, 'BIZ_A');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.industry.industryProfile, 'PHARMACY');
  assert.equal(data.industry.previousProfile, 'GENERAL_RETAIL');

  // The profile itself, plus the owner overrides being cleared — every
  // one of those is expressed against the profile that has just moved,
  // so carrying them forward would be meaningless. Nothing that owns
  // data appears, which is the property that actually matters.
  assert.deepEqual(patchedFields().sort(), ['capabilityOverrides', 'dashboardOverrides', 'industryProfile', 'termOverrides', 'unitOverrides']);
  assert.equal(nonSettingsWrites().length, 0, 'a profile change must not write to any other collection');
});

test('a profile change never touches the subscription, the plan or any entitlement', async () => {
  reset();
  const token = asAdmin('SUPER_ADMIN');
  store['businesses/BIZ_A'] = {
    name: 'Duka A', createdBy: 'owner-a',
    subscription: { plan: 'lifetime', status: 'active', expiresAt: null },
  };
  store['businessSettings/BIZ_A'] = { businessId: 'BIZ_A', shopName: 'Duka A' };

  const res = await handleAdminIndustryUpdate(
    industryReq(token, { industryProfile: 'RESTAURANT', subscription: { plan: 'free' }, plan: 'free' }),
    env, 'BIZ_A'
  );
  assert.equal(res.status, 200);
  assert.equal(writeLog.some((w) => w.path.startsWith('businesses/')), false, 'the business document must not be written');
  assert.deepEqual(patchedFields().sort(), ['capabilityOverrides', 'dashboardOverrides', 'industryProfile', 'termOverrides', 'unitOverrides']);
  for (const forbidden of ['subscription', 'plan', 'entitlement', 'status', 'role']) {
    assert.equal(patchedFields().includes(forbidden), false, `a profile change must never write ${forbidden}`);
  }
});

test('a profile change writes nothing to sales, products, customers or batches', async () => {
  reset();
  const token = asAdmin('ADMIN');
  store['businessSettings/BIZ_A'] = { businessId: 'BIZ_A', industryProfile: 'PHARMACY' };
  store['sales/s1'] = { businessId: 'BIZ_A', totalAmount: 500 };
  store['productBatches/b1'] = { businessId: 'BIZ_A', productId: 'p1', remainingQuantity: 10 };

  const res = await handleAdminIndustryUpdate(industryReq(token, { industryProfile: 'GENERAL_RETAIL' }), env, 'BIZ_A');
  assert.equal(res.status, 200);
  for (const collection of ['sales/', 'products/', 'customers/', 'creditSales/', 'productBatches/', 'orders/']) {
    assert.equal(
      writeLog.some((w) => w.path.startsWith(collection)), false,
      `${collection} must be untouched by a profile change`
    );
  }
  // The batch record still exists exactly as it was — turning the
  // capability off hides it, it does not delete it.
  assert.equal(store['productBatches/b1'].remainingQuantity, 10);
});

test('an unknown profile is refused before anything is written', async () => {
  reset();
  const token = asAdmin('ADMIN');
  for (const industryProfile of ['PHARMACY_ADMIN', 'general_retail', '', 123, null, '../../users']) {
    writeLog = [];
    const res = await handleAdminIndustryUpdate(industryReq(token, { industryProfile }), env, 'BIZ_A');
    assert.notEqual(res.status, 200, `${JSON.stringify(industryProfile)} must be refused`);
    assert.equal(writeLog.length, 0);
  }
});

test('a forged capability body cannot switch on a profile-locked capability', async () => {
  reset();
  const token = asAdmin('ADMIN');
  store['businessSettings/BIZ_A'] = { businessId: 'BIZ_A', industryProfile: 'GENERAL_RETAIL' };

  const res = await handleAdminIndustryUpdate(industryReq(token, {
    capabilityOverrides: { orders: true, batches: true, units: true, isAdmin: true },
  }), env, 'BIZ_A');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.industry.capabilityOverrides, { units: true });
});

test('resetting overrides clears them without moving the profile', async () => {
  reset();
  const token = asAdmin('ADMIN');
  store['businessSettings/BIZ_A'] = {
    businessId: 'BIZ_A', industryProfile: 'CAFE', capabilityOverrides: { tables: true },
  };
  const res = await handleAdminIndustryUpdate(industryReq(token, { resetOverrides: true }), env, 'BIZ_A');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.industry.industryProfile, 'CAFE');
  assert.deepEqual(data.industry.capabilityOverrides, {});
  assert.deepEqual(
    patchedFields().sort(),
    ['capabilityOverrides', 'dashboardOverrides', 'termOverrides', 'unitOverrides'],
    'a reset clears every override an owner can make, and moves no profile'
  );
});

test('an empty request changes nothing', async () => {
  reset();
  const token = asAdmin('ADMIN');
  const res = await handleAdminIndustryUpdate(industryReq(token, { reason: 'oops' }), env, 'BIZ_A');
  assert.equal(res.status, 400);
  assert.equal(writeLog.length, 0);
});

test('a profile change is written to the audit trail with both profiles', async () => {
  reset();
  const token = asAdmin('ADMIN');
  store['businessSettings/BIZ_A'] = { businessId: 'BIZ_A', industryProfile: 'GENERAL_RETAIL' };
  await handleAdminIndustryUpdate(
    industryReq(token, { industryProfile: 'HARDWARE', reason: 'Merchant asked' }), env, 'BIZ_A'
  );
  const audit = writeLog.find((w) => w.path.startsWith('adminAuditLogs'));
  assert.ok(audit, 'a profile change must be audited');
  const fields = audit.body.fields;
  assert.equal(fields.action.stringValue, 'UPDATE_INDUSTRY_PROFILE');
  assert.equal(fields.targetBusinessId.stringValue, 'BIZ_A');
});

test('a business with no settings document yet gets one stamped with its businessId', async () => {
  reset();
  const token = asAdmin('ADMIN');
  const res = await handleAdminIndustryUpdate(industryReq(token, { industryProfile: 'SALON' }), env, 'BIZ_A');
  assert.equal(res.status, 200);
  assert.deepEqual(patchedFields().sort(), [
    'businessId', 'capabilityOverrides', 'dashboardOverrides', 'industryProfile', 'termOverrides', 'unitOverrides',
  ]);
});

test('a business id that is not a safe document id never reaches Firestore', async () => {
  reset();
  const token = asAdmin('ADMIN');
  for (const bad of ['../../users', 'BIZ/A', 'BIZ.A', '', 'a'.repeat(200)]) {
    writeLog = [];
    const res = await handleAdminIndustryUpdate(industryReq(token, { industryProfile: 'CAFE' }), env, bad);
    assert.equal(res.status, 400, `${bad} must be refused`);
    assert.equal(writeLog.length, 0);
  }
});
