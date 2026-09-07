# FlowBiz Food & Beverage — architecture and implementation report

**Scope.** Restaurant, Café, Fast food / QSR, Bakery, Bar / Pub — and the
sixth F&B-adjacent profile, Wines & spirits *retail*, which is explicitly
**not** a bar and was left as retail (§7).

**Companion documents.** `docs/ARCHITECTURE.md` is the design record for
the F&B engine itself. `docs/NON_FOOD_AUDIT.md` is the non-food audit this
work was forbidden to disturb. This report covers the *domain correction*
layered on top of that engine, and the testing programme the earlier work
was instructed to skip.

**Status.** 554 unit tests + 210 Worker tests + 38 Firestore-rules tests,
all green. Clean production build. No new ESLint error. Verified live in a
browser against the Firebase emulator suite across all five verticals plus
a hardware control business.

---

## 1. Current F&B architecture (as found)

A three-layer tree, and it held:

```
src/utils/       platform core     — money, stock, tenders, batches, FEFO
src/industry/    capability config — profiles, capabilities, units, permissions
src/domain/fnb/  the F&B engine    — ticket, lines, check, costing, stations,
                                     production, waste
```

`src/domain/architecture.test.js` enforces the direction: `domain/fnb` may
import from `utils/` and `industry/`; `utils/` may **never** import from
`domain/fnb`. It also greps the tree for `profileId === '…'` and fails the
build if a screen asks *which industry am I* instead of *is this capability
on*. Both assertions still pass after this work.

What was already right, and was kept:

- **`orderLines` — one Firestore document per ticket line**, append-only,
  with the header's `totalAmount` maintained by commutative `increment()`.
  This is the multi-device design and everything else rests on it.
- **Item-level fulfillment** (new → sent → ready → served, forward-only),
  per-item station routing snapshotted at ring time, courses, expeditor.
- **Recipes** with yield, short-yield costing, sub-recipes to depth 3,
  `producedInAdvance`, shelf-life batches feeding the existing FEFO
  allocator.
- **Check arithmetic**: gross − discount = net sales; service charge on
  net; `totalAmount` as the compatibility contract.
- **Split tenders** in `utils/tenders.js` — deliberately platform core.

## 2. Problems discovered

Four material defects and a cluster of domain gaps. Ordered by damage.

1. **An ingredient was automatically a sellable product.** One `products`
   collection, every row sellable by construction. A restaurant that
   modelled its food properly put tomatoes, flour and chicken breast into
   the catalogue — and every one of them then appeared on the till grid
   between "Chicken burger" and "Coke". Worse, the add form *demanded* a
   selling price above zero, so the owner invented one, and the invented
   number flowed into menu performance, margin, and every report that
   ranks what sells. This is the brief's §5/§21 and it was real.

2. **Every sale was costed at the stored `costPrice`.** For a dish
   assembled to order that number is meaningless — `menuItemMargin()`
   already said so and computed from the recipe — but the *sale path* rang
   COGS up at whatever was in the box. So the recipe engine produced a
   correct theoretical cost that the ledger then ignored.

3. **Made-to-order dishes could not be sold at all.** `ProductGrid`
   disabled any tile with `stock <= 0`. A made-to-order dish has no stock
   of its own by design — its stock is permanently 0. Every restaurant
   tile was greyed out. This is a blocking, ship-stopping bug.

4. **Fractional piece-unit ingredients deducted nothing.** 0.25 lime per
   G&T deducted 0, because `roundQuantity(0.25, 'piece')` truncates. The
   same class as the already-fixed `tot` bug, but in the general case: any
   recipe consuming a fraction of a zero-decimal unit silently consumed
   nothing.

Plus: modifiers changed price but never recipe or stock; a `routable:
false` item still appeared on the KDS; a table ticket defaulted to
takeaway; raw dining-mode ids rendered in the UI; same-minute counter
order names collided.

## 3. Research findings

Three reference models were read against FlowBiz's constraints.

- **Square** versions the whole order and rejects a stale write. Correct
  when a server is in the path. FlowBiz has **no server in the sale path**
  — the client writes Firestore directly and must work offline — and a
  Firestore transaction cannot run offline. Rejected.
- **Toast** models fulfillment **per item**, not per ticket, because a
  kitchen finishes a starter while a main is still on. Adopted; already
  present.
- **Lightspeed / Revel** separate *ingredient* from *menu item* as
  distinct catalogue entities. Adopted in substance — see §5 for why the
  implementation is a role rather than a second collection.

