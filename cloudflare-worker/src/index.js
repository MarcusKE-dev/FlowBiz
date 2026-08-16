// src/index.js — the Worker's entry point / router.
//
// Deliberately a plain switch on pathname + method, no router library:
// a dependency here is a dependency every one of FlowBiz's privileged
// operations (and now the public document route) trusts.
//
// FIX: removed the /api/whatsapp/send route (routes/whatsappSend.js).
// Auditing it found it called the real Meta WhatsApp Cloud API — nothing
// in the frontend has ever called this endpoint (WhatsApp sharing has
// always gone through the client-side wa.me deep-link utility instead),
// so it was dead code, and its Cloud-API approach directly contradicts
// FlowBiz's "deep links only, no WhatsApp API" product requirement. See
// routes/whatsappSend.js.removed for the file that was deleted, and the
// project notes for the WHATSAPP_ACCESS_TOKEN secret this leaves unused.

import { corsHeaders, handleOptions } from './lib/cors.js';
import { errorResponse } from './lib/response.js';
import { handleDeleteStaff } from './routes/deleteStaff.js';
import { handlePaystackInitialize } from './routes/paystackInitialize.js';
import { handlePaystackWebhook } from './routes/paystackWebhook.js';
import { handlePublicDocument } from './routes/publicDocument.js';
import { handleProPrice } from './routes/proPrice.js';

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Paystack calls the webhook directly (server-to-server) — it never
    // needs, and should never get, FlowBiz's browser CORS headers.
    if (url.pathname === '/api/paystack/webhook' && request.method === 'POST') {
      try {
        return await handlePaystackWebhook(request, env);
      } catch (err) {
        console.error('Webhook error:', err);
        return errorResponse('Internal server error.', 500);
      }
    }

    // Public receipt/invoice/debt-payment-receipt links (/r/<token>) are
    // opened directly by a customer's browser — a full-page navigation,
    // not a fetch() from the FlowBiz frontend — so it deliberately does
    // NOT go through verifyFirebaseIdToken like every other route below.
    // See routes/publicDocument.js for the token → document security
    // model. Handled up front, same as the webhook, since it returns
    // HTML rather than the JSON shape the block below assumes.
    if (url.pathname.startsWith('/r/') && request.method === 'GET') {
      const token = url.pathname.slice('/r/'.length);
      try {
        return await handlePublicDocument(request, env, token);
      } catch (err) {
        console.error('Public document error:', err);
        return errorResponse('Internal server error.', 500);
      }
    }

    const allowedOrigins = getAllowedOrigins(env);
    if (request.method === 'OPTIONS') return handleOptions(request, allowedOrigins);

    const origin = request.headers.get('Origin') || '';
    const extraHeaders = corsHeaders(origin, allowedOrigins);

    let response;
    try {
      if (url.pathname === '/api/auth/delete-staff' && request.method === 'POST') {
        response = await handleDeleteStaff(request, env);
        } else if (url.pathname === '/api/pro/price' && request.method === 'GET') {
       response = await handleProPrice();
      } else if (url.pathname === '/api/paystack/initialize' && request.method === 'POST') {
        response = await handlePaystackInitialize(request, env);
      } else {
        response = errorResponse('Not found.', 404);
      }
    } catch (err) {
      console.error('Unhandled error:', err);
      response = errorResponse('Internal server error.', 500);
    }

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  },
};
