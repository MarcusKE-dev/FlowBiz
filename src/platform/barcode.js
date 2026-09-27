// src/platform/barcode.js
//
// THE BARCODE SERVICE.
//
//   Android app  Google's code scanner (ML Kit, through Play services).
//                It opens its own full-screen camera UI, is fast and
//                accurate on cheap phones, and needs NO camera permission
//                — the app never asks for one.
//   Browser/PWA  The existing ZXing scanner in ScannerModal, using the
//                browser's camera permission, asked for when Scan is
//                tapped and not before.
//
// A hardware USB/Bluetooth scanner needs none of this: it types into the
// focused field like a keyboard, on every platform.
//
// scanNative() never throws. It resolves to one of:
//   { status: 'scanned', text }
//   { status: 'cancelled' }          the user backed out
//   { status: 'unavailable', reason } fall back to the web scanner

import { isNativeApp, hasNativePlugin } from './platform.js';

export function nativeScannerAvailable() {
  return isNativeApp() && hasNativePlugin('BarcodeScanner');
}

let modulePromise = null;

/** Make sure Play services has the scanner module, installing it once if needed. */
async function ensureGoogleModule(BarcodeScanner) {
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (available) return true;
  if (!modulePromise) {
    modulePromise = new Promise((resolve) => {
      let handle;
      const done = (ok) => {
        handle?.remove?.();
        resolve(ok);
      };
      // The install is a Play services download: bounded, so a phone with
      // no connection falls back to the in-app scanner instead of waiting.
      const timer = setTimeout(() => done(false), 45000);
      BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', (event) => {
        // 4 = COMPLETED, 5 = FAILED, 3 = CANCELED (ML Kit install states)
        if (event.state === 4) { clearTimeout(timer); done(true); }
        if (event.state === 5 || event.state === 3) { clearTimeout(timer); done(false); }
      }).then((h) => { handle = h; });
      BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => { clearTimeout(timer); done(false); });
    }).finally(() => { modulePromise = null; });
  }
  return modulePromise;
}

export async function scanNative() {
  if (!nativeScannerAvailable()) return { status: 'unavailable', reason: 'not-native' };
  try {
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) return { status: 'unavailable', reason: 'unsupported' };
    if (!(await ensureGoogleModule(BarcodeScanner))) return { status: 'unavailable', reason: 'module' };
    const { barcodes } = await BarcodeScanner.scan();
    const text = barcodes?.[0]?.rawValue || barcodes?.[0]?.displayValue || '';
    return text ? { status: 'scanned', text } : { status: 'cancelled' };
  } catch (err) {
    const message = String(err?.message || err || '');
    if (/cancel/i.test(message)) return { status: 'cancelled' };
    return { status: 'unavailable', reason: message.slice(0, 120) || 'error' };
  }
}