## 4. Architectural decisions

**D1 — Sellability is a role on the row, not a second collection.**
`catalogRole ∈ {sellable, ingredient, both}`, absent meaning `sellable`.

**D2 — A prep item is not a fourth entity.** It falls out of the model:
ingredient + recipe. Mise-en-place that is cooked and then consumed by
other recipes is exactly "an ingredient you make yourself".

**D3 — Cost at the point of sale is computed, not stored,** for
made-to-order items. Made-in-advance items keep their stored cost, because
a production run wrote it and it is the actual cost of the actual batch.

**D4 — What is SOLD and what is USED round differently.** Sales round to
the unit's own precision (unchanged, and the retail contract). Recipe
consumption rounds to three decimals.

**D5 — A modifier is a recipe delta.** Signed component adjustments, so
"oat milk" is −1 dairy +1 oat, and both cost and stock follow.

## 5. Alternatives considered and rejected

| Considered | Rejected because |
|---|---|
| A separate `ingredients` collection | Purchases, receiving, stock movements, stock takes, batches, expiry, waste, valuation, FEFO, export, import and reset are **identically correct** for a tomato and a Coke, and all are tested. A second collection forks all of it to express one boolean. |
| A separate `menuItems` collection | Same, mirrored. And it would need a join to inventory on every till render. |
| A boolean `isIngredient` | Cannot express *both* — the bakery selling loose flour and baking with it, the bar selling a bottle whole and pouring it by the glass. That case is real and common. |
| A `PrepItem` entity | Nothing distinguishes it from "ingredient with a recipe". Adding it would create two ways to model the same stock. |
| Optimistic concurrency on the ticket (Square) | Fails offline. |
| Rounding `costOfGoodsSold` on the header | Requires read-before-write, destroying the commutative-increment property the entire multi-device design rests on. See §29. |
| Migrating existing rows to carry `catalogRole: 'sellable'` | Unnecessary and risky. Absent already means sellable, so **not one existing document in any industry changes.** |

## 6. Final F&B architecture

```
                    ┌─────────────────────────────────────┐
   products ───────►│ catalog.js   role: sellable |        │
   (one collection) │              ingredient | both       │
                    └───────┬──────────────┬───────────────┘
                            │              │
              sellableProducts()    ingredientProducts()
                            │              │
                   ┌────────▼───┐   ┌──────▼──────────────┐
                   │ till grid  │   │ recipe component    │
                   │ categories │   │ picker, purchasing, │
                   │ scan, cats │   │ stock take, waste   │
                   └────────┬───┘   └─────────────────────┘
                            │
                   ┌────────▼────────────────────────────┐
                   │ lines.js  buildTicketLine()          │
                   │  · kitchenName snapshot              │
                   │  · station snapshot                  │
                   │  · routed snapshot                   │
                   │  · unitCost = sellingUnitCost()      │
                   └────────┬─────────────────────┬───────┘
                            │                     │
              ┌─────────────▼──────┐   ┌──────────▼─────────┐
              │ costing.js         │   │ inventory.js       │
              │  recipeUnitCost    │   │  resolveStockDeltas│
              │  modifierUnitCost  │   │  + recipe expansion│
              │  sellingUnitCost   │   │  + modifier deltas │
              └────────────────────┘   └────────────────────┘
```

## 7. Per-vertical architecture

The capability matrix is in `docs/ARCHITECTURE.md` §4.1 and is unchanged.
What this work added, per vertical:

- **Restaurant** — ingredients no longer on the till; dishes costed from
  their recipe at the moment of sale; modifier swaps move both money and
  stock; kitchen-facing names distinct from menu names.
- **Café** — the espresso-bar/food-pass station split now survives an
  unrouted item (a pastry off the shelf goes straight to READY rather than
  sitting on a screen nobody watches). Oat-milk swap: +21.00 cost, dairy
  restored, oat consumed.
- **Fast food / QSR** — recipes stay off by design; the correction that
  matters here is the ProductGrid fix (every tile was disabled) and
  collision-free counter order names.
- **Bakery** — `producedInAdvance` items keep their production-run cost
  rather than being re-costed from raw ingredients at sale, which would
  double-count the run. "Butter croissant" correctly shows *Out of stock*
  at zero finished goods, where a made-to-order dish does not.
- **Bar / pub** — the lime fix. 0.25 of a piece-unit ingredient now
  deducts 0.25, and the UI prints 89.75 rather than rounding the display
  to 90.

## 8. Shared F&B architecture

`src/domain/fnb/` — eleven modules, ~2,600 lines:

