// src/hooks/useCloudDocuments.js
//
// May this business publish a new public document link right now?
//
// A shared receipt or invoice is served to the open internet by the
// Cloudflare Worker at /r/<token>, which makes PUBLISHING one a hosted
// service rather than a licensed feature. firestore.rules refuses the
// write when the annual services entitlement has lapsed or an
// administrator has suspended cloud services, so the UI needs the same
// answer BEFORE it offers the button — otherwise a cashier types a
// customer's number, taps Send, and gets a permission error.
//
// What is NOT affected, and must never be: printing and downloading a
// receipt or invoice. Both happen entirely in the browser through jsPDF
// and touch no hosted service at all, so they keep working on every plan,
// in every service state, offline included.

import { useAuth } from '../contexts/AuthContext';
import { ENTITLEMENTS } from '../licensing';

export const CLOUD_DOCUMENTS_BLOCKED_MESSAGE =
  'Sharing a link needs active cloud services. Your Lifetime Licence and your records are unaffected, '
  + 'and you can still print or download this document. Renew cloud services to share links again.';

export function useCloudDocuments() {
  const { entitlements } = useAuth();
  // Defaults to allowed: a business with no licensing record at all (free,
  // monthly Pro, anything created before this existed) is entitled, which
  // is exactly the behaviour that was there before.
  const canPublish = entitlements?.can(ENTITLEMENTS.CLOUD_DOCUMENTS) !== false;
  return { canPublish, blockedMessage: CLOUD_DOCUMENTS_BLOCKED_MESSAGE };
}
