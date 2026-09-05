// cloudflare-worker/src/lib/adminAuth.js
//
// The single gate in front of every platform-admin route.
//
// Two separate questions get answered here, and conflating them was the
// main weakness of the earlier version:
//
//   AUTHENTICATION — is this really the Firebase user the token claims?
//     Answered by verifyFirebaseIdToken(); nothing downstream runs if it
//     throws.
//
//   AUTHORISATION — is this user a platform administrator, and is this
//     PARTICULAR administrator allowed to do this PARTICULAR thing?
//     Answered by the systemAdmins document plus the PERMISSIONS table
//     below. The browser never contributes to this decision: the client's
//     AdminProtectedRoute only decides what to render, and every route
//     re-derives the answer server-side on every request.

import { verifyFirebaseIdToken } from './firebaseIdToken.js';
import { getDocument, createDocument } from './firestore.js';

// ── Roles ─────────────────────────────────────────────────────────────
// Ordered from least to most privileged. A role that is not in this list
// is treated as the least privileged thing we have, never as an admin.
export const ROLES = ['SUPPORT', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'];

const ALL = ROLES;
const ADMIN_UP = ['ADMIN', 'SUPER_ADMIN'];
const SUPER_ONLY = ['SUPER_ADMIN'];

/**
 * Which roles may perform which operation. This table is the whole
 * authorisation model — a route asks for a capability by name, it does
 * not hand-roll a role comparison.
 */
export const PERMISSIONS = {
  // Reading the directory and a business's operational data for support.
  'business.read':          ALL,
  'business.inspect':       ALL,
  // Anything that changes a merchant's account or reaches their inbox.
  'business.status':        ADMIN_UP,
  'business.subscription':  ADMIN_UP,
  // Changing which industry profile and capabilities a business runs on.
  // Presentation and behaviour only — it can reach neither the plan nor
  // any operational record — but it changes what a merchant sees, so it
  // sits with the other account-affecting capabilities rather than with
  // the read-only ones.
  'business.industry':      ADMIN_UP,
  'business.accountEmail':  ADMIN_UP,
  'business.delete':        SUPER_ONLY,
  // Platform operations and monitoring.
  'ops.read':               ALL,
  'payments.read':          ['FINANCE', 'ADMIN', 'SUPER_ADMIN'],
  // Security surfaces.
  'audit.read':             ADMIN_UP,
  // Reading authentication activity, and acting on it. Reading is an
  // inspection of who tried to sign in where; ACTING disables a person's
  // sign-in or forces every device signed in as them to authenticate
  // again, which is an account action and sits with the other ones.
  'security.read':          ADMIN_UP,
  'security.act':           ADMIN_UP,
  'admins.read':            ADMIN_UP,
  'admins.manage':          SUPER_ONLY,
  // Outbound merchant communication.
  'comms.send':             ADMIN_UP,
};

export class AuthorizationError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

/**
 * Throws unless `admin` holds `capability`. Call this at the top of every
 * route, after verifyAdminAuth and before touching any data.
 */
export function requirePermission(admin, capability) {
  const allowed = PERMISSIONS[capability];
  if (!allowed) throw new AuthorizationError(`Unknown capability: ${capability}`, 500);
  if (!allowed.includes(admin.role)) {
    throw new AuthorizationError(
      `Your administrator role (${admin.role}) is not permitted to perform this action.`,
      403
    );
  }
  return true;
}

export function can(admin, capability) {
  return Boolean(PERMISSIONS[capability]?.includes(admin.role));
}

/** The capability map the client uses to decide what to render. */
export function permissionsFor(admin) {
  const out = {};
  for (const capability of Object.keys(PERMISSIONS)) out[capability] = can(admin, capability);
  return out;
}

// ── Role resolution ───────────────────────────────────────────────────
//
// A custom claim used to be mapped to SUPER_ADMIN regardless of what it
// actually said, so a token carrying `role: 'ADMIN'` came back as a super
// admin and could delete businesses and mint other admins. Claims are now
// read literally, and anything unrecognised lands on SUPPORT.
function roleFromClaims(claims) {
  if (!claims) return null;
  if (claims.superAdmin === true) return 'SUPER_ADMIN';
  if (typeof claims.role === 'string' && ROLES.includes(claims.role.toUpperCase())) {
    return claims.role.toUpperCase();
  }
  if (claims.admin === true) return 'ADMIN';
  return null;
}

export async function verifyAdminAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    throw new AuthorizationError('Missing or malformed Authorization header.', 401);
  }

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    throw new AuthorizationError(`Invalid session: ${err.message}`, 401);
  }

  const uid = caller.uid;
  const email = (caller.email || '').toLowerCase().trim();

  // 1. Environment-configured bootstrap admins (the platform owner).
  const adminEmails = (env.ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const adminUids = (env.ADMIN_UIDS || '')
    .split(',').map((u) => u.trim()).filter(Boolean);
  const isEnvAdmin = (email && adminEmails.includes(email)) || (uid && adminUids.includes(uid));

  // 2. Custom claims on the verified token.
  const claimRole = roleFromClaims(caller.claims);

  // 3. The systemAdmins register, which is authoritative once it exists.
  let adminDoc = await getDocument(env, 'systemAdmins', uid);

  // An explicitly deactivated administrator is denied, FULL STOP. The old
  // code let an env-listed or claim-carrying admin walk straight past
  // `active: false`, which made "deactivate this admin" advisory rather
  // than binding. Revocation has to actually revoke.
  if (adminDoc && adminDoc.active === false) {
    throw new AuthorizationError(
      'This administrator account has been deactivated.',
      403
    );
  }

  // Bootstrap only happens when there is NO register entry at all.
  if (!adminDoc && (isEnvAdmin || claimRole)) {
    const bootstrapRole = isEnvAdmin ? 'SUPER_ADMIN' : claimRole;
    const newAdmin = {
      uid,
      email,
      name: caller.claims?.name || email.split('@')[0] || 'System Admin',
      role: bootstrapRole,
      active: true,
      bootstrappedFrom: isEnvAdmin ? 'ADMIN_EMAILS' : 'CUSTOM_CLAIM',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };
    try {
      await createDocument(env, 'systemAdmins', uid, newAdmin);
      adminDoc = { id: uid, ...newAdmin };
    } catch {
      // A concurrent bootstrap won the race; carry on with the same shape.
      adminDoc = { id: uid, ...newAdmin };
    }
  }

  if (!adminDoc) {
    throw new AuthorizationError(
      'Access denied: You do not have FlowBiz platform administrator privileges.',
      403
    );
  }

  const storedRole = typeof adminDoc.role === 'string' ? adminDoc.role.toUpperCase() : null;
  const role = ROLES.includes(storedRole) ? storedRole : 'SUPPORT';

  return {
    uid,
    email,
    name: adminDoc.name || caller.claims?.name || email.split('@')[0] || 'Administrator',
    role,
    isSuperAdmin: role === 'SUPER_ADMIN',
    adminDoc,
  };
}

