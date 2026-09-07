# Licensing, annual services and cloud entitlement

How FlowBiz sells software, how it sells the services around that
software, and why those are two different things all the way down to the
security rules.

Written September 2026. Where this document says a thing is deliberate,
it is deliberate; §9 and §10 are the two sections to read if you only
read two.

---

## 1. The commercial model in one paragraph

**KES 15,550 buys a perpetual licence** to use the FlowBiz application.
That licence never expires and is not a subscription. Bundled with it is
the **first 12 months of Cloud Services, Maintenance, Updates and
Support**. From the second year those hosted services cost **KES 3,000 a
year**. Not renewing ends the hosted services after a grace period. It
does not end the licence, it does not withdraw features the licence paid
for, and it never deletes the customer's data.

Two sentences that must stay true of every screen, every email and every
line of code in this system:

- The **licence** is owned. It has no expiry date and no renewal date.
- The **annual services** are rented. They expire, and they are renewable.

FlowBiz does not sell lifetime cloud hosting, lifetime updates or
lifetime support, and no customer-facing string is allowed to imply that
it does. `src/legal/legalLinks.test.js` fails the build if one appears.

---

## 2. Where everything lives

| Concern | File |
|---|---|
| Prices, periods, grace, reminder stages, copy lists | `src/licensing/config.js` |
| The entitlement resolver, all date arithmetic | `src/licensing/entitlements.js` |
| Server pricing table and Firestore payload builders | `cloudflare-worker/src/lib/licensing.js` |
| Purchase and renewal checkout | `cloudflare-worker/src/routes/paystackInitialize.js` |
| Applying a confirmed payment | `cloudflare-worker/src/routes/paystackWebhook.js` |
| Admin licence and cloud controls | `cloudflare-worker/src/routes/admin/adminLicensing.js` |
| Renewal reminder job | `cloudflare-worker/src/routes/licensingReminders.js` |
| Enforcement | `firestore.rules` |
| Customer UI | `src/components/licensing/`, `src/pages/Pro.jsx` |
| Admin UI | `src/components/admin/AdminLicensingSection.jsx` |
| Legal documents and their versions | `src/pages/Terms.jsx`, `src/pages/Privacy.jsx`, `src/legal/documentVersions.js` |

**The Worker imports the browser's licensing modules rather than copying
them.** This is a deliberate departure from the industry layer, which
keeps a copy in `cloudflare-worker/src/lib/industry.js`. The reasoning:
the industry layer duplicates two short allow-lists, while licensing is
date arithmetic and a status machine. A Worker that computed "expired" a
day earlier than the browser would show a customer an active service
period and refuse their renewal in the same breath. So the arithmetic has
exactly one implementation. `src/licensing/architecture.test.js` asserts
that `src/licensing/` stays free of React, Firebase and `import.meta`, so
the Worker can keep importing it.

---

## 3. The data model

One new map on the business document. `subscription` is untouched and
still drives the monthly Pro plan exactly as before.

```
businesses/{businessId}
  subscription: { plan, status, expiresAt, purchasedAt }   // the monthly plan
  licensing: {
    // The licence. Owned outright.
    licenseType: 'lifetime'
    licenseStatus: 'active' | 'revoked'
    licensePurchasedAt, licensePurchaseReference, licensePurchaseAmountKes
    licenseRevokedAt, licenseRevokedBy, licenseRevokedReason
    // NOTE: there is no licence expiry field, and nothing may add one.

    // The annual services entitlement. Rented.
    serviceStartDate, serviceExpiryDate      // expiry is EXCLUSIVE
    graceDays                                // default 30, per business
    lastServicePaymentAt, lastServicePaymentReference, lastServicePaymentAmountKes
    renewalCount, servicePeriodCount

    // Administrative cloud suspension. Never a revocation.
    cloudSuspended, cloudSuspendedAt, cloudSuspendedBy, cloudSuspendedReason
    cloudRestoredAt, cloudRestoredBy, cloudRestoredReason

    // Derived and stored ONLY so firestore.rules can read it (see §7).
    cloudEntitledUntil                       // serviceExpiryDate + graceDays

    // Reminder bookkeeping (see §8).
    reminderStageSent, reminderPeriodKey, reminderSentAt

    schemaVersion, updatedAt
  }
```

