// src/hooks/usePwaInstall.js
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

let globalDeferredPrompt = null;
const promptListeners = new Set();

function setGlobalPrompt(prompt) {
  globalDeferredPrompt = prompt;
  promptListeners.forEach((listener) => listener(globalDeferredPrompt));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default mini-infobar and store event for 1-click install
    e.preventDefault();
    setGlobalPrompt(e);
  });

  window.addEventListener('appinstalled', () => {
    setGlobalPrompt(null);
  });
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(globalDeferredPrompt);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    const isStandaloneDisplay =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(Boolean(isStandaloneDisplay));

    const ua = (navigator.userAgent || '').toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIosDevice);

    // Detect common in-app browsers (WhatsApp, FB, IG, Messenger, Twitter)
    const inApp = /fban|fbav|instagram|crios|gsa|wv|line|micromessenger/i.test(ua);
    setIsInAppBrowser(inApp);

    if ('getInstalledRelatedApps' in navigator) {
      navigator.getInstalledRelatedApps().then((apps) => {
        if (apps && apps.length > 0) setIsInstalled(true);
      }).catch(() => {});
    }

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
    // 1. Direct 1-click native install dialog (Android Chrome / Edge / Desktop Chrome)
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setGlobalPrompt(null);
          return true;
        }
        return false;
      } catch (err) {
        console.error('[PWA] prompt error:', err);
      }
    }

    // 2. iOS Safari (Apple does not support programmatic beforeinstallprompt)
    if (isIOS) {
      toast('Tap the Share button at the bottom of Safari, then select "Add to Home Screen".', { duration: 5000 });
      return false;
    }

    // 3. In-App WebViews (e.g. WhatsApp, Facebook link preview)
    if (isInAppBrowser) {
      toast('In-app browsers block app installation. Tap menu (⋮) and select "Open in Chrome".', { duration: 5000 });
      return false;
    }

    // 4. Already installed
    if (isStandalone || isInstalled) {
      toast.success('FlowBiz is already installed on this device!');
      return false;
    }

    // 5. Incognito / Private or Uncaptured state
    toast('App installation is blocked in Incognito/Private mode. Open FlowBiz in a standard tab to install.', { duration: 5000 });
    return false;
  };

  return {
    isInstallable,
    isIOS,
    isStandalone: isStandalone || isInstalled,
    isInAppBrowser,
    promptInstall,
  };
}