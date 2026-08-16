// src/utils/offlineWrite.js — full file (small, and every call site depends on this exact contract)
export function raceWithTimeout(promise, timeoutMs = 4000) {
  return new Promise((resolve) => {
    // Already offline? There's no point waiting out the full timeout to
    // "discover" that — resolve as queued immediately instead of padding
    // every offline action with a fixed ~4s stall.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      resolve({ queuedOffline: true });
      promise.catch(() => {}); // still observed, just not blocking anything
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve({ queuedOffline: true }); }
    }, timeoutMs);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ queuedOffline: false, value });
      },
      (err) => {
        clearTimeout(timer);
        if (!settled) { settled = true; resolve({ queuedOffline: false, error: err }); }
      }
    );
  });
}