// src/routes/deleteStaff.js
//
// POST /api/auth/delete-staff  { targetUid }
//
// Fixes the staff-deletion bug: deletes the actual Firebase Authentication
// account for a removed staff member, not just their Firestore profile —
// so the same email can be re-invited afterward.

import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { getDocument } from '../lib/firestore.js';
import { deleteAuthUser } from '../lib/identityToolkit.js';

export async function handleDeleteStaff(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return errorResponse('Missing Authorization header.', 401);

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return errorResponse(`Invalid session: ${err.message}`, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }
  const targetUid = body?.targetUid;
  if (!targetUid || typeof targetUid !== 'string') return errorResponse('targetUid is required.', 400);
  if (targetUid === caller.uid) return errorResponse("You can't remove your own account.", 400);

  // Step 1 & 2 — the requester must exist, be active, and be an owner.
  const callerProfile = await getDocument(env, 'users', caller.uid);
  if (!callerProfile) return errorResponse('Caller profile not found.', 403);
  if (callerProfile.role !== 'owner') return errorResponse('Only an owner can remove staff accounts.', 403);
  if (callerProfile.active === false) return errorResponse('Your account is deactivated.', 403);

  // Step 3 — the target must belong to the SAME business. This is what
  // stops one business's owner from deleting another business's staff
  // member by guessing or leaking a uid.
  const targetProfile = await getDocument(env, 'users', targetUid);
  if (!targetProfile) {
    return errorResponse('Target staff profile not found in Firestore — nothing to reconcile.', 404);
  }
  if (targetProfile.businessId !== callerProfile.businessId) {
    return errorResponse('That account does not belong to your business.', 403);
  }

  // The account that originally created the business can only ever be
  // removed by itself (via "Delete my account" in Settings) — never by
  // another owner through this staff-removal flow.
  const business = await getDocument(env, 'businesses', callerProfile.businessId);
  if (business && business.createdBy === targetUid) {
    return errorResponse("The account that created this business can't be removed this way. That person can delete their own account from Settings.", 403);
  }

  await deleteAuthUser(env, targetUid);

  return json({ success: true });
}
