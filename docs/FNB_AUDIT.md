# Food & Beverage: data audit, architecture, and what was done

**Scope.** The five F&B profiles: Restaurant, Café, Fast food / QSR, Bakery,
Bar / Pub. Nothing outside the FOOD family was changed. Wines & spirits
retail is deliberately *not* in scope. It is a shop that sells sealed
bottles, and it is correctly modelled as retail.

**Companion documents.** `docs/ARCHITECTURE.md` is the platform design
record. `docs/FNB_ARCHITECTURE.md` is the design record for the F&B engine
as written. **This document supersedes parts of it.** §1 below lists
where that document describes work that was never actually connected to
the running application.

**Status at the end of this pass.** 712 unit tests, 287 Worker tests and
68 Firestore-rules tests, all green. Clean production build. No new ESLint
error. Verified live in a browser against the Firebase emulator suite on
port 5273, as an owner and as a cashier, with every financial figure
re-derived from the persisted Firestore documents rather than read off the
screen.

---

## 1. The headline finding: a correct engine wired to nothing

`src/domain/fnb/` is ~2,600 lines across eleven modules, with 200+ passing
unit tests. It is good code. **Almost none of it was reachable from the
running application.**

A grep for every function the engine exports, against every screen:

| Engine module | Imported by a screen? |
|---|---|
| `catalog.js`, sellable vs ingredient | **No.** Nothing. |
| `costing.js`, recipe cost at sale | **No.** Nothing. |
| `lines.js`, `buildTicketLine` | Only by other engine modules |
| `ticketWrites.js`, the Firestore boundary | `Kitchen.jsx`, one function |
| `stations.js` | `Kitchen.jsx`, one function |
| `production.js` | **No.** Nothing. |
| `floor` / room reading | Did not exist |

This is a failure mode that no unit test can catch, because every
individual function was right. The consequences, each verified before it
was fixed:

**1.1 The counter writes a different order model than every other screen
reads.** `Counter.jsx`, the actual till, writes the *legacy* order: one
document with an `items` array and a single `kitchenStatus` for the whole
ticket. `useTickets`, `Kitchen.jsx` and the customer display all query
`orderLines`, the one-document-per-line collection. The counter has never
written a single `orderLines` document. **The kitchen screen was
structurally incapable of ever showing anything.**

**1.2 `orderLines` and `waste` had Firestore *indexes* and no *rules*.**
In Firestore, a collection with no rule is denied. Every read and every
write either collection has ever attempted was refused in production. The
features were not partly working; they were dark.

**1.3 `Waste.jsx` is a finished, styled page with no route.** Nothing in
`AppRouter.jsx` pointed at it. It could not be reached by any URL.

**1.4 The kitchen screen had no way in.** There was no `/kitchen` route,
no navigation entry, and the permission the page checks (`kitchen.update`)
did not exist in the permission catalogue. A cook could not open it.

**1.5 `ingredients` were sellable, and priced.** One `products`
collection, every row sellable by construction. A restaurant that models
its food properly puts tomatoes, flour and chicken breast in the
catalogue, and every one of them appeared on the till between "Chicken
burger" and "Coke". Worse, the add form *demanded* a selling price above
zero, so the owner invented one, and the invented number flowed into
margin and into every report that ranks what sells. `catalogRole` was
written to fix exactly this and was wired to nothing.

**1.6 Every sale booked COGS at the stored `costPrice`.** For a dish
assembled to order that number is meaningless. Nobody buys a
cheeseburger, they buy a bun, a patty and cheese. `sellingUnitCost()`
computes it correctly from the recipe. The sale path never called it.
Measured live: a cheeseburger showed **KES 850.00 margin** on a KES 850
sale. The truth is **KES 677.40**.

**1.7 Every made-to-order dish was greyed out and unclickable on the
till.** `ProductGrid` disabled any tile with `stock <= 0`. A dish
assembled to order has stock 0 *by design*, and its ingredients carry the
stock. A restaurant opened the counter and found its entire menu
disabled. This is ship-stopping, and `docs/FNB_ARCHITECTURE.md` §27 claims
it was fixed. It was not.

**1.8 Documentation drift.** `docs/FNB_ARCHITECTURE.md` describes twelve
bugs as "all twelve fixed, each reproduced before and after". Checked one
by one against the tree: **#1 (till tiles), #4 (ingredients sellable), #5
(modifier stock deltas, partly), and #11 (cost column) were not in the
code.** The document is a good description of an intended design; it is
not a record of the running application. Treat it as a design brief, and
this document as the state.

