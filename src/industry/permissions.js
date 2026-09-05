// src/industry/permissions.js
//
// WHAT A CASHIER MAY DO.
//
// FlowBiz had exactly one cashier permission — `cashierCanRecordExpenses`
// — and everything else was decided by a hard-coded `adminOnly` flag on a
// navigation item. That gave an owner one switch to describe a job that
// differs in every trade: a restaurant cashier takes orders and works a
// menu, a hardware cashier receives stock, a pharmacy cashier reads
// expiry dates, and a supermarket cashier does none of those. This file
// replaces that one boolean with a catalogue.
//
// THREE RULES IT HOLDS TO.
//
//   1. LEAST PRIVILEGE. A cashier starts with what the counter actually
//      needs and nothing else. Everything beyond that is a deliberate
//      grant by the owner, and the sensitive areas — the business's
//      settings, its team, its plan, its industry, its data — are not in
//      this catalogue AT ALL, so there is no grant that can reach them.
//      See OWNER_ONLY_AREAS.
//
//   2. INDUSTRY-AWARE, VIA CAPABILITIES ONLY. A permission that governs a
//      capability the business does not have is not offered, not stored
//      and never granted — an electronics shop is never asked whether its
//      cashiers may close a table's tab. This is expressed as
//      `capability: 'orders'`, resolved by the SAME industry layer every
//      other feature uses. There is no `if (profile === 'RESTAURANT')`
//      here or anywhere downstream of here.
//
//   3. A UI GATE IS NOT A PERMISSION. Every entry declares how it is
//      actually enforced:
//
//        enforcement: 'rules' — a Firestore security rule refuses the
//          write. The default below is duplicated in firestore.rules and
//          a test asserts the two never drift.
//
//        enforcement: 'route' — the permission decides which SCREEN is
//          offered, over data the cashier's own work already requires
//          them to be able to read. It is honest navigation, not a
//          security boundary, and it is labelled as such rather than
//          being quietly presented as one.
//
// THE PRECEDENCE, in one direction:
//
//     base default  →  industry default  →  business override
//                   →  applicability (capability off ⇒ off)
//                   →  dependencies (requires)
//                   →  effective permission
//
// PURE and TOTAL, like the rest of this layer: the input is the
// businessSettings document the app already listens to, resolution never
// throws, and a malformed stored map degrades to the defaults rather than
// to an empty set of rights or a full one.

import { getProfile } from './profiles.js';

/**
 * Areas a cashier can never be given, whatever an owner clicks. They are
 * absent from the catalogue below on purpose — this list exists so the
 * UI can SAY so, and so a test can assert that none of them ever grows a
 * permission key.
 *
 * Each is already enforced server-side, on `role`, by firestore.rules or
 * by the Worker's admin permission table; nothing here is what stops a
 * cashier reaching them.
 */
export const OWNER_ONLY_AREAS = Object.freeze([
  'Business settings and receipts',
  'The team: inviting, removing and deactivating staff',
  'Device management and sign-out',
  'The FlowBiz plan, payments and licence',
  'What FlowBiz offers this business (Customize)',
  'The business type',
  'Exporting, importing or resetting the business data',
  'Deleting anything: a product, a sale, a customer, an order',
]);

export const PERMISSION_GROUPS = [
  { id: 'sell',      label: () => 'Selling' },
  { id: 'orders',    label: (industry) => industry.terms.orders, capability: 'orders' },
  { id: 'catalogue', label: (industry) => industry.terms.catalogue },
  { id: 'stock',     label: () => 'Stock' },
  { id: 'people',    label: () => 'Customers' },
  { id: 'money',     label: () => 'Money' },
];

const t = (industry, key, fallback) => industry?.terms?.[key] || fallback;

/**
 * The catalogue. Every entry corresponds to something that exists in this
 * application today — a route in AppRouter, a write a rule allows, a
 * button on a page. Nothing here is aspirational.
 */
