// The workspace suspension lifecycle, end to end.
//
//     ACTIVE → suspend → blocked → reactivate → ACTIVE
//
// This is a state machine, not a one-way door, and it used to be one: the
// suspend path switched off every staff account and the reactivate path
// never switched them back on, so a reactivated business's owner stayed
// locked out of an account nobody could see was still deactivated.
//
// The Firestore stub ACTUALLY APPLIES its writes (see
// helpers/adminHarness.js), so what is being asserted here is the state
// the documents are left in after each transition — not merely which
// calls were made.

import test from 'node:test';
import assert from 'node:assert/strict';
import { installStub, mintIdToken, adminRequest, env } from './helpers/adminHarness.js';

const BASE = new URL('../src/', import.meta.url).href;
const state = installStub();

const { handleAdminToggleBusinessStatus } = await import(`${BASE}routes/admin/adminBusinesses.js`);

const post = (status, reason = null) =>
  adminRequest('/api/admin/businesses/BIZ_A/status', {
    method: 'POST', token: mintIdToken(), body: { status, reason },
  });

function reset() {
  state.store = {};
  state.store['systemAdmins/admin-uid'] = { uid: 'admin-uid', email: 'ops@flowbiz.co.ke', role: 'SUPER_ADMIN', active: true };
  state.store['businesses/BIZ_A'] = { name: 'Duka A', createdBy: 'owner-a', status: 'active' };
  state.store['businesses/BIZ_B'] = { name: 'Duka B', createdBy: 'owner-b', status: 'active' };
  state.store['users/owner-a'] = { uid: 'owner-a', businessId: 'BIZ_A', role: 'owner', active: true };
  state.store['users/cashier-a1'] = { uid: 'cashier-a1', businessId: 'BIZ_A', role: 'cashier', active: true };
  // Already switched off by the OWNER, before any suspension. Reactivation
  // must not resurrect this one.
  state.store['users/cashier-a2'] = { uid: 'cashier-a2', businessId: 'BIZ_A', role: 'cashier', active: false };
  state.store['users/owner-b'] = { uid: 'owner-b', businessId: 'BIZ_B', role: 'owner', active: true };
  state.store['sessions/dev1__owner-a'] = { uid: 'owner-a', businessId: 'BIZ_A', revoked: false };
  state.store['sessions/dev2__cashier-a1'] = { uid: 'cashier-a1', businessId: 'BIZ_A', revoked: false };
  state.store['sessions/dev9__owner-b'] = { uid: 'owner-b', businessId: 'BIZ_B', revoked: false };
}

// ── Suspend ──────────────────────────────────────────────────────────

test('suspending blocks every ACTIVE account and stamps why', async () => {
  reset();
  const res = await handleAdminToggleBusinessStatus(post('suspended', 'non-payment'), env, 'BIZ_A');
  assert.equal(res.status, 200);

  assert.equal(state.store['businesses/BIZ_A'].status, 'suspended');
  assert.equal(state.store['users/owner-a'].active, false);
  assert.equal(state.store['users/owner-a'].deactivatedByWorkspace, true);
  assert.equal(state.store['users/owner-a'].deactivationReason, 'workspace_suspended');
  assert.equal(state.store['users/cashier-a1'].active, false);
  assert.equal(state.store['users/cashier-a1'].deactivatedByWorkspace, true);
});

test('an account the OWNER had already switched off is not stamped', async () => {
  reset();
  await handleAdminToggleBusinessStatus(post('suspended'), env, 'BIZ_A');
  assert.equal(state.store['users/cashier-a2'].active, false);
  assert.notEqual(state.store['users/cashier-a2'].deactivatedByWorkspace, true);
});

test('suspending one business never touches another', async () => {
  reset();
  await handleAdminToggleBusinessStatus(post('suspended'), env, 'BIZ_A');
  assert.equal(state.store['users/owner-b'].active, true);
  assert.equal(state.store['businesses/BIZ_B'].status, 'active');
  assert.equal(state.store['sessions/dev9__owner-b'].revoked, false);
});

test('suspending revokes the open sessions so the block reaches a device already signed in', async () => {
  reset();
  await handleAdminToggleBusinessStatus(post('suspended'), env, 'BIZ_A');
  assert.equal(state.store['sessions/dev1__owner-a'].revoked, true);
  assert.equal(state.store['sessions/dev1__owner-a'].revokedReason, 'workspace_suspended');
  assert.equal(state.store['sessions/dev2__cashier-a1'].revoked, true);
});

test('suspending deletes nothing', async () => {
  reset();
  const business = (keys) => keys.filter((k) => !k.startsWith('adminAuditLogs/')).sort();
  const before = business(Object.keys(state.store));
  await handleAdminToggleBusinessStatus(post('suspended'), env, 'BIZ_A');
  assert.deepEqual(business(Object.keys(state.store)), before, 'no document may disappear');
  assert.equal(state.store['businesses/BIZ_A'].name, 'Duka A');
});

// ── Reactivate ───────────────────────────────────────────────────────