---

## 2. Everything else found, in order of damage

| # | Finding | Severity | Fixed |
|---|---|---|---|
| 1 | `orderLines` + `waste`: index, no rule → denied in production | **Blocking** | ✅ |
| 2 | Made-to-order dishes disabled on the till (`stock <= 0`) | **Blocking** | ✅ |
| 3 | Kitchen screen unreachable: no route, no nav, no permission | **Blocking** | ✅ |
| 4 | Kitchen screen read the raw line query, so legacy tickets never appeared | **Blocking** | ✅ |
| 5 | Sales booked COGS at `costPrice`, ignoring the recipe | Financial | ✅ |
| 6 | Ingredients sellable on the till; the form demanded a price | Domain | ✅ |
| 7 | The "Ready" button was a silent no-op on every ticket the counter writes | Domain | ✅ |
| 8 | Capability-gated URLs bounced to `/counter` on a cold load | **Blocking** | ✅ |
| 9 | `orderLines`/`waste` absent from backup, restore, reset and business purge | Data loss | ✅ |
| 10 | `Waste.jsx` had no route | Domain | ✅ |
| 11 | Menu cost column showed KES 0.00 for every recipe-costed dish | Reporting | ✅ |
| 12 | A `tot` could not be poured in halves; 1.5 tots deducted 1 | Financial | ✅ |
| 13 | `serviceChargeRate` had no server-side bound | Security | ✅ |
| 14 | No `orders.void` permission, so `orders.update` (on by default) granted voiding | **Security** | ✅ |
| 15 | No `orders.move` permission, so moving money between bills was ungoverned | Security | ✅ |
| 16 | `settings.stations` / `courses` / `floorPlan` unbounded on a doc every device reads | Security | ✅ |
| 17 | Kitchen ages never ticked; legacy tickets sorted *last* on an oldest-first rail | Domain | ✅ |
| 18 | No waiter screen, no floor plan, no customer display worth the name | Missing | ✅ |
| 19 | The purchase disclosure had vanished from the billing screen | Compliance | ✅ |

### 2.8 is worth its own paragraph

`ProtectedRoute` decided permission questions on the first frame. Every
capability-gated permission resolves against the industry configuration,
which rides on the `businessSettings` document, and on a cold load that
document has not arrived, so the resolver correctly answers *no* for one
render. The navigation survives that (it renders short and grows). **A
route guard cannot**: a redirect is a navigation, not a render, and once
it has fired the person is at `/counter` and nothing brings them back.

The symptom: `/orders`, `/kitchen`, `/floor`, `/waste`, `/production` and
`/expiry` all worked when reached by clicking a link and **bounced when
reached by a bookmark, a refresh, or a typed URL**, which is precisely
how a tablet bolted to a kitchen wall reaches `/kitchen`, every single
time it is switched on. This predates all F&B work and affected `/orders`
for every food business since open orders shipped.

The first attempt at the fix did nothing, and the reason is worth
recording: `SettingsProvider` reports `loading: false` when it has *no*
business id to listen to, which is every render before the user's profile
lands. "Not loading" and "answered for this business" are different
questions. The guard now waits for `settings.businessId === profile.businessId`.

---

## 3. Research: how these businesses actually run

Read against FlowBiz's hard constraints: **no server in the sale path,
must work offline, one shared Firestore listener budget.**

- **Square** versions the whole order and rejects a stale write. Correct
  when a server is in the path. FlowBiz's client writes Firestore
  directly and must work offline, and a Firestore transaction cannot run
  offline. **Rejected.**
- **Toast** models fulfillment **per item**, not per ticket, because a
  kitchen finishes a starter while a main is still on. **Adopted**, and it
  is what `orderLines` is for.
- **Lightspeed / Revel** separate *ingredient* from *menu item* as
  distinct catalogue entities. **Adopted in substance**, as a role on the
  row rather than a second collection (§5).
- **Every serious KDS** routes **per item to a station** and sorts
  **oldest-first**, because a cook works the oldest thing on the rail and
  a screen sorted any other way must be re-read on every change.
  **Adopted.**

---

## 4. The four screens, and what flows between them