**Store facts, derive status.** Firestore holds dates and flags. It does
not hold the word "expired", because nothing writes to a document at the
moment a date passes, so a stored status goes stale. Every status in the
product is computed by `resolveEntitlements()` from a fact and a clock.

`serviceExpiryDate` is an **exclusive instant**. A period starting 7 Sep
2026 ends at 7 Sep 2027, and the last day the customer is covered for is
6 Sep 2027. Every "active until" in the UI shows `lastCoveredDay()`, not
the raw instant, because "your services end on 7 September" reads as
though the 7th is covered.

Billing history is the existing `payments` collection. No second payment
system was created.

---

## 4. Entitlements

`resolveEntitlements(business, now)` is pure, total and memoisable. It
never throws, and garbage input resolves to a free business with cloud
services on, never to a locked-out one.

| Entitlement | Lifetime, services active or in grace | Lifetime, services expired | Cloud suspended by admin | Pro | Free |
|---|---|---|---|---|---|
| `software.license` | yes | **yes** | **yes** | n/a | n/a |
| `features.pro` | yes | **yes** | **yes** | yes | no |
| `features.productPhotos` | yes | **yes** | **yes** | yes | no |
| `cloud.access` | yes | no | no | yes | yes |
| `cloud.sync` | yes | no | no | yes | yes |
| `cloud.storage` | yes | no | no | yes | yes |
| `cloud.backup` | yes | no | no | yes | yes |
| `cloud.documents` | yes | no | no | yes | yes |
| `maintenance` | yes | no | no | yes | yes |
| `updates` | yes | no | no | yes | yes |
| `support` | yes | no | no | yes | yes |

The bold column entries are the whole point. **A lapsed service period
and an administrative suspension never touch `software.license` or
`features.pro`**, because advanced analytics and inventory intelligence
were bought with the licence. `isPro` in `AuthContext` is
`can('features.pro')`, so nothing in the app removes a licensed feature
when maintenance lapses.

`features.productPhotos` tracks `features.pro` exactly, and is named
separately so a component can ask the question it actually has — "may
this business use product photos?" — instead of asking about a plan. That
is the pattern for the next licensed feature too: a name in `ENTITLEMENTS`
and a line in the resolver, never a second `isPro` check in a component.

Note the two rows product photos need and the difference between them.
`features.productPhotos` says the business is ENTITLED to the feature and
comes from the licence; `cloud.storage` says there is somewhere to PUT a
new one and comes from the service period. Uploading needs both. Showing
a photo already stored needs neither — reads are never gated — so a
Starter shop that once had Pro, and a lifetime customer whose services
lapsed, both keep every photo on their counter.

Service statuses: `not_applicable` (free and Pro businesses, nothing to
expire), `grandfathered` (see §11), `active`, `grace`, `expired`.

---

## 5. Renewal lifecycle

```
purchase ──► active (12 months) ──► grace (30 days) ──► expired
   ▲                   │                   │                │
   └───────────────────┴───────────────────┴────────────────┘
                        renew at any point
```

**An early renewal extends the existing expiry, it does not restart from
the payment date.** This is the most important arithmetic in the system
and it is worth stating in the terms it was specified in:

```
Purchased           7 September 2026
Covered             7 Sep 2026 to 6 Sep 2027
Renewed             20 August 2027   (KES 3,000)
New cover           to 6 September 2028
```

The customer keeps the eighteen days they had already paid for. A renewal
made after the period has run out starts from the payment date instead;
you cannot extend a window that closed, and back-dating one would sell
somebody time in the past. `computeRenewedExpiry()` is the single place
this decision is made.

Months are **calendar months**, not 30-day blocks, and month ends clamp
rather than roll over: 31 January plus one month is 28 February.

---

## 6. Grace period

