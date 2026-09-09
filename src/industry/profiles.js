// src/industry/profiles.js
//
// The fifteen business profiles. A profile is a NAMED SET OF
// DEFAULTS — nothing more. It contributes capability defaults, wording,
// a dashboard running order and a starting category list; it never gates
// access, never owns data, and never appears in a conditional outside
// this module. Switching profile therefore changes what FlowBiz offers
// and never what it has already recorded.
//
// Families exist so that Restaurant, Café and Fast Food are three sets of
// defaults over ONE food capability family rather than three engines, and
// so General Retail and Supermarket share one retail foundation. Adding a
// fourteenth profile means adding an entry here — not a branch anywhere
// else in the app.
//
// GENERAL_RETAIL is the protected baseline: every capability off, every
// term the word FlowBiz already used, the dashboard exactly as it was.
// A business with no stored profile resolves to it, which is what keeps
// every existing business working untouched.

import { DEFAULT_UNIT } from './units.js';

export const FAMILIES = {
  RETAIL:      { id: 'RETAIL',      label: 'Retail'      },
  FOOD:        { id: 'FOOD',        label: 'Food'        },
  SERVICES:    { id: 'SERVICES',    label: 'Services'    },
  SPECIALIZED: { id: 'SPECIALIZED', label: 'Specialised' },
};

// The wording every profile starts from. A profile overrides only the
// terms that genuinely read wrong for it — a restaurant has a Menu, a
// salon sells Services and products. Everything else stays FlowBiz's
// existing vocabulary so the product still feels like one product.
const BASE_TERMS = {
  catalogue: 'Products',
  catalogueItem: 'product',
  catalogueItemPlural: 'products',
  addCatalogueItem: 'Add product',
  catalogueDescription: 'Everything you sell, what it costs and what is left.',
  // What an open ticket is called. A restaurant has orders, a bar has
  // tabs, and they are the SAME document — only the word changes, so the
  // route, the collection and every capability stay exactly as they are.
  order: 'order',
  orderPlural: 'orders',
  orders: 'Orders',
  openOrders: 'Open orders',
  newOrder: 'New order',
  saveOrder: 'Save order',
  updateOrder: 'Update order',
};

const RETAIL_CATEGORIES = [
  'Beverages', 'Hardware', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other',
];

// Dashboard widget ids, resolved by the dashboard itself. Order is the
// running order on screen. `moneyToday` and `activity` bracket every
// profile — what came in, and what happened — because that is the
// question every owner asks first and last regardless of trade.
const RETAIL_DASHBOARD = ['moneyToday', 'position', 'activity'];

// When the counter offers its category row.
//
// A shop finds things by scrolling or by scanning, so the filter is
// clutter until the catalogue is big enough that scrolling stops working
// — that is what the count threshold expresses, and General Retail keeps
// it exactly as it was.
//
// A MENU is different in kind, not in size. Nobody scans a plate of food,
// and a 25-item menu read as one flat list is genuinely slower to work
// than four short groups, because the person at the till is thinking in
// "starters, mains, drinks" and not in alphabetical order. So the food
// family shows its groups from the first item.
export const CATEGORY_FILTER_ALWAYS = 0;
export const CATEGORY_FILTER_COUNT = 40;

// WHAT A TRADE RECOMMENDS FOR ITS CASHIERS.
//
// `cashierDefaults` may only RAISE a permission above the base default in
// src/industry/permissions.js — never lower one — because the base is
// what the counter needs in order to work at all and is what
// firestore.rules is written against. It is a recommendation, not a
// ceiling: the owner's own choices are resolved on top of it, so two
// restaurants can run their cashiers completely differently.
const FOOD_CASHIER_DEFAULTS = { 'catalogue.view': true };
const SERVICE_CASHIER_DEFAULTS = { 'catalogue.view': true };


