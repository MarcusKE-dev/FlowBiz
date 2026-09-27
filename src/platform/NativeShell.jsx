// src/platform/NativeShell.jsx
//
// The Android app's chrome, wired to the router. Renders nothing, and does
// nothing at all in a browser.
//
//   SPLASH      hidden once React has painted, not on a timer, so there is
//               never a blank white frame between splash and app.
//   STATUS BAR  FlowBiz's canvas colour with dark icons, matching the web.
//   BACK        Android's back gesture closes an open dialog first (by
//               sending Escape, which every FlowBiz modal already handles),
//               then goes back in history, then leaves the app from the
//               home screen — instead of the WebView's default of exiting
//               from anywhere.
//   DEEP LINKS  https://flowbiz.co.ke/auth/action?… and /join/… open the
//               matching screen in the app. Only those two paths are
//               declared in AndroidManifest.xml, and only a path on the
//               FlowBiz host is ever navigated to.
//   KEYBOARD    a class on <html> while the keyboard is up, so fixed footers
//               (the bottom nav) can step out of its way.

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from './platform';
import { deepLinkRoute } from './deepLinks';

function isDialogOpen() {
  return Boolean(document.querySelector('[role="dialog"], [role="alertdialog"], [aria-modal="true"]'));
}

export default function NativeShell() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isNativeApp()) return undefined;
    const handles = [];
    let cancelled = false;

    (async () => {
      const [{ App }, { SplashScreen }, { StatusBar, Style }, { Keyboard }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/splash-screen'),
        import('@capacitor/status-bar'),
        import('@capacitor/keyboard'),
      ]);
      if (cancelled) return;

      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#F4F6F9' }).catch(() => {});
      requestAnimationFrame(() => SplashScreen.hide({ fadeOutDuration: 150 }).catch(() => {}));

      handles.push(await App.addListener('appUrlOpen', ({ url }) => {
        const route = deepLinkRoute(url);
        if (route) navigate(route);
      }));

      handles.push(await Keyboard.addListener('keyboardWillShow', () => document.documentElement.classList.add('keyboard-open')));
      handles.push(await Keyboard.addListener('keyboardWillHide', () => document.documentElement.classList.remove('keyboard-open')));
    })().catch(() => { /* a missing plugin must not break the app */ });

    return () => {
      cancelled = true;
      handles.forEach((h) => h?.remove?.());
    };
  }, [navigate]);

  // Back button: re-registered with the current location so "home" is known.
  useEffect(() => {
    if (!isNativeApp()) return undefined;
    let handle;
    let cancelled = false;
    import('@capacitor/app').then(async ({ App }) => {
      if (cancelled) return;
      handle = await App.addListener('backButton', ({ canGoBack }) => {
        if (isDialogOpen()) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return;
        }
        const atHome = location.pathname === '/' || location.pathname === '/dashboard' || location.pathname === '/counter';
        if (canGoBack && !atHome) navigate(-1);
        else App.minimizeApp().catch(() => App.exitApp());
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      handle?.remove?.();
    };
  }, [location.pathname, navigate]);

  return null;
}
