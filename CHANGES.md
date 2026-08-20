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

## 3. Files changed (round 1 — cart feature)

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
line-item code, not by hand-calculation.

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

Stock validation is **client-side only** — the existing single-product
flow already relied on `increment()` without a transactional server-side
check. A cart checkout re-validates against the live `products` snapshot
immediately before submitting, which is the same level of protection the
single-product flow had. Two cashiers finishing checkout on the same
low-stock item within the same instant could still both succeed (stock
can go negative) — this was true before this change and remains true
after it.

## 7. Discovered but out of scope

- `src/pages/CustomerDetail.jsx`'s credit-purchase list row (`{cs.quantity}
  × {cs.productName}`) will now show something like `"6 × Book +2 more"`
  for a multi-item credit sale — functionally fine (uses the aggregate
  fields) but not itemized in that list view.
- No migration is required for existing data: old single-product
  `sales`/`creditSales` docs have no `items` field, and every piece of
  code that now branches on `items[]` falls back to the original
  single-product fields when it's absent.

## 8. Testing performed (round 1)

- Syntax-verified every changed/new file with esbuild (all pass).
- Ran the full `financials.test.js` suite (11/11 pass).
- Manually traced the spec's own Test 3 numbers through the actual cart
  line-item code (§4).
- Full manual QA against a live Firebase project (Tests 1–16 in the
  original spec) was **not** run in this environment — there's no
  Firestore connection available here. Recommend running through that
  Test 1–16 checklist once merged, particularly offline behavior and
  tenant isolation, since those depend on real network/auth conditions.

## 9. Follow-up fixes (round 2)

### Cart placement / feedback

- `CartList` is now rendered **above** the search bar and product grid,
  wrapped in a `sticky top-2 z-20` container — it stays pinned near the
  top of the visible area as you scroll a long product list, instead of
  sitting below potentially dozens of products.
- The cart header (product count + total + **Sell** button) is **always
  visible**, even collapsed — only the per-line qty/price editor
  collapses via a chevron toggle, so it stays out of the way while
  browsing but a sale can be completed with zero scrolling.
- `ProductGrid` now accepts an optional `cartQuantities` map and shows a
  small green "🛒 N" badge + highlighted border on any product card
  already in the cart — a persistent visual confirmation that a
  tap/scan registered, instead of relying only on the toast that
  disappears after ~1.2s. `Products.jsx`, which doesn't pass this prop,
  is unaffected.

### Supplier not appearing after being added

Root cause (found by reading the code, not guessed): `handleSupplierSave`
across **four** pages (`Purchases.jsx`, `Products.jsx`, `Dashboard.jsx`,
and the new cart-based `Counter.jsx`) showed an error toast and then
`return`ed on failure instead of throwing. `SupplierFormModal`'s own
`try/catch` only reset its "Saving…" button inside the `catch` block —
so on any failed save, that `catch` never fired, and the button (and the
whole form) stayed frozen on "Saving…" with no visible way to retry. The
toast still fired, but if it wasn't seen right away it looked exactly
like "I added a supplier and nothing happened."

Separately and specifically on **Purchases.jsx**: creating a supplier via
"+ Add new supplier" *did* get written to Firestore and *would* appear in
the dropdown's option list (live, via the existing realtime listener) —
but nothing ever pre-selected it in the purchase form's own
`form.supplierId`, unlike `ProductFormModal`'s identical "+ Add new
supplier" flow, which already had this wiring for its own supplier
field. So a newly created supplier was there, just not selected — easy to
mistake for "not there" without reopening the dropdown.

Fixed:
- `handleSupplierSave` now `throw`s after showing its error toast (in
  all four pages), so `SupplierFormModal` can properly reset via
  `finally` and the form stays open and usable for retry.
- `SupplierFormModal.jsx` now resets `busy` in a `finally` block instead
  of only in `catch`, so it can never get permanently stuck regardless
  of exactly how a caller reports failure.
- `Purchases.jsx` now has the same `useEffect(() => { if (newSupplierId)
  setForm(p => ({ ...p, supplierId: newSupplierId })); }, [newSupplierId])`
  wiring `ProductFormModal.jsx` already had — a newly created supplier is
  now pre-selected in the purchase form immediately.

### Files touched in round 2

| File | Change |
|---|---|
| `src/pages/Counter.jsx` | Cart moved above search/grid, wrapped in sticky container; `cartQuantities` computed and passed to `ProductGrid`; `handleSupplierSave` throws on error. |
| `src/components/pos/CartList.jsx` | Collapsible per-line editor; header (count/total/Sell) always visible. |
| `src/components/pos/ProductGrid.jsx` | New optional `cartQuantities` prop → in-cart badge + highlight. |
| `src/components/suppliers/SupplierFormModal.jsx` | `busy` reset moved to `finally`. |
| `src/pages/Purchases.jsx` | Added `newSupplierId` → `form.supplierId` auto-select `useEffect`; `handleSupplierSave` throws on error. |
| `src/pages/Products.jsx` | `handleSupplierSave` throws on error (consistency fix). |
| `src/pages/Dashboard.jsx` | `handleSupplierSave` throws on error (consistency fix). |
