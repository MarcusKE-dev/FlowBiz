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

// Shared header used by every thermal-receipt-style document this file
// generates (sale receipts/invoices, and now debt payment receipts) —
// keeps the logo/business-info block identical across document types
// instead of re-implementing it per document.
async function drawDocumentHeader(doc, settings, marginX, startY, paperWidthMm = 80) {
    let y = startY;
    const logoDataUrl = await loadImageAsDataUrl(settings.logoUrl);
    const logoSize = paperWidthMm <= 58 ? 11 : 14;
    const textX = logoDataUrl ? marginX + logoSize + 3 : marginX;

    if (logoDataUrl) {
        try {
            const format = logoDataUrl.match(/data:image\/(\w+);/)?.[1]?.toUpperCase() || 'PNG';
            doc.addImage(logoDataUrl, format, marginX, y, logoSize, logoSize);
        } catch (err) {
            console.error('Could not embed business logo in PDF:', err);
        }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(paperWidthMm <= 58 && logoDataUrl ? 9 : 11);
    doc.text(settings.shopName || 'Business Receipt', textX, y + 5);

    let lineY = y + 9;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    // FIX (#14): shows whichever of phone/email/address are actually
    // configured — never a placeholder — same "only if set" rule the
    // phone line already followed. Pulled straight from businessSettings,
    // nothing hardcoded.
    if (settings.phone) { doc.text(`Tel: ${settings.phone}`, textX, lineY); lineY += 4; }
    if (settings.email) { doc.text(settings.email, textX, lineY); lineY += 4; }
    if (settings.address && paperWidthMm > 58) { doc.text(settings.address, textX, lineY); lineY += 4; }

    return Math.max(y + (logoDataUrl ? logoSize + 4 : 8), lineY + 2);
}
// FIX (thermal paper width): FlowBiz's receipts were always generated at
// a fixed 80mm width. Some businesses' printers use 58mm paper — read
// from businessSettings.receiptPaperWidth (defaults to 80, set in
// Settings.jsx) so both PDF layouts, and the public receipt page's own
// PDF/print output, size correctly for whichever paper the business
// actually uses. Nothing else about the layout changes.
function resolvePaperWidthMm(settings) {
    return settings?.receiptPaperWidth === 58 ? 58 : 80;
}

// Replace the buildDocument function in src/utils/documentService.js
async function buildDocument(data, settings, typeLabel) {
    const paperWidthMm = resolvePaperWidthMm(settings);
    const doc = new jsPDF('p', 'mm', [paperWidthMm, 200]); // Thermal receipt size
    const marginX = 5;
    const pageWidth = paperWidthMm - marginX;
    let y = await drawDocumentHeader(doc, settings, marginX, 8, paperWidthMm);

    // 2. DOCUMENT TYPE & META DATA
    y += 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth, y);
    
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(typeLabel, marginX, y); // "INVOICE" or "RECEIPT"
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(formatDateTime(data.soldAt || data.recordedAt || new Date()), pageWidth, y, { align: 'right' });
    
    y += 5;
    doc.text(`Ref: ${data.id?.substring(0, 8).toUpperCase() || 'N/A'}`, marginX, y);
    if (data.customerName) {
        y += 4;
        doc.text(`To: ${data.customerName}`, marginX, y);
    }

    // 3. ITEMIZED TABLE
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, pageWidth, y);
    
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('ITEM', marginX, y);
    doc.text('TOTAL', pageWidth, y, { align: 'right' });
    
    y += 2;
    doc.line(marginX, y, pageWidth, y);

    // Items
    y += 5;
    doc.setFont('helvetica', 'normal');
    const itemName = data.productName || data.description || 'Item';
    // Proportional to page width so the item name doesn't crowd out the
    // right-aligned amount on narrower 58mm paper — matches the original
    // fixed 45mm exactly when paperWidthMm is 80.
    const splitName = doc.splitTextToSize(itemName, Math.max(pageWidth - 30, 20));
    doc.text(splitName, marginX, y);
    
    const amountStr = formatKES(data.totalAmount || data.amount || 0);
    doc.text(amountStr, pageWidth, y, { align: 'right' });
    
    y += (splitName.length * 4);
    if (data.quantity) {
        doc.setTextColor(100, 100, 100);
        doc.text(`${data.quantity} × @ ${formatKES(data.soldPricePerUnit || 0)}`, marginX, y);
        doc.setTextColor(0, 0, 0);
        y += 4;
    }

    // 4. TOTALS SECTION
    y += 2;
    doc.line(marginX, y, pageWidth, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (data.isCredit) {
        doc.text('TOTAL DUE:', marginX, y);
        doc.text(formatKES(data.remainingBalance ?? data.totalAmount ?? 0), pageWidth, y, { align: 'right' });
    } else {
        doc.text('PAID:', marginX, y);
        doc.text(amountStr, pageWidth, y, { align: 'right' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        y += 4;
        doc.text(`Via: ${data.paymentMethod || data.method}`, pageWidth, y, { align: 'right' });
    }

    // 5. FOOTER
    y += 12;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(data.isCredit ? 'Payment due — thank you!' : 'Thank you for your business!', (marginX + pageWidth) / 2, y, { align: 'center' });

    return doc;
}

// A debt payment receipt is deliberately its own document shape — a
// payment against an existing debt is not a sale, and PART 15 requires it
// to visually read as a distinct document ("DEBT PAYMENT RECEIPT"), not a
// sales receipt with different labels bolted on.
async function buildDebtPaymentDocument(receipt, settings) {
    const paperWidthMm = resolvePaperWidthMm(settings);
    const doc = new jsPDF('p', 'mm', [paperWidthMm, 200]);
    const marginX = 5;
    const pageWidth = paperWidthMm - marginX;
    let y = await drawDocumentHeader(doc, settings, marginX, 8, paperWidthMm);

    y += 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth, y);

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DEBT PAYMENT RECEIPT', marginX, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(formatDateTime(receipt.paidAt || new Date()), marginX, y);
    y += 4;
    doc.text(`Customer: ${receipt.customerName || '—'}`, marginX, y);
    y += 4;
    doc.text(`Payment method: ${receipt.method}${receipt.mpesaCode ? ` (${receipt.mpesaCode})` : ''}`, marginX, y);
    if (receipt.paymentReferences?.length) {
        y += 4;
        const refText = receipt.paymentReferences.join(', ');
        const splitRef = doc.splitTextToSize(`Ref: ${refText}`, pageWidth - marginX);
        doc.text(splitRef, marginX, y);
        y += (splitRef.length - 1) * 3.5;
    }

    y += 6;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, pageWidth, y);
    y += 6;

    const row = (label, value, boldRow = false) => {
        doc.setFont('helvetica', boldRow ? 'bold' : 'normal');
        doc.setFontSize(9);
        doc.text(label, marginX, y);
        doc.text(value, pageWidth, y, { align: 'right' });
        y += 5.5;
    };
    row('Previous balance', formatKES(receipt.previousBalance));
    row('Payment received', formatKES(receipt.amountPaid));
    y += 1;
    doc.line(marginX, y, pageWidth, y);
    y += 5;
    row('Remaining balance', formatKES(receipt.remainingBalance), true);

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    if (receipt.isCleared) {
        doc.setTextColor(26, 98, 60); // moss
        doc.text('STATUS: DEBT CLEARED', marginX, y);
    } else {
        doc.setTextColor(196, 68, 29); // rust
        doc.text('STATUS: PARTIALLY PAID', marginX, y);
    }
    doc.setTextColor(0, 0, 0);

    y += 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for your payment!', (marginX + pageWidth) / 2, y, { align: 'center' });

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
    doc.save(`debt-payment-receipt-${Date.now()}.pdf`);
}

export async function printDebtPaymentReceipt(receipt, settings) {
    const doc = await buildDebtPaymentDocument(receipt, settings);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
}

// FIX (Part 24 — centralize WhatsApp deep-link construction): phone
// normalization and wa.me URL building used to live here directly; they
// now live in ./whatsapp.js so every WhatsApp-sharing feature (sale
// receipts, debt reminders, debt payment receipts) shares one
// implementation.
//
// documentUrl is the public share link from src/utils/documentSharing.js
// — callers fetch/create it BEFORE calling this function (share-link
// creation is an async Firestore write; this function stays synchronous
// and focused on building the message + opening WhatsApp, same contract
// as before).
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
    });
    const opened = openWhatsApp(phone, message);
    if (!opened) throw new Error('Enter a valid phone number.');
}
