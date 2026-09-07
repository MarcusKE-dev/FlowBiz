// The cashier permission model.
//
// Three things are being pinned down here, in order of how much damage
// getting them wrong would do:
//
//   1. NOTHING SENSITIVE IS GRANTABLE. The catalogue must not contain a
//      key that reaches the settings, the team, the plan, the business
//      type or the data, because a key that exists is a key an owner can
//      switch on.
//
//   2. THE DEFAULTS IN firestore.rules ARE THE DEFAULTS HERE. The rules
//      are the enforcement and this file is the description, and a
//      description that disagrees with the enforcement is worse than no
//      description at all. The drift test reads firestore.rules.
//
//   3. WHAT EACH TRADE IS OFFERED. An electronics shop is never asked
//      about tables and tabs; a restaurant is.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveIndustryConfig } from './config.js';
import {
  CASHIER_PERMISSIONS, PERMISSION_KEYS, BASE_CASHIER_DEFAULTS, OWNER_ONLY_AREAS,
  resolveCashierPermissions, resolvePermissions, permissionGroups, applicablePermissions,
  sanitizeCashierPermissions, permissionForRoute, isKnownPermission,
} from './permissions.js';
import { PROFILE_IDS, PROFILES } from './profiles.js';

const config = (id, settings = {}) => resolveIndustryConfig({ industryProfile: id, ...settings });
const forCashier = (id, settings = {}) =>
  resolveCashierPermissions(config(id, settings), { industryProfile: id, ...settings });

// ── 1. Least privilege ───────────────────────────────────────────────

test('nothing in the catalogue reaches an owner-only area', () => {
  // A key that exists is a key an owner can switch on, so the guarantee
  // has to be that these keys do not exist at all.
  const forbidden = [
    'settings', 'business', 'subscription', 'plan', 'licence', 'license',
    'users', 'team', 'staff', 'admin', 'industry', 'security', 'export',
    'import', 'reset', 'delete', 'device', 'session',
  ];
  for (const key of PERMISSION_KEYS) {
    for (const word of forbidden) {
      assert.ok(
        !key.toLowerCase().includes(word),
        `${key} looks like it reaches an owner-only area (${word})`
      );
    }
  }
  assert.ok(OWNER_ONLY_AREAS.length > 0);
});

test('the sensitive defaults are OFF for every trade', () => {
  // Money out of the till, stock movements, the catalogue and the whole
  // business's figures. None of these is a counter job, and none of them
  // may become one because a profile said so.
  const sensitive = [
    'sales.return', 'catalogue.manage', 'stock.receive', 'stock.count',
    'stock.suppliers', 'stock.production', 'day.close', 'reports.view',
  ];
  for (const id of PROFILE_IDS) {
    const resolved = forCashier(id);
    for (const key of sensitive) {
      assert.equal(resolved.can(key), false, `${id} must not grant ${key} by default`);
    }
  }
});

test('an owner holds everything, and no stored map can take it away', () => {
  const industry = config('RESTAURANT');
  const settings = {
    cashierPermissions: Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])),
    cashierCanRecordExpenses: false,
  };
  const owner = resolvePermissions({ isOwner: true, industry, settings });
  for (const key of PERMISSION_KEYS) assert.equal(owner.can(key), true, key);
  assert.equal(owner.can('anything.at.all'), true, 'an owner is not resolved against the catalogue');
});

test('a permission cannot be invented, and a non-boolean is not coerced', () => {
  assert.deepEqual(sanitizeCashierPermissions({ 'business.delete': true }), {});
  assert.deepEqual(sanitizeCashierPermissions({ 'sales.record': 'yes' }), {});
  assert.deepEqual(sanitizeCashierPermissions({ 'sales.record': false }), { 'sales.record': false });
  for (const hostile of [null, undefined, 'yes', 42, [], [{ 'sales.record': true }]]) {
    assert.deepEqual(sanitizeCashierPermissions(hostile), {});
  }
});

// ── 2. The rules are the enforcement; this file must agree with them ──

test('every default matches the one firestore.rules enforces', () => {
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

  // `may('some.permission', true)` — the second argument is the default
  // the rule falls back to when a business has stored nothing.
  const found = new Map();
  for (const m of rules.matchAll(/may\(\s*'([a-z.]+)'\s*,\s*(true|false)\s*\)/g)) {
    const [, key, fallback] = m;
    const prior = found.get(key);
    assert.ok(prior === undefined || prior === fallback, `firestore.rules disagrees with itself about ${key}`);
    found.set(key, fallback);
  }
  assert.ok(found.size >= 12, 'the rules should be enforcing most of the catalogue');

  for (const [key, fallback] of found) {
    assert.ok(isKnownPermission(key), `firestore.rules enforces an unknown permission: ${key}`);
    assert.equal(
      String(BASE_CASHIER_DEFAULTS[key]), fallback,
      `${key} defaults to ${BASE_CASHIER_DEFAULTS[key]} here and ${fallback} in firestore.rules`
    );
  }

  // `expenses.record` is enforced through its own helper, because of the
  // legacy flag. It must still be in the rules.
  assert.match(rules, /cashierMay\('expenses\.record', legacyExpensesDefault\(\)\)/);

  // Every key the rules will accept into the stored map must be one this
  // catalogue knows about, and vice versa.
  const allowed = rules
    .slice(rules.indexOf('function cashierPermissionsOk'))
    .match(/hasOnly\(\[([\s\S]*?)\]\)/)[1]
    .match(/'([^']+)'/g)
    .map((s) => s.slice(1, -1));
  assert.deepEqual([...allowed].sort(), [...PERMISSION_KEYS].sort());
});