The whole of F&B is four audiences looking at one ticket from four sides.
Nothing below is a status anybody sets twice.

```
                        ┌──────────────────────────────┐
                        │   products  (one collection) │
                        │   role: sellable |ingredient │
                        └───────┬──────────────┬───────┘
                    sellable    │              │  ingredient
                                ▼              ▼
   ╔══════════════╗      ┌─────────────┐  ┌──────────────┐
   ║  WAITER      ║      │ till grid   │  │ recipes,     │
   ║  /counter    ║─────▶│ categories  │  │ purchasing,  │
   ║  /floor      ║      │ scan        │  │ stock, waste │
   ╚══════╤═══════╝      └─────────────┘  └──────────────┘
          │ rings a line: snapshots price, COST FROM RECIPE,
          │ station, kitchen name, course
          ▼
   ┌──────────────────────────────────────────────────┐
   │  orders/{id}          the ticket header          │
   │  orderLines/{id}      ONE DOCUMENT PER LINE      │
   │                       fulfillment: new           │
   └───────┬──────────────────────────────────┬───────┘
           │ waiter fires  ──▶ sent           │
           ▼                                  ▼
   ╔══════════════╗                   ╔═══════════════════╗
   ║  KITCHEN     ║                   ║  CUSTOMER         ║
   ║  /kitchen    ║                   ║  /customer-display║
   ║              ║                   ║                   ║
   ║ per station  ║                   ║  room · menu ·    ║
   ║ oldest first ║                   ║  queue            ║
   ║ age timers   ║                   ║                   ║
   ╚══════╤═══════╝                   ╚═══════════════════╝
          │ cook taps READY  ──▶ ready         ▲
          │                                    │ same documents,
          ▼                                    │ no money, no names
   ╔══════════════╗                            │
   ║  WAITER      ║────────────────────────────┘
   ║  runs it     ║  taps SERVED ──▶ served
   ╚══════╤═══════╝
          │ charge
          ▼
   ┌──────────────────────────────────────────────────┐
   │  sales/{id}   +  stock deltas  (ONE batch)       │
   │  every line's lines closed and served            │
   └───────┬──────────────────────────────────────────┘
           ▼
   ╔══════════════════════════════════════════════════╗
   ║  OWNER  /dashboard /reports /waste /products      ║
   ║  true COGS · dish margin · waste at cost          ║
   ╚══════════════════════════════════════════════════╝
```

### 4.1 What each stage shows, in the customer's words

The kitchen and the customer do not use the same vocabulary, and the
translation happens once, in `domain/fnb/display.js`:

| Line state | Kitchen says | Customer display says |
|---|---|---|
| `new` | Not sent | **Ordered** |
| `sent` | Preparing | **Preparing** |
| `ready` | Ready (on the pass) | **Ready** |
| `served` | Served | *(leaves the board)* |

So: a waiter rings a burger → the customer's table reads **Ordered**. The
waiter fires it → **Preparing**, and it appears on the Grill rail with a
timer. The cook taps Ready → the table reads **Ready**, the board chimes,
and the waiter's floor screen shows it at the top under *On the pass*. The
waiter runs it and taps Served → it leaves every screen. Nobody set a
status twice, and no screen holds a copy of another screen's truth.

### 4.2 What the customer display must never show

It is the only screen in FlowBiz read by people who do not work for the
business. The people at Table 4 can read Table 5's screen. So the
derivation **drops, before the component sees it**: money, staff names,
order notes, modifiers, and which dish belongs to which table. This is
enforced by a test that serialises the derived board and asserts the
ticket's total, the server's name, the note and the dish names are all
absent, not by a styling choice a later redesign could undo.

### 4.3 Table state is derived, never stored

There is no `occupied` field, no `reserved`, no `needs cleaning`. **A
table is taken precisely while an open ticket carries its name.** Clearing
a table is charging its ticket, not remembering to press something
afterwards. The failure mode of the alternative is a restaurant that
cannot seat anybody on a Friday because six tables are stuck "occupied"
from last Friday.

The floor plan therefore holds only what cannot be derived: a name, a
zone, a seat count, a grid cell, an optional picture.

---

## 5. Data model

### 5.1 The one decision that shaped everything: role, not collection

`catalogRole ∈ {sellable, ingredient, both}` on `products`. **Absent means
sellable**, so not one existing document in any industry changes.

