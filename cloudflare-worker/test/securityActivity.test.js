// Authentication telemetry, end to end.
//
// The thing worth testing here is not that events get written — it is
// WHAT THEY ARE ALLOWED TO ASSERT. A success is recorded only when a real
// Firebase ID token proves it, and its identity comes from the verified
// claims rather than from the request body; a failure is recorded as a
// report and can never be dressed up as a proven one. Everything else —
// who may read the log, who may act on it — is the ordinary admin
// authorisation path, re-asserted here because this surface is new.
//
// The token is genuinely RS256-signed and genuinely verified. Firestore
// is a stub that applies its writes (see helpers/adminHarness.js), so the
// assertions are about the documents that end up stored.

import test from 'node:test';
import assert from 'node:assert/strict';
import { installStub, mintIdToken, adminRequest, env } from './helpers/adminHarness.js';

const BASE = new URL('../src/', import.meta.url).href;
const state = installStub();

const { handleLoginEvent } = await import(`${BASE}routes/authLoginEvent.js`);
const {
  handleAdminSecurityOverview, handleAdminSecurityEvents, handleAdminSecurityAction,
} = await import(`${BASE}routes/admin/adminSecurity.js`);

const loginEvents = () =>
  Object.entries(state.store).filter(([k]) => k.startsWith('loginEvents/')).map(([id, v]) => ({ id, ...v }));

// The endpoint's rate limiter is per IP and lives for the life of the
// isolate — which is exactly what one of the tests below is about — so
// every other test gets an address of its own rather than sharing a
// budget with the tests that ran before it.
let ipCounter = 0;
const freshIp = () => `203.0.113.${(ipCounter += 1) % 250}`;

