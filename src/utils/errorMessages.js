// Central place to turn raw Firebase/network error codes into copy a
// shop owner or cashier can actually act on. Never shows a raw
// "FirebaseError: ..." string or an internal code to the user — the
// original error is still logged to the console for debugging.
const MESSAGES = {
  'permission-denied': "You're not allowed to do that. If you think this is a mistake, check with your business owner.",
  'unauthenticated': 'Your session has expired. Please sign in again.',
  'unavailable': "Can't reach the server right now. Check your connection and try again.",
  'deadline-exceeded': 'That took too long to complete. Please try again.',
  'resource-exhausted': "We're getting too many requests right now. Please wait a moment and try again.",
  'not-found': "That record couldn't be found, it may have been deleted or moved.",
  'already-exists': 'That already exists.',
  'cancelled': 'That was cancelled before it could finish.',
  'aborted': 'That could not be completed, please try again.',
  'internal': 'Something went wrong on our end. Please try again.',
  'auth/network-request-failed': 'Please check your internet connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a bit before trying again.',
  'auth/user-disabled': 'This account has been disabled. Please contact your business owner.',
  'storage/unauthorized': "You're not allowed to upload that file.",
  'storage/canceled': 'The upload was cancelled.',
  'storage/quota-exceeded': 'Storage limit reached, please contact support.',
};

export function friendlyErrorMessage(err, options = {}) {
  const { fallback = 'Something went wrong. Please try again.', overrides = {} } = options;
  const code = err?.code || '';
  if (overrides[code]) return overrides[code];
  if (MESSAGES[code]) return MESSAGES[code];

  const raw = err?.message || '';
  if (/offline|failed to fetch|networkerror/i.test(raw)) {
    return "Can't reach the server, check your internet connection and try again.";
  }
  // A raw Firestore/Firebase SDK error string — never show that verbatim.
  if (/^Firebase|Missing or insufficient permissions|\[code=/i.test(raw)) {
    console.error('[FlowBiz] Unmapped error:', err);
    return fallback;
  }
  // Anything else is almost certainly one of FlowBiz's OWN thrown
  // messages ("Enter a valid phone number.", "Amount exceeds the
  // outstanding balance...") — those are already written for people.
  return raw || fallback;
}