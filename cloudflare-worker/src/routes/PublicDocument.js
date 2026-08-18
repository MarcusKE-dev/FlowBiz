// src/routes/publicDocument.js
//
// GET /r/:token — the ONLY unauthenticated route in this Worker.
//
// This is a customer-facing page, not an API response: it renders a full
// HTML document directly (no React, no build step — the frontend SPA is
// never involved in serving this route at all).
//
// SECURITY MODEL: there is no Firebase Auth here and Firestore Security
// Rules never apply (this route reads Firestore with the Worker's own
// service-account credentials, same as every other route in this file —
// see lib/googleAuth.js). That means the opaque token is the ENTIRE
// access control for this route. Two things make that safe:
//   1. The token is 192 bits of crypto.getRandomValues() randomness
//      (src/utils/documentSharing.js on the frontend) — not a Firestore
//      auto-ID, not derived from any business/customer/sale ID.
//   2. Once the token resolves to a { businessId, documentType,
//      documentId } record, the underlying document is fetched and its
//      OWN businessId is cross-checked against the share record's
//      businessId before anything is rendered. A share record can never
//      be pointed at a document belonging to a different business, and a
//      manipulated documentId can never bypass the token → document
//      mapping (see resolveDocument below).
// Every failure path — missing token, wrong business, deleted document,
// voided sale — returns the exact same generic "not available" response,
// so the page can never be used to probe which case caused the failure.

import { html } from '../lib/response.js';
import { getDocument } from '../lib/firestore.js';

const COLLECTION_BY_TYPE = {
  receipt: 'sales',
  invoice: 'creditSales',
  debtPaymentReceipt: 'debtPaymentReceipts',
};

