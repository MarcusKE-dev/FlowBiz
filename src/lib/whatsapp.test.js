// src/lib/whatsapp.test.js
//
// Number normalisation is exactly the kind of thing that breaks quietly:
// a link built from a mis-parsed number opens a chat with a stranger, or
// with nobody, and nothing in the UI says so. So every shape a Kenyan
// merchant might reasonably type is pinned here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { toWhatsAppE164, whatsappLinkTo, followUpMessage } from './whatsapp.js';

test('the local Kenyan forms all reach the same E.164 number', () => {
  for (const typed of [
    '0741104469',
    '0741 104 469',
    '+254741104469',
    '+254 741 104 469',
    '254741104469',
    '741104469',
    '(0741) 104-469',
  ]) {
    assert.equal(toWhatsAppE164(typed), '254741104469', `failed for ${typed}`);
  }
});

test('the 011x mobile range is handled, not just 07', () => {
  assert.equal(toWhatsAppE164('0111234567'), '254111234567');
  assert.equal(toWhatsAppE164('111234567'), '254111234567');
});

test('a number that is not a phone number yields no link', () => {
  for (const junk of ['', '   ', null, undefined, 'abc', '12', '0741', '07411044691234567890']) {
    assert.equal(toWhatsAppE164(junk), null, `should be unusable: ${junk}`);
    assert.equal(whatsappLinkTo(junk), null);
  }
});

test('a full international number is passed through rather than refused', () => {
  // A Ugandan number, typed in full. FlowBiz is Kenyan, but refusing this
  // would silently drop a real customer's contact.
  assert.equal(toWhatsAppE164('+256772123456'), '256772123456');
});

test('the link opens a chat and pre-types the draft', () => {
  const link = whatsappLinkTo('0741104469', 'Hello there');
  assert.equal(link, 'https://wa.me/254741104469?text=Hello%20there');
});

test('a link with no message is still a valid chat link', () => {
  assert.equal(whatsappLinkTo('0741104469'), 'https://wa.me/254741104469');
  assert.equal(whatsappLinkTo('0741104469', '   '), 'https://wa.me/254741104469');
});

test('message text is URL-encoded, so punctuation cannot break the link', () => {
  const link = whatsappLinkTo('0741104469', 'Hi & welcome — ready? 100% set');
  assert.ok(!link.includes(' '), 'no raw spaces');
  assert.ok(link.includes('%26'), 'ampersand encoded, or it would truncate the text');
  assert.ok(link.startsWith('https://wa.me/254741104469?text='));
});

test('the follow-up draft names the person and their shop when known', () => {
  const msg = followUpMessage({ ownerName: 'Jane', businessName: 'Jane Stores' });
  assert.match(msg, /^Hi Jane,/);
  assert.match(msg, /Jane Stores/);
});

test('the follow-up draft still reads properly with nothing known', () => {
  const msg = followUpMessage();
  assert.match(msg, /^Hello,/);
  assert.ok(!msg.includes('undefined'));
  assert.ok(!msg.includes('  '), 'no double spaces where a name would have gone');
});

test('a blank name or shop is treated as absent, not printed', () => {
  const msg = followUpMessage({ ownerName: '   ', businessName: '' });
  assert.match(msg, /^Hello,/);
  assert.ok(!msg.includes('for .'));
});
