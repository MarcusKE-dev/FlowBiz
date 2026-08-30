import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import toast from 'react-hot-toast';
import { registerSW } from 'virtual:pwa-register';
import { enterDemoMode, exitDemoMode } from './demo/demoMode';
import { seedDemoDataIfNeeded } from './demo/seedData';

// `import.meta.env.MODE` is 'demo' only when this bundle was built via
// `vite build --mode demo` (see package.json's "build" script, which now
// runs that as a second pass alongside the normal build — output lands at
// dist/demo/, served from the /demo/ sub-path in production). The actual
// Firebase-vs-local-storage routing is decided at BUILD time by
// vite.config.js's module aliasing — this block just does the two things
// that still need to happen at runtime once we know we're in Demo Mode:
//
//  1. Seed realistic sample data on first load (no-ops on later loads —
//     see seedDemoDataIfNeeded's own localStorage check).
//  2. Flip the flag in src/demo/demoMode.js, so the parts of the UI that
//     need to know "are we in Demo Mode?" for display purposes only (the
//     minimal Demo header, choosing which Business Reset to run in
//     Settings, hiding the PWA install prompt) read it correctly. This
//     flag has NO bearing on whether Firebase is actually used — that's
//     the build-time aliasing above — it's purely cosmetic/UI state.
//
// The `else` branch matters too: without it, a browser that previously
// visited the demo build would keep the demo flag set to true even after
// navigating to the real site, incorrectly showing demo-only UI there.
// Since /demo/ and / share one origin (and therefore one localStorage),
// each bundle must actively assert its own truth on every load rather
// than trusting whatever the other bundle left behind.
if (import.meta.env.MODE === 'demo') {
  enterDemoMode();
  seedDemoDataIfNeeded();
} else {
  exitDemoMode();
}

if (import.meta.env.MODE !== 'demo') {
  const updateSW = registerSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      }, 60 * 1000);
    },
 onNeedRefresh() {
  updateSW(true);
},
    onOfflineReady() {},
  });
}
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* The demo build is served from /demo/ (see vite.config.js's `base`
        and public/_redirects) rather than from the site root. `basename`
        tells react-router that every route in this app lives under that
        prefix, so internal navigation (Link to="/dashboard", etc.) still
        works unchanged everywhere in the codebase — it just produces
        /demo/dashboard in the address bar instead of /dashboard. The real
        build passes `undefined`, which is BrowserRouter's default and
        behaves exactly as before. */}
    <BrowserRouter basename={import.meta.env.MODE === 'demo' ? '/demo' : undefined}>
      <App />
    </BrowserRouter>
  </StrictMode>
);