test('every permission says how it is enforced, and says it honestly', () => {
  for (const key of PERMISSION_KEYS) {
    const permission = CASHIER_PERMISSIONS[key];
    assert.ok(['rules', 'route'].includes(permission.enforcement), `${key} must declare its enforcement`);
    assert.equal(typeof permission.default, 'boolean', `${key} must have a default`);
    assert.equal(permission.key, key);
    assert.ok(permission.group, `${key} must belong to a group`);
  }
});

test('a permission that claims a rule enforces it is actually named in the rules', () => {
  // THE GAP THIS CLOSES. The test above checked that every permission
  // NAMED IN THE RULES is one the catalogue knows about. Nothing checked
  // the other direction, so `orders.close` could sit here declaring
  // `enforcement: 'rules'` while no rule mentioned it: charging a ticket
  // writes a `sales` document and updates an `orders` document, both of
  // which were already covered by other permissions, so an owner who
  // switched "Charge a ticket" off changed nothing whatsoever. A claim
  // of enforcement that nothing enforces is worse than no claim at all,
  // which is the whole premise of this file.
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const claimed = PERMISSION_KEYS.filter((key) => CASHIER_PERMISSIONS[key].enforcement === 'rules');
  assert.ok(claimed.length > 0);
  for (const key of claimed) {
    assert.ok(
      rules.includes(`'${key}'`),
      `${key} says a rule enforces it, but firestore.rules never names it`
    );
  }
});

// ── 3. Industry-awareness ────────────────────────────────────────────

test('a trade is only asked about capabilities it has', () => {
  const offered = (id) => applicablePermissions(config(id)).map((p) => p.key);

  for (const id of ['ELECTRONICS', 'PHARMACY', 'HARDWARE', 'SUPERMARKET', 'WINES_AND_SPIRITS']) {
    const keys = offered(id);
    for (const key of ['orders.view', 'orders.create', 'orders.update', 'orders.close']) {
      assert.ok(!keys.includes(key), `${id} keeps no open tickets, so it must not be asked about ${key}`);
    }
  }
  for (const id of ['RESTAURANT', 'CAFE', 'FAST_FOOD', 'BAR']) {
    const keys = offered(id);
    for (const key of ['orders.view', 'orders.create', 'orders.update', 'orders.close']) {
      assert.ok(keys.includes(key), `${id} runs on open tickets, so it must be asked about ${key}`);
    }
  }
  assert.ok(offered('PHARMACY').includes('stock.expiry'), 'a pharmacy has batches');
  assert.ok(!offered('ELECTRONICS').includes('stock.expiry'), 'an electronics shop does not');
  assert.ok(offered('BAKERY').includes('stock.production'), 'a bakery makes things');
  assert.ok(!offered('BOUTIQUE').includes('stock.production'), 'a boutique does not');
});

test('a services business with no stock room is not asked about one', () => {
  const keys = applicablePermissions(config('GENERAL_SERVICES')).map((p) => p.key);
  for (const key of ['stock.receive', 'stock.count', 'stock.suppliers']) {
    assert.ok(!keys.includes(key), `GENERAL_SERVICES hides ${key}'s page, so it must not offer it`);
  }
});

test('an inapplicable permission is OFF even when the stored map grants it', () => {
  const resolved = forCashier('ELECTRONICS', {
    cashierPermissions: { 'orders.create': true, 'stock.expiry': true, 'stock.production': true },
  });
  assert.equal(resolved.can('orders.create'), false);
  assert.equal(resolved.can('stock.expiry'), false);
  assert.equal(resolved.can('stock.production'), false);
});

test('the groups an owner sees are named in their own trade\'s words', () => {
  const restaurant = permissionGroups(config('RESTAURANT')).map((g) => g.label);
  assert.ok(restaurant.includes('Orders'));
  assert.ok(restaurant.includes('Menu'));

  const bar = permissionGroups(config('BAR')).map((g) => g.label);
  assert.ok(bar.includes('Tabs'), 'a bar runs tabs, not orders');
  assert.ok(bar.includes('Drinks'));

  const shop = permissionGroups(config('ELECTRONICS')).map((g) => g.label);
  assert.ok(!shop.includes('Orders'));
  assert.ok(shop.includes('Products'));
});

