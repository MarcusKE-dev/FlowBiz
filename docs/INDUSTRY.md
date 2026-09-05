# The industry layer

How FlowBiz serves fifteen trades without becoming fifteen products.

---

## 1. Architecture

An **industry** is a marketing word. A **capability** is a behaviour. The
whole design follows from preferring the second.

```
businessSettings/{businessId}          one document, one shared listener
        │
        ▼
resolveIndustryConfig(settings)        pure, total, memoised
        │
        ├── global defaults            every capability off
        ├── profile defaults           what this trade starts with
        ├── owner overrides            what this owner changed
        └── dependency enforcement     a capability with a dead prerequisite is off
        │
        ▼
useIndustry()  →  industry.can('batches')
```

Nothing downstream asks *"is this a pharmacy?"*. It asks *"is `batches`
on?"*. That single discipline is why Restaurant, Café, Fast Food and Bar
are four sets of defaults over one food family rather than four codebases,
and why adding a sixteenth trade means adding an entry to a table.

### The files

| File | What it owns |
|---|---|
| `src/industry/capabilities.js` | The capability catalogue |
| `src/industry/profiles.js` | The fifteen profiles and their defaults |
| `src/industry/units.js` | The unit catalogue and quantity rounding |
| `src/industry/dashboard.js` | Owner-facing names for dashboard widgets |
| `src/industry/config.js` | **The only resolver.** Precedence, sanitisation, totality |
| `src/utils/inventory.js` | **The only inventory foundation.** What moves |
| `src/utils/stockWrites.js` | The Firestore adapter. How it is written |
| `src/utils/orders.js` | **The only order engine** |
| `src/utils/financials.js` | **The only money path** |
| `cloudflare-worker/src/lib/industry.js` | The server's copy of the two lists |
| `firestore.rules` | The third copy, enforced at the database |

### Three invariants

**Industry profile is never an authorisation boundary.** Nothing derived
from a capability decides who may read or write anything. Access is
Firebase Auth, `firestore.rules` and the Worker's permission table,
deciding on `businessId` and `role` alone. `security.test.js` asserts that
no capability is even *named* after an access concept.

**Turning a capability off hides records; it never deletes them.** The UI
says so wherever an owner or an administrator can switch something off.

**Every new field is optional with a safe default.** A document written
before a feature existed stays valid and reads identically.

---

## 2. The capability catalogue

Fifteen capabilities. `ownerConfigurable: false` means the capability
moves only with the profile, because its data model only makes sense as a
whole.

| Capability | Owner may toggle | Requires | What it gates |
|---|---|---|---|
| `units` | ✅ | — | Measured units and decimal quantities. Product form unit selector, unit-aware steps at the counter, purchases, stock take, production |
| `variants` | ✅ | — | One product with sizes/colours, each holding its own stock. Variant editor, variant picker, variant barcodes, variant rows in purchases and stock take |
| `barcodeLabels` | ✅ | — | Printing shelf and product labels |
| `services` | ✅ | — | The product/service choice on the product form. A service has no cost, no unit, no stock |
| `orders` | ❌ **locked** | — | Open tickets: the order bar, `/orders`, the `orders` collection |
| `tables` | ✅ | `orders` | Table names on a ticket |
| `modifiers` | ✅ | — | Options on an item, and their price deltas |
| `diningModes` | ✅ | `orders` | Dine in / takeaway / delivery |
| `kitchen` | ✅ | `orders` | The kitchen status flow and its dashboard tile |
| `recipes` | ✅ | — | Component consumption. **The only capability that changes stock arithmetic** |
| `production` | ✅ | `recipes` | `/production`: ingredients out, finished goods in, cost written back |
| `packSizes` | ✅ | `units` | Receive in packs, sell singles. A conversion inside the one inventory foundation |
| `ageRestriction` | ✅ | — | A per-product flag and one confirmation at checkout |
| `batches` | ❌ **locked** | — | Batch records, FEFO at the till, `/expiry`, per-batch stock take |
| `expiryAlerts` | ✅ | `batches` | The expiry dashboard tile and the near-expiry warning at the counter |

`orders` and `batches` are locked because switching either on against a
profile that lacks it would produce a screen with no data model behind it,
and switching either off would orphan documents an owner cannot see to
reason about. They move when the profile moves, or when a platform
administrator changes them server-side.

