// src/demo/localAuth.js
//
// Firebase Authentication, replaced by a stub, for the demo build only
// (aliased over `firebase/auth` in vite.config.js).
//
// IT USED TO BE STATELESS, AND THAT WAS THE BUG. `onAuthStateChanged`
// delivered the demo user once and never spoke again, and `signOut()`
// resolved without changing anything. So the Sign out button in the
// header ran, resolved, and did NOTHING — no callback fired, so
// AuthContext never cleared `firebaseUser`, so ProtectedRoute never
// moved, so the screen sat exactly where it was. A button that does
// nothing is worse than a button that is missing.
//
// It is a small state machine now, and the shape is Firebase's own:
// one current user, a set of subscribers, and every transition
// announced to all of them.
//
// SIGNED OUT IS REMEMBERED, and shared across windows. A demo runs on
// several screens at once, and a visitor who signs out on one and finds
// themselves still signed in on the next has been told the button does
// not work. Same two transports as the demo Firestore next door, for
// the same reason: BroadcastChannel where it exists, the `storage`
// event everywhere else.
//
// SIGNING BACK IN TAKES ANY CREDENTIALS, which is the whole point of a
// demo — there is no account behind it to get wrong. The sign-in screen
// says so and fills the boxes in, so signing out is a door and not a
// trapdoor.

const SIGNED_OUT_KEY = 'flowbiz_demo_signed_out';
const CHANNEL_NAME = 'flowbiz_demo_auth';

export const DEMO_UID = 'demo-admin';
export const DEMO_EMAIL = 'demo@flowbiz.app';
export const DEMO_PASSWORD = 'demo1234';

const DEMO_USER = {
  uid: DEMO_UID,
  email: DEMO_EMAIL,
  displayName: 'Demo Owner',
  emailVerified: true,
  // AuthContext.login() asks the credential for an ID token the moment
  // sign-in returns. Without this the demo threw a TypeError there —
  // caught by login()'s own catch and re-thrown — so signing in on the
  // demo reported "Something went wrong signing in" on a sign-in that
  // had in fact succeeded.
  getIdToken: async () => 'demo-id-token',
  getIdTokenResult: async () => ({ token: 'demo-id-token', claims: {} }),
  reload: async () => {},
  delete: async () => {},
};

function readSignedOut() {
  try { return localStorage.getItem(SIGNED_OUT_KEY) === 'true'; } catch { return false; }
}

function writeSignedOut(value) {
  try {
    if (value) localStorage.setItem(SIGNED_OUT_KEY, 'true');
    else localStorage.removeItem(SIGNED_OUT_KEY);
  } catch { /* private mode: the session is then per-tab, which is still honest */ }
}

let currentUser = readSignedOut() ? null : DEMO_USER;
const subscribers = new Set();

function emit() {
  subscribers.forEach((fn) => { try { fn(currentUser); } catch { /* one bad subscriber must not stop the rest */ } });
}

/** Apply a transition made in THIS window: remember it, tell everyone. */
function transition(user) {
  if (currentUser === user) return;
  currentUser = user;
  writeSignedOut(user === null);
  emit();
  announce(user === null ? 'signed-out' : 'signed-in');
}

/** Apply a transition another window made. Already persisted; do not re-announce. */
function adopt(user) {
  if (currentUser === user) return;
  currentUser = user;
  emit();
}

let channel = null;
try {
  channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;
} catch {
  channel = null; // the storage event still covers us
}

function announce(type) {
  try { channel?.postMessage({ type }); } catch { /* closed — storage event still fires */ }
}

if (channel) {
  channel.onmessage = (event) => {
    if (event?.data?.type === 'signed-out') adopt(null);
    else if (event?.data?.type === 'signed-in') adopt(DEMO_USER);
  };
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== SIGNED_OUT_KEY) return;
    adopt(readSignedOut() ? null : DEMO_USER);
  });
}

export function getAuth() {
  // `currentUser` is a GETTER, not a snapshot. AuthContext reads
  // `auth.currentUser` long after this object was made — to check the
  // session is still the one it started loading, and to send a
  // verification mail — and a frozen copy would have gone on reporting a
  // signed-out visitor as signed in.
  return {
    __demo: true,
    get currentUser() { return currentUser; },
  };
}

export function onAuthStateChanged(_auth, callback) {
  subscribers.add(callback);
  // Firebase delivers the first state asynchronously, and AuthContext's
  // `loading` flag depends on that ordering.
  const timer = setTimeout(() => { if (subscribers.has(callback)) callback(currentUser); }, 0);
  return () => { clearTimeout(timer); subscribers.delete(callback); };
}

export async function signInWithEmailAndPassword() {
  transition(DEMO_USER);
  return { user: DEMO_USER };
}

export async function signOut() {
  transition(null);
}

export async function createUserWithEmailAndPassword() {
  throw new Error('Account creation is not available in Demo Mode.');
}

export async function sendEmailVerification() {
  return Promise.resolve();
}

export async function reload() {
  return Promise.resolve();
}

export async function deleteUser() {
  transition(null);
}

export async function applyActionCode() {
  return Promise.resolve();
}

export async function checkActionCode() {
  return Promise.resolve({});
}

export async function sendPasswordResetEmail() {
  return Promise.resolve();
}

export async function verifyPasswordResetCode() {
  return Promise.resolve(DEMO_EMAIL);
}

export async function confirmPasswordReset() {
  return Promise.resolve();
}

export const EmailAuthProvider = {
  credential: (email, password) => ({ email, password }),
};

export async function reauthenticateWithCredential() {
  return Promise.resolve();
}

export function connectAuthEmulator() {}