| Considered | Rejected because |
|---|---|
| A separate `ingredients` collection | Purchases, receiving, stock movements, stock takes, batches, expiry, waste, valuation, FEFO, export, import and reset are **identically correct** for a tomato and a Coke, and all are tested. A second collection forks all of it to express one boolean. |
| A separate `menuItems` collection | The same, mirrored, and it needs a join to inventory on every till render. |
| A boolean `isIngredient` | Cannot express **both**: the bakery that sells loose flour *and* bakes with it; the bar that sells a bottle whole *and* pours it by the tot. Both are real and common. |
| A `PrepItem` entity | Nothing distinguishes it from "an ingredient with a recipe". Two ways to model one thing. |

A **prep item**, whether tomato sauce, pizza dough or a batch of stock, falls out
of the model rather than needing a fourth entity: *an ingredient that is
itself made from other ingredients.*

### 5.2 Fields, all additive and absent-tolerant

| Collection | Field | Meaning |
|---|---|---|
| `products` | `catalogRole` | sellable / ingredient / both. Absent = sellable |
| `products` | `kitchenName` | What the pass calls it. A menu says "Chef's Special" |
| `products` | `station` | Which kitchen section makes it |
| `products` | `routable` | `false` = never reaches a kitchen screen (a bottled drink) |
| `orderLines` | one doc per line | `fulfillment`, `station`, `routed`, `course`, `firedAt`/`readyAt`/`servedAt` |
| `businessSettings` | `floorPlan` | `[{name, x, y, zone?, seats?, image?}]`, ≤ 100 |
| `businessSettings` | `stations` | `[{id, name}]`, ≤ 12 |
| `businessSettings` | `courses` | `[{id, name}]`, ≤ 8 |
| `businessSettings` | `serviceChargeRate` | 0–30, **now bounded server-side** |

**No migration is required and none was written.**

### 5.3 What is SOLD and what is USED round differently

Sales round to the unit's own precision, which is the retail contract, unchanged.
Recipe consumption rounds to three decimals, because 0.25 of a lime is a
real quantity and truncating it to 0 silently consumed nothing.

The `tot` is the one *count* unit that divides, and it now carries three
decimals. A bottle and a crate do not: half a Tusker is not a thing a bar
can hold, so receiving half a crate of 25 books 12 bottles. But a tot is a
measure of **liquid**, and half of one is 12.5 ml sitting in the same bottle
it was always in. Two cases make this load-bearing: a cocktail calling for
1.5 tots of gin (which truncated to 1 and under-deducted on every round),
and half a bottle received, which is 62.5 tots and not 62.

---

## 6. Per-industry architecture

The capability matrix after this pass:

| capability | Restaurant | Café | Fast food | Bakery | Bar |
|---|---|---|---|---|---|
| `orders` | ON | ON | ON | · | ON |
| `tables` | ON | · | · | · | ON |
| `modifiers` | ON | ON | ON | · | ON |
| `diningModes` | ON | ON | ON | · | ON |
| `kitchen` | ON | ON | ON | · | · |
| `kitchenStations` | **ON** | **ON** | · | · | · |
| `courses` | **ON** | · | · | · | · |
| `waste` | **ON** | **ON** | **ON** | **ON** | **ON** |
| `recipes` | ON | ON | · | ON | ON |
| `production` | · | · | · | ON | · |
| `units` | · | · | · | ON | ON |
| `packSizes` | · | · | · | · | ON |
| `ageRestriction` | · | · | · | · | ON |

**Bold** = added in this pass. Every one is owner-configurable: these are
*defaults for a trade*, never limits on a business.

### 6.1 Restaurant: the reference implementation

Table service, and the only profile that needs all four screens at once.

- **Floor** (`/floor`): the room, by zone, with what is on the pass at the
  top. Tap an occupied table to open its ticket; tap a free one to start a
  cart already seated there.
- **Counter**: rings against the ticket. Ingredients are not on the grid.
  A dish's cost is computed from its recipe at the moment it is rung.
- **Kitchen** (`/kitchen`): per-station rails (Grill / Cold section / Bar),
  oldest first, item-level, with age timers that actually tick and a
  ten/twenty-minute colour threshold.
- **Customer display**: room on the left, menu reel in the centre, queue
  on the right.
- **Courses** pace the table: starters fire now, mains when the floor says
  so. The data model and `groupByCourse` are in place; **the firing UI is
  not built yet** (§8).

