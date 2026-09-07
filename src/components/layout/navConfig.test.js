// Navigation and terminology per profile.
//
// Two properties: no profile is offered a page it cannot use, and no
// profile loses a page it needs. Role and PERMISSION filtering are
// asserted alongside, because the industry filter runs after them and
// must not have widened either.
//
// The cashier's navigation is now the permission catalogue's answer, not
// a hard-coded `adminOnly` flag — see industry/permissions.js — so these
// tests resolve a real permission set rather than a settings stub.

import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleNavItems, visibleMobileItems, NAV_ITEMS } from './navConfig.js';
import { resolveIndustryConfig } from '../../industry/config.js';
import { resolvePermissions } from '../../industry/permissions.js';
import { PROFILE_IDS } from '../../industry/profiles.js';

const owner = (profileId, overrides) => {
  const industry = resolveIndustryConfig({ industryProfile: profileId, capabilityOverrides: overrides });
  return { isAdmin: true, industry, permissions: resolvePermissions({ isOwner: true, industry, settings: {} }) };
};

const cashier = (profileId, settings = {}) => {
  const industry = resolveIndustryConfig({ industryProfile: profileId, ...settings });
  return { isAdmin: false, industry, permissions: resolvePermissions({ isOwner: false, industry, settings }) };
};

const paths = (ctx) => visibleNavItems(ctx).map((i) => i.to);

// ── General Retail is the reference, and is unchanged ────────────────

test('General Retail sees exactly the pages FlowBiz has always had', () => {
  assert.deepEqual(paths(owner('GENERAL_RETAIL')), [
    '/', '/counter', '/customers', '/expenses', '/purchases', '/products',
    '/suppliers', '/stock-take', '/reports', '/close-day', '/users', '/settings',
  ]);
});

test('no industry page is ever offered to a profile that does not have its capability', () => {
  const industryPages = NAV_ITEMS.filter((i) => i.capability).map((i) => i.to);
  assert.deepEqual(industryPages.sort(), ['/expiry', '/orders', '/production']);
  const retail = paths(owner('GENERAL_RETAIL'));
  for (const page of industryPages) {
    assert.equal(retail.includes(page), false, `${page} must not appear for General Retail`);
  }
});

// ── Each family gets what it needs and nothing else ──────────────────

test('a restaurant gets Orders, and no Expiry or Production', () => {
  const nav = paths(owner('RESTAURANT'));
  assert.ok(nav.includes('/orders'));
  assert.ok(!nav.includes('/expiry'));
  assert.ok(!nav.includes('/production'));
});

test('a bakery gets Production, and no Orders', () => {
  const nav = paths(owner('BAKERY'));
  assert.ok(nav.includes('/production'));
  assert.ok(!nav.includes('/orders'));
});

test('a pharmacy gets Expiry, and no Orders or Production', () => {
  const nav = paths(owner('PHARMACY'));
  assert.ok(nav.includes('/expiry'));
  assert.ok(!nav.includes('/orders'));
  assert.ok(!nav.includes('/production'));
});

test('General Services is not offered stock pages it has no stock for', () => {
  const nav = paths(owner('GENERAL_SERVICES'));
  for (const page of ['/purchases', '/suppliers', '/stock-take']) {
    assert.equal(nav.includes(page), false, `${page} is dead navigation for a services business`);
  }
  assert.ok(nav.includes('/products'), 'it still needs its list of services');
  assert.ok(nav.includes('/counter'));
  assert.ok(nav.includes('/reports'));
});

test('a salon keeps its stock pages, because it sells shampoo as well as haircuts', () => {
  const nav = paths(owner('SALON'));
  assert.ok(nav.includes('/purchases'));
  assert.ok(nav.includes('/stock-take'));
});

// ── Terminology ──────────────────────────────────────────────────────

test('the catalogue page is renamed per profile, but never moves', () => {
  const label = (profileId) =>
    visibleNavItems(owner(profileId)).find((i) => i.to === '/products').label;
  assert.equal(label('GENERAL_RETAIL'), 'Products');
  assert.equal(label('SUPERMARKET'), 'Products');
  assert.equal(label('RESTAURANT'), 'Menu');
  assert.equal(label('CAFE'), 'Menu');
  assert.equal(label('FAST_FOOD'), 'Menu');
  assert.equal(label('SALON'), 'Services & products');
  assert.equal(label('GENERAL_SERVICES'), 'Services');
  // The route is identical for every one of them.
  for (const id of PROFILE_IDS) {
    assert.ok(paths(owner(id)).includes('/products'), `${id} must keep its catalogue`);
  }
});

test('every nav label resolves to a non-empty string for every profile', () => {
  for (const id of PROFILE_IDS) {
    for (const item of visibleNavItems(owner(id))) {
      assert.equal(typeof item.label, 'string', `${id} ${item.to}`);
      assert.ok(item.label.length > 0, `${id} ${item.to}`);
    }
  }
});