---

## 3. The profile table

| Profile | Family | Capabilities on by default |
|---|---|---|
| `GENERAL_RETAIL` | Retail | *(none — the protected baseline)* |
| `SUPERMARKET` | Retail | `barcodeLabels`, `units` |
| `HARDWARE` | Retail | `units`, `barcodeLabels` |
| `BOUTIQUE` | Retail | `variants` |
| `ELECTRONICS` | Retail | `variants`, `barcodeLabels` |
| `WINES_AND_SPIRITS` | Retail | `barcodeLabels`, `units`, `packSizes`, `ageRestriction` |
| `RESTAURANT` | Food | `orders`, `tables`, `modifiers`, `diningModes`, `kitchen`, `recipes` |
| `CAFE` | Food | as Restaurant, `tables` off |
| `FAST_FOOD` | Food | as Café, `recipes` off |
| `BAKERY` | Food | `recipes`, `production`, `units` |
| `BAR` | Food | `orders`, `tables`, `modifiers`, `diningModes`, `recipes`, `units`, `packSizes`, `ageRestriction` — `kitchen` off |
| `SALON` | Services | `services` |
| `BARBER` | Services | `services` |
| `GENERAL_SERVICES` | Services | `services`; hides `/purchases`, `/suppliers`, `/stock-take` |
| `PHARMACY` | Specialised | `batches`, `expiryAlerts`, `units`, `packSizes` |

A profile contributes capability defaults, wording, a dashboard ordering,
a unit list, starting categories and a category-filter threshold. It never
gates access, never owns data, and never appears in a conditional outside
`profiles.js`.

**`GENERAL_RETAIL` is protected.** It must not gain a field, a step or a
screen because another profile needed one. Its resolved configuration is
pinned by tests in `config.test.js`, `drinks.test.js` and `journeys.test.js`.

---

## 4. Configuration precedence

```
FlowBiz global defaults      every capability off
  → industry profile         this trade's defaults
  → business overrides       only where the capability allows one
  → dependency enforcement   run to a fixpoint
  → effective configuration
```

One direction, one place, no second path. `resolveIndustryConfig()` is:

- **Pure** — same input, same output, no I/O. That is what lets it be
  memoised once per settings snapshot and read by every component for free.
- **Total** — it never throws and never returns a partial object. Garbage
  input resolves to General Retail with everything off, because the input
  is a Firestore document an older, future or hostile client may have
  written. Totality is enforced by a guard, not merely intended.

---

## 5. Owner overrides

Owners customise their business at **`/customize`** (`CustomizeBusiness.jsx`,
owner-only). Four kinds of override, each sanitised in three places:

| Stored field | Shape | Bound |
|---|---|---|
| `capabilityOverrides` | `{ [key]: boolean }` | owner-configurable keys only |
| `unitOverrides` | `string[]` | a subset of the profile's units; the default unit is always present |
| `dashboardOverrides` | `string[]` | a subset and reordering of the profile's widgets |
| `termOverrides` | `{ catalogue, catalogueItem, catalogueItemPlural }` | three keys, 24 characters each |

Rules that make these safe:

- An owner may **narrow** what their profile offers, never **widen** it.
  A forged unit or widget the profile does not have is dropped, not granted.
- Only three words are renameable. The full terms object is internal
  vocabulary other wording is written around. `addCatalogueItem` is
  *derived* from the renamed singular, because two boxes that must agree
  is a way to get them to disagree.
- An empty result falls back to the profile's own list rather than leaving
  a blank screen.
- Overrides are expressed against the profile in force when they were
  made, so **a profile change clears all of them**.
- Reset clears all four and leaves the profile exactly where it is.

The page opens **zero Firestore listeners**. It reads `businessSettings`
through `SettingsContext`, which already holds the one shared listener the
whole app uses, and writes with `setDoc(merge)` through `raceWithTimeout`.

---

## 6. Admin overrides

`POST /api/admin/businesses/:id/industry` (permission `business.industry`).
Deliberately a patch over a small field set, not a general settings writer:

- Writes only `industryProfile` and the four override fields. Nothing else
  on the settings document, and nothing at all on `businesses/{id}` — so it
  can never reach `subscription`, a plan, an entitlement or a licence.
