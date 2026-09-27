import { toE164Digits } from '../lib/region/phone.js';

// A customer's number as E.164 digits, read in the BUSINESS's country (see
// lib/region/phone.js): 0741… is Kenyan for a Kenyan shop, (415) 555… is
// American for an American one. Anything that cannot be read that way is
// kept as its digits, exactly as before, rather than dropped.
export function normalizePhone(rawPhone) {
  const digits = String(rawPhone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return toE164Digits(rawPhone) || digits;
}

export function isValidWhatsAppPhone(rawPhone) {
  const digits = normalizePhone(rawPhone);
  return digits.length >= 8 && digits.length <= 15;
}

export function createWhatsAppLink(rawPhone, message) {
  if (!isValidWhatsAppPhone(rawPhone)) return null;
  const digits = normalizePhone(rawPhone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message || '')}`;
}

export function openWhatsApp(rawPhone, message) {
  const url = createWhatsAppLink(rawPhone, message);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

// Sleek, Structured WhatsApp Digital Receipts / Invoices
export function buildReceiptMessage({
  shopName, customerName, productName, quantity, totalAmount,
  isCredit, remainingBalance, businessPhone, documentUrl, formatMoney, items,
}) {
  const label = isCredit ? 'COMMERCIAL INVOICE' : 'OFFICIAL RECEIPT';
  const lines = [
    `🧾 *${shopName.toUpperCase()}*`,
    `📋 _${label}_`,
    '──────────────────',
  ];

  if (customerName) {
    lines.push(`👤 *Customer:* ${customerName}`);
  }

  lines.push('');
  lines.push('*Items Ordered:*');

  if (Array.isArray(items) && items.length > 1) {
    items.forEach((it) => {
      const lineTotal = it.lineTotal ?? (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
      lines.push(`• ${it.quantity}× ${it.productName} → *${formatMoney(lineTotal)}*`);
    });
  } else {
    const singleName = (Array.isArray(items) && items[0]?.productName) || productName;
    const singleQty = (Array.isArray(items) && items[0]?.quantity) || quantity;
    lines.push(`• ${singleQty}× ${singleName} → *${formatMoney(totalAmount)}*`);
  }

  lines.push('──────────────────');
  if (isCredit) {
    lines.push(`💰 *Total Amount Due:* ${formatMoney(remainingBalance)}`);
    lines.push(`⚠️ *Status:* Payment Pending (Deni)`);
  } else {
    lines.push(`✅ *Total Amount Paid:* ${formatMoney(totalAmount)}`);
  }

  if (documentUrl) {
    lines.push('');
    lines.push(`🔗 *View / Download Digital ${isCredit ? 'Invoice' : 'Receipt'}:*`);
    lines.push(documentUrl);
  }

  const contactDigits = businessPhone ? normalizePhone(businessPhone) : '';
  if (contactDigits) {
    lines.push('');
    lines.push(`📞 *Questions? Call:* +${contactDigits}`);
  }

  lines.push('');
  lines.push(`_Thank you for choosing ${shopName}!_`);
  return lines.join('\n');
}

// Professional Debt Reminder
export function buildDebtReminderMessage({ shopName, customerName, outstandingAmount, businessPhone, formatMoney }) {
  const lines = [
    `🏬 *${shopName.toUpperCase()}*`,
    '📌 *ACCOUNT STATEMENT & REMINDER*',
    '──────────────────',
    `Hello *${customerName || 'Customer'}*,`,
    '',
    `This is a friendly reminder regarding your outstanding balance with *${shopName}*.`,
    '',
    `💰 *Outstanding Balance:* *${formatMoney(outstandingAmount)}*`,
    '',
    'Kindly arrange to settle the balance at your earliest convenience.',
  ];

  const contactDigits = businessPhone ? normalizePhone(businessPhone) : '';
  if (contactDigits) {
    lines.push('');
    lines.push(`📞 *Store Contact:* +${contactDigits}`);
  }

  lines.push('──────────────────');
  lines.push('_Thank you for your continued partnership!_');
  return lines.join('\n');
}

// Debt Payment Receipt (Clear confirmation)
export function buildDebtPaymentReceiptMessage({
  shopName, customerName, amountPaid, previousBalance, remainingBalance, isCleared, documentUrl, formatMoney,
}) {
  const lines = [
    `*${shopName.toUpperCase()}*`,
    '*DEBT REPAYMENT CONFIRMATION*',
    '──────────────────',
    `Hello *${customerName || 'Customer'}*,`,
    '',
    `We have received your payment of *${formatMoney(amountPaid)}*.`,
    '',
    `• *Previous Balance:* ${formatMoney(previousBalance)}`,
    `• *Amount Paid:* -${formatMoney(amountPaid)}`,
    `• *Remaining Balance:* *${formatMoney(remainingBalance)}*`,
    '',
    isCleared
      ? '*Status: DEBT FULLY CLEARED!*'
      : '*Status: PARTIALLY PAID*',
  ];

  if (documentUrl) {
    lines.push('');
    lines.push('*Download Official Payment Receipt:*');
    lines.push(documentUrl);
  }

  lines.push('──────────────────');
  lines.push(`_Thank you for settling your account with ${shopName}._`);
  return lines.join('\n');
}