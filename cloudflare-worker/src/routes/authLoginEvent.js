// cloudflare-worker/src/routes/authLoginEvent.js
//
// POST /api/auth/login-event
//
// The one way an authentication event enters FlowBiz's security log. The
// browser cannot write to `loginEvents` — firestore.rules refuses every
// client, signed in or not — so this endpoint is the whole surface, and
// the rules it holds to are what make the log worth reading:
//
//   A SUCCESS MUST BE PROVED. If the request carries a Bearer token, the
//   token is verified against Google's signing keys and the uid comes
//   from the VERIFIED CLAIMS. A body that says "uid: someone-else" cannot
//   change that, because the body's uid is never read.
//
//   A FAILURE IS ONLY EVER A REPORT. There is no token to verify — that
//   is what failing means — so the event is stored with verified: false
//   and the admin console labels it as reported. What is NOT a report is
//   the metadata that matters most for spotting an attack: the IP and the
//   user agent are taken from the request headers.
//
//   NOTHING SENSITIVE IS ACCEPTED. The body may carry an email and a
//   Firebase error code, and nothing else is read. A password field would
//   be ignored, not stored.
//
//   IT IS RATE LIMITED PER IP, and the limit is deliberately tight: this
//   endpoint is unauthenticated by necessity, and an unauthenticated
//   writer is a way to fill a collection unless it is bounded.

import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { recordLoginEvent } from '../lib/loginEvents.js';

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 12;
const seen = new Map(); // ip -> { count, resetAt }

function withinRate(ip) {
  const now = Date.now();
  const record = seen.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }
  record.count += 1;
  seen.set(ip, record);

  // Bounded cleanup, so a long-lived isolate cannot grow this map.
  if (seen.size > 2000) {
    for (const [key, value] of seen) if (now > value.resetAt) seen.delete(key);
  }
  return record.count <= MAX_PER_WINDOW;
}

export async function handleLoginEvent(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || null;
  const userAgent = request.headers.get('User-Agent');

  // A refused report is not an error the browser needs to act on — the
  // person is signed in either way — so it answers 202 and records
  // nothing. Telling a flooder which limit they hit helps only them.
  if (!withinRate(ip || 'unknown')) return json({ recorded: false }, 202);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const outcome = body?.outcome === 'failure' ? 'failure' : 'success';
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (outcome === 'success') {
    // A success with no verifiable token is not a success we will assert.
    if (!idToken) return errorResponse('A successful sign-in must present its ID token.', 401);
    let caller;
    try {
      caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
    } catch {
      return errorResponse('Invalid session.', 401);
    }
    await recordLoginEvent(env, {
      outcome: 'success',
      verified: true,
      uid: caller.uid,
      // From the VERIFIED claims. The body's email is not read.
      email: caller.email || '',
      ip,
      userAgent,
    });
    return json({ recorded: true, verified: true });
  }

  await recordLoginEvent(env, {
    outcome: 'failure',
    verified: false,
    email: typeof body?.email === 'string' ? body.email : '',
    reasonCode: typeof body?.code === 'string' ? body.code : null,
    ip,
    userAgent,
  });
  return json({ recorded: true, verified: false });
}
