// src/lib/whatsapp.js
//
// Turning a phone number somebody typed into a link that opens a WhatsApp
// chat with them. Two small pure functions and a message template — that
// is the whole feature.
//
// WHAT THIS DELIBERATELY IS NOT: it is not the WhatsApp Business Cloud
// API. Nothing here sends a message, schedules one, or talks to Meta, and
// no Meta app, business verification or access token is involved at any
// point. A `wa.me` link is a plain URL that the WhatsApp client — phone
// app, desktop app or web — opens on a chat with the number in it, with
// the draft text pre-typed and NOT sent. A person still reads it, edits
// it if they want, and presses send. That is the correct behaviour for
// follow-up: it is a shortcut for a human, not an automation.
//
// A consequence worth stating plainly, because a link cannot change it:
// the chat opens in WHICHEVER WhatsApp account is signed in on the device
// that clicks it. There is no way for a URL to choose the sender. So the
// follow-up arrives from the FlowBiz support line only when the person
// clicking is signed in to WhatsApp as that line.

import { toE164Digits } from './region/phone.js';
import { DEFAULT_REGION } from './region/region.js';

/**
 * A typed phone number as the digits wa.me needs: country code first, no
 * plus, no spaces, no leading zero. Returns null when the input cannot be
 * read as a phone number at all, so callers can fall back to plain text
 * rather than rendering a link that opens a chat with nobody.
 *
 * National forms are read in `region` (see lib/region/phone.js). The admin
 * console passes nothing, which reads them as Kenyan — the right default
 * for numbers stored before sign-up recorded E.164; newer owner numbers
 * are stored with their country code and read the same in any region.
 *
 *   0741104469      -> 254741104469
 *   +254 741 104469 -> 254741104469
 *   +1 415 555 2671 -> 14155552671
 */
export function toWhatsAppE164(raw, region = DEFAULT_REGION) {
  return toE164Digits(raw, { region });
}

/**
 * A wa.me link that opens a chat with `phone`, optionally with `message`
 * pre-typed in the box. Null when the number is unusable — render the
 * number as plain text in that case, never as a dead link.
 */
export function whatsappLinkTo(phone, message = '') {
  const e164 = toWhatsAppE164(phone);
  if (!e164) return null;
  const text = String(message || '').trim();
  return text
    ? `https://wa.me/${e164}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${e164}`;
}

/**
 * The draft that appears in the WhatsApp box. Edit this and every
 * follow-up link in the admin console changes with it.
 *
 * It opens as a DRAFT: whoever clicks reads it, adjusts it for the
 * business in front of them, and sends it themselves.
 */
export function followUpMessage({ ownerName, businessName } = {}) {
  const who = String(ownerName || '').trim();
  const shop = String(businessName || '').trim();
  const greeting = who ? `Hi ${who}` : 'Hello';
  const about = shop ? ` for ${shop}` : '';
  return `${greeting}, this is FlowBiz support. Thanks for setting up your FlowBiz account${about}. `
    + 'Is there anything you would like a hand with getting started?';
}
