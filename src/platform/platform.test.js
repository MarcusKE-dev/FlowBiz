// Platform boundaries that must hold on every shell.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { deepLinkRoute } from './deepLinks.js';
import { billingProvidersFor, googlePlayProductForPlan } from '../billing/catalog.js';

test('deep links: only the two declared FlowBiz paths, over https', () => {
  assert.equal(deepLinkRoute('https://flowbiz.co.ke/auth/action?mode=resetPassword&oobCode=abc'), '/auth/action?mode=resetPassword&oobCode=abc');
  assert.equal(deepLinkRoute('https://flowbiz.co.ke/join/INV_123-x'), '/join/INV_123-x');
  for (const bad of [
    'http://flowbiz.co.ke/auth/action',
    'https://evil.example/auth/action',
    'https://flowbiz.co.ke.evil.example/join/x',
    'https://flowbiz.co.ke/settings',
    'https://flowbiz.co.ke/join/../settings',
    'https://user:pw@flowbiz.co.ke/auth/action',
    'https://flowbiz.co.ke:8443/auth/action',
    'javascript:alert(1)',
    'not a url',
    '',
  ]) {
    assert.equal(deepLinkRoute(bad), null, bad);
  }
});

test('billing: the Android app never offers a web payment provider', () => {
  for (const pricingRegion of ['KE', 'INTL']) {
    const p = billingProvidersFor({ platform: 'android', pricingRegion });
    assert.equal(p.primary, 'google_play');
    assert.deepEqual(p.alternatives, []);
  }
  for (const plan of ['pro', 'lifetime', 'annual_services']) assert.ok(googlePlayProductForPlan(plan), plan);
});

test('modules the Worker imports stay free of React, Firebase and import.meta', () => {
  const dirs = [new URL('../lib/region/', import.meta.url), new URL('../billing/', import.meta.url)];
  for (const dir of dirs) {
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))) {
      const source = readFileSync(new URL(name, dir), 'utf8');
      assert.doesNotMatch(source, /from ['"](react|firebase)/, `${name} must not import React or Firebase`);
      assert.doesNotMatch(source, /import\.meta\.[a-z]/, `${name} must not use import.meta`);
    }
  }
});

test('no screen writes a platform check of its own', () => {
  // Platform branching lives in src/platform/ (and the two contexts that
  // choose a provider). A screen asking `getPlatform() === 'android'` is
  // how two apps start to diverge.
  const root = new URL('../', import.meta.url);
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) { if (!['platform', 'demo'].includes(entry.name)) walk(url); continue; }
      if (!/\.(jsx?|tsx?)$/.test(entry.name) || entry.name.endsWith('.test.js')) continue;
      const source = readFileSync(url, 'utf8');
      if (/getPlatform\(\)\s*===|isNativePlatform\(\)/.test(source) && !url.pathname.endsWith('src/firebase.js')) offenders.push(url.pathname);
    }
  };
  walk(root);
  assert.deepEqual(offenders, []);
});