### 6.2 Café: the restaurant architecture, minus the room

A café is a restaurant that does not seat by table. `tables` off, so the
floor screen and the room panel of the customer display disappear on their
own and the queue takes the space. **No second architecture is needed, and
none was written.**

What it does need and now has: `kitchenStations`, because an espresso bar
and a food pass are two people who should not read each other's work. And
`routable: false` on a pastry taken off the shelf, so it fires straight to
READY rather than sitting on a screen nobody watches.

The **modifier-as-recipe-delta** matters most here: "oat milk instead of
dairy" is `−1 dairy, +1 oat`, so both the cost and the stock follow the
choice. Without it a café's milk stock is a number nobody maintains.

### 6.3 Fast food / QSR: the same architecture, tuned for speed

Counter service, no tables, no courses. The customer display becomes a
**token board**: the queue takes the full right-hand side and *Ready* is
the largest type on the screen.

The corrections that mattered here were the till-tile fix (every tile was
disabled) and reaching the kitchen screen at all.

**`recipes` is OFF by default for QSR, and that is a decision worth
revisiting.** The reasoning was speed of setup. But a burger chain has
exactly the ingredient-costing problem a restaurant has, and with recipes
off its COGS is whatever somebody typed into `costPrice`. It is one
toggle in Customize, and the recommendation is to turn it on. See §8.

### 6.4 Bakery: production, not service

Fundamentally different, and correctly so: a bakery **makes in advance**
and sells off a shelf.

- `production` ON: a run takes flour, yeast and sugar out and puts
  finished loaves in, with yield and short-yield costing.
- `producedInAdvance` on the item is what stops the double-deduction: the
  run consumed the ingredients, so **selling a loaf takes only the loaf**.
  A bakery item therefore *does* show "Out of stock" at zero, where a
  made-to-order dish does not, and both are correct.
- `orders` OFF, so no kitchen screen and no customer display.

**The real bakery gap: pre-orders.** A birthday cake ordered on Tuesday
for Saturday is core bakery trade, and with `orders` off it cannot be
taken. Turning `orders` on gives the ticket; what is missing is a
*promised-for* date on it. See §8.

**Second gap: shelf life.** `batches` and `expiryAlerts` are off for every
F&B profile. Bread has a shelf life measured in hours. The batch and FEFO
machinery already exists and is tested. This is a default, not a build.

### 6.5 Bar / Pub: tabs and pours

A bar is a restaurant that sells drinks: same tickets, same modifiers,
same recipes. It earns a *profile*, not an engine.

- `tables` ON, because a tab is named, and a table name is the cheapest honest
  name for it. An owner running stools turns it off.
- `kitchen` OFF by default, because bar snacks are optional, and a kitchen queue
  in a bar with no kitchen is a column nobody fills in.
- `packSizes` ON, the bottle-to-tot conversion. A 750 ml bottle is 25
  tots at a 30 ml pour or 30 at 25 ml, and **both houses exist**, so the
  number lives on the product, not in a constant.
- The terms change: an order is a **tab**.
- A cocktail is a recipe. Selling a Dawa takes gin out of the gin bottle
  instead of leaving a number nobody maintains, and now takes 1.5 tots
  when the recipe says 1.5 tots.

**Happy hour and price levels are deliberately absent**, and a test
asserts those capability names do not exist. Time-varying prices need a
pricing engine, an audit trail of which price applied to which sale, and a
clock the offline client cannot be trusted with. It is a real feature and
it is not a capability flag.

---

## 7. What was built or changed in this pass

### 7.1 The Firestore boundary

- **`orderLines` rules**, in four branches, one per thing that can happen
  to a line. This separation is the entire reason a line is its own
  document, and it is defeated the moment one rule waves all four through:
  - **amend**: `orders.update` (on by default)
  - **fire**: `kitchen.update` (on by default), `hasOnly` five fields:
    `fulfillment`, `firedAt`, `readyAt`, `servedAt`, `updatedAt`
  - **void**: `orders.void` (**off** by default), `hasOnly` the void
    fields, so a void cannot smuggle a price change in with it
  - **move**: `orders.move` (on by default), needs `orders.update` too
  - **delete**: owner only. A void is the record and it is kept.
- **`waste` rules**: created by whoever counts stock, **amended by
  nobody**, deleted by the owner alone. A waste line an employee can edit
  after the fact is a shrinkage report that reports whatever the employee
  prefers.