function report(body, { token = null, ip = null } = {}) {
  const from = ip || currentIp;
  return new Request('https://api.test/api/auth/login-event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': from,
      'User-Agent': 'Mozilla/5.0 (Android) FlowBizTest',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

let currentIp = freshIp();

function reset() {
  state.store = {};
  state.identityCalls = [];
  currentIp = freshIp();
  state.store['users/owner-a'] = {
    uid: 'owner-a', email: 'shop@duka.co.ke', displayName: 'Mama Duka',
    businessId: 'BIZ_A', role: 'owner', active: true,
  };
}

const asAdmin = (role = 'SUPER_ADMIN') => {
  state.store['systemAdmins/admin-uid'] = { uid: 'admin-uid', email: 'ops@flowbiz.co.ke', role, active: true };
  return mintIdToken();
};

// ── A success has to be proved ───────────────────────────────────────

test('a success with no token is refused, and nothing is recorded', async () => {
  reset();
  const res = await handleLoginEvent(report({ outcome: 'success', uid: 'owner-a' }), env);
  assert.equal(res.status, 401);
  assert.equal(loginEvents().length, 0);
});

test('a success with a forged token is refused', async () => {
  reset();
  const token = mintIdToken({ kid: 'not-a-real-key' });
  const res = await handleLoginEvent(report({ outcome: 'success' }, { token }), env);
  assert.equal(res.status, 401);
  assert.equal(loginEvents().length, 0);
});

test('a verified success names the account from the TOKEN, never from the body', async () => {
  reset();
  const token = mintIdToken({ uid: 'owner-a', email: 'shop@duka.co.ke' });
  const res = await handleLoginEvent(
    report({ outcome: 'success', uid: 'somebody-else', email: 'ceo@flowbiz.co.ke' }, { token }),
    env
  );
  assert.equal(res.status, 200);
  const [event] = loginEvents();
  assert.equal(event.outcome, 'success');
  assert.equal(event.verified, true);
  assert.equal(event.uid, 'owner-a', 'the body\'s uid must be ignored');
  assert.equal(event.targetEmail, 'shop@duka.co.ke');
  assert.equal(event.targetBusinessId, 'BIZ_A');
});

// ── A failure is a report, and says so ───────────────────────────────

test('a failure is recorded as unverified, with server-observed metadata', async () => {
  reset();
  const res = await handleLoginEvent(
    report({ outcome: 'failure', email: 'shop@duka.co.ke', code: 'auth/wrong-password' }),
    env
  );
  assert.equal(res.status, 200);
  const [event] = loginEvents();
  assert.equal(event.outcome, 'failure');
  assert.equal(event.verified, false, 'a failure can never claim to be proved');
  assert.equal(event.reason, 'wrong_password');
  assert.equal(event.ip, currentIp, 'the address comes from the request, not the body');
  assert.match(event.userAgent, /FlowBizTest/);
  assert.equal(event.uid, null, 'an unverified event may not name a uid');
});

test('a failure against a real account names the workspace, from our own records', async () => {
  reset();
  await handleLoginEvent(report({ outcome: 'failure', email: 'SHOP@duka.co.ke', code: 'auth/invalid-credential' }), env);
  const [event] = loginEvents();
  assert.equal(event.knownAccount, true);
  assert.equal(event.targetUid, 'owner-a');
  assert.equal(event.targetBusinessId, 'BIZ_A');
  assert.equal(event.targetName, 'Mama Duka');
});

test('a failure against an address nobody owns stays masked', async () => {
  reset();
  await handleLoginEvent(report({ outcome: 'failure', email: 'someone@example.com', code: 'auth/user-not-found' }), env);
  const [event] = loginEvents();
  assert.equal(event.knownAccount, false);
  assert.equal(event.targetEmail, null);
  assert.equal(event.emailMasked, 's***@example.com');
  assert.ok(event.emailHandle, 'but it is still countable');
});

test('the same address always produces the same handle, whatever the spelling', async () => {
  reset();
  await handleLoginEvent(report({ outcome: 'failure', email: ' Shop@Duka.co.ke ', code: 'auth/wrong-password' }), env);
  await handleLoginEvent(report({ outcome: 'failure', email: 'shop@duka.co.ke', code: 'auth/wrong-password' }), env);
  const [a, b] = loginEvents();
  assert.equal(a.emailHandle, b.emailHandle);
});

test('no password, token or secret can reach the stored document', async () => {
  reset();
  await handleLoginEvent(
    report({
      outcome: 'failure', email: 'shop@duka.co.ke', code: 'auth/wrong-password',
      password: 'hunter2', idToken: 'ey.forged', refreshToken: 'r', secret: 's',
    }),
    env
  );
  const [event] = loginEvents();
  const serialized = JSON.stringify(event).toLowerCase();
  for (const forbidden of ['hunter2', 'forged', 'refreshtoken', 'secret']) {
    assert.ok(!serialized.includes(forbidden), `${forbidden} must never be stored`);
  }
});

test('an unrecognised outcome is refused rather than recorded as a success', async () => {
  reset();
  // Anything that is not an explicit failure is a claim to have signed
  // in, and a claim to have signed in needs a token.
  const res = await handleLoginEvent(report({ outcome: 'totally-fine', email: 'shop@duka.co.ke' }), env);
  assert.equal(res.status, 401);
  assert.equal(loginEvents().length, 0);
});

test('a flood from one address is cut off rather than filling the log', async () => {
  reset();
  for (let i = 0; i < 40; i++) {
    await handleLoginEvent(report({ outcome: 'failure', email: `x${i}@example.com`, code: 'auth/wrong-password' }, { ip: '198.51.100.9' }), env);
  }
  assert.ok(loginEvents().length <= 12, `rate limit should bound the log, saw ${loginEvents().length}`);
});

// ── Reading it is an administrative privilege ────────────────────────

const adminReq = (path, token, method = 'GET', body = null) =>
  adminRequest(path, { token, method, body });

test('an unauthenticated caller cannot read the security log', async () => {
  reset();
  const res = await handleAdminSecurityOverview(adminReq('/api/admin/security', null), env, new URL('https://x/'));
  assert.equal(res.status, 401);
});

test('a SUPPORT administrator cannot read the security log', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  const res = await handleAdminSecurityOverview(adminReq('/api/admin/security', token), env, new URL('https://x/'));
  assert.equal(res.status, 403);
});

test('an ADMIN sees the summary, the clusters and the provenance', async () => {
  reset();
  const token = asAdmin('ADMIN');
  for (let i = 0; i < 6; i++) {
    await handleLoginEvent(report({ outcome: 'failure', email: 'shop@duka.co.ke', code: 'auth/wrong-password' }), env);
  }
  const res = await handleAdminSecurityOverview(adminReq('/api/admin/security', token), env, new URL('https://x/'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.summary.failuresToday, 6);
  assert.equal(body.provenance.failuresAreClientReported, true);

  const cluster = body.clusters.find((c) => c.kind === 'account');
  assert.ok(cluster, 'six failures against one account is a cluster');
  assert.equal(cluster.failures, 6);
  assert.equal(cluster.targetUid, 'owner-a');
});

test('a run of failures followed by a success from the same address is flagged', async () => {
  reset();
  const token = asAdmin('ADMIN');
  // Four failures and the success must come from ONE address — that is
  // the whole shape being detected.
  for (let i = 0; i < 4; i++) {
    await handleLoginEvent(report({ outcome: 'failure', email: 'shop@duka.co.ke', code: 'auth/wrong-password' }), env);
  }
  await handleLoginEvent(
    report({ outcome: 'success' }, { token: mintIdToken({ uid: 'owner-a', email: 'shop@duka.co.ke' }) }),
    env
  );
  const body = await (await handleAdminSecurityOverview(adminReq('/api/admin/security', token), env, new URL('https://x/'))).json();
  const address = body.clusters.find((c) => c.kind === 'address');
  assert.ok(address?.breachedAfterFailures, 'somebody tried until they got in — that is the headline');
});

test('the log can be filtered without the search term ever being stored', async () => {
  reset();
  const token = asAdmin('ADMIN');
  await handleLoginEvent(report({ outcome: 'failure', email: 'shop@duka.co.ke', code: 'auth/wrong-password' }), env);
  await handleLoginEvent(report({ outcome: 'failure', email: 'other@example.com', code: 'auth/user-not-found' }), env);

  const url = new URL('https://x/?outcome=failure&search=other@example.com');
  const body = await (await handleAdminSecurityEvents(adminReq('/api/admin/security/events', token), env, url)).json();
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].emailMasked, 'o***@example.com');
  assert.equal(loginEvents().length, 2, 'searching must not write anything');
});

