// src/lib/appUrl.test.js
//
// Two tests for one bug, because the bug had two halves.
//
// THE BEHAVIOUR: a path built here must carry the build's basename, so
// the demo's "Open customer display" opens the DEMO's display and not
// the product's.
//
// THE SPREAD: nothing may go back to hard-coding it. Every plain
// <a href="/…"> and every window.location assignment is handed to the
// browser, which resolves it against the origin and drops the basename —
// so a single one of them anywhere in src/ puts a visitor out of the
// demo and into the real app, signed in as nobody. That is a source
// scan, not a unit test, for the same reason
// src/domain/fnb/wiring.test.js is: the individual line always looks
// fine, and only the rule catches it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { appPath, appUrl, pathUnder } from './appUrl.js';

const REPO = new URL('../..', import.meta.url).pathname;
const read = (path) => readFileSync(`${REPO}${path}`, 'utf8');

test('A PATH CARRIES THE BUILD IT BELONGS TO — the product at the root, the demo under /demo', () => {
  assert.equal(pathUnder('/', '/customer-display'), '/customer-display');
  assert.equal(pathUnder('/', 'customer-display'), '/customer-display');
  assert.equal(pathUnder('/', '/'), '/');

  assert.equal(pathUnder('/demo/', '/customer-display'), '/demo/customer-display',
    "the demo must open its OWN display, not the product's");
  assert.equal(pathUnder('/demo/', '/login'), '/demo/login');
  assert.equal(pathUnder('/demo/', '/'), '/demo/');
  assert.equal(pathUnder('/demo/', '/join/abc123'), '/demo/join/abc123');
});

test('AND THE BASE IT IS GIVEN IS THE ONE THE DEMO IS ACTUALLY BUILT AND MOUNTED AT', () => {
  // Three copies of "/demo" have to agree or the fix above is fiction:
  // what Vite serves the assets from, what React Router strips off the
  // front of a URL, and what this module joins paths onto.
  assert.match(read('vite.config.js'), /base:\s*mode === 'demo' \? '\/demo\/'/,
    'vite must build the demo under /demo/');
  assert.match(read('src/main.jsx'), /basename=\{import\.meta\.env\.MODE === 'demo' \? '\/demo' : undefined\}/,
    'the router must be mounted under /demo');
  assert.match(read('src/lib/appUrl.js'), /import\.meta\.env\?\.BASE_URL/,
    'appPath must read the base from the build, not a copy of the string');
});

test('AN ABSOLUTE URL IS THE SAME ANSWER — for an address somebody copies to another screen', () => {
  // With no window it degrades to the path rather than inventing an origin.
  assert.equal(appUrl('/customer-display'), appPath('/customer-display'));

  globalThis.window = { location: { origin: 'https://flowbiz.co.ke' } };
  try {
    assert.equal(appUrl('/customer-display'), 'https://flowbiz.co.ke/customer-display');
  } finally {
    delete globalThis.window;
  }
});

// ── The scan ─────────────────────────────────────────────────────────

/**
 * The only places allowed to name an absolute path literally, and why.
 * Each of these DELIBERATELY leaves the current build.
 */
const INTENTIONAL_ESCAPES = {
  'src/components/layout/TopHeader.jsx': [
    '/',        // "Exit demo" — leaving the demo is the whole point
    '/setup',   // "Sign up" — the real product's signup, from the demo banner
  ],
  'src/components/landing/HeroSection.jsx': [
    '/demo/',   // the landing page's way IN to the demo
  ],
};

/**
 * Comments are not code. This file and several others EXPLAIN the bug by
 * quoting the shape of it, and a scan that cannot tell an example from a
 * call site fails on its own documentation. The `[^:]` guard keeps a
 * `https://` inside a string from being read as the start of a comment.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(`${REPO}${dir}`, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) sourceFiles(rel, out);
    else if (/\.jsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(rel);
  }
  return out;
}

test('NOTHING HARD-CODES AN APP PATH — a basename dropped here throws a visitor out of the demo', () => {
  const offenders = [];

  for (const file of sourceFiles('src')) {
    const source = stripComments(readFileSync(`${REPO}${file}`, 'utf8'));
    const allowed = INTENTIONAL_ESCAPES[file] || [];

    // <a href="/whatever">
    for (const m of source.matchAll(/href=["'](\/[^"']*)["']/g)) {
      if (!allowed.includes(m[1])) offenders.push(`${file}: href="${m[1]}" — use appPath()`);
    }
    // window.location.href = '/whatever'  (and .assign/.replace)
    for (const m of source.matchAll(/location\.(?:href\s*=|assign\(|replace\()\s*[`'"](\/[^`'"]*)/g)) {
      if (!allowed.includes(m[1])) offenders.push(`${file}: location → "${m[1]}" — use appPath()`);
    }
    // `${window.location.origin}/whatever`
    for (const m of source.matchAll(/location\.origin\}(\/[^`'"]*)/g)) {
      offenders.push(`${file}: origin + "${m[1]}" — use appUrl()`);
    }
  }

  assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n`);
});
