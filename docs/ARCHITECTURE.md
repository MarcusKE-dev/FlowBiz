# FlowBiz industry architecture

An audit of what FlowBiz was, a decision about what it should be, and a
record of what was actually built.

Written September 2026, against the state of the repository at the time.
Where this document says a thing is not implemented, it is not
implemented — see §10 and §11, which are the two sections to read if you
only read two.

---

## 1. Executive architectural decision

### The brief's premise, tested

The task began from the position that FlowBiz is *"one retail POS with
industry-specific modifications"* and should become *"a shared platform
with correctly modelled industry engines"*.

**Half of that premise turned out to be wrong, and saying so is the most
important finding in this document.** FlowBiz already had a capability
layer — `src/industry/` — that is a genuinely good piece of design:

- an industry profile contributes **defaults**, nothing else;
- every screen asks *"is `batches` on?"*, never *"is this a pharmacy?"*;
- a single pure, total, memoised resolver owns precedence;
- the capability list is duplicated into the Worker and into
  `firestore.rules`, with a drift test that fails if the three disagree;
- a profile change writes two fields and migrates nothing.

A test now asserts the discipline mechanically: `src/domain/architecture.test.js`
greps the entire source tree for `profileId === '…'` and fails if it finds
one. It finds none. Rebuilding that layer would have destroyed working,
well-reasoned architecture in order to arrive back at roughly the same
place.

### What was actually wrong

The capability layer decided **what is offered**. Nothing owned **what
food service does**. The behaviour that a restaurant, café, QSR, bakery
and bar actually need was either in `src/utils/` next to a duka's
line-item arithmetic, or it did not exist. Specifically:

| Defect | Consequence |
|---|---|
| An open order was **one document with an `items` array**, rewritten whole | Two waiters on one table silently overwrote each other. No error, anywhere. |
| **One kitchen status on the whole order** | A table cannot be one word while the drinks are poured and the steak is on the grill. No stations, no courses, no per-item firing. |
| **No discount** | The only way to take money off a bill was to edit the price, which destroys the record of what the item costs. |
| **No service charge** | Not representable at all. |
| **One `paymentMethod` string** | A table splitting the bill three ways had to be recorded as three sales of a third of the food each. |
| **No waste** | Spoilage had to be entered as a stock-take "correction" — the wrong ledger — and carried **no cost anywhere**, so a business that binned a crate of milk recorded the loss of the stock and none of the loss of the money. |
| **No variance** | A bar could not tell over-pouring from theft. |
| **No recipe yield** | A baker divided every ingredient by twenty by hand. Short yields were costed at plan, so the value of what did not come out of the oven vanished from the books. |
| **`tot` carried zero decimals** | `roundQuantity` truncates. A 1.5-tot pour deducted **one** tot. A third of every measure never reached the books. |

### The decision

**Keep the capability layer. Add one industry domain engine above the
platform core, and nothing else.**

```
src/utils/         PLATFORM CORE
                   line arithmetic, money, units, inventory, stock
                   writes, tenders, financials. Shared by every industry.

src/industry/      CONFIGURATION
                   which capabilities a trade has, its words, what its
                   cashiers may do. Decides what is OFFERED. Owns no
                   behaviour.

src/domain/fnb/    THE FOOD & BEVERAGE DOMAIN ENGINE
                   a ticket's life, firing to a station, what a check
                   costs, what was wasted, what a batch yielded.
```

One directional rule, asserted by a test rather than described in a
comment:

```
domain/fnb  →  utils/, industry/     allowed
utils/      →  domain/fnb            never
```

The platform core does not know the domain exists. That is what makes a
retail business's counter, reports and financials **provably** unaffected
by everything in the engine, and what would let a second engine be added
later without either learning about the other.

### The alternatives that were rejected

| | Considered | Rejected because |
|---|---|---|
| **A** | Extend the retail path with more capability flags | The flags were never the problem. Ticket concurrency, item-level fulfillment and check arithmetic are *behaviour*, and putting them in `utils/` puts restaurant concepts in the module a duka's counter imports. |
| **B** | A separate engine per food industry | Restaurant, café and QSR differ in **which of the same capabilities are on**, not in what a ticket is. Five engines would be five copies of the check arithmetic and five places to get the costing wrong. |
| **C** | Server-authoritative command bus (device → command → validate → event → subscribers) | Requires the Cloudflare Worker to become a hot-path service, and it **breaks offline-first**: a command that cannot reach the server cannot be validated, so the till stops working when the connection does. FlowBiz's users are in markets where it does. |
| **D** ✅ | Shared platform core + **one** F&B domain engine, capability-configured per profile | Chosen. |

