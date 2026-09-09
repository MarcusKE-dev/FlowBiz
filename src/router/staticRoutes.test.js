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

test('NOTHING IN _redirects TOUCHES /demo — every rule tried there made it worse', () => {
  // Two were tried on the live deployment. `/demo/*  /demo/index.html
  // 200` was silently dropped (destination matches its own source
  // pattern), so demo deep links fell through to the root app and showed
  // the landing page. `/demo/*  /demo-shell.html  200` was honoured — as
  // a 308 REDIRECT, ahead of the static files, bouncing /demo/ itself
  // onto a path outside the router's basename, which renders blank.
  //
  // The route shells need no rule. A rule here can only take precedence
  // over them and break them again.
  const rules = read('public/_redirects')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const demoRules = rules.filter((l) => l.split(/\s+/)[0].startsWith('/demo'));
  assert.deepEqual(demoRules, [],
    'a /demo rule fires ahead of the route shells and has broken the demo every time it has been added');

  assert.deepEqual(rules, ['/*  /index.html  200'],
    'the root SPA fallback is the only rule measured to behave as a rewrite rather than a redirect');
});
