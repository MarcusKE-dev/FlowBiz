import { verifyFirebaseIdToken } from './firebaseIdToken.js';
import { getDocument, createDocument } from './firestore.js';

export async function verifyAdminAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    const err = new Error('Missing or malformed Authorization header.');
    err.status = 401;
    throw err;
  }

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    const e = new Error(`Invalid session: ${err.message}`);
    e.status = 401;
    throw e;
  }

  const uid = caller.uid;
  const email = (caller.email || '').toLowerCase().trim();

  // 1. Check environment configured admin emails / UIDs
  const adminEmails = (env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const adminUids = (env.ADMIN_UIDS || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  const isEnvAdmin = (email && adminEmails.includes(email)) || (uid && adminUids.includes(uid));

  // 2. Check Custom Claims in JWT
  const hasAdminClaim =
    caller.claims?.admin === true ||
    caller.claims?.superAdmin === true ||
    caller.claims?.role === 'SUPER_ADMIN' ||
    caller.claims?.role === 'ADMIN';

  // 3. Check systemAdmins collection in Firestore
  let adminDoc = await getDocument(env, 'systemAdmins', uid);

  // Auto-bootstrap super admin if matching environment configuration or custom claim
  if (!adminDoc && (isEnvAdmin || hasAdminClaim)) {
    const newAdmin = {
      uid,
      email,
      name: caller.claims?.name || email.split('@')[0] || 'System Admin',
      role: 'SUPER_ADMIN',
      active: true,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };
    try {
      await createDocument(env, 'systemAdmins', uid, newAdmin);
      adminDoc = { id: uid, ...newAdmin };
    } catch {
      adminDoc = { id: uid, ...newAdmin };
    }
  }

  if (!adminDoc || adminDoc.active === false) {
    if (!isEnvAdmin && !hasAdminClaim) {
      const err = new Error('Access denied: You do not have FlowBiz platform administrator privileges.');
      err.status = 403;
      throw err;
    }
  }

  const role = adminDoc?.role || (hasAdminClaim ? 'SUPER_ADMIN' : isEnvAdmin ? 'SUPER_ADMIN' : 'SUPPORT');

  return {
    uid,
    email,
    name: adminDoc?.name || caller.claims?.name || email.split('@')[0] || 'Administrator',
    role,
    isSuperAdmin: role === 'SUPER_ADMIN',
    adminDoc,
    claims: caller.claims,
  };
}

export async function logAdminAction(env, admin, action, { targetBusinessId = null, targetResource = null, details = {}, ip = null, userAgent = null } = {}) {
  try {
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
  } catch (err) {
    console.error('[AdminAuditLog] Failed to record audit entry:', err);
  }
}