// src/platform/platform.js
//
// WHICH SHELL FLOWBIZ IS RUNNING IN — the one question platform code asks.
//
// FlowBiz is one React application shipped two ways: as the web app / PWA,
// and inside a Capacitor shell as the Android app. Business logic never
// asks this question. Only the handful of services in src/platform/ do —
// files, sharing, the camera, billing, the native chrome — and each has a
// web implementation and a native one behind the same function, so no
// screen ever writes `if (android)`.
//
// iOS is anticipated rather than built: 'ios' is a value this returns,
// and every service below falls back to its web behaviour for it until a
// native implementation exists.

import { Capacitor } from '@capacitor/core';

/** 'web' | 'android' | 'ios' */
export function platformName() {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

/** True inside the Android (or a future iOS) app, false in any browser — including the installed PWA. */
export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isAndroidApp() {
  return platformName() === 'android';
}

/** Whether a Capacitor plugin is actually present in this build. */
export function hasNativePlugin(name) {
  try {
    return isNativeApp() && Capacitor.isPluginAvailable(name);
  } catch {
    return false;
  }
}

/** The billing platform a purchase is made on, as src/billing/catalog.js names it. */
export function billingPlatform() {
  const p = platformName();
  return p === 'android' ? 'android' : p === 'ios' ? 'ios' : 'web';
}
