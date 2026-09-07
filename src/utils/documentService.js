import { jsPDF } from 'jspdf';
import { formatKES } from './currency';
import { formatDateTime } from './dateRanges';
import { formatQuantityWithUnit } from '../industry/units';
import { lineItemDetail } from './lineItems';
import { openWhatsApp, buildReceiptMessage } from './whatsapp';
import { PDF } from '../theme/tokens';

export async function loadImageAsDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Could not load business logo for PDF:', err);
    return null;
  }
}

async function drawDocumentHeader(doc, settings, marginX, startY, paperWidthMm = 80) {
  let y = startY;
  const logoDataUrl = await loadImageAsDataUrl(settings.logoUrl);
  const logoSize = paperWidthMm <= 58 ? 10 : 13;
  const centerX = paperWidthMm / 2;

  if (logoDataUrl) {
    try {
      const format = logoDataUrl.match(/data:image\/(\w+);/)?.[1]?.toUpperCase() || 'PNG';
      doc.addImage(logoDataUrl, format, centerX - (logoSize / 2), y, logoSize, logoSize);
      y += logoSize + 2.5;
    } catch (err) {
      console.error('Could not embed business logo in PDF:', err);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(paperWidthMm <= 58 ? 9.5 : 11.5);
  doc.setTextColor(...PDF.ink);
  doc.text((settings.shopName || 'FLOWBIZ STORE').toUpperCase(), centerX, y + 2, { align: 'center' });

  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.ink2);

  if (settings.phone) {
    doc.text(`Tel: ${settings.phone}`, centerX, y, { align: 'center' });
    y += 3.4;
  }
  if (settings.email) {
    doc.text(settings.email, centerX, y, { align: 'center' });
    y += 3.4;
  }
  if (settings.address) {
    doc.text(settings.address, centerX, y, { align: 'center' });
    y += 3.4;
  }

  return y + 1;
}

function resolvePaperWidthMm(settings) {
  return settings?.receiptPaperWidth === 58 ? 58 : 80;
}

function resolveDocumentItems(data) {
  if (Array.isArray(data.items) && data.items.length > 0) return data.items;
  return [{
    productName: data.productName || data.description || 'Item',
    quantity: data.quantity || 1,
    unitPrice: data.soldPricePerUnit || data.totalAmount || 0,
    lineTotal: data.totalAmount ?? data.amount ?? 0,
  }];
}

async function buildDocument(data, settings, typeLabel) {
  const paperWidthMm = resolvePaperWidthMm(settings);
  const items = resolveDocumentItems(data);

  // Detail lines (versions, modifiers, notes) add a row each, so the
  // paper has to grow with them or a long ticket runs off the end.
  const detailLines = items.reduce((n, item) => n + (lineItemDetail(item) ? 1 : 0), 0);
  const estimatedHeight = Math.max(160, 85 + items.length * 11 + detailLines * 4);
  const doc = new jsPDF('p', 'mm', [paperWidthMm, estimatedHeight]);
  const marginX = 4;
  const pageWidth = paperWidthMm - marginX;
  const contentWidth = pageWidth - marginX;
  const centerX = paperWidthMm / 2;

  let y = await drawDocumentHeader(doc, settings, marginX, 5, paperWidthMm);

  const drawDivider = (currentY) => {
    doc.setDrawColor(...PDF.line);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, currentY, pageWidth, currentY);
    doc.setLineDashPattern([], 0);
  };

  // A solid, heavier rule. The dashed divider above separates sections;
  // this one bounds the block a reader looks for first — the total — so
  // it has to survive a thermal printer with no fill to lean on.
  const drawRule = (currentY) => {
    doc.setDrawColor(...PDF.ink);
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([], 0);
    doc.line(marginX, currentY, pageWidth, currentY);
  };

  drawDivider(y);
  y += 4;

  const docRef = data.id ? `#${data.id.slice(-6).toUpperCase()}` : '#REC';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PDF.ink);
  doc.text(`${typeLabel} ${docRef}`, marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.ink2);
  doc.text(formatDateTime(data.soldAt || data.recordedAt || new Date()), pageWidth, y, { align: 'right' });

  y += 3.5;
  if (data.customerName) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF.ink);
    doc.text(`Customer: ${data.customerName}`, marginX, y);
    y += 3.5;
  }
  if (data.soldByName) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF.ink2);
    doc.text(`Served by: ${data.soldByName}`, marginX, y);
    y += 3.5;
  }

  drawDivider(y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.ink2);
  doc.text('ITEM', marginX, y);
  doc.text('AMOUNT', pageWidth, y, { align: 'right' });

  y += 1.5;

  items.forEach((item) => {
    y += 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF.ink);

    const itemName = item.productName || 'Item';
    const splitName = doc.splitTextToSize(itemName, contentWidth - 22);
    doc.text(splitName, marginX, y);

    const lineTotal = item.lineTotal ?? ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
    doc.text(formatKES(lineTotal), pageWidth, y, { align: 'right' });

    y += (splitName.length * 3);
    if (item.quantity) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...PDF.ink3);
      // "2.5 m x @ KES 120.00" for a measured item, and the unchanged
      // "3 x @ KES 150.00" for anything sold by the piece.
      doc.text(
        `${formatQuantityWithUnit(item.quantity, item.unit)} x @ ${formatKES(item.unitPrice || 0)}`,
        marginX, y
      );
    }
    // What was actually served: the version, the choices made on the line
    // and any note. Absent on every line that has none, so a receipt from
    // a shop that does not use them is unchanged down to the millimetre.
    const detail = lineItemDetail(item);
    if (detail) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...PDF.ink3);
      const splitDetail = doc.splitTextToSize(detail, contentWidth - 4);
      y += 3;
      doc.text(splitDetail, marginX + 1.5, y);
      y += (splitDetail.length - 1) * 3;
    }
  });

  y += 3.5;
  drawDivider(y);
  y += 4.5;

  if (data.isCredit) {
    drawRule(y - 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF.ink2);
    doc.text('AMOUNT DUE (DENI):', marginX, y + 3.5);
    // Ink, not red. A receipt is ink on paper: thermal printers are
    // monochrome, so a colour that survives on screen is flattened on
    // the artifact that actually reaches the customer. Emphasis here
    // comes from weight, uppercase and the two solid rules around it.
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF.ink);
    doc.text(formatKES(data.remainingBalance ?? data.totalAmount ?? 0), pageWidth, y + 3.5, { align: 'right' });
    drawRule(y + 7.5);
    y += 12;
  } else {
    drawRule(y - 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF.ink2);
    doc.text('TOTAL PAID:', marginX, y + 2.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF.ink);
    doc.text(formatKES(data.totalAmount || data.amount || 0), pageWidth, y + 2.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF.ink2);
    const methodStr = `${data.paymentMethod || data.method || 'Cash'}${data.mpesaCode ? ` (${data.mpesaCode})` : ''}`;
    doc.text(`Tender: ${methodStr}`, marginX, y + 6.8);
    drawRule(y + 8.5);
    y += 13.5;
  }

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...PDF.ink3);
  doc.text(data.isCredit ? 'Payment due · Thank you!' : 'Thank you for shopping with us!', centerX, y, { align: 'center' });

  return doc;
}

