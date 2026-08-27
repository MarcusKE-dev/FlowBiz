import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import toast from 'react-hot-toast';
import { registerSW } from 'virtual:pwa-register';
import { enterDemoMode, isDemoMode } from './demo/demoMode';
import { seedDemoDataIfNeeded } from './demo/seedData';

if (import.meta.env.MODE === 'demo' || isDemoMode()) {
  enterDemoMode();
  seedDemoDataIfNeeded();
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
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>
);