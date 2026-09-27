# FlowBiz — Business Manager

POS, inventory, credit and finance management for small businesses in any
country — shipped as one React codebase to the **web / PWA** and to
**Android** (Capacitor). Kenya (KES, M-Pesa) is a first-class market;
it is no longer the only one.

## Documentation

| Read | For |
|---|---|
| `docs/INTERNATIONAL.md` | countries, currencies, locales, timezones, phone numbers |
| `docs/BILLING.md` | regional pricing, Paystack / M-Pesa / Google Play, entitlements |
| `docs/ANDROID.md` | the Android app: build, sign, AAB, Play Console, security, test script |
| `docs/LICENSING.md` | the perpetual licence and annual services model |
| `docs/ARCHITECTURE.md`, `docs/INDUSTRY.md`, `docs/FNB_ARCHITECTURE.md` | the industry and F&B engines |

## Setup (web)

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # fill in your Firebase config
npm run dev
```

## Tests

```bash
npm test                 # app unit tests + Cloudflare Worker tests
npm run test:rules       # Firestore rules against the emulator (port 8080)
npm run lint
```

## Build

```bash
npm run build            # web + demo builds into dist/
npm run android:debug    # Android debug APK
npm run android:bundle   # Android release AAB (needs the upload key; see docs/ANDROID.md)
```

## Deployment

- Web: deploy `dist/` (Cloudflare Pages).
- API: `cd cloudflare-worker && npx wrangler deploy`. Secrets are set with
  `wrangler secret put` and never committed — see `docs/BILLING.md` §5 and
  §7 for the billing ones.
- Firestore: `firebase deploy --only firestore:rules,firestore:indexes`.

## Platform layout

```
src/lib/region/    country, currency, time and phone — pure, shared with the Worker
src/billing/       plan ↔ store product catalogue, provider selection — pure
src/licensing/     prices, licence and services entitlement — pure
src/platform/      the only place web and Android differ (files, share, camera, billing, native chrome)
android/           the Capacitor Android project
cloudflare-worker/ the API: payments, Play verification, admin, emails
```
