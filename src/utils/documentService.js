import { jsPDF } from 'jspdf';
import { formatKES } from './currency';
import { formatDateTime } from './dateRanges';

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

// Replace the buildDocument function in src/utils/documentService.js
async function buildDocument(data, settings, typeLabel) {
    const doc = new jsPDF('p', 'mm', [80, 200]); // Thermal receipt size
    let y = 8;
    const marginX = 5;
    const pageWidth = 75;

    // 1. TOP-LEFT LOGO & BUSINESS DETAILS
    const logoDataUrl = await loadImageAsDataUrl(settings.logoUrl);
    if (logoDataUrl) {
        try {
            const format = logoDataUrl.match(/data:image\/(\w+);/)?.[1]?.toUpperCase() || 'PNG';
            doc.addImage(logoDataUrl, format, marginX, y, 14, 14); // Logo top-left
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(settings.shopName || 'Business Receipt', marginX + 17, y + 5);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            if (settings.phone) doc.text(`Tel: ${settings.phone}`, marginX + 17, y + 9);
            if (settings.address) doc.text(settings.address, marginX + 17, y + 13);
            y += 18;
        } catch (err) {
            console.error('Could not embed business logo in PDF:', err);
        }
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(settings.shopName || 'Business Receipt', marginX, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        if (settings.phone) { y += 4; doc.text(`Tel: ${settings.phone}`, marginX, y + 4); }
        if (settings.address) { y += 4; doc.text(settings.address, marginX, y + 4); }
        y += 8;
    }

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
    const splitName = doc.splitTextToSize(itemName, 45);
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
    doc.text(data.isCredit ? 'Payment due — thank you!' : 'Thank you for your business!', 40, y, { align: 'center' });

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

function normalizeKenyanPhone(rawPhone) {
    let digits = String(rawPhone || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) digits = '254' + digits.slice(1);
    else if (!digits.startsWith('254') && digits.length === 9) digits = '254' + digits;
    return digits;
}

function buildWhatsAppMessage(sale, settings) {
    const shopName = settings.shopName || 'FlowBiz Store';
    const label = sale.isCredit ? 'Invoice' : 'Receipt';
    const amountDue = sale.isCredit ? (sale.remainingBalance ?? sale.totalAmount) : sale.totalAmount;
    const lines = [
        `*${shopName}*`,
        `${label} — ${sale.quantity} × ${sale.productName}`,
        `Total: ${formatKES(sale.totalAmount)}`,
    ];
    if (sale.isCredit) lines.push(`Amount due: ${formatKES(amountDue)}`);
    if (settings.phone) lines.push(`Contact: ${settings.phone}`);
    lines.push('', sale.isCredit ? 'Payment due — thank you for your business!' : 'Thank you for your business!');
    return lines.join('\n');
}

export function sendWhatsAppDocument(sale, settings, phone) {
    const digits = normalizeKenyanPhone(phone);
    if (!digits) throw new Error('Enter a valid phone number.');
    const message = buildWhatsAppMessage(sale, settings);
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}