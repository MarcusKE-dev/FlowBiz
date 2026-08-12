// src/routes/whatsappSend.js
//
// POST /api/whatsapp/send  { documentType: 'receipt'|'invoice', saleId, phone }
//
// businessId is deliberately taken from the CALLER'S OWN Firestore
// profile, never from the request body — the frontend used to send
// `businessId: settings.businessId`, which this endpoint ignores on
// purpose (never trust the frontend for authorization-relevant data).

import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { getDocument } from '../lib/firestore.js';

function formatKES(amount) {
  const v = Number(amount) || 0;
  return `KES ${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isBusinessPro(business) {
  return (
    business?.subscription?.plan === 'pro' &&
    business?.subscription?.status === 'active' &&
    (!business.subscription?.expiresAt || new Date(business.subscription.expiresAt) > new Date())
  );
}

export async function handleWhatsAppSend(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return errorResponse('Missing Authorization header.', 401);

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return errorResponse(`Invalid session: ${err.message}`, 401);
  }

  const callerProfile = await getDocument(env, 'users', caller.uid);
  if (!callerProfile) return errorResponse('Profile not found.', 403);
  if (callerProfile.active === false) return errorResponse('Your account is deactivated.', 403);
  if (!callerProfile.businessId) return errorResponse('No business associated with this account.', 400);

  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body.', 400); }

  const { documentType, saleId, phone } = body || {};
  if (!['receipt', 'invoice'].includes(documentType)) return errorResponse('documentType must be "receipt" or "invoice".', 400);
  if (!saleId || typeof saleId !== 'string') return errorResponse('saleId is required.', 400);
  if (!phone || typeof phone !== 'string') return errorResponse('phone is required.', 400);

  const businessId = callerProfile.businessId;

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);
  if (!isBusinessPro(business)) return errorResponse('WhatsApp document sending requires FlowBiz Pro.', 403);

  const saleCollection = documentType === 'invoice' ? 'creditSales' : 'sales';
  const sale = await getDocument(env, saleCollection, saleId);
  if (!sale || sale.businessId !== businessId) return errorResponse('Sale not found for your business.', 404);

  const settings = (await getDocument(env, 'businessSettings', businessId)) || {};
  const shopName = settings.shopName || 'FlowBiz Store';
  const label = documentType === 'invoice' ? 'Invoice' : 'Receipt';
  const amountDue = documentType === 'invoice' ? (sale.remainingBalance ?? sale.totalAmount) : sale.totalAmount;

  const lines = [
    `*${shopName}*`,
    `${label} — ${sale.quantity} × ${sale.productName}`,
    `Total: ${formatKES(sale.totalAmount)}`,
  ];
  if (documentType === 'invoice') lines.push(`Amount due: ${formatKES(amountDue)}`);
  if (settings.phone) lines.push(`Contact: ${settings.phone}`);
  const messageText = lines.join('\n');

  // NOTE (real WhatsApp platform constraint, not a bug in this code):
  // WhatsApp's Cloud API only allows a free-form text message like this
  // inside a 24-hour customer-service window (the customer messaged this
  // number first), or via a pre-approved Message Template otherwise. If
  // delivery fails for that reason, WhatsApp's error surfaces to the
  // cashier via the 502 below — see the deployment README for setting up
  // a template as a follow-up.
  const waRes = await fetch(`https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone.replace(/[^\d+]/g, ''),
      type: 'text',
      text: { body: messageText },
    }),
  });

  if (!waRes.ok) return errorResponse(`WhatsApp delivery failed: ${await waRes.text()}`, 502);

  return json({ success: true });
}
