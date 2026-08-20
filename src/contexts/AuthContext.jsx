import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendEmailVerification,
  reload,
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

// src/contexts/AuthContext.jsx — replace guessDeviceLabel()
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
  const [emailVerified, setEmailVerified] = useState(false);

  const profileUnsubRef = useRef(null);
  const sessionUnsubRef = useRef(null);
  const businessUnsubRef = useRef(null);
  const sessionRegisteredRef = useRef(null); // `${uid}:${businessId}` already registered this auth session

  const stopListeners = useCallback(() => {
    profileUnsubRef.current?.();
    profileUnsubRef.current = null;
    sessionUnsubRef.current?.();
    sessionUnsubRef.current = null;
    businessUnsubRef.current?.();
    businessUnsubRef.current = null;
    sessionRegisteredRef.current = null;
  }, []);

  const registerSession = useCallback(async (uid, businessId, userName) => {
   // FIX (#16-19/22): loadProfile's onSnapshot re-fires this on every
   // profile change, not just at sign-in. Without a guard, each call
   // attached a brand-new listener on sessions/{id} without ever
   // unsubscribing the last one — a real leak, and wasted re-writes.
   const key = `${uid}:${businessId}`;
   if (sessionRegisteredRef.current === key) return;
   sessionRegisteredRef.current = key;
    const sessionId = getSessionDocId(uid);
    const ref = doc(db, 'sessions', sessionId);
    const currentSnap = await getDoc(ref);

    if (!currentSnap.exists()) {
      await setDoc(ref, {
        uid,
        businessId,
        lastUserName: userName || auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown',
        deviceLabel: guessDeviceLabel(),
        userAgent: navigator.userAgent,
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        revoked: false,
      });
    } else {
      await updateDoc(ref, {
        uid,
        businessId,
        lastUserName: userName || auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown',
        lastActiveAt: serverTimestamp(),
        deviceLabel: guessDeviceLabel(),
        userAgent: navigator.userAgent,
        revoked: false, 
      }).catch(() => {});
    }
    sessionUnsubRef.current?.(); // defensive: clear any stale listener first
    sessionUnsubRef.current = onSnapshot(ref, (sessionSnap) => {
      if (sessionSnap.exists() && sessionSnap.data().revoked === true) {
        setSessionRevoked(true);
        fbSignOut(auth);
      }
    });
  }, []);

  // Background heartbeat to keep the "last seen" time accurate for active devices
useEffect(() => {
    if (!firebaseUser || !profile?.businessId || sessionRevoked) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const ref = doc(db, 'sessions', getSessionDocId(firebaseUser.uid));
        updateDoc(ref, { lastActiveAt: serverTimestamp() }).catch(() => {});
      }
    }, 15 * 60 * 1000); // 15 mins
    return () => clearInterval(interval);
  }, [firebaseUser, profile?.businessId, sessionRevoked]);

  // FIX: Used a named function 'doLoad' to resolve the recursive ESLint error