test('a trade may raise a recommendation but never lower the base', () => {
  for (const id of PROFILE_IDS) {
    const recommended = PROFILES[id].cashierDefaults || {};
    for (const [key, value] of Object.entries(recommended)) {
      assert.ok(isKnownPermission(key), `${id} recommends an unknown permission: ${key}`);
      assert.equal(value, true, `${id} may only raise a default, never lower one (${key})`);
    }
    const resolved = forCashier(id);
    for (const key of PERMISSION_KEYS) {
      if (!BASE_CASHIER_DEFAULTS[key]) continue;
      const applicable = applicablePermissions(config(id)).some((p) => p.key === key);
      if (!applicable) continue;
      assert.equal(resolved.can(key), true, `${id} must not lower the base default for ${key}`);
    }
  }
});

// ── The owner's own choices ──────────────────────────────────────────

test('an owner can widen and narrow the trade\'s recommendation', () => {
  const widened = forCashier('RESTAURANT', { cashierPermissions: { 'stock.receive': true } });
  assert.equal(widened.can('stock.receive'), true);
  assert.equal(widened.usesDefaults, false);

  const narrowed = forCashier('RESTAURANT', { cashierPermissions: { 'expenses.record': false } });
  assert.equal(narrowed.can('expenses.record'), false);
  assert.equal(narrowed.can('sales.record'), true, 'and nothing else moves');
});

test('two businesses in the same trade can run their cashiers differently', () => {
  const strict = forCashier('RESTAURANT', { cashierPermissions: { 'expenses.record': false, 'orders.close': false } });
  const relaxed = forCashier('RESTAURANT', { cashierPermissions: { 'sales.return': true, 'catalogue.manage': true } });
  assert.equal(strict.can('expenses.record'), false);
  assert.equal(relaxed.can('expenses.record'), true);
  assert.equal(strict.can('sales.return'), false);
  assert.equal(relaxed.can('sales.return'), true);
});

test('a prerequisite decides: no view, no manage', () => {
  const resolved = forCashier('RESTAURANT', {
    cashierPermissions: { 'catalogue.view': false, 'catalogue.manage': true, 'customers.view': false, 'customers.manage': true },
  });
  assert.equal(resolved.can('catalogue.manage'), false, 'editing a list you cannot open is not a permission');
  assert.equal(resolved.can('customers.manage'), false);
});

test('the legacy expenses flag is the stored answer until a permission replaces it', () => {
  assert.equal(forCashier('SUPERMARKET', { cashierCanRecordExpenses: false }).can('expenses.record'), false);
  assert.equal(forCashier('SUPERMARKET', { cashierCanRecordExpenses: true }).can('expenses.record'), true);
  assert.equal(
    forCashier('SUPERMARKET', {
      cashierCanRecordExpenses: false,
      cashierPermissions: { 'expenses.record': true },
    }).can('expenses.record'),
    true,
    'a new permission overrules the old switch'
  );
});

// ── Routes ───────────────────────────────────────────────────────────

test('each route is governed by exactly one permission', () => {
  const routes = PERMISSION_KEYS.map((k) => CASHIER_PERMISSIONS[k].route).filter(Boolean);
  assert.equal(new Set(routes).size, routes.length, 'two permissions must not claim the same route');
  assert.equal(permissionForRoute('/reports').key, 'reports.view');
  assert.equal(permissionForRoute('/nowhere'), null);
});

// ── Totality ─────────────────────────────────────────────────────────

test('resolution never throws and never returns a partial answer', () => {
  const hostile = [
    null, undefined, 0, 'x', [],
    { cashierPermissions: 'yes' }, { cashierPermissions: [] },
    { cashierPermissions: { __proto__: { 'sales.return': true } } },
    { cashierCanRecordExpenses: 'maybe' },
  ];
  for (const settings of hostile) {
    for (const id of PROFILE_IDS) {
      const resolved = resolveCashierPermissions(config(id), settings);
      for (const key of PERMISSION_KEYS) {
        assert.equal(typeof resolved.granted[key], 'boolean', `${id} / ${key}`);
      }
      assert.equal(resolved.can('sales.record'), true, 'the counter always works');
      assert.equal(resolved.can('sales.return'), false, 'and the till is never opened by accident');
    }
  }
});

test('an unknown industry configuration resolves to the safe baseline', () => {
  const resolved = resolveCashierPermissions(resolveIndustryConfig({ industryProfile: 'NOT_A_TRADE' }), {});
  assert.equal(resolved.can('sales.record'), true);
  assert.equal(resolved.can('orders.create'), false, 'a general shop keeps no open tickets');
});