---

## 2. Current-state assessment

### The stack

React 19 + Vite SPA · Firebase Auth · Firestore (offline persistence on) ·
a Cloudflare Worker for admin, email and payments · PWA. ~41,000 lines.
No server in the sale path at all: the client writes Firestore directly
and `firestore.rules` is the enforcement.

### What was already right, and was kept

- **One inventory foundation** (`utils/inventory.js`) — pure, decides what
  moves; **one adapter** (`utils/stockWrites.js`) — turns that into
  `increment()`. Every stock path in the product goes through both.
- **One money path** (`utils/financials.js`).
- **Tenant isolation** — `businessId` on every document, `tenantQuery()`
  makes an unscoped query hard to write by accident, and every rule
  decides on `businessId` and `role` alone. No capability is an
  authorisation boundary, and a test asserts that none is even *named*
  after one.
- **Stock movements share a write batch with the document that caused
  them.** They cannot diverge, and offline the pair queues as one atomic
  mutation.
- **Absent means the old behaviour**, everywhere. A field is written only
  when it says something.

### The architectural limitation, stated once

Not "too many conditionals". FlowBiz had almost none. The limitation was
that **food service had no home**, so it was expressed in the one shape
retail already had: a cart, saved to a document, charged. That shape is
correct for a shop and structurally wrong for a room with tables, a
kitchen, and more than one person taking orders at once.

---

## 3. Target architecture

```
                     ┌──────────────────────────────┐
                     │  PLATFORM CORE  (src/utils)  │
                     │  money · units · line items  │
                     │  inventory · stock writes    │
                     │  tenders · financials        │
                     └───────────────┬──────────────┘
                                     │  (one direction only)
        ┌────────────────────────────┴────────────────────────┐
        │                                                     │
┌───────▼─────────────────┐                    ┌──────────────▼──────────┐
│  CONFIGURATION          │                    │  DOMAIN ENGINE          │
│  (src/industry)         │                    │  (src/domain/fnb)       │
│                         │                    │                         │
│  20 capabilities        │  ── configures ──▶ │  lines    ticket        │
│  15 profiles            │                    │  stations check         │
│  27 cashier permissions │                    │  waste    costing       │
│  units · categories     │                    │  production             │
└─────────────────────────┘                    └──────────────┬──────────┘
                                                              │
                                              ┌───────────────▼──────────┐
                                              │  ticketWrites.js         │
                                              │  the ONLY Firestore      │
                                              │  boundary for tickets    │
                                              └──────────────────────────┘
```

Every module in `domain/fnb` except `ticketWrites.js` is **pure** — no
Firestore, no React, no clock it does not take as an argument — and is
tested without a database. `ticketWrites.js` is the single adapter, the
same split `utils/stockWrites.js` makes.

### The nine modules

| Module | Owns |
|---|---|
| `lines.js` | The ticket line: shape, fulfillment state machine, header deltas, projection to a sale item |
| `ticket.js` | The aggregate: reading a ticket (**both** storage shapes), the room, courses, the split/merge/move plan |
| `stations.js` | Kitchen sections and per-item routing |
| `check.js` | Discounts, service charges, the order of operations |
| `waste.js` | Waste reasons, records, stock deltas, summaries |
| `costing.js` | Recipe cost, yield, theoretical usage, variance, cost percentage, menu performance |
| `production.js` | Run planning, short yield, shelf life |
| `ticketWrites.js` | The Firestore adapter |
| `index.js` | The public surface, and the dependency rule |

`utils/tenders.js` is deliberately **platform core, not domain**: splitting
a payment is a property of payment, not of restaurants — a hardware shop
taking part cash and part M-Pesa needs exactly the same thing — and
`utils/financials.js` depends on it, so it cannot live in an industry
engine without breaking the direction rule.

---

## 4. Industry architecture

### 4.1 The five food-service profiles

They share **one** ticket, **one** check, **one** kitchen model, **one**
inventory foundation. They differ in which capabilities are on, and every
difference below is a considered answer rather than a copy of the profile
above it.