- Touches no operational collection. Sales, credit, inventory, batches,
  customers and payments are not read and not written, so changing a
  profile cannot delete or rewrite history.
- Validates against the **Worker's own** lists, never the client's.
- Every call is audit-logged with the previous and next profile.

---

## 7. Profile-switching guarantees

Switching profile is a write of the profile plus the four override fields
being cleared. It is guaranteed to:

- **Delete nothing.** No product, sale, credit sale, customer, batch,
  order or figure is touched. Records belonging to a capability that has
  just been switched off stop being *displayed*; they remain where they were.
- **Move nothing.** No migration, no rewrite, no reshaping.
- **Be reversible.** Switching away and back lands on exactly the original
  configuration. `overrides.test.js` asserts this for every profile.
- **Be additive with categories, or not at all.** The suggested categories
  for the new trade are merged in; nothing is removed, because products
  already point at the categories that are there.

The change dialog says all of this in plain words, because the most likely
reason someone hesitates is the fear that it is not true.

---

## 8. Backward compatibility rules

1. **Absent means the old behaviour.** No `industryProfile` → General
   Retail. No `unit` → `piece`. No `kind` → `product`. No `packSize` → a
   pack of one, the identity conversion.
2. **A field is written only when it says something.** `unit: 'piece'`,
   empty `modifiers` and an empty `note` are absent rather than stored, so
   a sale from a shop that uses none of them is byte-for-byte the document
   it always was.
3. **Nothing is renamed or removed.** Every line item still carries
   `productId`, `productName`, `quantity`, `unitPrice`, `costPrice`,
   `lineTotal`, `lineCost`, `lineProfit`, `barcode`. New fields are
   additions.
4. **An order becomes an ordinary sale.** Same collection, same fields,
   same `computeFinancials()`.
5. **Explicit clearing on edit.** Where a field can be *unset* (a unit
   changed back to pieces, a pack size removed, a service turned back into
   a product), the save writes the cleared value rather than omitting it.

---

## 9. How to add a new industry

1. Add an entry to `PROFILES` in `src/industry/profiles.js`. **Defaults
   over existing capabilities only.** If you find yourself needing a new
   capability, see §10 first and be sure at least two profiles want it.
2. Add the id to `INDUSTRY_PROFILE_IDS` in
   `cloudflare-worker/src/lib/industry.js`.
3. Add the id to `isKnownIndustryProfile` in `firestore.rules`.
4. Update the profile count and family counts in
   `src/industry/config.test.js`.
5. Run `npm test`. The drift test in
   `cloudflare-worker/test/industryConfig.test.js` fails if any of the
   three lists disagree.
6. Walk the trade's journey in `src/industry/journeys.test.js`.

## 10. How to add a new capability

1. Add it to `CAPABILITIES` in `src/industry/capabilities.js` with a
   `label` and `description` in **plain words** — an owner sees these and
   must never see the key. Set `requires` and `ownerConfigurable`
   honestly: lock it only if its data model makes no sense half-on.
2. If it is owner-configurable, add the key to
   `OWNER_CONFIGURABLE_CAPABILITIES` in the Worker **and** to
   `capabilityOverridesOk` in `firestore.rules`.
3. Gate behaviour on `industry.can('yourKey')` at the point of use. Never
   branch on `industry.profileId`.
4. If it touches stock, implement it **inside `utils/inventory.js`**. See
   §12.
5. Add tests, including the negative one: every profile that did *not* ask
   for it still has it off.

## 11. How to safely change an existing profile

- **Adding a capability default** is safe: it changes what is offered.
- **Removing one** hides records but never deletes them; check that the
  screens it gated degrade to an empty state rather than an error.
- **Changing wording** is safe; the route, the collection and the
  capability never move with it.
- **Never** change `GENERAL_RETAIL`. It is the baseline every
  pre-existing business resolves to.

### Lists that must be updated in lockstep

| List | Client | Worker | Rules | Test |
|---|---|---|---|---|
| Profile ids | `profiles.js` | `lib/industry.js` | `isKnownIndustryProfile` | drift test |
| Owner-configurable capabilities | `capabilities.js` | `lib/industry.js` | `capabilityOverridesOk` | drift test |
| Renameable terms | `config.js` | `lib/industry.js` | `termOverridesOk` | drift test |

