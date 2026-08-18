# FlowBiz — Multi-Product Cart Implementation Report

## 1. Audit summary (before changes)

- Counter's "sell" flow was one-product-at-a-time: tapping a `ProductGrid` card or
  a barcode scan opened `SaleModal` directly, and each confirm wrote ONE
  `sales`/`creditSales` document holding a single `productId/productName/
  quantity/costPricePerUnit/soldPricePerUnit/totalAmount/profit`.
- `Dashboard.jsx` has its **own separate** single-product scan-to-sell flow
  (own `SaleModal` usage, own `handleConfirmSale`/`handleConfirmCredit`).
  This was intentionally left untouched — the spec scopes this work to the
  Counter page, and Dashboard has no product grid or cart UI to extend.
- Every consumer of a sale doc — `financials.js` (COGS calc), Dashboard's
  activity feed, Counter's own sales log, Reports/AdvancedAnalytics
  per-product rankings, InventoryIntelligence velocity, receipts (PDF +
  WhatsApp text), the public Cloudflare Worker receipt page, and
  refund/void logic — assumed exactly one product per sale doc.
- Stock deduction already used `writeBatch + increment()` (no
  `runTransaction`) — an existing, deliberate offline-first trade-off
  (see README "CR-8"). Same trade-off is preserved here (see §5).

## 2. Data model change

`sales` and `creditSales` docs now optionally carry an `items[]` array:

```
items: [{ productId, productName, quantity, unitPrice, costPrice,
           lineTotal, lineCost, lineProfit, barcode }]
```

Every doc still carries the same **aggregate** top-level fields it always
did — `productName` (a summary, e.g. `"Book +2 more"`), `quantity` (sum of
all line quantities), `totalAmount`, `paymentMethod`, `soldAt`, etc. — plus
two new aggregate fields: `costOfGoodsSold` and (for cash/M-Pesa sales)
`profit`. A single-product cart checkout also still writes legacy
`costPricePerUnit`/`soldPricePerUnit` for maximum compatibility.

This is why almost nothing else in the app needed to change: Dashboard's
activity feed, Counter's own sales log, `useFinancials`'s date-range
queries, and Close Day all only ever read the aggregate fields, which are
still populated correctly for a multi-item sale. Only code that attributes
activity **per product** (receipts, product-performance rankings, refund
stock restoration) needed to branch on `items[]`.

## 3. Files changed

