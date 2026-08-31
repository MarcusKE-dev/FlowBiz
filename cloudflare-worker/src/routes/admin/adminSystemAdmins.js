// cloudflare-worker/src/routes/admin/adminSystemAdmins.js
import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, logAdminAction } from '../../lib/adminAuth.js';
import { listDocuments, createDocument, patchDocument } from '../../lib/firestore.js';

export async function handleAdminListAdmins(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const { documents } = await listDocuments(env, 'systemAdmins', { pageSize: 50 });
  return json({ admins: documents });
}

export async function handleAdminAddAdmin(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  if (!admin.isSuperAdmin) {
    return errorResponse('Only Super Admins can add or modify platform administrators.', 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const { uid, email, name, role = 'SUPPORT' } = body;
  if (!uid || !email) return errorResponse('uid and email are required.', 400);
  if (!['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'FINANCE'].includes(role)) {
    return errorResponse('Invalid admin role.', 400);
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

  await createDocument(env, 'systemAdmins', uid, newAdmin);
  await logAdminAction(env, admin, 'ADD_SYSTEM_ADMIN', { details: { targetUid: uid, targetEmail: email, role } });

  return json({ success: true, admin: newAdmin });
}

export async function handleAdminRemoveAdmin(request, env, targetUid) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  if (!admin.isSuperAdmin) {
    return errorResponse('Only Super Admins can deactivate platform administrators.', 403);
  }
  if (admin.uid === targetUid) {
    return errorResponse('You cannot deactivate your own administrator account.', 400);
  }

  await patchDocument(env, 'systemAdmins', targetUid, { active: false, deactivatedAt: new Date(), deactivatedBy: admin.email });
  await logAdminAction(env, admin, 'DEACTIVATE_SYSTEM_ADMIN', { details: { targetUid } });

  return json({ success: true });
}