The drift test imports the browser modules and asserts equality, so the
copies cannot diverge silently.

---

## 12. The stock-entry contract

**There is one inventory foundation: `src/utils/inventory.js`.** Every
capability that touches stock arrives there. Before this was enforced,
four separate call sites wrote stock with a raw `increment()` and three of
them silently skipped variants, batches and recipes.

Every stock movement satisfies three questions.

### How stock enters

`resolveReceiptDeltas(rows, products, { packSizes })` — purchases and
production. Recipes are never expanded on the way in: receiving twenty
loaves adds twenty loaves, not the flour they were made from.

### How stock is counted

`resolveCountDeltas(rows, products, { batches })` — the stock take. This
is different arithmetic from every other movement: a sale says *"move by
−3"*, a count says *"the shelf holds 9"*. The system figure must come from
the right ledger, so the sheet expands each product into what is
physically on the shelf:

- **batch-tracked** → one countable row per batch (the professionally
  correct answer: a physical count is per lot);
- **versioned** → one row per version;
- **everything else** → one row, exactly as before.

### How stock is reversed

`resolveStockDeltas(rows, products, { reverse: true })` — voids,
cancellations, credit refunds and returns. Reversal is an exact
**negation** of the same resolution, never a second one, so stock always
goes back to the version, the batch and the components it came from.

### The invariant

> `sum(variantStock) === stock` and `sum(batch.remainingQuantity) === stock`,
> after every operation, in both directions.

Held by `stockLedger.test.js` across purchase → sale → void → stock take.

### How it is written

`stockWriteOps(deltas)` (pure) names the documents and the numeric field
increments; `utils/stockWrites.js` turns each number into a Firestore
`increment()`. The stock movement always lands in the **same write batch**
as the document that caused it, so the two can never diverge and the whole
thing queues as one atomic mutation offline.

### Pack sizes

Stock is held in **one base unit per product**, and the base unit is the
one it is **sold** in. `packSize` says how many come in a pack.

| Trade | Base unit | Pack | Size |
|---|---|---|---|
| Pharmacy | tablet (`piece`) | `box` | 30 |
| Bar | `tot` | `bottle` | 25 or 30 |
| Wines & spirits | `bottle` | `crate` | 25 (beer) / 12 or 24 (spirits) |

Conversion happens in one direction — packs into base units — and only
where a quantity was *entered* in packs. A sale needs no conversion at
all. Partial packs round in the base unit's own precision, so half a crate
of 25 is 12 bottles, not 12.5.

### What never moves stock

- A **service** (`kind: 'service'`) — a haircut does not run out.
- A **made-to-order recipe item** — its components have stock; it does not.
- A **produced-in-advance item's components at sale time** — they were
  consumed at production. Deducting flour in both places is the bug the
  distinction exists to prevent.

---

## 13. Offline behaviour

Every write in the industry layer goes through `raceWithTimeout(promise, 4000)`
and reports "queued" rather than spinning. Because each stock movement
shares a `writeBatch` with the document that caused it, an offline
mutation applies **atomically** when it syncs.

| Workflow | Offline |
|---|---|
| Sale, credit sale, void, order charge | ✅ one batch |
| Purchase (incl. variant, pack, batch record) | ✅ one batch |
| Stock take (incl. per-variant, per-batch) | ✅ one batch |
| Production run (incl. cost writeback) | ✅ one batch |
| Return of a completed sale | ✅ one batch |
| Cancel / refund a credit sale | ✅ one batch |
| Changing business type, capabilities, units, dashboard, words, categories, tables | ✅ `setDoc(merge)` |

Capabilities that need a **live listener** — `orders`, `batches` — show
what was last synced while offline, which is the same behaviour every
other collection in FlowBiz has.

---

## 14. Reads and writes

The industry layer adds **zero** Firestore reads to a business that uses
no industry capability.

- Configuration rides on `businessSettings`, which already has exactly one
  shared listener per business (`SettingsContext`). The profile table is
  static code.
- Capability-gated listeners open **only when the capability is on**:
  `orders` (Counter, Orders, Dashboard), `productBatches` (Counter,
  Expiry, Stock Take, Dashboard), `productions` (Production, Dashboard).
- `/customize` opens no listener of its own.
- No telemetry, no per-render writes, no duplicate catalogue reads.
