import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  experimentalForceLongPolling: true, // was experimentalAutoDetectLongPolling: true
});

// TEST HARNESS ONLY. This branch is entered only when
// VITE_USE_FIREBASE_EMULATORS is the literal string 'true', which is set
// in .env.emulator and in no other environment — so production and demo
// builds do not execute a line of it.
//
// The host and port are read from the environment rather than hardcoded
// because the QA harness pins the browser to ONE origin and reaches the
// emulators same-origin through the dev server's proxy (see
// vite.config.js). With 127.0.0.1:9099 baked in, the SDK went straight to
// that port, the browser's origin lock refused it, and every sign-in in
// the harness failed with ERR_BLOCKED_BY_CLIENT.
//
// THE DEFAULTS ARE THE OLD VALUES, so anyone running a plain local
// emulator suite with nothing else configured gets exactly the previous
// behaviour.
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(
    auth,
    import.meta.env.VITE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099',
    { disableWarnings: true }
  );
  connectFirestoreEmulator(
    db,
    import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1',
    Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT) || 8080
  );
}

export default app;