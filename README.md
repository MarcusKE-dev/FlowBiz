# FlowBiz — Business Manager

Production-ready POS and business management app for Kenyan SMBs.

## Setup

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # fill in your Firebase config
npm run dev
```

## Deployment

```bash
npm run build
# Deploy dist/ to Vercel, Netlify, or Firebase Hosting
# firebase deploy --only hosting
```

## First-time Firebase setup

1. Create a Firebase project, enable **Authentication → Email/Password** and **Firestore**
2. Paste the Firestore security rules from `src/firebase.js` into **Console → Firestore → Rules**
3. Create your owner account in Firebase Console (Auth → Add user), then sign in — first account auto-bootstraps as Admin
4. Create the Firestore composite indexes listed in `src/firebase.js` (or let the app prompt you via console links)

## PWA Installation (Chrome)

1. Open the deployed app in Chrome on Android or desktop
2. Chrome shows "Add to Home Screen" banner, or tap **⋮ → Install app**
3. iOS Safari: tap Share → Add to Home Screen

## Fixes applied (v2.0 — full audit pass)

| ID   | Fix |
|------|-----|
| CR-1 | DebtorDetail missing profile + serverTimestamp imports |
| CR-2 | Repayment history reads from `repayments` collection (not stale embedded array) |
| CR-3 | SaleModal missing toast import |
| CR-4 | Reports missing ErrorBanner import |
| CR-5 | Login navigation moved into useEffect (no render-time side effects) |
| CR-6 | Till reconciliation correctly includes debt repayments in expected balances |
| CR-7 | M-Pesa transaction code enforced in sale canSubmit check |
| CR-8 | All POS writes use writeBatch + increment() — offline-first, no runTransaction |
| CR-9 | Staff creation writes profile BEFORE signing admin out |
| HP-1 | limit() added to unbounded queries |
| HP-2 | useFinancialsForRange debounced with requestAnimationFrame — 1 render per write |
| HP-3 | StockTake reads fresh stock inside transaction (no stale-read bugs) |
| HP-4 | Product performance includes credit sales |
| HP-5 | CSV export sanitised against formula injection (=, +, -, @) |
| HP-6 | Users page password input masked (type="password") |
| HP-7 | CloseDay batch deletion chunked at 400 ops; window.location.reload() removed |
| HP-8 | Dashboard "today" range recalculated at midnight via setTimeout |
| HP-9 | ErrorBoundary wraps entire app |
| MP-1 | Modal + ConfirmDialog close on ESC key |
| MP-4 | ProductFormModal validates negative prices and selling below cost |
| MP-5 | Suppliers payment blocked if amount exceeds outstanding balance |
| MP-6 | RepaymentModal blocks over-repayment |
| MP-7 | Bootstrap profile avoids serverTimestamp() sentinel in React state |
| MP-8 | StockTake empty physical count treated as unchanged (not zero) |
| MP-10| All routes lazy-loaded (React.lazy + Suspense) |
| MP-11| useDailySession uses onSnapshot for cross-device real-time updates |

## Firestore composite indexes required

| Collection  | Fields              |
|-------------|---------------------|
| sales       | soldAt              |
| creditSales | soldAt              |
| creditSales | customerId + soldAt |
| expenses    | recordedAt          |
| repayments  | paidAt              |
| repayments  | customerId + paidAt |

Run the app once — Firestore prints console errors with direct auto-create links.