| | Restaurant | Café | Fast food | Bakery | Bar |
|---|---|---|---|---|---|
| Open tickets | ✅ | ✅ | ✅ | ✅ pre-orders | ✅ tabs |
| Tables | ✅ | — | — | — | ✅ |
| Courses | ✅ | — | — | — | — |
| Kitchen | ✅ | ✅ | ✅ | — | — |
| Kitchen sections | ✅ | ✅ bar/pass | ✅ fryer/grill/assembly | — | — |
| Modifiers | ✅ | ✅ | ✅ | — | ✅ |
| Dining modes | ✅ | ✅ | ✅ | — | ✅ |
| Discounts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Service charge | ✅ | — | — | — | — |
| Recipes | ✅ | ✅ | — | ✅ | ✅ |
| Production | — | — | — | ✅ | — |
| Batches / expiry | — | — | — | ✅ | — |
| Units | — | — | — | ✅ | ✅ |
| Pack sizes | — | — | — | — | ✅ |
| Waste | ✅ | ✅ | ✅ | ✅ | ✅ |
| Age restriction | — | — | — | — | ✅ |

#### Restaurant

*Operating model.* Table service. A party is seated, ordered for over
time, fired in courses, and charged once at the end.

*Sales model.* A ticket per table. Lines are added round by round;
**courses** group them; **firing** sends a course to the kitchen;
**stations** route each item to the section that makes it. The check
carries a discount and a service charge and may be settled with more than
one tender.

*Inventory model.* Made-to-order recipes: selling a dish consumes its
ingredients at the moment of sale, never the dish itself. Waste is
recorded as its own movement.

*Financial model.* Gross → less discount → **net sales** → plus service
charge → total charged. Food cost percentage against **net sales**, never
against the total, because a service charge carries no food behind it.

*Unique requirements.* Courses; service charge; the split/merge/transfer
primitive.

#### Café

*Not a restaurant with the tables switched off.* Counter service, order
number rather than table, everything served as it is ready.

The one restaurant concept a café genuinely needs is **stations**, and for
a reason specific to the trade: the real split in a café is the espresso
bar against the food pass. The barista makes the flat white while the
kitchen toasts the sandwich, and they are two people looking at two
screens.

No courses (everything goes as it is ready) and no service charge (nobody
adds 10% to a coffee).

#### Fast food / QSR

Throughput is the whole game. Kitchen **and** stations on, because a QSR
line is physically laid out as fryer / grill / assembly and that *is* the
routing. No courses — everything goes at once. **Recipes off**, which is
the considered call: a QSR buys portioned inputs rather than costing a
plate from raw ingredients, and a recipe layer nobody maintains produces
worse numbers than none. Waste on, because binned holding-time stock is
one of a QSR's largest controllable costs.

#### Bakery

**Not a shop that sells finished goods.** The flow is:

```
raw ingredients → recipe (with a YIELD) → production run → finished goods
     → dated batch → counter sale (oldest first) → expiry
                              ↘ waste
```

Three things were added here that a per-unit recipe could not express:

- **Yield.** A dough makes twenty loaves. `recipe[].quantity` still means
  *per finished unit* — no stored recipe changed meaning — but a baker now
  enters **batches** and the arithmetic is done for them.
- **Short yield.** Plan twenty, get eighteen. The dough for twenty went in
  the oven, so `unit cost = batch cost ÷ ACTUAL`. Costing at plan would
  make the value of the two lost loaves vanish from the books entirely,
  which is the most common way a small bakery's numbers drift.
- **Shelf life.** A run of an item with one writes a **dated lot into the
  batch ledger the pharmacy profile already uses** — FEFO at the till, the
  expiry screen, the near-expiry warning. No new entity, because it is
  genuinely the same behaviour: a lot of goods with a date, sold in date
  order.

Bakery also gained **open orders**, because a bakery's other half is the
cake ordered on Tuesday for Saturday — a named ticket held open and
charged on collection.

#### Bar / pub

**Not a restaurant that sells alcohol.** A tab runs through the night on a
named ticket, and the kitchen is off by default because a kitchen queue in
a bar with no kitchen is a column nobody fills in.

*Inventory model.* Stock is held in **one base unit, the one it is sold
in**, with `packSize` converting purchases: a 750ml bottle is 25 or 30
tots, a beer crate is 25 bottles. Cocktails are recipes that consume
spirits.

*The bug this exposed, and the fix.* `tot` carried **zero decimals** like
every other count unit, and `roundQuantity` truncates those. A cocktail
specified as 1.5 tots of gin deducted exactly **one** — a third of every
double measure poured never reached the books at all, invisible until a
stock take and indistinguishable from theft when it did. A tot is not a
discrete object; it is a measure of a continuous volume. It now carries
two decimals, and `recipePrecisionWarnings()` catches the general case for
every unit at the point somebody is typing the recipe and can fix it.

*Variance.* Theoretical usage from recipes × sales, against recorded waste
plus what a count could not account for. That is a bar's whole cost
control, and it did not exist before.

