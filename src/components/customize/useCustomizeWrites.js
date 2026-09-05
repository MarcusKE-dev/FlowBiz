// src/components/customize/useCustomizeWrites.js
//
// The one write path for everything on the Customize page.
//
// This is IndustrySection's write path, extracted rather than rewritten:
// a `setDoc(..., { merge: true })` on the businessSettings document,
// raced against a timeout so that a write which has not round-tripped in
// four seconds is reported as queued rather than left spinning. That is
// what makes changing your business type work on a phone with no signal,
// exactly as changing your shop name already does.
//
// Nothing here reads. The page renders from SettingsContext, which
// already holds the single businessSettings listener the whole app
// shares, so the Customize page adds zero listeners and zero reads.

import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { raceWithTimeout } from '../../utils/offlineWrite';
import { friendlyErrorMessage } from '../../utils/errorMessages';

export function useCustomizeWrites() {
  const { businessId } = useAuth();
  const [busy, setBusy] = useState(false);

  const write = async (payload, successMessage) => {
    if (!businessId) return false;
    setBusy(true);
    const { queuedOffline, error } = await raceWithTimeout(
      setDoc(doc(db, 'businessSettings', businessId), payload, { merge: true }),
      4000
    );
    setBusy(false);
    if (error) {
      toast.error(friendlyErrorMessage(error));
      return false;
    }
    toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : successMessage);
    return true;
  };

  return { write, busy };
}
