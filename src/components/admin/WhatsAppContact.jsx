// src/components/admin/WhatsAppContact.jsx
//
// A merchant's phone number in the admin console, as a link that opens a
// WhatsApp chat with them and pre-types a follow-up. Clicking is the only
// automation: the draft opens in the box, unsent, for a person to read,
// change and send. See src/lib/whatsapp.js — nothing here talks to Meta.
//
// Three states, and the middle one matters:
//
//   no number        say so plainly, so a blank cell is never mistaken
//                    for a number that failed to render
//   unusable number  show the number as TEXT, never as a link. A link
//                    built from a number WhatsApp cannot parse opens a
//                    chat with nobody, or worse, with somebody else
//   usable number    the link
//
// It opens in a new tab because wa.me hands off to the WhatsApp client,
// and losing the console's place in a long business list to do that would
// be its own small annoyance.

import { MessageCircle } from 'lucide-react';
import { whatsappLinkTo, followUpMessage } from '../../lib/whatsapp';

export default function WhatsAppContact({
  phone,
  ownerName,
  businessName,
  className = '',
  emptyLabel = 'No phone on file',
}) {
  const raw = String(phone || '').trim();
  if (!raw) {
    return <span className={`text-ink-400 ${className}`}>{emptyLabel}</span>;
  }

  const href = whatsappLinkTo(raw, followUpMessage({ ownerName, businessName }));
  if (!href) {
    return (
      <span className={`num text-ink-500 ${className}`} title="Not a number WhatsApp can open">
        {raw}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 font-medium text-primary-700
                  hover:underline ${className}`}
      title="Open a WhatsApp chat with this number"
    >
      <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="num">{raw}</span>
    </a>
  );
}
