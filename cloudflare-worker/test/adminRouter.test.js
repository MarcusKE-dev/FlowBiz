// Router-level tests: what the Worker's entry point will and will not
// dispatch. These use no credentials at all — an unauthenticated caller is
// exactly the attacker we care about at this layer, so a 401/403 is a PASS
// and a 200 or a 500 would be the finding.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/jwk/securetoken')) return new Response(JSON.stringify({ keys: [] }), { status: 200 });
  if (u.includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
  return new Response('{}', { status: 200 });
};

const worker = (await import(new URL('../src/index.js', import.meta.url).href)).default;

const env = {
  FIREBASE_PROJECT_ID: 'p',
  ALLOWED_ORIGINS: 'https://admin.flowbiz.co.ke,https://flowbiz.co.ke',
  FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
};

// A distinct source IP per request: the Worker rate-limits admin routes to
// 30/minute/IP, which is correct behaviour and would otherwise mask what
// these tests are actually checking. One test below exercises it directly.
let ipSeq = 0;
const hit = (path, { method = 'GET', origin = 'https://admin.flowbiz.co.ke', headers = {}, ip } = {}) =>
  worker.fetch(new Request(`https://api.test${path}`, {
    method,
    headers: { Origin: origin, 'CF-Connecting-IP': ip || `10.0.0.${++ipSeq % 250}-${ipSeq}`, ...headers },
    ...(method === 'POST' || method === 'DELETE' ? { body: '{}' } : {}),
  }), env);


// ── CORS preflight ──
test('DELETE is advertised, so the delete-business route is reachable at all', async () => {
  const res = await hit('/api/admin/businesses/BIZ_A', { method: 'OPTIONS' });
  const methods = res.headers.get('Access-Control-Allow-Methods');
  assert.match(methods, /DELETE/, `preflight advertises "${methods}" — a browser would block DELETE`);
});
test('an unlisted origin is not echoed back', async () => {
  const res = await hit('/api/admin/overview', { origin: 'https://evil.example' });
  assert.notEqual(res.headers.get('Access-Control-Allow-Origin'), 'https://evil.example');
});

// ── Every admin route demands authentication ──
const ADMIN_ROUTES = [
  ['/api/admin/auth/me', 'GET'],
  ['/api/admin/overview', 'GET'],
  ['/api/admin/businesses', 'GET'],
  ['/api/admin/cloud-usage', 'GET'],
  ['/api/admin/system-health', 'GET'],
  ['/api/admin/payments/health', 'GET'],
  ['/api/admin/ops-events', 'GET'],
  ['/api/admin/audit-logs', 'GET'],
  ['/api/admin/admins', 'GET'],
  ['/api/admin/admins', 'POST'],
  ['/api/admin/admins/someone', 'DELETE'],
  ['/api/admin/communications/send', 'POST'],
  ['/api/admin/businesses/BIZ_A', 'GET'],
  ['/api/admin/businesses/BIZ_A', 'DELETE'],
  ['/api/admin/businesses/BIZ_A/data?collection=sales', 'GET'],
  ['/api/admin/businesses/BIZ_A/inspect?section=customers', 'GET'],
  ['/api/admin/businesses/BIZ_A/record?section=sales&id=x', 'GET'],
  ['/api/admin/businesses/BIZ_A/usage', 'GET'],
  ['/api/admin/businesses/BIZ_A/subscription', 'POST'],
  ['/api/admin/businesses/BIZ_A/industry', 'POST'],
  ['/api/admin/businesses/BIZ_A/status', 'POST'],
  ['/api/admin/businesses/BIZ_A/support-token', 'POST'],
  ['/api/admin/businesses/BIZ_A/send-password-reset', 'POST'],
  ['/api/admin/businesses/BIZ_A/send-verification', 'POST'],
];
for (const [path, method] of ADMIN_ROUTES) {
  test(`${method} ${path.split('?')[0]} → 401`, async () => {
    const res = await hit(path, { method });
    assert.equal(res.status, 401, `expected 401, got ${res.status}`);
  });
}

// ── Path shapes the router must refuse ──
for (const [path, method] of [
  ['/api/admin/businesses/BIZ_A/inspect/extra', 'GET'],
  ['/api/admin/businesses/BIZ_A/products/p1', 'GET'],
  ['/api/admin/businesses/', 'GET'],
  ['/api/admin/businesses/BIZ_A/unknown-action', 'GET'],
  ['/api/admin/businesses/BIZ_A/inspect', 'DELETE'],
  ['/api/admin/businesses/BIZ_A/status', 'GET'],
  ['/api/admin/businesses/BIZ_A/industry', 'GET'],
  ['/api/admin/businesses/BIZ_A/industry', 'DELETE'],
  ['/api/admin/nope', 'GET'],
]) {
  test(`${method} ${path} → 404`, async () => {
    const res = await hit(path, { method });
    assert.equal(res.status, 404, `expected 404, got ${res.status}`);
  });
}
test('a malformed percent-escape in the id is not dispatched', async () => {
  const res = await hit('/api/admin/businesses/%E0%A4%A/usage');
  assert.equal(res.status, 404);
});

// ── Edge rate limiting ──
test('a burst from one IP is throttled with a Retry-After', async () => {
  let throttled = null;
  for (let i = 0; i < 45; i++) {
    const res = await hit('/api/admin/overview', { ip: '203.0.113.99' });
    if (res.status === 429) { throttled = res; break; }
  }
  assert.ok(throttled, 'admin routes must be rate limited per IP');
  assert.ok(Number(throttled.headers.get('Retry-After')) > 0);
});
test('rate limiting does not apply to the public pricing route', async () => {
  const res = await hit('/api/pricing', { ip: '203.0.113.99' });
  assert.equal(res.status, 200);
});

// ── Non-admin routes are unaffected ──
test('the public pricing endpoint still answers', async () => {
  const res = await hit('/api/pricing');
  assert.equal(res.status, 200);
});
test('an unsigned Paystack webhook is still rejected', async () => {
  const res = await worker.fetch(new Request('https://api.test/api/paystack/webhook', {
    method: 'POST', body: JSON.stringify({ event: 'charge.success' }),
  }), env);
  assert.equal(res.status, 401, 'HMAC verification must still reject an unsigned webhook');
});