// ── Audit trail ───────────────────────────────────────────────────────
//
// The audit trail records SECURITY AND OPERATIONS events, not page views.
// Two rules keep it that way, and keep it cheap:
//
//   * Mutations are always written. Suspending a business, granting a
//     plan, minting an admin, emailing a merchant — every one, every time.
//
//   * Inspections are coalesced. Opening a business and clicking through
//     six tabs used to write eight audit documents; a support agent
//     working one ticket could write fifty. The same admin looking at the
//     same resource on the same business now writes at most one document
//     per COALESCE_WINDOW_MS. The security question an auditor asks is
//     "did this admin look at that business's customer list today", and
//     one entry answers it as well as fifty.
//
// The window map is per-isolate, so the worst case across many isolates
// is a handful of duplicate entries — which is the safe direction to be
// wrong in.

const COALESCE_WINDOW_MS = 10 * 60 * 1000;
const recentInspections = new Map();

export const INSPECTION_ACTIONS = new Set([
  'VIEW_BUSINESS',
  'VIEW_BUSINESS_DATA',
  'INSPECT_BUSINESS_SECTION',
  'VIEW_BUSINESS_USAGE',
]);

function shouldCoalesce(action, key) {
  if (!INSPECTION_ACTIONS.has(action)) return false;
  const now = Date.now();
  const last = recentInspections.get(key);
  if (last && now - last < COALESCE_WINDOW_MS) return true;

  // Bounded cleanup so a long-lived isolate cannot grow this map without
  // limit; entries older than the window can never suppress anything.
  if (recentInspections.size > 500) {
    for (const [k, t] of recentInspections) {
      if (now - t >= COALESCE_WINDOW_MS) recentInspections.delete(k);
    }
  }
  recentInspections.set(key, now);
  return false;
}

export async function logAdminAction(env, admin, action, {
  targetBusinessId = null,
  targetResource = null,
  details = {},
  ip = null,
  userAgent = null,
} = {}) {
  try {
    const key = `${admin.uid}|${action}|${targetBusinessId || '-'}|${targetResource || '-'}`;
    if (shouldCoalesce(action, key)) return { written: false, coalesced: true };

    const logId = `log_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await createDocument(env, 'adminAuditLogs', logId, {
      adminUid: admin.uid,
      adminEmail: admin.email,
      adminName: admin.name,
      adminRole: admin.role,
      action,
      targetBusinessId: targetBusinessId || null,
      targetResource: targetResource || null,
      details: details || {},
      ip: ip || null,
      userAgent: userAgent || null,
      timestamp: new Date(),
    });
    return { written: true, coalesced: false };
  } catch (err) {
    // An audit failure must never take down the operation being audited —
    // but it must be visible in the Worker log.
    console.error('[AdminAuditLog] Failed to record audit entry:', err);
    return { written: false, coalesced: false, error: err.message };
  }
}

/** Convenience: the request metadata every audit entry wants. */
export function requestContext(request) {
  return {
    ip: request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || null,
    userAgent: request.headers.get('User-Agent') || null,
  };
}