Default 30 days, configured in `src/licensing/config.js` and stored per
business as `licensing.graceDays`, so changing the default never shortens
a window a customer is already inside.

During grace, **everything keeps working normally**. The grace period is
a courtesy, not a partial cut-off, and the customer is told repeatedly
that renewal is required. `serviceStatus` is `grace` — explicitly its own
state, not `expired` with a flag.

---

## 7. Cloud suspension, and what it actually withholds

**This section is the one to read before changing anything.**

`firestore.rules` gates exactly two write surfaces on the cloud services
entitlement:

- `productImages` create and update — cloud storage
- `sharedDocuments` create — cloud-hosted document publishing

Separately, and for a different reason, it gates two write surfaces on the
LICENSED feature set via `hasProFeatures()`:

- `productImages` create and update — product photos are a Pro feature
- `products` create and update, but only when the write ADDS a photo
  pointer (`hasImage`, `imageUrl`, `imageUpdatedAt`)

The second of those is not redundant. Without it a Starter business could
not store a photo but could still point a product at a URL it already had,
and the counter would render it. Clearing a pointer is always allowed, and
an edit that leaves the pointer untouched never asks the question at all —
so a business that loses the entitlement keeps its catalogue fully
editable and every stored image intact.

`hasProFeatures()` reads `subscription` and `licensing` off the business
document. Neither is client-writable, so a browser cannot grant itself the
plan it is being asked about.

It does **not** gate sales, stock, products, customers, credit, expenses,
or any other business record. That is a decision, not an omission.

FlowBiz records a sale into a Firestore local cache that syncs when it
can. A rules denial on that path does not politely refuse: the local
mutation is applied optimistically, rejected by the server, and then
**reverted locally**. A shop that recorded a day of sales offline would
lose them. Collecting a KES 3,000 service fee by destroying a customer's
takings is not an acceptable enforcement mechanism, and the brief this
system was built to is explicit that data must never be lost this way.

So what lapses is what can be withheld without destroying anything:
hosted storage, hosted document publishing, backups, maintenance, updates
and support. What continues is the customer's ability to run their shop
and keep their records.

Reads are **never** gated, and deletes are never gated. A business whose
services lapsed can still see every photo and document it owns, and can
still tidy its own catalogue.

### The single field the rules read

Rules cannot run `resolveEntitlements()`, so the Worker reduces the whole
question to one stored timestamp when it writes a service period:

```
licensing.cloudEntitledUntil = serviceExpiryDate + graceDays
```

```javascript
function cloudServicesActive() {
  let lic = myLicensing();                    // {} when there is no business doc
  return lic.get('cloudSuspended', false) != true
         && (lic.get('cloudEntitledUntil', null) == null
             || request.time < lic.get('cloudEntitledUntil', null));
}
```

A business with **no** `licensing` map — every free account, every
monthly Pro account, every business created before this existed — has no
such field and is entitled, which is exactly the previous behaviour.

If you change the entitlement model, `cloudEntitledUntil` must change
with it, or the rules will enforce yesterday's answer.

### The client must ask first

A rules denial is a bad way for a merchant to discover a lapsed
entitlement, so the UI checks the same thing before offering the action:

- `ProductFormModal` disables the photo picker and explains why.
- `useCloudDocuments()` gates the WhatsApp share button; Print and
  Download are untouched, because both run entirely in the browser.
- `documentSharing.js` maps a `permission-denied` into a sentence, for
  the stale-tab case the pre-checks cannot catch.

---

## 8. Renewal reminders

Stages, from `RENEWAL_REMINDER_DAYS`: **30, 14, 7, 3, 1** days before
expiry, plus `expired` when the paid period ends and `suspended` when the
grace window closes.

- **In-app**: `ServiceRenewalNotice` renders above every page, inside the
  scrolling region, in normal document flow. It is never a blocking
  modal, it can be dismissed, and a dismissal is scoped to one stage of
  one service period — so dismissing the 30-day notice is not dismissing
  the 3-day one.
