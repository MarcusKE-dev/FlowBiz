import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';
import { enterDemoMode, exitDemoMode } from './demo/demoMode';
import { seedDemoDataIfNeeded } from './demo/seedData';
import { isNativeApp } from './platform/platform';

if (import.meta.env.MODE === 'demo') {
  enterDemoMode();
  seedDemoDataIfNeeded();
} else {
  exitDemoMode();
}

// NO SERVICE WORKER INSIDE THE ANDROID APP. Its assets are already on the
// device, served by Capacitor from https://localhost, and a service worker
// there would only add a second cache that can serve a stale bundle after
// a Play update. Offline DATA is Firestore's persistent cache, which does
// not depend on the service worker and works identically in both shells.
if (import.meta.env.MODE !== 'demo' && !isNativeApp()) {
  const updateSW = registerSW({
    immediate: true,
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
    <BrowserRouter basename={import.meta.env.MODE === 'demo' ? '/demo' : undefined}>
      <App />
    </BrowserRouter>
  </StrictMode>
);