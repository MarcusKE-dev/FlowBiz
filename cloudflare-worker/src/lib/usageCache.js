// cloudflare-worker/src/lib/usageCache.js
//
// A tiny per-isolate TTL memo for the expensive platform-wide rollups.
//
// The cloud-usage page fans out into dozens of aggregation queries. Two
// admins refreshing it, or one admin double-clicking, should not repeat
// that work. Cloudflare keeps an isolate warm across requests, so an
// in-memory memo absorbs most of the repeat traffic for free — with no
// KV, no Durable Object, and no new storage bill.
//
// It is a CACHE, not a store: an empty one is always correct, just
// slower. Every value carries the timestamp it was computed at so the UI
// can say "as of 14:32" rather than implying live data.

const entries = new Map();

export async function cached(key, ttlMs, compute) {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && now - hit.at < ttlMs) {
    return { value: hit.value, computedAt: hit.at, fromCache: true };
  }

  const value = await compute();

  if (entries.size > 100) {
    for (const [k, v] of entries) if (now - v.at > ttlMs) entries.delete(k);
  }
  entries.set(key, { value, at: now });
  return { value, computedAt: now, fromCache: false };
}

export function invalidate(prefix) {
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}
