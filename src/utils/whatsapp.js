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
  isCredit, remainingBalance, businessPhone, documentUrl, formatKES, items,
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
      lines.push(`• ${it.quantity}× ${it.productName} → *${formatKES(lineTotal)}*`);
    });
  } else {
    const singleName = (Array.isArray(items) && items[0]?.productName) || productName;
    const singleQty = (Array.isArray(items) && items[0]?.quantity) || quantity;
    lines.push(`• ${singleQty}× ${singleName} → *${formatKES(totalAmount)}*`);
  }

  lines.push('──────────────────');
  if (isCredit) {
    lines.push(`💰 *Total Amount Due:* ${formatKES(remainingBalance)}`);
    lines.push(`⚠️ *Status:* Payment Pending (Deni)`);
  } else {
    lines.push(`✅ *Total Amount Paid:* ${formatKES(totalAmount)}`);
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
export function buildDebtReminderMessage({ shopName, customerName, outstandingAmount, businessPhone, formatKES }) {
  const lines = [
    `🏬 *${shopName.toUpperCase()}*`,
    '📌 *ACCOUNT STATEMENT & REMINDER*',
    '──────────────────',
    `Hello *${customerName || 'Customer'}*,`,
    '',
    `This is a friendly reminder regarding your outstanding balance with *${shopName}*.`,
    '',
    `💰 *Outstanding Balance:* *${formatKES(outstandingAmount)}*`,
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
  shopName, customerName, amountPaid, previousBalance, remainingBalance, isCleared, documentUrl, formatKES,
}) {
  const lines = [
    `*${shopName.toUpperCase()}*`,
    '*DEBT REPAYMENT CONFIRMATION*',
    '──────────────────',
    `Hello *${customerName || 'Customer'}*,`,
    '',
    `We have received your payment of *${formatKES(amountPaid)}*.`,
    '',
    `• *Previous Balance:* ${formatKES(previousBalance)}`,
    `• *Amount Paid:* -${formatKES(amountPaid)}`,
    `• *Remaining Balance:* *${formatKES(remainingBalance)}*`,
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