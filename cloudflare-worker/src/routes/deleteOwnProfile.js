import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { getDocument, deleteDocument, queryCollection } from '../lib/firestore.js';

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
    // `full-wipe` deletes the whole tenant, so the trust boundary is HERE,
    // in the Worker, not in the client that chose the mode. The client
    // picks `full-wipe` only for an owner who is the last active owner of
    // the business; the same two conditions are re-proved server-side,
    // because the mode arrives in a request body that anyone holding any
    // valid ID token for this project can craft.
    if (callerProfile.role !== 'owner') {
      return errorResponse('Only an owner can delete a business.', 403);
    }
    if (callerProfile.active === false) {
      return errorResponse('Your account is deactivated.', 403);
    }
    if (!callerProfile.businessId) return errorResponse('No business associated with this account.', 400);

    // A business with another active owner must survive this deletion —
    // the departing owner leaves, the business does not.
    const owners = await queryCollection(env, 'users', {
      filters: [
        { field: 'businessId', op: 'EQUAL', value: callerProfile.businessId },
        { field: 'role', op: 'EQUAL', value: 'owner' },
      ],
      limit: 50,
    });
    const otherActiveOwners = owners.filter((u) => u.id !== caller.uid && u.active !== false);
    if (otherActiveOwners.length > 0) {
      return errorResponse('This business still has another owner, so it cannot be deleted. Your own account can be removed with mode "self-only".', 409);
    }

    await deleteDocument(env, 'businessSettings', callerProfile.businessId);
    await deleteDocument(env, 'businesses', callerProfile.businessId);
  }

  await deleteDocument(env, 'users', caller.uid);

  return json({ success: true });
}
