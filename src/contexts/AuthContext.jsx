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

function guessDeviceLabel() {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'Android device';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS device';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh/i.test(ua)) return 'Mac';
  return 'Unknown device';
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState({ plan: 'free', status: 'active' });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [accountRemoved, setAccountRemoved] = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);
  // FIX: tracked as its own state — Firebase Auth's user.emailVerified
  // only updates in memory after calling reload(); it does not fire a
  // fresh onAuthStateChanged event, so we can't just read it off
  // firebaseUser on every render.
  const [emailVerified, setEmailVerified] = useState(false);

  const profileUnsubRef = useRef(null);
  const sessionUnsubRef = useRef(null);
  const businessUnsubRef = useRef(null);

  const stopListeners = useCallback(() => {
    profileUnsubRef.current?.();
    profileUnsubRef.current = null;
    sessionUnsubRef.current?.();
    sessionUnsubRef.current = null;
    businessUnsubRef.current?.();
    businessUnsubRef.current = null;
  }, []);

  const registerSession = useCallback(async (uid, businessId) => {
    const sessionId = getDeviceId();
    const ref = doc(db, 'sessions', sessionId);
    const currentSnap = await getDoc(ref);

    if (!currentSnap.exists()) {
      await setDoc(ref, {
        uid,
        businessId,
        deviceLabel: guessDeviceLabel(),
        userAgent: navigator.userAgent,
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        revoked: false,
      });
    } else {
      await updateDoc(ref, {
        lastActiveAt: serverTimestamp(),
        deviceLabel: guessDeviceLabel(),
        userAgent: navigator.userAgent,
      }).catch(() => {});
    }

    sessionUnsubRef.current = onSnapshot(ref, (sessionSnap) => {
      if (sessionSnap.exists() && sessionSnap.data().revoked === true) {
        setSessionRevoked(true);
        fbSignOut(auth);
      }
    });
  }, []);

  const loadProfile = useCallback((user) => {
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

    // Seed emailVerified from the Firebase user immediately, so
    // ProtectedRoute doesn't briefly see `false` before any refresh runs.
    setEmailVerified(!!user.emailVerified);
    setLoading(true);
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
          registerSession(user.uid, data.businessId).catch(console.error);
          businessUnsubRef.current = onSnapshot(doc(db, 'businesses', data.businessId), (bizSnap) => {
            if (bizSnap.exists()) {
              setSubscription(bizSnap.data().subscription || { plan: 'free', status: 'active' });
            }
          });
        }
      },
      (err) => {
        console.error(`[FlowBiz] onSnapshot(users/${user.uid}) failed:`, err.code || err.name, err.message);
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

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => { stopListeners(); return fbSignOut(auth); };
  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    await sendEmailVerification(auth.currentUser);
  };

  // THE MISSING FUNCTION — ProtectedRoute.jsx calls this on focus, on tab
  // visibility change, on a 5s poll, and when the user clicks "I've
  // verified — check now". It never existed here before, which is why
  // you got "refreshEmailVerification is not a function". reload()
  // re-fetches this user's latest state from Firebase Auth (including
  // emailVerified) into auth.currentUser; we copy that into React state
  // and return it so callers know immediately whether it's verified.
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
    const ref = await addDoc(collection(db, 'staffInvites'), {
      businessId: profile.businessId,
      displayName: trimmed,
      role,
      createdBy: profile.uid,
      createdByName: profile.displayName,
      createdAt: serverTimestamp(),
      claimed: false,
      linkedUid: null,
    });
    return { id: ref.id };
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
      throw new Error(`Failed to reach the API server. Ensure your Cloudflare Worker is deployed and VITE_FLOWBIZ_API_URL is correctly set. [${networkErr.message}]`);
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
  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active' &&
                (!subscription.expiresAt || (subscription.expiresAt.toMillis ? subscription.expiresAt.toMillis() : subscription.expiresAt) > Date.now());

  return (
    <AuthContext.Provider
      value={{
        firebaseUser, profile, subscription, isPro, loading, authError, accountRemoved, sessionRevoked,
        businessId: profile?.businessId ?? null, role: profile?.role ?? null, isAdmin: isOwner, isOwner,
        isActive: profile?.active !== false, emailVerified,
        login, logout, resendVerificationEmail, refreshEmailVerification, createStaffInvite, cancelStaffInvite, removeStaffAccount,
        toggleMemberActive, revokeSession, listMySessions, listBusinessSessions, currentSessionId: getDeviceId(),
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