// ── The actions actually enforce something ───────────────────────────

test('a SUPPORT administrator may not act', async () => {
  reset();
  const token = asAdmin('SUPPORT');
  const res = await handleAdminSecurityAction(
    adminReq('/api/admin/security/actions', token, 'POST', { action: 'disableUser', uid: 'owner-a' }), env
  );
  assert.equal(res.status, 403);
  assert.equal(state.identityCalls.length, 0, 'nothing may reach Identity Toolkit on a refused call');
  assert.equal(state.store['users/owner-a'].active, true);
});

test('disabling an account disables the Firebase sign-in AND blocks the app', async () => {
  reset();
  const token = asAdmin('ADMIN');
  const res = await handleAdminSecurityAction(
    adminReq('/api/admin/security/actions', token, 'POST', { action: 'disableUser', uid: 'owner-a', reason: 'brute force' }), env
  );
  assert.equal(res.status, 200);
  const call = state.identityCalls.find((c) => c.url.includes('accounts:update'));
  assert.equal(call.body.disableUser, true, 'it must actually call Identity Toolkit');
  assert.equal(call.body.localId, 'owner-a');
  assert.equal(state.store['users/owner-a'].active, false);
  assert.equal(state.store['users/owner-a'].deactivationReason, 'platform_security');
});

