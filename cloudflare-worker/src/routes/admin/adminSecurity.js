// cloudflare-worker/src/routes/admin/adminSecurity.js
//
// The Super Admin's security surface. Three endpoints, and they answer
// exactly the five questions the console needs to be able to answer:
//
//     Is somebody repeatedly trying to get into an account?
//     Which account are they targeting?
//     When did it happen?
//     Did they get in?
//     What can I do about it right now?
//
//   GET  /api/admin/security               — the picture: counts, the
//                                            clusters worth looking at,
//                                            and the recent activity.
//   GET  /api/admin/security/events        — the filtered log.
//   POST /api/admin/security/actions       — do something about it.
//
// EVERY ONE re-verifies the caller server-side. The client's
// AdminProtectedRoute decides what to RENDER and contributes nothing to
// what is allowed: reading needs `security.read`, and every action needs
// `security.act`, which is a strictly account-affecting capability.
//
// WHAT THE ACTIONS ACTUALLY DO — no action here is a label on a screen:
//
//   disableUser / enableUser  → Firebase Identity Toolkit. A disabled
//     account is refused by Firebase itself, before FlowBiz is consulted.
//     Reversible, and it touches no business data.
//   revokeSessions            → Identity Toolkit `validSince`, plus every
//     FlowBiz device session document for that person. The person can
//     sign in again immediately; every device holding an old credential
//     cannot.
//   resolveEvent              → triage state on the event itself. It
//     changes nothing about access and does not pretend to.
//
// Suspending and reactivating a WORKSPACE is deliberately not duplicated
// here: it already exists, audited and permissioned, at
// POST /api/admin/businesses/:id/status. The security page calls that.

import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission, logAdminAction, requestContext, can } from '../../lib/adminAuth.js';
import { assertDocumentId, intParam, enumParam, searchParam } from '../../lib/validate.js';
import { queryCollection, patchDocument, getDocument } from '../../lib/firestore.js';
import { setAuthUserDisabled, revokeRefreshTokens } from '../../lib/identityToolkit.js';
import { emailHandle, REASON_VALUES } from '../../lib/loginEvents.js';

const MAX_SCAN = 500;

/**
 * The recent window of events, newest first.
 *
 * `createdAt DESC` needs a single-field index, which Firestore provides
 * automatically — there is no composite here on purpose, so this endpoint
 * cannot start failing because an index is still building. Filtering
 * happens in the Worker over a bounded scan.
 */
async function recentEvents(env, limit) {
  return queryCollection(env, 'loginEvents', {
    orderBy: 'createdAt',
    orderDirection: 'DESCENDING',
    limit: Math.min(limit, MAX_SCAN),
  });
}

/** ISO string or Date -> ms, tolerating either shape from Firestore. */
function millis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The clusters worth a human looking at.
 *
 * A cluster is repeated FAILURE against one account, or from one address,
 * inside the window. The thresholds are deliberately plain numbers rather
 * than a score: an administrator has to be able to say what made
 * something appear on this list.
 */
