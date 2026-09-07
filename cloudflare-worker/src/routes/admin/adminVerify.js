import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, logAdminAction, permissionsFor } from '../../lib/adminAuth.js';
import { patchDocument } from '../../lib/firestore.js';

export async function handleAdminVerify(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  try {
    await patchDocument(env, 'systemAdmins', admin.uid, { lastLoginAt: new Date() });
  } catch {
    // Non-fatal
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || null;
  const userAgent = request.headers.get('User-Agent') || null;
  await logAdminAction(env, admin, 'ADMIN_LOGIN', { ip, userAgent });

  return json({
    success: true,
    admin: {
      uid: admin.uid,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isSuperAdmin: admin.isSuperAdmin,
      // What the console may RENDER. It is a UI hint only — every route
      // re-derives the same answer server-side before it does anything,
      // so editing this in the browser changes nothing but the menu.
      permissions: permissionsFor(admin),
    },
  });
}