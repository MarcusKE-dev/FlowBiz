// src/router/staticRoutes.test.js
//
// THE BUG: every deep link into the demo served the PRODUCT.
//
// /demo/ worked because dist/demo/index.html is a real file. Nothing
// under it did. Measured on the live deployment: /demo/customer-display,
// /demo/floor, /demo/kitchen and /demo/anything all came back with
// /assets/index-*.js — the root bundle — rather than
// /demo/assets/index-*.js. The root app boots with no basename, matches
// /demo/… against no route, falls to the catch-all, and renders the
// landing page. Click "Open customer display", get the marketing site.
//
// public/_redirects has carried `/demo/*  /demo/index.html  200` since
// August to prevent exactly this, and it does not fire. So the build
// stopped asking: it writes a real file at every route the router
// declares, and a static asset is served before any rule is consulted.
//
// These tests hold the two halves that can be checked without a deploy:
// the route list is derived from the router rather than kept by hand,
// and the build is still wired to write the files.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { staticRoutePaths, shellFilesFor } from './staticRoutes.js';

const REPO = new URL('../..', import.meta.url).pathname;
const read = (p) => readFileSync(`${REPO}${p}`, 'utf8');

test('THE ROUTES COME FROM THE ROUTER — a screen added there must not need a second list updating', () => {
  const routes = staticRoutePaths(read('src/router/AppRouter.jsx'));

  // The screen this was all about, and the two others opened on their
  // own device where a reload is normal rather than exceptional.
  assert.ok(routes.includes('/customer-display'), 'the customer display must get a shell');
  assert.ok(routes.includes('/kitchen'), 'the kitchen rail must get one — it is reloaded every morning');
  assert.ok(routes.includes('/floor'));
  assert.ok(routes.length > 30, `expected the whole router, got ${routes.length}`);
});

test('AND ONLY THE FIXED ONES — no finite set of files can cover a parameterised route', () => {
  const routes = staticRoutePaths(`
    <Route path="/counter" />
    <Route path="/customers/:customerId" />
    <Route path="/join/:inviteId" />
    <Route path="*" />
    <Route path="/" />
  `);
  assert.deepEqual(routes, ['/counter']);
});

test('BOTH FILENAMES ARE WRITTEN — which one a host reaches for is the assumption that caused this', () => {
  assert.deepEqual(shellFilesFor('/customer-display'), [
    'customer-display.html',
    'customer-display/index.html',
  ]);
  assert.deepEqual(shellFilesFor('/admin/businesses'), [
    'admin/businesses.html',
    'admin/businesses/index.html',
  ]);
});

test('THE DEMO BUILD IS STILL WIRED TO WRITE THEM — the files are the entire fix', () => {
  const config = read('vite.config.js');
  assert.match(config, /shellFilesFor/, 'vite.config.js must import the shell filenames from the router');
  assert.match(config, /mode === 'demo'[\s\S]{0,120}demoRouteShells\(/,
    'the shell plugin must be enabled for the demo build');
  assert.match(config, /outDir: 'dist\/demo'/, 'and pointed at the demo output directory');
});

test('THE REDIRECT FALLBACK DOES NOT POINT AT ITSELF — the likeliest reason the old rule was dropped', () => {
  const redirects = read('public/_redirects');
  const rule = redirects
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .find((l) => l.startsWith('/demo/*'));

  assert.ok(rule, 'a /demo/* fallback must exist for demo URLs that match no declared route');

  const destination = rule.split(/\s+/)[1];
  assert.ok(!destination.startsWith('/demo/'),
    `a 200 rewrite from /demo/* to ${destination} has a destination matching its own source pattern; `
    + 'that rule is silently dropped and every demo deep link falls through to the root app');
});
