// scripts/android/assetlinks.mjs
//
// Writes public/.well-known/assetlinks.json, which lets Android VERIFY that
// flowbiz.co.ke/auth/action and /join/… links belong to this app, so they
// open in FlowBiz instead of a chooser.
//
// Usage:
//   FLOWBIZ_SHA256_CERT_FINGERPRINTS="AA:BB:…,CC:DD:…" npm run android:assetlinks
//
// Use the APP SIGNING key's SHA-256 from Play Console → Test and release →
// App integrity (with Play App Signing, Google's key signs what users
// install — NOT your upload key). Add the upload key's fingerprint too if
// you sideload release builds for testing. Deploy the file with the web app.
//
// Deliberately not committed with a placeholder: a wrong fingerprint on the
// live site is worse than none, because it silently fails verification.

import { mkdirSync, writeFileSync } from 'node:fs';

const raw = process.env.FLOWBIZ_SHA256_CERT_FINGERPRINTS || '';
const fingerprints = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
const valid = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
if (fingerprints.length === 0 || !fingerprints.every((f) => valid.test(f))) {
  console.error('Set FLOWBIZ_SHA256_CERT_FINGERPRINTS to one or more comma-separated SHA-256 fingerprints (AA:BB:… 32 bytes).');
  process.exit(1);
}

const statements = ['com.abcsystems.flowbiz'].map((packageName) => ({
  relation: ['delegate_permission/common.handle_all_urls'],
  target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints },
}));

mkdirSync('public/.well-known', { recursive: true });
writeFileSync('public/.well-known/assetlinks.json', `${JSON.stringify(statements, null, 2)}\n`);
console.log(`Wrote public/.well-known/assetlinks.json with ${fingerprints.length} fingerprint(s).`);