// ── Owner overrides move navigation too ──────────────────────────────

test('an owner turning a capability off removes its page immediately', () => {
  assert.ok(paths(owner('BAKERY')).includes('/production'));
  assert.ok(!paths(owner('BAKERY', { production: false })).includes('/production'));
  // And turning recipes off takes production with it, because production
  // depends on recipes.
  assert.ok(!paths(owner('BAKERY', { recipes: false })).includes('/production'));
});

// ── Role and permission filtering are unchanged ──────────────────────

test('a restaurant cashier sees the counter, the tickets, the menu and nothing sensitive', () => {
  const nav = paths(cashier('RESTAURANT'));
  assert.deepEqual(nav, ['/counter', '/orders', '/customers', '/expenses', '/products']);
  for (const page of ['/reports', '/settings', '/users', '/close-day', '/purchases', '/stock-take', '/']) {
    assert.equal(nav.includes(page), false, `a cashier must not be offered ${page}`);
  }
});

test('an electronics cashier is never offered an orders page it has no orders for', () => {
  const nav = paths(cashier('ELECTRONICS'));
  assert.deepEqual(nav, ['/counter', '/customers', '/expenses']);
});

test('a pharmacy cashier gets expiry, because dispensing needs it', () => {
  assert.ok(paths(cashier('PHARMACY')).includes('/expiry'));
  assert.ok(!paths(cashier('SUPERMARKET')).includes('/expiry'));
});

test('a granted permission puts its page on the menu; a revoked one takes it off', () => {
  const granted = cashier('SUPERMARKET', { cashierPermissions: { 'reports.view': true, 'stock.receive': true } });
  assert.ok(paths(granted).includes('/reports'));
  assert.ok(paths(granted).includes('/purchases'));

  const revoked = cashier('SUPERMARKET', { cashierPermissions: { 'customers.view': false } });
  assert.ok(!paths(revoked).includes('/customers'));
});

test('the cashier-expenses permission is still honoured, under every profile', () => {
  for (const id of PROFILE_IDS) {
    assert.equal(paths(cashier(id, { cashierCanRecordExpenses: false })).includes('/expenses'), false, id);
    assert.equal(
      paths(cashier(id, { cashierPermissions: { 'expenses.record': false } })).includes('/expenses'),
      false, id
    );
  }
});

test('no permission an owner can grant ever puts an owner-only page on a cashier\'s menu', () => {
  // Every switch on, in every trade. The team, the settings and the
  // dashboard are not permissions, so they cannot appear.
  const everything = Object.fromEntries(
    NAV_ITEMS.filter((i) => i.permission).map((i) => [i.permission, true])
  );
  for (const id of PROFILE_IDS) {
    const nav = paths(cashier(id, { cashierPermissions: everything }));
    for (const page of ['/', '/users', '/settings']) {
      assert.equal(nav.includes(page), false, `${id}: ${page} is the owner's alone`);
    }
  }
});

// ── The mobile bar ───────────────────────────────────────────────────

test('the mobile bar keeps its five slots and never renders a dead tab', () => {
  for (const id of PROFILE_IDS) {
    const items = visibleMobileItems(owner(id));
    assert.ok(items.length > 0, id);
    assert.ok(items.length <= 5, id);
    assert.equal(items.every((i) => typeof i.label === 'string' && i.label), true, id);
    const all = new Set(paths(owner(id)));
    assert.equal(items.every((i) => all.has(i.to)), true, `${id} mobile bar must not show a hidden page`);
  }
});

test('a services business does not get a mobile tab for a page it cannot open', () => {
  const items = visibleMobileItems(owner('GENERAL_SERVICES'));
  for (const item of items) {
    assert.equal(['/purchases', '/suppliers', '/stock-take'].includes(item.to), false);
  }
});

// ── Nothing throws on a half-loaded app ─────────────────────────────

test('navigation resolves before settings or the industry config have arrived', () => {
  assert.doesNotThrow(() => visibleNavItems({ isAdmin: true }));
  assert.doesNotThrow(() => visibleNavItems({}));
  assert.doesNotThrow(() => visibleMobileItems({ isAdmin: false }));
  // A cashier whose permissions have not resolved yet is shown nothing
  // rather than everything: a menu that grows as things load is better
  // than one that shrinks away under a tap.
  assert.deepEqual(visibleNavItems({ isAdmin: false }).map((i) => i.to), []);
  // With no industry config, capability-gated pages stay hidden — the
  // safe direction, since showing then hiding them would flicker.
  // With no config yet it falls back to General Retail: the core product,
  // its ordinary words, and no capability page that would then vanish.
  const early = visibleNavItems({ isAdmin: true });
  assert.equal(early.some((i) => i.capability), false);
  assert.equal(early.find((i) => i.to === '/products').label, 'Products');
});