- **Email**: `runRenewalReminders()`, on a daily Cloudflare cron
  (`wrangler.toml`), and manually at `POST /api/admin/licensing/reminders`
  with `{ dryRun: true }` to preview.

**A business is emailed at most once per stage per service period.** The
stage last sent and the period it belonged to are recorded on the
business document, so re-running the job sends nothing, and a renewal
clears them, which arms the next period's reminders. A failed delivery is
deliberately *not* recorded as sent, so the next run retries.

Every reminder leads with the licence being permanent. A renewal notice
that reads like a shutdown warning is a misleading one.

---

## 9. Offline and degradation behaviour

What a lifetime customer whose services have lapsed actually has:

```
Licence                    ACTIVE
Local application          AVAILABLE
Business records           KEPT, readable, still recordable
Licensed features          AVAILABLE
Cloud storage (new files)  SUSPENDED
Document publishing        SUSPENDED
Maintenance / updates      NOT AVAILABLE
Support                    NOT AVAILABLE
```

`localApplicationAvailable` is hard-coded `true` in the resolver and
nothing can make it false. It is the promise the whole model rests on.

The existing offline engine was not redesigned. Firestore's persistent
local cache, the mutation queue and `raceWithTimeout()` all behave
exactly as they did; the licensing layer adds no new sync path, no new
retry loop and no new failure mode to them.

---

## 10. Data preservation

**Nothing in this system deletes business data, ever.**

- An expiring service period deletes nothing.
- An administrative cloud suspension deletes nothing.
- A revoked licence deletes nothing.
- Product images in particular are never touched: the rules gate writes,
  not reads or deletes, and no scheduled job walks `productImages`.

Deletion happens only where it always did: an owner resetting their
business data, an account deletion, or a SUPER_ADMIN purge with a typed
confirmation phrase. Retention rules are stated in the Terms (§19.1) and
the Privacy Policy (§10.1) and match what the code does.

---

## 11. Existing customers

| Account state before | After this change |
|---|---|
| Free | Unchanged. No licensing record, fully hosted, never shown a renewal notice. |
| Pro monthly, active | Unchanged. `subscription` still drives it; `serviceStatus` is `not_applicable`; renewals extend by 30 days exactly as before. |
| Pro monthly, expired | Unchanged. Drops to free limits, stays hosted. |
| **Lifetime, bought before this model** | `serviceStatus: 'grandfathered'`. **Fully entitled, indefinitely.** Nothing expires, nothing is withheld, no reminder is sent. |

Grandfathering is the migration strategy, and it is deliberate: those
customers were never told about an annual fee, so nothing may lapse for
them by default. Bringing one onto the new model is an explicit,
audited administrative action:

```
POST /api/admin/businesses/:id/licensing
{ "action": "migrate", "months": 12, "reason": "..." }
```

which **grants a fresh service period from the migration date** rather
than back-dating one from the purchase date. `migrationPayload()` can
only ever add time; if a period already exists and runs longer, it is
kept. Migrating twice is refused rather than silently re-granting.

The admin directory and business detail both surface
`serviceStatus: 'grandfathered'` so these accounts can be found.

---

## 12. Payment verification

Unchanged in shape, extended in what it grants.

1. `/api/paystack/initialize` prices the plan **server-side** from
   `PLAN_PRICES`. The browser sends a plan name and nothing else; an
   `amountKes` in the body is ignored.
2. A pending `payments/{reference}` document is written **before** the
   reference is returned.
3. The webhook checks the HMAC signature, then **idempotency**, then
   re-verifies with Paystack directly and cross-checks the amount and
   currency against the pending record.
4. Only then is an entitlement written.

**Idempotency is the only thing standing between a redelivered webhook
and a double renewal.** A reference is minted once per checkout and its
document flips to `success` exactly once, so twelve months can be added
at most once per reference however many times Paystack sends the event.

Edge cases handled explicitly, each with a test:

- A Pro payment for a business that already holds a licence is recorded
  and does **not** demote the licence.