### 4.2 The retail, service and specialised profiles

Part 13 of the brief asked whether these should be rebuilt. **Nine of the
ten were audited and left alone**, and that is the finding, not an
omission. The retail model — buy a thing, hold a thing, sell the thing —
genuinely describes them, and rebuilding what is already correct is how a
codebase gets worse.

| Profile | Verdict | Reasoning |
|---|---|---|
| **General retail** | Unchanged, and **protected** | The baseline every pre-existing business resolves to. A test asserts every capability is off for it. |
| **Supermarket** | **Waste added** | A supermarket bins more produce than most kitchens and had nowhere to record it but a stock-take correction. Same movement, same module. |
| **Hardware** | Unchanged | Measured units, decimal quantities and per-unit pricing already correct and tested end to end. |
| **Boutique** | Unchanged | Variants hold their own stock; `sum(variantStock) === stock` is an asserted invariant. |
| **Electronics** | Unchanged | Variants + barcodes. Serial-number tracking would be the next real requirement and is **not** implemented (§11). |
| **Wines & spirits** | Unchanged | Correctly modelled as **retail, not food**: sealed stock, nothing poured, nothing served. Crate→bottle conversion already right. |
| **Salon / Barber / General services** | Unchanged | A service has no stock and does not run out. Correctly modelled. Appointments are absent by design (§11). |
| **Pharmacy** | Unchanged — **verified, not assumed** | Batch number, expiry, quantity received and source are all recorded; FEFO never picks expired stock; expiry is a `YYYY-MM-DD` string so "expires today" cannot depend on a device timezone; a physical count is per lot. Pack→single conversion correct. **No regulatory claim is made or implied** — no prescription register, no controlled-drug register, and `utils/batches.js` says so explicitly. Nothing was invented. |

The one thing worth noting about Pharmacy: it now shares its batch ledger
with Bakery. That is not coupling of two industries — it is two profiles
turning on the same capability because they genuinely have the same
behaviour, which is exactly what the capability model is for.

---

## 5. Data architecture

### New collections (2)

**`orderLines`** — one document per line on a ticket.

```
businessId  orderId  seq  open                     ← identity and liveness
productId  productName  quantity  unit  unitPrice
basePrice  costPrice  lineTotal  lineCost  lineProfit
variantId  variantLabel  modifiers[]  note  barcode ← identical to a sale line
courseId  station                                   ← routing, snapshotted
fulfillment  firedAt  readyAt  servedAt             ← the kitchen
voided  voidedAt  voidedBy  voidedByName  voidReason
addedBy  addedByName  addedAt  updatedAt
```

**`waste`** — stock that left without being sold.

```
businessId  productId  productName  quantity  unit
variantId  batchId                    ← the box that went off, not the earliest
reason  note  unitCost  totalCost     ← cost snapshotted at the moment
recordedBy  recordedByName  recordedAt
```

Both are on the export list, the import list, the reset list and the
Worker's purge list — a test fails if a collection in `firestore.rules` is
missing from any of them.

### Changed documents, all additive

| Document | Added | Absent means |
|---|---|---|
| `orders` | `lineModel: 'lines'` | the legacy `items` array — read, never rewritten |
| `sales` / `creditSales` | `grossAmount`, `discountAmount`, `discountType/Value/Reason`, `discountedBy`, `serviceChargeAmount`, `serviceChargeRate`, `tenders[]` | no discount, no service charge, one tender |
| `products` | `recipeYield`, `shelfLifeDays`, `station`, `routable` | yield of 1, no shelf life, main kitchen screen, routable |
| `productions` | `batches`, `yieldPerBatch`, `plannedQuantity`, `yieldVariance` | a run with no yield that came out exactly |
| `businessSettings` | `stations[]`, `courses[]`, `serviceChargeRate` | none, none, zero |

**`totalAmount` on a sale still means what it always meant**: the money
that came in. A discount reduced it before it was written, a service
charge was added to it. That single invariant is why `computeFinancials()`,
close of day, the till reconciliation, every report and every export are
correct for a discounted, service-charged, split-tender restaurant sale
**without being changed**.

### Relationships

```
businesses ─┬─ businessSettings  (tables, stations, courses, rate)
            ├─ products ─┬─ recipe[] ──▶ products      (bounded depth 3)
            │            └─ productBatches             (pharmacy AND bakery)
            ├─ orders ───── orderLines                 (orderId, one write per line)
            ├─ sales ─────── items[]                   (a copy, never a reference)
            ├─ waste ──▶ products / productBatches
            └─ productions ──▶ products
```

