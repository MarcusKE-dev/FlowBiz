# FlowBiz — Non-Food Industry Audit

**Date:** 2026-09-06
**Branch:** `audit-remediation`
**Scope:** the ten non-food industry profiles. Food-service profiles are
explicitly excluded — see §4.

---

## 1. Executive summary

FlowBiz's non-food core is in good shape. The money path reconciles, the
tenant boundary is enforced by the rules engine rather than by the UI, and
the industry layer is a capability catalogue rather than a thicket of
`if (industry === ...)` branches. Most of what this audit did was try hard
to break those things and fail.

It did not fail everywhere. **One critical defect was found: any person who
could sign up could take full ownership of any other business in the
system** — read, write and delete its entire workspace — by writing their
own user profile with someone else's `businessId`. That is fixed, covered
by regression tests, and re-verified by re-running the original attack.

Four defects were found in total, all fixed and re-verified. One reporting
gap for service businesses was closed. Nothing known-critical remains open
inside the tested scope.

Offline behaviour — the product's headline claim and the highest-risk area
going in — was tested against the real built app with its service worker,
and it holds: a sale made offline survived a full page reload while still
offline and then synced **exactly once**, with stock deducted once.

| | |
|---|---|
| Defects found | 4 (1 × P0, 1 × P1, 2 × P2) |
| Defects fixed and re-verified | 4 |
| Known-critical defects remaining | 0 in tested scope |
| Tests passing | 531 unit + 210 worker + 38 rules (5 new) |
| Production build | Passes (all modes) |

**Deployment position:** the audited paths are fit to deploy. Coverage is
not uniform across all ten industries — §12 states exactly what was and was
not exercised, and that unevenness, not a known defect, is the main
qualification on this assessment.

---

## 2. Test environment

Testing ran against a **real Firebase stack**, not the demo stub.

| Layer | What was used |
|---|---|
| Firestore | Emulator :8080, throwaway project `flowbiz-audit-test`, **real `firestore.rules` enforced** |
| Auth | Emulator :9099 — real signup, verification, sign-in, sign-out |
| App | Vite `--mode emulator` on :5273, Firebase reached same-origin via dev proxy |
| Browser | Playwright MCP 0.0.80, headless Chromium, origin-locked to :5273 |

Demo mode was deliberately **not** used for functional testing.
`src/demo/localAuth.js` auto-signs-in a hardcoded admin and accepts any
password, and replaces Firestore entirely — so authentication, tenant
isolation and security rules are all untestable there, and any "pass"
would have been meaningless.

Isolation was verified rather than assumed: every non-local request was
blocked at the network layer (`fonts.googleapis.com` and `js.paystack.co`
both returned `ERR_BLOCKED_BY_CLIENT`), and no request reached
`googleapis.com`, `firebaseio.com` or `workers.dev`. This mattered because
`.env` points at the live project `swiftstock-bc6a3` and carries a
`pk_live_` Paystack key; the live payment SDK was blocked from loading.

Harness additions (all safe for production):

- `npm run emulators`, `npm run dev:emulator`
- `.env.emulator` — fake values only, safe to commit; real `.env` untouched
- `src/firebase.js` — emulator host/port made env-configurable, **defaults
  unchanged**, so production behaviour is byte-identical
- `vite.config.js` — dev-server-only proxy, never part of a build

---

## 3. Test businesses

Four real businesses were created through the actual signup form:

| Business | Profile | Purpose |
|---|---|---|
| Alpha Hardware Ltd | HARDWARE | Money path, purchasing, returns, units |
| Beta Pharmacy Ltd | PHARMACY | Batches, expiry, FEFO, pack sizes |
| Gamma Hair Studio | SALON | Service model, staff reporting |
| Delta Fashion House | BOUTIQUE | Variants |

---

## 4. Food industries — intentionally excluded

Restaurant, Café, Fast Food, Bakery and Bar/Pub were **not** tested and
their business logic was **not** touched.

The requirement to remove them from signup was **already implemented**
before this audit, correctly. It was verified adversarially rather than by
reading the code:

