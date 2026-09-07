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

// FlowBiz is a Kenyan product and the numbers are Kenyan, so the local
// forms are what get normalised. Kenya is +254, and a mobile number is
// nine digits after the country code, beginning 7 (Safaricom, Airtel) or
// 1 (the 011x range).
const KE_COUNTRY_CODE = '254';
const KE_SUBSCRIBER_LENGTH = 9;

// Room for any national number in E.164 (max 15 digits) without letting
// an obvious typo through as if it were an international number.
const MIN_INTERNATIONAL_DIGITS = 10;
const MAX_INTERNATIONAL_DIGITS = 15;

/**
 * A typed phone number as the digits wa.me needs: country code first, no
 * plus, no spaces, no leading zero. Returns null when the input cannot be
 * read as a phone number at all, so callers can fall back to plain text
 * rather than rendering a link that opens a chat with nobody.
 *
 *   0741104469      -> 254741104469
 *   +254 741 104469 -> 254741104469
 *   254741104469    -> 254741104469
 *   741104469       -> 254741104469
 *   0111 234 567    -> 254111234567
 */
export function toWhatsAppE164(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;

  // Already carries the Kenyan country code.
  if (digits.startsWith(KE_COUNTRY_CODE)
      && digits.length === KE_COUNTRY_CODE.length + KE_SUBSCRIBER_LENGTH) {
    return digits;
  }

  // National format: a leading 0 stands in for the country code.
  if (digits.startsWith('0') && digits.length === KE_SUBSCRIBER_LENGTH + 1) {
    return KE_COUNTRY_CODE + digits.slice(1);
  }

  // Subscriber number alone, as people often say it out loud.
  if (digits.length === KE_SUBSCRIBER_LENGTH && /^[17]/.test(digits)) {
    return KE_COUNTRY_CODE + digits;
  }

  // Not a Kenyan form. If it is long enough to be a full international
  // number, take it as one rather than refusing a valid foreign customer.
  if (digits.length >= MIN_INTERNATIONAL_DIGITS && digits.length <= MAX_INTERNATIONAL_DIGITS) {
    return digits;
  }

  return null;
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