export const CASHIER_PERMISSIONS = {
  // ── Selling ───────────────────────────────────────────────────────
  'sales.record': {
    key: 'sales.record',
    group: 'sell',
    label: 'Sell at the counter',
    default: true,
    route: '/counter',
    enforcement: 'rules',
  },
  'sales.credit': {
    key: 'sales.credit',
    group: 'sell',
    label: 'Sell on credit',
    description: 'Adds to what the customer owes.',
    default: true,
    enforcement: 'rules',
  },
  'sales.return': {
    key: 'sales.return',
    group: 'sell',
    label: 'Take returns and give refunds',
    description: 'Takes cash out of the till.',
    default: false,
    enforcement: 'rules',
  },
  'sales.history': {
    key: 'sales.history',
    group: 'sell',
    label: "See the day's sales",
    default: false,
    enforcement: 'route',
  },

  // ── Open orders ───────────────────────────────────────────────────
  // Only where the business actually keeps open tickets. A shop that
  // charges at the till has no orders, so none of this is offered.
  'orders.view': {
    key: 'orders.view',
    group: 'orders',
    label: (industry) => `See ${t(industry, 'openOrders', 'open orders').toLowerCase()}`,
    default: true,
    capability: 'orders',
    route: '/orders',
    enforcement: 'route',
  },
  'orders.create': {
    key: 'orders.create',
    group: 'orders',
    label: (industry) => `Start a new ${t(industry, 'order', 'order')}`,
    default: true,
    capability: 'orders',
    requires: ['orders.view'],
    enforcement: 'rules',
  },
  'orders.update': {
    key: 'orders.update',
    group: 'orders',
    label: (industry) => `Change an open ${t(industry, 'order', 'order')}`,
    default: true,
    capability: 'orders',
    requires: ['orders.view'],
    enforcement: 'rules',
  },
  'orders.close': {
    key: 'orders.close',
    group: 'orders',
    label: (industry) => `Charge a ${t(industry, 'order', 'order')}`,
    description: 'Takes payment and records the sale.',
    default: true,
    capability: 'orders',
    requires: ['orders.view', 'sales.record'],
    enforcement: 'rules',
  },

  // ── The catalogue / menu ──────────────────────────────────────────
  'catalogue.view': {
    key: 'catalogue.view',
    group: 'catalogue',
    label: (industry) => `Open ${t(industry, 'catalogue', 'Products')}`,
    description: 'Includes cost prices.',
    default: false,
    route: '/products',
    enforcement: 'route',
  },
  'catalogue.manage': {
    key: 'catalogue.manage',
    group: 'catalogue',
    label: (industry) => `Add and edit ${t(industry, 'catalogueItemPlural', 'products')}`,
    description: 'Deleting stays with you.',
    default: false,
    requires: ['catalogue.view'],
    enforcement: 'rules',
  },

  // ── Stock ─────────────────────────────────────────────────────────
  'stock.receive': {
    key: 'stock.receive',
    group: 'stock',
    label: 'Receive stock',
    default: false,
    route: '/purchases',
    enforcement: 'rules',
  },
  'stock.count': {
    key: 'stock.count',
    group: 'stock',
    label: 'Count stock',
    description: 'Overrides the recorded stock figure.',
    default: false,
    route: '/stock-take',
    enforcement: 'rules',
  },
  'stock.suppliers': {
    key: 'stock.suppliers',
    group: 'stock',
    label: 'Manage suppliers',
    default: false,
    route: '/suppliers',
    enforcement: 'rules',
  },
  'stock.expiry': {
    key: 'stock.expiry',
    group: 'stock',
    label: 'See batches and expiry',
    default: false,
    capability: 'batches',
    route: '/expiry',
    enforcement: 'route',
  },
  'stock.production': {
    key: 'stock.production',
    group: 'stock',
    label: 'Record production',
    default: false,
    capability: 'production',
    route: '/production',
    enforcement: 'rules',
  },

  // ── Customers ─────────────────────────────────────────────────────
  'customers.view': {
    key: 'customers.view',
    group: 'people',
    label: 'See customers',
    description: 'Includes what each one owes.',
    default: true,
    route: '/customers',
    enforcement: 'route',
  },
  'customers.manage': {
    key: 'customers.manage',
    group: 'people',
    label: 'Add and edit customers',
    default: true,
    requires: ['customers.view'],
    enforcement: 'rules',
  },
  'debtors.collect': {
    key: 'debtors.collect',
    group: 'people',
    label: 'Take a debt repayment',
    default: true,
    requires: ['customers.view'],
    enforcement: 'rules',
  },

  // ── Money ─────────────────────────────────────────────────────────
  'expenses.record': {
    key: 'expenses.record',
    group: 'money',
    label: 'Record expenses',
    default: true,
    route: '/expenses',
    enforcement: 'rules',
  },
  'day.open': {
    key: 'day.open',
    group: 'money',
    label: "Open the day's counter",
    default: true,
    enforcement: 'rules',
  },
  'day.close': {
    key: 'day.close',
    group: 'money',
    label: 'Close the day',
    description: "Locks the day's takings.",
    default: false,
    route: '/close-day',
    enforcement: 'rules',
  },
  'reports.view': {
    key: 'reports.view',
    group: 'money',
    label: 'See reports',
    description: 'Whole-business figures.',
    default: false,
    route: '/reports',
    enforcement: 'route',
  },
};