- The picker offers exactly the ten non-food profiles.
- `RESTAURANT` was injected into the `<select>` and forced into React
  state; the business was still recorded as `GENERAL_RETAIL`.

The mechanism is `SIGNUP_DEFERRED_FAMILIES = ['FOOD']` plus
`resolveSignupProfile()`, which collapses any deferred or unknown profile
on write (`Setup.jsx:139`). The food architecture remains fully intact in
`src/domain/fnb/` and in `PROFILES` — **de-surfaced, not deleted**.
Re-enabling is a one-line change to that array.

---

## 5. Defects found and fixed

### BUG-002 — P0 — Cross-tenant business takeover

**Industry:** all. **Module:** `firestore.rules`, `/users`.

Any signed-up account could create its own `/users/{uid}` document with
`role: 'owner'` and a **victim's** `businessId` — no invite, no
relationship, no prior access — and immediately inherit the victim's
entire workspace.

Verified with real ID tokens against real rules:

```
FAIL[P0] uninvited account creates OWNER profile on victim business -> ALLOWED
FAIL[P0]   -> then reads victim products / customers / sales        -> ALLOWED
FAIL[P0]   -> then reads victim expenses / businessSettings         -> ALLOWED
FAIL[P0]   -> then rewrites victim product price                    -> ALLOWED
FAIL[P0]   -> then DELETES victim product                           -> ALLOWED
```

**Root cause.** The `allow create` rule validated the *invite* path
properly but let the *owner* path through on any `businessId` string with
no proof of relationship. `businessId` is not secret — `staffInvites` is
`allow get: if true` by design so the join link works before sign-in.

**Fix.** An owner profile may now only be created for a business whose
`createdBy` is the caller. Signup writes business + profile + settings in
one `writeBatch`, so the business does not exist when the profile rule
runs and a plain `get()` sees nothing; `getAfter()` evaluates against the
state the commit proposes, which makes the atomic batch and the ownership
check compatible. `businesses` create was also tightened to require
`createdBy == request.auth.uid`, so `createdBy` is a fact worth trusting
rather than a field the caller picks.

**Verification.** Attack denied 403. Real browser signup still works
(Delta Fashion House created through the UI after the fix). Five
regression tests added; 38/38 rules tests pass.

### BUG-001 — P1 — Install banner covered the signup button

**Module:** `src/components/common/PwaInstallBanner.jsx`.

At 1440×900, `document.elementFromPoint()` at the centre of "Create
business" returned the install `<aside>`, not the button
(`buttonIsClickable: false`). Clicks on the primary signup CTA hit the
banner. Because the banner is `fixed`, scrolling did not move it away.

**Root cause.** A fixed bottom overlay was rendered on `/setup` and
`/signup`, which centre a card in a `min-h-screen` flex container — so the
submit control sits at the bottom of the viewport, exactly where the
banner lands.

**Fix.** Two parts. The banner now reserves its measured height at the
foot of the document, so it cannot cover normal-flow content on any page.
That alone cannot rescue a viewport-centred layout (the card stays centred
however tall the document gets), so the banner is now shown on the landing
page only. Someone on `/setup` has already decided to sign up; prompting
them to install instead competed with the conversion the page exists for,
and installation remains available on the landing page.

**Verification.** `elementFromPoint` now returns the button;
`buttonIsClickable: true`; a full signup completed with a plain click and
no DOM manipulation. Banner still renders and reserves 154px on `/`.

**Note for the owner:** this is a deliberate, visible product change — the
install prompt no longer appears during signup. Easily reverted if you
disagree, but the CTA must then be moved out from under it.

### BUG-003 — P2 — Best sellers contradicted the P&L

**Module:** `src/pages/Reports.jsx`.

After a partial return, the profit panel read Revenue 400 / Gross profit
200 while the Best sellers table, for the same product over the same
period on the same screen, read KES 600.00 / KES 300.00.

**Root cause.** `bestSellers` aggregated `sales` + `creditSales` and
excluded voided sales but never subtracted `refunds` — which the
financials hook already returns and Reports simply never destructured.