// Squeezed, balanced debt payment document that never overflows
async function buildDebtPaymentDocument(receipt, settings) {
  const paperWidthMm = resolvePaperWidthMm(settings);
  const doc = new jsPDF('p', 'mm', [paperWidthMm, 155]);
  const marginX = 4;
  const pageWidth = paperWidthMm - marginX;
  const centerX = paperWidthMm / 2;

  let y = await drawDocumentHeader(doc, settings, marginX, 5, paperWidthMm);

  const drawDivider = (currentY) => {
    doc.setDrawColor(...PDF.line);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, currentY, pageWidth, currentY);
    doc.setLineDashPattern([], 0);
  };

  // A solid, heavier rule. The dashed divider above separates sections;
  // this one bounds the block a reader looks for first — the total — so
  // it has to survive a thermal printer with no fill to lean on.
  const drawRule = (currentY) => {
    doc.setDrawColor(...PDF.ink);
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([], 0);
    doc.line(marginX, currentY, pageWidth, currentY);
  };

  drawDivider(y);
  y += 4;

  const recNo = receipt.receiptDocId ? `#PAY-${receipt.receiptDocId.slice(-6).toUpperCase()}` : '#PAYMENT';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PDF.ink);
  doc.text(`DEBT RECEIPT ${recNo}`, marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.ink2);
  doc.text(formatDateTime(receipt.paidAt || new Date()), pageWidth, y, { align: 'right' });

  y += 3.5;
  doc.text(`Customer: ${receipt.customerName || 'Customer'}`, marginX, y);
  const methodStr = `${receipt.method || 'Cash'}${receipt.mpesaCode ? ` (${receipt.mpesaCode})` : ''}`;
  doc.text(methodStr, pageWidth, y, { align: 'right' });

  y += 3.5;
  drawDivider(y);
  y += 4.5;

  // No colour parameter: every value on this document is ink. It used to
  // take one so the remaining balance could be red, and with that gone
  // the argument would only ever have carried its own default.
  const row = (label, val, boldVal = false) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF.ink2);
    doc.text(label, marginX, y);

    doc.setFont('helvetica', boldVal ? 'bold' : 'normal');
    doc.setTextColor(...PDF.ink);
    doc.text(val, pageWidth, y, { align: 'right' });
    y += 4.8;
  };

  row('Previous Total Debt:', formatKES(receipt.previousBalance));
  row('Payment Received:', `- ${formatKES(receipt.amountPaid)}`, true);

  drawDivider(y - 1);
  y += 3.5;

  row('Remaining Debt:', formatKES(receipt.remainingBalance), true);

  y += 1.5;
  const isCleared = !!receipt.isCleared;
  drawRule(y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF.ink);
  doc.text(isCleared ? 'PAID IN FULL' : 'PARTIALLY PAID', centerX, y + 4.5, { align: 'center' });
  drawRule(y + 6.5);

  y += 12;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...PDF.ink3);
  doc.text('Thank you for settling your balance!', centerX, y, { align: 'center' });

  return doc;
}

