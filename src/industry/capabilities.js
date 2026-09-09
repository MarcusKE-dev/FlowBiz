// src/industry/capabilities.js
//
// The capability catalogue. A capability is a NAMED, ADDITIVE piece of
// behaviour — never an authorization boundary. Nothing in this file, and
// nothing derived from it, decides who may read or write anything: that
// stays entirely with Firebase Auth, the Firestore rules and the Worker's
// admin permission table. A capability only decides what the application
// OFFERS.
//
// Why a catalogue rather than `if (profile === 'PHARMACY')` scattered
// through the app: an industry is a marketing word, a capability is a
// behaviour. Restaurant, Café and Fast Food differ only in which of the
// SAME food capabilities are on by default, so they must not become three
// codebases. Everything downstream asks "is `batches` on?", never "is
// this a pharmacy?".
//
// `ownerConfigurable` is the safety valve on section 10 of the brief:
// owners may toggle presentation-and-workflow capabilities, but not the
// ones whose data model only makes sense as a whole (`orders`, `batches`).
// Those move only when the profile moves, or when a platform administrator
// changes them server-side.
//
// `requires` is a hard dependency: a capability whose prerequisite is off
// is itself off, no matter what a profile default or a stored override
// says. Resolution is in config.js and is deliberately the only place
// this is interpreted.

export const CAPABILITIES = {
  // ── Retail ────────────────────────────────────────────────────────
  units: {
    key: 'units',
    label: 'Measured units',
    description: 'Sell by metre, kilogram, litre and other units, with decimal quantities.',
    ownerConfigurable: true,
    requires: [],
  },
  variants: {
    key: 'variants',
    label: 'Product variants',
    description: 'One product with sizes, colours or styles, each holding its own stock.',
    ownerConfigurable: true,
    requires: [],
  },
  barcodeLabels: {
    key: 'barcodeLabels',
    label: 'Barcode labels',
    description: 'Print shelf and product labels for items that carry a barcode.',
    ownerConfigurable: true,
    requires: [],
  },

  // ── Services ──────────────────────────────────────────────────────
  services: {
    key: 'services',
    label: 'Services',
    description: 'Sell services alongside (or instead of) physical stock.',
    ownerConfigurable: true,
    requires: [],
  },

  // ── Food ──────────────────────────────────────────────────────────
  orders: {
    key: 'orders',
    family: 'FOOD',
    label: 'Open orders',
    description: 'Save an order, keep it open, add to it and charge it later.',
    ownerConfigurable: false,
    requires: [],
  },
  tables: {
    key: 'tables',
    family: 'FOOD',
    label: 'Tables',
    description: 'Give open orders table names such as Table 1, Table 2.',
    ownerConfigurable: true,
    requires: ['orders'],
  },
  modifiers: {
    key: 'modifiers',
    family: 'FOOD',
    label: 'Modifiers',
    description: 'Options on an item: extra cheese, no onions, large.',
    ownerConfigurable: true,
    requires: [],
  },
  diningModes: {
    key: 'diningModes',
    family: 'FOOD',
    label: 'Dining mode',
    description: 'Mark an order as dine in, takeaway or delivery.',
    ownerConfigurable: true,
    requires: ['orders'],
  },
  kitchen: {
    key: 'kitchen',
    family: 'FOOD',
    label: 'Kitchen status',
    description: 'Track an order through new, preparing, ready and completed.',
    ownerConfigurable: true,
    requires: ['orders'],
  },

  // ONE KITCHEN OR SEVERAL. A kitchen screen with no stations shows every
  // fired item on one rail, which is the right answer for a chip shop and
  // the wrong one for a restaurant where the grill, the cold section and
  // the bar are three people who each need to read only their own work.
  //
  // It is a separate capability from `kitchen` rather than a setting on
  // it, because turning it on is a real cost: somebody must name the
  // stations and then route every product to one. A business that has not
  // done that work should see the single rail, not twelve empty screens.
  //
  // The routing itself is already unconditional in the engine — a line
  // snapshots its station whether or not this is on — so switching it on
  // later starts filtering immediately, and switching it off collapses
  // back to one rail without losing anything.
  kitchenStations: {
    key: 'kitchenStations',
    family: 'FOOD',
    label: 'Kitchen sections',
    description: 'Send each item to the section that makes it: grill, cold, bar, pastry.',
    ownerConfigurable: true,
    requires: ['kitchen'],
  },

  // COURSES. When something is served, as opposed to where it is made.
  // Starters now, mains when the starters come back, dessert after that —
  // the pacing a table-service restaurant runs on and a counter does not.
  courses: {
    key: 'courses',
    family: 'FOOD',
    label: 'Courses',
    description: 'Pace a table: starters, mains, dessert, fired when the floor says so.',
    ownerConfigurable: true,
    requires: ['orders', 'tables'],
  },

  // WASTE. Spoilage, breakage, staff meals and comps — stock that left
  // without being sold. Every food business has it, including the ones
  // with no recipes: a chip shop throws away chips. So it is its own
  // capability rather than riding on `recipes`, which would have hidden
  // the page from exactly the fast-food business that needs it most.
  waste: {
    key: 'waste',
    family: 'FOOD',
    label: 'Waste',
    description: 'Record what was thrown away, broken, comped or eaten by staff, at cost.',
    ownerConfigurable: true,
    requires: [],
  },

  // ── Recipes and production ────────────────────────────────────────
  recipes: {
    key: 'recipes',
    family: 'FOOD',
    label: 'Recipes',
    description: 'Build an item from components, so selling it uses up its ingredients.',
    ownerConfigurable: true,
    requires: [],
  },
  production: {
    key: 'production',
    family: 'FOOD',
    label: 'Production',
    description: 'Bake or make a batch in advance: ingredients out, finished goods in.',
    ownerConfigurable: true,
    requires: ['recipes'],
  },

  // ── Pack sizes ────────────────────────────────────────────────────
  //
  // One capability rather than three, because three profiles turn out to
  // need exactly the same arithmetic: a pharmacy receives a box of 30 and
  // dispenses one tablet, a bar receives a 750ml bottle and pours 25 or
  // 30 tots from it, a liquor shop receives a crate of 24 and sells one
  // bottle. It is implemented as a conversion inside the single inventory
  // foundation, not as a second engine — see utils/inventory.js.
  //
  // It requires `units` because a pack size without units is a number
  // with nothing to be a number OF: the whole feature is the relationship
  // between two units, and with units off there is only one.
  packSizes: {
    key: 'packSizes',
    label: 'Pack and single',
    description: 'Buy in packs, crates or boxes and sell singles, with the conversion done for you.',
    ownerConfigurable: true,
    requires: ['units'],
  },

  // ── Age-restricted goods ──────────────────────────────────────────
  //
  // Kenya's Alcoholic Drinks Control Act, 2010 prohibits selling an
  // alcoholic drink to a person under eighteen. This capability marks the
  // products that carry that restriction and asks the person at the till
  // to confirm, once, before a cart containing one is charged.
  //
  // That is the WHOLE feature, deliberately. There is no ID scanning, no
  // licensing-hours enforcement and no compliance reporting, because
  // FlowBiz cannot verify any of them and a system that appeared to would
  // be worse than one that plainly does not. Nothing here is, or may be
  // described as, regulatory compliance: the responsibility for the sale
  // remains entirely the licensee's, and the prompt is a reminder to a
  // human being who is the one actually checking.
  ageRestriction: {
    key: 'ageRestriction',
    label: 'Age-restricted items',
    description: 'Mark items that may not be sold to under-18s, and confirm before charging them.',
    ownerConfigurable: true,
    requires: [],
  },

  // ── Pharmacy ──────────────────────────────────────────────────────
  batches: {
    key: 'batches',
    label: 'Batches and expiry',
    description: 'Receive stock in batches with an expiry date, and sell the earliest first.',
    ownerConfigurable: false,
    requires: [],
  },
  expiryAlerts: {
    key: 'expiryAlerts',
    label: 'Expiry alerts',
    description: 'Warn about batches that are close to expiry or already expired.',
    ownerConfigurable: true,
    requires: ['batches'],
  },
};

