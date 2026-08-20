// src/routes/sendVerificationEmail.js
//
// POST /api/auth/send-verification-email
//
// Replaces the frontend's direct sendEmailVerification() call. Requires
// the caller's own Firebase ID token — this endpoint can only ever
// trigger verification for the account that's asking, never an
// arbitrary email address (same trust model as every other authenticated
// route in this Worker, e.g. deleteStaff.js).
//
// Firebase itself never sends an email for this flow: generateActionLink
// asks Identity Toolkit for the raw oobLink only (returnOobLink: true),
// and FlowBiz delivers it via Resend below.

import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { generateActionLink } from '../lib/identityToolkit.js';
import { sendEmail } from '../lib/resend.js';
import { verificationEmail } from '../lib/emailTemplates.js';

export async function handleSendVerificationEmail(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return errorResponse('Missing Authorization header.', 401);

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return errorResponse(`Invalid session: ${err.message}`, 401);
  }

  if (!caller.email) return errorResponse('No email address on this account.', 400);

  const continueUrl = `${env.APP_BASE_URL}/auth/action`;

  let link;
  try {
    const result = await generateActionLink(env, {
      requestType: 'VERIFY_EMAIL',
      idToken,
      continueUrl,
    });
    link = result.oobLink;
  } catch (err) {
    console.error('[send-verification-email] generateActionLink failed:', err.identityToolkitCode || err.message);
    return errorResponse('Could not generate a verification link. Please try again.', 502);
  }

  try {
    const { subject, html, text } = verificationEmail(link);
    await sendEmail(env, { to: caller.email, subject, html, text });
  } catch (err) {
    console.error('[send-verification-email] Resend send failed:', err.message);
    return errorResponse('Could not send the verification email. Please try again.', 502);
  }

  return json({ success: true });
}