**Fix.** `sale-return` refunds are netted out of units, revenue and
profit. Rows that fully net to zero are dropped: a product returned in
full is not a best seller, and a return settled against an earlier
period's sale would otherwise render as a negative row.

**Verification.** Now reads 2 units / KES 400.00 / KES 200.00, matching
the P&L exactly.

### BUG-004 — P2 — Exported PDF disagreed with the screen

**Module:** `src/pages/Reports.jsx` (PDF export).

After BUG-003 was fixed, the same product over the same period read
**6 units / KES 1,000.00 on screen** and **7 units / KES 1,200.00 in the
downloaded PDF** — the document headed "Official Record from FlowBiz
Workstation" that an owner would hand to an accountant or a lender.

**Root cause.** `productPerf` was a second, near-identical copy of the
`bestSellers` calculation, feeding the PDF. Fixing the on-screen figure
left the copy reporting gross. The duplication *is* the bug — it is what
allowed the two to drift.

**Fix.** The duplicate was deleted rather than patched. The PDF now
derives its table from the same `bestSellers` result, showing a shorter
list. One calculation, so they cannot diverge again.

**Verification.** Rebuilt, re-exported, and extracted the PDF's text
directly: section 5 now reads "Cement 50kg (6 units) KES 1,000.00",
matching the screen. The P&L section was correct throughout and is
unchanged.

---

## 6. Improvement made

### Staff performance report (§44 gap for salon/barber)

Salon, Barber and General Services had no staff reporting, although every
sale has always carried `soldBy` and `soldByName`.

A **Staff performance** section was added to Reports — sales count,
revenue and profit per person. Returns are credited back to whoever *made*
the sale, not whoever processed the refund, so a supervisor handling
returns does not accumulate everyone else's reversals.

It appears only when more than one person actually sold something in the
period, so a one-person business does not get a table restating its own
headline. Gating on the data rather than the industry keeps it out of
`if (profile === ...)` territory and makes it useful to any shop with two
people behind the counter.

Verified: hidden with one seller; with two it showed Njeri 1,000 + Gary
500 = 1,500, reconciling exactly with the P&L revenue of 1,500.

---

## 7. Financial integrity — independently verified

The §43 scenario was run end-to-end through the real UI, with every figure
checked against an **independently calculated** oracle rather than the
app's own functions.

Open counter (float 1,000) → product (cost 100, sell 200) → purchase 10 @
100 cash → sell 3 @ 200 cash → expense 200 rent → return 1 unit.

**Ledger, read straight from Firestore:**

| Check | Expected | Actual |
|---|---|---|
| Purchase docs after double-click | 1 | 1 ✅ |
| Sale docs after double-click | 1 | 1 ✅ |
| Sale `costOfGoodsSold` | 300 | 300 ✅ |
| Stock: purchase → sale → return | 10 → 7 → 8 | 8 ✅ |
| Refund `costOfGoodsSold` (proportional) | 100 | 100 ✅ |

**Displayed vs. independent oracle — all exact:**

| Figure | Oracle | Displayed |
|---|---|---|
| Cash balance | 1000+600−1000−200−200 = 200 | KES 200.00 ✅ |
| Revenue | 600 − 200 = 400 | KES 400.00 ✅ |
| COGS | 300 − 100 = 200 | KES −200.00 ✅ |
| Gross profit | 200 | KES 200.00 ✅ |
| Expenses | 200 | KES −200.00 ✅ |
| Net profit | 0 | KES 0.00 ✅ |
| Inventory at cost | 8 × 100 = 800 | KES 800.00 ✅ |

Salon independently reconciled too: cash 800 = 300 float + 500 service;
revenue 500, COGS 0, net 500.

**On the "currency showing a time" class of bug:** every screen was swept.
The only time-like string found was `14:19` under the dashboard's **TIME**
column, with AMOUNT a separate column — correct placement, and 11:19 UTC →
14:19 EAT is the right Nairobi offset. No money field renders a time.

---

## 8. Multi-tenant security