// WHICH TRADES ARE OFFERED A SWITCH.
//
// `family` scopes a capability to the profile family it was designed for.
// It is PRESENTATION SCOPING AND NOTHING ELSE: like every other field in
// this file it decides what FlowBiz offers, never who may read or write
// anything. A capability with no `family` is offered to every trade,
// which is the default and stays the default.
//
// The reason it exists: a hardware shop was being offered "Modifiers"
// (extra cheese, no onions) and "Recipes" (build an item from
// ingredients) in its own settings. Both are food-service ideas with
// nothing to configure in a shop selling timber by the metre, and a
// settings page full of switches that mean nothing for the business
// reading it is worse than one with fewer switches.
//
// Nothing is deleted and nothing is forced off — see
// ownerConfigurableCapabilities() in config.js for how an out-of-family
// capability that is somehow already ON stays visible so it can be turned
// off, rather than becoming a setting nobody can reach.
export function capabilityFamily(key) {
  return isKnownCapability(key) ? (CAPABILITIES[key].family || null) : null;
}

/** Is this capability offered to a business in `family`? */
export function isCapabilityInFamily(key, family) {
  const scope = capabilityFamily(key);
  return scope === null || scope === family;
}

export const CAPABILITY_KEYS = Object.keys(CAPABILITIES);

/** FlowBiz global defaults: every capability starts OFF. */
export const GLOBAL_CAPABILITY_DEFAULTS = Object.freeze(
  Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, false]))
);

export function isKnownCapability(key) {
  return Object.prototype.hasOwnProperty.call(CAPABILITIES, key);
}

export function isOwnerConfigurable(key) {
  return isKnownCapability(key) && CAPABILITIES[key].ownerConfigurable === true;
}
