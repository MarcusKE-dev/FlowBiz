// src/router/landingBoot.test.js
//
// WHAT A STRANGER SEES FIRST. Somebody who searches for flowbiz.co.ke has
// not launched anything — so a boot screen reading "Starting FlowBiz…" is
// both wrong and, on a slow connection, the entire first impression of
// the product. The public entry points must resolve auth behind a blank
// canvas and then paint the real page.
//
// A source-level assertion rather than a rendered test, on purpose: it
// runs in the ordinary `npm test` with no browser, and it fails the
// moment somebody reintroduces a branded splash during a redesign — which
// is exactly when it comes back.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const router = readFileSync(new URL('./AppRouter.jsx', import.meta.url), 'utf8');

/** Source with comments stripped — a warning about a phrase is not the phrase. */
const code = router
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ' '))
  .join('\n');

test('NO BOOT SPLASH: nothing renders the words "Starting FlowBiz"', () => {
  assert.ok(!/Starting FlowBiz/.test(code),
    'a first-time visitor has not started an app, and must not be told they are waiting for one');
});

test('the public entry points render the blank resolver, not a spinner', () => {
  // Both of the places that gate on auth before any page is known.
  assert.match(code, /function AuthResolving\(\)/,
    'the blank auth-resolving screen must exist');
  assert.match(code, /function PublicOnly\([\s\S]{0,200}?if \(loading\) return <AuthResolving \/>/,
    'PublicOnly must resolve auth behind a blank screen');
  assert.match(code, /function RootRoute\(\)[\s\S]{0,600}?if \(loading\) return <AuthResolving \/>/,
    'the root route must resolve auth behind a blank screen');
});

test('the blank resolver really is blank — no label, no spinner', () => {
  const body = code.slice(code.indexOf('function AuthResolving()'));
  const end = body.indexOf('\n}');
  const fn = body.slice(0, end);
  assert.ok(!/LoadingSpinner/.test(fn), 'no spinner');
  assert.ok(!/animate-spin/.test(fn), 'no spinner by hand either');
  assert.ok(!/>[^<>{}]*[A-Za-z]{3}[^<>{}]*</.test(fn), 'no visible text of any kind');
});

test('the landing page is NOT lazy, so it cannot flash a Suspense fallback', () => {
  // A lazy landing page would suspend on first paint and fall through to
  // the router's "Loading..." fallback — reintroducing the very splash
  // this file exists to prevent, by a different route.
  assert.match(code, /^import LandingPage from '\.\.\/pages\/LandingPage';$/m,
    'LandingPage must be a static import');
  assert.ok(!/lazy\(\s*\(\)\s*=>\s*import\('\.\.\/pages\/LandingPage'\)/.test(code),
    'LandingPage must never be wrapped in lazy()');
});