export const PERMISSION_KEYS = Object.keys(CASHIER_PERMISSIONS);

export function isKnownPermission(key) {
  return Object.prototype.hasOwnProperty.call(CASHIER_PERMISSIONS, key);
}

/** The base defaults, as a plain map. Nothing outside resolution reads it. */
export const BASE_CASHIER_DEFAULTS = Object.freeze(
  Object.fromEntries(PERMISSION_KEYS.map((key) => [key, CASHIER_PERMISSIONS[key].default === true]))
);

/**
 * Reduce a stored permission map to the subset that means anything.
 * Unknown keys and non-booleans are dropped rather than rejected: this is
 * a Firestore map an older or a future client may have written, and one
 * bad key must never invalidate a business's whole permission set.
 *
 * This is the client-side half of a rule enforced in firestore.rules too.
 * It exists so the UI cannot offer something the server will refuse; it
 * is not, and must not be treated as, the enforcement.
 */
export function sanitizeCashierPermissions(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'boolean') continue;
    if (!isKnownPermission(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Does this business's configuration have anything for this permission to
 * govern? A permission whose capability is off is not a choice an owner
 * can meaningfully make — it is a switch with nothing behind it — and a
 * permission whose page the profile does not offer at all (a services
 * business has no stock room) is the same.
 */
export function isApplicable(permission, industry) {
  if (permission.capability && !industry.capabilities?.[permission.capability]) return false;
  if (permission.route && (industry.hiddenNav || []).includes(permission.route)) return false;
  return true;
}

/**
 * The permissions this business is actually offered, in catalogue order.
 */
export function applicablePermissions(industry) {
  return PERMISSION_KEYS
    .map((key) => CASHIER_PERMISSIONS[key])
    .filter((permission) => isApplicable(permission, industry));
}

/**
 * What the TRADE recommends, before the business has said anything.
 * A profile may raise a default where its trade genuinely needs it; it
 * may not lower one below the base, because the base is what the counter
 * needs to function and is what firestore.rules is written against.
 */
function industryDefaults(industry) {
  const profile = getProfile(industry?.profileId);
  const out = { ...BASE_CASHIER_DEFAULTS };
  const recommended = profile?.cashierDefaults || {};
  for (const [key, value] of Object.entries(recommended)) {
    if (!isKnownPermission(key)) continue;
    if (value !== true) continue;
    out[key] = true;
  }
  return out;
}

/**
 * The one entry point. `industry` is the resolved industry configuration
 * and `settings` the businessSettings document, both of which the app
 * already has in hand — resolving permissions costs no read and no
 * listener of its own.
 */
export function resolveCashierPermissions(industry, settings) {
  try {
    return resolveStrict(industry, settings);
  } catch {
    return resolveStrict(industry, null);
  }
}

function resolveStrict(industry, settings) {
  const defaults = industryDefaults(industry);
  const overrides = sanitizeCashierPermissions(settings?.cashierPermissions);

  // LEGACY. `cashierCanRecordExpenses` was the only cashier permission
  // FlowBiz had, and an owner who switched it off meant it. It is honoured
  // as the stored value for `expenses.record` until this business saves a
  // permission of its own, and is never written again.
  const legacyExpenses = settings?.cashierCanRecordExpenses;
  const usesLegacyExpenses =
    overrides['expenses.record'] === undefined && typeof legacyExpenses === 'boolean';

  const granted = {};
  for (const key of PERMISSION_KEYS) {
    const permission = CASHIER_PERMISSIONS[key];
    let value = defaults[key];
    if (key === 'expenses.record' && usesLegacyExpenses) value = legacyExpenses;
    if (overrides[key] !== undefined) value = overrides[key];
    // A permission with nothing behind it is off, whatever is stored.
    granted[key] = isApplicable(permission, industry) ? value === true : false;
  }

  // Dependencies, to a fixed point: being allowed to change an order
  // without being allowed to see one is not a half-granted permission,
  // it is a screen the cashier cannot reach holding a right they cannot
  // use, so the prerequisite decides.
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of PERMISSION_KEYS) {
      if (!granted[key]) continue;
      const requires = CASHIER_PERMISSIONS[key].requires || [];
      if (requires.some((dep) => !granted[dep])) {
        granted[key] = false;
        changed = true;
      }
    }
  }

  const customised = {};
  for (const key of PERMISSION_KEYS) {
    if (!isApplicable(CASHIER_PERMISSIONS[key], industry)) continue;
    if (granted[key] !== defaults[key]) customised[key] = granted[key];
  }

  return {
    granted,
    defaults,
    overrides,
    customised,
    usesDefaults: Object.keys(customised).length === 0,
    /** The one question the rest of the app asks about a cashier. */
    can: (key) => granted[key] === true,
  };
}

