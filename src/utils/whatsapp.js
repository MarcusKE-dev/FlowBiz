// src/utils/whatsapp.js
//
// Centralized WhatsApp deep-link utilities — the ONLY place in FlowBiz that
// builds a wa.me URL or normalizes a phone number for WhatsApp purposes.
// Every component that needs to "send via WhatsApp" imports from here
// instead of re-implementing phone normalization / URL construction
// (previously duplicated between documentService.js and nowhere else —
// this file is now the single source so future WhatsApp features don't
// grow a third copy).
//
// STRICTLY a wa.me deep link mechanism: FlowBiz opens WhatsApp with a
// pre-filled message and the person using FlowBiz presses Send themselves.
// There is no WhatsApp Business API call, no webhook, no automated
// sending anywhere in this file.

// Turns a locally-typed Kenyan number (07xx…, 01xx…, or a bare 7xx…/1xx…)
// into the international-format digits WhatsApp's wa.me links expect.
// Numbers that already look international (start with a country code) are
// left alone — FlowBiz doesn't assume every customer is Kenyan.
export function normalizePhone(rawPhone) {
  const digits = String(rawPhone || '').replace(/[^\d]/g, '');
  if (!digits) return '';

  if (digits.startsWith('0') && digits.length === 10) {
    return '254' + digits.slice(1);
  }
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) {
    return '254' + digits;
  }
  return digits;
}

// A WhatsApp/E.164-style number is roughly 8–15 digits once normalized.
// This is a sanity check, not full validation — it's what stands between
// a typo and a broken WhatsApp link.
export function isValidWhatsAppPhone(rawPhone) {
  const digits = normalizePhone(rawPhone);
  return digits.length >= 8 && digits.length <= 15;
}

// Returns null (never a broken URL) if the phone number doesn't pass
// isValidWhatsAppPhone.
export function createWhatsAppLink(rawPhone, message) {
  if (!isValidWhatsAppPhone(rawPhone)) return null;
  const digits = normalizePhone(rawPhone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message || '')}`;
}

// Opens the link in a new tab/window and returns whether it actually did.
// Callers use the return value to show the correct toast — FlowBiz never
// claims a message was "sent"; only that WhatsApp was opened.
export function openWhatsApp(rawPhone, message) {
  const url = createWhatsAppLink(rawPhone, message);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

// ── Message templates ──────────────────────────────────────────────────
// Kept here rather than in documentService.js so every message FlowBiz
// ever pre-fills into WhatsApp is defined in exactly one place. All of
// these are generated dynamically from real FlowBiz data — nothing here
// is a hardcoded business name, amount, or date.

// documentUrl is optional so this still works before a share link exists
// (e.g. a caller that hasn't been updated) — but every real call site now
// passes one, per the "message must contain a real FlowBiz document URL"
// requirement.
export function buildReceiptMessage({
  shopName, customerName, productName, quantity, totalAmount,
  isCredit, remainingBalance, businessPhone, documentUrl, formatKES,
}) {
  const label = isCredit ? 'Invoice' : 'Receipt';
  const lines = [`*${shopName}*`];
  if (customerName) lines.push(`Hello ${customerName},`);
  lines.push(`${label} — ${quantity} × ${productName}`);
  lines.push(`Total: ${formatKES(totalAmount)}`);
  if (isCredit) lines.push(`Amount due: ${formatKES(remainingBalance)}`);
  if (documentUrl) lines.push('', `View or download your ${label.toLowerCase()}:`, documentUrl);
  const contactLink = businessPhone ? createWhatsAppLink(businessPhone, `Hello ${shopName}`) : null;
  if (contactLink) lines.push('', `Contact ${shopName}:`, contactLink);
  lines.push('', isCredit ? 'Payment due — thank you for your business!' : 'Thank you for your business!');
  return lines.join('\n');
}

export function buildDebtReminderMessage({ shopName, customerName, outstandingAmount, businessPhone, formatKES }) {
  const lines = [
    `Hello ${customerName || 'there'},`,
    '',
    `This is a friendly reminder from ${shopName} regarding your outstanding balance of ${formatKES(outstandingAmount)}.`,
    '',
    'Please arrange payment at your earliest convenience.',
  ];
  if (businessPhone) lines.push('', `Contact: ${businessPhone}`);
  lines.push('', 'Thank you.');
  return lines.join('\n');
}

export function buildDebtPaymentReceiptMessage({
  shopName, customerName, amountPaid, previousBalance, remainingBalance, isCleared, documentUrl, formatKES,
}) {
  const lines = [`Hello ${customerName || 'there'},`, '', `We have received your payment of ${formatKES(amountPaid)}.`, ''];
  if (isCleared) {
    lines.push('This payment clears your outstanding balance with us.');
    lines.push('', `Remaining balance: ${formatKES(0)}`);
  } else {
    lines.push(`Previous balance: ${formatKES(previousBalance)}`);
    lines.push(`Payment received: ${formatKES(amountPaid)}`);
    lines.push(`Remaining balance: ${formatKES(remainingBalance)}`);
  }
  if (documentUrl) lines.push('', 'View/download your payment receipt:', documentUrl);
  lines.push('', `— ${shopName}`, '', 'Thank you.');
  return lines.join('\n');
}