**42 of 42** isolation attacks were already blocked before any fix, using
real ID tokens against real rules: cross-tenant reads, writes, deletes,
unfiltered collection lists, `businessId`-scoped queries, ownership
transfer, product injection into another tenant, cashier self-promotion,
suspended accounts re-enabling themselves or clearing their suspension
stamp, staff-invite forgery, `systemAdmins` escalation and enumeration,
self-upgrade to Pro, anonymous reads, and session hijack.

The `ownsUpdate(existing, incoming)` pattern — checking **both** sides —
is the right defence against ownership transfer and is used consistently.

The one hole was BUG-002 (§5), now closed.

**Residual note (accepted, not a defect):** `staffInvites` is
`allow get: if true` so the join link resolves before sign-in, which means
an invite id discloses a `businessId`. After the fix, knowing a
`businessId` grants nothing. Worth revisiting only if invite ids ever
become guessable.

---

## 9. Authentication

Tested against the real Auth emulator: signup, verification email issued
and consumed through the app's own `/auth/action` handler, dashboard
gated until verified, sign-in, sign-out, session persistence, protected
routes, and `PublicOnly` redirects for already-authenticated users.

- Wrong password and nonexistent account return the **same** generic
  "Incorrect email or password" — no user enumeration.
- Email verification is enforced before dashboard access.
- Unknown routes redirect cleanly; no crash, no blank screen.
- Worker failure during login (`/api/auth/login-event`) is non-fatal —
  login still succeeded with the worker unreachable.

---

## 10. Industry data models

| Industry | Model | Verdict |
|---|---|---|
| General retail | Baseline; every capability off | **A** — appropriate |
| Supermarket | barcodeLabels, units, waste | **A** |
| Hardware | units (metre/kg/litre/box), barcodeLabels | **A** — verified in browser |
| Boutique | variants | **A** — verified: 3 sizes × 2 colours → 6 versions, each with own stock |
| Electronics | variants, barcodeLabels | **B** — see §11 |
| Wines & spirits | packSizes, ageRestriction, units | **A** |
| Pharmacy | batches, expiryAlerts, packSizes, units | **A** — verified in browser |
| Salon / Barber | services | **A** for the model; **B** for reporting (§6 closes part) |
| General services | services, nav trimmed | **A** |

**Services are correctly modelled, not bolted onto stock.** `kind:
'service'` excludes an item from stock deltas, valuation and low-stock,
with backward-compatible defaults. In the UI, choosing "A service"
removes stock and buying price ("A service never uses up stock"). A sold
service recorded `totalAmount` 500, COGS 0, profit 500, and stock stayed 0
rather than going negative. This is exactly the domain distinction the
brief asked for — a haircut is not a stock item.

**Pharmacy FEFO genuinely works.** Batch number and expiry are captured at
**receiving**, not on the product — correct, since a batch belongs to a
consignment. Two batches were received (BATCH-A exp 2026-12-31, BATCH-B
exp 2026-10-31, 10 each) and 12 units sold. Result: BATCH-B
`remainingQuantity` 0, BATCH-A 8, product stock 8. The earlier-expiring
batch was consumed first, and the Expiry page showed only BATCH-A with 8
left at KES 40.00. `quantity` is the immutable receipt; `remainingQuantity`
is the live balance.

**Industry tailoring is real, not cosmetic.** Categories, units and
navigation genuinely differ: Hardware offers Building Materials/Timber/
Plumbing with metre/foot/kg; Pharmacy offers Prescription/OTC/Antibiotics
with a pack→unit model ("a box of 30 tablets"); Boutique offers Dresses/
Tops/Footwear with a variant matrix; Salon offers Hair/Braiding/Nails and
renames the page "Services & products". Pharmacy gains `/expiry`; General
Services drops purchases/suppliers/stock-take.

---

## 11. Open gaps (not defects — deliberate recommendations)

### Electronics: no serial / IMEI / warranty tracking — Medium

`grep` for `serialNumber|imei|warranty` returns nothing anywhere in
`src/`. Electronics currently relies on `variants` + `barcodeLabels`.