test('THE LIFECYCLE: active → suspend → reactivate returns every account it took', async () => {
  reset();
  await handleAdminToggleBusinessStatus(post('suspended', 'non-payment'), env, 'BIZ_A');
  const res = await handleAdminToggleBusinessStatus(post('active', 'paid'), env, 'BIZ_A');
  assert.equal(res.status, 200);

  assert.equal(state.store['businesses/BIZ_A'].status, 'active');
  for (const uid of ['owner-a', 'cashier-a1']) {
    assert.equal(state.store[`users/${uid}`].active, true, `${uid} must be able to sign in again`);
    assert.equal(state.store[`users/${uid}`].deactivatedByWorkspace, false);
    assert.equal(state.store[`users/${uid}`].deactivationReason, null);
  }
});

test('reactivation does NOT resurrect an account the owner had disabled', async () => {
  reset();
  await handleAdminToggleBusinessStatus(post('suspended'), env, 'BIZ_A');
  await handleAdminToggleBusinessStatus(post('active'), env, 'BIZ_A');
  assert.equal(state.store['users/cashier-a2'].active, false, 'the owner\'s decision stands');
});

test('reactivation reports what it restored', async () => {
  reset();
  await handleAdminToggleBusinessStatus(post('suspended'), env, 'BIZ_A');
  const body = await (await handleAdminToggleBusinessStatus(post('active'), env, 'BIZ_A')).json();
  assert.equal(body.staffRestored, 2);
  assert.equal(body.status, 'active');
});

test('suspend / reactivate / suspend / reactivate is stable', async () => {
  reset();
  for (let i = 0; i < 3; i++) {
    await handleAdminToggleBusinessStatus(post('suspended'), env, 'BIZ_A');
    assert.equal(state.store['users/owner-a'].active, false);
    await handleAdminToggleBusinessStatus(post('active'), env, 'BIZ_A');
    assert.equal(state.store['users/owner-a'].active, true, `round ${i + 1}`);
    assert.equal(state.store['users/cashier-a2'].active, false, 'and never this one');
  }
});

test('a revoked session is left revoked — the way back in is a fresh sign-in', async () => {
  reset();
  await handleAdminToggleBusinessStatus(post('suspended'), env, 'BIZ_A');
  await handleAdminToggleBusinessStatus(post('active'), env, 'BIZ_A');
  assert.equal(state.store['sessions/dev1__owner-a'].revoked, true);
});

test('marking a business expired does not touch staff accounts either way', async () => {
  reset();
  await handleAdminToggleBusinessStatus(post('expired'), env, 'BIZ_A');
  assert.equal(state.store['businesses/BIZ_A'].status, 'expired');
  assert.equal(state.store['users/owner-a'].active, true);
});

// ── Authorisation is still the gate ──────────────────────────────────

test('a SUPPORT administrator may not suspend anything', async () => {
  reset();
  state.store['systemAdmins/admin-uid'].role = 'SUPPORT';
  const res = await handleAdminToggleBusinessStatus(post('suspended'), env, 'BIZ_A');
  assert.equal(res.status, 403);
  assert.equal(state.store['users/owner-a'].active, true, 'nothing may be written on a refused call');
});

test('an unauthenticated caller may not reactivate anything', async () => {
  reset();
  await handleAdminToggleBusinessStatus(post('suspended'), env, 'BIZ_A');
  const res = await handleAdminToggleBusinessStatus(
    adminRequest('/api/admin/businesses/BIZ_A/status', { method: 'POST', body: { status: 'active' } }),
    env, 'BIZ_A'
  );
  assert.equal(res.status, 401);
  assert.equal(state.store['users/owner-a'].active, false);
});

test('an invalid status is refused before anything is written', async () => {
  reset();
  const res = await handleAdminToggleBusinessStatus(post('deleted'), env, 'BIZ_A');
  assert.equal(res.status, 400);
  assert.equal(state.store['businesses/BIZ_A'].status, 'active');
});

// ── The state an earlier deployment leaves behind ────────────────────
//
// A workspace suspended by a build that did not stamp anything: the staff
// are `active: false` with no `deactivatedByWorkspace`, and the status may
// already have been flipped back to active by a reactivation that found
// nothing to restore. Both are real, both locked the merchant out, and
// both have to be recoverable from the console.

function legacySuspended({ statusAlreadyActive = false } = {}) {
  reset();
  state.store['businesses/BIZ_A'].status = statusAlreadyActive ? 'active' : 'suspended';
  // No stamp — this is exactly what the previous suspend code wrote.
  state.store['users/owner-a'] = { uid: 'owner-a', businessId: 'BIZ_A', role: 'owner', active: false };
  state.store['users/cashier-a1'] = { uid: 'cashier-a1', businessId: 'BIZ_A', role: 'cashier', active: false };
  // Switched off by the OWNER, with the marker the current client writes.
  state.store['users/cashier-a2'] = {
    uid: 'cashier-a2', businessId: 'BIZ_A', role: 'cashier', active: false,
    deactivatedByWorkspace: false, deactivationReason: 'owner_deactivated',
  };
}

const repair = () => adminRequest('/api/admin/businesses/BIZ_A/status', {
  method: 'POST', token: mintIdToken(), body: { status: 'active', restoreStaff: true },
});

