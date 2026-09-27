# Billing: prices, providers and entitlements

How FlowBiz takes money on the web and on Android, and why every provider
ends in the same place. Read with `docs/LICENSING.md`, which defines what
each plan *is*.

Written September 2026.

---

## 1. Three separate questions

| Question | Answered by |
|---|---|
| **What is shown?** (the price) | `PRICE_BOOKS` in `src/licensing/config.js` |
| **Who takes the money?** (the provider) | `billingProvidersFor()` in `src/billing/catalog.js` |
| **What does it buy?** (the entitlement) | `resolveEntitlements()` in `src/licensing/entitlements.js` |

No component decides any of these. A button calls
`useLicensingCheckout().startCheckout(plan)` with a plan name, and nothing
else.

## 2. Price books

| Book | Who | Currency | Pro (30 days) | Lifetime licence | Annual services |
|---|---|---|---|---|---|
| `KE` | businesses registered in Kenya, and every business with no stored region | KES | 599 | 15,550 | 3,000 |
| `INTL` | every other country | USD | 4.99 | 119 | 24 |

- These are **explicit prices, never FX conversions.** Nothing fetches an
  exchange rate. The USD figures are rounded from the Kenyan positioning
  and are a commercial decision to revisit in one place.
- **The Worker chooses the book** from `businessSettings.region.country`
  (`chargeForBusiness()` in `cloudflare-worker/src/lib/purchaseGuard.js`).
  The browser sends a plan name; a body claiming another price or currency
  is ignored (tested).
- `GET /api/pricing?region=INTL` (or `?country=US`) is a *display* answer.
  With no parameter it returns the Kenyan book in its original shape.
- Signed-out visitors (landing page) see the book guessed from the device
  timezone — display only.

## 3. Providers

| Platform | Region | Provider |
|---|---|---|
| Web / PWA | Kenya | M-Pesa STK push (Paystack), card as alternative |
| Web / PWA | elsewhere | Paystack card checkout |
| **Android app** | any | **Google Play Billing** (only) |
| iOS | — | none yet (`billingProvidersFor` returns null; UI says purchases unavailable) |

Inside the Android app **only Google Play Billing** is offered. Play policy
requires it for in-app purchases of digital features; showing a Paystack
card form in the Play build risks removal.

## 4. One settlement path

Every provider verifies its payment with the provider, then calls
`applyVerifiedPayment()` in `cloudflare-worker/src/lib/paymentSettlement.js`:

- exactly-once via the `paymentSettlements/{reference}` claim document;
- extends Pro by 30 days from the current expiry, creates the perpetual
  licence plus 12 months of services, or extends services by 12 months;
- never lets a Pro payment touch a licence;
- writes a common **billing summary** on the business:

```
businesses/{id}.billing = { provider, platform, productId, plan, reference, updatedAt }
```

`billing` is protected in `firestore.rules` exactly like `subscription`
and `licensing` (not client-writable, and not settable at creation).

Payment records (`payments/{reference}`) now always carry `amount`,
`currency`, `provider` and `billingPlatform`. `amountKes` is set **only**
on KES payments, because every older reader assumes shillings. The
settlement cross-check compares the provider's amount and currency with
the record written at initialisation; records written before this change
(only `amountKes`) are treated as KES.

### The resulting entitlement model

| Concept | Where |
|---|---|
| plan | `subscription.plan` (mirror) / `licensing.licenseType` |
| subscriptionStatus / expiresAt | `subscription.status`, `subscription.expiresAt` (Pro); `licensing.serviceExpiryDate` (services) |
| billingProvider / billingPlatform / productId / purchase reference | `billing.*` |
| renewal state | derived: `resolveEntitlements().service.status` (`active`/`grace`/`expired`/…) |

Existing subscribers are untouched: no field they rely on changed.

## 5. Google Play Billing

### Products (create these in Play Console → Monetize → In-app products)

| Product ID | Type | Plan |
|---|---|---|
| `flowbiz_pro_30_days` | one-time, **consumable** | `pro` |
| `flowbiz_lifetime_licence` | one-time, **non-consumable** | `lifetime` |
| `flowbiz_annual_services_12_months` | one-time, **consumable** | `annual_services` |

One-time products, not Play subscriptions, on purpose: they keep the
prepaid model identical on every platform (each purchase extends by 30
days / 12 months from the existing expiry). Moving Android to auto-renewing
subscriptions would give one plan two lifecycles. Set Play prices to match
the price books as closely as Play's price tiers allow; the app displays
Play's own localised price.

### Flow

1. The app opens Play's purchase sheet (`FlowBizBilling.purchase`), tagging
   the purchase with `obfuscatedAccountId = SHA-256("flowbiz:" + businessId)`.
2. The app sends the purchase token to `POST /api/billing/google-play/verify`.
3. The Worker calls the Play Developer API
   (`purchases.products.get`), requires `purchaseState = PURCHASED` and a
   matching account tag (so a token cannot be replayed onto another
   business), stores a hashed reference (never the raw token), applies the
   entitlement through `applyVerifiedPayment()`, and acknowledges it.
4. The app consumes a Pro/services pass only after the Worker confirmed it.
5. "Restore purchases" (Pro screen, Android only) re-submits everything
   Play still holds.

Refunds and chargebacks arrive as Real-time Developer Notifications at
`POST /api/billing/google-play/rtdn?token=…`. The payment is flagged
`voided` and an error-level ops event is raised for review. **Nothing is
revoked automatically** — licence revocation is an audited admin action.

### What you must configure (not in the repo)

1. Play Console: create the three products above and activate them.
2. Google Cloud: a service account; in Play Console → Users and
   permissions, invite it with "View financial data" and "Manage orders
   and subscriptions".
3. Worker secrets:
   ```
   wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT_JSON   # the key JSON
   wrangler secret put GOOGLE_PLAY_RTDN_TOKEN             # long random string
   ```
   `GOOGLE_PLAY_PACKAGE_NAME` is already in `wrangler.toml`.
4. RTDN: a Pub/Sub topic, granted to
   `google-play-developer-notifications@system.gserviceaccount.com`, with a
   **push** subscription to
   `https://<worker>/api/billing/google-play/rtdn?token=<GOOGLE_PLAY_RTDN_TOKEN>`;
   set the topic in Play Console → Monetization setup.
5. Test with license testers before release.

Until 1–3 are done, `/verify` answers 503 and the app shows "Google Play
purchases are not available yet." Nothing else is affected.

## 6. Paystack for international (web)

`PAYSTACK_CURRENCIES` in `wrangler.toml` lists what the Paystack account
accepts (default `KES`). **Add `USD` only after Paystack has enabled USD on
the account.** Until then an international web checkout is refused with
"Online payment in USD is not available yet" instead of failing inside
Paystack. M-Pesa is refused for non-Kenyan businesses.

## 7. Secrets

No payment secret is in the app bundle, web or Android. Paystack's secret
key, the Play service account and the RTDN token are Worker secrets; the
client holds no payment key at all (Paystack's popup is resumed from an
access code the Worker returns).
