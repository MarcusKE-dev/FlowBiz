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

async function buildDocument(data, settings, typeLabel) {
    const doc = new jsPDF('p', 'mm', [80, 200]);
    let y = 10;
    const centerX = 40;

    const logoDataUrl = await loadImageAsDataUrl(settings.logoUrl);
    if (logoDataUrl) {
        try {
            const format = logoDataUrl.match(/data:image\/(\w+);/)?.[1]?.toUpperCase() || 'PNG';
            doc.addImage(logoDataUrl, format, centerX - 9, y, 18, 18);
            y += 21;
        } catch (err) {
            console.error('Could not embed business logo in PDF:', err);
        }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(settings.shopName || 'Business Receipt', centerX, y, { align: 'center' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (settings.phone) { 
        doc.text(settings.phone, centerX, y, { align: 'center' }); 
        y += 5; 
    }
    if (settings.email) { 
        doc.text(settings.email, centerX, y, { align: 'center' }); 
        y += 5; 
    }
    if (settings.address) { 
        doc.text(settings.address, centerX, y, { align: 'center' }); 
        y += 5; 
    }

    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(5, y, 75, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text(typeLabel, centerX, y, { align: 'center' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${data.id || 'N/A'}`, 5, y); y += 5;
    doc.text(`Date: ${formatDateTime(data.soldAt || data.recordedAt || new Date())}`, 5, y); y += 5;
    if (data.customerName) {
        doc.text(`Customer: ${data.customerName}`, 5, y); y += 5;
    }
    if (data.isCredit) {
        doc.text(`Status: ${data.status === 'partial' ? 'Partially Paid' : 'Unpaid'}`, 5, y); y += 5;
    } else if (data.paymentMethod || data.method) {
        doc.text(`Payment: ${data.paymentMethod || data.method}`, 5, y); y += 5;
    }

    y += 3;
    doc.line(5, y, 75, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Item', 5, y);
    doc.text('Amount', 75, y, { align: 'right' });
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    const itemName = data.productName || data.description || 'Item';
    const splitName = doc.splitTextToSize(itemName, 45);
    doc.text(splitName, 5, y);
    
    const amountStr = formatKES(data.totalAmount || data.amount || 0);
    doc.text(amountStr, 75, y, { align: 'right' });
    
    y += (splitName.length * 4) + 2;
    if (data.quantity) {
        doc.setFontSize(8);
        // FIX: Display selling price (@ soldPricePerUnit), not buying price
        doc.text(`Qty: ${data.quantity} @ ${formatKES(data.soldPricePerUnit || 0)}`, 5, y);
        y += 6;
    }

    y += 2;
    doc.line(5, y, 75, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (data.isCredit) {
        doc.text('AMOUNT DUE:', 5, y);
        doc.text(formatKES(data.remainingBalance ?? data.totalAmount ?? 0), 75, y, { align: 'right' });
    } else {
        doc.text('TOTAL:', 5, y);
        doc.text(amountStr, 75, y, { align: 'right' });
    }

    y += 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(data.isCredit ? 'Payment due — thank you for your business!' : 'Thank you for your business!', centerX, y, { align: 'center' });

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