A sale's line items are a **copy**, never a reference. A receipt from
March has to still say what was served and what it was charged at after
the price changes in April.

---

## 6. Workflow architecture

### The ticket

```
                 ┌──── cancel ────▶ CANCELLED   (lines: open=false, NOT voided)
OPEN ────────────┤
                 └──── charge ────▶ COMPLETED   (lines: open=false, served)
```

Cancelling does **not** void a ticket's lines, and that is deliberate: a
void is a statement about one item on a bill and who took it off, while a
ticket nobody charged has no bill. Putting both in one field would merge
a manager's abandoned-table count with their voided-item count, which is
exactly the pair a manager is trying to tell apart.

### The line

```
             fire            ready           serve
NEW ──────────▶ SENT ──────────▶ READY ────────▶ SERVED
 │                │                │                │
 └── void ────────┴────────────────┴────────────────┘   (flagged, never deleted)
```

Forward only. A double-tap is not a change, and two cooks tapping "Ready"
at once agree. `open` is a **separate** fact from `fulfillment`, because a
table that has eaten and not yet paid has every line at `served` and must
not drop off the floor at exactly the moment somebody needs to charge it.

### Split, merge, transfer

All three are one write — a line's `orderId` — because a line is its own
document:

| Operation | What it is |
|---|---|
| Split a check | move *some* lines to a new ticket |
| Merge two bills | move *all* lines onto an existing ticket |
| Transfer a table | move all lines to a new ticket at another table |
| Fix a mis-rung item | move one line |

`planLineMove()` returns the moves and **both** header adjustments, and
`applyLineMove()` writes them in one batch — so no money is ever in flight
between two tickets. This is the clearest payoff of getting the data model
right: four features a full-service restaurant is judged on cost one
primitive between them, with no new entity, collection or rule.

---

## 7. Multi-device architecture

### The problem, precisely

The old model was a read-modify-write of shared state:

```
tablet A reads items[3] ─┐
tablet B reads items[3] ─┤
tablet A writes items[5] ─┴─▶ B writes items[4] ──▶ A's round is gone. Silently.
```

The counter tried to prevent this in the UI — *"finish or clear the
current order first"* — but that check is per-device state and cannot see
another tablet at all.

### The options compared

| Approach | Verdict |
|---|---|
| Optimistic concurrency (`version`, the Square model) | **Rejected.** Textbook, and wrong here: Firestore transactions **fail while offline**, and a rules-based version guard would let an offline write sit queued for an hour and then be *rejected at sync time* — losing it after the waiter was told it was saved. |
| WebSockets / SSE / a command bus | **Rejected.** Needs a hot-path server. Breaks offline-first, which is not negotiable for these users. |
| Realtime Database alongside Firestore | **Rejected.** A second datastore, a second security model, and a synchronisation problem between them. |
| **Conflict-free writes: one document per line** | **Chosen.** |

### How it works

**Add** creates a new document — a unique id, so it cannot collide with
anything.
**Change / void / advance** touches exactly one line.
**Header totals** move by `increment()`, never by assignment, because
increment is commutative: `+500` from one tablet and `+300` from another
both land, in either order, online or offline.

| Property | How |
|---|---|
| Concurrency | Independent documents. Two devices adding rounds merge; they do not clobber. |
| Idempotency | Fire touches only lines still at `new`. Advance is forward-only. Both are safe to repeat. |
| Ordering | `seq`, a client clock reading, for display only. Nothing correctness-bearing depends on it. |
| Reconnect | Firestore's own queue. No custom sync layer, so there is no custom sync layer to be wrong. |
| Stale state | Two listeners for the whole floor, live. |
| Conflict resolution | Structurally absent for adds. Two devices editing the *same* line is still last-write-wins — a real conflict on one line, not silent loss of a round. Stated, not hidden. |
| Cache drift | The header total is a **cache**; the check screen totals the lines. `readTicket()` reports `cacheStale`, and any screen holding every line heals it. |
| Offline | Every write is a `writeBatch` that queues as one atomic mutation. |
| Authority | The client writes; `firestore.rules` is the authority. |

### Listeners: two, however many tables

```
orders     where status == 'open'                    ← the headers
orderLines where open == true  orderBy seq           ← every line in play
```

The obvious design — one listener per open ticket — would hold twenty-one
subscriptions in a twenty-table room and open and close them as tickets
come and go. The second query above bounds itself: a line is live until
its **ticket** closes, so a paid table leaves both screens without
anything having to remember to unsubscribe. The kitchen screen filters the
same list client-side and has **no listener of its own**.

