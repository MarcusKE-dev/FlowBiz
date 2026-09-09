// src/legal/legalLinks.test.js
//
// THE LEGAL DOCUMENTS HAVE TO BE REACHABLE, and "reachable" is a claim
// about specific screens, not a vibe. A Terms of Service that describes a
// perpetual licence and an annual service fee is worth nothing if the
// customer never sees it before they pay.
//
// These are static assertions over the source rather than a rendered
// browser test on purpose: they run in the ordinary `npm test` with no
// emulator, no browser and no network, and they fail the moment somebody
// removes a link during a redesign — which is exactly when it happens.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const REPO = new URL('../..', import.meta.url).pathname;
const read = (path) => readFileSync(`${REPO}${path}`, 'utf8');

/** Both documents, and the routes that serve them. */
test('/terms and /privacy are routed', () => {
  const router = read('src/router/AppRouter.jsx');
  assert.match(router, /path="\/terms"/, 'the Terms route must exist');
  assert.match(router, /path="\/privacy"/, 'the Privacy route must exist');
  // Public, not behind ProtectedRoute — somebody has to be able to read
  // them before they have an account.
  const termsLine = router.split('\n').find((l) => l.includes('path="/terms"'));
  const privacyLine = router.split('\n').find((l) => l.includes('path="/privacy"'));
  assert.ok(!/ProtectedRoute/.test(termsLine), 'Terms must be publicly readable');
  assert.ok(!/ProtectedRoute/.test(privacyLine), 'Privacy must be publicly readable');
});

const SCREENS_THAT_MUST_LINK = [
  ['the setup / sign-up form', 'src/pages/Setup.jsx'],
  ['the billing and purchase screen', 'src/pages/Pro.jsx'],
  ['the settings screen', 'src/pages/Settings.jsx'],
  ['the licensing panel', 'src/components/licensing/LicensingPanel.jsx'],
  ['the landing page pricing section', 'src/components/landing/PricingComparison.jsx'],
];

// A screen may satisfy this either by carrying the links itself or by
// rendering <LifetimeDisclosure />, which carries both and is separately
// asserted below to do so. Requiring the literal `to="/terms"` in every
// file was what this test used to do, and it turned the right refactor —
// pulling one disclosure block out of three screens into one component —
// into a failure, which is how a screen ends up with no disclosure at all
// rather than a shared one.
const linksToLegal = (source) => ({
  terms: /to="\/terms"/.test(source) || /<LifetimeDisclosure/.test(source),
  privacy: /to="\/privacy"/.test(source) || /<LifetimeDisclosure/.test(source),
});

for (const [label, path] of SCREENS_THAT_MUST_LINK) {
  test(`${label} links to the legal documents`, () => {
    const { terms, privacy } = linksToLegal(read(path));
    // The landing pricing card links to the Terms specifically, because
    // that is the document describing what the annual fee buys. Every
    // other screen carries both.
    assert.ok(terms, `${label} must link to /terms`);
    if (path !== 'src/components/landing/PricingComparison.jsx') {
      assert.ok(privacy, `${label} must link to /privacy`);
    }
  });
}

/** The shared component the screens above are allowed to delegate to. */
test('the shared disclosure carries both documents itself', () => {
  const source = read('src/components/licensing/LifetimeDisclosure.jsx');
  assert.match(source, /to="\/terms"/, 'the disclosure must link to /terms');
  assert.match(source, /to="\/privacy"/, 'the disclosure must link to /privacy');
});

test('the setup form puts the agreement after the submit button, not above the fields', () => {
  const source = read('src/pages/Setup.jsx');
  const submitIndex = source.indexOf('Create business');
  const legalIndex = source.indexOf('to="/terms"');
  assert.ok(submitIndex > -1 && legalIndex > -1);
  assert.ok(legalIndex > submitIndex,
    'the legal links belong below the form actions, where an account-creation form puts them');
});

