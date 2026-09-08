// test/authEmails.test.js
//
// THE COMPLAINT: the verification and password-reset emails showed a long
// Firebase URL. Two things caused it — the link was Firebase's whole
// query string copied onto our domain (apiKey, lang, and a second URL
// encoded inside continueUrl), and the plain-text part of the email
// carried no link at all, so a client that fell back to text left the
// person with nothing to click and a preview full of Firebase.
//
// These tests pin the shape of what actually goes in the envelope.

import test from 'node:test';
import assert from 'node:assert/strict';
import { flowbizActionLink } from '../src/lib/identityToolkit.js';
import { verificationEmail, passwordResetEmail } from '../src/lib/emailTemplates.js';

const env = { APP_BASE_URL: 'https://flowbiz.co.ke' };

// What Identity Toolkit actually returns.
const FIREBASE_LINK =
  'https://swiftstock-bc6a3.firebaseapp.com/__/auth/action'
  + '?mode=verifyEmail'
  + '&oobCode=Xy7QpL0aB3cD4eF5gH6iJ8kL9mN0oP1qR2sT3uV4wX5'
  + '&apiKey=AIzaSyD-fake-key-for-tests-only-000000000'
  + '&lang=en'
  + '&continueUrl=https%3A%2F%2Fflowbiz.co.ke%2Fauth%2Faction%3Fflow%3DverifyEmail';

// ── The link ──────────────────────────────────────────────────────────

test('the emailed link is on flowbiz.co.ke, not on firebaseapp.com', () => {
  const link = flowbizActionLink(env, FIREBASE_LINK);
  const url = new URL(link);
  assert.equal(url.origin, 'https://flowbiz.co.ke');
  assert.equal(url.pathname, '/auth/action');
  assert.ok(!link.includes('firebaseapp.com'));
});

test('THE FIX: the link carries only what our own page reads', () => {
  const url = new URL(flowbizActionLink(env, FIREBASE_LINK));
  assert.deepEqual([...url.searchParams.keys()].sort(), ['mode', 'oobCode']);
  assert.equal(url.searchParams.get('mode'), 'verifyEmail');
  assert.equal(url.searchParams.get('oobCode'), 'Xy7QpL0aB3cD4eF5gH6iJ8kL9mN0oP1qR2sT3uV4wX5');
});

test('the API key and the nested continueUrl are gone', () => {
  const link = flowbizActionLink(env, FIREBASE_LINK);
  assert.ok(!link.includes('apiKey'), 'the API key adds only length to a customer-visible URL');
  assert.ok(!link.includes('continueUrl'), 'a redirect target for a redirect that never happens');
  assert.ok(!link.includes('%3A%2F%2F'), 'no second URL encoded inside the first');
  assert.ok(!link.includes('lang='));
});

test('and it is short enough to print in an email', () => {
  const link = flowbizActionLink(env, FIREBASE_LINK);
  assert.ok(link.length < 120, `link is still ${link.length} characters: ${link}`);
  assert.ok(link.length < FIREBASE_LINK.length / 2, 'less than half of what Firebase handed us');
});

test('a password-reset link keeps its own mode', () => {
  const reset = FIREBASE_LINK.replace('mode=verifyEmail', 'mode=resetPassword');
  const url = new URL(flowbizActionLink(env, reset));
  assert.equal(url.searchParams.get('mode'), 'resetPassword');
});

test('a trailing slash on APP_BASE_URL does not produce a double slash', () => {
  const link = flowbizActionLink({ APP_BASE_URL: 'https://flowbiz.co.ke/' }, FIREBASE_LINK);
  assert.ok(link.startsWith('https://flowbiz.co.ke/auth/action?'), link);
  assert.ok(!link.includes('//auth'), link);
});

test('UGLY BEATS UNDELIVERABLE: a link this cannot parse is passed through untouched', () => {
  assert.equal(flowbizActionLink(env, 'not a url'), 'not a url');
  const noCode = 'https://swiftstock-bc6a3.firebaseapp.com/__/auth/action?mode=verifyEmail';
  assert.equal(flowbizActionLink(env, noCode), noCode,
    'a link with no code cannot be rebuilt, and a broken short link is worse than a long one');
});

test('an oobCode with URL-significant characters survives the round trip', () => {
  const tricky = 'https://x.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=a%2Bb%2Fc%3Dd';
  const url = new URL(flowbizActionLink(env, tricky));
  assert.equal(url.searchParams.get('oobCode'), 'a+b/c=d',
    'the code must decode back to exactly what Firebase issued');
});

// ── The email bodies ──────────────────────────────────────────────────

const LINK = 'https://flowbiz.co.ke/auth/action?mode=verifyEmail&oobCode=ABC123';

for (const [name, build] of [
  ['verification', verificationEmail],
  ['password reset', passwordResetEmail],
]) {
  test(`the ${name} email has a plain-text part that actually contains the link`, () => {
    const { text } = build(LINK);
    assert.ok(text.includes(LINK),
      'a client that renders text-only left the person with nothing to click');
  });

  // REVERSED DELIBERATELY. This used to require the URL written out under
  // the button as a visible fallback. "Remove the url link" took that out:
  // a printed action URL reads like phishing to a customer. The link now
  // appears in the HTML exactly once, as the button's href, and the
  // plain-text part above is what covers a client that strips anchors.
  test(`the ${name} email puts the link in the button and does not print it`, () => {
    const { html } = build(LINK);
    const occurrences = html.split(LINK).length - 1;
    assert.equal(occurrences, 1, `the link belongs in the button href alone, found ${occurrences}`);
    assert.match(html, new RegExp(`href="${LINK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
      'the one occurrence must be the button href, not stray text');
  });

  // THE REGRESSION THIS FILE EXISTS TO CATCH from here on: a call to a
  // helper that no longer exists threw ReferenceError at render time, so
  // every verification and reset email died before it reached Resend.
  test(`the ${name} email renders without throwing`, () => {
    assert.doesNotThrow(() => build(LINK),
      'a template that throws takes down signup verification and password reset at once');
  });

  test(`the ${name} email is branded FlowBiz blue and carries a support address`, () => {
    const { html } = build(LINK);
    assert.match(html, /#1D70F5/, 'the brand blue');
    assert.match(html, />FlowBiz</, 'the wordmark in the header');
    assert.match(html, /support@flowbiz\.co\.ke/, 'a way to reach a human being');
  });

  test(`the ${name} email says the link is single use`, () => {
    const { html, text } = build(LINK);
    assert.match(html, /only be used once/i);
    assert.match(text, /only be used once/i);
  });

  test(`the ${name} email mentions no Firebase or Google domain anywhere`, () => {
    const { html, text, subject } = build(LINK);
    for (const [part, body] of Object.entries({ html, text, subject })) {
      assert.ok(!/firebaseapp\.com|googleapis\.com|firebaseio\.com/.test(body),
        `${part} leaks an infrastructure domain to the customer`);
    }
  });

  test(`the ${name} email has a subject, an HTML body and a text body`, () => {
    const { subject, html, text } = build(LINK);
    assert.ok(subject && subject.length < 78, 'a subject that survives a phone inbox');
    assert.match(html, /^<!doctype html>/);
    assert.ok(text && text.length > 40);
  });
}
