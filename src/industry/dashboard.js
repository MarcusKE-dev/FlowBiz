// src/industry/dashboard.js
//
// What each dashboard widget is CALLED, for the owner who is choosing
// which ones to see.
//
// The ids themselves (`moneyToday`, `kitchenQueue`) are internal: they
// are how the dashboard finds its own code, and an owner should never see
// one. This file is the translation, and it is the only place a widget id
// is turned into words. Adding a widget means adding it here as well as
// to the profiles that offer it — a widget with no entry falls back to a
// readable name rather than rendering a raw id, so a missing entry is a
// cosmetic slip and never a broken screen.

export const DASHBOARD_WIDGETS = {
  moneyToday: {
    id: 'moneyToday',
    label: 'Money today',
    description: 'Cash in, M-Pesa in, expenses and profit for today.',
  },
  openOrders: {
    id: 'openOrders',
    label: 'Open orders',
    description: 'Tickets that are still running and what they come to.',
  },
  kitchenQueue: {
    id: 'kitchenQueue',
    label: 'Kitchen queue',
    description: 'How many orders are new, being prepared and ready.',
  },
  productionToday: {
    id: 'productionToday',
    label: 'Made today',
    description: 'What you produced today and what the ingredients cost.',
  },
  expiry: {
    id: 'expiry',
    label: 'Expiring stock',
    description: 'Batches that have expired or are close to it.',
  },
  position: {
    id: 'position',
    label: 'Where you stand',
    description: 'Stock value, what customers owe you, and low stock.',
  },
  servicePosition: {
    id: 'servicePosition',
    label: 'Services today',
    description: 'How many services you have done and what is owed.',
  },
  lowStock: {
    id: 'lowStock',
    label: 'Running low',
    description: 'The items that have dropped to their alert level.',
  },
  activity: {
    id: 'activity',
    label: 'Recent activity',
    description: 'Every sale, credit sale and repayment as it happens.',
  },
};

/** A readable name for a widget id, even one this file has not met. */
export function widgetLabel(id) {
  return DASHBOARD_WIDGETS[id]?.label || String(id ?? '');
}

export function widgetDescription(id) {
  return DASHBOARD_WIDGETS[id]?.description || '';
}

/**
 * The widgets a business can actually arrange: the profile's own list, in
 * the owner's chosen order, with the ones they have hidden marked rather
 * than removed — so the page can show what is switched off instead of
 * losing it.
 */
export function arrangeableWidgets(config) {
  const offered = config?.profileDashboard || [];
  const chosen = config?.dashboardOverrides;
  if (!Array.isArray(chosen)) {
    return offered.map((id) => ({ id, label: widgetLabel(id), description: widgetDescription(id), shown: true }));
  }
  const shown = chosen.filter((id) => offered.includes(id));
  const hidden = offered.filter((id) => !shown.includes(id));
  return [
    ...shown.map((id) => ({ id, label: widgetLabel(id), description: widgetDescription(id), shown: true })),
    ...hidden.map((id) => ({ id, label: widgetLabel(id), description: widgetDescription(id), shown: false })),
  ];
}