function suspiciousClusters(events, { windowMs = 24 * 60 * 60 * 1000 } = {}) {
  const since = Date.now() - windowMs;
  const recent = events.filter((e) => millis(e.createdAt) >= since);

  const byAccount = new Map();
  const byIp = new Map();

  for (const event of recent) {
    if (event.outcome !== 'failure') continue;

    const accountKey = event.emailHandle || event.targetUid;
    if (accountKey) {
      const entry = byAccount.get(accountKey) || {
        kind: 'account',
        key: accountKey,
        label: event.targetEmail || event.emailMasked || 'Unknown account',
        targetUid: event.targetUid || null,
        targetBusinessId: event.targetBusinessId || null,
        knownAccount: Boolean(event.knownAccount),
        failures: 0, addresses: new Set(), lastAt: null, reasons: new Set(),
      };
      entry.failures += 1;
      if (event.ip) entry.addresses.add(event.ip);
      if (event.reason) entry.reasons.add(event.reason);
      entry.lastAt = entry.lastAt && millis(entry.lastAt) > millis(event.createdAt) ? entry.lastAt : event.createdAt;
      byAccount.set(accountKey, entry);
    }

    if (event.ip) {
      const entry = byIp.get(event.ip) || {
        kind: 'address', key: event.ip, label: event.ip,
        failures: 0, accounts: new Set(), lastAt: null, reasons: new Set(),
      };
      entry.failures += 1;
      if (event.emailHandle) entry.accounts.add(event.emailHandle);
      if (event.reason) entry.reasons.add(event.reason);
      entry.lastAt = entry.lastAt && millis(entry.lastAt) > millis(event.createdAt) ? entry.lastAt : event.createdAt;
      byIp.set(event.ip, entry);
    }
  }

  // A success from the same address after a run of failures is the shape
  // that matters most: somebody tried until they got in.
  const succeededAfterFailures = new Set();
  for (const event of recent) {
    if (event.outcome !== 'success' || !event.ip) continue;
    const entry = byIp.get(event.ip);
    if (entry && entry.failures >= 3) succeededAfterFailures.add(event.ip);
  }

  const accounts = [...byAccount.values()]
    .filter((entry) => entry.failures >= 5)
    .map((entry) => ({
      kind: entry.kind, key: entry.key, label: entry.label,
      targetUid: entry.targetUid, targetBusinessId: entry.targetBusinessId,
      knownAccount: entry.knownAccount,
      failures: entry.failures, distinctAddresses: entry.addresses.size,
      reasons: [...entry.reasons], lastAt: entry.lastAt,
      breachedAfterFailures: false,
    }));

  const addresses = [...byIp.values()]
    // Three shapes are worth surfacing, and the third is the one that
    // matters most: an address that kept failing and then SUCCEEDED is
    // reported even below the ordinary threshold, because "they got in"
    // is not a volume question.
    .filter((entry) =>
      entry.failures >= 5
      || (entry.accounts.size >= 3 && entry.failures >= 3)
      || succeededAfterFailures.has(entry.key))
    .map((entry) => ({
      kind: entry.kind, key: entry.key, label: entry.label,
      failures: entry.failures, distinctAccounts: entry.accounts.size,
      reasons: [...entry.reasons], lastAt: entry.lastAt,
      breachedAfterFailures: succeededAfterFailures.has(entry.key),
    }));

  return [...accounts, ...addresses].sort((a, b) => b.failures - a.failures).slice(0, 25);
}

// ── GET /api/admin/security ──────────────────────────────────────────

export async function handleAdminSecurityOverview(request, env, url) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'security.read');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const scan = intParam(url, 'scan', { fallback: 300, min: 50, max: MAX_SCAN });
  const events = await recentEvents(env, scan);

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const inDay = events.filter((e) => millis(e.createdAt) >= dayAgo);
  const inWeek = events.filter((e) => millis(e.createdAt) >= weekAgo);

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'VIEW_SECURITY_ACTIVITY', {
    targetResource: 'loginEvents',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return json({
    summary: {
      scanned: events.length,
      signInsToday: inDay.filter((e) => e.outcome === 'success').length,
      failuresToday: inDay.filter((e) => e.outcome === 'failure').length,
      failuresThisWeek: inWeek.filter((e) => e.outcome === 'failure').length,
      unresolvedFailures: events.filter((e) => e.outcome === 'failure' && e.resolved !== true).length,
      oldest: events.length ? events[events.length - 1].createdAt : null,
    },
    clusters: suspiciousClusters(events),
    events: events.slice(0, 100),
    permissions: {
      canAct: can(admin, 'security.act'),
      canSuspend: can(admin, 'business.status'),
    },
    // Said out loud in the payload, so the console cannot present a
    // reported failure as a proven one by forgetting to.
    provenance: {
      successesAreVerified: true,
      failuresAreClientReported: true,
      note: 'A success is proved by a verified Firebase ID token. A failure produces no token, '
        + 'so it is reported by the browser; its IP and device are server-observed.',
    },
  });
}

// ── GET /api/admin/security/events ───────────────────────────────────

export async function handleAdminSecurityEvents(request, env, url) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'security.read');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const outcome = enumParam(url, 'outcome', ['all', 'success', 'failure'], 'all');
  const reason = enumParam(url, 'reason', ['all', ...REASON_VALUES], 'all');
  const businessId = searchParam(url, 'businessId', 120);
  const search = searchParam(url, 'search', 254);
  const limit = intParam(url, 'limit', { fallback: 100, min: 1, max: 200 });

  let events = await recentEvents(env, MAX_SCAN);

  if (outcome !== 'all') events = events.filter((e) => e.outcome === outcome);
  if (reason !== 'all') events = events.filter((e) => e.reason === reason);
  if (businessId) events = events.filter((e) => e.targetBusinessId === businessId);
  if (search) {
    // An email is matched by its HANDLE, never by storing the search term
    // — the log holds masked addresses on purpose, and searching it must
    // not become a way to confirm one.
    const handle = await emailHandle(search);
    const needle = search.toLowerCase();
    events = events.filter((e) =>
      (handle && e.emailHandle === handle)
      || (e.ip || '').toLowerCase().includes(needle)
      || (e.targetEmail || '').toLowerCase().includes(needle)
    );
  }

  return json({ events: events.slice(0, limit), total: events.length });
}

