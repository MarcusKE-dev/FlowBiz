// cloudflare-worker/src/routes/admin/adminSystemAdmins.js
import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission, logAdminAction, requestContext, ROLES } from '../../lib/adminAuth.js';
import { assertDocumentId } from '../../lib/validate.js';
import { listDocuments, createDocument, patchDocument } from '../../lib/firestore.js';

// The administrator roster is itself sensitive — it names every account
// that can reach merchant data, which is exactly the list an attacker
// would want first. ADMIN+ only.
export async function handleAdminListAdmins(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'admins.read');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const { documents } = await listDocuments(env, 'systemAdmins', { pageSize: 100 });
  return json({ admins: documents, roles: ROLES, adminRole: admin.role });
}

export async function handleAdminAddAdmin(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  try {
    requirePermission(admin, 'admins.manage');
  } catch (err) {
    return errorResponse(err.message, err.status || 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const { uid, email, name, role = 'SUPPORT' } = body;
  if (!uid || !email) return errorResponse('uid and email are required.', 400);
  try {
    assertDocumentId(uid, 'uid');
  } catch (err) {
    return errorResponse(err.message, 400);
  }
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    return errorResponse('A valid email address is required.', 400);
  }
  if (!ROLES.includes(role)) {
    return errorResponse(`Invalid admin role. One of: ${ROLES.join(', ')}.`, 400);
  }

  const newAdmin = {
    uid,
    email: email.toLowerCase().trim(),
    name: name || email.split('@')[0],
    role,
    active: true,
    addedBy: admin.email,
    createdAt: new Date(),
    lastLoginAt: null,
  };

  try {
    await createDocument(env, 'systemAdmins', uid, newAdmin);
  } catch (err) {
    if (err.message === 'DOCUMENT_ALREADY_EXISTS') {
      return errorResponse('That user is already registered as a platform administrator.', 409);
    }
    throw err;
  }

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'ADD_SYSTEM_ADMIN', {
    details: { targetUid: uid, targetEmail: newAdmin.email, role },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return json({ success: true, admin: newAdmin });
}

export async function handleAdminRemoveAdmin(request, env, targetUid) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  try {
    requirePermission(admin, 'admins.manage');
    assertDocumentId(targetUid, 'uid');
  } catch (err) {
    return errorResponse(err.message, err.status || 403);
  }
  if (admin.uid === targetUid) {
    return errorResponse('You cannot deactivate your own administrator account.', 400);
  }

  await patchDocument(env, 'systemAdmins', targetUid, { active: false, deactivatedAt: new Date(), deactivatedBy: admin.email });

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'DEACTIVATE_SYSTEM_ADMIN', {
    details: { targetUid },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return json({ success: true });
}