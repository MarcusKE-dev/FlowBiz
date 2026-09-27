import { useEffect, useState, useCallback } from 'react';
import { doc, setDoc, updateDoc, deleteField, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useBusinessToday } from './useRegion';
import { raceWithTimeout } from '../utils/offlineWrite';

export function useDailySession() {
  const { businessId } = useAuth();
  const [session, setSession] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  // ONE business day, used for BOTH the session id and the range its
  // figures are added up over. The id used to be recomputed from the
  // clock on every render while a page fixed its report range once at
  // mount, so a close-day screen left open across midnight paired
  // tomorrow's session with yesterday's takings.
  const today = useBusinessToday();
  const dayKey = today.key;
  const sessionId = businessId ? `${businessId}_${dayKey}` : null;

  useEffect(() => {
    if (!sessionId) { setSession(null); setLoading(false); return; }
    const ref = doc(db, 'dailySessions', sessionId);
    const unsub = onSnapshot(ref,
      snap => { setSession(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, [sessionId]);

  const isClosed = !!(session?.closedAt);

  const openSession = useCallback(async ({ openingCashFloat, openingMpesaFloat, openedBy }) => {
    if (!sessionId || !businessId) return;
    const ref = doc(db, 'dailySessions', sessionId);
    const data = {
      businessId,
      date: dayKey,
      openingCashFloat:  Number(openingCashFloat)  || 0,
      openingMpesaFloat: Number(openingMpesaFloat) || 0,
      openedBy, openedAt: new Date(),
      closedAt: null, closedBy: null,
    };
    // Bounded like every other write: an awaited setDoc does not resolve
    // offline, which left a shop with no signal unable to open its till.
    // The local cache has the document either way, so the screen moves on.
    const { error } = await raceWithTimeout(setDoc(ref, data, { merge: true }), 4000, { label: 'Opening the counter' });
    if (error) throw error;
    setSession((prev) => prev || { id: sessionId, ...data });
    // FIX: don't rely solely on onSnapshot to reflect a write we just
    // made ourselves. If the realtime listener's connection is briefly
    // disrupted (ad blockers / some proxies interfere with Firestore's
    // long-polling channel — see firebase.js), the "Open counter" screen
    // could stay up even though the session doc already exists in
    // Firestore. Read it back directly and update the screen now; the
    // listener will simply confirm the same data whenever it catches up.
    try {
      const fresh = await getDoc(ref);
      if (fresh.exists()) setSession({ id: fresh.id, ...fresh.data() });
    } catch {
      // Non-fatal — the listener will still update the UI once it
      // reconnects.
    }
  }, [sessionId, businessId, dayKey]);

  const reopenSession = useCallback(async () => {
    if (!isClosed || !sessionId) return;
    const ref = doc(db, 'dailySessions', sessionId);
    const { error } = await raceWithTimeout(updateDoc(ref, {
      closedAt: deleteField(), closedBy: deleteField(),
    }), 4000, { label: 'Reopening the day' });
    if (error) throw error;
    try {
      const fresh = await getDoc(ref);
      if (fresh.exists()) setSession({ id: fresh.id, ...fresh.data() });
    } catch {
      // Non-fatal — see note above.
    }
  }, [isClosed, sessionId]);

  return {
    session, loading, sessionId, isClosed, openSession, reopenSession,
    dayKey, dayStart: today.start, dayEnd: today.end,
  };
}