test('the purchase disclosure appears before the purchase button', () => {
  const source = read('src/pages/Pro.jsx');
  const disclosure = source.indexOf('<LifetimeDisclosure');
  const buyButton = source.indexOf('Buy Lifetime Licence');
  assert.ok(disclosure > -1, 'the pre-purchase disclosure must be rendered');
  assert.ok(buyButton > -1, 'the purchase button must exist');
  assert.ok(disclosure < buyButton,
    'a customer must read what happens in year two before they can commit to year one');
});

test('the documents carry a version and an effective date', () => {
  const versions = read('src/legal/documentVersions.js');
  assert.match(versions, /TERMS_VERSION/);
  assert.match(versions, /PRIVACY_VERSION/);
  assert.match(read('src/pages/Terms.jsx'), /TERMS_VERSION/, 'the Terms page must show its version');
  assert.match(read('src/pages/Privacy.jsx'), /PRIVACY_VERSION/, 'the Privacy page must show its version');
});

// ── The wording itself ────────────────────────────────────────────────
//
// These are the phrases the commercial model forbids. They are cheap to
// write by accident during a marketing pass and expensive to have on a
// page when a customer disputes a bill.

const MISLEADING = [
  'lifetime cloud',
  'lifetime updates',
  'lifetime support',
  'lifetime hosting',
  'everything forever',
  'free forever',
  'no renewals, ever',
  'unlimited cloud',
];

const CUSTOMER_FACING = [
  'src/components/landing/PricingComparison.jsx',
  'src/components/landing/FaqSection.jsx',
  'src/components/landing/HeroSection.jsx',
  'src/components/landing/FeatureGrid.jsx',
  'src/pages/Pro.jsx',
  'src/pages/Terms.jsx',
  'src/components/licensing/LicensingPanel.jsx',
  'src/components/licensing/LicensingSummary.jsx',
  'src/components/licensing/ServiceRenewalNotice.jsx',
  'src/components/licensing/licensingCopy.js',
];

test('NO CUSTOMER-FACING SCREEN PROMISES LIFETIME CLOUD, UPDATES OR SUPPORT', () => {
  // Two things this scan has to get right, or it is worse than useless.
  //
  //   COMMENTS ARE NOT COPY. The files that most need to name these
  //   phrases are the ones warning the next developer away from them.
  //
  //   NEGATIONS ARE NOT PROMISES. "This is not a purchase of unlimited
  //   cloud hosting" is exactly the sentence the Terms should contain,
  //   and flagging it would push somebody to delete the clarification
  //   that makes the model honest.
  const NEGATION = /\b(not|never|no|nor|rather than|instead of|without)\b[^.]{0,60}$/i;

  const stripComments = (source) => source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ' '))
    .join('\n');

  const offenders = [];
  for (const path of CUSTOMER_FACING) {
    const source = stripComments(read(path)).toLowerCase();
    for (const phrase of MISLEADING) {
      let from = 0;
      for (;;) {
        const at = source.indexOf(phrase, from);
        if (at === -1) break;
        from = at + phrase.length;
        const before = source.slice(Math.max(0, at - 80), at);
        if (!NEGATION.test(before)) offenders.push(`${path}: "${phrase}"`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'the licence is perpetual; the cloud services, updates and support are not');
});

test('the landing page states the annual fee on the same card as the licence price', () => {
  const source = read('src/components/landing/PricingComparison.jsx');
  assert.match(source, /ANNUAL_SERVICE_PRICE_KES/,
    'the annual fee must be shown, from the shared config');
  assert.match(source, /LIFETIME_LICENSE_PRICE_KES/);
  assert.match(source, /does not expire if you choose not to renew/i,
    'the card must say the licence survives non-renewal');
  assert.ok(source.indexOf('SERVICE_PRICE') < source.indexOf('Get the Lifetime Licence'),
    'the annual fee must be visible above the call to action');
});
