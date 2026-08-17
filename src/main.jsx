import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import toast from 'react-hot-toast';
import { registerSW } from 'virtual:pwa-register';
import { enterDemoMode, exitDemoMode } from './demo/demoMode';
import { seedDemoDataIfNeeded } from './demo/seedData';

// `import.meta.env.MODE` is 'demo' only when started via `npm run dev:demo`
// (vite --mode demo). The actual Firebase-vs-local-storage routing is
// decided at build time by vite.config.js's module aliasing — this block
// just does the two things that still need to happen at runtime once we
// know we're in Demo Mode:
//
//  1. Seed realistic sample data on first load (no-ops on later loads —
//     see seedDemoDataIfNeeded's own localStorage check).
//  2. Flip the flag in src/demo/demoMode.js, so the parts of the UI that
//     need to know "are we in Demo Mode?" for display purposes only (the
//     Demo badge in TopHeader, choosing which Business Reset to run in
//     Settings) read it correctly. This flag has NO bearing on whether
//     Firebase is actually used — that's the aliasing above — it's purely
//     cosmetic/UI state.
//
// The `else` branch matters too: without it, a browser that previously ran
// `npm run dev:demo` would keep the demo flag set to true even after
// switching back to `npm run dev`, incorrectly showing the Demo badge (and
// routing Settings' Business Reset to the wrong implementation) in
// Production Mode.
if (import.meta.env.MODE === 'demo') {
  enterDemoMode();
  seedDemoDataIfNeeded();
} else {
  exitDemoMode();
}
// Checks for a new deployed version every 60s while the tab is visible,
// and prompts a one-tap refresh the moment one's found — far faster than
// only picking it up the next time someone happens to reopen the app.
// Deliberately a prompt, not a silent forced reload: a hard refresh
// mid-sale-entry would wipe whatever a cashier is currently typing.
if (import.meta.env.MODE !== 'demo') {
  const updateSW = registerSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      }, 60 * 1000);
    },
    onNeedRefresh() {
      toast(
        (t) => (
          <span className="flex items-center gap-3">
            A new version of FlowBiz is available.
            <button
              className="btn-primary !min-h-0 !px-3 !py-1.5 text-xs"
              onClick={() => { toast.dismiss(t.id); updateSW(true); }}
            >
              Refresh
            </button>
          </span>
        ),
        { duration: Infinity }
      );
    },
    onOfflineReady() {},
  });
}
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);