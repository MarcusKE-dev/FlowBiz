import { jsPDF } from 'jspdf';
import { formatKES } from './currency';
import { formatDateTime } from './dateRanges';
import { openWhatsApp, buildReceiptMessage } from './whatsapp';

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
  doc.setTextColor(21, 23, 29);
  doc.text((settings.shopName || 'FLOWBIZ STORE').toUpperCase(), centerX, y + 2, { align: 'center' });

  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 98, 115);

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

  const estimatedHeight = Math.max(160, 85 + items.length * 11);
  const doc = new jsPDF('p', 'mm', [paperWidthMm, estimatedHeight]);
  const marginX = 4;
  const pageWidth = paperWidthMm - marginX;
  const contentWidth = pageWidth - marginX;
  const centerX = paperWidthMm / 2;

  let y = await drawDocumentHeader(doc, settings, marginX, 5, paperWidthMm);

  const drawDivider = (currentY) => {
    doc.setDrawColor(180, 185, 195);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, currentY, pageWidth, currentY);
    doc.setLineDashPattern([], 0);
  };

  drawDivider(y);
  y += 4;

  const docRef = data.id ? `#${data.id.slice(-6).toUpperCase()}` : '#REC';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(21, 23, 29);
  doc.text(`${typeLabel} ${docRef}`, marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 98, 115);
  doc.text(formatDateTime(data.soldAt || data.recordedAt || new Date()), pageWidth, y, { align: 'right' });

  y += 3.5;
  if (data.customerName) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 23, 29);
    doc.text(`Customer: ${data.customerName}`, marginX, y);
    y += 3.5;
  }
  if (data.soldByName) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 98, 115);
    doc.text(`Served by: ${data.soldByName}`, marginX, y);
    y += 3.5;
  }

  drawDivider(y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(54, 59, 72);
  doc.text('ITEM', marginX, y);
  doc.text('AMOUNT', pageWidth, y, { align: 'right' });

  y += 1.5;

  items.forEach((item) => {
    y += 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(21, 23, 29);

    const itemName = item.productName || 'Item';
    const splitName = doc.splitTextToSize(itemName, contentWidth - 22);
    doc.text(splitName, marginX, y);

    const lineTotal = item.lineTotal ?? ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
    doc.text(formatKES(lineTotal), pageWidth, y, { align: 'right' });

    y += (splitName.length * 3);
    if (item.quantity) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(110, 115, 125);
      doc.text(`${item.quantity} x @ ${formatKES(item.unitPrice || 0)}`, marginX, y);
    }
  });

  y += 3.5;
  drawDivider(y);
  y += 4.5;

  if (data.isCredit) {
    doc.setFillColor(253, 244, 239);
    doc.roundedRect(marginX, y - 3, contentWidth, 10.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(196, 68, 29);
    doc.text('AMOUNT DUE (DENI):', marginX + 2, y + 3.5);
    doc.text(formatKES(data.remainingBalance ?? data.totalAmount ?? 0), pageWidth - 2, y + 3.5, { align: 'right' });
    y += 12;
  } else {
    doc.setFillColor(241, 250, 244);
    doc.roundedRect(marginX, y - 3, contentWidth, 11.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(26, 98, 60);
    doc.text('TOTAL PAID:', marginX + 2, y + 2.5);
    doc.text(formatKES(data.totalAmount || data.amount || 0), pageWidth - 2, y + 2.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(54, 59, 72);
    const methodStr = `${data.paymentMethod || data.method || 'Cash'}${data.mpesaCode ? ` (${data.mpesaCode})` : ''}`;
    doc.text(`Tender: ${methodStr}`, marginX + 2, y + 6.8);
    y += 13.5;
  }

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 125, 135);
  doc.text(data.isCredit ? 'Payment due · Thank you!' : 'Thank you for shopping with us!', centerX, y, { align: 'center' });

  return doc;
}

// Squeezed, balanced debt payment document that never overflows
async function buildDebtPaymentDocument(receipt, settings) {
  const paperWidthMm = resolvePaperWidthMm(settings);
  const doc = new jsPDF('p', 'mm', [paperWidthMm, 155]);
  const marginX = 4;
  const pageWidth = paperWidthMm - marginX;
  const contentWidth = pageWidth - marginX;
  const centerX = paperWidthMm / 2;

  let y = await drawDocumentHeader(doc, settings, marginX, 5, paperWidthMm);

  const drawDivider = (currentY) => {
    doc.setDrawColor(180, 185, 195);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, currentY, pageWidth, currentY);
    doc.setLineDashPattern([], 0);
  };

  drawDivider(y);
  y += 4;

  const recNo = receipt.receiptDocId ? `#PAY-${receipt.receiptDocId.slice(-6).toUpperCase()}` : '#PAYMENT';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(21, 23, 29);
  doc.text(`DEBT RECEIPT ${recNo}`, marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 98, 115);
  doc.text(formatDateTime(receipt.paidAt || new Date()), pageWidth, y, { align: 'right' });

  y += 3.5;
  doc.text(`Customer: ${receipt.customerName || 'Customer'}`, marginX, y);
  const methodStr = `${receipt.method || 'Cash'}${receipt.mpesaCode ? ` (${receipt.mpesaCode})` : ''}`;
  doc.text(methodStr, pageWidth, y, { align: 'right' });

  y += 3.5;
  drawDivider(y);
  y += 4.5;

  const row = (label, val, boldVal = false, color = [21, 23, 29]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 98, 115);
    doc.text(label, marginX, y);

    doc.setFont('helvetica', boldVal ? 'bold' : 'normal');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(val, pageWidth, y, { align: 'right' });
    y += 4.8;
  };

  row('Previous Total Debt:', formatKES(receipt.previousBalance));
  row('Payment Received:', `- ${formatKES(receipt.amountPaid)}`, true, [26, 98, 60]);

  drawDivider(y - 1);
  y += 3.5;

  row('Remaining Debt:', formatKES(receipt.remainingBalance), true, receipt.isCleared ? [26, 98, 60] : [196, 68, 29]);

  y += 1.5;
  const isCleared = !!receipt.isCleared;
  const statusColor = isCleared ? [26, 98, 60] : [196, 68, 29];
  doc.setFillColor(isCleared ? 241 : 253, isCleared ? 250 : 244, isCleared ? 244 : 239);
  doc.roundedRect(marginX, y, contentWidth, 6.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(isCleared ? '✓ DEBT FULLY CLEARED' : '⚠ PARTIALLY PAID', centerX, y + 4.5, { align: 'center' });

  y += 12;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 125, 135);
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