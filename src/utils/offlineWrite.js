// Resolves within `timeoutMs` no matter what: with the real
// success/failure if the write settles in time, or with
// `{ queuedOffline: true }` if it's still pending once the timeout
// hits. The original promise keeps running in the background so the
// caller can still react if it eventually fails for real.
export function raceWithTimeout(promise, timeoutMs = 4000) {
  return new Promise((resolve) => {
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
        // else: caller already moved on optimistically — it attaches
        // its own .catch() to the original promise for this case.
      }
    );
  });
}