export const PROFILES = {
  // ── Retail family ─────────────────────────────────────────────────
  GENERAL_RETAIL: {
    id: 'GENERAL_RETAIL',
    label: 'General retail / Shop',
    family: 'RETAIL',
    tagline: 'A general shop selling everyday goods by the piece.',
    capabilities: {},
    terms: {},
    units: [DEFAULT_UNIT],
    categories: RETAIL_CATEGORIES,
    dashboard: RETAIL_DASHBOARD,
    hiddenNav: [],
  },

  SUPERMARKET: {
    id: 'SUPERMARKET',
    label: 'Supermarket',
    family: 'RETAIL',
    tagline: 'High item counts, fast barcode checkout, tight stock control.',
    capabilities: { barcodeLabels: true, units: true },
    terms: {},
    units: [DEFAULT_UNIT, 'kilogram', 'gram', 'litre', 'millilitre', 'box', 'carton'],
    categories: [
      'Groceries', 'Fresh Produce', 'Dairy', 'Bakery', 'Beverages', 'Frozen',
      'Household', 'Personal Care', 'Baby', 'Stationery', 'Airtime/Float', 'Other',
    ],
    dashboard: ['moneyToday', 'position', 'lowStock', 'activity'],
    hiddenNav: [],
  },

  HARDWARE: {
    id: 'HARDWARE',
    label: 'Hardware',
    family: 'RETAIL',
    tagline: 'Goods sold by the metre, the kilo and the piece.',
    capabilities: { units: true, barcodeLabels: true },
    terms: {},
    units: [DEFAULT_UNIT, 'metre', 'foot', 'inch', 'centimetre', 'kilogram', 'gram', 'litre', 'millilitre', 'pair', 'box', 'carton'],
    categories: [
      'Building Materials', 'Timber', 'Plumbing', 'Electrical', 'Paint',
      'Fasteners', 'Tools', 'Cables', 'Roofing', 'Other',
    ],
    dashboard: ['moneyToday', 'position', 'lowStock', 'activity'],
    hiddenNav: [],
  },

  BOUTIQUE: {
    id: 'BOUTIQUE',
    label: 'Boutique / Fashion',
    family: 'RETAIL',
    tagline: 'Clothing and footwear stocked by size and colour.',
    capabilities: { variants: true },
    terms: {},
    units: [DEFAULT_UNIT, 'pair'],
    categories: [
      'Dresses', 'Tops', 'Trousers', 'Outerwear', 'Footwear',
      'Bags', 'Accessories', 'Children', 'Other',
    ],
    dashboard: RETAIL_DASHBOARD,
    hiddenNav: [],
  },

  ELECTRONICS: {
    id: 'ELECTRONICS',
    label: 'Electronics',
    family: 'RETAIL',
    tagline: 'Devices and accessories, with colour and capacity options.',
    capabilities: { variants: true, barcodeLabels: true },
    terms: {},
    units: [DEFAULT_UNIT, 'pair', 'metre', 'box'],
    categories: [
      'Phones', 'Computers', 'TV & Audio', 'Accessories', 'Cables & Chargers',
      'Storage', 'Small Appliances', 'Other',
    ],
    dashboard: RETAIL_DASHBOARD,
    hiddenNav: [],
  },

  // WINES AND SPIRITS
  //
  // A liquor shop sells SEALED stock, and that single fact is what makes
  // it retail rather than food. Nothing is poured, nothing is made and
  // nothing is served, so there are no orders, no tables and no recipes:
  // a customer picks a bottle, pays, and leaves.
  //
  //   barcodeLabels ON — the trade is branded, barcoded stock across many
  //                      sizes and price points, and scanning is how a
  //                      shop keeps a Friday queue moving.
  //   units ON         — bottles, crates and cartons are how it is
  //                      counted, and none of them is a "piece".
  //   packSizes ON     — the crate-to-bottle conversion. A Kenyan beer
  //                      crate is 25 bottles and a spirits case is 12 or
  //                      24, so the number belongs on the product rather
  //                      than being assumed.
  //   variants OFF     — a 250ml and a 750ml of the same brand are two
  //                      products with two barcodes and two prices, not
  //                      two sizes of one. Modelling them as versions
  //                      would put both behind one tile and one scan.
  //   orders OFF       — nothing is left open.
  //   ageRestriction ON
  WINES_AND_SPIRITS: {
    id: 'WINES_AND_SPIRITS',
    label: 'Wines & spirits',
    family: 'RETAIL',
    tagline: 'Sealed stock sold by the bottle, the crate and the carton.',
    capabilities: {
      barcodeLabels: true, units: true, packSizes: true,
      variants: false, orders: false, ageRestriction: true,
    },
    terms: {
      catalogueDescription: 'Everything on the shelf, what it costs and what is left.',
    },
    units: [DEFAULT_UNIT, 'bottle', 'crate', 'carton', 'box', 'millilitre', 'litre'],
    categories: [
      'Beer', 'Spirits', 'Wine', 'Ready to Drink', 'Soft Drinks', 'Mixers',
      'Cigarettes', 'Snacks', 'Other',
    ],
    dashboard: ['moneyToday', 'position', 'lowStock', 'activity'],
    hiddenNav: [],
  },

  // ── Food family ───────────────────────────────────────────────────
  RESTAURANT: {
    id: 'RESTAURANT',
    label: 'Restaurant',
    family: 'FOOD',
    tagline: 'Table service with open orders, modifiers and a kitchen queue.',
    capabilities: {
      orders: true, tables: true, modifiers: true, diningModes: true,
      kitchen: true, kitchenStations: true, courses: true, recipes: true,
      waste: true,
    },
    terms: {
      catalogue: 'Menu',
      catalogueItem: 'menu item',
      catalogueItemPlural: 'menu items',
      addCatalogueItem: 'Add menu item',
      catalogueDescription: 'Everything on the menu, its price and what it uses.',
    },
    units: [DEFAULT_UNIT, 'kilogram', 'gram', 'litre', 'millilitre'],
    categories: ['Starters', 'Main Course', 'Grill', 'Sides', 'Salads', 'Desserts', 'Soft Drinks', 'Hot Drinks', 'Other'],
    dashboard: ['moneyToday', 'openOrders', 'kitchenQueue', 'position', 'activity'],
    categoryFilterThreshold: CATEGORY_FILTER_ALWAYS,
    cashierDefaults: FOOD_CASHIER_DEFAULTS,
    hiddenNav: [],
  },

  CAFE: {
    id: 'CAFE',
    label: 'Café',
    family: 'FOOD',
    tagline: 'Counter service with modifiers, and tables when you want them.',
    capabilities: {
      orders: true, tables: false, modifiers: true, diningModes: true,
      kitchen: true, kitchenStations: true, recipes: true, waste: true,
    },
    terms: {
      catalogue: 'Menu',
      catalogueItem: 'menu item',
      catalogueItemPlural: 'menu items',
      addCatalogueItem: 'Add menu item',
      catalogueDescription: 'Everything on the menu, its price and what it uses.',
    },
    units: [DEFAULT_UNIT, 'kilogram', 'gram', 'litre', 'millilitre'],
    categories: ['Coffee', 'Tea', 'Cold Drinks', 'Pastries', 'Sandwiches', 'Breakfast', 'Snacks', 'Other'],
    dashboard: ['moneyToday', 'openOrders', 'kitchenQueue', 'position', 'activity'],
    categoryFilterThreshold: CATEGORY_FILTER_ALWAYS,
    cashierDefaults: FOOD_CASHIER_DEFAULTS,
    hiddenNav: [],
  },

  FAST_FOOD: {
    id: 'FAST_FOOD',
    label: 'Fast food',
    family: 'FOOD',
    tagline: 'Order, modify, fire to the kitchen, charge. No tables.',
    capabilities: {
      orders: true, tables: false, modifiers: true, diningModes: true,
      kitchen: true, recipes: false, waste: true,
    },
    terms: {
      catalogue: 'Menu',
      catalogueItem: 'menu item',
      catalogueItemPlural: 'menu items',
      addCatalogueItem: 'Add menu item',
      catalogueDescription: 'Everything on the menu and what it sells for.',
    },
    units: [DEFAULT_UNIT],
    categories: ['Burgers', 'Chicken', 'Fries & Sides', 'Wraps', 'Combos', 'Drinks', 'Desserts', 'Other'],
    dashboard: ['moneyToday', 'openOrders', 'kitchenQueue', 'activity'],
    categoryFilterThreshold: CATEGORY_FILTER_ALWAYS,
    cashierDefaults: FOOD_CASHIER_DEFAULTS,
    hiddenNav: [],
  },

  BAKERY: {
    id: 'BAKERY',
    label: 'Bakery',
    family: 'FOOD',
    tagline: 'Bake in advance: ingredients out, finished goods in.',
    capabilities: { recipes: true, production: true, units: true, waste: true },
    terms: {
      catalogueDescription: 'Ingredients and finished goods, what they cost and what is left.',
    },
    units: [DEFAULT_UNIT, 'kilogram', 'gram', 'litre', 'millilitre', 'box', 'carton'],
    categories: ['Bread', 'Cakes', 'Pastries', 'Biscuits', 'Savouries', 'Ingredients', 'Packaging', 'Other'],
    dashboard: ['moneyToday', 'productionToday', 'position', 'lowStock', 'activity'],
    categoryFilterThreshold: CATEGORY_FILTER_ALWAYS,
    hiddenNav: [],
  },

  // BAR
  //
  // A bar is a restaurant that sells drinks: the same open tickets, the
  // same modifiers, the same recipes. It gets a profile rather than an
  // engine, and every default below is a default over a capability that
  // already existed before this profile did.
  //
  //   orders ON       — a bar runs on tabs. A customer's drinks go onto
  //                     one ticket through the night and are charged at
  //                     the end, which is precisely what an open order is.
  //   tables ON       — a tab is named. A table name is the cheapest
  //                     honest name for it, and an owner who runs stools
  //                     rather than tables simply turns it off.
  //   modifiers ON    — "double", "with Coke", "no ice".
  //   diningModes ON  — drinking in and taking away are different prices
  //                     and different tills in most Kenyan bars.
  //   kitchen OFF     — bar snacks are optional, and a kitchen queue in a
  //                     bar that has no kitchen is a column nobody fills
  //                     in. An owner who does serve food turns it on.
  //   recipes ON      — a cocktail consumes spirits. This is what makes
  //                     selling a Dawa take gin out of the gin bottle
  //                     instead of leaving a number nobody maintains.
  //   packSizes ON    — the bottle-to-tot conversion. A 750ml bottle is
  //                     30 tots at a 25ml pour or 25 at 30ml, and both
  //                     houses exist, so the number lives on the product.
  //   ageRestriction ON
  BAR: {
    id: 'BAR',
    label: 'Bar / Pub',
    family: 'FOOD',
    tagline: 'Open tabs, drinks by the bottle or the tot, and snacks when you serve them.',
    capabilities: {
      orders: true, tables: true, modifiers: true, diningModes: true,
      kitchen: false, recipes: true, units: true, packSizes: true,
      ageRestriction: true, waste: true,
    },
    terms: {
      catalogue: 'Drinks',
      catalogueItem: 'drink',
      catalogueItemPlural: 'drinks',
      addCatalogueItem: 'Add drink',
      catalogueDescription: 'Everything behind the bar, what it costs and what is left.',
      // A bar says "tab", not "order", and it is the same document.
      order: 'tab',
      orderPlural: 'tabs',
      orders: 'Tabs',
      openOrders: 'Open tabs',
      newOrder: 'New tab',
      saveOrder: 'Save tab',
      updateOrder: 'Update tab',
    },
    units: [DEFAULT_UNIT, 'bottle', 'tot', 'crate', 'millilitre', 'litre'],
    categories: [
      'Beer', 'Spirits', 'Wine', 'Cocktails', 'Mixers', 'Soft Drinks',
      'Cigarettes', 'Snacks', 'Other',
    ],
    dashboard: ['moneyToday', 'openOrders', 'position', 'activity'],
    categoryFilterThreshold: CATEGORY_FILTER_ALWAYS,
    cashierDefaults: FOOD_CASHIER_DEFAULTS,
    hiddenNav: [],
  },

  // ── Services family ───────────────────────────────────────────────
  SALON: {
    id: 'SALON',
    label: 'Salon',
    family: 'SERVICES',
    tagline: 'Services first, with the products you sell alongside them.',
    capabilities: { services: true },
    terms: {
      catalogue: 'Services & products',
      catalogueItem: 'service or product',
      catalogueItemPlural: 'services and products',
      addCatalogueItem: 'Add service or product',
      catalogueDescription: 'The services you offer and the products you sell.',
    },
    units: [DEFAULT_UNIT, 'millilitre', 'litre'],
    categories: ['Hair', 'Braiding', 'Treatment', 'Nails', 'Beauty', 'Hair Products', 'Cosmetics', 'Other'],
    dashboard: ['moneyToday', 'servicePosition', 'activity'],
    cashierDefaults: SERVICE_CASHIER_DEFAULTS,
    hiddenNav: [],
  },

  BARBER: {
    id: 'BARBER',
    label: 'Barber',
    family: 'SERVICES',
    tagline: 'Cuts and shaves, plus the products on the shelf.',
    capabilities: { services: true },
    terms: {
      catalogue: 'Services & products',
      catalogueItem: 'service or product',
      catalogueItemPlural: 'services and products',
      addCatalogueItem: 'Add service or product',
      catalogueDescription: 'The services you offer and the products you sell.',
    },
    units: [DEFAULT_UNIT, 'millilitre'],
    categories: ['Haircut', 'Shave', 'Beard', 'Treatment', 'Kids', 'Hair Products', 'Other'],
    dashboard: ['moneyToday', 'servicePosition', 'activity'],
    cashierDefaults: SERVICE_CASHIER_DEFAULTS,
    hiddenNav: [],
  },

  GENERAL_SERVICES: {
    id: 'GENERAL_SERVICES',
    label: 'General services',
    family: 'SERVICES',
    tagline: 'Service work billed to a customer, with no stock to carry.',
    capabilities: { services: true },
    terms: {
      catalogue: 'Services',
      catalogueItem: 'service',
      catalogueItemPlural: 'services',
      addCatalogueItem: 'Add service',
      catalogueDescription: 'The services you offer and what they cost.',
    },
    units: [DEFAULT_UNIT],
    categories: ['Cleaning', 'Repairs', 'Photography', 'Installation', 'Consultation', 'Transport', 'Other'],
    dashboard: ['moneyToday', 'servicePosition', 'activity'],
    // No physical inventory, so the stock pages would be dead navigation.
    // Nothing is deleted or blocked — the pages simply are not offered.
    cashierDefaults: SERVICE_CASHIER_DEFAULTS,
    hiddenNav: ['/purchases', '/suppliers', '/stock-take'],
  },

  // ── Specialised ───────────────────────────────────────────────────
  PHARMACY: {
    id: 'PHARMACY',
    label: 'Pharmacy',
    family: 'SPECIALIZED',
    tagline: 'Stock received in batches, sold earliest-expiry-first.',
    capabilities: { batches: true, expiryAlerts: true, units: true, packSizes: true },
    terms: {
      catalogueDescription: 'Everything you stock, its batches and what is left.',
    },
    units: [DEFAULT_UNIT, 'box', 'millilitre', 'litre', 'gram'],
    categories: [
      'Prescription', 'Over the Counter', 'Antibiotics', 'Pain Relief',
      'Vitamins & Supplements', 'First Aid', 'Baby Care', 'Personal Care', 'Other',
    ],
    dashboard: ['moneyToday', 'expiry', 'position', 'activity'],
    // A pharmacy cashier dispenses from batches, so reading an expiry
    // date is part of the job rather than a stock-room privilege.
    cashierDefaults: { 'stock.expiry': true },
    hiddenNav: [],
  },
};