| File | Change |
|---|---|
| `src/pages/Counter.jsx` | Rewritten: client-side cart state, add/scan-to-cart, quantity/price editing, stock validation, `handleCartSale`/`handleCartCredit` (one batched write per checkout, one stock decrement per line item), void updated for multi-item stock restoration. Removed the "+ Quick add product" toolbar shortcut (Counter is now selling-only, per spec §2); the scan-not-found → create-product fallback is kept and now auto-adds the new product to the cart. |
| `src/components/pos/CartList.jsx` | **New.** Cart UI: qty +/-, editable unit price, remove, running total, Sell button. |
| `src/components/pos/CartCheckoutModal.jsx` | **New.** Payment method (Cash/M-Pesa/Credit) + customer selection, applied once to the whole cart — same fields `SaleModal` already had, now cart-scoped. |
| `src/components/pos/SaleCompleteModal.jsx` | Shows an itemized breakdown when `sale.items` has more than one line; single-product sales (Dashboard's flow) render exactly as before. |
| `src/utils/currency.js` | Added `roundMoney()` — rounds cart line/aggregate totals to avoid float drift. |
| `src/utils/financials.js` | `getCostOfSale()` now prefers a stored `costOfGoodsSold` field (multi-item), falling back to `costPricePerUnit × quantity` for legacy docs. |
| `src/utils/whatsapp.js` | `buildReceiptMessage()` accepts an optional `items[]` and lists every product; unchanged for single-product callers. |
| `src/utils/documentService.js` | `buildDocument()` (PDF/print receipt+invoice) renders one row per item, with the page height now scaling with item count instead of a fixed 200mm. |
| `src/pages/Reports.jsx`, `src/pages/AdvancedAnalytics.jsx` | `productPerf` now flattens `items[]` into per-product qty/revenue/profit so best-seller/most-profitable rankings attribute correctly instead of lumping a whole cart under one summary name. |
| `src/pages/InventoryIntelligence.jsx` | `velocityData` (drives ABC classification, reorder priority, slow-moving detection) flattens `items[]` the same way. |
| `src/pages/CustomerDetail.jsx` | `handleCancel`/`handleRefund` restore stock for every item in a cancelled/refunded multi-product credit sale. |
| `cloudflare-worker/src/routes/publicDocument.js` | The public `/r/:token` receipt page (opened from a WhatsApp share link) now renders itemized rows and its "Download PDF" button uses a dynamic page height, mirroring the authenticated app's own PDF generator. |
| `src/utils/financials.test.js` | Added 3 tests for the new `costOfGoodsSold` aggregate field (cash sale, legacy fallback, partial credit repayment). |

## 4. Verified against the spec's own worked example

Book ×3 @500 (cost 300) + Storybook ×2 @350 (cost 200) + Pen ×1 @50 (cost 20)
→ cart math produces **Total: KSh 2,250.00**, matching the spec exactly
(`totalCost=1320`, `profit=930`). Confirmed by running the actual cart
line-item code, not by hand-calculation — see the transcript above.

All 11 `financials.test.js` tests pass, including the 3 new ones.

## 5. What was preserved unchanged (by design)

- Payment logic (Cash/M-Pesa/Credit), the hybrid cash-flow-first credit
  accounting model, debt repayment allocation across multiple open credit
  sales, Close Day, offline-write pattern (`writeBatch` + `increment()`,
  no `runTransaction`) — all untouched.
- Dashboard's own single-product quick-scan sale flow, and `SaleModal.jsx`
  itself (still used by Dashboard) — untouched.
- Multi-tenant isolation: every new/changed write still goes through
  `withBusiness()`; no Firestore rule changes were needed (`sales`/
  `creditSales` rules only check `businessId` ownership, not document
  shape).

## 6. Known pre-existing limitation (not introduced, not fixed)

Stock validation is **client-side only** — the app has no Cloud Functions
tier (per prior notes on this project) and the existing single-product
flow already relied on `increment()` without a transactional server-side
check. A cart checkout re-validates against the live `products` snapshot
immediately before submitting, which is the same level of protection the
single-product flow had. Two cashiers finishing checkout on the same
low-stock item within the same instant could still both succeed (stock
can go negative) — this was true before this change and remains true
after it. A real fix needs either Cloud Functions (not available on this
project's plan) or `runTransaction` per product (which the app has
deliberately avoided everywhere for offline-first reasons — see the
CR-8 note in the README). Flagging this rather than silently leaving it.

## 7. Discovered but out of scope

- `src/pages/CustomerDetail.jsx`'s credit-purchase list row (`{cs.quantity}
  × {cs.productName}`) will now show something like `"6 × Book +2 more"`
  for a multi-item credit sale — functionally fine (uses the aggregate
  fields) but not itemized in that list view. Didn't expand it further to
  avoid an unrelated UI change to that page beyond the refund/cancel fix
  that was actually required.
- No migration is required for existing data: old single-product
  `sales`/`creditSales` docs have no `items` field, and every piece of
  code that now branches on `items[]` falls back to the original
  single-product fields when it's absent.

## 8. Testing performed

- Syntax-verified every changed/new file with esbuild (all pass).
- Ran the full `financials.test.js` suite (11/11 pass).
- Manually traced the spec's own Test 3 numbers through the actual cart
  line-item code (§4).
- Full manual QA against a live Firebase project (Tests 1–16 in the
  spec) was **not** run in this environment — there's no Firestore
  connection available here. Recommend running through the spec's own
  Test 1–16 checklist once this is merged into the real project,
  particularly Test 15 (offline) and Test 16 (tenant isolation), since
  those depend on real network/auth conditions this sandbox can't
  reproduce.