| Module | Lines | Responsibility |
|---|---|---|
| `catalog.js` | 190 | sellability roles, partitioning, picker grouping |
| `costing.js` | 493 | recipe cost, modifier cost, cost at point of sale |
| `ticketWrites.js` | 389 | the Firestore boundary |
| `lines.js` | 348 | line construction, fulfillment state |
| `ticket.js` | 337 | ticket aggregation, split/merge/transfer |
| `production.js` | 256 | production runs, yield, short yield |
| `waste.js` | 207 | costed waste movements |
| `check.js` | 189 | discount / service charge / total arithmetic |
| `stations.js` | 142 | station routing and filtering |
| `index.js` | 42 | the public surface |

## 9. Data model

**New field, one:** `catalogRole` on `products`. Absent = `sellable`.
Written only when non-default; cleared (written back as `'sellable'`) when
a row is demoted from ingredient to sellable, so the field never lingers
stale.

**New field, second:** `kitchenName` on `products`, snapshotted onto the
line at ring time. A menu says "Chef's Special"; the pass needs "8oz
sirloin, med-rare".

**New field on modifier options:** `recipe` — up to
`MAX_OPTION_RECIPE_LINES = 4` signed component deltas.

**New field on `orderLines`:** `routed` (boolean, `false` only when the
product is not kitchen-routed) and `kitchenName` (≤ 40 chars).

Everything is additive and absent-tolerant. No migration is required and
none was written.

## 10. Recipe architecture

Unchanged from the engine as found, and re-verified: `recipe[].quantity`
means *per finished unit*; yield converts a batch; sub-recipes recurse to
depth 3; `producedInAdvance` decides whether cost is computed now or was
computed by a production run. What changed is that the **cost the recipe
computes is now the cost the sale books** (§2.2).

## 11. Inventory architecture

`resolveStockDeltas` expands in three passes: the sold row, its recipe
components (recursively), and then the modifier deltas. All three are
gated on the `recipes` capability, so a QSR with recipes off moves exactly
what it moved before — asserted by a test named *"with recipes off nothing
moves"*.

Rounding split (D4):

```js
export const COMPONENT_DECIMALS = 3;
// what is SOLD rounds to the unit's own precision (unchanged);
// what is USED rounds to three decimals (this).
```

## 12. Production architecture

Unchanged. Verified that a made-in-advance item's stored cost survives the
new `sellingUnitCost` path rather than being recomputed — the one place
where recomputing would be wrong.

## 13. Order architecture

Unchanged in shape. Three corrections: a table ticket defaults to
**dine-in** (a table is dine-in by definition, and picking a table sets the
mode when it is still at the default); counter-service names disambiguate
with " (2)", " (3)" on a same-minute collision; the cart shows the
modifier detail as a subtitle rather than folded into the product name.

## 14. KDS architecture

