// src/lib/response.js
export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message, status = 400) {
  return json({ error: message }, { status });
}

// Used only by the public document route (src/routes/publicDocument.js).
// noindex/nofollow because these pages carry a customer's financial data —
// the opaque token in the URL is the real access control, but there's no
// reason to also let a search engine crawl or cache them.
export function html(bodyHtml, init = {}) {
  return new Response(bodyHtml, {
    status: init.status || 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
    },
  });
}
