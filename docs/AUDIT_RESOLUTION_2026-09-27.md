# Audit resolution — 2026-09-27

Response to the external "Froogies POS Comprehensive Audit" (34 findings,
run against commit 17a47b3). Every claim below is backed by a test that
runs; the test is named so it can be re-run rather than trusted.

Verification at the time of writing:

| Suite | Result |
|---|---|
| `node --test 'src/**/*.test.js'` | 837 / 837 |
| `npm --prefix cloudflare-worker test` | 353 / 353 |
| Firestore rules suite (`test/rules`, real emulator) | 85 / 85 |
| `npm run lint` | 0 errors (49 pre-existing warnings) |
| `vite build` | clean |
| SDK end-to-end against the emulator (real `writeBatch`, `increment`, `serverTimestamp`, as a cashier) | sale, return, repayment accepted; direct stock write, stale return, stale repayment refused |

## DEPLOYMENT ORDER — read before deploying

The rules now require fields that only the new client writes
(`lastMovement`, `revision`, `returnCount`, `lastRefundId`,
`lastRepaymentId`, `paymentRevision`, `stockCountRevision`). An older
client — a PWA that has not refreshed, or an Android build made before
this change — will have cashier sales, returns, repayments, counts and
supplier payments **refused** by the new rules.

1. Deploy the web app and ship the Android build first. The new client
   works under the old rules (the old rules are strictly more permissive).
2. Wait for installed PWAs and the Android app to update.
3. Then deploy `firestore.rules`.
4. Deploy the Worker (H19) at any time.

## Findings

### Critical

**C01 — staff could forge stock and financial records.** Fixed in
`firestore.rules`. A non-owner stock change must arrive in the same commit
as the document that caused it (`lastMovement: { kind, id }`, stamped by
`utils/stockWrites.js`, verified with `existsAfter` and "did not exist
before"), in the right direction (a sale can only lower stock, a return or
delivery only raise it), and only a delivery or production run may reprice.
A credit sale can only be paid down by exactly the repayment written beside
it; `debtors.collect` no longer permits editing totals, cost or balances.
Sales are born unvoided, unreturned, sold by the writer. Refunds must be of
a sale or credit sale stamped in the same commit. Tests: the "Business
transitions" block of `test/rules/firestoreRules.test.mjs`.

**C02 — concurrent commands duplicated accounting.** Fixed for every
document two devices race on, by revision checks the rules enforce:
repayments (`creditSales.revision`), returns (`sales.returnCount`), ticket
saves (`orders.revision` when `items` changes), charging a ticket (only
while `status == 'open'`), stock counts (`products.stockCountRevision`),
supplier payments (`suppliers.paymentRevision`). The second writer is
refused and told why. **Not fixable by rules:** two devices selling the last
unit at the same moment still both succeed and stock goes negative — the app
is offline-first and cannot reserve stock without a server.

### High