Per-station, item-level, oldest-first, with an expeditor pass — unchanged.
Corrected: a non-routed item is now snapshotted `routed: false`, fired
straight to `READY` with a `readyAt` stamp ("nothing to cook is already
done"), and filtered out of **every** station screen including the pass.
Previously it sat on the KDS forever. Kitchen screens render
`line.kitchenName || line.productName`.

## 15. Multi-device architecture

Unchanged and re-verified under concurrency (§28). One document per line,
append-only; the header total maintained by `increment()`, which is
commutative and therefore correct under any interleaving and offline.

## 16. Offline architecture

Firestore offline persistence; no transaction in the sale path; every
header mutation an increment. Verified by taking a device offline
mid-service, ringing lines, and reconnecting (§28).

## 17. Financial architecture

The arithmetic order is unchanged and is the compatibility contract:

```
gross − discount = net sales
net sales + service charge = total   (== totalAmount)
```

What changed is the **cost** side. `sellingUnitCost(product, products,
{ variant, modifiers })` returns the recipe cost for a made-to-order item,
the stored cost for a made-in-advance item or a bought-in good, plus the
signed modifier delta. That number is what the line stores and what
`costOfGoodsSold` accumulates.

## 18. Reporting architecture

Unchanged, and now fed correct costs. One display fix: the Products cost
column read `costPrice`, which is now legitimately `0` for recipe-costed
dishes, so it showed KES 0.00. It now reads `menuItemMargin(p,
products).cost` — Dawa KES 60.50, G&T KES 102.75, both independently
checked.

## 19. Permissions architecture

Unchanged. Five F&B permissions, three enforcement copies (client, Worker,
`firestore.rules`) held in step by the existing drift test.

## 20. Security architecture

`firestore.rules` is the enforcement boundary — there is no server in the
sale path, so it is the only one. Tenant isolation was attacked directly
rather than reasoned about (§28.6).

## 21. Migration

**None required.** Absent `catalogRole` means sellable, so every existing
document in every industry — F&B and retail alike — keeps its exact
current behaviour. This was a deliberate design constraint, not a
convenience.

## 22. Rollout

Deploy indexes before the client (unchanged from `docs/ARCHITECTURE.md`
§9). Nothing in this work adds an index.

## 23. Testing strategy

Four layers, in ascending cost:

1. **Unit** — pure functions, `node --test`, 554 tests.
2. **Rules** — Firebase emulator, 38 tests.
3. **Worker** — 210 tests.
4. **End-to-end, live browser** — Playwright MCP against the emulator
   suite on **port 5273 only**, with realistic seeded data for five F&B
   verticals plus a hardware control business, and every financial claim
   re-derived independently from the persisted Firestore documents rather
   than read off the screen.

## 24. Test environment

Firebase emulator suite, project `flowbiz-audit-test`, reached through a
Vite same-origin proxy so the browser talks to it on :5273. Seeding uses
the Firestore REST API with `Authorization: Bearer owner` (rules
bypassed); the isolation attack suite uses a **real user ID token** so
rules are enforced. **No production data and no real customer account was
touched at any point** (§52).

## 25. Cross-industry safety

A hardware control business (`shop-jamii`) was seeded whose five products
carry **no** new field — no `catalogRole`, no `recipe`, no `station`, no
`kitchenName` — and driven through a full retail sale in the browser:

- all 5 products sellable; measured units render (KES 190.00/m, KES
  260.00/kg);
- `hasTables: false`, `hasDiningModes: false`, `hasSaveOrder: false`,
  `hasIngredientTabs: false`;
- nav = Dashboard / Counter / Customers / Reports / Settings only;
- sale of cement 950 + 2.5 m cable @190 = **1,425**, margin **KES 345.00**;
- persisted stock 59 cement / 497.5 m cable, both correct;
- the sale document's field list was exactly `businessId, costOfGoodsSold,
  id, isCredit, isVoided, items, mpesaCode, paymentMethod, productName,
  profit, quantity, soldAt, soldBy, soldByName, totalAmount` —
  **no F&B field appears on a shop sale.**

## 26. Bugs discovered

| # | Bug | Severity |
|---|---|---|
| 1 | Made-to-order dishes disabled on the till (`stock <= 0`) | Blocking |
| 2 | Sales costed at stored `costPrice`, ignoring the recipe | Financial |
| 3 | Fractional piece-unit ingredients deducted nothing | Financial |
| 4 | Ingredients sellable on the till; add form demanded a selling price | Domain |
| 5 | Modifiers changed price but never recipe or stock | Financial |
| 6 | `routable: false` item stuck on the KDS forever | Domain |
| 7 | Table ticket defaulted to takeaway | Domain |
| 8 | Modifiers rendered twice in the cart | UI |
| 9 | Raw dining-mode ids rendered ("DINE-IN", "dine-in") | UI |
| 10 | Same-minute counter order names collided | Domain |
| 11 | Products cost column showed KES 0.00 for recipe-costed dishes | UI |
| 12 | Ingredient form submit said "Add product"; kitchen block still shown | UI |

Plus one regression I introduced and caught: fixing #8 at source dropped
the modifier detail from the desktop cart entirely.

## 27. Bugs fixed

All twelve, each reproduced before and after. The four that matter:

**#1** — `ProductGrid.jsx`:
```js
const stocked = tracksOwnStock(p);
const out = stocked && available <= 0;   // was: !isService && available <= 0
```
Verified: all six restaurant tiles enabled; bakery's *Butter croissant*
still correctly *Out of stock* (made-in-advance, zero finished goods).

**#2** — `sellingUnitCost()` in `costing.js`, wired into `lines.js` and
`Counter.jsx`.

**#3** — `COMPONENT_DECIMALS = 3` in `inventory.js`, plus truthful display
in `industry/units.js` (a zero-decimal unit now shows decimals when the
value has a fraction). Verified live: lime 90 → 89.5 after one Dawa.

**#5** — `modifierUnitCost()` + modifier deltas in `resolveStockDeltas`,
with option recipes carried through `utils/modifiers.js`. Verified: the
oat-milk swap costs +21.00, the dairy milk it displaces nets back to zero.

## 28. Tests performed

**28.1 Unit.** 554 src (up 23), 210 Worker, 38 rules. All green. New
suites: `catalog.test.js` (7) and `menuCosting.test.js` (10).

**28.2 Journeys.** End-to-end in the browser for all five verticals:
restaurant table service with courses and firing; café counter service
with an oat-milk swap; QSR throughput; bakery pre-order and production;
bar tab with a cocktail.

**28.3 Independent financial assertions (§39).** Every figure re-derived
by hand from the persisted documents, not read off the screen. All
matched exactly: **963.05**, **1210**, **336.95 / 873.05**, **463.00**,
**842.75**, **1660.00 / 16.60 / 17.47**, **1725.90**, **87.35**,
**23.29%**, **345.00**.

**28.4 UI / stale state (§40).** Verified the cart, the check, the KDS and
the Products list all reflect the persisted state after a reload, not a
cached render.

**28.5 Formatters (§41).** Currency, quantity and date/time audited.
Produced fix #11 and the `formatQuantity` truthfulness change.

**28.6 Concurrency (§42).** Two browser contexts (waiter A and waiter B)
adding lines to the same ticket simultaneously. No lost round; the header
total equalled the sum of the lines.

**28.7 Offline / reconnect (§43).** Device taken offline mid-service,
lines rung, reconnected. All lines landed; totals reconciled.

**28.8 Security / tenant isolation (§44).** A REST attack suite driven
with a real user ID token from Business A attempting to read and write
Business B's orders, order lines, menu, recipes, ingredients, inventory,
payments, reports, tables and kitchen tickets. Every attempt denied by
`firestore.rules`.

**28.9 Cross-industry (§34 / §52).** §25 above.

## 29. Known limitations

1. **The ticket header's `costOfGoodsSold` accumulates a float artefact**
   (e.g. `173.04999999999998`), because Firestore's server-side
   `increment()` sums unrounded. **Deliberately left.** It is a cache —
   the check screen totals the lines and `recomputeHeader` heals it — and
   rounding it would require read-before-write, destroying the commutative
   property the entire multi-device design depends on. Fixing this
   correctly means moving COGS off the header, not rounding the increment.

2. **QSR has no sequential order numbers.** Names are time-based and now
   collision-free, but "order 47" needs a device-identity scheme to stay
   offline-safe. Not designed here.

3. **"Usage variance by ingredient" lists finished goods** under an
   INGREDIENT header — the report predates `catalogRole` and does not yet
   filter by it.

4. **The ingredient category picker offers menu categories.** Cosmetic;
   categories are a free string.

5. **§45 failure testing is partial.** Network interruption mid-submission
   and duplicate submission were exercised; deleted/disabled menu item,
   insufficient inventory at the moment of charge, and payment-provider
   failure were not driven end-to-end.

6. All limitations in `docs/ARCHITECTURE.md` §11 that this work did not
   touch still stand — notably same-line last-write-wins (11.1),
   `ticketWrites.js` having no unit tests (11.3), no sub-checks (11.6),
   and no deposits on an open ticket (11.7).

7. **Seven pre-existing ESLint errors remain**, none in a file this work
   touched: four in `AdvancedAnalytics` / `InventoryIntelligence` /
   `Settings` / `Setup` (present at HEAD), and one unused import in
   `HeroSection` that arrived with the earlier design-phase work already
   in the tree. Out of scope, and left alone under §52.

## 30. Remaining risks

- **`ticketWrites.js` is still the highest-value test gap.** It is the
  Firestore boundary, it needs the SDK, and its one-write-per-document
  rule is held by review. This session added to it (the `routed` /
  `readyAt` path) without adding coverage to it.
- **The role model depends on absence meaning sellable.** If any future
  code path writes `catalogRole: null` or `''` rather than omitting it,
  `catalogRoleOf` falls back to `sellable` — safe — but a typo'd role
  would too, silently. There is no enum validation at the Firestore
  boundary; `firestore.rules` does not constrain the field.
- **Modifier option recipes are capped at 4 lines** with no UI signal at
  the cap.
- **Nothing prevents a recipe cycle beyond the depth-3 bound.** A cycle
  terminates rather than hanging, but reports a cost that is wrong rather
  than an error.
- **The React layer's coverage is still manual.** The domain beneath it
  has 554 tests; the screens were verified live in a browser by a human-
  driven session, which is stronger than nothing and weaker than a
  committed E2E suite. Codifying this session's journeys as Playwright
  specs is the natural next phase.
