# FlowBiz for Android

One React codebase, two shells: the web app / PWA, and the Android app
built with Capacitor. There is no second copy of any business logic.

Written September 2026.

---

## 1. Architecture

```
            src/  (React 19 + Vite + Firebase)  — every screen, every rule
               │
     ┌─────────┴───────────┐
  web / PWA            Android (Capacitor 8)
  service worker       assets bundled in the APK/AAB, served from https://localhost
  Paystack / M-Pesa    Google Play Billing
  <a download>, print  share sheet (Filesystem + Share)
  ZXing camera         ML Kit Google code scanner (no camera permission)
```

Platform differences live **only** in `src/platform/`:

| Module | Web | Android |
|---|---|---|
| `platform.js` | `isNativeApp() === false` | `true` |
| `files.js` — `saveFile`, `shareFile`, `openForPrint`, `savePdf` | download / print tab / Web Share | cache file → system share sheet |
| `barcode.js` — `scanNative` | (ScannerModal's ZXing scanner) | ML Kit code scanner, ZXing fallback |
| `playBilling.js` | — | Play purchase, verify, consume, restore |
| `NativeShell.jsx` | renders nothing | splash, status bar, back button, deep links, keyboard |

Screens call these functions; none of them contains `if (android)`. iOS is
anticipated: `platformName()` can return `'ios'`, every service falls back
to web behaviour for it, and `billingProvidersFor({platform:'ios'})`
returns null until App Store billing exists.

Why these differ, briefly: a WebView ignores `<a download>`, cannot
`window.print()`, and a `blob:` URL passed to `window.open()` replaces the
whole app with a page it cannot render (Capacitor loads `blob:` in-app).
External `https:`/`mailto:` links become Android intents, so WhatsApp and
email links work unchanged.

**Offline** is unchanged: Firestore's persistent IndexedDB cache works the
same in the WebView. The service worker is **not** registered in the app
(assets are already on the device; a second cache could serve a stale
bundle after a Play update).

## 2. Tooling

- Node 24 (`.nvmrc`), JDK 21, Android SDK with platform 36 and
  build-tools 35+ (`ANDROID_HOME`), Android Studio (optional).
- `targetSdk`/`compileSdk` 36, `minSdk` 24 (`android/variables.gradle`).
  Check Play's current target-API requirement before each release and
  raise `targetSdkVersion` when it moves.

## 3. Commands

| Command | Does |
|---|---|
| `npm run build:android` | `vite build --mode android` then `cap sync android` |
| `npm run android:debug` | build + `assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run android:bundle` | build + `bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab` |
| `npm run android:open` | open the project in Android Studio |
| `npm run android:assets` | regenerate launcher icons and splash from `public/icons/icon-512.png` |
| `npm run android:assetlinks` | write `public/.well-known/assetlinks.json` (see §7) |

The debug build installs as `com.abcsystems.flowbiz.debug` ("FlowBiz
Debug") beside the release app. Install: `adb install -r app-debug.apk`.
Inspect the WebView: `chrome://inspect` (debug builds only).

## 4. Environment

The Android bundle is built with `--mode android`, so Vite reads `.env`
then `.env.android` / `.env.android.local`. It needs the same **public**
values as the web build:

```
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID,
VITE_FIREBASE_APP_ID, VITE_FLOWBIZ_API_URL
```

Firebase web config values are identifiers, not secrets; security comes
from `firestore.rules` and the Worker. **No server secret is ever a
`VITE_` variable.**

Also required once:

- Firebase Console → Authentication → Settings → Authorized domains:
  `localhost` (present by default).
- Worker `ALLOWED_ORIGINS` includes `https://localhost` (done in
  `wrangler.toml`) — the app's origin.

## 5. Versioning

`android/app/version.properties` holds `versionCode` (must increase for
every Play upload) and `versionName`. CI can override with
`-PflowbizVersionCode=… -PflowbizVersionName=…`.

## 6. Signing

Nothing secret is committed; `keystore.properties`, `*.jks` and
`*.keystore` are gitignored.

1. Create an upload key once:
   ```
   keytool -genkeypair -v -keystore flowbiz-upload.jks -keyalg RSA -keysize 4096 \
     -validity 10000 -alias flowbiz-upload
   ```
   Store it and its passwords in a password manager, outside the repo.
2. Copy `android/keystore.properties.example` to
   `android/keystore.properties` and fill it in — or set
   `FLOWBIZ_UPLOAD_STORE_FILE`, `FLOWBIZ_UPLOAD_STORE_PASSWORD`,
   `FLOWBIZ_UPLOAD_KEY_ALIAS`, `FLOWBIZ_UPLOAD_KEY_PASSWORD` (CI).
3. `npm run android:bundle`. Without a key the AAB builds **unsigned** and
   Play Console will refuse it.
4. Enrol in **Play App Signing** (default for new apps): Google holds the
   app signing key; yours is only the upload key.

## 7. Deep links

The manifest declares verified App Links for exactly two paths on
`https://flowbiz.co.ke`: `/auth/action` (email verification, password
reset) and `/join/<invite>` (staff invites). Everything else opens in the
browser. `NativeShell` routes only those paths.

To verify them, publish `https://flowbiz.co.ke/.well-known/assetlinks.json`:

```
FLOWBIZ_SHA256_CERT_FINGERPRINTS="<app signing SHA-256>" npm run android:assetlinks
```

Take the fingerprint from Play Console → Test and release → App integrity
→ App signing key certificate. Then deploy the web app. Until this file
exists, those links still work — they just open in the browser.

## 8. Security posture of the app

- `allowBackup="false"` and data-extraction rules exclude everything: the
  WebView holds the Firebase session and Firestore cache, which must not be
  restorable onto another device.
- Network security config: HTTPS only, system CAs only.
- FileProvider exposes the app cache only (the template exposed all of
  external storage).
- No CAMERA permission: the ML Kit code scanner runs in Google's own UI.
- Permissions: `INTERNET`, `ACCESS_NETWORK_STATE`.
- WebView debugging off in release (`capacitor.config.json`).
- Auth: email/password only, Firebase session in app-private IndexedDB,
  no OAuth redirect flows (there is no Google Sign-In to break).

## 9. Google Play Console checklist (manual)

- [ ] Create app `com.abcsystems.flowbiz`, enrol in Play App Signing.
- [ ] Upload the signed AAB to internal testing first.
- [ ] Store listing: name, short/full description, screenshots
      (phone and 7"/10" tablet), feature graphic 1024×500, icon 512×512
      (`resources/icon-only.png` scaled, or `public/icons/icon-512.png`).
- [ ] Privacy policy URL: `https://flowbiz.co.ke/privacy`.
- [ ] Account deletion URL (required because accounts can be created):
      `https://flowbiz.co.ke/settings` (sign in → Settings → Danger zone →
      Delete account), plus the support email for people who cannot sign in.
- [ ] Data safety form — see §10.
- [ ] Content rating questionnaire (business/productivity; no user-generated
      public content, no gambling).
- [ ] Target audience: adults (18+); not designed for children.
- [ ] In-app products — `docs/BILLING.md` §5.
- [ ] App access: provide a reviewer login (a demo business with sample
      data), because every screen is behind sign-in.
- [ ] Ads: none.

## 10. Data safety (draft answers — confirm before submitting)

| Data | Collected | Purpose | Shared |
|---|---|---|---|
| Name, email, phone (account holder, staff) | Yes | Account management, app functionality | No |
| Customer names and phone numbers entered by the business | Yes | App functionality (credit ledger, receipts) | No |
| Purchase history (FlowBiz plan purchases) | Yes | App functionality | No (Google Play/Paystack process payments) |
| Business financial records (sales, expenses) | Yes | App functionality | No |
| Device / login metadata (device label, last active) | Yes | Security, fraud prevention | No |
| Photos (product photos, logo), when the user adds them | Yes | App functionality | No |
| Location, contacts, microphone, SMS | No | — | — |

Data is encrypted in transit (TLS). Users can request deletion in-app
(Settings → Delete account) — see §11.

## 11. Account deletion

Implemented before this work and unchanged: Settings → Danger zone →
**Delete account**, password- and phrase-confirmed, handled by
`/api/auth/delete-own-profile` (see `cloudflare-worker/test/accountDeletion.test.js`).
Financial records are retained or purged as stated in the Terms (§19.1)
and Privacy Policy (§10.1). Play also needs a **web** deletion route; the
same Settings page works in a browser.

## 12. Manual test script (per release)

1. Install, launch: splash → login with no white flash; status bar matches.
2. Sign up in a non-Kenyan country: prices in USD, no M-Pesa wording.
3. Sign in, airplane mode, record a sale and an expense, force-stop, reopen
   offline, record another sale, reconnect: all sync once, stock correct.
4. Counter: scan a barcode (Google scanner appears, no permission prompt);
   cancel returns to the counter.
5. Receipt → Download / Print → share sheet opens with the PDF; save to
   Files; open it in a PDF viewer.
6. Reports → CSV and PDF export open the share sheet.
7. WhatsApp receipt opens WhatsApp with the message.
8. Back gesture: closes an open dialog, then navigates back, then leaves the
   app from the home screen.
9. Keyboard: on the counter's checkout, the Complete button stays visible.
10. Tap a password-reset email link: opens the app (after assetlinks is
    live) at the reset screen.
11. Pro screen: Play prices shown; purchase with a license tester; Restore
    purchases on a second device.
12. Rotate / tablet: layouts reflow, nothing clipped.