| ID | Status | Where |
|---|---|---|
| H01 negotiated-price over-refund | Fixed. Lines carry `netLineTotal` (their share of what was collected); returns refund that. Older sales are allocated the same way on the fly. Sale also records `discountAmount`/`priceAdjustment`, printed on receipts. | `lineItems.allocateSaleTotal`, `returns.paidLineTotals` |
| H02 void after return | Fixed in the UI and in the rules (a void needs `returnCount == 0`, and happens once). | `Counter.handleVoid`, `saleVoidOk` |
| H03 recipe reversals | Fixed. Each line records `componentUsage`; reversals restore exactly that, and the ingredient filter is gone. | `inventory.componentUsage`, `resolveReversalDeltas` |
| H04 live tickets bypass the ticket engine | **Partly.** Fixed: stale ticket saves are refused instead of dropping items; adding items to a ready ticket sends it back to the kitchen; station/routing is carried on lines; the configured service charge is applied; food businesses check out through `TicketCheckoutModal` (split tenders, bill breakdown). **Not done:** the counter still uses the whole-ticket `items` model rather than per-line `orderLines`, and courses are not wired into the counter. | `Counter.handleSaveOrder`, `buildSaleLines` |
| H05 bakery yield/expiry disconnected | Fixed. Production uses `planProduction`: consumes the plan, costs over actual output, records zero-output runs as waste, creates a dated lot for items with a shelf life. Batch size and shelf life are now editable on the recipe. Bakery defaults gained `orders`, `batches`, `expiryAlerts` as `docs/INDUSTRY.md` specifies. | `pages/Production.jsx` |
| H06 missing/nested components | Fixed. `recipeProblem` refuses missing, circular and too-deep recipes at the till and in production; sub-recipes are consumed to their ingredients and costed from them. | `inventory.recipeProblem`, `production.productionDeltas` |
| H07 restaurant/café without units | Fixed: `units` on by default. | `industry/profiles.js` |
| H08 modifier recipes lost on edit | Fixed. Editing the options line keeps each choice's id and ingredients; a per-choice ingredient editor exists when recipes are on. | `ModifierEditor.jsx`, `modifiers.normalizeModifierGroups` |
| H09 waste missing from profit | Fixed. The financial hook subscribes to waste. | `hooks/useFinancials.js` |
| H10 waste skips sub-ledgers | Fixed. A product with versions or batches must name which; costed at the batch's cost. | `waste.wasteSubledgerProblem` |
| H11 FEFO reuse across lines | Fixed: one pool per checkout. | `batches.allocateFefoAcrossLines` |
| H12 returns restore first batch | Fixed: returns slice allocations in dispensing order. | `returns.buildReturn` |
| H13 valuation vs batch cost | Fixed: purchases and production keep a weighted-average cost; the dashboard values batches at batch cost. InventoryIntelligence still uses the (now averaged) parent cost. | `inventory.inventoryValue`, `weightedAverageCost` |
| H14 product edit overwrites versions | Fixed: edits write `increment(0)` per version; adding versions over unassigned stock is refused. | `utils/products.updateProduct` |
| H15 pending treated as done | Fixed: every pending write reports a later refusal through one persistent toast with a label. | `offlineWrite.setLateRejectionHandler` |
| H16 unstable close / mixed dates | Fixed: closed days show the figures recorded at close plus a note of what arrived since; session id and report range share one business day; credit sales and repayments use device time like cash sales. Late offline writes still land in their real day (money that changed hands is not rejected). | `CloseDay.jsx`, `useDailySession.js` |
| H17 restore leaves old ids | Fixed: recipes, modifier recipes, batch allocations, recorded usage, order lines, shared documents, movements. | `utils/importRemap.js` |
| H18 cross-tenant rule gaps | Fixed: barcode index updates require the existing owner and cannot move a live claim; settings creation requires the business's founder or owner. | `firestore.rules` |
| H19 unverified email → SUPER_ADMIN | Fixed: env-email bootstrap requires `email_verified`. | `cloudflare-worker/src/lib/adminAuth.js` |
| H20 description-based expense exclusion | Fixed: category only, and the rules stop ordinary expenses using the reserved categories. | `financials.isExpenseExcluded` |
| H21 reports ignore returns | Fixed for product tables and the analytics trend. Staff performance still shows gross sales activity. | `utils/productPerformance.js` |

### Medium and low

| ID | Status |
|---|---|
| M01 permissions insufficient | Fixed: receiving may reprice, returns may stamp the sale, production may create its lot and loss record, supplier payments write their mirror. |
| M02 split repayment commits | Fixed: each batch carries its own receipt part, so any subset that lands is self-consistent. |
| M03 partial snapshots | Fixed: nothing is reported until every source for the current range has answered. |
| M04 recipe rounding | Fixed: ingredients are consumed to 3 decimals whatever their unit; the editor notes fractional whole-unit ingredients. |
| M05 fractional expiry | Fixed. |
| M06 expiry calendar | Already fixed by 5f5a266; now pinned by a test. |
| M07 alternate sale paths | Fixed: dashboard refuses ingredients, costs dishes from recipes, checks ingredients; counter quantity edits respect made-to-order items. |
| M08 barcode identity | Fixed: internal codes derive from the document id; ambiguous scans are refused; the rules stop a claimed barcode moving to another product. |
| M09 blank quantity checkout | Fixed. |
| L01 cumulative rounding | Fixed: refunds are cumulative. |
| L02 failing tests | The failures were already fixed by later commits. New wiring assertions check that the engines above are *called*, and each was verified to fail when its call is removed. |

## Also fixed (not in the audit)

- Demo mode stored dotted update paths as literal keys, so a sale never
  moved a version's quantity in demo.
- A return of a batched line partly sold without batch cover reversed zero
  cost for the uncovered units.
- Creating a customer at a credit checkout, and opening the counter, both
  hung offline (awaited server acknowledgement).
- Suppliers paid more than owed vanished from the list; they now show as
  paid ahead.

## Known remaining design risks

- Overselling under true concurrency (see C02).
- Changing a product's unit does not convert its stock.
- Batch + version combinations are not modelled by the stock take.
- Unknown expiry dates are sellable (sorted last), by design.
- A restore is authorised by an owner-only `restoredAt` marker; an owner
  can therefore write arbitrary history, which is consistent with the
  owner being the books.