// ── POST /api/admin/security/actions ─────────────────────────────────

const ACTIONS = ['disableUser', 'enableUser', 'revokeSessions', 'resolveEvent'];

export async function handleAdminSecurityAction(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'security.act');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const action = typeof body?.action === 'string' ? body.action : '';
  if (!ACTIONS.includes(action)) {
    return errorResponse(`Unknown action. Expected one of: ${ACTIONS.join(', ')}.`, 400);
  }
  const note = typeof body?.reason === 'string' ? body.reason.slice(0, 300) : null;
  const ctx = requestContext(request);

  if (action === 'resolveEvent') {
    let eventId;
    try {
      eventId = assertDocumentId(body?.eventId, 'eventId');
    } catch (err) {
      return errorResponse(err.message, 400);
    }
    const event = await getDocument(env, 'loginEvents', eventId);
    if (!event) return errorResponse('Security event not found.', 404);

    await patchDocument(env, 'loginEvents', eventId, {
      resolved: body?.resolved !== false,
      resolvedBy: admin.email,
      resolvedAt: new Date(),
      resolutionNote: note,
    });
    await logAdminAction(env, admin, 'RESOLVE_SECURITY_EVENT', {
      targetBusinessId: event.targetBusinessId || null,
      targetResource: `loginEvents/${eventId}`,
      details: { resolved: body?.resolved !== false, note },
      ip: ctx.ip, userAgent: ctx.userAgent,
    });
    return json({ success: true, eventId });
  }

  // The three account actions. All of them need a real FlowBiz user, so
  // an administrator cannot act on a uid that only ever appeared in a
  // client-reported failure.
  let uid;
  try {
    uid = assertDocumentId(body?.uid, 'uid');
  } catch (err) {
    return errorResponse(err.message, 400);
  }
  const user = await getDocument(env, 'users', uid);
  if (!user) return errorResponse('That account was not found.', 404);

  if (action === 'revokeSessions') {
    // Both halves, because they stop different things: Firebase stops
    // refreshing the account's tokens, and FlowBiz's own device sessions
    // stop being usable by a client that is already open.
    await revokeRefreshTokens(env, uid);
    let devices = 0;
    if (user.businessId) {
      const sessions = await queryCollection(env, 'sessions', {
        filters: [{ field: 'uid', value: uid }],
        limit: 200,
      });
      for (const session of sessions) {
        if (session.revoked === true) continue;
        await patchDocument(env, 'sessions', session.id, {
          revoked: true,
          revokedReason: 'security_action',
        });
        devices += 1;
      }
    }
    await logAdminAction(env, admin, 'REVOKE_USER_SESSIONS', {
      targetBusinessId: user.businessId || null,
      targetResource: `users/${uid}`,
      details: { devices, note },
      ip: ctx.ip, userAgent: ctx.userAgent,
    });
    return json({ success: true, uid, devicesRevoked: devices });
  }

  const disabled = action === 'disableUser';
  await setAuthUserDisabled(env, uid, disabled);
  // The FlowBiz profile is moved with it, so the merchant app blocks the
  // account too rather than only Firebase refusing the next token — and
  // it is stamped, so re-enabling restores exactly what this action took.
  await patchDocument(env, 'users', uid, {
    active: !disabled,
    disabledByPlatform: disabled,
    deactivationReason: disabled ? 'platform_security' : null,
  });
  await logAdminAction(env, admin, disabled ? 'DISABLE_USER_ACCOUNT' : 'ENABLE_USER_ACCOUNT', {
    targetBusinessId: user.businessId || null,
    targetResource: `users/${uid}`,
    details: { email: user.email || null, note },
    ip: ctx.ip, userAgent: ctx.userAgent,
  });
  return json({ success: true, uid, disabled });
}