const DOCUMENT_LABEL = {
  receipt: 'RECEIPT',
  invoice: 'INVOICE',
  debtPaymentReceipt: 'DEBT PAYMENT RECEIPT',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Prevents a value containing "</script>" (e.g. a customer name) from
// breaking out of the inline JSON <script> block below.
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

// Resolves a token to a tenant-verified document, or null. This is the
// single security-critical function in this file — see the module
// comment above for exactly what it guarantees.
async function resolveDocument(env, token) {
  const shareRecord = await getDocument(env, 'sharedDocuments', token);
  if (!shareRecord) return null;

  const { businessId, documentType, documentId } = shareRecord;
  const collectionName = COLLECTION_BY_TYPE[documentType];
  if (!businessId || !documentId || !collectionName) return null;

  const doc = await getDocument(env, collectionName, documentId);
  if (!doc) return null;
  if (doc.businessId !== businessId) return null; // never trust documentId alone
  if (doc.isVoided || doc.status === 'cancelled' || doc.status === 'refunded') return null;

  const settings = (await getDocument(env, 'businessSettings', businessId)) || {};
  return { documentType, doc, settings };
}

function buildViewModel(documentType, doc) {
  if (documentType === 'debtPaymentReceipt') {
    return {
      label: DOCUMENT_LABEL.debtPaymentReceipt,
      dateLabel: formatDate(doc.paidAt),
      customerName: doc.customerName || '—',
      refLabel: (doc.paymentReferences || []).join(', '),
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
  // FIX (multi-product cart): a Counter.jsx cart sale/invoice stores every
  // product as `items` on the doc. When present, the public page renders
  // one row per product instead of the single productName/quantity this
  // route always assumed before. Legacy single-product docs (no `items`
  // field) render exactly as before via the fields below.
  return {
    label: isCredit ? DOCUMENT_LABEL.invoice : DOCUMENT_LABEL.receipt,
    dateLabel: formatDate(doc.soldAt),
    customerName: doc.customerName || '',
    refLabel: '',
    kind: 'sale',
    isCredit,
    items: Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : null,
    productName: doc.productName || 'Item',
    quantity: Number(doc.quantity) || 0,
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
        <p>The link may have expired, or the document was removed. Please contact the business directly for a copy.</p>
      </div>`,
    includeActions: false,
  }), { status: 404 });
}

function renderShell({ title, bodyHtml, includeActions, paperWidthMm = 80 }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="flowbiz-paper-width" content="${paperWidthMm}" />
<title>${escapeHtml(title)}</title>
<style>
  :root { --ink-900:#15171d; --ink-700:#363b48; --ink-500:#5a6273; --ink-400:#767f8f; --ink-200:#cfd3da; --ink-100:#e8eaed;
          --moss-700:#1a623c; --moss-600:#1f7c4a; --moss-50:#f1faf4; --rust-600:#c4441d; --sand:#faf6ef; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--sand); font-family: 'Inter', system-ui, -apple-system, sans-serif; color: var(--ink-900); }
  .page { max-width: 420px; margin: 0 auto; padding: 24px 16px 48px; }
  .brand { text-align:center; margin-bottom: 16px; }
  .brand img { height: 36px; }
  .brand span { font-weight: 800; color: var(--moss-700); font-size: 15px; letter-spacing: 0.02em; }
  .card { background:#fff; border:1px solid var(--ink-100); border-radius: 14px; padding: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .doc-title { text-align:center; font-weight:800; font-size:13px; letter-spacing:0.08em; color: var(--ink-500); margin: 0 0 4px; }
  .biz-name { text-align:center; font-weight:800; font-size:19px; margin: 0 0 2px; }
  .biz-meta { text-align:center; font-size:12px; color: var(--ink-400); margin: 0 0 16px; }
  .logo { display:block; margin: 0 auto 10px; height: 48px; border-radius: 8px; }
  .meta-row { display:flex; justify-content:space-between; font-size:13px; color: var(--ink-500); padding: 3px 0; }
  hr { border:none; border-top:1px solid var(--ink-100); margin: 14px 0; }
  .row { display:flex; justify-content:space-between; align-items:flex-start; font-size:14px; padding: 5px 0; }
  .row .label { color: var(--ink-500); }
  .row .value { font-weight:600; color: var(--ink-900); text-align:right; }
  .row.total .value { font-size:17px; font-weight:800; color: var(--moss-700); }
  .badge { display:inline-block; padding: 3px 10px; border-radius:999px; font-size:11px; font-weight:700; margin-top: 6px; }
  .badge.cleared { background: var(--moss-50); color: var(--moss-700); }
  .badge.partial { background: #fbe5d9; color: var(--rust-600); }
  .actions { display:flex; gap:8px; margin-top:16px; }
  .btn { flex:1; text-align:center; padding: 12px 10px; border-radius:10px; font-weight:700; font-size:14px; border:1px solid var(--ink-200); background:#fff; color: var(--ink-700); cursor:pointer; }
  .btn.primary { background: var(--moss-600); border-color: var(--moss-600); color:#fff; }
  .footer { text-align:center; font-size:11px; color: var(--ink-400); margin-top: 20px; }
  .empty { text-align:center; padding: 60px 16px; }
  .empty-icon { font-size: 40px; margin-bottom: 8px; }
  .empty h1 { font-size: 17px; margin: 0 0 6px; }
  .empty p { font-size: 13px; color: var(--ink-400); max-width: 320px; margin: 0 auto; }
  @media print {
    body { background: #fff; }
    .actions, .footer, .brand { display: none !important; }
    .page { max-width: none; padding: 0; }
    .card { border: none; box-shadow: none; border-radius: 0; padding: 0; }
    @page { size: ${paperWidthMm}mm auto; margin: 4mm; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="brand"><span>FlowBiz</span></div>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function renderDocumentBody(vm, settings) {
  const logoHtml = settings.logoUrl ? `<img class="logo" src="${escapeHtml(settings.logoUrl)}" alt="" />` : '';
    const metaLine = [settings.phone, settings.email, settings.address].filter(Boolean).join(' · ');
  let detailRows = '';
  if (vm.kind === 'debtPaymentReceipt') {
    detailRows = `
      <div class="row"><span class="label">Previous balance</span><span class="value">${formatKES(vm.previousBalance)}</span></div>
      <div class="row"><span class="label">Payment received</span><span class="value">${formatKES(vm.amountPaid)}</span></div>
      <hr/>
      <div class="row total"><span class="label">Remaining balance</span><span class="value">${formatKES(vm.remainingBalance)}</span></div>
      <div style="text-align:center;"><span class="badge ${vm.isCleared ? 'cleared' : 'partial'}">${vm.isCleared ? 'DEBT CLEARED' : 'PARTIALLY PAID'}</span></div>
    `;
  } else if (vm.items) {
    // FIX (multi-product cart): one row per product in the cart, exactly
    // mirroring how the authenticated app's own PDF receipt lists items.
    const itemRows = vm.items.map((it) => `
      <div class="row"><span class="label">${it.quantity} × ${escapeHtml(it.productName)}</span><span class="value">${formatKES(it.lineTotal ?? ((it.quantity || 0) * (it.unitPrice || 0)))}</span></div>
    `).join('');
    detailRows = `
      ${itemRows}
      <hr/>
      ${vm.isCredit
        ? `<div class="row total"><span class="label">Amount due</span><span class="value">${formatKES(vm.remainingBalance)}</span></div>`
        : `<div class="row total"><span class="label">Paid (${escapeHtml(vm.paymentMethod)})</span><span class="value">${formatKES(vm.totalAmount)}</span></div>`}
    `;
  } else {
    detailRows = `
      <div class="row"><span class="label">${escapeHtml(vm.productName)}</span><span class="value">${formatKES(vm.totalAmount)}</span></div>
      <div class="row"><span class="label">Quantity</span><span class="value">${vm.quantity} × ${formatKES(vm.soldPricePerUnit)}</span></div>
      <hr/>
      ${vm.isCredit
        ? `<div class="row total"><span class="label">Amount due</span><span class="value">${formatKES(vm.remainingBalance)}</span></div>`
        : `<div class="row total"><span class="label">Paid (${escapeHtml(vm.paymentMethod)})</span><span class="value">${formatKES(vm.totalAmount)}</span></div>`}
    `;
  }

  return `
    <div class="card">
      ${logoHtml}
      <p class="biz-name">${escapeHtml(settings.shopName || 'FlowBiz Store')}</p>
      ${metaLine ? `<p class="biz-meta">${escapeHtml(metaLine)}</p>` : ''}
      <p class="doc-title">${vm.label}</p>
      <div class="meta-row"><span>${escapeHtml(vm.dateLabel)}</span>${vm.customerName ? `<span>${escapeHtml(vm.customerName)}</span>` : ''}</div>
      ${vm.refLabel ? `<div class="meta-row"><span>Ref</span><span>${escapeHtml(vm.refLabel)}</span></div>` : ''}
      <hr/>
      ${detailRows}
      <div class="actions">
        <button class="btn" onclick="window.print()">Print</button>
        <button class="btn primary" onclick="window.__downloadFlowBizPdf()">Download PDF</button>
      </div>
    </div>
    <p class="footer">Generated by FlowBiz — this link is private to you, please don't share it.</p>
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

// The "Download PDF" button needs an ACTUAL jsPDF-generated file, not just
// window.print()'s optional "save as PDF" destination (not available/
// reliable on every device this page will be opened on). This is a
// deliberately minimal, framework-free re-implementation of the same
// thermal-receipt layout src/utils/documentService.js already uses in the
// authenticated app — it can't share that module directly because this
// page is static HTML served straight from the Worker, not part of the
// Vite build. The FINANCIAL DATA itself is never recomputed here: every
// number below is exactly what was already calculated and stored when the
// document was created — this only re-formats it onto paper a second way.
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
    if (!jsPDFCtor) { alert('Could not load the PDF engine. Please check your connection and try again.'); return; }
    var paperWidth = document.querySelector('meta[name="flowbiz-paper-width"]');
    var widthMm = paperWidth ? Number(paperWidth.content) : 80;
    // FIX (multi-product cart): a fixed 200mm page clips a receipt with
    // several line items — height now scales with how many products are
    // on it, same approach the authenticated app's own PDF generator uses.
    var itemCount = (vm.items && vm.items.length) || 1;
    var estimatedHeight = Math.max(200, 90 + itemCount * 10);
    var doc = new jsPDFCtor('p', 'mm', [widthMm, estimatedHeight]);
    var marginX = 5;
    var pageWidth = widthMm - marginX;
    var y = 8;

    if (biz.logoUrl) {
      try {
        var m = /data:image\\/(\\w+);/.exec(biz.logoUrl);
        var format = m ? m[1].toUpperCase() : 'PNG';
        var logoSize = widthMm <= 58 ? 11 : 14;
        doc.addImage(biz.logoUrl, format, marginX, y, logoSize, logoSize);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text(biz.shopName, marginX + logoSize + 3, y + 5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        if (biz.phone) doc.text('Tel: ' + biz.phone, marginX + logoSize + 3, y + 9);
        if (biz.email) doc.text(biz.email, marginX + logoSize + 3, y + 13);
        y += logoSize + 4;
      } catch (e) { y += 4; }
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(biz.shopName, marginX, y + 4);
      y += 10;
    }

    y += 2;
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth, y);
    y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(vm.label, marginX, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(vm.dateLabel, pageWidth, y, { align: 'right' });
    y += 5;
    if (vm.customerName) { doc.text('To: ' + vm.customerName, marginX, y); y += 4; }
    if (vm.refLabel) { doc.text('Ref: ' + vm.refLabel, marginX, y); y += 4; }

    y += 2;
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
    doc.line(marginX, y, pageWidth, y);
    y += 6;

    function row(label, value, bold) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 10 : 9);
      doc.text(label, marginX, y);
      doc.text(value, pageWidth, y, { align: 'right' });
      y += 6;
    }

    if (vm.kind === 'debtPaymentReceipt') {
      row('Previous balance', formatKES(vm.previousBalance));
      row('Payment received', formatKES(vm.amountPaid));
      doc.line(marginX, y, pageWidth, y); y += 5;
      row('Remaining balance', formatKES(vm.remainingBalance), true);
      y += 4;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.setTextColor(vm.isCleared ? 26 : 196, vm.isCleared ? 98 : 68, vm.isCleared ? 60 : 29);
      doc.text('STATUS: ' + (vm.isCleared ? 'DEBT CLEARED' : 'PARTIALLY PAID'), marginX, y);
      doc.setTextColor(0, 0, 0);
    } else if (vm.items && vm.items.length) {
      vm.items.forEach(function (it) {
        var lineTotal = (it.lineTotal != null) ? it.lineTotal : ((it.quantity || 0) * (it.unitPrice || 0));
        row(it.quantity + ' x ' + it.productName, formatKES(lineTotal));
      });
      doc.line(marginX, y, pageWidth, y); y += 6;
      if (vm.isCredit) {
        row('AMOUNT DUE', formatKES(vm.remainingBalance), true);
      } else {
        row('PAID (' + vm.paymentMethod + ')', formatKES(vm.totalAmount), true);
      }
    } else {
      row(vm.productName, formatKES(vm.totalAmount));
      doc.setTextColor(100, 100, 100);
      row(vm.quantity + ' x @ ' + formatKES(vm.soldPricePerUnit), '');
      doc.setTextColor(0, 0, 0);
      doc.line(marginX, y, pageWidth, y); y += 6;
      if (vm.isCredit) {
        row('AMOUNT DUE', formatKES(vm.remainingBalance), true);
      } else {
        row('PAID (' + vm.paymentMethod + ')', formatKES(vm.totalAmount), true);
      }
    }

    y += 10;
    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 100, 100);
    doc.text('Thank you!', pageWidth / 2 + marginX / 2, y, { align: 'center' });

    doc.save((vm.kind === 'debtPaymentReceipt' ? 'debt-payment-receipt' : vm.label.toLowerCase()) + '.pdf');
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
    title: `${vm.label} — ${settings.shopName || 'FlowBiz'}`,
    bodyHtml: renderDocumentBody(vm, settings),
    paperWidthMm,
  }));
}