Both are capability-gated. A shop with no open orders opens neither.

### Device roles

The brief asked for modelled device roles (WAITER, POS, KDS, EXPEDITOR…).
**They are already modelled, as the permission set**, and a stored
`deviceRole` string was deliberately not added.

A kitchen tablet is a staff account holding `kitchen.update` and nothing
else. The security rule behind the kitchen screen permits exactly five
fields — `fulfillment`, `firedAt`, `readyAt`, `servedAt`, `updatedAt` —
so a tablet bolted to a kitchen wall **cannot** change a price, ring an
item, or take one off a bill, and a rules test proves it. That is
server-enforced, auditable and revocable. A `deviceRole` string would be
none of those; it would be a field that looks like architecture and is
not. What a stored role would add over this is a landing-page convenience,
noted as a limitation in §11 rather than dressed up as a security model.

| Role | Is | Sees |
|---|---|---|
| Waiter | cashier + `orders.*` | Counter, floor |
| POS / cashier | cashier + `sales.record`, `orders.close` | Counter |
| Kitchen | cashier + `kitchen.update` only | Kitchen |
| Expeditor | as kitchen, viewing **All** sections | Kitchen |
| Manager / owner | owner | Everything |

---

## 8. Financial architecture

### Terminology

The profession's, not invented. An owner comparing FlowBiz's food cost
against the 28–35% their trade talks about must be comparing the same
number.

| Term | Definition here |
|---|---|
| Gross | Σ line totals at menu price, modifiers included |
| Discount | A recorded reduction, with a reason and a name |
| **Net sales** | Gross − discounts, **before** any service charge |
| Service charge | Net sales × rate. The business's revenue. |
| Total | Net sales + service charge — **the amount charged** |
| COGS | The cost of the things that were **sold** |
| Waste | The cost of stock that left **without** being sold |
| Gross profit | Revenue − COGS |
| Net profit | Gross profit − expenses − **waste** |
| Cost percentage | COGS ÷ **net sales**. "Food cost", "pour cost". |
| Theoretical usage | What the recipes say the period should have consumed |
| Variance | Recorded waste + what a count could not account for |

### Three decisions worth defending

**A discount does not reduce COGS.** Taking 500 off the bill does not make
the steak cheaper to buy. Gross margin on a discounted check is genuinely
lower, and that is the fact the owner needs to see.

**A service charge is held out of the food-cost denominator.** It is
revenue with no food behind it; including it would flatter every cost
percentage a kitchen reads.

**Waste reaches net profit.** This is the one figure whose *formula*
changed, and it changed because the old one was wrong: stock thrown away
carried no cost anywhere, so a business that binned a crate of milk looked
*more* profitable for having done so. It is kept **out of COGS** so that
gross margin on sales stays comparable across every industry and every
period, and because nobody improves a cost they cannot see separately. No
business has a waste record from before this shipped, so no historical
figure moves in practice.

### Three deliberate omissions

**No tax engine.** FlowBiz prices are tax-inclusive and the product
expressly disclaims VAT, eTIMS and KRA compliance. A tax field not backed
by real tax handling is worse than no field, because it looks like
compliance.

**No tip line.** A tip is money owed onward to a person. FlowBiz has no
payroll, so recording it as revenue would overstate income and understate
what is owed to staff. A house that adds a **service charge** is charging
for service, which *is* the business's revenue, and that is supported.

**No labour in recipe cost.** Recipe cost is ingredient cost. Loading an
allocated wage rate into a plate cost needs scheduling, hours worked and a
costing basis, none of which exist here; a made-up per-plate labour figure
would corrupt gross margin everywhere it is read. Labour is an operating
expense, where FlowBiz already records it.

### Split payments, without moving a number

`utils/tenders.js` — platform core, not domain. `saleTenders(sale)`
returns the tenders a sale carries, or, for **every sale FlowBiz has ever
written**, the single tender its `paymentMethod` and `totalAmount` always
implied. `computeFinancials()` sums by tender instead of by the sale's
filed method, which is *exactly equivalent* for a single-tender sale and
correct for a split one. A regression test asserts a legacy set of sales
produces identical figures.

A split-tender sale is still filed under `paymentMethod` — the method that
paid the largest share — so the sales filter, the activity feed, the admin
inspector and the CSV export all still find it where a human would look.

---

## 9. Migration architecture

**Nothing migrates. Nothing is rewritten. No history is touched.**

### Open tickets