- **Bounds** on `floorPlan` (≤100), `stations` (≤12), `courses` (≤8) and
  `serviceChargeRate` (0 to 30). All of them ride on a document every device reads.

**Why `orders.void` is the important one.** Ring it, serve it, void it,
keep the cash is the oldest trick in hospitality. `orders.update` is on by
default, so while amending also granted voiding, the one permission an
owner most wants to withhold was one nobody ever had.

### 7.2 New permissions and capabilities

`kitchen.update`, `orders.void`, `orders.move`, `stock.waste`;
`kitchenStations`, `courses`, `waste`. Each is mirrored in all three
enforcement copies (client catalogue, `firestore.rules`, the Worker) and
the existing drift tests hold them in step.

`kitchen.update` is **on by default**, unlike most of what is off here,
because the people who use it are the people it is for. A business that
must visit the Team page before its cooks can bump a ticket will conclude
the kitchen screen is broken. It is safe to leave open because the rule
permits exactly five fields.

`stock.waste` is also on by default: the person who drops the tray is the
person who records it. Safe because a waste line **cannot be edited**
afterwards by anyone but the owner. Recording something is not the same
power as being able to change what was recorded.

### 7.3 New code

| File | Lines | What |
|---|---|---|
| `domain/fnb/floor.js` | 224 | Floor plan: arrangement only, reconciled against the table list |
| `domain/fnb/display.js` | 190 | What the customer sees, derived, with the privacy rules |
| `pages/Floor.jsx` | 287 | The waiter's screen |
| `pages/CustomerDisplay.jsx` | 578 | Rebuilt: room · menu reel · queue |
| `components/customize/FloorPlanEditor.jsx` | 237 | Tap-to-place room arrangement |
| `domain/fnb/floor.test.js` | 13 tests | |
| `domain/fnb/display.test.js` | 17 tests | |
| `domain/fnb/wiring.test.js` | 19 tests | **Guards the failure mode in §1** |

### 7.4 Button feedback on the kitchen screen

The old bump button answered none of the three questions a cook has:
did my tap register, is it still working, did it happen. It rendered
"Ready", took a tap, and looked identical for however long the write took,
so the natural thing to do was tap it again. Worse, a single `busy` flag
disabled EVERY button on the rail while any one write was in flight, which
in a kitchen with three cooks is indistinguishable from the screen
freezing.

It is now per line, with three states: idle, a spinner in the button
itself while the write is in flight, and a tick with the past tense held
for a moment afterwards. Plus a toast naming what moved, because a rail
can hold a dozen identical looking rows. The held tick matters more than
it looks: bumping the last item on a ticket removes the whole card, so
without it the only feedback for a successful tap is the thing you tapped
disappearing, which reads exactly like a crash.

### 7.4b The demo can run as a restaurant

The demo was one hard-coded electronics shop, which cannot show a kitchen
screen, a floor or a customer display at all. It is now dataset-driven:
`src/demo/datasets.js` holds the content, `seedData.js` the machinery, and
Settings carries a demo-only "Try another business" switch that wipes and
rebuilds as the chosen trade.

The restaurant dataset is 14 ingredients, 17 menu items with real recipes,
8 tables in 2 zones, 3 kitchen sections, 3 courses, and **three tickets
already open** at different stages, in **both** storage shapes, so every
screen has something to show the moment it loads and the whole-ticket
fallback is exercised alongside the per-item path. Verified live: recipe
costs resolve (Cheeseburger 175.60, Chips 39.50, Nyama choma 339.00),
ingredients stay off the till, and switching back restores the shop demo
exactly.

Demo only. A real business's trade is chosen once at Setup and moved only
by a platform administrator, server side.

### 7.4c No em dashes in anything a person reads

Every user-visible em dash in the application was replaced, and the
sentences were rewritten rather than mechanically hyphenated. Code
comments were left alone: 1054 of the 1054 remaining are in comments, and
a regex sweep across 196 files would be a large diff with no functional
value and real risk.

### 7.4d `wiring.test.js` deserves a note

Every finding in §1 was invisible to a unit test, because every function
was individually correct. `wiring.test.js` makes those connections
assertable:

- every page in `src/pages` has a route (this alone catches §1.3);
- every collection with an index has a rule (catches §1.2);
- every collection the client writes is on all four data lists: export,
  import, reset, and the Worker's business purge;