export async function generateReceiptPDF(sale, settings) {
  const doc = await buildDocument(sale, settings, 'RECEIPT');
  doc.save(`receipt-${sale.id}.pdf`);
}

export async function printReceipt(sale, settings) {
  const doc = await buildDocument(sale, settings, 'RECEIPT');
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

export async function generateInvoicePDF(creditSale, settings) {
  const doc = await buildDocument(creditSale, settings, 'INVOICE');
  doc.save(`invoice-${creditSale.id}.pdf`);
}

export async function printInvoice(creditSale, settings) {
  const doc = await buildDocument(creditSale, settings, 'INVOICE');
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

export async function generateDebtPaymentReceiptPDF(receipt, settings) {
  const doc = await buildDebtPaymentDocument(receipt, settings);
  doc.save(`debt-receipt-${Date.now()}.pdf`);
}

export async function printDebtPaymentReceipt(receipt, settings) {
  const doc = await buildDebtPaymentDocument(receipt, settings);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

export function sendWhatsAppDocument(sale, settings, phone, documentUrl) {
  const message = buildReceiptMessage({
    shopName: settings.shopName || 'FlowBiz Store',
    customerName: sale.customerName,
    productName: sale.productName,
    quantity: sale.quantity,
    totalAmount: sale.totalAmount,
    isCredit: sale.isCredit,
    remainingBalance: sale.remainingBalance ?? sale.totalAmount,
    businessPhone: settings.phone,
    documentUrl,
    formatKES,
    items: sale.items,
  });
  const opened = openWhatsApp(phone, message);
  if (!opened) throw new Error('Enter a valid phone number.');
}