// src/hooks/usePwaInstall.js
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// Module-level global singleton so beforeinstallprompt is NEVER missed,
// even if fired before React mounts or while navigating between routes.
let globalDeferredPrompt = null;
const promptListeners = new Set();

function setGlobalPrompt(prompt) {
  globalDeferredPrompt = prompt;
  promptListeners.forEach((listener) => listener(globalDeferredPrompt));
}

if (typeof window !== 'undefined') {
  // Capture the browser's install prompt event immediately at script execution
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    setGlobalPrompt(e);
  });

  // Clear when the app has finished installing
  window.addEventListener('appinstalled', () => {
    setGlobalPrompt(null);
  });
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(globalDeferredPrompt);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneDisplay =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(Boolean(isStandaloneDisplay));
    };

    checkStandalone();

    const userAgent = (navigator.userAgent || '').toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Check if the app is already installed via getInstalledRelatedApps if supported
    if ('getInstalledRelatedApps' in navigator) {
      navigator.getInstalledRelatedApps().then((relatedApps) => {
        if (relatedApps && relatedApps.length > 0) {
          setIsInstalled(true);
        }
      }).catch(() => {});
    }

    // Subscribe to changes in globalDeferredPrompt
    const handlePromptChange = (prompt) => {
      setDeferredPrompt(prompt);
    };

    promptListeners.add(handlePromptChange);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      promptListeners.delete(handlePromptChange);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const isInstallable = Boolean(deferredPrompt);

  const promptInstall = async () => {
    // 1. Direct 1-click install if beforeinstallprompt is ready
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setGlobalPrompt(null);
        return choice?.outcome === 'accepted';
      } catch (err) {
        console.error('[PWA] prompt error:', err);
      }
    }

    // 2. iOS fallback
    if (isIOS) {
      toast('Tap the Share button in Safari, then select "Add to Home Screen".', { duration: 4000 });
      return false;
    }

    // 3. If already installed or running in standalone mode
    if (isStandalone || isInstalled) {
      toast.success('FlowBiz is already installed on this device!');
      return false;
    }

    // 4. If deferredPrompt was not captured (e.g. desktop Safari / Firefox)
    toast('To install, tap your browser menu (⋮) and select "Install app" or "Add to Home screen".');
    return false;
  };

  return {
    isInstallable,
    isIOS,
    isStandalone: isStandalone || isInstalled,
    promptInstall,
  };
}