/**
 * The permission set for a signed-in person. An OWNER is not resolved
 * against this catalogue at all: they hold everything in it and the
 * owner-only areas besides, and pretending otherwise would invite a bug
 * where an owner is refused their own business.
 */
export function resolvePermissions({ isOwner, industry, settings }) {
  if (isOwner) {
    const granted = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true]));
    return {
      granted, defaults: granted, overrides: {}, customised: {}, usesDefaults: true,
      isOwner: true,
      can: () => true,
    };
  }
  return { ...resolveCashierPermissions(industry, settings), isOwner: false };
}

/**
 * The permission that governs a route, if any. Used by the navigation and
 * by the route guard so that neither keeps its own idea of who may go
 * where.
 */
export function permissionForRoute(route) {
  return PERMISSION_KEYS
    .map((key) => CASHIER_PERMISSIONS[key])
    .find((permission) => permission.route === route) || null;
}

/** Grouped and labelled for the owner-facing screen. */
export function permissionGroups(industry) {
  const applicable = applicablePermissions(industry);
  return PERMISSION_GROUPS
    .filter((group) => !group.capability || industry.capabilities?.[group.capability])
    .map((group) => ({
      id: group.id,
      label: group.label(industry),
      permissions: applicable
        .filter((permission) => permission.group === group.id)
        .map((permission) => ({
          ...permission,
          label: typeof permission.label === 'function' ? permission.label(industry) : permission.label,
          description:
            typeof permission.description === 'function'
              ? permission.description(industry)
              : permission.description,
        })),
    }))
    .filter((group) => group.permissions.length > 0);
}