- thirteen named engine functions are each called by the screen whose
  correctness depends on them (catches §1.5, §1.6, §1.7);
- the kitchen builds its rail from the tickets, not the raw line query;
- the customer display never reads a ticket total, a staff name, a note,
  or a dish name.

Each assertion was verified to fail when the wire is cut.

### 7.5 The customer display

**Layout: tables, menu, tables.** The room splits down the middle so the
menu runs between the two halves rather than being pushed to one edge.
Eight tables is four each side; twenty is ten each side; an odd count puts
the extra card on the left. The centre column is the widest because it is
the one holding a photograph.

A business with **no tables** gets the same three regions with the same
menu in the middle, and the sides become the queue instead: PREPARING
left, READY right. So fast food, cafe and bar all get a correct board with
no second page written for any of them, and the layout follows the
capability rather than the profile id.

**It scales with the screen, not with a breakpoint.** A 55 inch panel and
a 27 inch monitor both report a wide viewport and no media query can tell
them apart, so the root size is a fluid `clamp()` on viewport WIDTH:
roughly 15.8px at 1280, 19.4px at 1920, 24.9px at 2560. Everything inside
is in `em`. On top of that sits a per-device multiplier for viewing
distance, which nothing in the browser can measure. Measured at all three
widths.

**Table cards are large and carry their own state.** The name is the
biggest thing on the card, with the one word answering "how is my food
doing" and the minutes it has waited beneath it. Free tables are dashed
outlines rather than filled cards, so occupancy reads as fill density
before a single word is read. READY is the only loud state: filled, ringed
and glowing, because it is the only one asking anybody to do anything.

**No table photographs.** Considered and dropped: a picture behind eight
cards is decoration competing with the one thing the card exists to say.
The menu photographs, which are the point, are the ones that got the room.



Three regions, because a customer arriving has three questions and they
are not the same question: **where can I sit / what is there / is mine
ready.** Room left, menu reel centre, queue right. A business with no
tables loses the left region and the queue grows into it.

- Scales with one control, remembered per device, because a 55-inch screen
  five metres away and a 10-inch tablet on a counter are the same page at
  very different sizes and no media query can tell them apart, because both
  report a wide viewport.
- The chime compares **identities, not counts**. One order collected and
  another finished between two snapshots leaves the count unchanged, and a
  count-based chime announces the new one to nobody.
- The menu reel puts photographed items first: this panel is the size of a
  television, and an item with no picture is a name floating in a large
  empty rectangle. Items with no photo fill in only when there are too few
  photographed ones to make a rotation.
- Controls fade out after six seconds. A television on a wall should not
  permanently display a settings button.

---

## 8. What is still missing, in priority order

Nothing below is broken. All of it is absent.

**P1: the counter still writes the legacy order model.** This is the
biggest remaining item and everything else is smaller. Today a ticket is
one document with an `items` array and one `kitchenStatus`, so:
per-item firing, per-item station routing, course pacing, split checks and
safe multi-device editing of the same table are all unavailable in
practice. The engine that does all of it is written, tested and now
reachable; `readTicket()` already presents both models, so the migration
is *additive*. `Counter.jsx` calls `addTicketLines()` instead of
`buildOrderDocument()`, existing tickets keep working, and no data moves.
Every screen downstream is already correct for both. Until then, the
kitchen and customer screens work at whole-ticket granularity, which is
honest but coarse.

**P2: course firing.** The capability, the settings editor, the storage
and `groupByCourse` all exist. What is missing is the button: *fire the
starters now, hold the mains.* Depends on P1.

**P3: split and merge checks.** `planLineMove()` is written and tested;
`orders.move` now governs it; `TicketPanel.jsx` and
`TicketCheckoutModal.jsx` are complete, orphaned components. Wiring them
up is a screen, not an engine. Depends on P1.

**P4: bakery pre-orders.** Turn `orders` on for BAKERY and add a
*promised for* date to the ticket. A birthday cake ordered Tuesday for
Saturday is core bakery trade and cannot currently be taken.

**P5: shelf life for bakery.** `batches` and `expiryAlerts` are off for
every F&B profile. Bread has a shelf life measured in hours, and the
batch/FEFO machinery exists and is tested. This is a default, not a build.

