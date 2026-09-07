// src/utils/offlineWrite.js
//
// One helper, and the whole offline-first UX rests on what its result
// MEANS. Read the contract before changing anything here — a hundred call
// sites branch on it.
//
//   queuedOffline — the device is GENUINELY OFFLINE. This is the only
//                   thing that may produce "It will sync when you
//                   reconnect", because that sentence is a lie on a
//                   device that is online, and a lie the person can see.
//
//   pending       — the write has not settled yet. True when offline, and
//                   also true when the device is online but the server
//                   has not acknowledged within the timeout. Firestore's
//                   local persistence has the mutation either way, so the
//                   record is safe; what is NOT available is `value`.
//
//   value         — the resolved write result (e.g. a DocumentReference).
//                   PRESENT ONLY WHEN `pending` IS FALSE. Anything that
//                   needs a new document's id must guard on `value`, not
//                   on `!queuedOffline`, or it will dereference undefined
//                   on a slow connection.
//
//   error         — the write was rejected outright. Not the same as
//                   pending: a rejection is final and must be shown.
//
// WHY THE TIMEOUT EXISTS AT ALL: Firestore does not resolve a write
// promise until the server acknowledges it, so on a slow connection an
// awaited write blocks the UI indefinitely. The timeout bounds that wait;
// it is a UI-responsiveness device and was never evidence about
// connectivity. Treating it as evidence is what produced the "saved
// offline" toast on a perfectly good connection.

const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 15000;

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function raceWithTimeout(promise, timeoutMs = 4000) {
  // A non-number (or NaN) is a caller mistake and falls back to the
  // default; a real number is clamped rather than rejected, so no caller
  // can hang the UI forever or skip the wait entirely.
  const requested = Number(timeoutMs);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS)
    : 4000;

  return new Promise((resolve) => {
    // Already offline? There is no point waiting out the full timeout to
    // "discover" that — resolve as queued immediately instead of padding
    // every offline action with a fixed stall.
    if (isOffline()) {
      resolve({ queuedOffline: true, pending: true });
      promise.catch(() => {}); // still observed, just not blocking anything
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      // The wait ran out. Ask the device ONE more time rather than
      // assuming: a connection genuinely dropped during those seconds is
      // an offline queue, and a slow-but-live connection is not.
      resolve({ queuedOffline: isOffline(), pending: true });
    }, limit);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ queuedOffline: false, pending: false, value });
      },
      (err) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        resolve({ queuedOffline: false, pending: false, error: err });
      }
    );
  });
}