test('re-enabling puts the account back exactly as it was', async () => {
  reset();
  const token = asAdmin('ADMIN');
  await handleAdminSecurityAction(adminReq('/x', token, 'POST', { action: 'disableUser', uid: 'owner-a' }), env);
  await handleAdminSecurityAction(adminReq('/x', token, 'POST', { action: 'enableUser', uid: 'owner-a' }), env);
  assert.equal(state.store['users/owner-a'].active, true);
  assert.equal(state.store['users/owner-a'].disabledByPlatform, false);
  assert.equal(state.store['users/owner-a'].deactivationReason, null);
  assert.equal(state.identityCalls.at(-1).body.disableUser, false);
});

test('revoking sessions revokes the tokens and every device document', async () => {
  reset();
  state.store['sessions/dev1__owner-a'] = { uid: 'owner-a', businessId: 'BIZ_A', revoked: false };
  state.store['sessions/dev2__owner-a'] = { uid: 'owner-a', businessId: 'BIZ_A', revoked: false };
  const token = asAdmin('ADMIN');
  const body = await (await handleAdminSecurityAction(
    adminReq('/x', token, 'POST', { action: 'revokeSessions', uid: 'owner-a' }), env
  )).json();
  assert.equal(body.devicesRevoked, 2);
  assert.ok(state.identityCalls.some((c) => c.body?.validSince), 'Firebase refresh tokens must be revoked too');
  assert.equal(state.store['sessions/dev1__owner-a'].revoked, true);
  assert.equal(state.store['users/owner-a'].active, true, 'a forced sign-out is not a deactivation');
});

test('an action against a uid FlowBiz does not know is refused', async () => {
  reset();
  const token = asAdmin('ADMIN');
  const res = await handleAdminSecurityAction(
    adminReq('/x', token, 'POST', { action: 'disableUser', uid: 'not-a-real-user' }), env
  );
  assert.equal(res.status, 404);
  assert.equal(state.identityCalls.length, 0);
});

test('an unknown action is refused rather than guessed at', async () => {
  reset();
  const token = asAdmin('ADMIN');
  const res = await handleAdminSecurityAction(adminReq('/x', token, 'POST', { action: 'deleteEverything', uid: 'owner-a' }), env);
  assert.equal(res.status, 400);
  assert.equal(state.identityCalls.length, 0);
});

test('marking an event reviewed is triage, and changes no access', async () => {
  reset();
  const token = asAdmin('ADMIN');
  await handleLoginEvent(report({ outcome: 'failure', email: 'shop@duka.co.ke', code: 'auth/wrong-password' }), env);
  const [event] = loginEvents();
  const id = event.id.split('/')[1];
  const res = await handleAdminSecurityAction(
    adminReq('/x', token, 'POST', { action: 'resolveEvent', eventId: id, resolved: true, reason: 'known device' }), env
  );
  assert.equal(res.status, 200);
  assert.equal(state.store[`loginEvents/${id}`].resolved, true);
  assert.equal(state.store[`loginEvents/${id}`].resolvedBy, 'ops@flowbiz.co.ke');
  assert.equal(state.store['users/owner-a'].active, true);
});

test('every action is written to the audit trail', async () => {
  reset();
  const token = asAdmin('ADMIN');
  await handleAdminSecurityAction(adminReq('/x', token, 'POST', { action: 'disableUser', uid: 'owner-a' }), env);
  const logs = Object.entries(state.store).filter(([k]) => k.startsWith('adminAuditLogs/')).map(([, v]) => v);
  const entry = logs.find((l) => l.action === 'DISABLE_USER_ACCOUNT');
  assert.ok(entry, 'a privileged account action must be audited');
  assert.equal(entry.adminEmail, 'ops@flowbiz.co.ke');
  assert.equal(entry.targetBusinessId, 'BIZ_A');
});