- A second lifetime payment is applied as a service extension rather
  than re-creating the licence, because re-creating it would recompute
  the period from today and could shorten one already extended.
- An `annual_services` payment for a business with no licence is recorded
  with `applied: false` and flagged for manual review. Nothing is
  granted; an entitlement is never invented.

---

## 13. Administrative controls

`POST /api/admin/businesses/:id/licensing`, each action behind its own
capability, each requiring a stated reason, each fully audited.

| Action | Capability | Roles | Effect |
|---|---|---|---|
| `suspend-cloud` / `restore-cloud` | `licensing.cloud` | ADMIN, SUPER_ADMIN | Hosted services off/on. Reversible. Licence untouched. |
| `set-service` | `licensing.service` | FINANCE, ADMIN, SUPER_ADMIN | Move the expiry or grace window. Capped at 60 months ahead. |
| `migrate` | `licensing.service` | FINANCE, ADMIN, SUPER_ADMIN | Bring a grandfathered licence onto the model. Adds time only. |
| `revoke-license` / `reinstate-license` | `licensing.revoke` | **SUPER_ADMIN only** | The only thing that can make `license.owned` false. |

Every audit entry records who, what, which business, when, the previous
licence / service / cloud status, the new ones, and the reason. An
auditor reading a suspension entry can see the licence did not move.

`handleAdminSubscriptionUpdate` (the old monthly plan control) now
**refuses** to act on a business that owns a licence, with a 409 pointing
at these controls. It only ever wrote `subscription`, so letting somebody
pick "free" for a licensed business would leave two records disagreeing
while the customer still, correctly, owned their software.

**Licence revocation is never automatic.** No timer, no expiry path and
no suspension can reach it. It exists for fraud, a reversed payment for
the licence itself, or a legal requirement.

---

## 14. Changing the commercial configuration

Every number is in `src/licensing/config.js`:

```javascript
LIFETIME_LICENSE_PRICE_KES   // 15550
ANNUAL_SERVICE_PRICE_KES     // 3000
INCLUDED_SERVICE_MONTHS      // 12
RENEWAL_SERVICE_MONTHS       // 12
GRACE_PERIOD_DAYS            // 30
RENEWAL_REMINDER_DAYS        // [30, 14, 7, 3, 1]
```

Change one, and the landing page, the checkout, the Worker's pricing
table, `/api/pricing`, the settings panel, the renewal banner and the
reminder emails all change with it. Two tests keep it that way:
`src/licensing/architecture.test.js` and
`cloudflare-worker/test/licensingPricing.test.js` fail if a price is
written down anywhere else.

A price change never retroactively alters a period already purchased, and
never alters the perpetual nature of a licence already granted. Existing
businesses keep their stored `graceDays`.

### Changing the legal documents

Bump `src/legal/documentVersions.js` in the same commit as the text. A
material change bumps the major number and moves the effective date; a
clarification bumps the minor and leaves the date alone. Both documents
render a "what changed" summary at the top.

There is deliberately **no** silent re-acceptance mechanism. Whether
existing users need to be notified of a change is a business decision,
and the code does not pretend to have made it.

---

## 15. Tests

| What | Where |
|---|---|
| Entitlement model, dates, renewal arithmetic, totality | `src/licensing/entitlements.test.js` |
| Pure-module boundary, no scattered prices, no hand-rolled expiry checks | `src/licensing/architecture.test.js` |
| Legal links reachable, no misleading copy, disclosure before purchase | `src/legal/legalLinks.test.js` |
| Purchase, renewal, idempotency, admin actions, audit, authorisation | `cloudflare-worker/test/licensingLifecycle.test.js` |
| Reminder staging, one-per-stage, email copy | `cloudflare-worker/test/licensingReminders.test.js` |
| Server-side pricing, checkout guards | `cloudflare-worker/test/licensingPricing.test.js` |
| Enforcement, data preservation, billing history | `test/rules/firestoreRules.test.mjs` |

```bash
npm test          # browser modules + worker, no emulator needed
npm run test:rules  # firestore.rules against the emulator (needs Java)
```