test('an ordinary reactivation restores only what it can PROVE it took', async () => {
  legacySuspended();
  const body = await (await handleAdminToggleBusinessStatus(post('active'), env, 'BIZ_A')).json();
  // Nothing here is stamped, so nothing here is provably this code's
  // doing. Guessing would risk switching on somebody an owner switched
  // off; the console offers the guess as a separate, labelled action.
  assert.equal(body.staffRestored, 0);
  assert.equal(state.store['users/owner-a'].active, false);
});

test('the explicit repair restores a workspace suspended by an OLDER build', async () => {
  legacySuspended();
  const body = await (await handleAdminToggleBusinessStatus(repair(), env, 'BIZ_A')).json();

  assert.equal(state.store['users/owner-a'].active, true, 'the owner must be able to sign in again');
  assert.equal(state.store['users/cashier-a1'].active, true);
  assert.equal(body.staffRestored, 2);
  assert.equal(body.staffRestoredUnstamped, 2, 'and the audit records that it was inferred');
});

test('the repair still leaves an account the owner disabled alone', async () => {
  legacySuspended();
  const body = await (await handleAdminToggleBusinessStatus(repair(), env, 'BIZ_A')).json();
  assert.equal(state.store['users/cashier-a2'].active, false, "the owner's decision stands");
  assert.equal(body.staffLeftInactive, 1);
});

test('a platform security disable survives the repair', async () => {
  legacySuspended();
  state.store['users/cashier-a1'] = {
    uid: 'cashier-a1', businessId: 'BIZ_A', role: 'cashier', active: false,
    disabledByPlatform: true, deactivationReason: 'platform_security',
  };
  await handleAdminToggleBusinessStatus(repair(), env, 'BIZ_A');
  assert.equal(state.store['users/cashier-a1'].active, false, 'a security action is not undone by this');
  assert.equal(state.store['users/owner-a'].active, true);
});

// THE EXACT STATE REPORTED: reactivated once already, so the status is
// active and the accounts are still down. Pressing reactivate again used
// to be a no-op, because there was nothing stamped to find.
test('a workspace already flipped to active with staff still down is repairable', async () => {
  legacySuspended({ statusAlreadyActive: true });

  // Without asking, nothing is swept: the workspace was not suspended when
  // this call arrived, so an inactive account is not attributable to it.
  const quiet = await (await handleAdminToggleBusinessStatus(post('active'), env, 'BIZ_A')).json();
  assert.equal(quiet.staffRestored, 0);
  assert.equal(state.store['users/owner-a'].active, false);

  // Asking explicitly is the repair path the console offers.
  const repaired = await (await handleAdminToggleBusinessStatus(repair(), env, 'BIZ_A')).json();
  assert.equal(repaired.staffRestored, 2);
  assert.equal(state.store['users/owner-a'].active, true);
  assert.equal(state.store['users/cashier-a2'].active, false, 'and it is still not a blunt instrument');
});

test('a repair may not be run by an administrator who cannot suspend', async () => {
  legacySuspended({ statusAlreadyActive: true });
  state.store['systemAdmins/admin-uid'].role = 'SUPPORT';
  const res = await handleAdminToggleBusinessStatus(repair(), env, 'BIZ_A');
  assert.equal(res.status, 403);
  assert.equal(state.store['users/owner-a'].active, false);
});

// THE ACCOUNT THAT COULD NOT BE RESCUED. `deactivatedByWorkspace: false`
// with no reason is what a PREVIOUS restore leaves behind, and it used to
// veto the sweep — so an account that went suspended → restored →
// suspended by an older build → reactivated was stranded permanently. The
// console listed it as restorable and the sweep silently refused it. The
// owner's intent is carried by the REASON, not by that flag.
test('a cleared stamp does not veto the repair', async () => {
  legacySuspended({ statusAlreadyActive: true });
  state.store['users/owner-a'] = {
    uid: 'owner-a', businessId: 'BIZ_A', role: 'owner', active: false,
    deactivatedByWorkspace: false, deactivationReason: null,
  };

  const body = await (await handleAdminToggleBusinessStatus(repair(), env, 'BIZ_A')).json();
  assert.equal(state.store['users/owner-a'].active, true, 'the owner must not be stranded by a cleared stamp');
  assert.equal(body.staffLeftInactive, 1, 'and only the owner-disabled account is left');
});

test('an account the repair declines is reported with the reason why', async () => {
  legacySuspended({ statusAlreadyActive: true });
  const body = await (await handleAdminToggleBusinessStatus(repair(), env, 'BIZ_A')).json();
  const left = body.skipped.find((a) => a.uid === 'cashier-a2');
  assert.equal(left.reason, 'owner_deactivated', 'a silent count sends the administrator round the loop again');
});

test('restoring nothing is not an error — it reports that there was nothing to do', async () => {
  reset();
  const body = await (await handleAdminToggleBusinessStatus(post('active'), env, 'BIZ_A')).json();
  assert.equal(body.staffRestored, 0);
  assert.equal(state.store['users/owner-a'].active, true);
});
