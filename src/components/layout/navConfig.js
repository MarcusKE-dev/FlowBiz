// src/components/layout/navConfig.js
//
// `adminOnly` and MOBILE_PRIMARY drive role filtering and are load-bearing
// — they are unchanged. `group` is presentation only: it tells the sidebar
// which heading to file an item under. An item with no group sits above the
// first group, ungrouped.

export const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard', icon: 'LayoutDashboard', adminOnly: true,  group: null    },
  { to: '/counter',    label: 'Counter',   icon: 'ShoppingCart',    adminOnly: false, group: 'sell'  },
  { to: '/customers',  label: 'Customers', icon: 'Users',           adminOnly: false, group: 'sell'  },
  { to: '/expenses',   label: 'Expenses',  icon: 'Receipt',         adminOnly: false, group: 'money' },
  { to: '/purchases',  label: 'Purchases', icon: 'Truck',           adminOnly: true,  group: 'stock' },
  { to: '/products',   label: 'Products',  icon: 'Package',         adminOnly: true,  group: 'stock' },
  { to: '/suppliers',  label: 'Suppliers', icon: 'Tag',             adminOnly: true,  group: 'stock' },
  { to: '/stock-take', label: 'Stock Take',icon: 'ClipboardCheck',  adminOnly: true,  group: 'stock' },
  { to: '/reports',    label: 'Reports',   icon: 'BarChart3',       adminOnly: true,  group: 'money' },
  { to: '/close-day',  label: 'Close Day', icon: 'Lock',            adminOnly: true,  group: 'money' },
  { to: '/users',      label: 'Team',      icon: 'UsersRound',      adminOnly: true,  group: 'admin' },
  { to: '/settings',   label: 'Settings',  icon: 'Settings',        adminOnly: true,  group: 'admin' },
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
  cashier: ['/counter', '/customers', '/expenses'],
};