const loadProfile = useCallback(function doLoad(user, retryCount = 0) {
  stopListeners();
  setAuthError(null);
  setAccountRemoved(false);
  setSessionRevoked(false);

  if (!user) {
    setProfile(null);
    setSubscription({ plan: 'free', status: 'active' });
    setEmailVerified(false);
    setLoading(false);
    return;
  }

  setEmailVerified(!!user.emailVerified);
  setLoading(true);

  // FIX: force-refresh the ID token before attaching the Firestore
  // listener. Right after sign-in / verification / password reset, the
  // Firestore SDK's connection can still be using a stale token for a
  // moment — this closes that gap instead of just hoping it resolves.
  user.getIdToken(true).catch(() => {}).then(() => {
    const userRef = doc(db, 'users', user.uid);

    profileUnsubRef.current = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          setTimeout(async () => {
            try {
              const recheck = await getDoc(userRef);
              if (!recheck.exists()) {
                setAccountRemoved(true);
                setProfile(null);
                setLoading(false);
              }
            } catch (err) {
              setAuthError(`${err.code || err.name || 'unknown'}: ${err.message}`);
              setProfile(null);
              setLoading(false);
            }
          }, 4000);
          return;
        }
        setAccountRemoved(false);
        const data = { uid: user.uid, ...snap.data() };
        setProfile(data);
        setLoading(false);

        if (data.businessId) {
          registerSession(user.uid, data.businessId, data.displayName).catch(console.error);
          businessUnsubRef.current = onSnapshot(doc(db, 'businesses', data.businessId), (bizSnap) => {
            if (bizSnap.exists()) {
              setSubscription(bizSnap.data().subscription || { plan: 'free', status: 'active' });
            }
          });
        }
      },
      (err) => {
        // FIX: more retries, longer backoff — gives slower connections
        // (mobile networks) a real chance to catch up instead of
        // dumping the user on an error screen after ~4s.
        if (err.code === 'permission-denied' && retryCount < 6) {
          const delay = Math.min(1000 * 2 ** retryCount, 8000);
          console.warn(`[FlowBiz] users/${user.uid} listener got permission-denied — retrying (attempt ${retryCount + 1})`);
          setTimeout(() => {
            if (auth.currentUser?.uid === user.uid) doLoad(user, retryCount + 1);
          }, delay);
          return;
        }
        console.error(`[FlowBiz] onSnapshot(users/${user.uid}) failed:`, err.code || err.name, err.message);
        setAuthError(`${err.code || err.name || 'unknown'}: ${err.message}`);
        setProfile(null);
        setLoading(false);
      }
    );
  });
}, [registerSession, stopListeners]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      loadProfile(user);
    });
    return () => { unsub(); stopListeners(); };
  }, [loadProfile, stopListeners]);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => { stopListeners(); return fbSignOut(auth); };
  
const resendVerificationEmail = async () => {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const idToken = await auth.currentUser.getIdToken(true);
  const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/send-verification-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) {
    let message = 'Could not send the verification email.';
    try { const body = await response.json(); message = body?.error || message; } catch {}
    throw new Error(message);
  }
};

  const refreshEmailVerification = useCallback(async () => {
    if (!auth.currentUser) return false;
    try {
      await reload(auth.currentUser);
    } catch (err) {
      console.error('[FlowBiz] refreshEmailVerification: reload() failed:', err.code || err.name, err.message);
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

  const removeStaffAccount = async (uid) => {
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
    } catch (networkErr) {
      throw new Error(`Failed to reach the API server. Check your connection.`);
    }

    let result = null;
    try { result = await response.json(); } catch { }
    if (!response.ok) throw new Error(result?.error || result?.message || `Failed to delete the staff account (${response.status}).`);

    let retries = 3;
    while (retries > 0) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        break;
      } catch (e) {
        retries--;
        if (retries === 0) throw new Error("Staff Auth removed, but profile UI deletion timed out. Refresh the page.");
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };

  const toggleMemberActive = async (uid, active) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can do this.');
    await updateDoc(doc(db, 'users', uid), { active });
    if (active === false) await revokeSessionsForStaffMember(uid);
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
  
  // FIX: Explicitly convert Timestamp to milliseconds to satisfy strict linters
  const expiresMs = subscription?.expiresAt?.toMillis 
    ? subscription.expiresAt.toMillis() 
    : (subscription?.expiresAt ? new Date(subscription.expiresAt).getTime() : 0);

  const isPro = subscription?.plan === 'pro' && 
                subscription?.status === 'active' &&
                (!subscription.expiresAt || expiresMs > Date.now());

  return (
    <AuthContext.Provider
      value={{
        firebaseUser, profile, subscription, isPro, loading, authError, accountRemoved, sessionRevoked,
        businessId: profile?.businessId ?? null, role: profile?.role ?? null, isAdmin: isOwner, isOwner,
        isActive: profile?.active !== false, emailVerified,
        login, logout, resendVerificationEmail, refreshEmailVerification, createStaffInvite, cancelStaffInvite, removeStaffAccount,
toggleMemberActive, revokeSession, listMySessions, listBusinessSessions,
        currentSessionId: firebaseUser ? getSessionDocId(firebaseUser.uid) : getDeviceId(),        reloadProfile: async () => loadProfile(auth.currentUser),
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