`readTicket(order, lines)` accepts **both** shapes and returns the same
object:

- `lineModel: 'lines'` → the truth is in `orderLines`;
- absent → the legacy `items` array, with each entry presented as a line
  carrying `readOnlyLine: true` and the ticket's old order-level
  `kitchenStatus` read onto it.

A legacy ticket's lines cannot be fired, voided or moved individually,
because there is no document to move — the UI says so plainly and offers
the whole-ticket action instead. It is charged and closed by the code path
it always used, and the counter routes it to the ordinary cart checkout
because its items were loaded *into* the cart, so sending it through the
new ticket checkout would bill the table twice.

The alternative — silently rewriting a live business's open tickets into a
new collection on first read — is a migration performed by whichever
device happened to open the screen. It was not done.

Every ticket opened from here on is a lines ticket. Legacy tickets drain
naturally within a shift.

### Everything else

| | Compatibility |
|---|---|
| Sales, credit sales, refunds | Unchanged shape. New fields absent unless used. |
| Recipes | `recipe[].quantity` still means *per finished unit*. Yield is additive. |
| Production runs | New fields written only when a run had a yield or came out short. |
| Profiles | Bakery gained `orders`, `batches`, `expiryAlerts`, `waste`; Supermarket gained `waste`. **Additive** — it changes what is offered, hides no records, deletes nothing, and an administrator can override it server-side. |
| `tot` precision | 0 → 2 decimals. Whole-tot quantities are unaffected; fractional ones stop truncating. This **changes a stored figure's future arithmetic**, and it is a correction of a defect. |
| General retail | Byte-for-byte unchanged. Asserted by test. |

### Deployment order

1. `firestore.indexes.json` — two `orderLines` indexes and one for `waste`.
   **Deploy first**; the queries fail without them.
2. `firestore.rules`.
3. The Worker (`OWNER_CONFIGURABLE_CAPABILITIES`, `PURGE_COLLECTIONS`).
4. The client.

Steps 1–3 are backward compatible with the current client.

---

## 10. Implementation status

### Implemented

- **`src/domain/fnb/`** — nine modules, ~2,400 lines, 99 unit tests.
- **`orderLines`** — the conflict-free ticket line, with rules, indexes,
  export/import/reset/purge registration.
- **Item-level fulfillment** — new → sent → ready → served, per line.
- **Firing**, idempotent.
- **Kitchen sections** and per-item routing, snapshotted at ring time.
- **Courses**, with fire-by-course grouping.
- **`/kitchen`** — a real KDS: item-level, station-filtered, oldest-first,
  with an expeditor view and an ageing indicator.
- **Split, merge, transfer** — one primitive, on the floor screen.
- **Per-line void** — flagged, never deleted, permissioned, recorded.
- **Discounts** and **service charges**, with the correct order of
  operations.
- **Split payment** across up to six tenders, settling the bill exactly.
- **`/waste`** — a new movement, costed, reaching net profit.
- **Recipe yield, short-yield costing, shelf-life batches.**
- **Cost control reporting** — cost %, by category, menu performance,
  usage variance, waste by reason.
- **Five new capabilities**, **five new permissions**, all three
  enforcement copies in step, drift test green.
- **Bug fix:** `tot` truncation.
- **Bug fix:** two writes to one document in a batch, in three places in
  the charge and commit paths (found reviewing my own code).
- **Bug fix:** a legacy ticket would have been charged twice.
- **Bug fix:** the ticket charge validated only the cart against live
  stock, not the lines it was about to charge for.

### Refactored

- `utils/financials.js` — sums by tender; reports discounts, service
  charges, net sales and waste. **No existing figure moved** (asserted).
- `Counter.jsx` — a ticket is something you **add to**, not something you
  load into the cart. The walk-up retail path is untouched.
- `Orders.jsx` — rewritten as a floor view over the domain.
- `Dashboard.jsx`, `OrderBar.jsx` — read stages from the domain.
- `Production.jsx` — planned by one pure function.

### Deprecated and removed

`utils/orders.js` lost `KITCHEN_STATUSES`, `KITCHEN_LABELS`,
`nextKitchenStatus`, `tableStates`, `summarizeOpenOrders` and
`isKnownDiningMode`. **Two competing architectures were not left in
place.** What remains is the legacy write path, table names and dining
modes, and the file's header says exactly what moved and where.

### Intentionally left unchanged

General retail, Hardware, Boutique, Electronics, Wines & spirits, Salon,
Barber, General services, Pharmacy. Audited (§4.2); correct as they are.