**Why not built here.** Per-unit identity is a genuine data-model change,
not a field: a product with serials is no longer quantity-fungible, which
touches receiving, the counter, returns, and warranty lookup. Designing
that mid-audit would have been the "rebuild functioning architecture
without evidence" the brief warns against.

**Recommendation.** Add a `serials` capability owning a
`productSerials` collection (`productId`, `serial`, `status`,
`receivedAt`, `soldAt`, `saleId`, `warrantyMonths`), defaulting off and on
for ELECTRONICS. Stock stays the count of `status: 'in_stock'` rows. This
fits the existing capability pattern and needs no change to generic
inventory.

### Salon/Barber: commissions and appointments — Medium / Large

Staff performance is now reported (§6). Still absent:

- **Commissions** — needs a per-staff or per-service rate model and payout
  tracking. Medium; builds directly on the new staff report.
- **Appointments / walk-ins** — a subsystem in its own right (calendar,
  reminders, no-shows). Large. Recommend treating as its own project
  rather than folding into an audit.

### Pre-existing lint errors — P3

Six `react-hooks` errors exist in files this audit did not touch:
`AdvancedAnalytics.jsx`, `InventoryIntelligence.jsx`, `Settings.jsx` (all
`Date.now()` during render) and `Setup.jsx:178` (ref read during render).
None currently misbehaves, but `react-hooks/purity` violations are the
class that breaks under concurrent rendering. `Setup.jsx` is the signup
path, so any change there needs its own verification — which is why it was
left alone rather than tidied in passing.

---

## 11a. Offline and synchronisation

This was the highest-risk untested area going in, and it passes.

**It cannot be tested on the dev server.** `vite dev` fetches route chunks
on demand, so going offline there fails a dynamic import rather than
testing the product. Testing was therefore done against the **built app
served by `vite preview`**, with its real service worker (225 precached
entries) controlling the page.

| Scenario | Result |
|---|---|
| Header state on disconnect | Flips "Online" → **"Offline"** |
| Counter usable offline | Yes — products, cart, totals all work |
| Sale completed offline | "Sale saved offline. It will sync when you reconnect." |
| Write held client-side | Confirmed — server still showed 1 sale / stock 8 |
| Reconnect | Synced **exactly once**: 2 sales, stock 8 → 6 |
| Offline sale → **full page reload while still offline** | App reloaded from cache; queued write survived |
| Reconnect after that reload | Synced **exactly once**: 3 sales, stock 6 → 5 |
| Books after sync | Revenue 1,000 / COGS 500 / net 300 — matched the independent oracle exactly |

No duplicate transactions, no double stock deduction, no lost sale. The
offline claim holds.

