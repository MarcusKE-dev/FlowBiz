// src/lib/cors.js
//
// CORS handling for the FlowBiz API worker. Only origins listed in the
// ALLOWED_ORIGINS environment variable (comma-separated) are ever allowed
// to read a response — this is what stops some other website from
// silently calling FlowBiz's API using a signed-in user's browser session.

export function corsHeaders(origin, allowedOrigins) {
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function handleOptions(request, allowedOrigins) {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin, allowedOrigins) });
}
