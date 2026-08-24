import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { getDocument, deleteDocument } from '../lib/firestore.js';

export async function handleDeleteOwnProfile(request, env) {
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
  const mode = body?.mode;
  if (mode !== 'full-wipe' && mode !== 'self-only') {
    return errorResponse('mode must be "full-wipe" or "self-only".', 400);
  }

  const callerProfile = await getDocument(env, 'users', caller.uid);
  if (!callerProfile) {
    // Profile's already gone — nothing left to clean up.
    return json({ success: true });
  }

  if (mode === 'full-wipe') {
    if (!callerProfile.businessId) return errorResponse('No business associated with this account.', 400);
    await deleteDocument(env, 'businessSettings', callerProfile.businessId);
    await deleteDocument(env, 'businesses', callerProfile.businessId);
  }

  await deleteDocument(env, 'users', caller.uid);

  return json({ success: true });
}