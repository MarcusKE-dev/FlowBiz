export const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard', icon: 'LayoutDashboard', adminOnly: true  },
  { to: '/counter',    label: 'Counter',   icon: 'ShoppingCart',    adminOnly: false },
  { to: '/customers',  label: 'Customers', icon: 'Users',           adminOnly: false },
  { to: '/expenses',   label: 'Expenses',  icon: 'Receipt',         adminOnly: false },
  { to: '/purchases',  label: 'Purchases', icon: 'Truck',           adminOnly: true  },
  { to: '/products',   label: 'Products',  icon: 'Package',         adminOnly: true  },
  { to: '/suppliers',  label: 'Suppliers', icon: 'Tag',             adminOnly: true  },
  { to: '/stock-take', label: 'Stock Take',icon: 'ClipboardCheck',  adminOnly: true  },
  { to: '/reports',    label: 'Reports',   icon: 'BarChart3',       adminOnly: true  },
  { to: '/close-day',  label: 'Close Day', icon: 'Lock',            adminOnly: true  },
  { to: '/users',      label: 'Team',      icon: 'UsersRound',      adminOnly: true  },
  { to: '/settings',   label: 'Settings',  icon: 'Settings',        adminOnly: true  },
];
export const MOBILE_PRIMARY = {
  admin:   ['/', '/counter', '/customers', '/reports', '/settings'],
  cashier: ['/counter', '/customers', '/expenses'],
};