### Done in the follow-on domain rebuild

The comprehensive testing project this section originally recorded as *not
done, by instruction* was carried out afterwards, together with a domain
correction the engine above did not make: **an ingredient was
automatically a sellable product, and every sale was costed at the stored
`costPrice` rather than at the recipe.** Twelve bugs were found and fixed,
four of them blocking or financial.

Current: **554 unit tests + 210 Worker tests + 38 emulator security-rule
tests**, all green, a clean production build, and end-to-end verification
in a live browser across all five F&B verticals plus a non-food control
business.

See **`docs/FNB_ARCHITECTURE.md`** for the full report.

---

## 11. Remaining risks and known limitations

Honestly stated. **The code compiles and the tests pass; that is not the
same as production-ready.**

### Architectural

1. **Two devices editing the *same line* is still last-write-wins.**
   Adds, voids and moves are conflict-free; a simultaneous quantity edit
   on one line is not. A real conflict on one line, rather than silent
   loss of a round — but not resolved.

2. **The header total is a cache maintained by increments.** A retried
   commit could double-apply one. It is a cache — the check screen totals
   the lines — `readTicket()` reports the drift, and screens holding every
   line heal it. Not impossible to drift.

3. **`ticketWrites.js` has no unit tests.** It is the Firestore boundary
   and needs the SDK, so it is untested for the same reason
   `utils/stockWrites.js` is. Its one-write-per-document rule is held by
   review, and I broke it three times before catching it. **This is the
   highest-value gap in the test suite.**

4. **`orderLines` is capped at 1,000 live lines per business.** Far beyond
   any plausible floor, but a cap, and it fails by truncating rather than
   erroring.

5. **A line whose ticket is deleted outright is orphaned.** Only an owner
   can delete an order, and the UI offers cancel instead — but no cascade
   exists.

### Domain

6. **No independently-closed sub-checks.** Splitting is *move lines to a
   second ticket, charge each*. Four people wanting four receipts from one
   table is four tickets. Deliberate — a fourth entity between ticket and
   line was not worth it — but it is a limitation, not a feature.

7. **No deposits or part-payments on an open ticket.** A bakery taking
   50% on a custom cake cannot record it; the ticket is charged in full on
   collection. This is the clearest gap in the bakery model.

8. **Variance is measured, not derived.** FlowBiz stores a *current* stock
   level, not a history of one, so textbook `opening + purchases − closing`
   cannot be reconstructed for a past period without inventing numbers.
   What is reported — recorded waste plus what a count found missing — is
   measured, and the screen says which. It will understate variance in a
   business that does not count regularly.

9. **No serial-number tracking** (Electronics), **no appointments**
   (Salon/Barber), **no drive-through or kiosk flows** (QSR), **no
   customer-facing display**, **no keg or open-bottle weighing** (Bar).
   None claimed.

10. **No prescription or controlled-drug register** (Pharmacy). No
    regulatory claim is made, and `utils/batches.js` says so.

### Operational

11. **Indexes must be deployed before the client**, or the floor and
    kitchen queries fail.

12. **A device pinned to the kitchen still opens on the counter.** The
    permission model makes the *device role* real and enforced; the
    landing-page convenience was not built.

13. **The five new UI screens have no *committed* automated coverage.**
    They were driven end-to-end in a live browser during the follow-on
    rebuild — which found and fixed twelve bugs, including one that
    disabled every made-to-order dish on the till — but those journeys
    were not codified as a checked-in E2E suite. The domain beneath them
    now has 554 tests and the rules have 38.

14. **Seven pre-existing ESLint errors remain**, none in a file this work
    touched: four in `AdvancedAnalytics`, `InventoryIntelligence`,
    `Settings` and `Setup` (present at HEAD), and one unused import in
    `HeroSection` that arrived with the design-phase work already in the
    tree. Not introduced here, and not fixed here — out of scope.

---

## 12. Adding the sixteenth industry

1. Add an entry to `PROFILES` in `src/industry/profiles.js` — **defaults
   over existing capabilities only**.
2. Add the id to `INDUSTRY_PROFILE_IDS` in the Worker.
3. Add the id to `isKnownIndustryProfile` in `firestore.rules`.
4. Update the counts in `src/industry/config.test.js`.
5. `npm test`. The drift test fails if the three lists disagree.

No other file changes. If the trade needs behaviour no capability
expresses, that is a new capability (§10 of `docs/INDUSTRY.md`) — and if
it needs a workflow no *engine* expresses, that is a new engine beside
`domain/fnb`, which the dependency rule already makes safe.
