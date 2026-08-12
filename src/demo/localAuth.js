export const DEMO_UID = 'demo-admin';

const DEMO_USER = {
  uid: DEMO_UID,
  email: 'demo@flowbiz.app',
  displayName: 'Demo Owner',
  emailVerified: true,
};

export function getAuth() {
  return { __demo: true, currentUser: DEMO_USER };
}

export function onAuthStateChanged(_auth, callback) {
  const timer = setTimeout(() => callback(DEMO_USER), 0);
  return () => clearTimeout(timer);
}

export async function signInWithEmailAndPassword() {
  return { user: DEMO_USER };
}
export const DEMO_UID = 'demo-admin';

const DEMO_USER = {
  uid: DEMO_UID,
  email: 'demo@flowbiz.app',
  displayName: 'Demo Owner',
  emailVerified: true,
};

export function getAuth() {
  return { __demo: true, currentUser: DEMO_USER };
}

export function onAuthStateChanged(_auth, callback) {
  const timer = setTimeout(() => callback(DEMO_USER), 0);
  return () => clearTimeout(timer);
}

export async function signInWithEmailAndPassword() {
  return { user: DEMO_USER };
}

export async function signOut() {
  return Promise.resolve();
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
  return Promise.resolve();
}

export async function applyActionCode() {
  return Promise.resolve();
}

export async function checkActionCode() {
  return Promise.resolve({});
}

// FIX: ForgotPassword.jsx and AuthAction.jsx's reset-password panel now
// import these. Unreachable in normal Demo Mode use — stubbed only so
// the aliased 'firebase/auth' import never breaks the build.
export async function sendPasswordResetEmail() {
  return Promise.resolve();
}

export async function verifyPasswordResetCode() {
  return Promise.resolve(DEMO_USER.email);
}

export async function confirmPasswordReset() {
  return Promise.resolve();
}export async function signOut() {
  return Promise.resolve();
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
  return Promise.resolve();
}

// FIX: AuthAction.jsx imports these for the /auth/action landing page.
// That route is unreachable in normal Demo Mode use (Demo Mode never
// sends a real verification email), but stubbed so the import never
// breaks a build.
export async function applyActionCode() {
  return Promise.resolve();
}

export async function checkActionCode() {
  return Promise.resolve({});
}