**P6: QSR combos and sequential order numbers.** A combo is a menu item
whose recipe is other *menu items*, so the model already supports it; what
is missing is the builder UI and combo pricing. Sequential order numbers
need a device-identity scheme to stay collision-free offline; names are
currently time-based.

**P7: recipes ON by default for fast food.** A burger chain has a
restaurant's ingredient-costing problem. One line in `profiles.js`.

**P8: ingredient photos in the recipe picker.**
Product photos already work for every row including ingredients, since an
ingredient *is* a product. What is missing is showing them in the recipe
component picker.

**P9: a committed browser E2E suite.** This session's journeys were
driven by hand against the emulator. `wiring.test.js` closes the largest
gap cheaply, but Playwright specs for the four screens would be better.

**P10: `ticketWrites.js` has no unit tests.** It is the Firestore
boundary and its one-write-per-document rule is held by review alone.
This session added `advanceLegacyTicket` to it without adding coverage.

---

## 9. Known limitations that are decisions, not gaps

1. **The ticket header's `costOfGoodsSold` accumulates a float artefact**
   (e.g. `173.04999999999998`). Deliberately left: it is a *cache*: the
   check screen totals the lines and `recomputeHeader` heals it, and
   rounding it needs read-before-write, which destroys the commutative
   `increment()` property the entire multi-device design rests on. Fixing
   it correctly means moving COGS off the header, not rounding it.
2. **No optimistic concurrency on a ticket.** Square's model, rejected
   because it fails offline. Same-line last-write-wins stands.
3. **No happy hour, price levels, reservations, loyalty or delivery
   integration.** All real; none is a capability flag. A test asserts
   those names do not exist so that nobody adds a switch with nothing
   behind it.
4. **A recipe cycle terminates at depth 3** and reports a cost that is
   wrong rather than raising an error.
5. **Modifier option recipes are capped at 4 lines** with no UI signal at
   the cap.
6. **Table pictures are URLs, not uploads.** Product photos have a storage
   path, an entitlement and a sidecar collection behind them; a decorative
   image on a customer display does not justify a second one.

---

## 10. Test evidence

**Unit:** 712 (up from 662; 5 were failing at the start of this pass).
**Worker:** 287. **Firestore rules:** 68, including eleven `orderLines`
and `waste` tests that had been written as a specification and could never
have passed, because the rules they describe did not exist.

**Live, against the emulator on :5273**, as an owner and as a cashier-cook,
with a seeded restaurant (8 tables in 2 zones, 3 stations, 3 courses, 6
ingredients, 6 menu items, one legacy ticket and one lines-model ticket):

| Claim | Evidence |
|---|---|
| Ingredients are off the till | Grid showed exactly the 6 menu items; the *Ingredients* category was not offered |
| Made-to-order dishes are sellable | Cheeseburger, Chips and Garden salad all enabled at stock 0 |
| COGS comes from the recipe | Sale persisted `costOfGoodsSold: 172.6`, `profit: 677.4` on an 850 sale |
| Ingredients are actually deducted | beef 12.5 → **12.32** (−0.18 kg), buns 180 → **179**, cheese 240 → **238** |
| The menu cost column is true | Cheeseburger **KES 172.60**, Chips **KES 39.50** (22.50 potato + 17.00 oil) |
| The kitchen shows legacy tickets | Table 2 (`items` array) appeared on the rail alongside Terrace 1 (`orderLines`) |
| The Ready button writes | `orders/o-legacy.kitchenStatus` went `preparing` → `ready` in Firestore |
| The floor reads both models | Table 2 *Preparing* KES 1,300 · Terrace 1 *Ready* KES 1,200, with zones |
| A cook can open the kitchen | Cashier reached `/kitchen` by direct URL and bumped a line |
| A cook cannot use it as a till | With `orders.update` off: fire **200**; price **403**; quantity **403**; move **403** |
| A cook cannot void | `orders.void` off by default → **403** |
| A cook can record waste but not rewrite it | create **200**, then amend **403** |
| Denials still deny | `/reports`, `/purchases`, `/stock-take`, `/close-day` all still redirect a cashier |
| The customer display shows no money | Rendered board carried table names, stages and wait times only |

Every financial figure above was re-derived by hand from the persisted
documents rather than read off the screen.

**No production data and no real customer account was touched at any
point.** Everything ran against the local emulator suite on the ports the
project reserves for testing.
