import { html } from '../lib/response.js';
import { getDocument } from '../lib/firestore.js';

const COLLECTION_BY_TYPE = {
  receipt: 'sales',
  invoice: 'creditSales',
  debtPaymentReceipt: 'debtPaymentReceipts',
};

const DOCUMENT_LABEL = {
  receipt: 'OFFICIAL RECEIPT',
  invoice: 'COMMERCIAL INVOICE',
  debtPaymentReceipt: 'DEBT PAYMENT RECEIPT',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function safeJsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function formatKES(amount) {
  const v = Number(amount) || 0;
  return `KES ${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(isoOrDate) {
  if (!isoOrDate) return '—';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

async function resolveDocument(env, token) {
  const shareRecord = await getDocument(env, 'sharedDocuments', token);
  if (!shareRecord) return null;

  const { businessId, documentType, documentId } = shareRecord;
  const collectionName = COLLECTION_BY_TYPE[documentType];
  if (!businessId || !documentId || !collectionName) return null;

  const doc = await getDocument(env, collectionName, documentId);
  if (!doc) return null;
  if (doc.businessId !== businessId) return null;
  if (doc.isVoided || doc.status === 'cancelled' || doc.status === 'refunded') return null;

  const settings = (await getDocument(env, 'businessSettings', businessId)) || {};
  return { documentType, doc, settings };
}

function buildViewModel(documentType, doc) {
  if (documentType === 'debtPaymentReceipt') {
    const receiptNo = `PAY-${(doc.id || '').slice(-6).toUpperCase() || '000000'}`;
    return {
      label: DOCUMENT_LABEL.debtPaymentReceipt,
      receiptNumber: receiptNo,
      dateLabel: formatDate(doc.paidAt),
      customerName: doc.customerName || '—',
      servedByName: doc.recordedByName || '',
      refLabel: (doc.paymentReferences || []).join(', ') || receiptNo,
      kind: 'debtPaymentReceipt',
      previousBalance: Number(doc.previousBalance) || 0,
      amountPaid: Number(doc.amountPaid) || 0,
      remainingBalance: Number(doc.remainingBalance) || 0,
      isCleared: !!doc.isCleared,
      method: doc.method || '',
      mpesaCode: doc.mpesaCode || '',
    };
  }
  const isCredit = documentType === 'invoice';
  const prefix = isCredit ? 'INV' : 'REC';
  const receiptNo = `${prefix}-${(doc.id || '').slice(-6).toUpperCase() || '000000'}`;

  return {
    label: isCredit ? DOCUMENT_LABEL.invoice : DOCUMENT_LABEL.receipt,
    receiptNumber: receiptNo,
    dateLabel: formatDate(doc.soldAt),
    customerName: doc.customerName || '',
    servedByName: doc.soldByName || '',
    refLabel: receiptNo,
    kind: 'sale',
    isCredit,
    items: Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : null,
    productName: doc.productName || 'Item',
    quantity: Number(doc.quantity) || 1,
    soldPricePerUnit: Number(doc.soldPricePerUnit) || 0,
    totalAmount: Number(doc.totalAmount) || 0,
    remainingBalance: Number(doc.remainingBalance ?? doc.totalAmount) || 0,
    paymentMethod: doc.paymentMethod || '',
    mpesaCode: doc.mpesaCode || '',
  };
}

function renderNotFound() {
  return html(renderShell({
    title: 'Document not available — FlowBiz',
    bodyHtml: `
      <div class="empty">
        <div class="empty-icon">📄</div>
        <h1>This document is no longer available</h1>
        <p>The link may have expired or was removed by the business.</p>
      </div>`,
    includeActions: false,
  }), { status: 404 });
}

function renderShell({ title, bodyHtml, paperWidthMm = 80 }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="flowbiz-paper-width" content="${paperWidthMm}" />
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --ink-900:#15171d; --ink-700:#363b48; --ink-500:#5a6273; --ink-400:#767f8f; --ink-200:#cfd3da; --ink-100:#e8eaed;
    --moss-800:#144f30; --moss-700:#1a623c; --moss-600:#1f7c4a; --moss-50:#f1faf4; --rust-600:#c4441d; --rust-50:#fdf4ef;
    --sand:#f6f1e7;
  }
  * { box-sizing: border-box; margin:0; padding:0; }
  body { background: var(--sand); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: var(--ink-900); }
  .page { max-width: 440px; margin: 0 auto; padding: 24px 16px 48px; }
  .brand-bar { display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom: 16px; }
  .brand-bar span { font-weight: 800; color: var(--moss-700); font-size: 14px; letter-spacing: 0.04em; text-transform:uppercase; }
  
  .card {
    background: #fff;
    border: 1px solid var(--ink-200);
    border-radius: 16px;
    padding: 24px 20px;
    box-shadow: 0 4px 20px -2px rgba(21, 23, 29, 0.07);
  }
  
  .logo { display:block; margin: 0 auto 10px; height: 48px; max-width:130px; object-fit:contain; border-radius: 6px; }
  .biz-name { text-align:center; font-weight:800; font-size:18px; color:var(--ink-900); letter-spacing:-0.01em; margin-bottom: 2px; }
  .biz-meta { text-align:center; font-size:11px; color: var(--ink-400); margin-bottom: 14px; line-height: 1.4; }
  
  .doc-header-box {
    display:flex;
    justify-content:space-between;
    align-items:center;
    background: var(--ink-50, #f5f6f7);
    padding: 8px 12px;
    border-radius: 8px;
    margin-bottom: 12px;
  }
  .doc-title { font-weight: 800; font-size: 11px; letter-spacing: 0.04em; color: var(--ink-700); }
  .doc-number { font-family: monospace; font-weight: 700; font-size: 11px; color: var(--moss-700); }
  
  .meta-grid { display:flex; justify-content:space-between; font-size:12px; color: var(--ink-500); padding: 3px 0; }
  .meta-grid strong { color: var(--ink-900); }
  
  .divider { border:none; border-top:1px dashed var(--ink-200); margin: 12px 0; }
  
  .item-table { width:100%; border-collapse:collapse; margin-bottom: 12px; }
  .item-table th { text-align:left; font-size:10px; text-transform:uppercase; color:var(--ink-400); padding-bottom:6px; font-weight:700; }
  .item-table th:last-child { text-align:right; }
  .item-table td { padding: 6px 0; font-size:13px; vertical-align:top; }
  .item-table td:last-child { text-align:right; font-weight:700; }
  .item-sub { font-size:11px; color: var(--ink-400); margin-top:1.5px; }
  
  .total-box {
    background: var(--moss-50);
    border: 1px solid rgba(26, 98, 60, 0.15);
    border-radius: 10px;
    padding: 12px 14px;
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-top: 10px;
  }
  .total-box.credit { background: var(--rust-50); border-color: rgba(196, 68, 29, 0.15); }
  .total-label { font-size:12px; font-weight:700; color:var(--moss-700); text-transform:uppercase; }
  .total-box.credit .total-label { color:var(--rust-600); }
  .total-val { font-size:17px; font-weight:800; color:var(--moss-700); }
  .total-box.credit .total-val { color:var(--rust-600); }
  
  .status-tag {
    text-align:center;
    padding: 6px;
    border-radius: 6px;
    font-size:11px;
    font-weight:700;
    margin-top: 10px;
  }
  .status-tag.cleared { background:var(--moss-50); color:var(--moss-700); border:1px solid rgba(26, 98, 60, 0.2); }
  .status-tag.partial { background:var(--rust-50); color:var(--rust-600); border:1px solid rgba(196, 68, 29, 0.2); }
  
  .actions { display:flex; gap:10px; margin-top:16px; }
  .btn {
    flex:1; text-align:center; padding: 11px; border-radius:8px;
    font-weight:700; font-size:13px; border:1px solid var(--ink-200);
    background:#fff; color: var(--ink-700); cursor:pointer;
  }
  .btn:hover { background: var(--ink-100); }
  .btn.primary { background: var(--moss-700); border-color: var(--moss-700); color:#fff; }
  
  .footer-note { text-align:center; font-size:11px; color: var(--ink-400); margin-top: 18px; line-height: 1.5; }
  .empty { text-align:center; padding: 60px 16px; }
  .empty-icon { font-size: 40px; margin-bottom: 8px; }
  .empty h1 { font-size: 17px; margin-bottom: 6px; }
  .empty p { font-size: 13px; color: var(--ink-400); max-width: 300px; margin: 0 auto; }
  
  @media print {
    body { background: #fff; }
    .actions, .footer-note, .brand-bar { display: none !important; }
    .page { max-width: none; padding: 0; }
    .card { border: none; box-shadow: none; padding: 0; }
    @page { size: ${paperWidthMm}mm auto; margin: 3mm; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="brand-bar"><span>FLOWBIZ VERIFIED RECEIPT</span></div>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function renderDocumentBody(vm, settings) {
  const logoHtml = settings.logoUrl ? `<img class="logo" src="${escapeHtml(settings.logoUrl)}" alt="Logo" />` : '';
  const metaLine = [settings.phone, settings.email, settings.address].filter(Boolean).join(' · ');

  let contentHtml = '';

  if (vm.kind === 'debtPaymentReceipt') {
    contentHtml = `
      <div style="font-size:13px;">
        <div class="meta-grid"><span>Previous Total Debt:</span><strong>${formatKES(vm.previousBalance)}</strong></div>
        <div class="meta-grid"><span>Payment Received:</span><strong style="color:var(--moss-700);">- ${formatKES(vm.amountPaid)}</strong></div>
      </div>
      <div class="total-box ${vm.isCleared ? '' : 'credit'}">
        <span class="total-label">Remaining Debt</span>
        <span class="total-val">${formatKES(vm.remainingBalance)}</span>
      </div>
      <div class="status-tag ${vm.isCleared ? 'cleared' : 'partial'}">
        ${vm.isCleared ? '✓ DEBT FULLY CLEARED' : '⚠ PARTIALLY PAID'}
      </div>
    `;
  } else if (vm.items) {
    const rows = vm.items.map((it) => {
      const lineTotal = it.lineTotal ?? ((it.quantity || 0) * (it.unitPrice || 0));
      return `
        <tr>
          <td>
            <div>${escapeHtml(it.productName)}</div>
            <div class="item-sub">${it.quantity} × ${formatKES(it.unitPrice || 0)}</div>
          </td>
          <td>${formatKES(lineTotal)}</td>
        </tr>
      `;
    }).join('');

    contentHtml = `
      <table class="item-table">
        <thead><tr><th>Product</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total-box ${vm.isCredit ? 'credit' : ''}">
        <span class="total-label">${vm.isCredit ? 'Amount Due' : `Total Paid (${escapeHtml(vm.paymentMethod)})`}</span>
        <span class="total-val">${formatKES(vm.isCredit ? vm.remainingBalance : vm.totalAmount)}</span>
      </div>
    `;
  } else {
    contentHtml = `
      <table class="item-table">
        <thead><tr><th>Product</th><th>Amount</th></tr></thead>
        <tbody>
          <tr>
            <td>
              <div>${escapeHtml(vm.productName)}</div>
              <div class="item-sub">${vm.quantity} × ${formatKES(vm.soldPricePerUnit)}</div>
            </td>
            <td>${formatKES(vm.totalAmount)}</td>
          </tr>
        </tbody>
      </table>
      <div class="total-box ${vm.isCredit ? 'credit' : ''}">
        <span class="total-label">${vm.isCredit ? 'Amount Due' : `Total Paid (${escapeHtml(vm.paymentMethod)})`}</span>
        <span class="total-val">${formatKES(vm.isCredit ? vm.remainingBalance : vm.totalAmount)}</span>
      </div>
    `;
  }

  return `
    <div class="card">
      ${logoHtml}
      <h1 class="biz-name">${escapeHtml(settings.shopName || 'FlowBiz Store')}</h1>
      ${metaLine ? `<p class="biz-meta">${escapeHtml(metaLine)}</p>` : ''}
      
      <div class="doc-header-box">
        <span class="doc-title">${escapeHtml(vm.label)}</span>
        <span class="doc-number">${escapeHtml(vm.receiptNumber)}</span>
      </div>

      <div class="meta-grid"><span>Date:</span><strong>${escapeHtml(vm.dateLabel)}</strong></div>
      ${vm.customerName ? `<div class="meta-grid"><span>Customer:</span><strong>${escapeHtml(vm.customerName)}</strong></div>` : ''}
      ${vm.servedByName ? `<div class="meta-grid"><span>Served by:</span><strong>${escapeHtml(vm.servedByName)}</strong></div>` : ''}
      ${vm.mpesaCode ? `<div class="meta-grid"><span>M-Pesa Ref:</span><strong>${escapeHtml(vm.mpesaCode)}</strong></div>` : ''}
      
      <hr class="divider"/>
      ${contentHtml}
      
      <div class="actions">
        <button class="btn" onclick="window.print()">Print</button>
        <button class="btn primary" onclick="window.__downloadFlowBizPdf()">Download PDF</button>
      </div>
    </div>
    <p class="footer-note">Official digital document generated via FlowBiz.<br/>Thank you for your business!</p>
    <script>window.__FLOWBIZ_DOC__ = ${safeJsonForScript(vm)};</script>
    <script>window.__FLOWBIZ_BUSINESS__ = ${safeJsonForScript({
      shopName: settings.shopName || 'FlowBiz Store',
      phone: settings.phone || '',
      email: settings.email || '',
      address: settings.address || '',
      logoUrl: settings.logoUrl || null,
    })};</script>
    <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
    <script>${buildPdfScript()}</script>
  `;
}

function buildPdfScript() {
  return `
(function () {
  function formatKES(n) {
    var v = Number(n) || 0;
    return 'KES ' + v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  window.__downloadFlowBizPdf = function () {
    var vm = window.__FLOWBIZ_DOC__;
    var biz = window.__FLOWBIZ_BUSINESS__;
    var jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFCtor) { alert('Could not initialize PDF engine. Please try again.'); return; }
    var paperWidth = document.querySelector('meta[name="flowbiz-paper-width"]');
    var widthMm = paperWidth ? Number(paperWidth.content) : 80;
    var itemCount = (vm.items && vm.items.length) || 1;
    var estimatedHeight = Math.max(160, 85 + itemCount * 11);
    var doc = new jsPDFCtor('p', 'mm', [widthMm, estimatedHeight]);
    var marginX = 4;
    var pageWidth = widthMm - marginX;
    var centerX = widthMm / 2;
    var y = 5;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.text(biz.shopName.toUpperCase(), centerX, y + 2, { align: 'center' });
    y += 5.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 98, 115);
    if (biz.phone) { doc.text('Tel: ' + biz.phone, centerX, y, { align: 'center' }); y += 3.2; }
    if (biz.email) { doc.text(biz.email, centerX, y, { align: 'center' }); y += 3.2; }

    doc.setDrawColor(180, 185, 195); doc.setLineWidth(0.2);
    doc.line(marginX, y, pageWidth, y); y += 3.8;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(21, 23, 29);
    doc.text(vm.label + ' ' + (vm.receiptNumber || ''), marginX, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 98, 115);
    doc.text(vm.dateLabel, pageWidth, y, { align: 'right' });
    y += 3.5;
    if (vm.customerName) { doc.text('Customer: ' + vm.customerName, marginX, y); y += 3.2; }
    if (vm.servedByName) { doc.text('Served by: ' + vm.servedByName, marginX, y); y += 3.2; }
    if (vm.mpesaCode) { doc.text('M-Pesa Ref: ' + vm.mpesaCode, marginX, y); y += 3.2; }

    doc.line(marginX, y, pageWidth, y); y += 4.5;

    function row(label, value, bold) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 8 : 7.5);
      doc.setTextColor(21, 23, 29);
      doc.text(label, marginX, y);
      doc.text(value, pageWidth, y, { align: 'right' });
      y += 4.8;
    }

    if (vm.kind === 'debtPaymentReceipt') {
      row('Previous Debt:', formatKES(vm.previousBalance));
      row('Payment Received:', '- ' + formatKES(vm.amountPaid), true);
      doc.line(marginX, y, pageWidth, y); y += 4;
      row('Remaining Balance:', formatKES(vm.remainingBalance), true);
      y += 1.5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.setTextColor(vm.isCleared ? 26 : 196, vm.isCleared ? 98 : 68, vm.isCleared ? 60 : 29);
      doc.text(vm.isCleared ? '✓ DEBT FULLY CLEARED' : '⚠ PARTIALLY PAID', centerX, y, { align: 'center' });
    } else if (vm.items && vm.items.length) {
      vm.items.forEach(function (it) {
        var lineTotal = (it.lineTotal != null) ? it.lineTotal : ((it.quantity || 0) * (it.unitPrice || 0));
        row(it.quantity + ' x ' + it.productName, formatKES(lineTotal));
      });
      doc.line(marginX, y, pageWidth, y); y += 4.5;
      if (vm.isCredit) {
        row('AMOUNT DUE (DENI):', formatKES(vm.remainingBalance), true);
      } else {
        row('PAID (' + vm.paymentMethod + '):', formatKES(vm.totalAmount), true);
      }
    } else {
      row(vm.quantity + ' x ' + vm.productName, formatKES(vm.totalAmount));
      doc.line(marginX, y, pageWidth, y); y += 4.5;
      if (vm.isCredit) {
        row('AMOUNT DUE (DENI):', formatKES(vm.remainingBalance), true);
      } else {
        row('PAID (' + vm.paymentMethod + '):', formatKES(vm.totalAmount), true);
      }
    }

    y += 7;
    doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 125, 135);
    doc.text('Thank you for your business!', centerX, y, { align: 'center' });
    doc.save((vm.receiptNumber || 'document').toLowerCase() + '.pdf');
  };
})();
`;
}

export async function handlePublicDocument(request, env, token) {
  if (!token) return renderNotFound();

  let resolved;
  try {
    resolved = await resolveDocument(env, token);
  } catch (err) {
    console.error('publicDocument resolve error:', err);
    return renderNotFound();
  }
  if (!resolved) return renderNotFound();

  const { documentType, doc, settings } = resolved;
  const vm = buildViewModel(documentType, doc);
  const paperWidthMm = settings.receiptPaperWidth === 58 ? 58 : 80;

  return html(renderShell({
    title: `${vm.label} (${vm.receiptNumber}) — ${settings.shopName || 'FlowBiz'}`,
    bodyHtml: renderDocumentBody(vm, settings),
    paperWidthMm,
  }));
}