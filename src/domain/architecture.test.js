// src/domain/architecture.test.js
//
// THE ARCHITECTURE ITSELF, asserted rather than described.
//
// A boundary that lives only in a document is a boundary that erodes: the
// first person in a hurry imports across it, nothing complains, and six
// months later the "platform core" is a pile of one industry's special
// cases. These tests are the thing that complains.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('..', import.meta.url).pathname;

function filesIn(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) filesIn(path, out);
    else if (path.endsWith('.js') || path.endsWith('.jsx')) out.push(path);
  }
  return out;
}

function importsOf(path) {
  const source = readFileSync(path, 'utf8');
  return [...source.matchAll(/^\s*(?:import|export)[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
}

test('THE PLATFORM CORE DOES NOT KNOW THE INDUSTRY DOMAINS EXIST', () => {
  // The one directional rule the whole design rests on:
  //
  //     domain/fnb  →  utils/, industry/     allowed
  //     utils/      →  domain/fnb            never
  //
  // It is what keeps a retail business's counter, reports and financials
  // provably unaffected by everything in the food-service engine, and it
  // is what would let a second domain engine be added later without
  // either one learning about the other.
  const offenders = [];
  for (const dir of ['utils', 'industry']) {
    for (const file of filesIn(join(SRC, dir))) {
      if (file.endsWith('.test.js')) continue;   // a test may reach anywhere
      for (const specifier of importsOf(file)) {
        if (specifier.includes('domain/')) {
          offenders.push(`${file.replace(SRC, 'src/')} imports ${specifier}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [],
    'the platform core must never import an industry domain engine');
});

test('the food-service engine depends only on the platform core and itself', () => {
  // Not on pages, not on components, not on contexts. A domain engine
  // that imports a React component is a domain engine that cannot be
  // reasoned about, tested, or reused by a second screen.
  const offenders = [];
  for (const file of filesIn(join(SRC, 'domain'))) {
    if (file.endsWith('.test.js')) continue;
    for (const specifier of importsOf(file)) {
      if (!specifier.startsWith('.')) continue;
      const forbidden = ['pages/', 'components/', 'contexts/', 'hooks/', 'router/'];
      if (forbidden.some((f) => specifier.includes(f))) {
        offenders.push(`${file.replace(SRC, 'src/')} imports ${specifier}`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'a domain engine must stay pure of the UI');
});

test('NOTHING ANYWHERE BRANCHES ON AN INDUSTRY PROFILE ID', () => {
  // The failure mode this whole architecture exists against:
  //
  //     if (industry.profileId === 'RESTAURANT') …
  //
  // A profile is a named set of defaults. Every question the application
  // asks is "is this capability on?", which is why adding a sixteenth
  // trade is a table entry rather than a search through the codebase.
  //
  // profiles.js is where the table itself lives, and the profile picker
  // and the setup screen legitimately name profiles to LIST them.
  const allowed = [
    'industry/profiles.js', 'industry/config.js', 'industry/config.test.js',
    'industry/categories.js', 'industry/expenseCategories.js',
    'industry/permissions.js',
  ];
  const pattern = /profileId\s*===\s*['"]|profileId\s*==\s*['"]|industryProfile\s*===\s*['"]/;
  const offenders = [];
  for (const file of filesIn(SRC)) {
    const relative = file.replace(SRC, '');
    if (relative.startsWith('demo/') || file.endsWith('.test.js')) continue;
    if (allowed.some((a) => relative.endsWith(a.replace('industry/', 'industry/')))) continue;
    if (pattern.test(readFileSync(file, 'utf8'))) offenders.push(`src/${relative}`);
  }
  assert.deepEqual(offenders, [],
    'branch on a capability, never on a trade');
});

test('every capability the client offers is one the server will accept', async () => {
  // The client copy is a convenience; the Worker and the rules are the
  // enforcement. A capability an owner can toggle in the UI and the
  // server then refuses is a switch that silently does nothing.
  const { CAPABILITIES, CAPABILITY_KEYS } = await import('../industry/capabilities.js');
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const block = rules.slice(rules.indexOf('function capabilityOverridesOk'));
  const listed = new Set([...block.slice(0, block.indexOf('])')).matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]));

  for (const key of CAPABILITY_KEYS) {
    if (!CAPABILITIES[key].ownerConfigurable) {
      assert.equal(listed.has(key), false, `${key} is locked and must NOT be writable by an owner`);
    } else {
      assert.equal(listed.has(key), true, `${key} is owner-configurable but firestore.rules refuses it`);
    }
  }
});

test('every capability dependency names a capability that exists', async () => {
  const { CAPABILITIES, CAPABILITY_KEYS } = await import('../industry/capabilities.js');
  for (const key of CAPABILITY_KEYS) {
    for (const dependency of CAPABILITIES[key].requires || []) {
      assert.ok(CAPABILITY_KEYS.includes(dependency), `${key} requires ${dependency}, which does not exist`);
    }
  }
});

test('every permission that names a capability names one that exists', async () => {
  const { CASHIER_PERMISSIONS, PERMISSION_KEYS } = await import('../industry/permissions.js');
  const { CAPABILITY_KEYS } = await import('../industry/capabilities.js');
  for (const key of PERMISSION_KEYS) {
    const capability = CASHIER_PERMISSIONS[key].capability;
    if (capability) {
      assert.ok(CAPABILITY_KEYS.includes(capability), `${key} is gated on ${capability}, which does not exist`);
    }
    for (const dependency of CASHIER_PERMISSIONS[key].requires || []) {
      assert.ok(PERMISSION_KEYS.includes(dependency), `${key} requires ${dependency}, which does not exist`);
    }
  }
});

test('GENERAL RETAIL STILL HAS NOTHING SWITCHED ON', async () => {
  // The protected baseline. Every business that predates the industry
  // layer resolves to this, so a capability leaking into it changes what
  // an existing shop sees, and that must never happen by accident.
  const { resolveIndustryConfig } = await import('../industry/config.js');
  const { CAPABILITY_KEYS } = await import('../industry/capabilities.js');
  const retail = resolveIndustryConfig({ industryProfile: 'GENERAL_RETAIL' });
  for (const key of CAPABILITY_KEYS) {
    assert.equal(retail.can(key), false, `${key} must stay off for General Retail`);
  }
  assert.equal(resolveIndustryConfig(null).profileId, 'GENERAL_RETAIL');
});
