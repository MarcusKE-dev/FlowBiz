import { useEffect, useState, useCallback } from 'react';
import { doc, setDoc, updateDoc, deleteField, serverTimestamp, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { todayKey } from '../utils/dateRanges';

export function useDailySession() {
  const { businessId } = useAuth();
  const [session, setSession] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  const sessionId = businessId ? `${businessId}_${todayKey()}` : null;

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
    await setDoc(ref, {
      businessId,
      date: todayKey(),
      openingCashFloat:  Number(openingCashFloat)  || 0,
      openingMpesaFloat: Number(openingMpesaFloat) || 0,
      openedBy, openedAt: serverTimestamp(),
      closedAt: null, closedBy: null,
    }, { merge: true });
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
  }, [sessionId, businessId]);

  const reopenSession = useCallback(async () => {
    if (!isClosed || !sessionId) return;
    const ref = doc(db, 'dailySessions', sessionId);
    await updateDoc(ref, {
      closedAt: deleteField(), closedBy: deleteField(),
    });
    try {
      const fresh = await getDoc(ref);
      if (fresh.exists()) setSession({ id: fresh.id, ...fresh.data() });
    } catch {
      // Non-fatal — see note above.
    }
  }, [isClosed, sessionId]);

  return { session, loading, sessionId, isClosed, openSession, reopenSession };
}