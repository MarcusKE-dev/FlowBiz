// The ADMIN_EMAILS bootstrap: an allow-listed address becomes SUPER_ADMIN
// on first sign-in — but only once Firebase has verified the caller owns
// that inbox. An unverified token carrying the same address is refused.

import test from 'node:test';
import assert from 'node:assert/strict';
import { installStub, env as baseEnv, mintIdToken, adminRequest } from './helpers/adminHarness.js';

const BASE = new URL('../src/', import.meta.url).href;
const { verifyAdminAuth } = await import(`${BASE}lib/adminAuth.js`);

const env = { ...baseEnv, ADMIN_EMAILS: 'owner@flowbiz.co.ke' };

test('an allow-listed but UNVERIFIED email is not bootstrapped (H19)', async () => {
  const state = installStub();
  const token = mintIdToken({ uid: 'attacker', email: 'owner@flowbiz.co.ke' });
  await assert.rejects(
    verifyAdminAuth(adminRequest('/api/admin/overview', { token }), env),
    (err) => err.status === 403
  );
  assert.equal(state.store['systemAdmins/attacker'], undefined, 'no admin record was created');
});

test('an explicitly unverified email is refused too', async () => {
  installStub();
  const token = mintIdToken({ uid: 'attacker2', email: 'owner@flowbiz.co.ke', emailVerified: false });
  await assert.rejects(verifyAdminAuth(adminRequest('/api/admin/overview', { token }), env), (err) => err.status === 403);
});

test('the allow-listed owner with a VERIFIED email is bootstrapped SUPER_ADMIN', async () => {
  installStub();
  const token = mintIdToken({ uid: 'owner', email: 'owner@flowbiz.co.ke', emailVerified: true });
  const admin = await verifyAdminAuth(adminRequest('/api/admin/overview', { token }), env);
  assert.equal(admin.role, 'SUPER_ADMIN');
});
