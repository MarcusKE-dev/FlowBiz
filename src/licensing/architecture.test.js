// src/licensing/architecture.test.js
//
// TWO BOUNDARIES, ASSERTED RATHER THAN DESCRIBED.
//
//   1. The licensing core is PURE AND PORTABLE. The Cloudflare Worker
//      imports these exact files (cloudflare-worker/src/lib/licensing.js)
//      so that the browser and the server can never disagree about
//      whether a service period has expired. That only works while these
//      files import nothing from React, Firebase, or import.meta — one
//      careless import and the Worker build breaks, or worse, someone
//      "fixes" it by forking the arithmetic.
//
//   2. PRICES LIVE IN ONE FILE. A price written into a component is a
//      price that will be wrong the first time it changes, and the
//      landing page is the place it is most expensive to get wrong.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('..', import.meta.url).pathname;
const REPO = new URL('../..', import.meta.url).pathname;

function filesIn(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) filesIn(path, out);
    else if (path.endsWith('.js') || path.endsWith('.jsx')) out.push(path);
  }
  return out;
}

function importsOf(source) {
  return [...source.matchAll(/^\s*(?:import|export)[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
}

test('THE LICENSING CORE IMPORTS NOTHING THE WORKER CANNOT RUN', () => {
  const offenders = [];
  for (const file of filesIn(join(SRC, 'licensing'))) {
    if (file.endsWith('.test.js')) continue; // a test may reach anywhere
    const source = readFileSync(file, 'utf8');

    for (const specifier of importsOf(source)) {
      // Only relative imports inside src/licensing/ are allowed. No
      // packages, no React, no Firebase, nothing from elsewhere in src/.
      const ok = specifier.startsWith('./') && !specifier.includes('..');
      if (!ok) offenders.push(`${file.replace(REPO, '')} imports ${specifier}`);
    }

    // `import.meta.env` is a Vite construct and is undefined in a Worker.
    if (source.includes('import.meta')) {
      offenders.push(`${file.replace(REPO, '')} uses import.meta`);
    }
  }
  assert.deepEqual(offenders, [],
    'src/licensing must stay pure so cloudflare-worker/src/lib/licensing.js can import it');
});

test('NO PRICE IS WRITTEN DOWN ANYWHERE EXCEPT THE LICENSING CONFIG', () => {
  // Price-SHAPED occurrences only. A bare `3000` is a toast duration or a
  // test fixture and catching those would make this test noise; what must
  // never appear is the licence fee, or a currency-qualified or
  // thousands-separated form of the annual fee.
  const FORBIDDEN = [
    /\b15[,.]?550\b/,
    /(?:KES|Ksh|KSh)\s*3[,.]?000\b/i,
    /\b3,000\b/,
  ];

  const offenders = [];
  for (const file of filesIn(SRC)) {
    // The config is where they belong; tests may assert them by value,
    // which is the whole point of the pricing test.
    if (file === join(SRC, 'licensing/config.js')) continue;
    if (file.endsWith('.test.js')) continue;

    const source = readFileSync(file, 'utf8');
    for (const line of source.split('\n')) {
      // A comment explaining the model is not a hard-coded price.
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      for (const pattern of FORBIDDEN) {
        if (pattern.test(code)) {
          offenders.push(`${file.replace(REPO, '')}: ${line.trim().slice(0, 90)}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [],
    'import the price from src/licensing/config.js instead of writing it out');
});

test('the Worker re-exports the licensing core rather than forking it', () => {
  const workerLib = readFileSync(join(REPO, 'cloudflare-worker/src/lib/licensing.js'), 'utf8');

  // It must reach the shared modules by path, and it must not contain a
  // second copy of the arithmetic.
  assert.ok(workerLib.includes('../../../src/licensing/config.js'),
    'the Worker must import the shared pricing config');
  assert.ok(workerLib.includes('../../../src/licensing/entitlements.js'),
    'the Worker must import the shared entitlement resolver');
  assert.ok(!/function\s+resolveEntitlements\s*\(/.test(workerLib),
    'the Worker must not define its own resolveEntitlements');
  assert.ok(!/function\s+computeRenewedExpiry\s*\(/.test(workerLib),
    'the Worker must not define its own renewal arithmetic');
});

test('no screen re-implements a licence expiry comparison of its own', () => {
  // The one resolver is the point. A component comparing
  // `serviceExpiryDate` to `Date.now()` by hand is how the counter and
  // the billing page end up disagreeing about whether a period has ended.
  const offenders = [];
  for (const file of filesIn(SRC)) {
    if (file.startsWith(join(SRC, 'licensing'))) continue;
    if (file.endsWith('.test.js')) continue;
    const source = readFileSync(file, 'utf8');
    if (/serviceExpiryDate\s*[<>]/.test(source) || /licenseStatus\s*===/.test(source)) {
      offenders.push(file.replace(REPO, ''));
    }
  }
  assert.deepEqual(offenders, [],
    'ask resolveEntitlements() instead of comparing licensing dates by hand');
});
