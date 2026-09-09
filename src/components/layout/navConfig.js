// src/components/layout/navConfig.js
//
// The single navigation source of truth, for the sidebar, the bottom bar
// and the mobile drawer alike.
//
// WHO SEES WHAT. `ownerOnly` marks the pages that are the owner's alone
// and can never be granted to anyone else — the team, the settings, the
// plan, what FlowBiz offers this business. Everything else is decided by
// the cashier permission catalogue in src/industry/permissions.js, so
// there is ONE answer to "may this person open this page" and the
// navigation, the route guard and the security rules all read it.
//
// `permission` names the catalogue entry that governs the page. A nav
// item without one is open to anyone signed in.
//
// Two industry fields, both purely about what is OFFERED:
//
//   `capability` — the item appears only when that capability is on. This
//   is how a restaurant gets Orders and a bakery gets Production without
//   a shop ever seeing either, and it is why nothing here mentions a
//   profile: an owner who turns tables off in a café is answered by the
//   same mechanism as the profile default.
//
//   `label` may be a function of the industry configuration, so a
//   restaurant's Products page is called Menu and a salon's is called
//   Services & products. The ROUTE never changes — only the word does —
//   so a bookmark, a deep link and every existing test still resolve.
//
// Hiding an item is not what stops anyone reaching it. The route guard
// refuses the URL and the security rules refuse the write; this file only
// decides what is worth putting on a menu.

import { DEFAULT_INDUSTRY_CONFIG } from '../../industry/config.js';

export const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard', icon: 'LayoutDashboard', ownerOnly: true,  group: null    },
  { to: '/counter',    label: 'Counter',   icon: 'ShoppingCart',    group: 'sell',  permission: 'sales.record' },
  { to: '/orders',     label: (industry) => industry.terms.orders, icon: 'ClipboardList', group: 'sell', capability: 'orders', permission: 'orders.view' },
  { to: '/floor',      label: 'Floor',     icon: 'LayoutGrid',      group: 'sell', capability: 'tables',  permission: 'orders.view' },
  { to: '/kitchen',    label: 'Kitchen',   icon: 'Flame',           group: 'sell', capability: 'kitchen', permission: 'kitchen.update' },
  { to: '/customers',  label: 'Customers', icon: 'Users',           group: 'sell',  permission: 'customers.view' },
  { to: '/expenses',   label: 'Expenses',  icon: 'Receipt',         group: 'money', permission: 'expenses.record' },
  { to: '/purchases',  label: 'Purchases', icon: 'Truck',           group: 'stock', permission: 'stock.receive' },
  { to: '/products',   label: (industry) => industry.terms.catalogue, icon: 'Package', group: 'stock', permission: 'catalogue.view' },
  { to: '/production', label: 'Production',icon: 'ChefHat',         group: 'stock', capability: 'production', permission: 'stock.production' },
  { to: '/expiry',     label: 'Expiry',    icon: 'CalendarClock',   group: 'stock', capability: 'batches', permission: 'stock.expiry' },
  { to: '/waste',      label: 'Waste',     icon: 'Trash2',          group: 'stock', capability: 'waste',    permission: 'stock.waste' },
  { to: '/suppliers',  label: 'Suppliers', icon: 'Tag',             group: 'stock', permission: 'stock.suppliers' },
  { to: '/stock-take', label: 'Stock Take',icon: 'ClipboardCheck',  group: 'stock', permission: 'stock.count' },
  { to: '/reports',    label: 'Reports',   icon: 'BarChart3',       group: 'money', permission: 'reports.view' },
  { to: '/close-day',  label: 'Close Day', icon: 'Lock',            group: 'money', permission: 'day.close' },
  { to: '/users',      label: 'Team',      icon: 'UsersRound',      ownerOnly: true,  group: 'admin' },
  { to: '/settings',   label: 'Settings',  icon: 'Settings',        ownerOnly: true,  group: 'admin' },
];

// Display order of the sidebar groups, and the quiet label each one wears.
export const NAV_GROUPS = [
  { id: 'sell',  label: 'Sell'  },
  { id: 'stock', label: 'Stock' },
  { id: 'money', label: 'Money' },
  { id: 'admin', label: 'Admin' },
];

export const MOBILE_PRIMARY = {
  admin:   ['/', '/counter', '/customers', '/reports', '/settings'],
  cashier: ['/counter', '/orders', '/customers', '/expenses'],
};

// The one place the three navigation surfaces agree on what to show.
// Role first, then the permission catalogue, then the industry layer.
//
// `industry` falls back to the General Retail default rather than being
// null-guarded field by field. The navigation renders on the very first
// frame, before any listener has answered, and the safe thing to show
// then is the core product: the words FlowBiz has always used, and no
// capability-gated page appearing and then disappearing.
//
// `permissions` may be absent on that same first frame. An item whose
// permission cannot yet be answered is left OUT rather than shown — a
// menu that grows as things load is better than one a cashier taps
// before it shrinks away underneath them.
export function visibleNavItems({ isAdmin, industry: config, permissions }) {
  const industry = config || DEFAULT_INDUSTRY_CONFIG;
  const can = (key) => (permissions ? permissions.can(key) === true : false);
  return NAV_ITEMS
    .filter((item) => !item.ownerOnly || isAdmin)
    .filter((item) => !item.capability || industry.can(item.capability))
    .filter((item) => !industry.hiddenNav.includes(item.to))
    .filter((item) => !item.permission || isAdmin || can(item.permission))
    .map((item) => ({
      ...item,
      label: typeof item.label === 'function' ? item.label(industry) : item.label,
    }));
}

// The mobile bar's slots, resolved through the same rules. An item the
// industry or the permission set has removed falls out and the bar simply
// gets shorter, rather than leaving a gap or a dead tab.
export function visibleMobileItems({ isAdmin, industry, permissions }) {
  const allowed = MOBILE_PRIMARY[isAdmin ? 'admin' : 'cashier'];
  const visible = visibleNavItems({ isAdmin, industry, permissions });
  return allowed.map((path) => visible.find((item) => item.to === path)).filter(Boolean);
}
