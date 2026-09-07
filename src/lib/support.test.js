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
