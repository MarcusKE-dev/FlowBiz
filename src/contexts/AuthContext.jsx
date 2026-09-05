import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, sendEmailVerification, reload,
  deleteUser, EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import {
  doc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { isDemoMode } from '../demo/demoMode';
import { raceWithTimeout } from '../utils/offlineWrite';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';
const AuthContext = createContext(null);

function getDeviceId() {
  let id = localStorage.getItem('flowbiz_device_id');
  if (!id) {
    id = `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('flowbiz_device_id', id);
  }
  return id;
}
function getSessionDocId(uid) {
  return `${getDeviceId()}__${uid}`;
}

function guessDeviceLabel() {
  const ua = navigator.userAgent || '';
  let os = 'Unknown device';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = '';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
  if (isStandalone) return browser ? `${os} app (${browser})` : `${os} app`;
  return browser ? `${browser} on ${os}` : os;
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState({ plan: 'free', status: 'active' });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [accountRemoved, setAccountRemoved] = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);
  // Why this device was signed out, when the Worker recorded a reason —
  // 'workspace_suspended' for a platform suspension, null for an owner
  // revoking a device from Settings. It only ever changes what the block
  // screen SAYS; the block itself is the revoked flag.
  const [sessionRevokedReason, setSessionRevokedReason] = useState(null);
  // The session document this device is actually using. It is normally
  // `${deviceId}__${uid}`, but a device whose previous session was
  // revoked gets a fresh one — see registerSession — and the heartbeat
  // has to follow it rather than keep writing to the dead document.
  const activeSessionIdRef = useRef(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);

  const profileUnsubRef = useRef(null);
  const sessionUnsubRef = useRef(null);
  const businessUnsubRef = useRef(null);
  // Which business the subscription in `businessUnsubRef` is actually
  // watching. The users/{uid} listener below fires on EVERY change to the
  // profile document, and it used to open a fresh businesses/{id}
  // listener each time while only overwriting the unsubscribe handle —
  // so every profile edit orphaned a live Firestore listener that ran,
  // and billed, until the tab closed. Recording the id lets the callback
  // subscribe once and do nothing on the fires that follow.
  const businessSubscribedToRef = useRef(null);
  const sessionRegisteredRef = useRef(null);

  const stopListeners = useCallback(() => {
    profileUnsubRef.current?.();
    profileUnsubRef.current = null;
    sessionUnsubRef.current?.();
    sessionUnsubRef.current = null;
    businessUnsubRef.current?.();
    businessUnsubRef.current = null;
    businessSubscribedToRef.current = null;
    sessionRegisteredRef.current = null;
    activeSessionIdRef.current = null;
  }, []);

  const registerSession = useCallback(async (uid, businessId, userName) => {
    if (!uid || !businessId) return;
    const key = `${uid}:${businessId}`;
    if (sessionRegisteredRef.current === key) return;
    sessionRegisteredRef.current = key;

    try {
      let sessionId = getSessionDocId(uid);
      let ref = doc(db, 'sessions', sessionId);
      let currentSnap = await getDoc(ref).catch(() => null);

      // A revoked session document is a dead credential and never comes
      // back to life — not when an owner un-revokes a device, and not
      // when a platform administrator reactivates a suspended workspace.
      // The way back in is a FRESH session, which is what this mints.
      if (currentSnap && currentSnap.exists() && currentSnap.data().revoked === true) {
        sessionId = `${sessionId}__${Date.now().toString(36)}`;
        ref = doc(db, 'sessions', sessionId);
        currentSnap = await getDoc(ref).catch(() => null);
      }
      activeSessionIdRef.current = sessionId;
      setActiveSessionId(sessionId);

      const baseFields = {
        uid,
        businessId,
        lastUserName: userName || auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown',
        deviceLabel: guessDeviceLabel(),
        userAgent: navigator.userAgent,
        lastActiveAt: serverTimestamp(),
      };

      if (!currentSnap || !currentSnap.exists()) {
        await setDoc(ref, { ...baseFields, createdAt: serverTimestamp(), revoked: false });
      } else {
        await updateDoc(ref, baseFields).catch(() => {});
      }

      sessionUnsubRef.current?.();
      sessionUnsubRef.current = onSnapshot(ref, (sessionSnap) => {
        if (sessionSnap.exists() && sessionSnap.data().revoked === true) {
          setSessionRevokedReason(sessionSnap.data().revokedReason || null);
          setSessionRevoked(true);
          fbSignOut(auth);
        }
      });
    } catch (err) {
      console.warn('[FlowBiz] registerSession non-fatal warning:', err.message);
    }
  }, []);

  useEffect(() => {
    if (!firebaseUser || !profile?.businessId || sessionRevoked) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const sessionId = activeSessionIdRef.current || getSessionDocId(firebaseUser.uid);
        updateDoc(doc(db, 'sessions', sessionId), { lastActiveAt: serverTimestamp() }).catch(() => {});
      }
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [firebaseUser, profile?.businessId, sessionRevoked]);

  const loadProfile = useCallback(function doLoad(user, retryCount = 0) {
    stopListeners();
    setAuthError(null);
    setAccountRemoved(false);
    setSessionRevoked(false);
    setSessionRevokedReason(null);

    if (!user) {
      setProfile(null);
      setSubscription({ plan: 'free', status: 'active' });
      setEmailVerified(false);
      setLoading(false);
      return;
    }

    setEmailVerified(!!user.emailVerified);
    setLoading(true);

    const userRef = doc(db, 'users', user.uid);

    profileUnsubRef.current = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          (async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
              await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
              if (auth.currentUser?.uid !== user.uid) return;
              try {
                const recheck = await getDoc(userRef);
                if (recheck.exists()) return;
              } catch (err) {
                if (attempt === 2) {
                  setAuthError(`${err.code || err.name || 'unknown'}: ${err.message}`);
                  setProfile(null);
                  setLoading(false);
                  return;
                }
              }
            }
            setAccountRemoved(true);
            setProfile(null);
            setLoading(false);
          })();
          return;
        }

        setAccountRemoved(false);
        const data = { uid: user.uid, ...snap.data() };
        setProfile(data);
        setLoading(false);

        if (data.businessId && data.active !== false) {
          registerSession(user.uid, data.businessId, data.displayName).catch(console.error);
          // One listener per business, not one per profile update.
          if (businessSubscribedToRef.current !== data.businessId) {
            businessUnsubRef.current?.();
            businessSubscribedToRef.current = data.businessId;
            businessUnsubRef.current = onSnapshot(doc(db, 'businesses', data.businessId), (bizSnap) => {
              if (bizSnap.exists()) {
                setSubscription(bizSnap.data().subscription || { plan: 'free', status: 'active' });
              }
            });
          }
        }
      },
      (err) => {
        if (err.code === 'permission-denied' && retryCount < 5) {
          const delay = Math.min(1000 * 2 ** retryCount, 6000);
          setTimeout(() => {
            if (auth.currentUser?.uid === user.uid) doLoad(user, retryCount + 1);
          }, delay);
          return;
        }
        console.error(`[FlowBiz] onSnapshot(users/${user.uid}) error:`, err.code || err.name, err.message);
        setAuthError(`${err.code || err.name || 'unknown'}: ${err.message}`);
        setProfile(null);
        setLoading(false);
      }
    );
  }, [registerSession, stopListeners]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      loadProfile(user);
    });
    return () => { unsub(); stopListeners(); };
  }, [loadProfile, stopListeners]);

  // SIGNING IN, AND SAYING SO.
  //
  // Sign-in itself is unchanged: Firebase Authentication, client-side,
  // exactly as before. What is added is one best-effort report to the
  // Worker afterwards, which is what puts the attempt into the platform
  // security log (see cloudflare-worker/src/lib/loginEvents.js).
  //
  // A SUCCESS carries the fresh ID token, so the Worker verifies it and
  // records a PROVEN event — the uid and email come from the verified
  // claims, never from anything this function sends. A FAILURE has no
  // token to send, so it is recorded as a report; its IP and device are
  // observed by the Worker from the request itself.
  //
  // It never blocks and never throws: a person signing in must not be
  // held up, or turned away, because a log could not be written.
  const reportLoginEvent = async (payload, idToken) => {
    // Demo mode signs in against a local stub, not Firebase. Reporting
    // those attempts would fill the platform's security log with events
    // that never happened.
    if (isDemoMode()) return;
    try {
      await fetch(`${FLOWBIZ_API_URL}/api/auth/login-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      // Telemetry must never break authentication.
    }
  };

  const login = async (email, password) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken().catch(() => null);
      if (idToken) reportLoginEvent({ outcome: 'success' }, idToken);
      return credential;
    } catch (err) {
      reportLoginEvent({ outcome: 'failure', email: String(email || '').slice(0, 254), code: err?.code || null });
      throw err;
    }
  };
  const logout = () => { stopListeners(); return fbSignOut(auth); };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        let message = 'Could not send the verification email.';
        try { const body = await response.json(); message = body?.error || message; } catch { /* a non-JSON error body just means the default message stands */ }
        throw new Error(message);
      }
    } catch (workerErr) {
      console.warn('[FlowBiz] Worker email send failed, falling back to direct Firebase Auth send:', workerErr.message);
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshEmailVerification = useCallback(async () => {
    if (!auth.currentUser) return false;
    try {
      await reload(auth.currentUser);
    } catch (err) {
      console.error('[FlowBiz] refreshEmailVerification reload error:', err.code || err.name, err.message);
      return auth.currentUser?.emailVerified ?? false;
    }
    const verified = !!auth.currentUser.emailVerified;
    setEmailVerified(verified);
    return verified;
  }, []);

  const createStaffInvite = async ({ displayName, role = 'cashier' }) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can invite staff.');
    if (!['owner', 'cashier'].includes(role)) throw new Error('Invalid role.');
    const trimmed = (displayName || '').trim();
    if (!trimmed) throw new Error('Enter a name.');
    const write = addDoc(collection(db, 'staffInvites'), {
      businessId: profile.businessId,
      displayName: trimmed,
      role,
      createdBy: profile.uid,
      createdByName: profile.displayName,
      createdAt: serverTimestamp(),
      claimed: false,
      linkedUid: null,
    });
    const { queuedOffline, value, error } = await raceWithTimeout(write, 4000);
    if (error) throw error;
    if (queuedOffline) return { id: null, queuedOffline: true };
    return { id: value.id };
  };

  const cancelStaffInvite = async (inviteId) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can cancel an invite.');
    await deleteDoc(doc(db, 'staffInvites', inviteId));
  };

  const revokeSessionsForStaffMember = useCallback(async (uid) => {
    if (!profile?.businessId) return;
    const snap = await getDocs(query(collection(db, 'sessions'), where('uid', '==', uid), where('businessId', '==', profile.businessId)));
    await Promise.all(
      snap.docs.filter((d) => d.data().revoked !== true).map((d) => updateDoc(doc(db, 'sessions', d.id), { revoked: true }))
    );
  }, [profile]);

  // ACCOUNT DELETION IS NOT AN OFFLINE OPERATION, and it is the one place
  // in FlowBiz where saying so out loud matters. Every other write in the
  // app queues safely in Firestore's mutation log and applies on
  // reconnect. These two do not: they begin with local Firestore writes
  // that WILL queue happily — session revocations, and for a lone owner a
  // full `resetBusinessData()` — and then depend on a Worker call that
  // cannot queue at all. Offline, the destructive half lands and the
  // account survives: a business wiped of its data, still signed in.
  //
  // `navigator.onLine === false` is the only reliable half of that
  // signal, so it is the only half relied on here. A flaky-but-connected
  // network still fails at the fetch below, which is caught and reported.
  const requireConnectivity = (action) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error(`${action} needs an internet connection. Reconnect and try again.`);
    }
  };

  const removeStaffAccount = async (uid) => {
    requireConnectivity('Removing a staff account');
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can remove staff accounts.');
    if (uid === profile.uid) throw new Error("You can't remove your own account here.");
    if (!auth.currentUser) throw new Error('Your session has expired. Please sign in again.');

    const idToken = await auth.currentUser.getIdToken(true);
    await revokeSessionsForStaffMember(uid);

    let response;
    try {
      response = await fetch(`${FLOWBIZ_API_URL}/api/auth/delete-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ targetUid: uid }),
      });
    } catch {
      throw new Error(`Failed to reach the API server. Check your connection.`);
    }

    let result = null;
    try { result = await response.json(); } catch { /* a non-JSON body leaves `result` null, which the checks below handle */ }
    if (!response.ok) throw new Error(result?.error || result?.message || `Failed to delete the staff account (${response.status}).`);

    const { queuedOffline, error: deleteError } = await raceWithTimeout(deleteDoc(doc(db, 'users', uid)), 4000);
    if (deleteError) {
      throw new Error(`Staff sign-in was removed, but their profile record couldn't be deleted (${deleteError.message}). It should clear automatically once back online.`);
    }
    if (queuedOffline) {
      throw new Error('Staff sign-in was removed. You are offline, so their profile record finishes deleting when you reconnect.');
    }
  };

  const toggleMemberActive = async (uid, active) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can do this.');
    // `deactivatedByWorkspace` means one thing only: a platform
    // suspension switched this account off, and lifting the suspension
    // must switch it back on. An owner acting on a staff member is not
    // that, either way, so the stamp is cleared on both paths — otherwise
    // a future reactivation could resurrect somebody the owner had
    // deliberately disabled.
    await updateDoc(doc(db, 'users', uid), {
      active,
      deactivatedByWorkspace: false,
      deactivationReason: active ? null : 'owner_deactivated',
    });
    if (active === false) await revokeSessionsForStaffMember(uid);
  };

  const deleteOwnAccount = async ({ password }) => {
    requireConnectivity('Deleting your account');
    if (!profile || !auth.currentUser) throw new Error('You need to be signed in to do this.');

    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error('That password is incorrect.', { cause: err });
      }
      throw new Error('Could not verify your password. Please try again.', { cause: err });
    }

    let mode = 'self-only';

    if (profile.role === 'owner') {
      const othersSnap = await getDocs(query(
        collection(db, 'users'),
        where('businessId', '==', profile.businessId),
        where('role', '==', 'owner')
      ));
      const otherOwners = othersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== profile.uid && u.active !== false);

      if (otherOwners.length > 0) {
        const bizSnap = await getDoc(doc(db, 'businesses', profile.businessId));
        const business = bizSnap.exists() ? bizSnap.data() : null;
        if (business && business.createdBy === profile.uid) {
          const oldest = [...otherOwners].sort((a, b) => {
            const at = a.createdAt?.toMillis?.() ?? 0;
            const bt = b.createdAt?.toMillis?.() ?? 0;
            return at - bt;
          })[0];
          await updateDoc(doc(db, 'businesses', profile.businessId), { createdBy: oldest.id });
        }
      } else {
        mode = 'full-wipe';
        const { resetBusinessData } = await import('../utils/businessReset');
        await resetBusinessData(profile.businessId, profile.uid);
      }
    }

    const idToken = await auth.currentUser.getIdToken(true);
    const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/delete-own-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ mode }),
    });
    let result = null;
    try { result = await response.json(); } catch { /* a non-JSON body leaves `result` null, which the checks below handle */ }
    if (!response.ok) {
      throw new Error(result?.error || `Could not finish removing your account (${response.status}).`);
    }

    try {
      await deleteUser(auth.currentUser);
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        throw new Error("Your business data was handled, but your sign-in could not be removed. Sign out and back in, then try 'Delete my account' again.", { cause: err });
      }
      throw new Error("Your business data was handled, but removing your sign-in failed. Please try again.", { cause: err });
    }
  };

  const revokeSession = async (sessionId) => {
    await updateDoc(doc(db, 'sessions', sessionId), { revoked: true });
  };

  const listMySessions = async () => {
    if (!profile) return [];
    const snap = await getDocs(query(collection(db, 'sessions'), where('uid', '==', profile.uid)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const listBusinessSessions = async () => {
    if (!profile?.businessId) return [];
    const snap = await getDocs(query(collection(db, 'sessions'), where('businessId', '==', profile.businessId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const isOwner = profile?.role === 'owner';

  const expiresMs = subscription?.expiresAt?.toMillis
    ? subscription.expiresAt.toMillis()
    : (subscription?.expiresAt ? new Date(subscription.expiresAt).getTime() : 0);

  const isProSubscriber = subscription?.plan === 'pro' &&
                subscription?.status === 'active' &&
                (!subscription.expiresAt || expiresMs > Date.now());

  const isLifetime = subscription?.plan === 'lifetime' && subscription?.status === 'active';

  // A perpetual license unlocks every Pro capability, so `isPro` stays the
  // single flag the rest of the app already gates features on — it just
  // now also covers lifetime businesses. Use `isLifetime` where the UI
  // specifically needs to tell the two apart (billing copy, admin views).
  const isPro = isProSubscriber || isLifetime;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser, profile, subscription, isPro, isLifetime, loading, authError, accountRemoved,
        sessionRevoked, sessionRevokedReason,
        businessId: profile?.businessId ?? null, role: profile?.role ?? null, isAdmin: isOwner, isOwner,
        isActive: profile?.active !== false,
        // Why this account is switched off, when something recorded a
        // reason. 'workspace_suspended' means a platform administrator
        // suspended the whole workspace — a reversible state — rather
        // than an owner deactivating one person.
        deactivationReason: profile?.deactivationReason || null,
        emailVerified,
        login, logout, resendVerificationEmail, refreshEmailVerification, createStaffInvite, cancelStaffInvite, removeStaffAccount,
        toggleMemberActive, revokeSession, listMySessions, listBusinessSessions, deleteOwnAccount,
        currentSessionId: activeSessionId || (firebaseUser ? getSessionDocId(firebaseUser.uid) : getDeviceId()),
        reloadProfile: async () => loadProfile(auth.currentUser),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}