export const DEFAULT_PROFILE_ID = 'GENERAL_RETAIL';
export const PROFILE_IDS = Object.keys(PROFILES);

export function isKnownProfile(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PROFILES, id);
}

/**
 * Never throws and never guesses. An unknown, absent or malformed profile
 * id resolves to General Retail — the safe default the brief requires for
 * every business that predates this system.
 */
export function getProfile(id) {
  return isKnownProfile(id) ? PROFILES[id] : PROFILES[DEFAULT_PROFILE_ID];
}

export function baseTerms() {
  return { ...BASE_TERMS };
}

/** Profiles grouped by family, for the ADMIN profile picker. */
export function profilesByFamily() {
  return Object.values(FAMILIES)
    .map((family) => ({
      ...family,
      profiles: PROFILE_IDS.map((id) => PROFILES[id]).filter((p) => p.family === family.id),
    }))
    .filter((group) => group.profiles.length > 0);
}

// ── What sign-up may offer ────────────────────────────────────────────
//
// The food family is DE-SURFACED FROM SIGN-UP, not deleted. Those
// profiles, their capabilities, their engines and their tests all remain
// exactly as they are — a business already on one keeps working, and a
// platform administrator can still set one from the admin console. What
// changes is only what a NEW business may pick for itself.
//
// This is a product decision, not a security boundary: nothing here
// protects data, and nothing downstream may treat it as though it does.
// Its job is that the two halves — the picker and the write — can never
// disagree, which is exactly what an ad-hoc `.filter()` in a form could
// not promise. The picker offers what `signupProfilesByFamily()` returns,
// and the write stores what `resolveSignupProfile()` returns; both read
// the one list below.

export const SIGNUP_DEFERRED_FAMILIES = ['FOOD'];

/** Is this profile something a NEW business may choose for itself? */
export function isSignupSelectable(id) {
  return isKnownProfile(id) && !SIGNUP_DEFERRED_FAMILIES.includes(PROFILES[id].family);
}

/**
 * The profile id a sign-up may actually STORE.
 *
 * Never throws and never rejects: a deferred profile, an unknown one, or
 * outright garbage all collapse to General Retail — the same safe default
 * every business with no stored profile already resolves to. A form that
 * cannot offer food is therefore backed by a write that cannot record it,
 * whatever arrives.
 */
export function resolveSignupProfile(id) {
  return isSignupSelectable(id) ? id : DEFAULT_PROFILE_ID;
}

/** Profiles grouped by family, for the SIGN-UP picker. */
export function signupProfilesByFamily() {
  return profilesByFamily()
    .map((family) => ({
      ...family,
      profiles: family.profiles.filter((p) => isSignupSelectable(p.id)),
    }))
    .filter((group) => group.profiles.length > 0);
}