**Minor observation (not a defect).** A lazy route chunk that fails to load
during a flaky connection shows the error boundary ("Something went wrong /
Return to dashboard") and does not retry by itself; a reload fixes it. Worth
an automatic retry one day, but the user is never stranded.

---

## 12. Coverage — what was and was not tested

Stated plainly, because uneven coverage is the main qualification on the
deployment assessment.

**Exercised in the browser, end-to-end:** signup, email verification,
login (success and both failure modes), logout, session/route protection,
counter open, product and service creation, inline supplier and category
creation, purchasing with and without batches, sales, partial returns,
expenses with validation, dashboard, Reports, FEFO, variants, pack sizes,
double-submit on sales and purchases, mobile (390×844) and desktop
(1440×900) layouts, empty states, unknown routes.

**Verified at data/rules level with real tokens:** tenant isolation (42
attacks), privilege escalation (17 attacks), Firestore rules (38 tests).

**Also exercised end-to-end (second pass):** offline sale, offline reload
and reconnect sync; credit sale with inline customer creation; partial and
final debt repayment with proportional COGS; overpayment prevention; stock
take with variance and audit record; Close Day reconciliation, variance and
reopen; CSV export; PDF report export with text extracted and checked.

**NOT exercised in this pass:**

| Area | Risk |
|---|---|
| Waste recording (Supermarket only capability) | Medium |
| Data import / export backup, business reset | Medium |
| Admin console (`/admin/*`), support mode, worker endpoints | Medium |
| Team/staff invite flow end-to-end (rules-tested, not UI-tested) | Medium |
| Receipts and invoices as shared documents | Medium |
| Date-boundary/midnight rollover behaviour | Medium |
| Supermarket, Electronics, Wines & Spirits, General Services, Barber, General Retail driven in the browser | Medium — code paths shared with the four profiles driven directly |

The remaining gaps are mostly administrative rather than money-affecting.
The money-affecting paths — sales, purchases, returns, credit, debt,
expenses, stock take, close of day, offline sync — have all now been driven
end-to-end and independently reconciled.

---

## 13. Deployment-readiness assessment

**Ship the audited paths.** No known-critical defect remains in scope. The
P0 that existed is fixed, tested and re-verified; the money path
reconciles against independent calculation; the tenant boundary holds
under direct attack; the production build passes.

Before deploying:

1. **Deploy the updated `firestore.rules`.** The BUG-002 fix is inert
   until the rules are published. This is the single most important item
   here — until then, the takeover is live.
2. Decide on the install-banner behaviour change (§5, BUG-001).
3. Nothing else blocking. Offline/sync was tested and holds (§11a).

Not blocking, but worth knowing: the main bundle is 957 kB (256 kB
gzipped) and Vite warns about it; and `.env` carries a live Paystack key
and live Firebase project, so keep it out of any shared environment.

**This is not a claim of "bug-free".** It is a claim that the paths listed
in §12 as exercised were exercised, with the evidence above, and that what
was found was fixed.

---

## 14. Summary table

| Industry | Tested | P0 | P1 | P2 | P3 | Fixed | Remaining | Status |
|---|---|---|---|---|---|---|---|---|
| General retail | Code + shared paths | – | – | – | – | – | – | Ready |
| Supermarket | Code | – | – | – | – | – | – | Ready |
| Hardware | **Browser, deep** | – | – | – | – | – | – | Ready |
| Boutique / Fashion | **Browser** | – | – | – | – | – | – | Ready |
| Electronics | Code | – | – | – | – | – | serials gap | Ready (see §11) |
| Wine & Spirits | Code | – | – | – | – | – | – | Ready |
| Pharmacy | **Browser, deep** | – | – | – | – | – | – | Ready |
| General Services | Code | – | – | – | – | – | – | Ready |
| Barber Shop | Code (shares Salon) | – | – | – | – | – | commissions | Ready (see §11) |
| Salon | **Browser** | – | – | – | – | – | commissions | Ready (see §11) |
| **Platform-wide** | **Browser + rules** | **1** | **1** | **2** | 6 pre-existing | **4** | 6 lint | **Ready** |
| Restaurant, Café, Fast Food, Bakery, Bar | **DEFERRED — NOT IN THIS AUDIT** | — | — | — | — | — | — | Removed from signup |

The three defects were platform-wide rather than industry-specific, which
is itself a finding: the shared core is where the risk concentrated, and
the per-industry layer behaved.

---

## 15. Files changed

| File | Change |
|---|---|
| `firestore.rules` | BUG-002 fix — owner-profile create must prove `createdBy`; `businesses` create must name the caller |
| `test/rules/firestoreRules.test.mjs` | 5 regression tests, incl. atomic-batch signup |
| `src/pages/Reports.jsx` | BUG-003 fix; BUG-004 fix (duplicate product calc removed); staff performance report |
| `src/components/common/PwaInstallBanner.jsx` | BUG-001 fix — reserves space, landing page only |
| `src/firebase.js` | Emulator host/port env-configurable (**defaults unchanged**) |
| `vite.config.js` | Dev-only emulator proxy; `preview` proxy + `dist/emulator` outDir so the built app can be tested offline |
| `package.json` | `dev:emulator`, `emulators` scripts |
| `.env.emulator` | New — fake values only |
| `.gitignore` | Ignore `.playwright-mcp/` |
