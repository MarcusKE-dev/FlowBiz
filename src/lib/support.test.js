// src/lib/support.test.js
//
// The support line is a WhatsApp BUSINESS number, not a published
// switchboard. The product decision is that a customer sees the word
// "WhatsApp" and taps it; the number itself is in the href and nowhere
// else. That is a one-line change away from being undone by somebody
// helpfully "showing the number too", so it is pinned here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SUPPORT_EMAIL, SUPPORT_EMAIL_HREF, SUPPORT_WHATSAPP_E164,
  SUPPORT_WHATSAPP_LABEL, whatsappHref,
} from './support.js';

test('the support address is the flowbiz.co.ke one', () => {
  assert.equal(SUPPORT_EMAIL, 'support@flowbiz.co.ke');
  assert.equal(SUPPORT_EMAIL_HREF, 'mailto:support@flowbiz.co.ke');
});

test('the WhatsApp number is stored in the international form wa.me needs', () => {
  // Local 0741104469 → +254 741104469 → 254741104469. A leading zero or a
  // plus sign both produce a wa.me link that silently fails to resolve.
  assert.equal(SUPPORT_WHATSAPP_E164, '254741104469');
  assert.match(SUPPORT_WHATSAPP_E164, /^[1-9]\d{7,14}$/, 'digits only, no plus, no leading zero');
});

test('whatsappHref builds a link that opens the chat', () => {
  assert.equal(whatsappHref(), 'https://wa.me/254741104469');
});

test('a prefilled message is encoded, not concatenated raw', () => {
  const href = whatsappHref('Hello FlowBiz support, I need help & advice');
  assert.match(href, /^https:\/\/wa\.me\/254741104469\?text=/);
  assert.ok(!href.includes(' '), 'a raw space would truncate the link in some clients');
  assert.ok(href.includes('%26'), 'an ampersand must be encoded or it starts a new parameter');
});

test('an empty or blank message produces the bare link, not a dangling ?text=', () => {
  assert.equal(whatsappHref(''), 'https://wa.me/254741104469');
  assert.equal(whatsappHref('   '), 'https://wa.me/254741104469');
  assert.equal(whatsappHref(null), 'https://wa.me/254741104469');
});

test('THE NUMBER IS NEVER THE LABEL', () => {
  assert.equal(SUPPORT_WHATSAPP_LABEL, 'WhatsApp');
  assert.ok(!/\d/.test(SUPPORT_WHATSAPP_LABEL), 'the label must carry no digits at all');
});

test('the settings screen shows the word, never the number', () => {
  const settings = readFileSync(new URL('../pages/Settings.jsx', import.meta.url), 'utf8');
  assert.match(settings, /SUPPORT_WHATSAPP_LABEL/, 'the label must come from the shared module');
  assert.match(settings, /whatsappHref\(/, 'the href must come from the shared module');
  assert.ok(!settings.includes('741104469'),
    'the number must not be written into a screen — it belongs only in lib/support.js');
  assert.ok(!settings.includes(SUPPORT_WHATSAPP_E164));
});

test('the support link opens safely in a new tab', () => {
  const settings = readFileSync(new URL('../pages/Settings.jsx', import.meta.url), 'utf8');
  const at = settings.indexOf('whatsappHref(');
  const block = settings.slice(at, at + 300);
  assert.match(block, /target="_blank"/);
  assert.match(block, /rel="noopener noreferrer"/,
    'a target=_blank link without noopener hands the opener to the other page');
});

// ── What the settings panel does with these ───────────────────────────
//
// The reported bug: tapping the support email did nothing at all. FlowBiz
// installs as a standalone PWA, so a `mailto:` must be handed to an
// external mail app, and on a device with no mail handler that hand-off
// fails silently. The link is still right when it works — so it stays,
// and a copy button is what makes the address reachable when it does not.

test('the support email is a real mailto link that escapes the standalone window', () => {
  const settings = readFileSync(new URL('../pages/Settings.jsx', import.meta.url), 'utf8');
  const at = settings.indexOf('href={SUPPORT_EMAIL_HREF}');
  assert.ok(at > -1, 'the mailto link must still be there');
  const block = settings.slice(at, at + 300);
  assert.match(block, /target="_blank"/,
    'from a standalone PWA window the protocol has to be routed through the browser');
  assert.match(block, /rel="noopener noreferrer"/);
});

test('THE FIX: the support email can be copied when the mail app does not open', () => {
  const settings = readFileSync(new URL('../pages/Settings.jsx', import.meta.url), 'utf8');
  assert.match(settings, /<CopyRow\s+label="Email"/,
    'the email row must offer a copy, not only a link that can fail silently');
  assert.match(settings, /copyValue=\{SUPPORT_EMAIL\}/,
    'and it must copy the address itself, from the shared module');
});

test('the business id is back, with a copy button', () => {
  const settings = readFileSync(new URL('../pages/Settings.jsx', import.meta.url), 'utf8');
  assert.match(settings, /label="Business ID"/, 'the business id row must exist again');
  assert.match(settings, /copyValue=\{businessId\}/, 'and it must be copyable');
  assert.match(settings, /copiedMessage="Business ID copied\."/);
});

test('a copy that fails says so rather than doing nothing', () => {
  // A silent failure here would be the same class of bug as the mailto:
  // the person taps, nothing happens, and nothing explains why.
  const settings = readFileSync(new URL('../pages/Settings.jsx', import.meta.url), 'utf8');
  const at = settings.indexOf('function CopyRow');
  assert.ok(at > -1);
  const fn = settings.slice(at, at + 1200);
  assert.match(fn, /navigator\.clipboard\.writeText/);
  assert.match(fn, /catch/, 'the clipboard genuinely fails outside a secure context');
  assert.match(fn, /toast\.error/, 'and the failure must be visible');
});
