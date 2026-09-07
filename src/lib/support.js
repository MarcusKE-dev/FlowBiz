// src/lib/support.js
//
// How a customer reaches FlowBiz, in ONE place. These details end up on
// screens, in emails and in documents, and a support address that is
// right in three of those and stale in the fourth is worse than one that
// is merely hard to find.
//
// THE PHONE NUMBER IS NEVER RENDERED. It is a WhatsApp Business line, not
// a published switchboard, so the UI shows the word "WhatsApp" and the
// number lives only inside the href. That is a deliberate product
// decision — see whatsappHref() below — and the test beside this file
// pins it, because "just show the number too" is a one-line change
// somebody will otherwise make in good faith.

export const SUPPORT_EMAIL = 'support@flowbiz.co.ke';

/**
 * The WhatsApp Business line, in the international form wa.me requires:
 * no plus, no spaces, no leading zero. Kenya is +254, so the local
 * 0741104469 is 254741104469.
 */
export const SUPPORT_WHATSAPP_E164 = '254741104469';

export const SUPPORT_EMAIL_HREF = `mailto:${SUPPORT_EMAIL}`;

/**
 * A wa.me link that opens WhatsApp on phone and desktop alike.
 *
 * `message` is optional and is URL-encoded; pass the screen the person
 * was on so support opens with context instead of "hi".
 */
export function whatsappHref(message = '') {
  const base = `https://wa.me/${SUPPORT_WHATSAPP_E164}`;
  const text = String(message || '').trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** The label shown for the WhatsApp link. Never the number itself. */
export const SUPPORT_WHATSAPP_LABEL = 'WhatsApp';
