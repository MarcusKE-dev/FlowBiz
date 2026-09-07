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

// What a line says beyond its name — the version sold, the choices made
// on it ("extra cheese", "no onions") and any note. This mirrors
// lineItemDetail() in src/utils/lineItems.js so the shared link, the
// downloaded PDF and the in-app receipt all say the same thing. Empty for
// every line that carries none, which is every line in a shop that does
// not use versions or modifiers.
function lineDetail(item) {
  const parts = [];
  if (item && item.variantLabel) parts.push(String(item.variantLabel));
  const modifiers = Array.isArray(item && item.modifiers) ? item.modifiers : [];
  for (const modifier of modifiers) {
    if (modifier && modifier.name) parts.push(String(modifier.name));
  }
  if (item && item.note) parts.push(String(item.note));
  return parts.join(', ');
}

function formatKES(amount) {
  const v = Number(amount) || 0;
  return `KES ${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(isoOrDate) {
  if (!isoOrDate) return '-';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '-';
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
      customerName: doc.customerName || '-',
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
    title: 'Document not available | FlowBiz',
    bodyHtml: `
      <div class="empty">
        <svg class="empty-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/></svg>
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
    /* Mirrors src/theme/tokens.js. The worker is a separate bundle and
       cannot import from the app, so these are kept in step by hand.

       There is deliberately no red here. A receipt is ink on paper:
       thermal printers are monochrome, and the one artifact a customer
       keeps must not depend on a colour the printer will flatten. The
       only colour on this page is --primary, and it is on the Download
       button, which is a screen action and not part of the receipt. */
    --ink-900:#0F1522; --ink-700:#4A5468; --ink-500:#7A8598; --ink-400:#9AA3B2;
    --ink-200:#E2E6EC; --ink-100:#EDF0F4; --ink-50:#F4F6F9;
    --primary:#1D70F5; --primary-700:#1659CC;
    --canvas:#F4F6F9; --surface:#FFFFFF; --line:#E2E6EC;
  }
  * { box-sizing: border-box; margin:0; padding:0; }
  body { background: var(--canvas); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: var(--ink-900); }
  .page { max-width: 440px; margin: 0 auto; padding: 24px 16px 48px; }
  .brand-bar { display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom: 16px; }
  .brand-bar span { font-weight: 600; color: var(--ink-900); font-size: 15px; letter-spacing: -0.02em; }

  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 24px 20px;
  }

  /* 1 — Business block */
  .logo { display:block; margin: 0 auto 10px; height: 56px; max-width: 150px; object-fit: contain; }
  .biz-name { text-align:center; font-size:16px; font-weight:700; text-transform:uppercase; letter-spacing:0.03em; color:var(--ink-900); }
  .biz-meta { text-align:center; font-size:11px; color:var(--ink-500); line-height:1.6; margin-top:5px; }

  /* 2 — the rule that opens the document proper */
  .rule-heavy { border:none; border-top:2px solid var(--ink-900); margin-top:14px; }

  /* 3 — Document title bar. No fill: emphasis is weight and tracking. */
  .line-detail { display:block; font-size:11px; color:var(--ink-3, #6b7280); margin-top:2px; }
  .doc-title-bar { display:flex; justify-content:space-between; align-items:baseline; gap:12px; padding:10px 0; border-bottom:1px solid var(--line); }
  .doc-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-900); }
  .doc-number { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; color:var(--ink-900); white-space:nowrap; }

  /* 4 — Meta grid */
  .meta { margin: 10px 0 16px; }
  .meta-row { display:flex; justify-content:space-between; align-items:baseline; gap:12px; font-size:12px; padding:4px 0; }
  .meta-row dt { color: var(--ink-500); }
  .meta-row dd { color: var(--ink-900); font-weight:600; text-align:right; }

  /* 5 — Itemised table */
  .item-table { width:100%; border-collapse:collapse; }
  .item-table th {
    font-size:10px; text-transform:uppercase; letter-spacing:0.06em;
    color:var(--ink-500); font-weight:600; text-align:left;
    padding-bottom:6px; border-bottom:1px solid var(--line);
  }
  .item-table td { font-size:13px; color:var(--ink-900); padding:6px 0; border-bottom:1px solid var(--line); vertical-align:top; }
  .item-table tr:last-child td { border-bottom:none; }
  .item-table .idx { width:20px; color:var(--ink-500); }
  .item-table .num { text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; }
  .item-table .qty { text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; color:var(--ink-700); }

  /* 6 — Totals. Bounded by a rule, never by a fill. */
  .totals { margin-top:14px; }
  .total-row { display:flex; justify-content:flex-end; align-items:baseline; gap:16px; padding:4px 0; }
  .total-row .label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:var(--ink-700); }
  .total-row .val { font-size:13px; color:var(--ink-900); font-variant-numeric: tabular-nums; text-align:right; min-width:120px; }
  .total-row.grand { padding-top:8px; border-top:1px solid var(--line); }
  .total-row.grand .val { font-size:20px; font-weight:700; }
  .totals-rule { border:none; border-top:2px solid var(--ink-900); margin-top:8px; }

  /* 7 — Status line */
  .status-line {
    text-align:center; font-size:11px; font-weight:700;
    text-transform:uppercase; letter-spacing:0.06em; color:var(--ink-900);
    padding:8px 0; margin-top:14px;
    border-top:1px solid var(--line); border-bottom:1px solid var(--line);
  }

  /* 8 — Footer */
  .doc-footer { text-align:center; font-size:10px; color:var(--ink-400); line-height:1.6; margin-top:16px; }

  .actions { display:flex; gap:10px; margin-top:20px; }
  .btn {
    flex:1; text-align:center; padding: 11px; border-radius:4px;
    font-weight:600; font-size:13px; border:1px solid var(--line);
    background: var(--surface); color: var(--ink-700); cursor:pointer;
  }
  .btn:hover { background: var(--ink-50); }
  .btn.primary { background: var(--primary); border-color: var(--primary); color:#fff; }
  .btn.primary:hover { background: var(--primary-700); }

  .footer-note { text-align:center; font-size:11px; color: var(--ink-400); margin-top: 18px; line-height: 1.5; }
  .empty { text-align:center; padding: 60px 16px; }
  .empty-icon { color: var(--ink-400); margin-bottom: 10px; }
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
  const logoHtml = settings.logoUrl
    ? `<img class="logo" src="${escapeHtml(settings.logoUrl)}" alt="" />`
    : '';

  // Address, phone and email each get their own line. Joined with a
  // separator they wrapped mid-address on a phone and read as one run-on
  // string on paper.
  const bizLines = [settings.address, settings.phone, settings.email]
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .join('<br/>');

  const metaRow = (label, value) => (value
    ? `<div class="meta-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    : '');

  const isDebt = vm.kind === 'debtPaymentReceipt';
  const paymentMethod = isDebt ? vm.method : vm.paymentMethod;

  const metaHtml = `
      <dl class="meta">
        ${metaRow('Date', vm.dateLabel)}
        ${metaRow('Customer', vm.customerName)}
        ${metaRow('Served by', vm.servedByName)}
        ${metaRow('Payment method', paymentMethod)}
        ${metaRow('M-Pesa reference', vm.mpesaCode)}
      </dl>`;

  // ── The itemised section ────────────────────────────────────────────
  // A debt payment has no line items, so its ledger — what was owed and
  // what was handed over — takes the same table and the same four rules.
  let tableHtml;
  let totalsHtml;
  let statusLabel = '';

  if (isDebt) {
    tableHtml = `
      <table class="item-table">
        <thead><tr><th class="idx">#</th><th>Item</th><th class="qty">Detail</th><th class="num">Amount</th></tr></thead>
        <tbody>
          <tr><td class="idx">1</td><td>Balance before this payment</td><td class="qty">-</td><td class="num">${formatKES(vm.previousBalance)}</td></tr>
          <tr><td class="idx">2</td><td>Payment received</td><td class="qty">${escapeHtml(paymentMethod || '-')}</td><td class="num">- ${formatKES(vm.amountPaid)}</td></tr>
        </tbody>
      </table>`;
    totalsHtml = `
      <div class="totals">
        <div class="total-row"><span class="label">Balance before</span><span class="val">${formatKES(vm.previousBalance)}</span></div>
        <div class="total-row grand"><span class="label">Remaining balance</span><span class="val">${formatKES(vm.remainingBalance)}</span></div>
        <hr class="totals-rule"/>
      </div>`;
    statusLabel = vm.isCleared ? 'Paid in full' : 'Partially paid';
  } else {
    const lines = vm.items || [{
      productName: vm.productName,
      quantity: vm.quantity,
      unitPrice: vm.soldPricePerUnit,
      lineTotal: vm.totalAmount,
    }];

    const rows = lines.map((it, i) => {
      const qty = Number(it.quantity) || 0;
      const unit = Number(it.unitPrice) || 0;
      const lineTotal = it.lineTotal != null ? it.lineTotal : qty * unit;
      const detail = lineDetail(it);
      return `
          <tr>
            <td class="idx">${i + 1}</td>
            <td>${escapeHtml(it.productName || 'Item')}${detail ? `<span class="line-detail">${escapeHtml(detail)}</span>` : ''}</td>
            <td class="qty">${qty} &times; ${formatKES(unit)}</td>
            <td class="num">${formatKES(lineTotal)}</td>
          </tr>`;
    }).join('');

    tableHtml = `
      <table class="item-table">
        <thead><tr><th class="idx">#</th><th>Item</th><th class="qty">Qty &times; Unit price</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    // No tax logic exists in FlowBiz, so the subtotal IS the goods total.
    // It is shown rather than invented: on a part-paid invoice it is the
    // value of the goods, against an amount due that is what is left.
    const grandLabel = vm.isCredit ? 'Amount due' : 'Total paid';
    const grandValue = vm.isCredit ? vm.remainingBalance : vm.totalAmount;
    totalsHtml = `
      <div class="totals">
        <div class="total-row"><span class="label">Subtotal</span><span class="val">${formatKES(vm.totalAmount)}</span></div>
        <div class="total-row grand"><span class="label">${grandLabel}</span><span class="val">${formatKES(grandValue)}</span></div>
        <hr class="totals-rule"/>
      </div>`;

    if (vm.isCredit) {
      statusLabel = (Number(vm.remainingBalance) || 0) < (Number(vm.totalAmount) || 0)
        ? 'Partially paid'
        : 'Payment pending';
    }
  }

  const statusHtml = statusLabel
    ? `<div class="status-line">${escapeHtml(statusLabel)}</div>`
    : '';

  return `
    <div class="card">
      ${logoHtml}
      <h1 class="biz-name">${escapeHtml(settings.shopName || 'FlowBiz Store')}</h1>
      ${bizLines ? `<p class="biz-meta">${bizLines}</p>` : ''}

      <hr class="rule-heavy"/>

      <div class="doc-title-bar">
        <span class="doc-title">${escapeHtml(vm.label)}</span>
        <span class="doc-number">${escapeHtml(vm.receiptNumber)}</span>
      </div>

      ${metaHtml}
      ${tableHtml}
      ${totalsHtml}
      ${statusHtml}

      <p class="doc-footer">
        Thank you for your business.<br/>
        Generated via FlowBiz
      </p>

      <div class="actions">
        <button class="btn" onclick="window.print()">Print</button>
        <button class="btn primary" onclick="window.__downloadFlowBizPdf()">Download PDF</button>
      </div>
    </div>
    <p class="footer-note">Official digital document generated via FlowBiz.</p>
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

// The Download button's PDF. It follows renderDocumentBody section for
// section — business block, heavy rule, title bar, meta grid, four-column
// item table, totals block, status line, footer — so a customer never
// gets a file that looks like a different document from the page they
// downloaded it from. All ink, no red, no fills.
function buildPdfScript() {
  return `
(function () {
  var INK = [15, 21, 34];
  var INK_2 = [74, 84, 104];
  var INK_3 = [122, 133, 152];
  var LINE = [226, 230, 236];

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

    var isDebt = vm.kind === 'debtPaymentReceipt';
    var lines = isDebt ? [] : (vm.items && vm.items.length ? vm.items : [{
      productName: vm.productName, quantity: vm.quantity,
      unitPrice: vm.soldPricePerUnit, lineTotal: vm.totalAmount
    }]);
    var rowCount = isDebt ? 2 : lines.length;

    // Dynamic page height: the fixed chrome plus a row allowance, with a
    // little slack for a wrapped business address.
    var estimatedHeight = Math.max(170, 105 + rowCount * 9);
    var doc = new jsPDFCtor('p', 'mm', [widthMm, estimatedHeight]);

    var marginX = 4;
    var pageWidth = widthMm - marginX;
    var contentW = pageWidth - marginX;
    var centerX = widthMm / 2;
    var y = 6;

    function ruleHeavy(atY) {
      doc.setDrawColor(INK[0], INK[1], INK[2]);
      doc.setLineWidth(0.5);
      doc.line(marginX, atY, pageWidth, atY);
    }
    function ruleLight(atY) {
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.2);
      doc.line(marginX, atY, pageWidth, atY);
    }

    // ── 1. Business block ──────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(String(biz.shopName || '').toUpperCase(), centerX, y, { align: 'center' });
    y += 4.2;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
    doc.setTextColor(INK_3[0], INK_3[1], INK_3[2]);
    [biz.address, biz.phone, biz.email].forEach(function (line) {
      if (!line) return;
      doc.splitTextToSize(String(line), contentW).forEach(function (part) {
        doc.text(part, centerX, y, { align: 'center' });
        y += 3;
      });
    });

    // ── 2. Heavy rule ──────────────────────────────────────────────
    y += 1.5;
    ruleHeavy(y);
    y += 4.5;

    // ── 3. Document title bar ──────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(String(vm.label || '').toUpperCase(), marginX, y);
    doc.setFont('courier', 'normal'); doc.setFontSize(7.5);
    doc.text(String(vm.receiptNumber || ''), pageWidth, y, { align: 'right' });
    y += 2.2;
    ruleLight(y);
    y += 4;

    // ── 4. Meta grid ───────────────────────────────────────────────
    function meta(label, value) {
      if (!value) return;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(INK_3[0], INK_3[1], INK_3[2]);
      doc.text(label, marginX, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(String(value), pageWidth, y, { align: 'right' });
      y += 3.8;
    }
    meta('Date', vm.dateLabel);
    meta('Customer', vm.customerName);
    meta('Served by', vm.servedByName);
    meta('Payment method', isDebt ? vm.method : vm.paymentMethod);
    meta('M-Pesa reference', vm.mpesaCode);

    // ── 5. Itemised table ──────────────────────────────────────────
    // Four columns at both paper widths, laid out proportionally so 58mm
    // narrows every column rather than dropping one.
    y += 1.5;
    var xIdx = marginX;
    var xItem = marginX + contentW * 0.07;
    var xQty = marginX + contentW * 0.74;   // right edge of the qty column
    var itemW = xQty - xItem - contentW * 0.24;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8);
    doc.setTextColor(INK_3[0], INK_3[1], INK_3[2]);
    doc.text('#', xIdx, y);
    doc.text('ITEM', xItem, y);
    doc.text(isDebt ? 'DETAIL' : 'QTY x UNIT PRICE', xQty, y, { align: 'right' });
    doc.text('AMOUNT', pageWidth, y, { align: 'right' });
    y += 1.8;
    ruleLight(y);
    y += 3.6;

    function itemRow(index, name, detail, amount) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(INK_3[0], INK_3[1], INK_3[2]);
      doc.text(String(index), xIdx, y);

      doc.setTextColor(INK[0], INK[1], INK[2]);
      var wrapped = doc.splitTextToSize(String(name || 'Item'), itemW);
      doc.text(wrapped, xItem, y);

      doc.setTextColor(INK_2[0], INK_2[1], INK_2[2]);
      doc.text(String(detail), xQty, y, { align: 'right' });

      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(String(amount), pageWidth, y, { align: 'right' });

      y += Math.max(wrapped.length, 1) * 3 + 1.4;
      ruleLight(y - 1.4);
      y += 1.2;
    }

    if (isDebt) {
      itemRow(1, 'Balance before this payment', '-', formatKES(vm.previousBalance));
      itemRow(2, 'Payment received', vm.method || '-', '- ' + formatKES(vm.amountPaid));
    } else {
      lines.forEach(function (it, i) {
        var qty = Number(it.quantity) || 0;
        var unit = Number(it.unitPrice) || 0;
        var lineTotal = (it.lineTotal != null) ? it.lineTotal : qty * unit;
        var parts = [];
        if (it.variantLabel) parts.push(String(it.variantLabel));
        (Array.isArray(it.modifiers) ? it.modifiers : []).forEach(function (m) {
          if (m && m.name) parts.push(String(m.name));
        });
        if (it.note) parts.push(String(it.note));
        var name = parts.length ? it.productName + ' (' + parts.join(', ') + ')' : it.productName;
        itemRow(i + 1, name, qty + ' x ' + formatKES(unit), formatKES(lineTotal));
      });
    }

    // ── 6. Totals block ────────────────────────────────────────────
    y += 2;
    function totalRow(label, value, grand) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(grand ? 7.5 : 6.5);
      doc.setTextColor(grand ? INK[0] : INK_2[0], grand ? INK[1] : INK_2[1], grand ? INK[2] : INK_2[2]);
      doc.text(String(label).toUpperCase(), xQty, y, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(grand ? 11 : 7.5);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(String(value), pageWidth, y, { align: 'right' });
      y += grand ? 5 : 4.2;
    }

    var statusLabel = '';
    if (isDebt) {
      totalRow('Balance before', formatKES(vm.previousBalance), false);
      ruleLight(y - 2.6);
      totalRow('Remaining balance', formatKES(vm.remainingBalance), true);
      statusLabel = vm.isCleared ? 'PAID IN FULL' : 'PARTIALLY PAID';
    } else {
      totalRow('Subtotal', formatKES(vm.totalAmount), false);
      ruleLight(y - 2.6);
      totalRow(
        vm.isCredit ? 'Amount due' : 'Total paid',
        formatKES(vm.isCredit ? vm.remainingBalance : vm.totalAmount),
        true
      );
      if (vm.isCredit) {
        statusLabel = (Number(vm.remainingBalance) || 0) < (Number(vm.totalAmount) || 0)
          ? 'PARTIALLY PAID'
          : 'PAYMENT PENDING';
      }
    }
    ruleHeavy(y - 1.5);

    // ── 7. Status line ─────────────────────────────────────────────
    if (statusLabel) {
      y += 3.5;
      ruleLight(y - 2.8);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(statusLabel, centerX, y, { align: 'center' });
      y += 1.6;
      ruleLight(y);
      y += 3;
    }

    // ── 8. Footer ──────────────────────────────────────────────────
    y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
    doc.setTextColor(INK_3[0], INK_3[1], INK_3[2]);
    doc.text('Thank you for your business.', centerX, y, { align: 'center' });
    y += 3;
    doc.text('Generated via FlowBiz', centerX, y, { align: 'center' });

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
    title: `${vm.label} (${vm.receiptNumber}) | ${settings.shopName || 'FlowBiz'}`,
    bodyHtml: renderDocumentBody(vm, settings),
    paperWidthMm,
  }));
}