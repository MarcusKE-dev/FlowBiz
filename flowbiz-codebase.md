This file is a merged representation of a subset of the codebase, containing files not matching ignore patterns, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory scture
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching these patterns are excluded: node_modules, dist, build, .next, coverage, .git, .agents, package-lock.json, pnpm-lock.yaml, yarn.lock, firebase-debug.log, firebase-debug.*.log
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
````
.kilo/
  kilo.json
cloudflare-worker/
  src/
    lib/
      cors.js
      emailTemplates.js
      firebaseIdToken.js
      firestore.js
      googleAuth.js
      identityToolkit.js
      jwt.js
      resend.js
      response.js
    routes/
      deleteOwnProfile.js
      deleteStaff.js
      paystackInitialize.js
      paystackWebhook.js
      proPrice.js
      publicDocument.js
      sendPasswordResetEmail.js
      sendVerificationEmail.js
    index.js
  package.json
  wrangler.toml
public/
  icons/
    icon-128.png
    icon-144.png
    icon-152.png
    icon-180.png
    icon-192.png
    icon-384.png
    icon-512.png
    icon-72.png
    icon-96.png
  _redirects
  favicon-16.png
  favicon-32.png
  favicon.svg
  hero-photo.webp
  robots.txt
  sitemap.xml
src/
  components/
    charts/
      DonutChart.jsx
      MiniBarChart.jsx
      MiniLineChart.jsx
    common/
      ConfirmDialog.jsx
      ConnectivityIndicator.jsx
      EmptyState.jsx
      ErrorBanner.jsx
      ErrorBoundary.jsx
      ExportCsvButton.jsx
      LoadingSpinner.jsx
      Modal.jsx
      ProtectedRoute.jsx
      PwaInstallBanner.jsx
      RequireOpenSession.jsx
      WhatsAppFloatingButton.jsx
    customers/
      AddCustomerModal.jsx
    debtors/
      DebtPaymentReceiptModal.jsx
      RefundModal.jsx
      RepaymentModal.jsx
    landing/
      FaqSection.jsx
      FeatureGrid.jsx
      HeroSection.jsx
      HowItWorks.jsx
      LandingFooter.jsx
      LandingHeader.jsx
      PosSimulationMockup.jsx
      PricingComparison.jsx
    layout/
      AppShell.jsx
      BottomNav.jsx
      MobileMoreDrawer.jsx
      navConfig.js
      Sidebar.jsx
      TopHeader.jsx
    pos/
      CartCheckoutModal.jsx
      CartList.jsx
      OpenSessionPrompt.jsx
      ProductGrid.jsx
      SaleCompleteModal.jsx
      SaleModal.jsx
    products/
      ProductFormModal.jsx
    scanner/
      ScanFab.jsx
      ScannerModal.jsx
    suppliers/
      SupplierFormModal.jsx
  constants/
    categories.js
  contexts/
    AuthContext.jsx
  demo/
    demoMode.js
    localAuth.js
    localFirestore.js
    seedData.js
  hooks/
    useCameraScanner.js
    useDailySession.js
    useFinancials.js
    useFirestoreCollection.js
    useHardwareScanner.js
    useOnlineStatus.js
    usePwaInstall.js
    useSettings.js
    useSetupStatus.js
  lib/
    tenant.js
  pages/
    AdvancedAnalytics.jsx
    AuthAction.jsx
    CloseDay.jsx
    Counter.jsx
    CustomerDetail.jsx
    Customers.jsx
    Dashboard.jsx
    DemoLanding.jsx
    Expenses.jsx
    ForgotPassword.jsx
    HelpGuide.jsx
    InventoryIntelligence.jsx
    JoinStaff.jsx
    LandingPage.jsx
    Login.jsx
    Privacy.jsx
    Pro.jsx
    Products.jsx
    Purchases.jsx
    Reports.jsx
    Settings.jsx
    Setup.jsx
    StockTake.jsx
    Suppliers.jsx
    Terms.jsx
    Users.jsx
  router/
    AppRouter.jsx
    routePrefetch.js
  utils/
    businessReset.js
    csvExport.js
    currency.js
    customers.js
    dataExport.js
    dataImport.js
    dateRanges.js
    documentService.js
    documentSharing.js
    errorMessages.js
    financials.js
    financials.test.js
    offlineWrite.js
    products.js
    scannerService.js
    whatsapp.js
  App.jsx
  firebase.js
  index.css
  main.jsx
.env.example
.firebaserc
.gitignore
.nvmrc
.pagesignore
CHANGES.md
eslint.config.js
firebase.json
firestore.indexes.json
firestore.rules
index.html
package.json
postcss.config.js
README.md
skills-lock.json
storage.rules
tailwind.config.js
vite.config.js
````

# Files

## File: cloudflare-worker/src/routes/publicDocument.js
````javascript
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
````

## File: src/pages/DemoLanding.jsx
````javascript
// src/pages/DemoLanding.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { enterDemoMode } from '../demo/demoMode';
import { seedDemoDataIfNeeded } from '../demo/seedData';
import { useAuth } from '../contexts/AuthContext';

export default function DemoLanding() {
  const navigate = useNavigate();
  const { reloadProfile } = useAuth();

  useEffect(() => {
    enterDemoMode();
    seedDemoDataIfNeeded();
    reloadProfile?.();

    const timer = setTimeout(() => {
      navigate('/counter', { replace: true });
    }, 100);

    return () => clearTimeout(timer);
  }, [navigate, reloadProfile]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand p-6">
      <div className="flex flex-col items-center justify-center gap-3 text-ink-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
        <span className="text-sm font-semibold text-ink-800">Opening Demo Counter…</span>
      </div>
    </div>
  );
}
````

## File: .kilo/kilo.json
````json
{
  "$schema": "https://app.kilo.ai/config.json",
  "mcp": {
    "firebase": {
      "type": "local",
      "command": [
        "npx",
        "-y",
        "firebase-tools@14.15.2",
        "experimental:mcp"
      ]
    }
  }
}
````

## File: cloudflare-worker/src/lib/cors.js
````javascript
// src/lib/cors.js
//
// CORS handling for the FlowBiz API worker. Only origins listed in the
// ALLOWED_ORIGINS environment variable (comma-separated) are ever allowed
// to read a response — this is what stops some other website from
// silently calling FlowBiz's API using a signed-in user's browser session.

export function corsHeaders(origin, allowedOrigins) {
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function handleOptions(request, allowedOrigins) {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin, allowedOrigins) });
}
````

## File: cloudflare-worker/src/lib/emailTemplates.js
````javascript
// src/lib/emailTemplates.js
//
// HTML + plain-text bodies for FlowBiz's transactional emails. Kept
// separate from resend.js on purpose: resend.js only knows how to talk
// to the Resend API, this file only knows what FlowBiz's emails say.
// Colors match the app's own Tailwind palette (moss/sand, see
// tailwind.config.js) so the email doesn't look like a different product.

const BRAND_GREEN = '#1a623c';
const BRAND_SAND = '#faf6ef';
const INK_900 = '#15171d';
const INK_700 = '#363b48';
const INK_400 = '#767f8f';
const INK_100 = '#e8eaed';

function shell(bodyHtml) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:${BRAND_SAND};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_SAND};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${BRAND_GREEN};padding:20px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.02em;">FlowBiz</span>
        </td></tr>
        <tr><td style="padding:28px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid ${INK_100};">
          <p style="margin:0;font-size:12px;color:${INK_400};">FlowBiz Business Manager for Kenyan SMBs. This is an automated message, please don't reply to it.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(url, label) {
  return `<a href="${url}" style="display:inline-block;background:${BRAND_GREEN};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;margin:20px 0;">${label}</a>`;
}

export function verificationEmail(link) {
  const html = shell(`
    <h1 style="margin:0 0 12px;font-size:20px;color:${INK_900};">Welcome to FlowBiz</h1>
    <p style="margin:0 0 8px;font-size:14px;color:${INK_700};line-height:1.6;">Please verify your email address to activate your FlowBiz account.</p>
    ${button(link, 'Verify my email')}
    <p style="margin:16px 0 0;font-size:12px;color:${INK_400};">If you didn't create a FlowBiz account, you can safely ignore this email.</p>
  `);

  const text = `Welcome to FlowBiz

Please verify your email address to activate your FlowBiz account.

If you didn't create a FlowBiz account, you can safely ignore this email.`;

  return { subject: 'Verify your FlowBiz account', html, text };
}

export function passwordResetEmail(link) {
  const html = shell(`
    <h1 style="margin:0 0 12px;font-size:20px;color:${INK_900};">Reset your FlowBiz password</h1>
    <p style="margin:0 0 8px;font-size:14px;color:${INK_700};line-height:1.6;">We received a request to reset the password for your FlowBiz account.</p>
    ${button(link, 'Reset password')}
    <p style="margin:16px 0 0;font-size:12px;color:${INK_400};">If you didn't request this, you can safely ignore this email your password will not be changed.</p>
  `);

  const text = `Reset your FlowBiz password

We received a request to reset the password for your FlowBiz account.

If you didn't request this, you can safely ignore this email your password will not be changed.`;

  return { subject: 'Reset your FlowBiz password', html, text };
}
````

## File: cloudflare-worker/src/lib/firebaseIdToken.js
````javascript
// src/lib/firebaseIdToken.js
//
// Verifies a Firebase Authentication ID token WITHOUT the Firebase Admin
// SDK (which doesn't reliably run in Cloudflare Workers — see the
// project's audit notes). This follows Firebase's own documented manual
// verification procedure:
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
//
// Every privileged route calls this FIRST. If it throws, the caller isn't
// who they claim to be — full stop, nothing downstream can be trusted.

import { base64UrlToJson, base64UrlToUint8Array, stringToUint8Array } from './jwt.js';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let cachedJwks = null;
let cachedJwksExpiry = 0;

async function getJwks() {
  const now = Date.now();
  if (cachedJwks && now < cachedJwksExpiry) return cachedJwks;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error('Could not fetch Firebase public keys.');
  const data = await res.json();
  cachedJwks = data.keys;
  cachedJwksExpiry = now + 60 * 60 * 1000; // Google rotates these; re-fetch hourly.
  return cachedJwks;
}

async function importPublicKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

export async function verifyFirebaseIdToken(idToken, projectId) {
  if (!idToken || typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    throw new Error('Malformed ID token.');
  }
  const [headerB64, payloadB64, signatureB64] = idToken.split('.');
  const header = base64UrlToJson(headerB64);
  const payload = base64UrlToJson(payloadB64);

  if (header.alg !== 'RS256') throw new Error('Unexpected token algorithm.');
  if (!header.kid) throw new Error('Token missing key id.');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('Token expired.');
  if (typeof payload.iat !== 'number' || payload.iat > now + 60) throw new Error('Token issued in the future.');
  if (payload.aud !== projectId) throw new Error('Token audience mismatch.');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Token issuer mismatch.');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Token missing subject.');

  const jwks = await getJwks();
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('No matching public key for this token.');

  const key = await importPublicKey(jwk);
  const signature = base64UrlToUint8Array(signatureB64);
  const signedData = stringToUint8Array(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData);
  if (!valid) throw new Error('Token signature invalid.');

  return { uid: payload.sub, email: payload.email || null, claims: payload };
}
````

## File: cloudflare-worker/src/lib/googleAuth.js
````javascript
// src/lib/googleAuth.js
//
// Mints a short-lived Google OAuth2 access token from a service account,
// using the standard "JWT bearer" flow — pure Web Crypto, no Node APIs,
// so it runs fine in a Cloudflare Worker. The resulting token is what lets
// this backend call the Firestore REST API and the Identity Toolkit
// (Firebase Auth admin) REST API on FlowBiz's behalf.

import { pemToDer, stringToUint8Array, uint8ArrayToBase64Url } from './jwt.js';

let cachedToken = null;
let cachedTokenExpiry = 0;

async function importPrivateKey(pem) {
  const der = pemToDer(pem);
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

export async function getGoogleAccessToken(env) {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) return cachedToken;

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON secret is missing or not valid JSON.');
  }

  const nowSec = Math.floor(now / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    // cloud-platform is broad on purpose: it's the one scope guaranteed to
    // cover both Firestore and Identity Toolkit without guessing at a
    // narrower scope name. Actual permissions are still constrained by
    // whatever IAM roles are granted to this service account in Google
    // Cloud — see the deployment README for exactly which roles to grant.
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const headerB64 = uint8ArrayToBase64Url(stringToUint8Array(JSON.stringify(header)));
  const claimsB64 = uint8ArrayToBase64Url(stringToUint8Array(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;

  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, stringToUint8Array(signingInput));
  const jwt = `${signingInput}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Failed to mint Google access token: ${await tokenRes.text()}`);
  }
  const tokenData = await tokenRes.json();
  cachedToken = tokenData.access_token;
  cachedTokenExpiry = now + (tokenData.expires_in - 120) * 1000; // refresh a bit early
  return cachedToken;
}
````

## File: cloudflare-worker/src/lib/jwt.js
````javascript
// src/lib/jwt.js
//
// Small, dependency-free helpers for working with JWTs and PEM keys using
// only the Web Crypto API — everything here runs in a Cloudflare Worker
// without needing Node.js APIs or npm crypto packages.

export function base64UrlToUint8Array(base64Url) {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64UrlToJson(base64Url) {
  const bytes = base64UrlToUint8Array(base64Url);
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function stringToUint8Array(str) {
  return new TextEncoder().encode(str);
}

export function uint8ArrayToBase64Url(bytes) {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Converts a PEM-encoded key (the format Google service-account JSON files
// use for `private_key`) into the raw DER bytes that crypto.subtle wants.
export function pemToDer(pem) {
  const stripped = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(stripped);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
````

## File: cloudflare-worker/src/lib/resend.js
````javascript
// src/lib/resend.js
//
// Minimal Resend API client — the ONLY place in this Worker that talks to
// Resend. Every transactional email FlowBiz sends goes through
// sendEmail() below, so there is exactly one code path that ever touches
// env.RESEND_API_KEY. The key never leaves this function: it's read from
// the Worker's own secret binding, used in an Authorization header on a
// server-to-server fetch, and never echoed into any response, log line,
// or thrown error.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'FlowBiz <noreply@flowbiz.co.ke>';

export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    // Fails loudly in logs (so you notice a missing secret immediately)
    // without ever printing the key itself, because there isn't one to print.
    throw new Error('RESEND_API_KEY is not configured on this Worker.');
  }
  if (!to || !subject || !html) {
    throw new Error('sendEmail() requires to, subject, and html.');
  }

  let res;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html,
        text: text || undefined,
      }),
    });
  } catch (err) {
    // Network-level failure reaching Resend itself (not a Resend-side
    // rejection) — never rethrow err.message verbatim in case it ever
    // contains request internals; log a fixed, safe message instead.
    console.error('[resend] network error contacting Resend API');
    throw new Error('Could not reach the email delivery service.');
  }

  if (!res.ok) {
    // Resend's error body is diagnostic-only (it never contains the API
    // key), so it's safe to log — but it's never returned to the caller,
    // which only ever gets a generic message back.
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.message || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => '(no body)');
    }
    console.error(`[resend] send failed (status ${res.status}):`, detail);
    throw new Error('The email could not be sent. Please try again.');
  }

  return true;
}
````

## File: cloudflare-worker/src/routes/deleteOwnProfile.js
````javascript
import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { getDocument, deleteDocument } from '../lib/firestore.js';

export async function handleDeleteOwnProfile(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return errorResponse('Missing Authorization header.', 401);

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return errorResponse(`Invalid session: ${err.message}`, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }
  const mode = body?.mode;
  if (mode !== 'full-wipe' && mode !== 'self-only') {
    return errorResponse('mode must be "full-wipe" or "self-only".', 400);
  }

  const callerProfile = await getDocument(env, 'users', caller.uid);
  if (!callerProfile) {
    // Profile's already gone — nothing left to clean up.
    return json({ success: true });
  }

  if (mode === 'full-wipe') {
    if (!callerProfile.businessId) return errorResponse('No business associated with this account.', 400);
    await deleteDocument(env, 'businessSettings', callerProfile.businessId);
    await deleteDocument(env, 'businesses', callerProfile.businessId);
  }

  await deleteDocument(env, 'users', caller.uid);

  return json({ success: true });
}
````

## File: cloudflare-worker/src/routes/paystackWebhook.js
````javascript
// src/routes/paystackWebhook.js
//
// POST /api/paystack/webhook — called directly by Paystack, not by
// FlowBiz's frontend. Three layers of protection, all required:
//   1. HMAC signature check (proves the request really came from Paystack)
//   2. Idempotency check (a redelivered webhook must not extend twice)
//   3. Server-side re-verification against Paystack's own API, with the
//      amount cross-checked against what /initialize recorded (proves the
//      payment was for what we actually charged, not whatever the payload
//      claims)

import { errorResponse } from '../lib/response.js';
import { getDocument, patchDocument } from '../lib/firestore.js';

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPaystackSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return bytesToHex(new Uint8Array(mac)) === signatureHeader;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function handlePaystackWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  const validSignature = await verifyPaystackSignature(rawBody, signature, env.PAYSTACK_SECRET_KEY);
  if (!validSignature) return errorResponse('Invalid signature.', 401);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return errorResponse('Invalid JSON.', 400);
  }

  if (event.event !== 'charge.success') {
    return new Response('ok', { status: 200 }); // acknowledge, ignore other event types
  }

  const reference = event.data?.reference;
  if (!reference) return errorResponse('Missing reference.', 400);

  const paymentRecord = await getDocument(env, 'payments', reference);
  if (!paymentRecord) return errorResponse('Unknown payment reference.', 404);

  // IDEMPOTENCY — Paystack can and does redeliver webhooks.
  if (paymentRecord.status === 'success') {
    return new Response('ok', { status: 200 });
  }

  // Re-verify directly against Paystack rather than trusting the payload.
  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
  });
  const verifyData = await verifyRes.json();
  const tx = verifyData?.data;

  if (!verifyRes.ok || !verifyData.status || tx?.status !== 'success') {
    return errorResponse('Transaction could not be verified as successful.', 400);
  }
  const expectedAmountKobo = Math.round((paymentRecord.amountKes || 0) * 100);
  if (tx.amount !== expectedAmountKobo || tx.currency !== 'KES') {
    return errorResponse('Amount/currency mismatch — refusing to activate subscription.', 400);
  }

  const businessId = paymentRecord.businessId;
  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found for this payment.', 404);

  const now = new Date();
  const currentExpiry = business.subscription?.expiresAt ? new Date(business.subscription.expiresAt) : null;
  // Extend from the current expiry if still active; otherwise start fresh from now.
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const newExpiry = addDays(base, 30);

  await patchDocument(env, 'businesses', businessId, {
    subscription: { plan: 'pro', status: 'active', expiresAt: newExpiry },
  });

  await patchDocument(env, 'payments', reference, {
    status: 'success',
    confirmedAt: now,
    paystackTransactionId: String(tx.id || ''),
  });

  return new Response('ok', { status: 200 });
}
````

## File: cloudflare-worker/src/routes/proPrice.js
````javascript
import { json } from '../lib/response.js';
import { PRO_PLAN_AMOUNT_KES } from './paystackInitialize.js';

export async function handleProPrice() {
  return json({ amountKes: PRO_PLAN_AMOUNT_KES, currency: 'KES', periodDays: 30 });
}
````

## File: cloudflare-worker/package.json
````json
{
  "name": "flowbiz-api",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail"
  },
  "devDependencies": {
    "wrangler": "^3.90.0"
  }
}
````

## File: public/_redirects
````
/demo /demo/index.html 200
/demo/ /demo/index.html 200
/demo/* /demo/index.html 200
/* /index.html 200
````

## File: public/favicon.svg
````xml
<svg width="512" height="512" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="100" height="100" rx="22" fill="#1E4B3A"/>

  <!-- Monitor bezel -->
  <rect x="14" y="18" width="72" height="50" rx="8" fill="#F6F1E7"/>
  <!-- Screen (dark, so the glyphs read like a lit dashboard) -->
  <rect x="19" y="23" width="62" height="34" rx="5" fill="#1E4B3A"/>
  <!-- Stand -->
  <rect x="44" y="68" width="12" height="8" fill="#F6F1E7"/>
  <rect x="32" y="76" width="36" height="7" rx="3.5" fill="#F6F1E7"/>

  <!-- Dollar sign -->
  <text x="29" y="49" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#F6F1E7" text-anchor="middle">$</text>

  <!-- Ascending bars -->
  <rect x="52" y="46" width="7" height="8" rx="2.5" fill="#F6F1E7"/>
  <rect x="62" y="39" width="7" height="15" rx="2.5" fill="#F6F1E7"/>
  <rect x="72" y="31" width="7" height="23" rx="2.5" fill="#F6F1E7"/>
</svg>
````

## File: public/robots.txt
````
User-agent: *
Allow: /
Allow: /privacy
Allow: /terms
Allow: /setup
Allow: /login

Disallow: /dashboard
Disallow: /counter
Disallow: /customers
Disallow: /expenses
Disallow: /purchases
Disallow: /products
Disallow: /suppliers
Disallow: /stock-take
Disallow: /reports
Disallow: /close-day
Disallow: /users
Disallow: /settings
Disallow: /r/

Sitemap: https://flowbiz.co.ke/sitemap.xml
````

## File: public/sitemap.xml
````xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://flowbiz.co.ke/</loc>
    <lastmod>2026-08-24</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://flowbiz.co.ke/setup</loc>
    <lastmod>2026-08-24</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://flowbiz.co.ke/privacy</loc>
    <lastmod>2026-08-24</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://flowbiz.co.ke/terms</loc>
    <lastmod>2026-08-24</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
````

## File: src/components/charts/MiniBarChart.jsx
````javascript
// src/components/charts/MiniBarChart.jsx
//
// Two orientations from one component:
//   - "horizontal" — ranked comparisons (best-selling products, top
//     overstocked items). Defaults to blue: a ranking isn't inherently
//     good or bad, so it stays out of the green/red semantic pair.
//   - "vertical" — a value over time (profit trend). Defaults to
//     green/red per bar based on the sign of the value, since profit
//     being positive or negative IS the meaning here.
export default function MiniBarChart({ data, orientation = 'vertical', height = 160, formatValue = (v) => String(v), ariaLabel }) {
  if (!data || data.length === 0) return null;
  const values = data.map((d) => Number(d.value) || 0);
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);

  if (orientation === 'horizontal') {
    return (
      <div role="img" aria-label={ariaLabel || 'Bar chart'} className="space-y-2.5">
        {data.map((d, i) => {
          const value = Number(d.value) || 0;
          const widthPct = Math.max((Math.abs(value) / maxAbs) * 100, 2);
          return (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-ink-700">{d.label}</span>
                <span className="shrink-0 font-semibold text-ink-800">{formatValue(value)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-ink-100">
                <div className={`h-2 rounded-full ${d.colorClassName || 'bg-blue-600'}`} style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const width = Math.max(data.length * 14, 100);
  const midY = height / 2;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" role="img" aria-label={ariaLabel || 'Bar chart'}>
        <line x1="0" y1={midY} x2={width} y2={midY} stroke="currentColor" className="text-ink-100" strokeWidth="1" />
        {data.map((d, i) => {
          const value = Number(d.value) || 0;
          const gap = width / data.length;
          const barWidth = gap * 0.55;
          const x = i * gap + (gap - barWidth) / 2;
          const barHeight = (Math.abs(value) / maxAbs) * (midY - 8);
          const y = value >= 0 ? midY - barHeight : midY;
          const colorClass = d.colorClassName || (value >= 0 ? 'text-moss-600' : 'text-rust-500');
          return <rect key={i} x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} className={colorClass} fill="currentColor" rx="1.5" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}
````

## File: src/components/common/ConnectivityIndicator.jsx
````javascript
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
export default function ConnectivityIndicator() {
  const online = useOnlineStatus();
  return (
    <span className={`badge ${online ? 'bg-moss-100 text-moss-700' : 'bg-rust-100 text-rust-700'}`} title={online ? 'Online' : 'Offline — changes queue until reconnected'}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${online ? 'bg-moss-500' : 'bg-rust-500'}`} />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}
````

## File: src/components/common/EmptyState.jsx
````javascript
export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl2 border border-dashed border-ink-200 bg-white py-14 px-6 text-center">
      <h3 className="font-display text-base font-bold text-ink-800">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
````

## File: src/components/common/ErrorBanner.jsx
````javascript
export default function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="rounded-lg border border-rust-200 bg-rust-50 px-4 py-3 text-sm font-medium text-rust-700">{message}</div>;
}
````

## File: src/components/common/ErrorBoundary.jsx
````javascript
import { Component } from 'react';
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('FlowBiz error:', error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="font-display text-lg font-bold text-ink-900">Something went wrong</h2>
          <p className="text-sm text-ink-500">{this.state.error?.message}</p>
          <button className="btn-primary w-full" onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
}
````

## File: src/components/common/ExportCsvButton.jsx
````javascript
import { Download } from 'lucide-react';
import { exportToCSV } from '../../utils/csvExport';
export default function ExportCsvButton({ filename, rows, label = 'Export CSV' }) {
  return (
    <button className="btn-outline" disabled={!rows || rows.length === 0} onClick={() => exportToCSV(filename, rows)}>
      <Download className="h-4 w-4" strokeWidth={1.75} />{label}
    </button>
  );
}
````

## File: src/components/common/LoadingSpinner.jsx
````javascript
export default function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
````

## File: src/components/common/Modal.jsx
````javascript
import { useEffect, useRef } from 'react';

export default function Modal({
  open,
  title,
  onClose,
  children,
  widthClass = 'max-w-md',
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);

    // Focus only once when the modal opens.
    const firstInput = containerRef.current?.querySelector(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
    );

    firstInput?.focus();

    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        className={`max-h-[92vh] w-full ${widthClass} overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl2`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
````

## File: src/components/common/RequireOpenSession.jsx
````javascript
import { useDailySession } from '../../hooks/useDailySession';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';

export default function RequireOpenSession({ children }) {
  const { isAdmin } = useAuth();
  const { session, loading, isClosed } = useDailySession();
  if (loading) return <LoadingSpinner />;
  if (isClosed) {
    return <div className="mx-auto max-w-sm pt-8"><EmptyState title="Today's session is closed" description="This page is locked until the day is reopened." /></div>;
  }
  if (!session) {
    return <div className="mx-auto max-w-sm pt-8"><EmptyState title="Counter not opened yet" description={isAdmin ? "Open today's session from Counter or Dashboard first." : "Ask your owner to open today's session first."} /></div>;
  }
  return children;
}
````

## File: src/components/debtors/RefundModal.jsx
````javascript
import { useState } from 'react';
import Modal from '../common/Modal';
import { formatKES } from '../../utils/currency';
import { Banknote, Smartphone } from 'lucide-react';

export default function RefundModal({ open, creditSale, onClose, onSubmit }) {
  const [method, setMethod] = useState('Cash');
  const [busy, setBusy]     = useState(false);
  if (!creditSale) return null;
  const amountPaid = Number(creditSale.amountPaid) || 0;
  const handle = async e => {
    e.preventDefault(); setBusy(true);
    try { await onSubmit({ method }); setMethod('Cash'); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Refund — ${creditSale.productName}`}>
      <form onSubmit={handle} className="space-y-3">
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
          Already collected from customer: <span className="font-semibold text-ink-800">{formatKES(amountPaid)}</span>
          <p className="mt-1 text-xs text-ink-400">This amount will be handed back and recorded as money leaving the till. Stock will be restored.</p>
        </div>
        <div>
          <label className="label">Refund via</label>
          <div className="grid grid-cols-2 gap-2">
            {['Cash','M-Pesa'].map(m=>(
              <button key={m} type="button" onClick={()=>setMethod(m)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${method===m?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>
                {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-danger" disabled={busy}>{busy?'Refunding…':'Confirm refund'}</button>
        </div>
      </form>
    </Modal>
  );
}
````

## File: src/components/landing/FaqSection.jsx
````javascript
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      question: 'Does FlowBiz work when there is no internet connection?',
      answer: 'Yes. FlowBiz uses an offline-first architecture with persistent local caching. Sales, credit purchases, and expenses are saved immediately in your browser or phone storage and sync automatically with the cloud database the moment connectivity is restored.',
    },
    {
      question: 'How does M-Pesa reconciliation work at closing time?',
      answer: 'When recording sales, cashiers specify whether the payment was received via Cash or M-Pesa (along with the M-Pesa transaction code). At the end of the shift on the Close Day page, FlowBiz calculates the exact expected M-Pesa sum so you can reconcile it directly against your M-Pesa Till or Paybill balance.',
    },
    {
      question: 'Why does profit stay at zero when I record a Credit (Deni) sale?',
      answer: 'FlowBiz uses a cash-flow-first accounting model specifically designed for retail businesses. While physical stock is deducted immediately to prevent double-selling, revenue and gross profit are only recognized when the customer pays off their debt. This prevents false profit illusions on uncollected credit.',
    },
    {
      question: 'Do I need to purchase specialized POS hardware or barcode scanners?',
      answer: 'No. FlowBiz runs directly in any modern web browser or as an installed app on Android, iOS, Windows, or Mac. You can use your phone camera to scan barcodes, or plug in standard USB/Bluetooth handheld barcode scanners and 58mm/80mm thermal receipt printers.',
    },
    {
      question: 'Can my cashiers see my profit margins and wholesale buying costs?',
      answer: 'No. Staff accounts have strict role separation. Cashiers only have access to the POS Counter, Customer Lookup, and authorized expense logging. Sensitive reports, profit calculations, inventory intelligence, and system settings are strictly reserved for Business Owners.',
    },
    {
      question: 'How do digital WhatsApp receipts work without extra fees?',
      answer: 'FlowBiz generates a secure, lightweight document link and opens a pre-formatted WhatsApp chat directly on your device with one tap. This avoids expensive monthly WhatsApp Business Cloud API charges or SMS subscription costs.',
    },
  ];

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-16 md:py-24 border-t border-[#e8eaed] bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
         
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#15171d] tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-[#5a6273]">
            Everything you need to know about setting up and running FlowBiz in your shop.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="border-b border-[#e8eaed] pb-4 transition-all">
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between gap-4 text-left font-bold text-[#15171d] text-sm sm:text-base py-2 hover:text-[#1a623c] transition-colors"
                >
                  <span>{faq.question}</span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-[#1a623c] shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#767f8f] shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <p className="text-xs sm:text-sm text-[#5a6273] leading-relaxed pt-2 pb-1">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
````

## File: src/components/landing/FeatureGrid.jsx
````javascript
import { 
  ShoppingCart, 
  BookOpen, 
  Lock, 
  WifiOff, 
  Smartphone, 
  Printer, 
  Boxes, 
  Users, 
  TrendingUp, 
  ShieldCheck, 
  RotateCcw,
  Truck
} from 'lucide-react';

export function FeatureGrid() {
  const features = [
    {
      icon: ShoppingCart,
      category: 'Point of Sale',
      title: 'Multi-Product POS Counter',
      description: 'Rapid product grid selection, multi-item active cart, barcode scanning, and custom on-the-fly bargaining prices.',
    },
    {
      icon: BookOpen,
      category: 'Credit Control',
      title: 'Cash-Flow Credit (Deni) Ledger',
      description: 'Profit is recognized only as debt is repaid. Eliminates false profit illusions before customer payments reach your hands.',
    },
    {
      icon: Lock,
      category: 'Shift Auditing',
      title: 'End-of-Day Till Reconciliation',
      description: 'Opening float tracking, automated expected cash and M-Pesa balances, and instant shortage or surplus variance detection.',
    },
    {
      icon: WifiOff,
      category: 'Resilience',
      title: '100% Offline-First Execution',
      description: 'Never pause checkout during internet outages. Local storage queues transactions and syncs automatically when reconnected.',
    },
    {
      icon: Smartphone,
      category: 'Communication',
      title: 'One-Tap WhatsApp Sharing',
      description: 'Send itemized receipts, invoices, and debt reminders with secure public links without monthly SMS or API costs.',
    },
    {
      icon: Printer,
      category: 'Hardware',
      title: 'Thermal & PDF Documents',
      description: 'Native 58mm & 80mm thermal receipt printing, custom business logo embedding, and downloadable A4 financial reports.',
    },
    {
      icon: Boxes,
      category: 'Inventory',
      title: 'Stock Intelligence & Restock Alerts',
      description: 'Wholesale inventory valuation, ABC value classification, 14-day stockout prediction, and slow-moving dead stock alerts.',
    },
    {
      icon: RotateCcw,
      category: 'Audit',
      title: 'Stock Take Discrepancy Audits',
      description: 'Periodic physical hand-count verification to audit stock differences, damage, shrinkage, and expiration reasons.',
    },
    {
      icon: Users,
      category: 'Access Control',
      title: 'Owner & Cashier Roles',
      description: 'Granular permissions that protect financial margins from staff, plus one-tap remote device sign-out for lost phones.',
    },
    {
      icon: Truck,
      category: 'Restocking',
      title: 'Supplier Balance & Purchase Orders',
      description: 'Record incoming supplier shipments on credit or cash, automatically updating stock levels and supplier payables.',
    },
    {
      icon: TrendingUp,
      category: 'Intelligence',
      title: 'Institutional Analytics',
      description: 'Compare performance periods, track revenue by staff member, and identify peak sales volume by day of the week.',
    },
{
  icon: ShieldCheck,
  category: 'Security',
  title: 'Secure Business Accounts',
  description: 'Built with secure authentication and strict multi-tenant data isolation, keeping each business account and its data securely separated.',
},
  ];

return (
  <section id="features" className="py-16 md:py-24 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#15171d] tracking-tight">
          Everything you need to run your business
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10 pt-4">
        {features.map((feat, index) => {
          const Icon = feat.icon;

          return (
            <div
              key={index}
              className="space-y-3 pb-4 border-b border-[#e8eaed] sm:border-b-0"
            >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg 	bg-white text-[#1a623c] flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a623c]">
                    {feat.category}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#15171d]">
                  {feat.title}
                </h3>
                <p className="text-xs text-[#5a6273] leading-relaxed">
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
````

## File: src/components/landing/PosSimulationMockup.jsx
````javascript
import { useState, useMemo } from 'react';
import { 
  ShoppingCart, 
  LayoutDashboard, 
  Users, 
  Boxes, 
  Lock, 
  Banknote, 
  Smartphone, 
  BookOpen, 
  Plus, 
  Minus, 
  CheckCircle2, 
  ScanLine, 
  Printer, 
  X,
  Wifi,
  MessageCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  ArrowUpRight,
  TrendingUp,
  Percent
} from 'lucide-react';

const INITIAL_PRODUCTS = [
  { id: '1', name: 'Wireless Mouse 2.4G', category: 'Electronics', price: 950, cost: 650, stock: 38, barcode: '600101' },
  { id: '2', name: 'USB Flash Disk 32GB', category: 'Accessories', price: 599, cost: 350, stock: 54, barcode: '600102' },
  { id: '3', name: 'USB-C Fast Charger 20W', category: 'Power', price: 899, cost: 550, stock: 4, barcode: '600103' },
  { id: '4', name: 'HDMI Cable 1.5m Gold', category: 'Cables', price: 449, cost: 250, stock: 26, barcode: '600104' },
  { id: '5', name: 'Bluetooth Earbuds Bass', category: 'Audio', price: 1899, cost: 1200, stock: 19, barcode: '600105' },
  { id: '6', name: 'Laptop Cooling Stand', category: 'Accessories', price: 1450, cost: 900, stock: 12, barcode: '600106' },
  { id: '7', name: 'Original iPhone Cable', category: 'Cables', price: 750, cost: 400, stock: 3, barcode: '600107' },
  { id: '8', name: 'Extension Socket 4-Way', category: 'Power', price: 1200, cost: 750, stock: 15, barcode: '600108' },
];

const INITIAL_DEBTORS = [
  { id: 'd1', name: 'John Kamau', phone: '+254 722 000 111', location: 'Westlands', balance: 4500, invoice: 'FB-042', item: '2x External HDD', overdueDays: 3 },
  { id: 'd2', name: 'Grace Wanjiku', phone: '+254 711 333 444', location: 'CBD City Market', balance: 1800, invoice: 'FB-051', item: '1x Bluetooth Speaker', overdueDays: 0 },
  { id: 'd3', name: 'David Ochieng', phone: '+254 733 999 888', location: 'Industrial Area', balance: 7200, invoice: 'FB-038', item: '3x Fast Charger Hubs', overdueDays: 12 },
];

export function PosSimulationMockup() {
  const [activeTab, setActiveTab] = useState('counter');
  
  // Products & Inventory State
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // POS Counter Cart State
  const [cart, setCart] = useState([
    { product: INITIAL_PRODUCTS[0], quantity: 2, unitPrice: 950 },
    { product: INITIAL_PRODUCTS[1], quantity: 1, unitPrice: 599 },
  ]);
  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  const [mpesaCode, setMpesaCode] = useState('QWE89412KL');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customerName, setCustomerName] = useState('Peter Mwangi');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState(null);

  // Debtors State
  const [debtors, setDebtors] = useState(INITIAL_DEBTORS);
  const [repayModal, setRepayModal] = useState(null);
  const [repayAmount, setRepayAmount] = useState(1000);
  const [toastMsg, setToastMsg] = useState('');

  // Dashboard Range
  const [timeRange, setTimeRange] = useState('Today');

  // Streamlined Till Reconciliation State (Single inputs)
  const [actualCash, setActualCash] = useState(18500);
  const [actualMpesa, setActualMpesa] = useState(24350);

  const categories = ['All', 'Electronics', 'Accessories', 'Power', 'Cables', 'Audio'];

  // Filtered product catalog
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart actions
  const addItem = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: product.price }];
    });
  };

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const updateUnitPrice = (id, newPrice) => {
    const val = Number(newPrice);
    if (isNaN(val) || val < 0) return;
    setCart((prev) =>
      prev.map((item) => (item.product.id === id ? { ...item, unitPrice: val } : item))
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const totalAmount = subtotal - discountAmount;
  const totalCost = cart.reduce((sum, item) => sum + item.quantity * item.product.cost, 0);
  const estimatedProfit = totalAmount - totalCost;

  const showNotification = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Complete Sale
  const handleCompleteSale = () => {
    const saleData = {
      items: [...cart],
      total: totalAmount,
      method: paymentMethod,
      mpesaCode: paymentMethod === 'M-Pesa' ? mpesaCode : null,
      customer: customerName,
      profit: estimatedProfit,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      invoiceNo: `FB-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    // Deduct inventory
    setProducts((prev) =>
      prev.map((prod) => {
        const cartItem = cart.find((i) => i.product.id === prod.id);
        if (cartItem) {
          return { ...prod, stock: Math.max(0, prod.stock - cartItem.quantity) };
        }
        return prod;
      })
    );

    setLastCompletedSale(saleData);
    setShowReceiptModal(true);
    setCart([]);
  };

  // Restock action in inventory
  const handleRestock = (id, amount = 10) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock: p.stock + amount } : p))
    );
    showNotification(`Restocked +${amount} units successfully`);
  };

  // Debtor repayment
  const handleRecordPayment = () => {
    if (!repayModal) return;
    setDebtors((prev) =>
      prev.map((d) => {
        if (d.id === repayModal.id) {
          const newBal = Math.max(0, d.balance - repayAmount);
          return { ...d, balance: newBal };
        }
        return d;
      })
    );
    showNotification(`Received KES ${repayAmount.toLocaleString()} from ${repayModal.name}`);
    setRepayModal(null);
  };

  // Expected balances
  const expectedCashBalance = 18500;
  const expectedMpesaBalance = 24350;
  const cashVariance = Number(actualCash || 0) - expectedCashBalance;
  const mpesaVariance = Number(actualMpesa || 0) - expectedMpesaBalance;
  const totalVariance = cashVariance + mpesaVariance;

  return (
    <div className="relative mx-auto max-w-5xl text-left">
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-[#1a623c] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="rounded-3xl border border-[#cfd3da] bg-white shadow-xl overflow-hidden flex flex-col">
        
        {/* Top Header Simulation Bar */}
        <div className="bg-[#15171d] text-white px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs font-medium border-b border-[#2b303c] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#1a623c] animate-pulse" />
            <span className="font-bold text-white tracking-wide">FlowBiz Workstation</span>
            <span className="text-[#767f8f] hidden sm:inline">| Main Counter (Shop 01)</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#cfd3da]">
            <span className="flex items-center gap-1">
              <Wifi className="h-3.5 w-3.5 text-[#1a623c]" /> Offline Mode Active
            </span>
            <span className="hidden sm:inline bg-[#2b303c] px-2 py-0.5 rounded text-white font-mono text-[10px]">
              KES Currency
            </span>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="min-h-[500px] bg-[#faf6ef] flex flex-col">
          
          {/* TAB 1: POS COUNTER */}
          {activeTab === 'counter' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#e8eaed] flex-1">
              
              {/* Left Column: Product Catalog */}
              <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col space-y-3">
                
                {/* Search Bar & Category Filter */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-[#767f8f]" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search product or scan barcode (e.g. 600101)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-[#cfd3da] rounded-xl pl-9 pr-8 py-2 text-xs text-[#15171d] placeholder:text-[#8d95a5] focus:border-[#1a623c] focus:outline-hidden shadow-2xs"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#767f8f] hover:text-[#15171d]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 bg-white border border-[#cfd3da] rounded-xl px-3 py-2 text-xs font-semibold text-[#1a623c] shadow-2xs">
                      <ScanLine className="h-3.5 w-3.5" />
                      <span>Scanner</span>
                    </div>
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                          selectedCategory === cat
                            ? 'bg-[#1a623c] text-white shadow-xs'
                            : 'bg-white border border-[#cfd3da] text-[#5a6273] hover:text-[#15171d]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Cards Grid with Fixed Badge Alignment */}
                <div className="flex-1 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pb-2">
                    {filteredProducts.map((prod) => {
                      const inCart = cart.find((i) => i.product.id === prod.id);
                      const isLow = prod.stock <= 5;
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => addItem(prod)}
                          className={`relative text-left p-3 rounded-2xl border transition-all flex flex-col justify-between h-32 ${
                            inCart
                              ? 'border-[#1a623c] bg-[#f1faf4] ring-1 ring-[#1a623c] shadow-xs'
                              : 'border-[#cfd3da] bg-white hover:border-[#1a623c] hover:bg-[#fbf7f2]'
                          }`}
                        >
                          {/* Inside Top Right Quantity Badge (Never Half Clipped) */}
                          {inCart && (
                            <div className="absolute top-2 right-2 min-w-5 h-5 px-1.5 rounded-full bg-[#1a623c] text-white text-[11px] font-black flex items-center justify-center shadow-xs">
                              {inCart.quantity}
                            </div>
                          )}

                          <div>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-[#767f8f] uppercase mb-1">
                              <span className="truncate max-w-[70px]">{prod.category}</span>
                              <span className="font-mono text-[9px] bg-[#faf6ef] px-1 rounded">{prod.barcode}</span>
                            </div>
                            <span className="text-xs font-bold text-[#15171d] block line-clamp-2 leading-snug pr-4">
                              {prod.name}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-[#e8eaed]">
                            <span className="text-xs font-black text-[#1a623c]">
                              KES {prod.price.toLocaleString()}
                            </span>
                            <span className={`text-[10px] font-semibold ${isLow ? 'text-[#c4441d] bg-[#fdf4ef] px-1 rounded' : 'text-[#767f8f]'}`}>
                              {isLow ? `Low (${prod.stock})` : `${prod.stock} left`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {filteredProducts.length === 0 && (
                    <div className="py-12 text-center text-xs text-[#767f8f]">
                      No products found matching &ldquo;{searchQuery}&rdquo;.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Cart & Direct Sale Controls */}
              <div className="lg:col-span-5 bg-white p-4 sm:p-5 flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  
                  {/* Cart Header */}
                  <div className="flex items-center justify-between border-b border-[#e8eaed] pb-2">
                    <div className="flex items-center gap-1.5">
                      <ShoppingCart className="h-4 w-4 text-[#1a623c]" />
                      <span className="text-xs sm:text-sm font-bold text-[#15171d]">
                        Current Sale ({cart.length} items)
                      </span>
                    </div>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCart([])}
                        className="text-[11px] font-semibold text-[#c4441d] hover:underline"
                      >
                        Clear Cart
                      </button>
                    )}
                  </div>

                  {/* Cart Item Rows */}
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {cart.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#767f8f] bg-[#faf6ef] rounded-xl border border-dashed border-[#cfd3da]">
                        Cart is empty. Tap products on the left to add.
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div
                          key={item.product.id}
                          className="p-2 rounded-xl border border-[#e8eaed] bg-[#faf6ef] space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-[#15171d]">
                            <span className="truncate pr-1">{item.product.name}</span>
                            <span className="text-[#1a623c] font-bold shrink-0">
                              KES {(item.quantity * item.unitPrice).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs gap-2">
                            {/* Quantity Adjuster */}
                            <div className="flex items-center gap-1 bg-white border border-[#cfd3da] rounded-lg px-1.5 py-0.5 shrink-0">
                              <button type="button" onClick={() => updateQty(item.product.id, -1)} aria-label="Decrease">
                                <Minus className="h-3 w-3 text-[#5a6273]" />
                              </button>
                              <span className="font-bold text-[#15171d] px-1 text-xs">{item.quantity}</span>
                              <button type="button" onClick={() => updateQty(item.product.id, 1)} aria-label="Increase">
                                <Plus className="h-3 w-3 text-[#5a6273]" />
                              </button>
                            </div>

                            {/* Editable Unit Price */}
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="text-[#767f8f]">@ KES</span>
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => updateUnitPrice(item.product.id, e.target.value)}
                                className="w-16 bg-white border border-[#cfd3da] rounded px-1 py-0.5 text-xs font-bold text-[#15171d] text-right"
                                title="Edit unit price (Bargaining)"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Promo Discount Toggle */}
                  <div className="flex items-center justify-between pt-1 text-[11px] border-t border-[#e8eaed]">
                    <span className="text-[#767f8f] font-semibold flex items-center gap-1">
                      <Percent className="h-3 w-3 text-[#1a623c]" /> Discount:
                    </span>
                    <div className="flex gap-1">
                      {[0, 5, 10].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDiscountPercent(pct)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            discountPercent === pct
                              ? 'bg-[#1a623c] text-white border-[#1a623c]'
                              : 'bg-[#faf6ef] border-[#cfd3da] text-[#5a6273]'
                          }`}
                        >
                          {pct === 0 ? 'None' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#767f8f] block">
                      Tender Payment Method
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Cash')}
                        className={`py-1.5 px-1 text-xs font-bold rounded-xl border flex flex-col items-center gap-0.5 transition-all ${
                          paymentMethod === 'Cash'
                            ? 'border-[#1a623c] bg-[#f1faf4] text-[#1a623c] shadow-2xs'
                            : 'border-[#cfd3da] text-[#5a6273]'
                        }`}
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        <span>Cash</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('M-Pesa')}
                        className={`py-1.5 px-1 text-xs font-bold rounded-xl border flex flex-col items-center gap-0.5 transition-all ${
                          paymentMethod === 'M-Pesa'
                            ? 'border-[#1a623c] bg-[#f1faf4] text-[#1a623c] shadow-2xs'
                            : 'border-[#cfd3da] text-[#5a6273]'
                        }`}
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        <span>M-Pesa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Credit')}
                        className={`py-1.5 px-1 text-xs font-bold rounded-xl border flex flex-col items-center gap-0.5 transition-all ${
                          paymentMethod === 'Credit'
                            ? 'border-[#c4441d] bg-[#fdf4ef] text-[#c4441d] shadow-2xs'
                            : 'border-[#cfd3da] text-[#5a6273]'
                        }`}
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Deni</span>
                      </button>
                    </div>
                  </div>

                  {paymentMethod === 'M-Pesa' && (
                    <div className="bg-[#f1faf4] border border-[#bbe6c9] rounded-xl p-2 space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-[#1a623c]">
                        <span>M-Pesa Till Code</span>
                        <button
                          type="button"
                          onClick={() => setMpesaCode(`QWE${Math.floor(10000 + Math.random() * 90000)}`)}
                          className="hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="h-2.5 w-2.5" /> Gen New
                        </button>
                      </div>
                      <input
                        type="text"
                        value={mpesaCode}
                        onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                        className="w-full bg-white border border-[#bbe6c9] rounded-lg px-2.5 py-1 text-xs font-mono font-bold uppercase text-[#15171d]"
                      />
                    </div>
                  )}

                  {paymentMethod === 'Credit' && (
                    <div className="bg-[#fdf4ef] border border-[#f6c8ae] rounded-xl p-2 space-y-1">
                      <label className="text-[10px] font-bold uppercase text-[#c4441d] block">
                        Customer Ledger Account (Deni)
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-white border border-[#f6c8ae] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#15171d]"
                      />
                    </div>
                  )}
                </div>

                {/* Total & Complete Sale Button */}
                <div className="pt-2 border-t border-[#e8eaed] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-[#767f8f] block">Amount Payable</span>
                      <span className="text-[10px] text-[#1a623c] font-bold">
                        Profit Margin: +KES {estimatedProfit.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xl font-black text-[#1a623c]">
                      KES {totalAmount.toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={handleCompleteSale}
                    className="w-full bg-[#1a623c] text-white py-2.5 rounded-xl font-bold hover:bg-[#144f30] transition-all disabled:opacity-50 shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>Complete Sale ({paymentMethod})</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e8eaed] pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#15171d]">Operational Store Intelligence</h4>
                  <p className="text-xs text-[#767f8f]">Audited financial stats and cashier velocity</p>
                </div>
                {/* Time Range Toggle */}
                <div className="flex gap-1 bg-white border border-[#cfd3da] p-0.5 rounded-xl">
                  {['Today', 'This Week', 'This Month'].map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        timeRange === range
                          ? 'bg-[#1a623c] text-white'
                          : 'text-[#5a6273] hover:text-[#15171d]'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-[#e8eaed] space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[#767f8f] block">Gross Revenue</span>
                  <p className="text-lg font-black text-[#15171d]">
                    {timeRange === 'Today' ? 'KES 42,850.00' : timeRange === 'This Week' ? 'KES 284,500.00' : 'KES 1,142,000.00'}
                  </p>
                  <span className="text-[10px] text-[#1a623c] font-bold flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" /> +18.4% growth
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#e8eaed] space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[#767f8f] block">Realized Profit</span>
                  <p className="text-lg font-black text-[#1a623c]">
                    {timeRange === 'Today' ? 'KES 14,200.00' : timeRange === 'This Week' ? 'KES 98,300.00' : 'KES 392,000.00'}
                  </p>
                  <span className="text-[10px] text-[#767f8f]">Margin: 33.1% clean</span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#e8eaed] space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[#767f8f] block">Debt Recovered</span>
                  <p className="text-lg font-black text-[#363b48]">
                    {timeRange === 'Today' ? 'KES 6,500.00' : timeRange === 'This Week' ? 'KES 38,200.00' : 'KES 145,000.00'}
                  </p>
                  <span className="text-[10px] text-[#1a623c] font-bold">100% Cash flow reconciled</span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#e8eaed] space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[#767f8f] block">M-Pesa vs Cash</span>
                  <p className="text-lg font-black text-[#15171d]">76% M-Pesa</p>
                  <span className="text-[10px] text-[#767f8f]">24% Cash in drawer</span>
                </div>
              </div>

              {/* Cashier Performance */}
              <div className="bg-white p-4 rounded-2xl border border-[#e8eaed] space-y-2.5">
                <span className="text-xs font-bold text-[#15171d] block">Cashier Performance Today</span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#faf6ef]">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#1a623c] text-white flex items-center justify-center font-bold text-[10px]">
                        1
                      </div>
                      <span className="font-bold text-[#15171d]">Sarah M. (Counter 1)</span>
                    </div>
                    <span className="font-extrabold text-[#1a623c]">KES 28,450 (31 sales)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#faf6ef]">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#767f8f] text-white flex items-center justify-center font-bold text-[10px]">
                        2
                      </div>
                      <span className="font-bold text-[#15171d]">Brian K. (Counter 2)</span>
                    </div>
                    <span className="font-bold text-[#5a6273]">KES 14,400 (18 sales)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMERS & DEBT */}
          {activeTab === 'customers' && (
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between border-b border-[#e8eaed] pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#15171d]">Customer Debt (Deni) Ledger</h4>
                  <p className="text-xs text-[#767f8f]">Track credit balances, WhatsApp reminders, and real repayments</p>
                </div>
                <span className="text-xs font-bold text-[#c4441d] bg-[#fdf4ef] px-3 py-1 rounded-xl border border-[#f6c8ae]">
                  Total Outstanding: KES {debtors.reduce((s, d) => s + d.balance, 0).toLocaleString()}
                </span>
              </div>

              {/* Debtors List */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {debtors.map((debtor) => (
                  <div key={debtor.id} className="bg-white p-3.5 rounded-2xl border border-[#e8eaed] space-y-2.5 shadow-2xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#15171d]">{debtor.name}</p>
                        <p className="text-[10px] text-[#767f8f]">{debtor.phone}</p>
                      </div>
                      <span className="bg-[#fdf4ef] text-[#c4441d] border border-[#f6c8ae] text-[10px] font-bold px-2 py-0.5 rounded">
                        Owes KES {debtor.balance.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-[#faf6ef] p-2 rounded-lg text-[11px] space-y-0.5">
                      <div className="flex justify-between text-[#5a6273]">
                        <span>Invoice #{debtor.invoice}:</span>
                        <span className="font-semibold">{debtor.item}</span>
                      </div>
                      <div className="text-[10px] text-[#c4441d] font-semibold">
                        {debtor.overdueDays > 0 ? `${debtor.overdueDays} days overdue` : 'Due today'}
                      </div>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRepayModal(debtor);
                          setRepayAmount(Math.min(1000, debtor.balance));
                        }}
                        disabled={debtor.balance === 0}
                        className="flex-1 text-center py-1.5 border border-[#cfd3da] rounded-lg text-xs font-bold text-[#1a623c] hover:bg-[#f1faf4] disabled:opacity-40"
                      >
                        Record Pay
                      </button>
                      <button
                        type="button"
                        onClick={() => showNotification(`Copied WhatsApp statement for ${debtor.name}`)}
                        className="flex-1 bg-[#1a623c] text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#144f30]"
                      >
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: INVENTORY */}
          {activeTab === 'inventory' && (
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between border-b border-[#e8eaed] pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#15171d]">Inventory Intelligence &amp; Stock Velocity</h4>
                  <p className="text-xs text-[#767f8f]">Interactive ABC valuation and one-tap restock simulations</p>
                </div>
                <span className="text-xs font-bold text-[#15171d] bg-white px-3 py-1 rounded-xl border border-[#cfd3da]">
                  Total Units: {products.reduce((s, p) => s + p.stock, 0)}
                </span>
              </div>

              {/* Actionable Alerts */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#15171d] block">Stockout Velocity Alerts</span>
                {products
                  .filter((p) => p.stock <= 5)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#fdf4ef] border border-[#f6c8ae] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-[#c4441d] shrink-0" />
                        <div>
                          <p className="font-bold text-[#6a261b]">{p.name}</p>
                          <p className="text-[10px] text-[#822b1c]">
                            Only {p.stock} left in stock · Runout in ~2 days
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestock(p.id, 15)}
                        className="bg-[#c4441d] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#a63614] transition-colors"
                      >
                        + Restock 15
                      </button>
                    </div>
                  ))}
              </div>

              {/* Product Stock Table */}
              <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
                <div className="p-3 border-b border-[#e8eaed] flex justify-between items-center text-xs font-bold text-[#15171d]">
                  <span>Product Catalog Valuation</span>
                  <span className="text-[#767f8f] font-normal">Tap &lsquo;+10&rsquo; to test restock velocity</span>
                </div>
                <div className="divide-y divide-[#e8eaed] max-h-48 overflow-y-auto">
                  {products.map((p) => (
                    <div key={p.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-[#15171d]">{p.name}</p>
                        <p className="text-[10px] text-[#767f8f]">Cost: KES {p.cost} · Retail: KES {p.price}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${p.stock <= 5 ? 'text-[#c4441d]' : 'text-[#1a623c]'}`}>
                          {p.stock} units
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRestock(p.id, 10)}
                          className="bg-[#faf6ef] border border-[#cfd3da] hover:border-[#1a623c] px-2 py-1 rounded text-[11px] font-bold text-[#15171d]"
                        >
                          +10
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: STREAMLINED CLOSE DAY (SINGLE CASH & MPESA BALANCE INPUTS) */}
          {activeTab === 'closeday' && (
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between border-b border-[#e8eaed] pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#15171d]">End-of-Day Shift Reconciliation</h4>
                  <p className="text-xs text-[#767f8f]">Enter closing cash and M-Pesa balance to audit shift variance</p>
                </div>
                <span className="text-xs font-bold text-[#1a623c] bg-[#f1faf4] px-3 py-1 rounded-xl border border-[#bbe6c9]">
                  Shift #429 Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Expected System Balances */}
                <div className="bg-white p-4 rounded-2xl border border-[#e8eaed] space-y-2.5 text-xs">
                  <span className="font-bold text-[#15171d] text-sm block">System Calculated Figures</span>
                  <div className="flex justify-between text-[#5a6273]">
                    <span>Morning Cash Float:</span>
                    <span>KES 2,000.00</span>
                  </div>
                  <div className="flex justify-between text-[#5a6273]">
                    <span>+ Cash Sales &amp; Debt Pay:</span>
                    <span>+KES 17,350.00</span>
                  </div>
                  <div className="flex justify-between text-[#c4441d]">
                    <span>− Shop Expenses:</span>
                    <span>−KES 850.00</span>
                  </div>
                  <div className="pt-2 border-t border-[#e8eaed] flex justify-between font-bold text-xs text-[#15171d]">
                    <span>Expected Drawer Cash:</span>
                    <span className="text-[#1a623c]">KES {expectedCashBalance.toLocaleString()}.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs text-[#15171d]">
                    <span>Expected M-Pesa Till:</span>
                    <span className="text-[#1a623c]">KES {expectedMpesaBalance.toLocaleString()}.00</span>
                  </div>
                </div>

                {/* Single Cash and M-Pesa Inputs */}
                <div className="bg-white p-4 rounded-2xl border border-[#e8eaed] space-y-3">
                  <span className="font-bold text-[#15171d] text-xs block">Actual Counted Balances</span>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-bold text-[#5a6273] block mb-1">
                        Actual Physical Cash in Drawer (KES)
                      </label>
                      <input
                        type="number"
                        value={actualCash}
                        onChange={(e) => setActualCash(Number(e.target.value))}
                        className="w-full bg-[#faf6ef] border border-[#cfd3da] rounded-xl px-3 py-2 text-sm font-bold text-[#15171d]"
                        placeholder="e.g. 18500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#5a6273] block mb-1">
                        Actual M-Pesa Till Closing Balance (KES)
                      </label>
                      <input
                        type="number"
                        value={actualMpesa}
                        onChange={(e) => setActualMpesa(Number(e.target.value))}
                        className="w-full bg-[#faf6ef] border border-[#cfd3da] rounded-xl px-3 py-2 text-sm font-bold text-[#15171d]"
                        placeholder="e.g. 24350"
                      />
                    </div>
                  </div>

                  {/* Live Variance Status */}
                  <div
                    className={`p-2.5 rounded-xl flex items-center justify-between text-xs font-bold ${
                      totalVariance === 0
                        ? 'bg-[#f1faf4] border border-[#bbe6c9] text-[#1a623c]'
                        : 'bg-[#fdf4ef] border border-[#f6c8ae] text-[#c4441d]'
                    }`}
                  >
                    <span>Total Variance: KES {totalVariance.toLocaleString()}</span>
                    <span>{totalVariance === 0 ? '✓ Balanced (Zero Loss)' : totalVariance > 0 ? 'Surplus' : 'Shortage'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      showNotification('Shift #429 closed and reconciled successfully!')
                    }
                    className="w-full bg-[#1a623c] text-white py-2 rounded-xl text-xs font-bold hover:bg-[#144f30]"
                  >
                    Lock &amp; Reconcile Shift
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Authentic In-App Bottom Navigation Bar */}
        <div className="bg-white border-t border-[#e8eaed] px-2 sm:px-6 py-2 shrink-0">
          <div className="grid grid-cols-5 gap-1 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => setActiveTab('counter')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                activeTab === 'counter'
                  ? 'bg-[#f1faf4] text-[#1a623c] font-bold'
                  : 'text-[#5a6273] hover:text-[#15171d]'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="text-[10px] truncate">Counter</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-[#f1faf4] text-[#1a623c] font-bold'
                  : 'text-[#5a6273] hover:text-[#15171d]'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="text-[10px] truncate">Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                activeTab === 'customers'
                  ? 'bg-[#f1faf4] text-[#1a623c] font-bold'
                  : 'text-[#5a6273] hover:text-[#15171d]'
              }`}
            >
              <Users className="h-4 w-4" />
              <span className="text-[10px] truncate">Deni (Credit)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                activeTab === 'inventory'
                  ? 'bg-[#f1faf4] text-[#1a623c] font-bold'
                  : 'text-[#5a6273] hover:text-[#15171d]'
              }`}
            >
              <Boxes className="h-4 w-4" />
              <span className="text-[10px] truncate">Inventory</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('closeday')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                activeTab === 'closeday'
                  ? 'bg-[#f1faf4] text-[#1a623c] font-bold'
                  : 'text-[#5a6273] hover:text-[#15171d]'
              }`}
            >
              <Lock className="h-4 w-4" />
              <span className="text-[10px] truncate">Close Day</span>
            </button>
          </div>
        </div>

      </div>

      {/* Record Repayment Modal */}
      {repayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 border border-[#e8eaed] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e8eaed] pb-2">
              <span className="font-bold text-sm text-[#15171d]">Record Repayment: {repayModal.name}</span>
              <button type="button" onClick={() => setRepayModal(null)}>
                <X className="h-4 w-4 text-[#767f8f]" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[#767f8f]">
                <span>Current Total Debt:</span>
                <span className="font-bold text-[#c4441d]">KES {repayModal.balance.toLocaleString()}</span>
              </div>
              <label className="text-[11px] font-bold text-[#15171d] block">
                Amount Received (KES)
              </label>
              <input
                type="number"
                value={repayAmount}
                onChange={(e) => setRepayAmount(Number(e.target.value))}
                className="w-full bg-[#faf6ef] border border-[#cfd3da] rounded-xl px-3 py-2 text-sm font-bold text-[#15171d]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRepayModal(null)}
                className="flex-1 border border-[#cfd3da] py-2 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                className="flex-1 bg-[#1a623c] text-white py-2 rounded-xl text-xs font-bold"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Modal */}
      {showReceiptModal && lastCompletedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xs w-full p-5 border border-[#e8eaed] shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#e8eaed] pb-2">
              <div className="flex items-center gap-1.5 text-[#1a623c]">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-bold text-xs text-[#15171d]">Sale Completed</span>
              </div>
              <button type="button" onClick={() => setShowReceiptModal(false)}>
                <X className="h-4 w-4 text-[#767f8f]" />
              </button>
            </div>

            {/* 58mm Receipt Render */}
            <div className="bg-[#faf6ef] p-3 rounded-xl border border-[#e8eaed] font-mono text-[11px] space-y-2 text-[#15171d]">
              <div className="text-center pb-1 border-b border-dashed border-[#cfd3da]">
                <div className="font-bold text-xs">FLOWBIZ STORE</div>
                <div className="text-[9px] text-[#767f8f]">Nairobi, Kenya · Tel: +254 700 000 000</div>
                <div className="text-[9px] text-[#767f8f]">Receipt #{lastCompletedSale.invoiceNo} · {lastCompletedSale.date}</div>
              </div>
              <div className="space-y-1 py-1">
                {lastCompletedSale.items.map((item) => (
                  <div key={item.product.id} className="flex justify-between">
                    <span className="truncate pr-1">{item.quantity}x {item.product.name.slice(0, 14)}</span>
                    <span className="font-bold shrink-0">KES {(item.quantity * item.unitPrice).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-[#cfd3da] pt-1.5 space-y-0.5">
                <div className="flex justify-between font-bold text-xs text-[#1a623c]">
                  <span>TOTAL PAID:</span>
                  <span>KES {lastCompletedSale.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] text-[#5a6273]">
                  <span>Payment Method:</span>
                  <span>{lastCompletedSale.method}</span>
                </div>
                {lastCompletedSale.mpesaCode && (
                  <div className="flex justify-between text-[10px] text-[#1a623c] font-mono">
                    <span>M-Pesa Ref:</span>
                    <span>{lastCompletedSale.mpesaCode}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  showNotification('Printing 58mm thermal receipt...');
                  setShowReceiptModal(false);
                }}
                className="flex-1 border border-[#cfd3da] py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#faf6ef]"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
              <button
                type="button"
                onClick={() => {
                  showNotification('Receipt sent to customer WhatsApp!');
                  setShowReceiptModal(false);
                }}
                className="flex-1 bg-[#1a623c] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#144f30]"
              >
                <Smartphone className="h-3.5 w-3.5" /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
````

## File: src/components/landing/PricingComparison.jsx
````javascript
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';

export function PricingComparison() {
  return (
    <section id="pricing" className="py-16 md:py-24 bg-[#faf6ef] border-t border-[#e8eaed]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#15171d] tracking-tight">
            Simple, upfront pricing
          </h2>
          <p className="text-sm sm:text-base text-[#5a6273]">
Start free with the essentials. Upgrade to FlowBiz Pro when your business needs more.          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Starter Plan */}
          <div className="bg-white rounded-2xl border border-[#cfd3da] p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-[#15171d]">FlowBiz Starter</h3>
                  <p className="text-xs text-[#767f8f] mt-0.5">
                    Essential store operations for solo shops and small dukas.
                  </p>
                </div>
                
              </div>

              <div className="pt-2">
                <span className="text-3xl font-extrabold text-[#15171d]">KES 0</span>
                
              </div>

              <ul className="space-y-2.5 pt-4 border-t border-[#e8eaed] text-xs text-[#363b48] font-medium">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Up to 100 active products in catalog</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>1 Business Owner + 1 Staff Cashier</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Multi-product POS Counter &amp; active cart</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Full Customer Credit (Deni) &amp; repayment ledger</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>End-of-day Till Float &amp; Shift Reconciliation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Standard 58mm &amp; 80mm PDF thermal receipts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>100% offline-first cached execution</span>
                </li>
              </ul>
            </div>

            <Link
              to="/setup"
              className="w-full py-3 text-center font-bold text-sm border border-[#cfd3da] rounded-xl hover:bg-[#faf6ef] transition-colors block text-[#15171d]"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="bg-white rounded-2xl border-2 border-[#1a623c] p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-md relative">
            <div className="absolute -top-3 right-6 bg-[#1a623c] text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide">
              Most Popular
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-[#15171d]">FlowBiz Pro</h3>
                  <p className="text-xs text-[#767f8f] mt-0.5">
                    Uncapped capacity, deep analytics, and WhatsApp customer communication.
                  </p>
                </div>
              
              </div>

              <div className="pt-2">
                <span className="text-3xl font-extrabold text-[#1a623c]">KES 599</span>
                <span className="text-xs text-[#767f8f] font-medium"> / 30 days prepaid</span>
                <p className="text-[11px] text-[#1a623c] font-semibold mt-0.5">
                  Manual M-Pesa / Card renewal · No auto-billing surprises
                </p>
              </div>

              <ul className="space-y-2.5 pt-4 border-t border-[#e8eaed] text-xs text-[#363b48] font-medium">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <strong className="text-[#15171d]">Unlimited products &amp; catalog items</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <strong className="text-[#15171d]">Unlimited staff cashier accounts</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>WhatsApp digital receipts &amp; debt reminder dispatch</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Advanced Analytics (profit margin trends, day-of-week volume)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Inventory Intelligence &amp; ABC Pareto stock prioritization</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>14-day stockout prediction &amp; restock quantity engine</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Staff performance ranking &amp; revenue attribution</span>
                </li>
              </ul>
            </div>

            <Link
              to="/setup"
              className="w-full py-3 text-center font-bold text-sm bg-[#1a623c] text-white rounded-xl hover:bg-[#144f30] transition-colors shadow-sm block"
            >
              Start Free &amp; Upgrade Later
              <ArrowRight className="h-4 w-4 ml-1 inline" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
````

## File: src/components/layout/navConfig.js
````javascript
export const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard', icon: 'LayoutDashboard', adminOnly: true  },
  { to: '/counter',    label: 'Counter',   icon: 'ShoppingCart',    adminOnly: false },
  { to: '/customers',  label: 'Customers', icon: 'Users',           adminOnly: false },
  { to: '/expenses',   label: 'Expenses',  icon: 'Receipt',         adminOnly: false },
  { to: '/purchases',  label: 'Purchases', icon: 'Truck',           adminOnly: true  },
  { to: '/products',   label: 'Products',  icon: 'Package',         adminOnly: true  },
  { to: '/suppliers',  label: 'Suppliers', icon: 'Tag',             adminOnly: true  },
  { to: '/stock-take', label: 'Stock Take',icon: 'ClipboardCheck',  adminOnly: true  },
  { to: '/reports',    label: 'Reports',   icon: 'BarChart3',       adminOnly: true  },
  { to: '/close-day',  label: 'Close Day', icon: 'Lock',            adminOnly: true  },
  { to: '/users',      label: 'Team',      icon: 'UsersRound',      adminOnly: true  },
  { to: '/settings',   label: 'Settings',  icon: 'Settings',        adminOnly: true  },
];
export const MOBILE_PRIMARY = {
  admin:   ['/', '/counter', '/customers', '/reports', '/settings'],
  cashier: ['/counter', '/customers', '/expenses'],
};
````

## File: src/components/pos/CartCheckoutModal.jsx
````javascript
// src/components/pos/CartCheckoutModal.jsx
//
// The payment step for a multi-product cart checkout — conceptually the
// same payment portion SaleModal already had, just applied once to the
// whole cart total instead of one product. Cash/M-Pesa/Credit logic is
// untouched; onConfirmSale/onConfirmCredit are provided by Counter.jsx
// and build the actual Firestore batch (one sale/creditSale doc with all
// cart lines as `items`, one stock decrement per line item).

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { formatKES } from '../../utils/currency';
import { Banknote, Smartphone, BookOpen } from 'lucide-react';
import { raceWithTimeout } from '../../utils/offlineWrite';
import { friendlyErrorMessage } from '../../utils/errorMessages';

const METHODS = [
  { id: 'Cash',   label: 'Cash',   Icon: Banknote   },
  { id: 'M-Pesa', label: 'M-Pesa', Icon: Smartphone },
  { id: 'Credit', label: 'Credit', Icon: BookOpen   },
];

export default function CartCheckoutModal({ open, cart, total, customers, onClose, onConfirmSale, onConfirmCredit, onCreateCustomer }) {
  const [method, setMethod]         = useState('Cash');
  const [mpesaCode, setMpesaCode]   = useState('');
  const [customerId, setCustomerId] = useState('');
  const [newMode, setNewMode]       = useState(false);
  const [newName, setNewName]       = useState('');
  const [newPhone, setNewPhone]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMethod('Cash'); setMpesaCode(''); setCustomerId('');
      setNewMode(false); setNewName(''); setNewPhone('');
    }
  }, [open]);

  if (!open || !cart || cart.length === 0) return null;

  const needsMpesaCode = method === 'M-Pesa' && !mpesaCode.trim();
  const needsCustomer  = method === 'Credit' && !customerId && !(newMode && newName.trim());
  const canSubmit = !needsMpesaCode && !needsCustomer && !submitting;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      let cId = customerId, cName = customers.find(c => c.id === customerId)?.name, cPhone = customers.find(c => c.id === customerId)?.phone;
      if (method === 'Credit' && newMode) {
        const cr = await onCreateCustomer({ name: newName.trim(), phone: newPhone.trim() });
        cId = cr.id; cName = cr.name; cPhone = cr.phone;
      }

      const { record, commit } = method === 'Credit'
        ? onConfirmCredit({ customerId: cId, customerName: cName, customerPhone: cPhone })
        : onConfirmSale({ paymentMethod: method, mpesaCode: method === 'M-Pesa' ? mpesaCode.trim() : null });

      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      if (queuedOffline) {
        toast.success("Sale saved — it'll sync once you're back online.");
        commit.catch((err) => toast.error(`A sale from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      }
      onClose(record);
    } catch (err) {
      toast.error(friendlyErrorMessage(err, {
        overrides: { 'permission-denied': "That didn't go through — stock may have just changed, or today's session may have been closed. Please refresh and try again." },
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose(null)} title="Complete Sale">
      <div className="space-y-4">
        <div className="rounded-lg bg-ink-50 px-3 py-2.5">
          <p className="text-xs text-ink-400 mb-1">{cart.length} product{cart.length !== 1 ? 's' : ''} in cart</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-700">Total</span>
            <span className="font-display text-lg font-bold text-ink-900">{formatKES(total)}</span>
          </div>
        </div>

        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => setMethod(id)} className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-semibold ${method === id ? 'border-moss-600 bg-moss-50 text-moss-800' : 'border-ink-200 text-ink-500'}`}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />{label}
              </button>
            ))}
          </div>
        </div>

        {method === 'M-Pesa' && (
          <div>
            <label className="label">M-Pesa transaction code <span className="text-rust-500">*</span></label>
            <input className="input uppercase" placeholder="e.g. QWE1234567" value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())} />
            {needsMpesaCode && <p className="mt-1 text-xs text-rust-600">Transaction code required for M-Pesa sales.</p>}
          </div>
        )}

        {method === 'Credit' && (
          <div className="space-y-2 rounded-lg border border-ink-100 p-3">
            {!newMode ? (
              <>
                <label className="label">Customer (Deni)</label>
                <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">— Select customer —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
                </select>
                <button type="button" className="text-xs font-semibold text-moss-700 hover:underline" onClick={() => setNewMode(true)}>+ New customer</button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between"><label className="label">New customer</label><button type="button" className="text-xs text-ink-400 hover:underline" onClick={() => setNewMode(false)}>Use existing</button></div>
                <input className="input" placeholder="Customer name" value={newName} onChange={e => setNewName(e.target.value)} />
                <input className="input" placeholder="Phone (07xx...)" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={() => onClose(null)} disabled={submitting}>Back to cart</button>
          <button type="button" className="btn-primary" disabled={!canSubmit} onClick={handleConfirm}>
            {submitting ? 'Recording…' : method === 'Credit' ? 'Record credit' : 'Complete sale'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
````

## File: src/components/scanner/ScanFab.jsx
````javascript
// src/components/scanner/ScanFab.jsx
import { ScanLine } from 'lucide-react';

export default function ScanFab({ onClick, label = 'Scan barcode' }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-moss-700 text-white shadow-xl hover:bg-moss-800 active:scale-95 lg:bottom-6 lg:right-6"
      aria-label={label}
      title={label}
    >
      <ScanLine className="h-6 w-6" strokeWidth={2} />
    </button>
  );
}
````

## File: src/constants/categories.js
````javascript
// FIX: Removed 'Stock Purchase' and 'Supplier Payment' to prevent manual double-entry
export const EXPENSE_CATEGORIES = ['Rent','Electricity','Transport','Wages','Airtime Float','Shop Supplies','Security','County Fees','Other'];
export const PAYMENT_METHODS = ['Cash','M-Pesa'];
````

## File: src/demo/demoMode.js
````javascript
// src/demo/demoMode.js
const FLAG_KEY = 'flowbiz_demo_mode';

export function isDemoMode() {
  try {
    return localStorage.getItem(FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export function enterDemoMode() {
  try {
    localStorage.setItem(FLAG_KEY, 'true');
  } catch { /* storage unavailable */ }
}

export function exitDemoMode() {
  try {
    localStorage.removeItem(FLAG_KEY);
  } catch { /* storage unavailable */ }
}
````

## File: src/demo/seedData.js
````javascript
// src/demo/seedData.js
import { seedDoc, seedCommit, clearAllDemoData, makeTimestamp } from './localFirestore';
import { DEMO_UID } from './localAuth';
import { todayKey } from '../utils/dateRanges';

export const DEMO_BUSINESS_ID = 'demo-business';

const SUPPLIERS = [
  {
    id: 'sup_nairobi_electronics',
    name: 'Nairobi Electronics Wholesale Ltd',
    contactPerson: 'Peter Mwangi',
    phone: '0722 445 108',
    email: 'sales@nairobielectronics.co.ke',
    address: 'River Road, Nairobi',
    notes: 'Main supplier for accessories and cables.',
  },
  {
    id: 'sup_techhub',
    name: 'TechHub Distributors Kenya',
    contactPerson: 'Grace Wanjiru',
    phone: '0733 219 764',
    email: 'orders@techhubke.com',
    address: 'Kimathi Street, Nairobi',
    notes: 'Supplies laptops, monitors, and peripherals.',
  },
];

const PRODUCTS = [
  { name: 'Wireless Mouse',            category: 'Electronics', costPrice: 650,   sellingPrice: 950,   stock: 40, lowStockThreshold: 8,  barcode: '6009880123451', supplierId: 'sup_nairobi_electronics' },
  { name: 'Mechanical Keyboard',       category: 'Electronics', costPrice: 2800,  sellingPrice: 3999,  stock: 15, lowStockThreshold: 5,  barcode: '6009880123452', supplierId: 'sup_techhub' },
  { name: 'USB Flash Disk 32GB',       category: 'Electronics', costPrice: 350,   sellingPrice: 599,   stock: 60, lowStockThreshold: 10, barcode: '6009880123453', supplierId: 'sup_nairobi_electronics' },
  { name: 'External Hard Drive 1TB',   category: 'Electronics', costPrice: 4200,  sellingPrice: 5499,  stock: 12, lowStockThreshold: 4,  barcode: '6009880123454', supplierId: 'sup_techhub' },
  { name: 'Power Bank 10000mAh',       category: 'Electronics', costPrice: 1100,  sellingPrice: 1699,  stock: 25, lowStockThreshold: 6,  barcode: '6009880123455', supplierId: 'sup_nairobi_electronics' },
  { name: 'USB-C Charger 20W',         category: 'Electronics', costPrice: 550,   sellingPrice: 899,   stock: 4,  lowStockThreshold: 8,  barcode: '6009880123456', supplierId: 'sup_nairobi_electronics' },
  { name: 'Phone Charger (Micro-USB)', category: 'Electronics', costPrice: 300,   sellingPrice: 549,   stock: 3,  lowStockThreshold: 8,  barcode: '6009880123457', supplierId: 'sup_nairobi_electronics' },
  { name: 'HDMI Cable 1.5m',           category: 'Electronics', costPrice: 250,   sellingPrice: 449,   stock: 30, lowStockThreshold: 6,  barcode: '6009880123458', supplierId: 'sup_nairobi_electronics' },
  { name: 'Monitor 24" LED',           category: 'Electronics', costPrice: 12500, sellingPrice: 15999, stock: 6,  lowStockThreshold: 3,  barcode: '6009880123459', supplierId: 'sup_techhub' },
  { name: 'Laptop Stand',              category: 'Electronics', costPrice: 900,   sellingPrice: 1450,  stock: 18, lowStockThreshold: 5,  barcode: '6009880123460', supplierId: 'sup_techhub' },
  { name: 'Bluetooth Speaker',         category: 'Electronics', costPrice: 1800,  sellingPrice: 2699,  stock: 2,  lowStockThreshold: 5,  barcode: '6009880123461', supplierId: 'sup_techhub' },
  { name: 'Earbuds (Wireless)',        category: 'Electronics', costPrice: 1200,  sellingPrice: 1899,  stock: 22, lowStockThreshold: 6,  barcode: '6009880123462', supplierId: 'sup_nairobi_electronics' },
  { name: 'Headphones (Over-ear)',     category: 'Electronics', costPrice: 2200,  sellingPrice: 3299,  stock: 10, lowStockThreshold: 4,  barcode: '6009880123463', supplierId: 'sup_techhub' },
  { name: 'Extension Cable (4-way)',   category: 'Electronics', costPrice: 700,   sellingPrice: 1099,  stock: 20, lowStockThreshold: 5,  barcode: '6009880123464', supplierId: 'sup_nairobi_electronics' },
  { name: 'Router (Wireless N)',       category: 'Electronics', costPrice: 2600,  sellingPrice: 3599,  stock: 9,  lowStockThreshold: 4,  barcode: '6009880123465', supplierId: 'sup_techhub' },
  { name: 'Smart Watch',               category: 'Electronics', costPrice: 3500,  sellingPrice: 4999,  stock: 7,  lowStockThreshold: 3,  barcode: '6009880123466', supplierId: 'sup_techhub' },
];

function buildAndSeed() {
  const now = makeTimestamp(Date.now());
  const touched = new Set();
  const today = todayKey();

  SUPPLIERS.forEach((s) => {
    const { id, ...data } = s;
    seedDoc('suppliers', id, { ...data, businessId: DEMO_BUSINESS_ID, createdAt: now });
    touched.add('suppliers');
  });

  PRODUCTS.forEach((p, i) => {
    const id = `demo_product_${i + 1}`;
    const internalCode = `FB-${String(i + 1).padStart(6, '0')}`;
    seedDoc('products', id, { ...p, businessId: DEMO_BUSINESS_ID, internalCode, deleted: false, createdAt: now, updatedAt: now });
    seedDoc('barcodeIndex', `${DEMO_BUSINESS_ID}__${p.barcode}`, { businessId: DEMO_BUSINESS_ID, barcode: p.barcode, productId: id });
    touched.add('products');
    touched.add('barcodeIndex');
  });
  seedDoc('productCodeCounters', DEMO_BUSINESS_ID, { businessId: DEMO_BUSINESS_ID, lastNumber: PRODUCTS.length });
  touched.add('productCodeCounters');

  seedDoc('businesses', DEMO_BUSINESS_ID, {
    name: 'FlowBiz Demo Store',
    ownerIds: [DEMO_UID],
    createdAt: now,
    createdBy: DEMO_UID,
    subscription: { plan: 'free', status: 'active', expiry: null },
  });
  touched.add('businesses');

  seedDoc('users', DEMO_UID, {
    uid: DEMO_UID, email: 'demo@flowbiz.app', displayName: 'Demo Owner',
    role: 'owner', businessId: DEMO_BUSINESS_ID, active: true, createdAt: now,
  });
  touched.add('users');

  seedDoc('businessSettings', DEMO_BUSINESS_ID, {
    shopName: 'FlowBiz Demo Store',
    cashierCanRecordExpenses: true,
    categories: ['Groceries', 'Beverages', 'Electronics', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other'],
  });
  touched.add('businessSettings');

  // Pre-seed an open shift session for today so Counter opens immediately
  seedDoc('dailySessions', `${DEMO_BUSINESS_ID}_${today}`, {
    businessId: DEMO_BUSINESS_ID,
    date: today,
    openingCashFloat: 2000,
    openingMpesaFloat: 5000,
    openedBy: DEMO_UID,
    openedAt: now,
    closedAt: null,
    closedBy: null,
  });
  touched.add('dailySessions');

  seedCommit([...touched]);
}

export function seedDemoDataIfNeeded() {
  const today = todayKey();
  const sessionDocId = `${DEMO_BUSINESS_ID}_${today}`;
  if (localStorage.getItem('flowbiz_demo_seeded_v3') === 'true') {
    // Ensure today's session is always open even across calendar days
    seedDoc('dailySessions', sessionDocId, {
      businessId: DEMO_BUSINESS_ID,
      date: today,
      openingCashFloat: 2000,
      openingMpesaFloat: 5000,
      openedBy: DEMO_UID,
      openedAt: makeTimestamp(Date.now()),
      closedAt: null,
      closedBy: null,
    });
    seedCommit(['dailySessions']);
    return;
  }
  buildAndSeed();
  localStorage.setItem('flowbiz_demo_seeded_v3', 'true');
}

export function resetDemoData() {
  clearAllDemoData();
  buildAndSeed();
  localStorage.setItem('flowbiz_demo_seeded_v3', 'true');
}
````

## File: src/hooks/useOnlineStatus.js
````javascript
import { useEffect, useState } from 'react';
export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}
````

## File: src/hooks/useSetupStatus.js
````javascript
import { useEffect, useState } from "react";
import {
  doc,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";

export function useSetupStatus() {

  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {

    const unsubscribe = onSnapshot(
      doc(db, "meta", "setup"),
      (snap) => {
        setSetupComplete(snap.exists());
        setLoading(false);
      },
      () => {
        setSetupComplete(false);
        setLoading(false);
      }
    );

    return unsubscribe;

  }, []);

  return {
    loading,
    setupComplete
  };

}
````

## File: src/lib/tenant.js
````javascript
// src/lib/tenant.js
//
// Multi-tenant helper. Every "business data" collection (sales, products,
// expenses, ...) stores a `businessId` field on every document, and every
// query MUST filter on it — otherwise you'd be reading every business's
// data mixed together in one list. These two helpers make that mistake
// hard to make: you cannot build a query or a write payload without
// passing a businessId in.
import { collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';

// Use this instead of `query(collection(db, name), ...)` for ANY
// collection that holds business-owned data.
export function tenantQuery(collectionName, businessId, ...constraints) {
  if (!businessId) {
    throw new Error(`tenantQuery('${collectionName}') called with no businessId — is the profile loaded yet?`);
  }
  return query(collection(db, collectionName), where('businessId', '==', businessId), ...constraints);
}

// Use this instead of `collection(db, name)` when you need the raw
// CollectionReference (e.g. to pass to addDoc/doc()).
export function tenantCollection(collectionName) {
  return collection(db, collectionName);
}

// Stamps businessId onto data you're about to write with addDoc/setDoc.
export function withBusiness(data, businessId) {
  if (!businessId) throw new Error('withBusiness() called with no businessId');
  return { ...data, businessId };
}
````

## File: src/router/routePrefetch.js
````javascript
const idle = typeof requestIdleCallback === 'function'
  ? requestIdleCallback
  : (fn) => setTimeout(fn, 200);

export function prefetchRoutes(loaders) {
  if (!navigator.onLine) return;
  // Respect Data Saver — never spend someone's mobile data on
  // speculative background fetches if they've asked sites not to.
  if (navigator.connection?.saveData) return;

  loaders.forEach((load, i) => {
    idle(() => { load().catch(() => {}); }, { timeout: 2000 + i * 500 });
  });
}
````

## File: src/utils/csvExport.js
````javascript
// HP-5: Sanitize CSV cells against formula injection attacks
function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Prefix formula-starting chars with a single quote to neutralise Excel/Sheets macros
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
export function exportToCSV(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => escapeCsvCell(r[h])).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.setAttribute('download', filename);
  document.body.appendChild(link); link.click();
  document.body.removeChild(link); URL.revokeObjectURL(url);
}
````

## File: src/utils/dateRanges.js
````javascript
// Africa/Nairobi is a fixed UTC+3 with no DST, so business-day boundaries
// can be computed with a constant offset instead of the device's own
// (potentially different) local timezone. This keeps "today" consistent
// with todayKey() below, which drives dailySessions doc IDs.
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

export function startOfDay(date = new Date()) {
  const nairobiMs = date.getTime() + NAIROBI_OFFSET_MS;
  const nairobiMidnightMs = Math.floor(nairobiMs / 86400000) * 86400000;
  return new Date(nairobiMidnightMs - NAIROBI_OFFSET_MS);
}
export function endOfDay(date = new Date()) {
  return new Date(startOfDay(date).getTime() + 86400000 - 1);
}
export function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  const nairobiDate = new Date(d.getTime() + NAIROBI_OFFSET_MS);
  const dayOfWeek = nairobiDate.getUTCDay();
  const diff = (dayOfWeek + 6) % 7;
  return new Date(d.getTime() - diff * 86400000);
}
export function startOfMonth(date = new Date()) {
  const nairobiMs = date.getTime() + NAIROBI_OFFSET_MS;
  const nairobiDate = new Date(nairobiMs);
  const firstOfMonthUTC = Date.UTC(nairobiDate.getUTCFullYear(), nairobiDate.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(firstOfMonthUTC - NAIROBI_OFFSET_MS);
}
export function getRangeForPreset(preset) {
  const now = new Date();
  switch (preset) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':  return { start: startOfWeek(now), end: endOfDay(now) };
    case 'month': return { start: startOfMonth(now), end: endOfDay(now) };
    default:      return { start: startOfDay(now), end: endOfDay(now) };
  }
}
export function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}
export function formatDateTime(value) {
  const d = toJsDate(value);
  if (!d) return '—';
  return d.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function formatDate(value) {
  const d = toJsDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short', year: 'numeric' });
}
export function todayKey(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = f.formatToParts(date);
  return `${p.find(x=>x.type==='year').value}-${p.find(x=>x.type==='month').value}-${p.find(x=>x.type==='day').value}`;
}

// ── Added for the Advanced Analytics redesign ──────────────────────────
// Nothing above this line changed. These two helpers are additive only.

// Converts a Firestore Timestamp, JS Date, or date-like value to millis —
// used to sort/bucket raw records (sales, expenses, repayments) by day.
export function toMillisValue(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// Splits [start, end] into consecutive day or week buckets with a short
// display label — used to build trend charts from raw record arrays
// without inventing any data the app doesn't already have.
export function buildDateBuckets(start, end, granularity = 'day') {
  const buckets = [];
  const stepMs = granularity === 'week' ? 7 * 86400000 : 86400000;
  let cursor = startOfDay(start);
  const endBoundary = endOfDay(end);
  while (cursor.getTime() <= endBoundary.getTime()) {
    const bucketEndMs = Math.min(cursor.getTime() + stepMs - 1, endBoundary.getTime());
    const bucketEnd = new Date(bucketEndMs);
    buckets.push({
      start: cursor,
      end: bucketEnd,
      label: cursor.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short' }),
    });
    cursor = new Date(cursor.getTime() + stepMs);
  }
  return buckets;
}
````

## File: src/utils/documentSharing.js
````javascript
// src/utils/documentSharing.js
//
// Creates (or reuses) a secure, opaque public link for a FlowBiz document
// — a sale receipt, a credit-sale invoice, or a debt payment receipt — so
// it can be dropped into a WhatsApp message and opened by a customer with
// NO FlowBiz login. The public page itself is served entirely by the
// Cloudflare Worker (cloudflare-worker/src/routes/publicDocument.js) —
// this file's only job is writing the tiny `sharedDocuments` record the
// Worker resolves the token against.
//
// The token (not any client-supplied ID) is what determines which
// document the public link opens. It's generated with the Web Crypto
// API — 192 bits of randomness, never a Firestore auto-ID and never
// derived from a business/customer/sale ID — and used directly as the
// sharedDocuments document ID, so there's exactly one lookup on the
// Worker side (see PHASE 5/7 of the spec this implements).

import { doc, setDoc, getDocs, where, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { tenantQuery, withBusiness } from '../lib/tenant';

const PUBLIC_DOC_BASE_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

const VALID_DOCUMENT_TYPES = ['receipt', 'invoice', 'debtPaymentReceipt'];

function generateToken() {
  const bytes = new Uint8Array(24); // 192 bits — well beyond guessable
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function buildPublicUrl(token) {
  return `${PUBLIC_DOC_BASE_URL}/r/${token}`;
}

// Reuses an existing share link for the same document instead of minting
// a new token every time a cashier clicks "Send via WhatsApp" (a cashier
// clicking it three times for the same receipt should produce one link,
// not three sharedDocuments records). No token expiry by design — a
// customer may reasonably want to reopen a financial receipt weeks later,
// and there's no product requirement forcing a shorter lifetime yet.
export async function getOrCreateShareLink({ businessId, documentType, documentId, createdBy }) {
  if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
    throw new Error(`Unknown document type: ${documentType}`);
  }
  if (!businessId || !documentId) {
    throw new Error('getOrCreateShareLink requires businessId and documentId.');
  }

  const existingQ = tenantQuery(
    'sharedDocuments', businessId,
    where('documentType', '==', documentType),
    where('documentId', '==', documentId),
    limit(1)
  );
  const existingSnap = await getDocs(existingQ);
  if (!existingSnap.empty) {
    return buildPublicUrl(existingSnap.docs[0].id);
  }

  const token = generateToken();
  await setDoc(doc(db, 'sharedDocuments', token), withBusiness({
    documentType,
    documentId,
    createdAt: serverTimestamp(),
    createdBy: createdBy || null,
  }, businessId));

  return buildPublicUrl(token);
}
````

## File: src/utils/errorMessages.js
````javascript
// Central place to turn raw Firebase/network error codes into copy a
// shop owner or cashier can actually act on. Never shows a raw
// "FirebaseError: ..." string or an internal code to the user — the
// original error is still logged to the console for debugging.
const MESSAGES = {
  'permission-denied': "You're not allowed to do that. If you think this is a mistake, check with your business owner.",
  'unauthenticated': 'Your session has expired. Please sign in again.',
  'unavailable': "Can't reach the server right now. Check your connection and try again.",
  'deadline-exceeded': 'That took too long to complete. Please try again.',
  'resource-exhausted': "We're getting too many requests right now. Please wait a moment and try again.",
  'not-found': "That record couldn't be found, it may have been deleted or moved.",
  'already-exists': 'That already exists.',
  'cancelled': 'That was cancelled before it could finish.',
  'aborted': 'That could not be completed, please try again.',
  'internal': 'Something went wrong on our end. Please try again.',
  'auth/network-request-failed': 'Please check your internet connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a bit before trying again.',
  'auth/user-disabled': 'This account has been disabled. Please contact your business owner.',
  'storage/unauthorized': "You're not allowed to upload that file.",
  'storage/canceled': 'The upload was cancelled.',
  'storage/quota-exceeded': 'Storage limit reached, please contact support.',
};

export function friendlyErrorMessage(err, options = {}) {
  const { fallback = 'Something went wrong. Please try again.', overrides = {} } = options;
  const code = err?.code || '';
  if (overrides[code]) return overrides[code];
  if (MESSAGES[code]) return MESSAGES[code];

  const raw = err?.message || '';
  if (/offline|failed to fetch|networkerror/i.test(raw)) {
    return "Can't reach the server, check your internet connection and try again.";
  }
  // A raw Firestore/Firebase SDK error string — never show that verbatim.
  if (/^Firebase|Missing or insufficient permissions|\[code=/i.test(raw)) {
    console.error('[FlowBiz] Unmapped error:', err);
    return fallback;
  }
  // Anything else is almost certainly one of FlowBiz's OWN thrown
  // messages ("Enter a valid phone number.", "Amount exceeds the
  // outstanding balance...") — those are already written for people.
  return raw || fallback;
}
````

## File: src/utils/scannerService.js
````javascript
// src/utils/scannerService.js
//
// Central place all code-matching logic lives, so camera scans, hardware
// scanner input, and manual search-box typing all resolve to the exact
// same product via the exact same rule. Nothing about sales, purchases,
// or stock take needed to change — this just answers "what product is
// this code?" and hands the answer to whichever existing workflow asked.

export function normalizeCode(raw) {
  return String(raw || '').trim();
}

// Matches a scanned/typed code against a product's manufacturer barcode
// OR its internal FlowBiz code (FB-000001). Barcode match is exact
// (manufacturer barcodes are numeric strings); internal code match is
// case-insensitive (FB-000001 vs fb-000001 should both work when typed).
export function findProductByCode(products, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const lower = code.toLowerCase();
  return (
    (products || []).find(
      (p) =>
        (p.barcode && p.barcode === code) ||
        (p.internalCode && p.internalCode.toLowerCase() === lower)
    ) || null
  );
}

// FUTURE-READY: additional scan payload "kinds" (a QR code pointing at a
// product some other way, a warehouse location label, a price label) can
// be added here as their own small resolver, dispatched on a `kind` field
// embedded in the scanned payload — without ScannerModal or any page that
// uses it needing to change. Today every scan is just a product code.
export function parseScanPayload(rawText) {
  return { kind: 'product-code', code: normalizeCode(rawText) };
}
````

## File: .env.example
````
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
````

## File: .firebaserc
````
{
  "projects": {
    "default": "swiftstock-bc6a3"
  }
}
````

## File: .gitignore
````
node_modules
dist
dist-ssr
*.local
.env
.env.local
.DS_Store
````

## File: .nvmrc
````
20
````

## File: .pagesignore
````
cloudflare-worker/
````

## File: eslint.config.js
````javascript
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
]);
````

## File: firestore.indexes.json
````json
{
  "indexes": [],
  "fieldOverrides": []
}
````

## File: postcss.config.js
````javascript
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
````

## File: README.md
````markdown
# FlowBiz — Business Manager

Production-ready POS and business management app for Kenyan SMBs.

## Setup

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # fill in your Firebase config
npm run dev
```

## Deployment

```bash
npm run build
# Deploy dist/ to Vercel, Netlify, or Firebase Hosting
# firebase deploy --only hosting
```

## First-time Firebase setup

1. Create a Firebase project, enable **Authentication → Email/Password** and **Firestore**
2. Paste the Firestore security rules from `src/firebase.js` into **Console → Firestore → Rules**
3. Create your owner account in Firebase Console (Auth → Add user), then sign in — first account auto-bootstraps as Admin
4. Create the Firestore composite indexes listed in `src/firebase.js` (or let the app prompt you via console links)

## PWA Installation (Chrome)

1. Open the deployed app in Chrome on Android or desktop
2. Chrome shows "Add to Home Screen" banner, or tap **⋮ → Install app**
3. iOS Safari: tap Share → Add to Home Screen

## Fixes applied (v2.0 — full audit pass)

| ID   | Fix |
|------|-----|
| CR-1 | DebtorDetail missing profile + serverTimestamp imports |
| CR-2 | Repayment history reads from `repayments` collection (not stale embedded array) |
| CR-3 | SaleModal missing toast import |
| CR-4 | Reports missing ErrorBanner import |
| CR-5 | Login navigation moved into useEffect (no render-time side effects) |
| CR-6 | Till reconciliation correctly includes debt repayments in expected balances |
| CR-7 | M-Pesa transaction code enforced in sale canSubmit check |
| CR-8 | All POS writes use writeBatch + increment() — offline-first, no runTransaction |
| CR-9 | Staff creation writes profile BEFORE signing admin out |
| HP-1 | limit() added to unbounded queries |
| HP-2 | useFinancialsForRange debounced with requestAnimationFrame — 1 render per write |
| HP-3 | StockTake reads fresh stock inside transaction (no stale-read bugs) |
| HP-4 | Product performance includes credit sales |
| HP-5 | CSV export sanitised against formula injection (=, +, -, @) |
| HP-6 | Users page password input masked (type="password") |
| HP-7 | CloseDay batch deletion chunked at 400 ops; window.location.reload() removed |
| HP-8 | Dashboard "today" range recalculated at midnight via setTimeout |
| HP-9 | ErrorBoundary wraps entire app |
| MP-1 | Modal + ConfirmDialog close on ESC key |
| MP-4 | ProductFormModal validates negative prices and selling below cost |
| MP-5 | Suppliers payment blocked if amount exceeds outstanding balance |
| MP-6 | RepaymentModal blocks over-repayment |
| MP-7 | Bootstrap profile avoids serverTimestamp() sentinel in React state |
| MP-8 | StockTake empty physical count treated as unchanged (not zero) |
| MP-10| All routes lazy-loaded (React.lazy + Suspense) |
| MP-11| useDailySession uses onSnapshot for cross-device real-time updates |

## Firestore composite indexes required

| Collection  | Fields              |
|-------------|---------------------|
| sales       | soldAt              |
| creditSales | soldAt              |
| creditSales | customerId + soldAt |
| expenses    | recordedAt          |
| repayments  | paidAt              |
| repayments  | customerId + paidAt |

Run the app once — Firestore prints console errors with direct auto-create links.
````

## File: skills-lock.json
````json
{
  "version": 1,
  "skills": {
    "extension-to-functions-codebase": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/extension-to-functions-codebase/SKILL.md",
      "computedHash": "4597667cb7548b9906708ff0e5fdc1043a59119d2cb32cba1142c03e8a85f315"
    },
    "firebase-ai-logic-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-ai-logic-basics/SKILL.md",
      "computedHash": "2af723026c6cb09aeedd6d0578421b5f25cd410c72a4e5135b4b174451a5eee9"
    },
    "firebase-app-hosting-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-app-hosting-basics/SKILL.md",
      "computedHash": "e32ac489690e6c04bf6a71ce965918fe65a192e9992e6ed887c572d7733621c2"
    },
    "firebase-auth-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-auth-basics/SKILL.md",
      "computedHash": "25070123c29d59098ac817dee0eee36a73b4a822e6bb925a0ebccab0c78cf1e9"
    },
    "firebase-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-basics/SKILL.md",
      "computedHash": "3a41bf302bfce4dac272575c51a02d0fc1bdac8dcb6cb5496103301b68ffbb67"
    },
    "firebase-crashlytics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-crashlytics/SKILL.md",
      "computedHash": "1316a59236b4e2317e1d265df80e2c6c112e855bc15404ade19f2a2fe9cf2502"
    },
    "firebase-data-connect": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-data-connect-basics/SKILL.md",
      "computedHash": "e4108a3f77cda0a3cd1f883f8f8f1836f7c88af8baaf62875ef5460456aec3a1"
    },
    "firebase-firestore": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-firestore/SKILL.md",
      "computedHash": "7462e16e15fa68b814c17fa6dff22bb1ae970d5638b5e7143e046cbd70084a19"
    },
    "firebase-hosting-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-hosting-basics/SKILL.md",
      "computedHash": "381c7bb4200644d4a09f7f505bc5ba44b499cc74d0365d69bd3e313ea0865297"
    },
    "firebase-remote-config-basics": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-remote-config-basics/SKILL.md",
      "computedHash": "4477c4ed83c5ee33df3d41f7831e7f9254aa436763f20d0c1a62c5c41f1a4564"
    },
    "firebase-security-rules-auditor": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/firebase-security-rules-auditor/SKILL.md",
      "computedHash": "69927a1fca3467543feb4eafaa1ff376a9b642db1095b29bfc2160c9a555ca61"
    },
    "xcode-project-setup": {
      "source": "firebase/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/xcode-project-setup/SKILL.md",
      "computedHash": "0adf19113be8a1966466e629098f4ead7b5de3a7767958f02baf1cddc9e2642e"
    }
  }
}
````

## File: tailwind.config.js
````javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Sora"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f5f6f7', 100: '#e8eaed', 200: '#cfd3da',
          300: '#a6adb9', 400: '#767f8f', 500: '#5a6273',
          600: '#454b5c', 700: '#363b48', 800: '#262a34',
          900: '#15171d', 950: '#0c0d11',
        },
        moss: {
          50: '#f1faf4', 100: '#dcf3e3', 200: '#bbe6c9',
          300: '#8ad2a6', 400: '#54b67c', 500: '#2f9a5e',
          600: '#1f7c4a', 700: '#1a623c', 800: '#194e33', 900: '#16412c',
        },
        rust: {
          50: '#fdf4ef', 100: '#fbe5d9', 200: '#f6c8ae',
          300: '#efa278', 400: '#e87a48', 500: '#dd5a28',
          600: '#c4441d', 700: '#a2331b', 800: '#822b1c', 900: '#6a261b',
        },
        sand: '#faf6ef',
      },
      borderRadius: { xl2: '1.1rem' },
      minHeight: { touch: '44px' },
      minWidth:  { touch: '44px' },
    },
  },
  plugins: [],
};
````

## File: vite.config.js
````javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
  },

  resolve: mode === 'demo' ? {
    alias: {
      'firebase/firestore': path.resolve(__dirname, 'src/demo/localFirestore.js'),
      'firebase/auth': path.resolve(__dirname, 'src/demo/localAuth.js'),
    },
  } : {},

  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'favicon-16.png', 'icons/*.png'],
      manifest: {
        name: 'FlowBiz — Business Manager',
        short_name: 'FlowBiz',
        description: 'POS, inventory and finance management for Kenyan SMBs',
        theme_color: '#1a623c',
        background_color: '#faf6ef',
        display: 'standalone',
        orientation: 'natural',
        start_url: '/',
        scope: '/',
        lang: 'en-KE',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: 'icons/icon-72.png',  sizes: '72x72',   type: 'image/png' },
          { src: 'icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
          { src: 'icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icons/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        screenshots: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
}));
````

## File: cloudflare-worker/src/lib/firestore.js
````javascript
// src/lib/firestore.js
//
// Minimal Firestore REST API client — just enough for this backend's
// needs (read-by-id, patch-by-id, create-by-id). Deliberately NOT a
// general Firestore SDK: no queries, no transactions. Every route in this
// project only ever needs to read/write documents it already knows the ID
// of (a uid, a businessId, a Paystack reference), so this stays small.
//
// Auth is via the OAuth2 access token from googleAuth.js, which — like
// the Firebase Admin SDK — bypasses Firestore Security Rules entirely.
// That's expected and required: this is the privileged, server-side path.

import { getGoogleAccessToken } from './googleAuth.js';

function fieldsToObject(fields) {
  if (!fields) return {};
  const out = {};
  for (const [key, value] of Object.entries(fields)) out[key] = valueToJs(value);
  return out;
}

function valueToJs(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return value.timestampValue; // ISO string
  if (value.mapValue !== undefined) return fieldsToObject(value.mapValue.fields);
  if (value.arrayValue !== undefined) return (value.arrayValue.values || []).map(valueToJs);
  return null;
}

function jsToValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(jsToValue) } };
  if (typeof value === 'object') return { mapValue: { fields: objectToFields(value) } };
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function objectToFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) fields[key] = jsToValue(value);
  return fields;
}

function baseUrl(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

export async function getDocument(env, collection, docId) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}/${docId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore read failed (${collection}/${docId}): ${await res.text()}`);
  const data = await res.json();
  return { id: docId, ...fieldsToObject(data.fields) };
}

export async function patchDocument(env, collection, docId, updates) {
  const token = await getGoogleAccessToken(env);
  const fields = objectToFields(updates);
  const mask = Object.keys(updates).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}/${docId}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Firestore update failed (${collection}/${docId}): ${await res.text()}`);
  return res.json();
}

export async function createDocument(env, collection, docId, data) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}?documentId=${encodeURIComponent(docId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: objectToFields(data) }),
  });
  if (res.status === 409) throw new Error('DOCUMENT_ALREADY_EXISTS');
  if (!res.ok) throw new Error(`Firestore create failed (${collection}/${docId}): ${await res.text()}`);
  return res.json();
}
export async function deleteDocument(env, collection, docId) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}/${docId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return; 
  if (!res.ok) throw new Error(`Firestore delete failed (${collection}/${docId}): ${await res.text()}`);
}
````

## File: cloudflare-worker/src/lib/response.js
````javascript
// src/lib/response.js
export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message, status = 400) {
  return json({ error: message }, { status });
}

// Used only by the public document route (src/routes/publicDocument.js).
// noindex/nofollow because these pages carry a customer's financial data —
// the opaque token in the URL is the real access control, but there's no
// reason to also let a search engine crawl or cache them.
export function html(bodyHtml, init = {}) {
  return new Response(bodyHtml, {
    status: init.status || 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
    },
  });
}
````

## File: cloudflare-worker/src/routes/deleteStaff.js
````javascript
// src/routes/deleteStaff.js
//
// POST /api/auth/delete-staff  { targetUid }
//
// Fixes the staff-deletion bug: deletes the actual Firebase Authentication
// account for a removed staff member, not just their Firestore profile —
// so the same email can be re-invited afterward.

import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { getDocument } from '../lib/firestore.js';
import { deleteAuthUser } from '../lib/identityToolkit.js';

export async function handleDeleteStaff(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return errorResponse('Missing Authorization header.', 401);

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return errorResponse(`Invalid session: ${err.message}`, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }
  const targetUid = body?.targetUid;
  if (!targetUid || typeof targetUid !== 'string') return errorResponse('targetUid is required.', 400);
  if (targetUid === caller.uid) return errorResponse("You can't remove your own account.", 400);

  // Step 1 & 2 — the requester must exist, be active, and be an owner.
  const callerProfile = await getDocument(env, 'users', caller.uid);
  if (!callerProfile) return errorResponse('Caller profile not found.', 403);
  if (callerProfile.role !== 'owner') return errorResponse('Only an owner can remove staff accounts.', 403);
  if (callerProfile.active === false) return errorResponse('Your account is deactivated.', 403);

  // Step 3 — the target must belong to the SAME business. This is what
  // stops one business's owner from deleting another business's staff
  // member by guessing or leaking a uid.
  const targetProfile = await getDocument(env, 'users', targetUid);
  if (!targetProfile) {
    return errorResponse('Target staff profile not found in Firestore — nothing to reconcile.', 404);
  }
  if (targetProfile.businessId !== callerProfile.businessId) {
    return errorResponse('That account does not belong to your business.', 403);
  }

  // The account that originally created the business can only ever be
  // removed by itself (via "Delete my account" in Settings) — never by
  // another owner through this staff-removal flow.
  const business = await getDocument(env, 'businesses', callerProfile.businessId);
  if (business && business.createdBy === targetUid) {
    return errorResponse("The account that created this business can't be removed this way. That person can delete their own account from Settings.", 403);
  }

  await deleteAuthUser(env, targetUid);

  return json({ success: true });
}
````

## File: cloudflare-worker/src/routes/sendPasswordResetEmail.js
````javascript
// src/routes/sendPasswordResetEmail.js
//
// POST /api/auth/send-password-reset  { email }
//
// Unauthenticated by necessity — someone requesting a reset usually isn't
// signed in. ALWAYS responds with the same generic { success: true }
// shape regardless of whether the email actually belongs to an account,
// whether Firebase found it, or whether Resend succeeded — this is what
// stops the endpoint being used to check who has a FlowBiz account
// (mirrors the enumeration protection ForgotPassword.jsx already had
// client-side, now enforced where it actually matters: server-side).
//
// RATE LIMITING NOTE: the in-memory map below is best-effort only — a
// Cloudflare Worker can run many isolates in parallel across edge
// locations, each with its OWN copy of this map, so it does not provide
// a real global rate limit. For production-grade protection on this
// endpoint, add a Cloudflare Rate Limiting Rule in the dashboard
// (Security → WAF → Rate limiting rules) targeting
// POST /api/auth/send-password-reset — that's enforced at the edge,
// globally, with no code changes needed here.

import { json, errorResponse } from '../lib/response.js';
import { generateActionLink } from '../lib/identityToolkit.js';
import { sendEmail } from '../lib/resend.js';
import { passwordResetEmail } from '../lib/emailTemplates.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort, single-isolate throttle — see note above.
const recentRequests = new Map(); // email -> last request timestamp (ms)
const MIN_INTERVAL_MS = 60 * 1000;

export async function handleSendPasswordReset(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const email = String(body?.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return errorResponse('Enter a valid email address.', 400);
  }

  const now = Date.now();
  const last = recentRequests.get(email);
  if (last && now - last < MIN_INTERVAL_MS) {
    // Still a generic success — never let timing or response shape leak
    // whether this is a real throttle vs. a real send.
    return json({ success: true });
  }
  recentRequests.set(email, now);

const continueUrl = `${env.APP_BASE_URL}/auth/action?flow=resetPassword`;

  try {
    const result = await generateActionLink(env, {
      requestType: 'PASSWORD_RESET',
      email,
      continueUrl,
    });
    const { subject, html, text } = passwordResetEmail(result.oobLink);
    await sendEmail(env, { to: email, subject, html, text });
  } catch (err) {
    // EMAIL_NOT_FOUND is expected and common (a mistyped address, or
    // someone probing for registered accounts) — it must never produce a
    // different response than success. Anything else gets logged for
    // diagnosis (e.g. a real Resend/Identity Toolkit outage).
    if (err.identityToolkitCode !== 'EMAIL_NOT_FOUND') {
      console.error('[send-password-reset] failed:', err.identityToolkitCode || err.message);
    }
  }

  return json({ success: true });
}
````

## File: cloudflare-worker/src/routes/sendVerificationEmail.js
````javascript
// src/routes/sendVerificationEmail.js
//
// POST /api/auth/send-verification-email
//
// Replaces the frontend's direct sendEmailVerification() call. Requires
// the caller's own Firebase ID token — this endpoint can only ever
// trigger verification for the account that's asking, never an
// arbitrary email address (same trust model as every other authenticated
// route in this Worker, e.g. deleteStaff.js).
//
// Firebase itself never sends an email for this flow: generateActionLink
// asks Identity Toolkit for the raw oobLink only (returnOobLink: true),
// and FlowBiz delivers it via Resend below.

import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { generateActionLink } from '../lib/identityToolkit.js';
import { sendEmail } from '../lib/resend.js';
import { verificationEmail } from '../lib/emailTemplates.js';

export async function handleSendVerificationEmail(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return errorResponse('Missing Authorization header.', 401);

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return errorResponse(`Invalid session: ${err.message}`, 401);
  }

  if (!caller.email) return errorResponse('No email address on this account.', 400);

const continueUrl = `${env.APP_BASE_URL}/auth/action?flow=verifyEmail`;
  let link;
  try {
    const result = await generateActionLink(env, {
      requestType: 'VERIFY_EMAIL',
      idToken,
      continueUrl,
    });
    link = result.oobLink;
  } catch (err) {
    console.error('[send-verification-email] generateActionLink failed:', err.identityToolkitCode || err.message);
    return errorResponse('Could not generate a verification link. Please try again.', 502);
  }

  try {
    const { subject, html, text } = verificationEmail(link);
    await sendEmail(env, { to: caller.email, subject, html, text });
  } catch (err) {
    console.error('[send-verification-email] Resend send failed:', err.message);
    return errorResponse('Could not send the verification email. Please try again.', 502);
  }

  return json({ success: true });
}
````

## File: src/components/charts/DonutChart.jsx
````javascript
// src/components/charts/DonutChart.jsx
//
// Small part-to-whole breakdown (payment methods, stock health). Always
// paired with a text legend showing exact values and percentages — the
// slices alone are never the only way to read the data.
export default function DonutChart({ segments, size = 148, formatValue = (v) => String(v), centerLabel, stacked = false }) {
  const visible = (segments || []).filter((s) => (Number(s.value) || 0) > 0);
  const total = visible.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) return null;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offsetAccum = 0;

  return (
    <div className={`flex flex-col items-center gap-4 ${stacked ? '' : 'sm:flex-row'}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0" role="img" aria-label="Breakdown chart">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-ink-100" strokeWidth="14" />
        {visible.map((s, i) => {
          const value = Number(s.value) || 0;
          const fraction = value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const el = (
            <circle
              key={i}
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="currentColor"
              className={s.colorClassName || 'text-blue-600'}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offsetAccum}
              transform="rotate(-90 50 50)"
            />
          );
          offsetAccum += dash;
          return el;
        })}
        {centerLabel && (
          <text x="50" y="53" textAnchor="middle" fill="currentColor" className="text-ink-900" style={{ fontSize: '11px', fontWeight: 700 }}>
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="w-full space-y-1.5">
        {visible.map((s, i) => {
          const value = Number(s.value) || 0;
          const pct = (value / total) * 100;
          return (
            <li key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink-600">
                <span className={`h-2.5 w-2.5 rounded-full ${s.dotClassName || 'bg-blue-600'}`} />
                {s.label}
              </span>
              <span className="font-semibold text-ink-800">
                {formatValue(value)} <span className="font-normal text-ink-400">({pct.toFixed(0)}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
````

## File: src/components/charts/MiniLineChart.jsx
````javascript
// src/components/charts/MiniLineChart.jsx
//
// A small, dependency-free SVG line chart. No new npm package needed —
// this project has no chart library installed, and a handful of plain
// SVG components is simpler to install (nothing to install) and audit
// than adding one for three small charts.
//
// Accessible by design rather than by adding interactivity: instead of
// JS-driven hover tooltips, the start/end labels and the overall change
// are always shown as real text under the chart, so the trend is never
// locked behind a color someone might not be able to distinguish.
export default function MiniLineChart({ data, height = 140, colorClassName = 'text-blue-600', formatValue = (v) => String(v), ariaLabel, compact = false }) {
  if (!data || data.length === 0) return null;

  const width = 300; // viewBox units — scales to container via className="w-full"
  const values = data.map((d) => Number(d.value) || 0);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padY = 10;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * stepX : width / 2;
    const y = height - padY - ((Number(d.value) || 0) - min) / range * (height - padY * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const change = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  const showDots = !compact && data.length <= 31;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" role="img" aria-label={ariaLabel || 'Trend chart'}>
        <path d={areaPath} className={colorClassName} fill="currentColor" opacity="0.08" />
        <path d={linePath} className={colorClassName} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {showDots && points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" className={colorClassName} fill="currentColor" />
        ))}
      </svg>
{!compact && (
        <>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-400">
            <span>{data[0].label}</span>
            <span>{data[data.length - 1].label}</span>
          </div>
          {change !== null && (
            <p className={`mt-1 text-xs font-semibold ${change >= 0 ? 'text-moss-700' : 'text-rust-600'}`}>
              {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% over this period — ending at {formatValue(last)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
````

## File: src/components/common/ConfirmDialog.jsx
````javascript
import { useEffect } from 'react';
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, confirmDisabled = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = e => { if (e.key === 'Escape' && !confirmDisabled) onCancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel, confirmDisabled]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-4 sm:items-center" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-xl">
        <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
        {message && <p className="mt-2 text-sm text-ink-500">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} disabled={confirmDisabled}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
````

## File: src/components/common/PwaInstallBanner.jsx
````javascript
// src/components/common/PwaInstallBanner.jsx
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';

const DISMISSED_KEY = 'flowbiz_pwa_banner_dismissed';

export default function PwaInstallBanner() {
  const location = useLocation();
  const { isInstallable, isIOS, isStandalone, promptInstall } = usePwaInstall();

  // Read persisted dismissal state from localStorage
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Ignore if localStorage is unavailable
    }
  };

  const handleInstallClick = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      handleDismiss();
    }
  };

  // Only allow on landing page ('/') and signup/setup pages ('/setup', '/signup')
  const allowedPaths = ['/', '/setup', '/signup'];
  const isAllowedPath = allowedPaths.includes(location.pathname);

  // If running in installed app mode, permanently dismissed, or not on an allowed path, do not render
  if (isStandalone || dismissed || !isAllowedPath) return null;

  return (
    <aside
      aria-label="Install FlowBiz App"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-moss-200 bg-white p-4 shadow-2xl animate-fade-in"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/icons/icon-96.png"
            alt="FlowBiz App Icon"
            className="h-11 w-11 rounded-xl shadow-xs shrink-0 object-cover"
            onError={(e) => {
              e.currentTarget.src = '/favicon.svg';
            }}
          />
          <div>
            <h4 className="font-display text-sm font-bold text-ink-900">
              Install FlowBiz App
            </h4>
            <p className="text-xs text-ink-500">
              Run your counter faster and work 100% offline.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-ink-400 hover:text-ink-700 p-1 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg"
          aria-label="Close install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
        {/* Android & Desktop Chrome / Edge 1-Click Install Button */}
        {isInstallable ? (
          <button
            type="button"
            onClick={handleInstallClick}
            className="btn-primary w-full !py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Download className="h-4 w-4" /> Install Free App
          </button>
        ) : isIOS ? (
          <div className="rounded-lg bg-[#faf6ef] p-2.5 text-[11px] text-ink-700 border border-ink-100">
            <p className="font-semibold flex items-center flex-wrap gap-1">
              Tap <Share className="h-3.5 w-3.5 text-moss-700 inline" /> Share, then select{' '}
              <PlusSquare className="h-3.5 w-3.5 text-moss-700 inline" /> &quot;Add to Home Screen&quot;
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleInstallClick}
            className="btn-primary w-full !py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Download className="h-4 w-4" /> Install Free App
          </button>
        )}
      </div>
    </aside>
  );
}
````

## File: src/components/customers/AddCustomerModal.jsx
````javascript
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { isValidWhatsAppPhone } from '../../utils/whatsapp';

export default function AddCustomerModal({ open, onClose, onSave, existingCustomers = [], initialData }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialData?.name || '');
      setPhone(initialData?.phone || '');
    }
  }, [open, initialData]);

  const reset = () => { setName(''); setPhone(''); };
  const handleClose = () => { if (!busy) { reset(); onClose(); } };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) { toast.error('Enter a customer name.'); return; }
    if (trimmedPhone && !isValidWhatsAppPhone(trimmedPhone)) {
      toast.error("That phone number doesn't look right — check it and try again.");
      return;
    }

    if (!initialData) {
      const duplicate = existingCustomers.find((c) => {
        const sameName = (c.name || '').trim().toLowerCase() === trimmedName.toLowerCase();
        if (!sameName) return false;
        return !trimmedPhone || !c.phone || c.phone === trimmedPhone;
      });
      if (duplicate) {
        toast.error(`"${trimmedName}" already exists in your customer list.`);
        return;
      }
    }

    setBusy(true);
    try {
      await onSave({ name: trimmedName, phone: trimmedPhone });
      reset();
      onClose();
    } catch {
      // onSave already surfaces its own error toast
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={initialData ? 'Edit customer' : 'Add customer'} widthClass="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label">Customer name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. John Kamau"
            disabled={busy}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label">Phone number <span className="text-ink-300 font-normal normal-case">(recommended)</span></label>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07xx xxx xxx"
            disabled={busy}
          />
          <p className="mt-1 text-xs text-ink-400">Needed later to send WhatsApp reminders and receipts.</p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : (initialData ? 'Save changes' : 'Save customer')}</button>
        </div>
      </form>
    </Modal>
  );
}
````

## File: src/components/debtors/DebtPaymentReceiptModal.jsx
````javascript
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Printer, Download, MessageCircle, CheckCircle2, Clock } from 'lucide-react';
import Modal from '../common/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { formatKES } from '../../utils/currency';
import { openWhatsApp, buildDebtPaymentReceiptMessage, isValidWhatsAppPhone } from '../../utils/whatsapp';
import { printDebtPaymentReceipt, generateDebtPaymentReceiptPDF } from '../../utils/documentService';
import { getOrCreateShareLink } from '../../utils/documentSharing';

// Shown right after a debt repayment is successfully recorded (never
// before — see CustomerDetail.jsx's handleRepayment).
//
// FIX (Pro-gating correction): View/Print/Download are free on every
// plan — Print and Download used to be gated behind isPro here, which was
// a bug (this app's Pro boundary has never been "can you access your own
// documents", it's specifically the WhatsApp convenience). Only WhatsApp
// sharing stays Pro-gated below.
export default function DebtPaymentReceiptModal({ open, receipt, onClose }) {
  const { isPro, businessId, profile } = useAuth();
  const { settings } = useSettings();
  const [phone, setPhone] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  useEffect(() => { setPhone(receipt?.customerPhone || ''); }, [receipt]);

  if (!receipt) return null;

  const handlePrint = () => printDebtPaymentReceipt(receipt, settings);
  const handleDownload = () => generateDebtPaymentReceiptPDF(receipt, settings);

  const handleWhatsApp = async () => {
    if (!phone.trim() || !isValidWhatsAppPhone(phone)) {
      toast.error('Add a valid phone number for this customer before sending a WhatsApp reminder.');
      return;
    }
    setSendingWhatsApp(true);
    try {
      // receiptDocId is the persisted debtPaymentReceipts/{id} document
      // CustomerDetail.jsx writes in the same batch as the repayment
      // itself (see handleRepayment) — that's what the public link
      // resolves to, so the shared page always reflects the real,
      // already-committed payment, never a value recomputed later.
      const documentUrl = receipt.receiptDocId
        ? await getOrCreateShareLink({
            businessId,
            documentType: 'debtPaymentReceipt',
            documentId: receipt.receiptDocId,
            createdBy: profile?.uid,
          })
        : null;
      const message = buildDebtPaymentReceiptMessage({
        shopName: settings.shopName || 'FlowBiz Store',
        customerName: receipt.customerName,
        amountPaid: receipt.amountPaid,
        previousBalance: receipt.previousBalance,
        remainingBalance: receipt.remainingBalance,
        isCleared: receipt.isCleared,
        documentUrl,
        formatKES,
      });
      const opened = openWhatsApp(phone, message);
      toast[opened ? 'success' : 'error'](opened ? 'WhatsApp opened.' : 'WhatsApp could not be opened.');
    } catch (err) {
      toast.error('Unable to generate the receipt link. Please try again.');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Debt Payment Receipt">
      <div className="space-y-4">
        <div className={`flex flex-col items-center justify-center py-4 rounded-2xl border ${receipt.isCleared ? 'bg-moss-50 border-moss-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${receipt.isCleared ? 'bg-moss-100 text-moss-700' : 'bg-amber-100 text-amber-700'}`}>
            {receipt.isCleared ? <CheckCircle2 className="h-5 w-5" strokeWidth={2} /> : <Clock className="h-5 w-5" strokeWidth={2} />}
          </div>
          <h2 className={`font-display font-bold ${receipt.isCleared ? 'text-moss-800' : 'text-amber-800'}`}>
            {receipt.isCleared ? 'Debt cleared' : 'Partially paid'}
          </h2>
          <p className="text-sm font-semibold mt-2 text-ink-800">{receipt.customerName}</p>
          <p className="text-lg font-bold text-ink-900">{formatKES(receipt.amountPaid)} received</p>
          <p className="text-xs mt-1 font-semibold text-ink-500">
            {receipt.method}{receipt.mpesaCode ? ` · ${receipt.mpesaCode}` : ''}
          </p>
        </div>

        <div className="card divide-y divide-ink-100">
          <Row label="Previous balance" value={formatKES(receipt.previousBalance)} />
          <Row label="Payment received" value={formatKES(receipt.amountPaid)} />
          <Row label="Remaining balance" value={formatKES(receipt.remainingBalance)} bold />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print
          </button>
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download PDF
          </button>
        </div>

        <div className="rounded-lg border border-ink-100 p-3 space-y-2">
          <label className="label">
            Send receipt via WhatsApp {!isPro && <span className="text-amber-600">— PRO</span>}
          </label>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Customer phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sendingWhatsApp} />
            {isPro ? (
              <button className="btn-primary flex items-center justify-center gap-2 shrink-0" onClick={handleWhatsApp} disabled={sendingWhatsApp}>
                <MessageCircle className="h-4 w-4" /> {sendingWhatsApp ? 'Preparing…' : 'Send'}
              </button>
            ) : (
              <Link to="/pro" className="btn-primary flex items-center justify-center gap-2 shrink-0">
                <MessageCircle className="h-4 w-4" /> Unlock
              </Link>
            )}
          </div>
        </div>

        <button className="btn-secondary w-full" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${bold ? 'bg-ink-50/60' : ''}`}>
      <span className={bold ? 'font-bold text-ink-900' : 'text-ink-500'}>{label}</span>
      <span className={bold ? 'font-bold text-ink-900' : 'text-ink-700'}>{value}</span>
    </div>
  );
}
````

## File: src/components/debtors/RepaymentModal.jsx
````javascript
import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { formatKES } from '../../utils/currency';
import { Banknote, Smartphone } from 'lucide-react';

export default function RepaymentModal({ open, customer, totalOwed, onClose, onSubmit }) {
  const [amount, setAmount]     = useState('');
  const [method, setMethod]     = useState('Cash');
  const [mpesaCode, setMpesa]   = useState('');
  const [busy, setBusy]         = useState(false);
  // Freeze the outstanding balance the moment we start saving, so a
  // background update to totalOwed mid-submission can't make a correct
  // amount suddenly look like it exceeds the balance.
  const [lockedOwed, setLockedOwed] = useState(totalOwed);

  useEffect(() => { if (open) setLockedOwed(totalOwed); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!customer) return null;
  const numeric = Number(amount) || 0;
  const effectiveOwed = busy ? lockedOwed : totalOwed;
  const overRepayment = numeric > effectiveOwed + 0.005;
  const canSubmit = numeric > 0 && !overRepayment && (method !== 'M-Pesa' || mpesaCode.trim()) && !busy;

  const handle = async e => {
    e.preventDefault();
    setLockedOwed(totalOwed);
    setBusy(true);
    try { await onSubmit({ amount: numeric, method, mpesaCode: method==='M-Pesa'?mpesaCode.trim():null }); setAmount(''); setMpesa(''); onClose(); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Repayment — ${customer.name}`}>
      <form onSubmit={handle} className="space-y-3">
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">Outstanding: <span className="font-semibold text-rust-600">{formatKES(effectiveOwed)}</span></div>
        <div>
          <label className="label">Amount received (KES)</label>
          <input type="number" min="0.01" max={effectiveOwed} step="0.01" className="input" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus disabled={busy} />
          {overRepayment && <p className="mt-1 text-xs text-rust-600">Amount exceeds the outstanding balance of {formatKES(effectiveOwed)}.</p>}
        </div>
        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-2 gap-2">
            {['Cash','M-Pesa'].map(m=>(
              <button key={m} type="button" disabled={busy} onClick={()=>setMethod(m)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${method===m?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>
                {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
              </button>
            ))}
          </div>
        </div>
        {method==='M-Pesa' && <div><label className="label">M-Pesa code <span className="text-rust-500">*</span></label><input className="input uppercase" disabled={busy} value={mpesaCode} onChange={e=>setMpesa(e.target.value.toUpperCase())} placeholder="QWE1234567" /></div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>{busy?'Saving…':'Record repayment'}</button>
        </div>
      </form>
    </Modal>
  );
}
````

## File: src/components/landing/HeroSection.jsx
````javascript
// src/components/landing/HeroSection.jsx
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, ShoppingCart, Lock, Boxes, BarChart3, Users, Play } from 'lucide-react';

const HERO_PHOTO_URL = '/hero-photo.webp';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      
      {/* Full-Bleed Hero Banner */}
      <div className="relative min-h-[560px] lg:min-h-[620px] flex items-center bg-[#0d1f16]">
        
        {/* Background Image */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={HERO_PHOTO_URL}
            alt="Retail shop owner managing inventory and POS"
            className="w-full h-full object-cover object-center lg:object-right"
            onError={(e) => {
              e.currentTarget.style.opacity = '0.25';
            }}
          />
        </div>

        {/* Gradient Overlay */}
        <div 
          className="absolute inset-0 z-1 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(13, 31, 22, 0.96) 0%, rgba(13, 31, 22, 0.88) 42%, rgba(13, 31, 22, 0.35) 70%, rgba(13, 31, 22, 0.02) 100%)',
          }}
        />

        {/* Soft Left Blur Mask */}
        <div 
          className="absolute inset-0 z-1 pointer-events-none hidden md:block"
          style={{
            maskImage: 'linear-gradient(to right, black 25%, transparent 65%)',
            WebkitMaskImage: 'linear-gradient(to right, black 25%, transparent 65%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 w-full">
          <div className="max-w-3xl space-y-6 text-white text-left">

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white tracking-tight leading-[1.08] drop-shadow-sm">
              Run your business with ease
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-[#d1dcd4] font-normal leading-relaxed max-w-2xl">
              Sell <strong className="text-white font-semibold">faster</strong>, know what you have in{' '}
              <strong className="text-white font-semibold">stock</strong>, and keep your business running
              even while <strong className="text-white font-semibold">offline</strong>, then see how it’s doing when you’re <strong className="text-white font-semibold">online.</strong>
            </p>

            <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link
                to="/setup"
                className="bg-[#1a623c] text-white px-8 py-4 rounded-xl text-base font-bold shadow-lg hover:bg-[#144f30] transition-all flex items-center justify-center gap-2 border border-[#348a58]"
              >
                <span>Get Started Free</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="bg-white/10 backdrop-blur-md border border-white/30 text-white px-7 py-4 rounded-xl text-base font-bold hover:bg-white/20 transition-all flex items-center justify-center"
              >
                Sign In to Counter
              </Link>
            </div>

            <div className="pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-xs sm:text-sm font-semibold text-[#e1ece4]">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#a3e6ba] shrink-0" />
                Works 100% Offline
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#a3e6ba] shrink-0" />
                M-Pesa Till Reconciled
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#a3e6ba] shrink-0" />
                Customer Reminders
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#a3e6ba] shrink-0" />
                No POS Hardware Required
              </span>
            </div>

          </div>
        </div>

      </div>

      {/* Unboxed Live Demo Feature Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 border-b border-[#e8eaed]">
        <div className="max-w-4xl mx-auto space-y-8 text-center sm:text-left">
          
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#15171d] tracking-tight">
              Try FlowBiz Live in Your Browser
            </h2>
            <p className="text-sm sm:text-base text-[#5a6273] leading-relaxed max-w-3xl">
              Test-drive the full FlowBiz workstation with preloaded retail inventory, active supplier links, and past sales. Test multi-item cart checkouts, M-Pesa till reconciliation, customer debt records, and profit reports with zero sign-up or credit card required [8].
            </p>
          </div>

          {/* Feature List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            <div className="space-y-1.5 text-left">
              <div className="flex items-center gap-2 text-sm font-bold text-[#15171d]">
                <ShoppingCart className="h-4 w-4 text-[#1a623c] shrink-0" />
                <span>Real-Time Active POS Cart</span>
              </div>
              <p className="text-xs text-[#5a6273] leading-relaxed">
                Add products, edit bargaining prices on the fly, and record cash or M-Pesa sales.
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex items-center gap-2 text-sm font-bold text-[#15171d]">
                <Lock className="h-4 w-4 text-[#1a623c] shrink-0" />
                <span>Shift &amp; Till Reconciliation</span>
              </div>
              <p className="text-xs text-[#5a6273] leading-relaxed">
                Close day and audit cash drawers against expected M-Pesa balances with live variance detection.
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex items-center gap-2 text-sm font-bold text-[#15171d]">
                <Users className="h-4 w-4 text-[#1a623c] shrink-0" />
                <span>Customer Credit (Deni) Ledger</span>
              </div>
              <p className="text-xs text-[#5a6273] leading-relaxed">
                Track customer debt, record repayments, and recognize profit only as cash is collected.
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex items-center gap-2 text-sm font-bold text-[#15171d]">
                <Boxes className="h-4 w-4 text-[#1a623c] shrink-0" />
                <span>Preloaded Retail Catalog</span>
              </div>
              <p className="text-xs text-[#5a6273] leading-relaxed">
                16 sample electronics items with buying costs, retail prices, and barcode numbers [8].
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex items-center gap-2 text-sm font-bold text-[#15171d]">
                <BarChart3 className="h-4 w-4 text-[#1a623c] shrink-0" />
                <span>Profit &amp; Loss Reports</span>
              </div>
              <p className="text-xs text-[#5a6273] leading-relaxed">
                Review automated gross revenue, COGS, shop expenses, and true net profit margins.
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex items-center gap-2 text-sm font-bold text-[#15171d]">
                <CheckCircle2 className="h-4 w-4 text-[#1a623c] shrink-0" />
                <span>100% In-Browser Sandbox</span>
              </div>
              <p className="text-xs text-[#5a6273] leading-relaxed">
                Everything runs privately in your local browser storage without creating an account.
              </p>
            </div>
          </div>

          {/* Action CTA Button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">

<Link
  to="/demo"
  className="w-full sm:w-auto bg-[#1a623c] hover:bg-[#144f30] text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
>
  <Play className="h-4 w-4 fill-current" />
  <span>Launch Live Demo Account</span>
</Link>
            <span className="text-xs text-[#767f8f]">
              Instant access · No login required
            </span>
          </div>

        </div>
      </div>

    </section>
  );
}
````

## File: src/components/landing/HowItWorks.jsx
````javascript
import { Link } from 'react-router-dom';
import { ArrowRight, UserPlus, PackagePlus, ShoppingBag } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      num: '1',
      icon: UserPlus,
      title: 'Register Your Business',
      description: 'Set up your shop name, store phone number, and initial user account in under 60 seconds. No credit card required.',
    },
    {
      num: '2',
      icon: PackagePlus,
      title: 'Add or Scan Products',
      description: 'Enter your inventory items with buying cost, selling price, and optional barcode. Add categories and supplier links anytime.',
    },
    {
      num: '3',
      icon: ShoppingBag,
      title: 'Open Counter & Sell',
      description: 'Record multi-item cash, M-Pesa, or credit sales with automatic stock deduction, WhatsApp receipts, and end-of-day till audits.',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 border-t border-[#e8eaed] scroll-mt-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#15171d] tracking-tight">
            Get started in 3 simple steps
          </h2>
          <p className="text-sm sm:text-base text-[#5a6273]">
            No technicians. No complicated setup. No expensive POS hardware.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative pt-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="space-y-4 flex flex-col justify-between pb-6 border-b border-[#e8eaed] md:border-b-0"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#f1faf4] text-[#1a623c] flex items-center justify-center">
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <span className="text-xl font-black text-[#1a623c]">
                      Step 0{step.num}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#15171d]">
                    {step.title}
                  </h3>
                  <p className="text-xs text-[#5a6273] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center pt-4">
          <Link
            to="/setup"
            className="inline-flex items-center justify-center gap-2 bg-[#1a623c] text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:bg-[#144f30] transition-all shadow-sm"
          >
            Create Your Business in 60 Seconds
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
````

## File: src/components/landing/LandingFooter.jsx
````javascript
// src/components/landing/LandingFooter.jsx
import { Link } from 'react-router-dom';
import { Mail, Shield, FileText } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="bg-[#15171d] text-[#cfd3da] border-t border-[#2b303c] pt-14 pb-10 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Footer Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <span className="font-bold text-xl text-white tracking-tight">FlowBiz</span>
            </div>
            <p className="text-xs text-[#9aa2b1] max-w-sm leading-relaxed">
              The offline-first Point of Sale, inventory intelligence, and cash-flow management platform purpose-built for Kenyan retailers and small businesses.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-[#767f8f]">
              <span>Nairobi, Kenya</span>
              <span>·</span>
              <a href="mailto:support@flowbiz.co.ke" className="hover:text-white transition-colors flex items-center gap-1">
                <Mail className="h-3 w-3" /> support@flowbiz.co.ke
              </a>
            </div>
          </div>

          {/* Application Navigation */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white block">
              Application
            </span>
            <ul className="space-y-2 text-[#9aa2b1]">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  POS Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Trust */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white block">
              Trust &amp; Legal
            </span>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-[#54b67c]" />
                  Privacy Policy (KDPA 2019)
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#54b67c]" />
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Line */}
        <div className="pt-8 border-t border-[#2b303c] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#767f8f]">
          <p>© {new Date().getFullYear()} FlowBiz. All rights reserved.</p>
        </div>

      </div>
    </footer>
  );
}
````

## File: src/components/layout/AppShell.jsx
````javascript
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import TopHeader from './TopHeader';

export default function AppShell({ children }) {
  const location = useLocation();
  const isCounterRoute = location.pathname.startsWith('/counter');

  // The Counter page benefits from a wider working area (product grid +
  // checkout panel side by side), so on desktop the sidebar collapses to
  // a slim icon rail automatically the moment it's opened, and expands
  // again on every other page. This never touches mobile — Sidebar is
  // hidden below the lg breakpoint regardless of this state. A person
  // can still override it manually at any time via the toggle at the
  // bottom of the sidebar; navigating away and back to Counter resets it
  // to collapsed again.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isCounterRoute);

  useEffect(() => {
    setSidebarCollapsed(isCounterRoute);
  }, [isCounterRoute]);

  return (
    <div className="flex min-h-screen bg-sand">
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)} />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <TopHeader />
        <main className="flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:px-6 lg:pb-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
````

## File: src/components/layout/BottomNav.jsx
````javascript
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { Menu } from 'lucide-react';
import { NAV_ITEMS, MOBILE_PRIMARY } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import MobileMoreDrawer from './MobileMoreDrawer';

export default function BottomNav() {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const [moreOpen, setMoreOpen] = useState(false);

  const allowedPaths = MOBILE_PRIMARY[isAdmin ? 'admin' : 'cashier'];
  const items = allowedPaths
    .map((path) => NAV_ITEMS.find((item) => item.to === path))
    .filter(Boolean)
    .filter((item) => item.to !== '/expenses' || isAdmin || settings.cashierCanRecordExpenses);

  const Icon = ({ name, className = 'h-5 w-5' }) => {
    const Component = Lucide[name] || Lucide.Circle;
    return <Component className={className} strokeWidth={1.75} />;
  };

  return (
    <>
      {/* Position/visibility unchanged — stays fixed to the bottom on
          mobile (lg:hidden), only the active-tab color moved to blue. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-100 bg-white/95 backdrop-blur lg:hidden">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
              isActive ? 'text-moss-700' : 'text-ink-400'              }`
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-ink-400"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
          More
        </button>
      </nav>

      <MobileMoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
````

## File: src/components/layout/MobileMoreDrawer.jsx
````javascript
import { NavLink } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { X } from 'lucide-react';

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const Component = Lucide[name] || Lucide.Circle;
  return <Component className={className} strokeWidth={1.75} />;
};

// Full page list for phones — the sidebar is desktop-only (lg:flex), and the
// bottom bar only fits a handful of shortcuts, so this covers everything else
// (Products, Purchases, Suppliers, Stock Take, Users, etc.) behind one button.
export default function MobileMoreDrawer({ open, onClose }) {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).filter(
    (item) => item.to !== '/expenses' || isAdmin || settings.cashierCanRecordExpenses
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-xl2 bg-white p-4 pb-8 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-ink-900">All pages</h2>
          <button onClick={onClose} className="p-1.5 rounded text-ink-400 hover:bg-ink-50 hover:text-ink-700">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center text-[11px] font-semibold ${
                 isActive
                    ? 'border-moss-200 bg-moss-50 text-moss-800'
                    : 'border-ink-100 text-ink-500 hover:bg-ink-50'
                }`
              }
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}
````

## File: src/components/pos/OpenSessionPrompt.jsx
````javascript
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Store } from 'lucide-react';

export default function OpenSessionPrompt({ onOpen }) {
  const [cash, setCash]     = useState('');
  const [mpesa, setMpesa]   = useState('');
  const [busy, setBusy]     = useState(false);
  const handle = async e => {
    e.preventDefault(); setBusy(true);
    try {
      await onOpen({ openingCashFloat: Number(cash)||0, openingMpesaFloat: Number(mpesa)||0 });
    } catch (err) {
      // FIX: previously any failure here was silently swallowed — the
      // button would just stop spinning with no explanation.
      toast.error(err.message || "Couldn't open the counter. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-sm pt-8">
      <div className="card p-6 space-y-4">
        <div className="text-center"><Store className="h-10 w-10 text-moss-600 mx-auto mb-2" strokeWidth={1.5} />
          <h2 className="font-display text-lg font-bold text-ink-900">Open today's counter</h2>
          <p className="text-sm text-ink-400 mt-1">Enter starting balances for accurate end-of-day reconciliation.</p>
        </div>
        <form onSubmit={handle} className="space-y-3">
          <div><label className="label">Opening cash float (KES)</label><input type="number" min="0" className="input" value={cash} onChange={e=>setCash(e.target.value)} placeholder="0" autoFocus /></div>
          <div><label className="label">Opening M-Pesa balance (KES)</label><input type="number" min="0" className="input" value={mpesa} onChange={e=>setMpesa(e.target.value)} placeholder="0" /></div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Opening…' : 'Open counter'}</button>
        </form>
      </div>
    </div>
  );
}
````

## File: src/components/pos/ProductGrid.jsx
````javascript
import { formatKES } from '../../utils/currency';
import { Pencil, ShoppingCart } from 'lucide-react';

// FIX (cart visibility): `cartQuantities` is an optional map of
// productId -> quantity currently in the Counter page's cart. When a
// product is in the cart, its card gets a moss highlight and a small
// "N in cart" badge — persistent visual confirmation that a tap/scan
// actually registered, instead of relying on a toast that disappears.
// Pages that don't pass this prop (Products.jsx) render exactly as
// before.
export default function ProductGrid({ products, onSelect, isAdmin=false, onEdit, cartQuantities = {} }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map(p => {
        const out = p.stock <= 0;
        const low = !out && p.stock <= (p.lowStockThreshold ?? 5);
        const inCartQty = cartQuantities[p.id] || 0;
        const inCart = inCartQty > 0;
        return (
          <div
            key={p.id}
            className={`relative flex flex-col rounded-xl border bg-white p-3 transition-shadow ${
              out ? 'opacity-50 border-ink-100'
              : inCart ? 'border-moss-400 ring-1 ring-moss-300 shadow-sm'
              : low ? 'border-rust-200 shadow-sm'
              : 'border-ink-100 shadow-sm hover:shadow-md'
            }`}
          >
            {inCart && (
              <span className="absolute -top-2 -right-2 z-10 flex items-center gap-1 rounded-full bg-moss-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                <ShoppingCart className="h-3 w-3" strokeWidth={2} />{inCartQty}
              </span>
            )}
            <button disabled={out} onClick={()=>onSelect(p)} className="flex-1 flex flex-col items-start gap-1 text-left w-full disabled:pointer-events-none">
              <span className="badge bg-ink-100 text-ink-400 text-[10px] mb-0.5">{p.category}</span>
              <span className="font-semibold text-[13px] leading-tight text-ink-800 line-clamp-2">{p.name}</span>
              <span className="font-display text-sm font-bold text-moss-700">{formatKES(p.sellingPrice)}</span>
              <span className={`text-[11px] font-medium ${out ? 'text-rust-600' : low ? 'text-rust-500' : 'text-ink-400'}`}>
                {out ? 'Out of stock' : `${p.stock} left${low ? ' ⚠️' : ''}`}
              </span>
            </button>
            {isAdmin && onEdit && (
              <button onClick={e=>{e.stopPropagation();onEdit(p);}} className="absolute top-1 right-1 p-1 rounded text-ink-300 hover:bg-ink-50 hover:text-ink-600">
                <Pencil className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
````

## File: src/components/pos/SaleModal.jsx
````javascript
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { formatKES } from '../../utils/currency';
import { Banknote, Smartphone, BookOpen } from 'lucide-react';
import { raceWithTimeout } from '../../utils/offlineWrite';
import { friendlyErrorMessage } from '../../utils/errorMessages';

const METHODS = [
  { id: 'Cash',   label: 'Cash',   Icon: Banknote   },
  { id: 'M-Pesa', label: 'M-Pesa', Icon: Smartphone },
  { id: 'Credit', label: 'Credit', Icon: BookOpen   },
];

export default function SaleModal({ open, product, customers, onClose, onConfirmSale, onConfirmCredit, onCreateCustomer }) {
  const [quantity, setQuantity]               = useState(1);
  const [price, setPrice]                     = useState(product?.sellingPrice ?? 0);
  const [method, setMethod]                   = useState('Cash');
  const [mpesaCode, setMpesaCode]             = useState('');
  const [customerId, setCustomerId]           = useState('');
  const [newMode, setNewMode]                 = useState(false);
  const [newName, setNewName]                 = useState('');
  const [newPhone, setNewPhone]               = useState('');
  const [submitting, setSubmitting]           = useState(false);

  useEffect(() => {
    setQuantity(1); setPrice(product?.sellingPrice ?? 0); setMethod('Cash');
    setMpesaCode(''); setCustomerId(''); setNewMode(false); setNewName(''); setNewPhone('');
  }, [product?.id, product?.sellingPrice]);

  if (!product) return null;

  const total        = (Number(price) || 0) * (Number(quantity) || 0);
  const exceedsStock = Number(quantity) > product.stock;
  const needsMpesaCode = method === 'M-Pesa' && !mpesaCode.trim();
  const needsCustomer  = method === 'Credit' && !customerId && !(newMode && newName.trim());
  const canSubmit = Number(quantity) > 0 && !exceedsStock && Number(price) >= 0 && !needsMpesaCode && !needsCustomer && !submitting;

const handleConfirm = async () => {
    setSubmitting(true);
    try {
      let cId = customerId, cName = customers.find(c=>c.id===customerId)?.name, cPhone = customers.find(c=>c.id===customerId)?.phone;
      if (method === 'Credit' && newMode) {
        const cr = await onCreateCustomer({ name: newName.trim(), phone: newPhone.trim() });
        cId = cr.id; cName = cr.name; cPhone = cr.phone;
      }

      const { record, commit } = method === 'Credit'
        ? onConfirmCredit({ product, quantity: Number(quantity), soldPricePerUnit: Number(price), customerId: cId, customerName: cName, customerPhone: cPhone })
        : onConfirmSale({ product, quantity: Number(quantity), soldPricePerUnit: Number(price), paymentMethod: method, mpesaCode: method === 'M-Pesa' ? mpesaCode.trim() : null });

      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      if (queuedOffline) {
        toast.success("Sale saved — it'll sync once you're back online.");
        commit.catch((err) => toast.error(`A sale from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      }
      onClose(record);
    } catch (err) {
      toast.error(friendlyErrorMessage(err, {
        overrides: { 'permission-denied': "That didn't go through — the stock may have just changed, or today's session may have been closed. Please refresh and try again." },
      }));
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={() => onClose(null)} title="Record Sale">
      <div className="space-y-4">
        <div className="rounded-lg bg-ink-50 px-3 py-2.5">
          <p className="font-semibold text-ink-800">{product.name}</p>
          <p className="text-xs text-ink-400">In stock: <span className="font-semibold">{product.stock}</span> · Default {formatKES(product.sellingPrice)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity</label>
            <input type="number" min="1" max={product.stock} className="input" value={quantity} onChange={e=>setQuantity(e.target.value)} />
            {exceedsStock && <p className="mt-1 text-xs font-medium text-rust-600">Only {product.stock} left.</p>}
          </div>
          <div>
            <label className="label">Price / unit (KES)</label>
            <input type="number" min="0" step="0.01" className="input" value={price} onChange={e=>setPrice(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5">
          <span className="text-sm font-medium text-ink-500">Total</span>
          <span className="font-display text-lg font-bold text-ink-900">{formatKES(total)}</span>
        </div>
        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(({id,label,Icon}) => (
              <button key={id} type="button" onClick={()=>setMethod(id)} className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-semibold ${method===id ? 'border-moss-600 bg-moss-50 text-moss-800' : 'border-ink-200 text-ink-500'}`}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />{label}
              </button>
            ))}
          </div>
        </div>
        {method === 'M-Pesa' && (
          <div>
            <label className="label">M-Pesa transaction code <span className="text-rust-500">*</span></label>
            <input className="input uppercase" placeholder="e.g. QWE1234567" value={mpesaCode} onChange={e=>setMpesaCode(e.target.value.toUpperCase())} />
            {needsMpesaCode && <p className="mt-1 text-xs text-rust-600">Transaction code required for M-Pesa sales.</p>}
          </div>
        )}
        {method === 'Credit' && (
          <div className="space-y-2 rounded-lg border border-ink-100 p-3">
            {!newMode ? (
              <>
                <label className="label">Customer (Deni)</label>
                <select className="input" value={customerId} onChange={e=>setCustomerId(e.target.value)}>
                  <option value="">— Select customer —</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}</option>)}
                </select>
                <button type="button" className="text-xs font-semibold text-moss-700 hover:underline" onClick={()=>setNewMode(true)}>+ New customer</button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between"><label className="label">New customer</label><button type="button" className="text-xs text-ink-400 hover:underline" onClick={()=>setNewMode(false)}>Use existing</button></div>
                <input className="input" placeholder="Customer name" value={newName} onChange={e=>setNewName(e.target.value)} />
                <input className="input" placeholder="Phone (07xx...)" value={newPhone} onChange={e=>setNewPhone(e.target.value)} />
              </>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={() => onClose(null)}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!canSubmit} onClick={handleConfirm}>
            {submitting ? 'Recording…' : method==='Credit' ? 'Record credit' : 'Confirm sale'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
````

## File: src/demo/localFirestore.js
````javascript
// src/demo/localFirestore.js
const STORAGE_PREFIX = 'flowbiz_demo_data:';

const cache = new Map();
const listeners = new Map();
let idCounter = 0;

function generateId() {
  idCounter += 1;
  return `demo_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function makeTimestamp(millis) {
  return {
    __ts: true,
    millis,
    toDate() { return new Date(millis); },
    toMillis() { return millis; },
  };
}

function reviver(key, value) {
  if (value && typeof value === 'object' && value.__ts === true && typeof value.millis === 'number') {
    return makeTimestamp(value.millis);
  }
  return value;
}

function ensureLoaded(name) {
  if (!cache.has(name)) {
    let obj = {};
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + name);
      if (raw) obj = JSON.parse(raw, reviver);
    } catch { }
    cache.set(name, new Map(Object.entries(obj)));
  }
  return cache.get(name);
}

function getRaw(name, id) { return ensureLoaded(name).get(id) || null; }
function writeRaw(name, id, data) { ensureLoaded(name).set(id, data); }
function deleteRaw(name, id) { ensureLoaded(name).delete(id); }

function persistTouched(names) {
  names.forEach((name) => {
    const map = ensureLoaded(name);
    localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(Object.fromEntries(map)));
  });
}

function subscribe(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name)?.delete(fn);
}

function notify(names) { names.forEach((name) => listeners.get(name)?.forEach((fn) => fn())); }

function isSentinel(v, kind) { return !!v && typeof v === 'object' && v.__sentinel === kind; }

function resolveWriteData(data, base) {
  const out = base ? { ...base } : {};
  Object.entries(data).forEach(([k, v]) => {
    if (isSentinel(v, 'serverTimestamp')) out[k] = makeTimestamp(Date.now());
    else if (isSentinel(v, 'increment')) out[k] = (typeof out[k] === 'number' ? out[k] : 0) + v.n;
    else if (isSentinel(v, 'deleteField')) delete out[k];
    else out[k] = v;
  });
  return out;
}

export function increment(n) { return { __sentinel: 'increment', n }; }
export function serverTimestamp() { return { __sentinel: 'serverTimestamp' }; }
export function deleteField() { return { __sentinel: 'deleteField' }; }

export function collection(_db, name) { return { __type: 'collection', name }; }
export function doc(a, b, c) {
  if (a && a.__type === 'collection') {
    return { __type: 'doc', name: a.name, id: b || generateId() };
  }
  return { __type: 'doc', name: b, id: c || generateId() };
}

function makeDocSnapshot(id, data) {
  return { id, exists: () => !!data, data: () => (data ? { ...data } : undefined) };
}

function makeQuerySnapshot(rows) {
  const docs = rows.map(([id, data]) => makeDocSnapshot(id, data));
  return { docs, empty: docs.length === 0, size: docs.length, forEach(fn) { docs.forEach(fn); } };
}

function getField(data, docId, field) {
  if (field === '__name__') return docId;
  return data ? data[field] : undefined;
}

function toComparable(v) {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return v;
}

function matchWhere(fieldVal, op, value) {
  const a = toComparable(fieldVal);
  const b = toComparable(value);
  switch (op) {
    case '==': return a === b;
    case '!=': return a !== b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '>':  return a > b;
    case '<':  return a < b;
    case 'in': return Array.isArray(value) && value.includes(fieldVal);
    case 'array-contains': return Array.isArray(fieldVal) && fieldVal.includes(value);
    default: return true;
  }
}

function compareField(a, b) {
  const av = toComparable(a); const bv = toComparable(b);
  if (av == null && bv == null) return 0;
  if (av == null) return -1;
  if (bv == null) return 1;
  if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function runQuery(target) {
  const name = target.__type === 'query' ? target.__collName : target.name;
  let rows = [...ensureLoaded(name).entries()];
  const constraints = target.__type === 'query' ? target.constraints : [];
  constraints.filter((c) => c.kind === 'where').forEach((c) => {
    rows = rows.filter(([id, data]) => matchWhere(getField(data, id, c.field), c.op, c.value));
  });
  const orderC = constraints.find((c) => c.kind === 'orderBy');
  if (orderC) {
    rows = [...rows].sort(
      (a, b) => compareField(getField(a[1], a[0], orderC.field), getField(b[1], b[0], orderC.field)) * (orderC.dir === 'desc' ? -1 : 1)
    );
  }
  const limitC = constraints.find((c) => c.kind === 'limit');
  if (limitC) rows = rows.slice(0, limitC.n);
  return rows;
}

export function query(collRef, ...constraints) {
  return { __type: 'query', __collName: collRef.name, constraints };
}
export function where(field, op, value) { return { kind: 'where', field, op, value }; }
export function orderBy(field, dir = 'asc') { return { kind: 'orderBy', field, dir }; }
export function limit(n) { return { kind: 'limit', n }; }

export async function addDoc(collRef, data) {
  const id = generateId();
  writeRaw(collRef.name, id, resolveWriteData(data, null));
  persistTouched([collRef.name]);
  notify([collRef.name]);
  return { __type: 'doc', name: collRef.name, id };
}
export async function setDoc(ref, data, opts) {
  const base = opts?.merge ? getRaw(ref.name, ref.id) : null;
  writeRaw(ref.name, ref.id, resolveWriteData(data, base));
  persistTouched([ref.name]);
  notify([ref.name]);
}
export async function updateDoc(ref, data) {
  const existing = getRaw(ref.name, ref.id);
  if (!existing) throw new Error(`[demo] No document to update at ${ref.name}/${ref.id}`);
  writeRaw(ref.name, ref.id, resolveWriteData(data, existing));
  persistTouched([ref.name]);
  notify([ref.name]);
}
export async function deleteDoc(ref) {
  deleteRaw(ref.name, ref.id);
  persistTouched([ref.name]);
  notify([ref.name]);
}
export async function getDoc(ref) {
  return makeDocSnapshot(ref.id, getRaw(ref.name, ref.id));
}
export async function getDocs(target) {
  return makeQuerySnapshot(runQuery(target));
}
export function onSnapshot(target, onNext, onError) {
  const isDocRef = target.__type === 'doc';
  const key = isDocRef ? target.name : target.__collName;
  const deliver = () => {
    try {
      if (isDocRef) onNext(makeDocSnapshot(target.id, getRaw(target.name, target.id)));
      else onNext(makeQuerySnapshot(runQuery(target)));
    } catch (err) {
      onError?.(err);
    }
  };
  const timer = setTimeout(deliver, 0);
  const unsub = subscribe(key, deliver);
  return () => { clearTimeout(timer); unsub(); };
}

export function writeBatch() {
  const ops = [];
  return {
    set(ref, data, opts) { ops.push({ type: 'set', ref, data, opts }); },
    update(ref, data) { ops.push({ type: 'update', ref, data }); },
    delete(ref) { ops.push({ type: 'delete', ref }); },
    async commit() {
      const touched = new Set();
      for (const op of ops) {
        if (op.type === 'set') {
          const base = op.opts?.merge ? getRaw(op.ref.name, op.ref.id) : null;
          writeRaw(op.ref.name, op.ref.id, resolveWriteData(op.data, base));
        } else if (op.type === 'update') {
          const existing = getRaw(op.ref.name, op.ref.id) || {};
          writeRaw(op.ref.name, op.ref.id, resolveWriteData(op.data, existing));
        } else if (op.type === 'delete') {
          deleteRaw(op.ref.name, op.ref.id);
        }
        touched.add(op.ref.name);
      }
      persistTouched([...touched]);
      notify([...touched]);
    },
  };
}

export async function runTransaction(_db, updateFn) {
  const touched = new Set();
  const tx = {
    async get(ref) { return makeDocSnapshot(ref.id, getRaw(ref.name, ref.id)); },
    set(ref, data, opts) {
      const base = opts?.merge ? getRaw(ref.name, ref.id) : null;
      writeRaw(ref.name, ref.id, resolveWriteData(data, base));
      touched.add(ref.name);
    },
    update(ref, data) {
      const existing = getRaw(ref.name, ref.id) || {};
      writeRaw(ref.name, ref.id, resolveWriteData(data, existing));
      touched.add(ref.name);
    },
    delete(ref) { deleteRaw(ref.name, ref.id); touched.add(ref.name); },
  };
  const result = await updateFn(tx);
  persistTouched([...touched]);
  notify([...touched]);
  return result;
}

export function initializeFirestore() { return { __demo: true }; }
export function persistentLocalCache() { return {}; }
export function persistentMultipleTabManager() { return {}; }
export function connectFirestoreEmulator() {}

export function seedDoc(name, id, data) { writeRaw(name, id, data); }
export function seedCommit(names) { persistTouched(names); notify(names); }
export function clearAllDemoData() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(STORAGE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
  const touched = [...cache.keys()];
  cache.clear();
  notify(touched);
}
export { makeTimestamp };
````

## File: src/hooks/useDailySession.js
````javascript
import { useEffect, useState, useCallback } from 'react';
import { doc, setDoc, updateDoc, deleteField, serverTimestamp, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { todayKey } from '../utils/dateRanges';

export function useDailySession() {
  const { businessId } = useAuth();
  const [session, setSession] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  const sessionId = businessId ? `${businessId}_${todayKey()}` : null;

  useEffect(() => {
    if (!sessionId) { setSession(null); setLoading(false); return; }
    const ref = doc(db, 'dailySessions', sessionId);
    const unsub = onSnapshot(ref,
      snap => { setSession(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, [sessionId]);

  const isClosed = !!(session?.closedAt);

  const openSession = useCallback(async ({ openingCashFloat, openingMpesaFloat, openedBy }) => {
    if (!sessionId || !businessId) return;
    const ref = doc(db, 'dailySessions', sessionId);
    await setDoc(ref, {
      businessId,
      date: todayKey(),
      openingCashFloat:  Number(openingCashFloat)  || 0,
      openingMpesaFloat: Number(openingMpesaFloat) || 0,
      openedBy, openedAt: new Date(),
      closedAt: null, closedBy: null,
    }, { merge: true });
    // FIX: don't rely solely on onSnapshot to reflect a write we just
    // made ourselves. If the realtime listener's connection is briefly
    // disrupted (ad blockers / some proxies interfere with Firestore's
    // long-polling channel — see firebase.js), the "Open counter" screen
    // could stay up even though the session doc already exists in
    // Firestore. Read it back directly and update the screen now; the
    // listener will simply confirm the same data whenever it catches up.
    try {
      const fresh = await getDoc(ref);
      if (fresh.exists()) setSession({ id: fresh.id, ...fresh.data() });
    } catch {
      // Non-fatal — the listener will still update the UI once it
      // reconnects.
    }
  }, [sessionId, businessId]);

  const reopenSession = useCallback(async () => {
    if (!isClosed || !sessionId) return;
    const ref = doc(db, 'dailySessions', sessionId);
    await updateDoc(ref, {
      closedAt: deleteField(), closedBy: deleteField(),
    });
    try {
      const fresh = await getDoc(ref);
      if (fresh.exists()) setSession({ id: fresh.id, ...fresh.data() });
    } catch {
      // Non-fatal — see note above.
    }
  }, [isClosed, sessionId]);

  return { session, loading, sessionId, isClosed, openSession, reopenSession };
}
````

## File: src/hooks/useFinancials.js
````javascript
import { useEffect, useRef, useState } from 'react';
import { where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { computeFinancials } from '../utils/financials';

export function useFinancialsForRange(start, end) {
  const { businessId } = useAuth();
  const [state, setState] = useState({
    loading: true, error: null,
    sales: [], creditSales: [], expenses: [], repayments: [], purchases: [], supplierPayments: [], refunds: [],
    summary: computeFinancials({}),
  });
  const dataRef = useRef({ sales: [], creditSales: [], allCreditSales: [], expenses: [], repayments: [], purchases: [], supplierPayments: [], refunds: [] });
  const rafRef  = useRef(null);

  useEffect(() => {
    if (!start || !end || !businessId) return;
    let mounted = true;

    const flush = () => {
      if (!mounted) return;
      const { sales, allCreditSales, expenses, repayments, purchases, supplierPayments, refunds } = dataRef.current;
      const startMs = typeof start?.toMillis === 'function' ? start.toMillis() : (start instanceof Date ? start.getTime() : new Date(start).getTime());
      const endMs = typeof end?.toMillis === 'function' ? end.toMillis() : (end instanceof Date ? end.getTime() : new Date(end).getTime());

      const rangeCreditSales = allCreditSales.filter((entry) => {
        const raw = entry?.soldAt;
        const soldAt = raw?.toMillis?.() ?? (raw instanceof Date ? raw.getTime() : (typeof raw === 'number' ? raw : (raw?.toDate?.()?.getTime?.() ?? Date.now())));
        return typeof soldAt === 'number' && soldAt >= startMs && soldAt <= endMs;
      });

      setState({
        loading: false, error: null,
        sales, creditSales: rangeCreditSales, expenses, repayments, purchases, supplierPayments, refunds,
        summary: computeFinancials({ sales, creditSales: rangeCreditSales, allCreditSales, expenses, debtRepayments: repayments, purchases, supplierPayments, refunds }),
      });
    };

    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(flush);
    };

    const onErr = err => mounted && setState(s => ({ ...s, loading: false, error: err.message }));

    const salesQ      = tenantQuery('sales', businessId, where('soldAt','>=',start), where('soldAt','<=',end), orderBy('soldAt','desc'));
    const creditQ     = tenantQuery('creditSales', businessId, orderBy('soldAt','desc'));
    const expensesQ   = tenantQuery('expenses', businessId, where('recordedAt','>=',start), where('recordedAt','<=',end), orderBy('recordedAt','desc'));
    const repaymentsQ = tenantQuery('repayments', businessId, where('paidAt','>=',start), where('paidAt','<=',end), orderBy('paidAt','desc'));
    const purchasesQ  = tenantQuery('purchases', businessId, where('purchasedAt','>=',start), where('purchasedAt','<=',end), orderBy('purchasedAt','desc'));
    const supplierPaymentsQ = tenantQuery('supplierPayments', businessId, where('paidAt','>=',start), where('paidAt','<=',end), orderBy('paidAt','desc'));
    const refundsQ = tenantQuery('refunds', businessId, where('refundedAt','>=',start), where('refundedAt','<=',end), orderBy('refundedAt','desc'));

    const u1 = onSnapshot(salesQ,      s => { dataRef.current.sales      = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u2 = onSnapshot(creditQ,     s => { dataRef.current.allCreditSales = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u3 = onSnapshot(expensesQ,   s => { dataRef.current.expenses   = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u4 = onSnapshot(repaymentsQ, s => { dataRef.current.repayments = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u5 = onSnapshot(purchasesQ,  s => { dataRef.current.purchases  = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u6 = onSnapshot(supplierPaymentsQ, s => { dataRef.current.supplierPayments = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);
    const u7 = onSnapshot(refundsQ, s => { dataRef.current.refunds = s.docs.map(d=>({id:d.id,...d.data()})); schedule(); }, onErr);

    return () => {
      mounted = false;
      u1(); u2(); u3(); u4(); u5(); u6(); u7();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [start, end, businessId]);

  return state;
}
````

## File: src/hooks/useFirestoreCollection.js
````javascript
import { useCallback, useEffect, useState } from 'react';
import { onSnapshot, getDocs } from 'firebase/firestore';

export function useFirestoreCollection(queryRef) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!queryRef) { setData([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(queryRef,
      snap => { setData(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); setError(null); },
      err  => { setError(err.message); setLoading(false); }
    );
    return unsub;
  }, [queryRef]);

  const refetch = useCallback(async () => {
    if (!queryRef) return;
    try {
      const snap = await getDocs(queryRef);
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { setError(err.message); }
  }, [queryRef]);

  return { data, loading, error, refetch };
}
````

## File: src/hooks/useHardwareScanner.js
````javascript
// src/hooks/useHardwareScanner.js
import { useEffect, useRef } from 'react';

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}


export function useHardwareScanner(onScan, { enabled = true, maxIntervalMs = 80, minLength = 4 } = {}) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      if (isTypingTarget(document.activeElement)) {
        bufferRef.current = '';
        return;
      }

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter' || e.key === 'Tab') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= minLength) {
          onScan(code);
        }
        return;
      }

      if (e.key.length !== 1) return; // ignore Shift, arrow keys, etc.

      if (elapsed > maxIntervalMs) {
        bufferRef.current = '';
      }
      bufferRef.current += e.key;
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onScan, maxIntervalMs, minLength]);
}
````

## File: src/hooks/usePwaInstall.js
````javascript
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    const userAgent = (navigator.userAgent || '').toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice && !standalone);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) {
      if (/iphone|ipad|ipod/.test((navigator.userAgent || '').toLowerCase())) {
        return false;
      }
      toast('To install, tap your browser menu (⋮) and select "Install app" or "Add to Home screen".');
      return false;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
    return outcome === 'accepted';
  };

  return { isInstallable, isIOS, isStandalone, promptInstall };
}
````

## File: src/hooks/useSettings.js
````javascript
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_CATEGORIES = [
  'Beverages',
  'Hardware',
  'Household',
  'Personal Care',
  'Stationery',
  'Airtime/Float',
  'Other',
];

const DEFAULTS = { 
  shopName: 'FlowBiz', 
  cashierCanRecordExpenses: true, 
  categories: DEFAULT_CATEGORIES,
  phone: '',
  email: '',
  address: '',
  logoUrl: '',
};

export function useSettings() {
  const { businessId } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) {
      setSettings(DEFAULTS);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'businessSettings', businessId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const rawCategories = Array.isArray(data.categories) ? data.categories : DEFAULT_CATEGORIES;
          const cleanedCategories = rawCategories.filter(
            (c) => c && c.trim().toLowerCase() !== 'groceries'
          );
          setSettings({
            ...DEFAULTS,
            ...data,
            categories: cleanedCategories.length > 0 ? cleanedCategories : DEFAULT_CATEGORIES,
            businessId,
          });
        } else {
          setSettings({ ...DEFAULTS, businessId });
        }
        setLoading(false);
      },
      () => {
        setSettings({ ...DEFAULTS, businessId });
        setLoading(false);
      }
    );
    return unsub;
  }, [businessId]);

  return { settings, loading };
}
````

## File: src/pages/LandingPage.jsx
````javascript
// src/pages/LandingPage.jsx
import { LandingHeader } from '../components/landing/LandingHeader';
import { HeroSection } from '../components/landing/HeroSection';
import { FeatureGrid } from '../components/landing/FeatureGrid';
import { HowItWorks } from '../components/landing/HowItWorks';
import { PricingComparison } from '../components/landing/PricingComparison';
import { FaqSection } from '../components/landing/FaqSection';
import { LandingFooter } from '../components/landing/LandingFooter';
import WhatsAppFloatingButton from '../components/common/WhatsAppFloatingButton';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#faf6ef] text-[#15171d] flex flex-col">
      <LandingHeader />
      <main className="flex-1">
        <HeroSection />
        <FeatureGrid />
        <HowItWorks />
        <PricingComparison />
        <FaqSection />
      </main>
      <LandingFooter />
      
      {/* Floating 1-tap WhatsApp chat button */}
      <WhatsAppFloatingButton />
    </div>
  );
}
````

## File: src/utils/currency.js
````javascript
export function formatKES(amount) {
  const v = Number(amount) || 0;
  return `KES ${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function formatKESCompact(amount) {
  return `KES ${Math.round(Number(amount) || 0).toLocaleString('en-KE')}`;
}

// FIX (multi-product cart): quantity × unit price, summed across several
// cart lines, can accumulate binary floating-point noise (e.g.
// 0.1 + 0.2 = 0.30000000000000004). Every money total the cart computes —
// a line total, the cart grand total, aggregated COGS/profit written to
// Firestore — is rounded through this before being displayed or saved.
export function roundMoney(amount) {
  const v = Number(amount);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
````

## File: src/utils/dataExport.js
````javascript
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const EXPORT_COLLECTIONS = [
  'businessSettings',
  'customers', 'suppliers', 'products', 'sales', 'creditSales', 'purchases',
  'expenses', 'dailySessions', 'repayments', 'supplierPayments',
  'stockAdjustments', 'refunds', 'debtPaymentReceipts', 'sharedDocuments', 'staffInvites',
];

function timestampToIso(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function flattenForCsv(docData) {
  const flat = {};
  Object.entries(docData).forEach(([key, value]) => {
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      flat[key] = JSON.stringify(value);
    } else {
      flat[key] = value ?? '';
    }
  });
  return flat;
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function rowsToCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Array.from(rows.reduce((set, row) => { Object.keys(row).forEach((k) => set.add(k)); return set; }, new Set()));
  const lines = [headers.join(',')];
  rows.forEach((row) => lines.push(headers.map((h) => escapeCsvCell(row[h])).join(',')));
  return lines.join('\n');
}

export async function exportBusinessData(businessId, { onProgress } = {}) {
  if (!businessId) throw new Error('exportBusinessData() called with no businessId');

  const manifest = { exportedAt: new Date().toISOString(), businessId, collections: {} };
  const csvFiles = {};

  for (let i = 0; i < EXPORT_COLLECTIONS.length; i++) {
    const name = EXPORT_COLLECTIONS[i];
    onProgress?.(name, i, EXPORT_COLLECTIONS.length);

    const q = name === 'businessSettings'
      ? query(collection(db, name), where('__name__', '==', businessId))
      : query(collection(db, name), where('businessId', '==', businessId));

    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => {
      const jsonSafe = {};
      Object.entries(d.data()).forEach(([k, v]) => { jsonSafe[k] = timestampToIso(v); });
      return { id: d.id, ...jsonSafe };
    });

    manifest.collections[name] = docs;
    csvFiles[name] = rowsToCsv(docs.map((d) => {
      const { id, ...rest } = d;
      return { id, ...flattenForCsv(rest) };
    }));
  }

  return { manifest, csvFiles };
}

export async function buildExportZip(businessId, { onProgress } = {}) {
  const { manifest, csvFiles } = await exportBusinessData(businessId, { onProgress });
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  zip.file('flowbiz-export.json', JSON.stringify(manifest, null, 2));
  const csvFolder = zip.folder('csv');
  Object.entries(csvFiles).forEach(([name, csv]) => { if (csv) csvFolder.file(`${name}.csv`, csv); });

  return zip.generateAsync({ type: 'blob' });
}
````

## File: src/utils/dataImport.js
````javascript
import { doc, writeBatch, getDocs, query, collection, where, limit } from 'firebase/firestore';
import { db } from '../firebase';

export const IMPORT_COLLECTIONS = [
  'businessSettings',
  'customers', 'suppliers', 'products', 'sales', 'creditSales', 'purchases',
  'expenses', 'dailySessions', 'repayments', 'supplierPayments',
  'stockAdjustments', 'refunds', 'debtPaymentReceipts', 'sharedDocuments', 'staffInvites',
];

function isoToDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

function reviveValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return isoToDate(value);
  if (Array.isArray(value)) return value.map(reviveValue);
  if (typeof value === 'object' && !(value instanceof Date)) {
    const obj = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = reviveValue(v);
    }
    return obj;
  }
  return value;
}

function reviveDoc(data) {
  const revived = {};
  Object.entries(data).forEach(([k, v]) => { revived[k] = reviveValue(v); });
  return revived;
}

export async function readExportZip(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('flowbiz-export.json');
  if (!manifestFile) throw new Error("That doesn't look like a FlowBiz export — flowbiz-export.json was not found in the zip archive.");
  const text = await manifestFile.async('string');
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw new Error('flowbiz-export.json is not valid — the file may be corrupted.');
  }
  if (!manifest.collections || typeof manifest.collections !== 'object') {
    throw new Error("That doesn't look like a valid FlowBiz export — missing collection data.");
  }
  return manifest;
}

export async function checkExistingData(businessId, manifest) {
  if (!businessId) throw new Error('checkExistingData requires a businessId');
  const nonEmpty = [];
  for (const name of IMPORT_COLLECTIONS) {
    if (!manifest.collections[name]?.length) continue;
    try {
      if (name === 'businessSettings') {
        const snap = await getDocs(query(collection(db, name), where('__name__', '==', businessId), limit(1)));
        if (!snap.empty) nonEmpty.push(name);
      } else {
        const snap = await getDocs(query(collection(db, name), where('businessId', '==', businessId), limit(1)));
        if (!snap.empty) nonEmpty.push(name);
      }
    } catch {
      // Continue checking remaining collections
    }
  }
  return nonEmpty;
}

function resolveTargetId(name, originalId, businessId, manifestBusinessId) {
  if (name === 'businessSettings') return businessId;
  if (name === 'dailySessions') {
    const dateMatch = originalId.match(/(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) return `${businessId}_${dateMatch[1]}`;
  }
  if (manifestBusinessId && manifestBusinessId !== businessId) {
    if (originalId.startsWith(`${manifestBusinessId}_`)) {
      return originalId.replace(`${manifestBusinessId}_`, `${businessId}_`);
    }
    return `${businessId}_${originalId}`;
  }
  return originalId;
}

export async function importBusinessData(businessId, manifest, { onProgress } = {}) {
  if (!businessId) throw new Error('importBusinessData() called with no businessId');

  const results = {};
  const barcodeEntries = [];
  const manifestBusinessId = manifest.businessId || null;
  const isCrossTenant = Boolean(manifestBusinessId && manifestBusinessId !== businessId);

  for (let i = 0; i < IMPORT_COLLECTIONS.length; i++) {
    const name = IMPORT_COLLECTIONS[i];
    const docs = manifest.collections[name] || [];
    onProgress?.(name, i, IMPORT_COLLECTIONS.length);
    if (docs.length === 0) { results[name] = 0; continue; }

    let written = 0;
    for (let start = 0; start < docs.length; start += 350) {
      const chunk = docs.slice(start, start + 350);
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        const { id, ...rest } = d;
        if (!id) return;
        const revived = reviveDoc(rest);
        revived.businessId = businessId;

        // Remap cross-references if restoring across different business IDs
        if (isCrossTenant) {
          if (revived.productId) revived.productId = resolveTargetId('products', revived.productId, businessId, manifestBusinessId);
          if (revived.supplierId) revived.supplierId = resolveTargetId('suppliers', revived.supplierId, businessId, manifestBusinessId);
          if (revived.customerId) revived.customerId = resolveTargetId('customers', revived.customerId, businessId, manifestBusinessId);
          if (revived.creditSaleId) revived.creditSaleId = resolveTargetId('creditSales', revived.creditSaleId, businessId, manifestBusinessId);
          if (Array.isArray(revived.items)) {
            revived.items = revived.items.map((item) => ({
              ...item,
              productId: item.productId ? resolveTargetId('products', item.productId, businessId, manifestBusinessId) : item.productId,
            }));
          }
        }

        const targetId = resolveTargetId(name, id, businessId, manifestBusinessId);
        batch.set(doc(db, name, targetId), revived);

        if (name === 'products' && revived.barcode && String(revived.barcode).trim()) {
          barcodeEntries.push({ businessId, barcode: String(revived.barcode).trim(), productId: targetId });
        }
      });
      await batch.commit();
      written += chunk.length;
    }
    results[name] = written;
  }

  for (let start = 0; start < barcodeEntries.length; start += 350) {
    const chunk = barcodeEntries.slice(start, start + 350);
    const batch = writeBatch(db);
    chunk.forEach((entry) => {
      batch.set(doc(db, 'barcodeIndex', `${businessId}__${entry.barcode}`), entry);
    });
    await batch.commit();
  }

  return results;
}
````

## File: src/App.jsx
````javascript
// src/App.jsx
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import AppRouter from './router/AppRouter';
import ErrorBoundary from './components/common/ErrorBoundary';
import PwaInstallBanner from './components/common/PwaInstallBanner';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { fontSize: '14px', borderRadius: '10px', maxWidth: '90vw' },
            success: { iconTheme: { primary: '#1a623c', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#c4441d', secondary: '#fff' } },
            duration: 3000,
          }}
        />
        <AppRouter />
        {/* Shows the install popup automatically for visitors on phone or desktop */}
        <PwaInstallBanner />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
````

## File: src/firebase.js
````javascript
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  experimentalForceLongPolling: true, // was experimentalAutoDetectLongPolling: true
});

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export default app;
````

## File: CHANGES.md
````markdown
# FlowBiz — Multi-Product Cart Implementation Report

## 1. Audit summary (before changes)

- Counter's "sell" flow was one-product-at-a-time: tapping a `ProductGrid` card or
  a barcode scan opened `SaleModal` directly, and each confirm wrote ONE
  `sales`/`creditSales` document holding a single `productId/productName/
  quantity/costPricePerUnit/soldPricePerUnit/totalAmount/profit`.
- `Dashboard.jsx` has its **own separate** single-product scan-to-sell flow
  (own `SaleModal` usage, own `handleConfirmSale`/`handleConfirmCredit`).
  This was intentionally left untouched — the spec scopes this work to the
  Counter page, and Dashboard has no product grid or cart UI to extend.
- Every consumer of a sale doc — `financials.js` (COGS calc), Dashboard's
  activity feed, Counter's own sales log, Reports/AdvancedAnalytics
  per-product rankings, InventoryIntelligence velocity, receipts (PDF +
  WhatsApp text), the public Cloudflare Worker receipt page, and
  refund/void logic — assumed exactly one product per sale doc.
- Stock deduction already used `writeBatch + increment()` (no
  `runTransaction`) — an existing, deliberate offline-first trade-off
  (see README "CR-8"). Same trade-off is preserved here (see §5).

## 2. Data model change

`sales` and `creditSales` docs now optionally carry an `items[]` array:

```
items: [{ productId, productName, quantity, unitPrice, costPrice,
           lineTotal, lineCost, lineProfit, barcode }]
```

Every doc still carries the same **aggregate** top-level fields it always
did — `productName` (a summary, e.g. `"Book +2 more"`), `quantity` (sum of
all line quantities), `totalAmount`, `paymentMethod`, `soldAt`, etc. — plus
two new aggregate fields: `costOfGoodsSold` and (for cash/M-Pesa sales)
`profit`. A single-product cart checkout also still writes legacy
`costPricePerUnit`/`soldPricePerUnit` for maximum compatibility.

This is why almost nothing else in the app needed to change: Dashboard's
activity feed, Counter's own sales log, `useFinancials`'s date-range
queries, and Close Day all only ever read the aggregate fields, which are
still populated correctly for a multi-item sale. Only code that attributes
activity **per product** (receipts, product-performance rankings, refund
stock restoration) needed to branch on `items[]`.

## 3. Files changed (round 1 — cart feature)

| File | Change |
|---|---|
| `src/pages/Counter.jsx` | Rewritten: client-side cart state, add/scan-to-cart, quantity/price editing, stock validation, `handleCartSale`/`handleCartCredit` (one batched write per checkout, one stock decrement per line item), void updated for multi-item stock restoration. Removed the "+ Quick add product" toolbar shortcut (Counter is now selling-only, per spec §2); the scan-not-found → create-product fallback is kept and now auto-adds the new product to the cart. |
| `src/components/pos/CartList.jsx` | **New.** Cart UI: qty +/-, editable unit price, remove, running total, Sell button. |
| `src/components/pos/CartCheckoutModal.jsx` | **New.** Payment method (Cash/M-Pesa/Credit) + customer selection, applied once to the whole cart — same fields `SaleModal` already had, now cart-scoped. |
| `src/components/pos/SaleCompleteModal.jsx` | Shows an itemized breakdown when `sale.items` has more than one line; single-product sales (Dashboard's flow) render exactly as before. |
| `src/utils/currency.js` | Added `roundMoney()` — rounds cart line/aggregate totals to avoid float drift. |
| `src/utils/financials.js` | `getCostOfSale()` now prefers a stored `costOfGoodsSold` field (multi-item), falling back to `costPricePerUnit × quantity` for legacy docs. |
| `src/utils/whatsapp.js` | `buildReceiptMessage()` accepts an optional `items[]` and lists every product; unchanged for single-product callers. |
| `src/utils/documentService.js` | `buildDocument()` (PDF/print receipt+invoice) renders one row per item, with the page height now scaling with item count instead of a fixed 200mm. |
| `src/pages/Reports.jsx`, `src/pages/AdvancedAnalytics.jsx` | `productPerf` now flattens `items[]` into per-product qty/revenue/profit so best-seller/most-profitable rankings attribute correctly instead of lumping a whole cart under one summary name. |
| `src/pages/InventoryIntelligence.jsx` | `velocityData` (drives ABC classification, reorder priority, slow-moving detection) flattens `items[]` the same way. |
| `src/pages/CustomerDetail.jsx` | `handleCancel`/`handleRefund` restore stock for every item in a cancelled/refunded multi-product credit sale. |
| `cloudflare-worker/src/routes/publicDocument.js` | The public `/r/:token` receipt page (opened from a WhatsApp share link) now renders itemized rows and its "Download PDF" button uses a dynamic page height, mirroring the authenticated app's own PDF generator. |
| `src/utils/financials.test.js` | Added 3 tests for the new `costOfGoodsSold` aggregate field (cash sale, legacy fallback, partial credit repayment). |

## 4. Verified against the spec's own worked example

Book ×3 @500 (cost 300) + Storybook ×2 @350 (cost 200) + Pen ×1 @50 (cost 20)
→ cart math produces **Total: KSh 2,250.00**, matching the spec exactly
(`totalCost=1320`, `profit=930`). Confirmed by running the actual cart
line-item code, not by hand-calculation.

All 11 `financials.test.js` tests pass, including the 3 new ones.

## 5. What was preserved unchanged (by design)

- Payment logic (Cash/M-Pesa/Credit), the hybrid cash-flow-first credit
  accounting model, debt repayment allocation across multiple open credit
  sales, Close Day, offline-write pattern (`writeBatch` + `increment()`,
  no `runTransaction`) — all untouched.
- Dashboard's own single-product quick-scan sale flow, and `SaleModal.jsx`
  itself (still used by Dashboard) — untouched.
- Multi-tenant isolation: every new/changed write still goes through
  `withBusiness()`; no Firestore rule changes were needed (`sales`/
  `creditSales` rules only check `businessId` ownership, not document
  shape).

## 6. Known pre-existing limitation (not introduced, not fixed)

Stock validation is **client-side only** — the existing single-product
flow already relied on `increment()` without a transactional server-side
check. A cart checkout re-validates against the live `products` snapshot
immediately before submitting, which is the same level of protection the
single-product flow had. Two cashiers finishing checkout on the same
low-stock item within the same instant could still both succeed (stock
can go negative) — this was true before this change and remains true
after it.

## 7. Discovered but out of scope

- `src/pages/CustomerDetail.jsx`'s credit-purchase list row (`{cs.quantity}
  × {cs.productName}`) will now show something like `"6 × Book +2 more"`
  for a multi-item credit sale — functionally fine (uses the aggregate
  fields) but not itemized in that list view.
- No migration is required for existing data: old single-product
  `sales`/`creditSales` docs have no `items` field, and every piece of
  code that now branches on `items[]` falls back to the original
  single-product fields when it's absent.

## 8. Testing performed (round 1)

- Syntax-verified every changed/new file with esbuild (all pass).
- Ran the full `financials.test.js` suite (11/11 pass).
- Manually traced the spec's own Test 3 numbers through the actual cart
  line-item code (§4).
- Full manual QA against a live Firebase project (Tests 1–16 in the
  original spec) was **not** run in this environment — there's no
  Firestore connection available here. Recommend running through that
  Test 1–16 checklist once merged, particularly offline behavior and
  tenant isolation, since those depend on real network/auth conditions.

## 9. Follow-up fixes (round 2)

### Cart placement / feedback

- `CartList` is now rendered **above** the search bar and product grid,
  wrapped in a `sticky top-2 z-20` container — it stays pinned near the
  top of the visible area as you scroll a long product list, instead of
  sitting below potentially dozens of products.
- The cart header (product count + total + **Sell** button) is **always
  visible**, even collapsed — only the per-line qty/price editor
  collapses via a chevron toggle, so it stays out of the way while
  browsing but a sale can be completed with zero scrolling.
- `ProductGrid` now accepts an optional `cartQuantities` map and shows a
  small green "🛒 N" badge + highlighted border on any product card
  already in the cart — a persistent visual confirmation that a
  tap/scan registered, instead of relying only on the toast that
  disappears after ~1.2s. `Products.jsx`, which doesn't pass this prop,
  is unaffected.

### Supplier not appearing after being added

Root cause (found by reading the code, not guessed): `handleSupplierSave`
across **four** pages (`Purchases.jsx`, `Products.jsx`, `Dashboard.jsx`,
and the new cart-based `Counter.jsx`) showed an error toast and then
`return`ed on failure instead of throwing. `SupplierFormModal`'s own
`try/catch` only reset its "Saving…" button inside the `catch` block —
so on any failed save, that `catch` never fired, and the button (and the
whole form) stayed frozen on "Saving…" with no visible way to retry. The
toast still fired, but if it wasn't seen right away it looked exactly
like "I added a supplier and nothing happened."

Separately and specifically on **Purchases.jsx**: creating a supplier via
"+ Add new supplier" *did* get written to Firestore and *would* appear in
the dropdown's option list (live, via the existing realtime listener) —
but nothing ever pre-selected it in the purchase form's own
`form.supplierId`, unlike `ProductFormModal`'s identical "+ Add new
supplier" flow, which already had this wiring for its own supplier
field. So a newly created supplier was there, just not selected — easy to
mistake for "not there" without reopening the dropdown.

Fixed:
- `handleSupplierSave` now `throw`s after showing its error toast (in
  all four pages), so `SupplierFormModal` can properly reset via
  `finally` and the form stays open and usable for retry.
- `SupplierFormModal.jsx` now resets `busy` in a `finally` block instead
  of only in `catch`, so it can never get permanently stuck regardless
  of exactly how a caller reports failure.
- `Purchases.jsx` now has the same `useEffect(() => { if (newSupplierId)
  setForm(p => ({ ...p, supplierId: newSupplierId })); }, [newSupplierId])`
  wiring `ProductFormModal.jsx` already had — a newly created supplier is
  now pre-selected in the purchase form immediately.

### Files touched in round 2

| File | Change |
|---|---|
| `src/pages/Counter.jsx` | Cart moved above search/grid, wrapped in sticky container; `cartQuantities` computed and passed to `ProductGrid`; `handleSupplierSave` throws on error. |
| `src/components/pos/CartList.jsx` | Collapsible per-line editor; header (count/total/Sell) always visible. |
| `src/components/pos/ProductGrid.jsx` | New optional `cartQuantities` prop → in-cart badge + highlight. |
| `src/components/suppliers/SupplierFormModal.jsx` | `busy` reset moved to `finally`. |
| `src/pages/Purchases.jsx` | Added `newSupplierId` → `form.supplierId` auto-select `useEffect`; `handleSupplierSave` throws on error. |
| `src/pages/Products.jsx` | `handleSupplierSave` throws on error (consistency fix). |
| `src/pages/Dashboard.jsx` | `handleSupplierSave` throws on error (consistency fix). |
````

## File: storage.rules
````
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /businesses/{businessId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.resource.size < 5 * 1024 * 1024;
    }
  }
}
````

## File: cloudflare-worker/src/lib/identityToolkit.js
````javascript
// src/lib/identityToolkit.js
//
// Deletes a Firebase Authentication user by uid. This is the one thing
// FlowBiz's client SDK can never safely do itself — removing another
// person's Auth account requires privileged, server-side credentials.
// This is the actual fix for the staff-deletion bug described in the
// audit: without this, the Firestore profile can be deleted all day and
// the email stays registered in Firebase Authentication forever.

import { getGoogleAccessToken } from './googleAuth.js';

// Generates a Firebase Auth action link (email verification or password
// reset) via the Identity Toolkit REST API WITHOUT letting Firebase send
// its own email — that's what lets FlowBiz deliver the email itself via
// Resend. returnOobLink:true is only honored for server-authenticated
// (OAuth) callers, never a plain client API key request — same privilege
// tier as deleteAuthUser() below.
export async function generateActionLink(env, { requestType, email, idToken, continueUrl }) {
  const token = await getGoogleAccessToken(env);
  const body = {
    requestType,               // 'VERIFY_EMAIL' | 'PASSWORD_RESET'
    returnOobLink: true,
    continueUrl,
    canHandleCodeInApp: true,  // send users straight to our /auth/action page, never Firebase's hosted page
  };
  if (email) body.email = email;
  if (idToken) body.idToken = idToken;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:sendOobCode`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const code = errBody?.error?.message || 'UNKNOWN_ERROR';
    const err = new Error(code);
    err.identityToolkitCode = code;
    throw err;
  }
  const data = await res.json();
  
  // 1. Parse the ugly Firebase link
  const originalUrl = new URL(data.oobLink);
  
  // 2. Extract the query parameters (?mode=...&oobCode=...&apiKey=...)
  const queryParams = originalUrl.search;
  
  // 3. Attach those exact parameters to your FlowBiz React URL
  // This uses the env.APP_BASE_URL from your worker environment
  const customLink = `${env.APP_BASE_URL}/auth/action${queryParams}`;

  // 4. Return the custom link to your Resend email template
  return { oobLink: customLink, email: data.email };
}

export async function deleteAuthUser(env, uid) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:delete`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    // A user that's already gone is not a failure from the caller's point
    // of view — the goal (no orphaned Auth account) is already achieved.
    if (res.status === 400 && errText.includes('USER_NOT_FOUND')) return;
    throw new Error(`Failed to delete Firebase Auth user ${uid}: ${errText}`);
  }
}
````

## File: src/components/common/WhatsAppFloatingButton.jsx
````javascript
// src/components/common/WhatsAppFloatingButton.jsx

export default function WhatsAppFloatingButton({
  phone = '254741104469',
  message = 'Hello FlowBiz! I would like to inquire more about the POS system for my business.',
}) {
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <div className="group fixed bottom-5 right-5 z-40 flex items-center gap-2.5">
      {/* Floating Tooltip on Desktop Hover */}
      <span className="pointer-events-none hidden rounded-xl bg-[#15171d] px-3 py-1.5 text-xs font-bold text-white shadow-xl transition-all duration-200 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 sm:inline-block whitespace-nowrap">
        Chat with us
      </span>

      {/* Clean, Uniform Circular WhatsApp Button (No pulsing dot) */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with FlowBiz on WhatsApp"
        className="flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition-all duration-300 hover:bg-[#20ba5a] hover:shadow-2xl hover:scale-105 active:scale-95 shrink-0"
      >
        {/* Centered Official WhatsApp SVG Icon */}
        <svg
          className="h-6 w-6 sm:h-7 sm:w-7 fill-current"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.55-3.7 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.09-.39-.13-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.55c.13.17 1.73 2.65 4.2 3.71.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.17-.48-.29z" />
        </svg>
      </a>
    </div>
  );
}
````

## File: src/components/landing/LandingHeader.jsx
````javascript
// src/components/landing/LandingHeader.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#faf6ef]/95 backdrop-blur-md border-b border-[#e8eaed] h-14 flex items-center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-full">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 z-10 leading-none">
            <div className="flex flex-col justify-center">
              <span className="font-extrabold text-lg text-[#15171d] tracking-tight leading-none">
                FlowBiz
              </span>
              <span className="text-[8px] font-bold text-[#1a623c] uppercase tracking-wider leading-none mt-1">
                Business Manager
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex absolute inset-0 items-center justify-center pointer-events-none">
            <div className="flex items-center gap-6 xl:gap-8 text-xs sm:text-sm font-semibold text-[#5a6273] pointer-events-auto leading-none">
              <a 
                href="#features" 
                className="hover:text-[#1a623c] transition-colors py-1 px-1"
              >
                Features
              </a>
              <a 
                href="#how-it-works" 
                className="hover:text-[#1a623c] transition-colors py-1 px-1"
              >
                How It Works
              </a>
              <a 
                href="#pricing" 
                className="hover:text-[#1a623c] transition-colors py-1 px-1"
              >
                Pricing
              </a>
              <a 
                href="#faq" 
                className="hover:text-[#1a623c] transition-colors py-1 px-1"
              >
                FAQ
              </a>
            </div>
          </nav>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center gap-2.5 shrink-0 z-10 leading-none">
            <Link
              to="/login"
              className="text-xs sm:text-sm font-bold text-[#363b48] hover:text-[#15171d] px-3 py-2 rounded-lg hover:bg-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/setup"
              className="bg-[#1a623c] text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-[#144f30] transition-colors shadow-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Get Started Free</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-1.5 rounded-lg text-[#5a6273] hover:text-[#15171d] hover:bg-white z-10"
            aria-label="Toggle Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 border-b border-[#e8eaed] bg-white px-6 py-4 space-y-3 shadow-lg">
          <a
            href="#features"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-[#363b48] hover:text-[#1a623c]"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-[#363b48] hover:text-[#1a623c]"
          >
            How It Works
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-[#363b48] hover:text-[#1a623c]"
          >
            Pricing
          </a>
          <a
            href="#faq"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-[#363b48] hover:text-[#1a623c]"
          >
            FAQ
          </a>
          <div className="pt-2.5 border-t border-[#e8eaed] flex flex-col gap-2">
            <Link
              to="/login"
              className="w-full text-center py-2.5 border border-[#cfd3da] rounded-xl text-sm font-bold text-[#15171d]"
            >
              Sign In
            </Link>
            <Link
              to="/setup"
              className="w-full text-center py-3 bg-[#1a623c] text-white rounded-xl text-sm font-bold shadow-md hover:bg-[#144f30] transition-all flex items-center justify-center gap-2"
            >
              <span>Get Started Free</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
````

## File: src/components/scanner/ScannerModal.jsx
````javascript
// src/components/scanner/ScannerModal.jsx
import { useCallback, useEffect, useState } from 'react';
import { X, Zap, ZapOff, AlertTriangle } from 'lucide-react';
import { useCameraScanner } from '../../hooks/useCameraScanner';

export default function ScannerModal({ open, onClose, onDetected }) {
  // Guards against multiple rapid detections firing in the brief window
  // between "we found something" and the parent page actually closing us.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (open) setPaused(false);
  }, [open]);

  const handleDetected = useCallback((text) => {
    if (paused) return;
    setPaused(true);
    onDetected(text);
  }, [paused, onDetected]);

const { videoRef, status, torchOn, torchSupported, toggleTorch, retry } = useCameraScanner({
    onDetected: handleDetected,
    active: open && !paused,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950">
      <div className="flex items-center justify-between px-4 py-3 safe-top">
        <span className="font-display text-sm font-bold text-white">Scan barcode</span>
        <button onClick={onClose} className="rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Close">
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

        {status === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-64 rounded-xl2 border-2 border-moss-400/80" />
          </div>
        )}

        {status === 'denied' && (
          <ScannerMessage
            icon={<AlertTriangle className="h-8 w-8 text-rust-400" strokeWidth={1.75} />}
            title="Camera permission needed"
            body="Your browser is blocking camera access for FlowBiz. Tap the padlock or (i) icon next to the address bar → Permissions → Camera → Allow, then come back and try again. On some phones this is under Chrome menu (⋮) → Settings → Site settings → flowbiz.pages.dev."
            action={<button type="button" onClick={retry} className="btn-primary mt-2">Try again</button>}
          />
        )}

        {status === 'insecure' && (
          <ScannerMessage
            icon={<AlertTriangle className="h-8 w-8 text-rust-400" strokeWidth={1.75} />}
            title="Camera needs a secure connection"
            body="This page was opened over a plain network address (not HTTPS or localhost), so the browser blocks camera access entirely on this device. Open the app via HTTPS, or via localhost on this device, to use the scanner. You can still find the product by searching its name or code."
          />
        )}

        {status === 'unavailable' && (
          <ScannerMessage
            icon={<AlertTriangle className="h-8 w-8 text-rust-400" strokeWidth={1.75} />}
            title="Camera unavailable"
            body="No usable camera was found on this device. You can still find the product by searching its name or code."
            action={<button type="button" onClick={retry} className="btn-primary mt-2">Try again</button>}
          />
        )}
      </div>

      {torchSupported && status === 'scanning' && (
        <div className="flex justify-center pb-8 pt-4 safe-bottom">
          <button
            onClick={toggleTorch}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${torchOn ? 'bg-amber-400 text-ink-900' : 'bg-white/10 text-white'}`}
          >
            {torchOn ? <Zap className="h-4 w-4" strokeWidth={1.75} /> : <ZapOff className="h-4 w-4" strokeWidth={1.75} />}
            Torch
          </button>
        </div>
      )}
    </div>
  );
}

function ScannerMessage({ icon, title, body, action }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
      {icon}
      <p className="font-display text-base font-bold text-white">{title}</p>
      <p className="text-sm text-white/70">{body}</p>
      {action}
    </div>
  );
}
````

## File: src/components/suppliers/SupplierFormModal.jsx
````javascript
import { useEffect, useState } from 'react';
import Modal from '../common/Modal';

const empty = { name:'', contactPerson:'', phone:'', email:'', address:'', notes:'' };
export default function SupplierFormModal({ open, onClose, onSave, initialSupplier }) {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(initialSupplier ? {...empty,...initialSupplier} : empty); setBusy(false); }, [initialSupplier, open]);
  const set = f => e => setForm(p=>({...p,[f]:e.target.value}));

  // FIX (stuck "Saving…" bug): onSave (each page's handleSupplierSave)
  // shows its own error toast and now re-throws on failure. Previously
  // this component only reset `busy` inside the catch block, but the
  // pages calling onSave used to swallow the error instead of throwing
  // it — so on a failed save this button never left "Saving…" and the
  // form looked frozen, with the toast the only (easy-to-miss) sign
  // anything went wrong. `finally` now resets it regardless of outcome,
  // so a failed save leaves the form open and immediately usable again.
  const handle = async e => {
    e.preventDefault();
    if (!form.name.trim() || busy) return;
    setBusy(true);
    try {
      await onSave({...form,name:form.name.trim()});
    } catch (err) {
      // Already surfaced via toast by onSave — nothing further to do
      // here besides letting the form become usable again (below).
    } finally {
      setBusy(false);
    }
  };
  const handleClose = () => { if (!busy) onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title={initialSupplier ? 'Edit supplier' : 'Add supplier'}>
      <form onSubmit={handle} className="space-y-3">
        <div><label className="label">Business name</label><input className="input" value={form.name} onChange={set('name')} required disabled={busy} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Contact person</label><input className="input" value={form.contactPerson} onChange={set('contactPerson')} disabled={busy} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} placeholder="07xx xxx xxx" disabled={busy} /></div>
        </div>
        <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={set('email')} disabled={busy} /></div>
        <div><label className="label">Address</label><input className="input" value={form.address} onChange={set('address')} disabled={busy} /></div>
        <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} disabled={busy} /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : (initialSupplier ? 'Save changes' : 'Add supplier')}</button>
        </div>
      </form>
    </Modal>
  );
}
````

## File: src/pages/Expenses.jsx
````javascript
import { useMemo, useState } from 'react';
import { addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Banknote, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useSettings } from '../hooks/useSettings';
import { isExpenseExcluded } from '../utils/financials';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ExportCsvButton from '../components/common/ExportCsvButton';
import { EXPENSE_CATEGORIES } from '../constants/categories';
import { formatKES } from '../utils/currency';
import { formatDateTime, todayKey } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';
const emptyForm = { description:'', category:EXPENSE_CATEGORIES[0], amount:'', paymentMethod:'Cash', mpesaCode:'' };

export default function Expenses() {
  const { profile, isAdmin, businessId } = useAuth();
  const { settings, loading:sLoad } = useSettings();
  const expQ = useMemo(() => businessId ? tenantQuery('expenses', businessId, orderBy('recordedAt','desc'), limit(200)) : null, [businessId]);
  const { data: rawExpenses, loading } = useFirestoreCollection(expQ);
  // FIX: supplier-debt-payment entries are auto-written to `expenses` so
  // till reconciliation math works (see financials.js), but they aren't
  // real operating expenses — showing them here confused the actual
  // expense log. Filter them out with the exact same rule used to
  // exclude them from the Total Expenses figure.
  const expenses = useMemo(() => rawExpenses.filter((e) => !isExpenseExcluded(e)), [rawExpenses]);
  const [form, setForm]   = useState(emptyForm);
  const [busy, setBusy]   = useState(false);
  const set = f => e => setForm(p=>({...p,[f]:e.target.value}));

  if (sLoad) return <LoadingSpinner />;
  if (!isAdmin && !settings.cashierCanRecordExpenses) return <EmptyState title="Expense recording is owner-only" description="Ask your owner to enable cashier expenses in Settings." />;

const handle = async e => {
    e.preventDefault();
    if (!form.description.trim()||!form.amount) return;
    if (form.paymentMethod==='M-Pesa'&&!form.mpesaCode.trim()) { toast.error('Enter M-Pesa transaction code.'); return; }
    setBusy(true);
    const write = addDoc(tenantCollection('expenses'), withBusiness({
      description:form.description.trim(), category:form.category, amount:Number(form.amount),
      paymentMethod:form.paymentMethod, mpesaCode:form.paymentMethod==='M-Pesa'?form.mpesaCode.trim():null,
      recordedBy:profile.uid, recordedByName:profile.displayName, recordedAt:new Date(),
    }, businessId));

    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    setBusy(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(queuedOffline ? "Expense saved — it'll sync once you're back online." : 'Expense recorded');
    if (queuedOffline) write.catch((err) => toast.error(`An expense from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
    setForm(emptyForm);
  };

  const rows = expenses.map(e=>({ date:formatDateTime(e.recordedAt), description:e.description, category:e.category, amount:e.amount, paymentMethod:e.paymentMethod, mpesaCode:e.mpesaCode||'', recordedBy:e.recordedByName }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Expenses</h1>
      <form onSubmit={handle} className="card space-y-3 p-4">
        <h2 className="font-display text-sm font-bold text-ink-800">Record an expense</h2>
        <div><label className="label">Description</label><input className="input" value={form.description} onChange={set('description')} placeholder="e.g. Rent for July" required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Category</label><select className="input" value={form.category} onChange={set('category')}>{EXPENSE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Amount (KES)</label><input type="number" min="0.01" step="0.01" className="input" value={form.amount} onChange={set('amount')} required /></div>
        </div>
        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-2 gap-2">
            {['Cash','M-Pesa'].map(m=>(
              <button key={m} type="button" onClick={()=>setForm(p=>({...p,paymentMethod:m}))} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.paymentMethod===m?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>
                {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
              </button>
            ))}
          </div>
        </div>
        {form.paymentMethod==='M-Pesa'&&<div><label className="label">M-Pesa code <span className="text-rust-500">*</span></label><input className="input uppercase" value={form.mpesaCode} onChange={set('mpesaCode')} placeholder="QWE1234567" /></div>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy?'Saving…':'Record expense'}</button>
      </form>
      <div className="flex items-center justify-between"><h2 className="font-display text-sm font-bold text-ink-800">Recent expenses</h2><ExportCsvButton filename={`expenses-${todayKey()}.csv`} rows={rows} /></div>
      {loading?<LoadingSpinner />:expenses.length===0?<EmptyState title="No expenses yet" />:(
        <div className="card divide-y divide-ink-100">
          {expenses.map(e=>(
            <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
              <div><p className="font-medium text-ink-700">{e.description}</p><p className="text-xs text-ink-400">{e.category} · {formatDateTime(e.recordedAt)} · {e.recordedByName}</p></div>
              <div className="text-right"><p className="font-semibold text-rust-600">{formatKES(e.amount)}</p><p className="text-xs text-ink-400">{e.paymentMethod}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
````

## File: src/pages/HelpGuide.jsx
````javascript
import { useState } from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  {
    id: 'getting-started',
    title: '1. Getting Started',
    desc: 'The essential daily workflows: adding inventory, recording purchases, making sales, and logging daily expenses.',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          Welcome to FlowBiz! To run your shop efficiently every day, follow these five essential steps:
        </p>
        <div className="space-y-3">
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 1: Add Your Products</h4>
            <p className="text-sm text-ink-600 mt-1">
              Go to <strong className="text-ink-800">Products</strong> and tap <strong className="text-ink-800">+ Add product</strong>. Enter the product name, its buying price (cost), and selling price. If the item has a barcode, scan it using your device's camera or standard USB scanner.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 2: Record Purchases (Restocking)</h4>
            <p className="text-sm text-ink-600 mt-1">
              When a supplier delivers new stock, record it on the <strong className="text-ink-800">Purchases</strong> page. Select the supplier, pick the product, enter the quantity received, and specify if you paid them now or took the stock on credit. FlowBiz will automatically increase your stock levels.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 3: Record Sales (Counter)</h4>
            <p className="text-sm text-ink-600 mt-1">
              On the <strong className="text-ink-800">Counter</strong> page, tap any product card or scan its barcode to sell. Select whether the customer paid in Cash, via M-Pesa, or took it on credit (Deni). Tap confirm, and inventory levels will update in real-time.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 4: Record Expenses</h4>
            <p className="text-sm text-ink-600 mt-1">
              Keep a record of rent, electricity, transport, wages, or airtime float under <strong className="text-ink-800">Expenses</strong>. Logging every small expense ensures your end-of-day net profit calculations remain accurate.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 5: Record Debt Repayments</h4>
            <p className="text-sm text-ink-600 mt-1">
              When a debtor pays off what they owe, go to <strong className="text-ink-800">Customers</strong>, click their name, and record the repayment amountWhen a debtor pays off what they owe, go to <strong className="text-ink-800">Customers</strong>, click their name, and record the repayment amount (Cash or M-Pesa). Do not create a new sale; this updates their remaining balance and logs the cash received.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'understanding-dashboard',
    title: "2. Understanding the Dashboard",
    desc: "A brief guide to today's summary cards, tracking balances, and checking inventory health.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          The dashboard is your shop's cockpit, offering a real-time summary of today's events:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Cash Received Today</span>
            <p className="text-xs text-ink-600 mt-1">All the physical cash collected today from direct cash sales and debtor repayments combined.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">M-Pesa Received Today</span>
            <p className="text-xs text-ink-600 mt-1">All digital payments transferred to your till today from direct M-Pesa sales and debtor repayments.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Today's Net Profit</span>
            <p className="text-xs text-ink-600 mt-1">Today's realized gross profit minus today's recorded shop expenses. Shows exactly what you made in hand.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Today's Expenses</span>
            <p className="text-xs text-ink-600 mt-1">The sum of all shop operational expenses recorded today (excluding purchases made on credit).</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Inventory Value (Cost)</span>
            <p className="text-xs text-ink-600 mt-1">The total buying price of all items currently on your shelves. Helps you see exactly how much capital is tied up in stock.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Outstanding Debt (Deni)</span>
            <p className="text-xs text-ink-600 mt-1">The total amount of money your credit customers still owe you. Keep this number as close to zero as possible!</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'understanding-reports',
    title: '3. Understanding Reports',
    desc: 'How the reports compile and measure credit sales, margins, expenses, and profits over time.',
    content: (
      <div className="space-y-3 text-sm text-ink-600">
        <p>Reports allow you to view the shop's financial performance over preset periods (Today, This Week, This Month, or Custom dates):</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><strong>Gross Revenue:</strong> Represents actual money in your hand, direct cash/M-Pesa sales plus whatever portion of debtor repayments was collected in this period.</li>
          <li><strong>Cost of Goods Sold (COGS):</strong> The total wholesale cost of the items you sold during this period. For credit repayments, COGS is recognized proportionally.</li>
          <li><strong>Gross Profit:</strong> Gross Revenue minus Cost of Goods Sold. Tells you how much markup you earned on items sold.</li>
          <li><strong>Expenses:</strong> Rent, bills, wages, etc., logged during this period.</li>
          <li><strong>Net Profit:</strong> Gross Profit minus Expenses. The ultimate bottom-line earnings of your business during this reporting window.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'credit-sales',
    title: '4. How Credit Sales (Deni) Work',
    desc: 'The cash-flow-first model: why profit stays at zero until money is collected.',
    content: (
      <div className="space-y-4 text-sm text-ink-600">
        <p>
          Most standard software registers revenue the moment you sell an item, even if the customer leaves without empty pockets. This is called *accrual accounting*, but it can be confusing for everyday Kenyan businesses where cash flow is king.
        </p>
        <p>
          <strong>FlowBiz uses a cash-flow-first hybrid model</strong> designed specifically for Kenyan SMEs:
        </p>
        <div className="border-l-2 border-moss-600 pl-4 space-y-2 py-1 font-mono text-xs bg-moss-50/50 rounded-r">
          <div>Customer buys on credit (e.g., KES 15,000)</div>
          <div className="text-ink-400">↓</div>
          <div>Inventory decreases immediately (real-time stock health)</div>
          <div className="text-ink-400">↓</div>
          <div>Outstanding Debt (Deni) increases by KES 15,000</div>
          <div className="text-ink-400">↓</div>
          <div className="text-rust-600 font-semibold">Revenue and Profit remain at KES 0.00 (not collected yet)</div>
          <div className="text-ink-400">↓</div>
          <div>Customer pays KES 5,000 partial payment later</div>
          <div className="text-ink-400">↓</div>
          <div className="text-moss-700 font-semibold">KES 5,000 is recognized as Revenue</div>
          <div className="text-moss-700 font-semibold font-bold">COGS &amp; proportional profit are recognized at last!</div>
          <div className="text-ink-400">↓</div>
          <div>Outstanding Debt reduces to KES 10,000</div>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          This system ensures you only see, report, and spend profits that have actually entered your cash drawer or M-Pesa till.
        </p>
      </div>
    )
  },
  {
    id: 'cash-mpesa',
    title: '5. Cash, M-Pesa, & Close Day',
    desc: 'Reconciling floats, recording withdrawals, and closing today’s session correctly.',
    content: (
      <div className="space-y-3 text-sm text-ink-600">
        <p>
          Every morning, open the Counter by entering your starting balances (the <strong>Opening Float</strong>). This is the cash in your drawer and the float on your phone.
        </p>
        <p>
          During the day, every sale, expense, debtor repayment, and refund adjusts the "Expected" balances inside the system. 
        </p>
        <p>
          At closing time, visit the <strong>Close Day</strong> page:
        </p>
        <ol className="list-decimal pl-5 space-y-1.5 mt-2">
          <li>Count the physical cash in your drawer and type the amount into the input.</li>
          <li>Check your M-Pesa statement balance and type it.</li>
          <li>FlowBiz will instantly compare these to the "Expected" amounts and display a <strong>Shortage</strong> (rust) or <strong>Surplus</strong> (amber) if there's any variance.</li>
          <li>Press <strong>Confirm and Close Day</strong>. This locks the sales log and stores today's records.</li>
        </ol>
      </div>
    )
  },
  {
    id: 'inventory-management',
    title: '6. Inventory & Stock Take',
    desc: 'Understanding stock movements, low stock limits, and discrepancy audits.',
    content: (
      <div className="space-y-3 text-sm text-ink-600">
        <p>Inventory level is updated automatically through three daily events:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Purchases (+):</strong> Increases your stock when you record incoming stock from a supplier.</li>
          <li><strong>Sales &amp; Credit Sales (-):</strong> Decreases your stock the second an item leaves your counter.</li>
          <li><strong>Stock Take (+/-):</strong> Used to override the system count with a physical hand-count (e.g. to adjust for damage, expiration, or theft).</li>
        </ul>
        <div className="rounded bg-rust-50 p-3 text-xs text-rust-700">
          <strong>Discrepancy Note:</strong> Stock Take is purely an auditing tool. Correcting a stock discrepancy does not create cash transactions or expenses automatically. It logs the audit discrepancy under <strong>stockAdjustments</strong> for tracking.
        </div>
      </div>
    )
  },
  {
    id: 'suppliers-team',
    title: '7. Suppliers & Team',
    desc: 'Tracking what you owe suppliers, and managing owner and cashier access.',
    content: (
      <div className="space-y-4 text-sm text-ink-600">
        <p>The <strong className="text-ink-800">Suppliers</strong> page tracks who you buy stock from and what you owe them. Every purchase recorded "on credit" (Purchases page) adds to that supplier's outstanding balance automatically record a payment from the Suppliers page when you pay them, and it logs both the payment and the matching expense in one step.</p>
        <p><strong className="text-ink-800">Team</strong> (under Settings) is where an owner invites staff. There are two roles:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Owner:</strong> full access Products, Purchases, Suppliers, Reports, Settings, Team, and Close Day.</li>
          <li><strong>Cashier:</strong> Counter, Customers, and Expenses (if the owner allows it) enough to run daily sales without touching sensitive business data.</li>
        </ul>
        <p>An owner can deactivate a staff account at any time from Team, or sign a device out remotely from Settings → Device Management if a phone is lost or a staff member leaves.</p>
      </div>
    ),
  },
  {
    id: 'pro-analytics',
    title: '8. FlowBiz Pro & Analytics',
    desc: 'What Advanced Analytics, Inventory Intelligence, and WhatsApp sharing add on top of the free plan.',
    content: (
      <div className="space-y-4 text-sm text-ink-600">
        <p><strong className="text-ink-800">Advanced Analytics</strong> (Pro) goes beyond the standard Reports page: it compares the current period against the one before it, breaks down which products drive the most volume versus the most profit, and attributes revenue per staff member.</p>
        <p><strong className="text-ink-800">Inventory Intelligence</strong> (Pro) looks at your stock from a capital point of view: how much cash is tied up in inventory right now, which products are overstocked and quietly locking up that cash, and which are close to running out.</p>
        <p><strong className="text-ink-800">WhatsApp sharing</strong> (Pro) lets you send a receipt, invoice, or debt reminder straight to a customer's phone with one tap.</p>
        <p className="text-xs text-ink-500">Printing and downloading receipts/invoices as PDF is available on every plan Pro specifically unlocks Analytics, Inventory Intelligence, WhatsApp sharing, and unlimited products/staff.</p>
      </div>
    ),
  },
  {
    id: 'faq',
    title: '7. Frequently Asked Questions',
    desc: 'Troubleshooting and immediate answers to common user questions.',
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Why is my profit still zero after a credit sale?</strong>
          <p className="text-xs text-ink-600 pl-4">A: Since no cash or M-Pesa has been collected yet, no revenue is earned. Once the customer repays, profit is recognized proportionally based on the amount paid.</p>
        </div>
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Why did my inventory reduce before I received any money?</strong>
          <p className="text-xs text-ink-600 pl-4">A: Real-time inventory tracking is crucial. Even on credit, physical stock leaves the shelves, so the system must deduct it immediately to prevent double-selling.</p>
        </div>
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Can I edit or void a closed session?</strong>
          <p className="text-xs text-ink-600 pl-4">A: No. Once a daily session is closed, it is securely saved. If you made an error, an administrator can click "Reopen session" on the Close Day page to make adjustments.</p>
        </div>
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Where do I edit or delete products?</strong>
          <p className="text-xs text-ink-600 pl-4">A: Editing and deleting products is restricted to administrators and must be done on the dedicated <strong>Products</strong> page, keeping the Counter screen clean and secure.</p>
        </div>
      </div>
    )
  },
  {
    id: 'best-practices',
    title: '8. FlowBiz Best Practices',
    desc: 'Golden rules for keeping your shop books accurate and reliable.',
    content: (
      <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-600">
        <li><strong>Record expenses immediately:</strong> Log your County Council fees, electricity, and lunch costs right when they occur so you do not forget at close-of-day.</li>
        <li><strong>Record credit repayments inside Customers:</strong> Never create a new direct sale to record a repayment, this would double-count your revenue and duplicate items sold.</li>
        <li><strong>Perform Stock Take regularly:</strong> Plan a quick physical stock take every weekend or fortnight to ensure physical inventory matches your screens exactly.</li>
        <li><strong>Keep the general settings updated:</strong> Shop name edits immediately personalize your generated PDF reports for presentation to accountants.</li>
      </ul>
    )
  },
  {
    id: 'about-flowbiz',
    title: '9. About FlowBiz',
    desc: 'Who we are and our vision for empowering Kenyan small businesses.',
    content: (
      <p className="text-sm text-ink-600">
        FlowBiz is a localized, production-ready Business Manager custom-built to meet the unique operational challenges of Kenyan SMBs. By prioritizing cash-flow visibility, offering native barcode scanning, and supporting local transaction models like Deni and M-Pesa, we aim to make day-to-day recordkeeping effortless and stress-free.
      </p>
    )
  }
];

export default function HelpGuide() {
  const [activeTab, setActiveTab] = useState('getting-started');

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900"> Help &amp; Guide</h1>
          <p className="text-sm text-ink-400">FlowBiz user guide and best-practice operating manual.</p>
        </div>
        <Link to="/settings" className="btn-outline text-xs !px-3 !py-1.5 !min-h-0">
          ← Back to Settings
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Navigation panel */}
        <div className="w-full lg:w-1/3 space-y-2">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveTab(sec.id)}
              className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1 min-h-[50px] ${
                activeTab === sec.id
                  ? 'border-moss-600 bg-moss-50 text-moss-800 shadow-sm'
                  : 'border-ink-100 bg-white text-ink-600 hover:bg-ink-50'
              }`}
            >
              <span className="font-semibold text-sm block">{sec.title}</span>
              <span className="text-xs text-ink-400 line-clamp-1">{sec.desc}</span>
            </button>
          ))}
          
          <div className="rounded-lg bg-moss-50/50 border border-dashed border-moss-200 p-4 text-center mt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-moss-800 block">Need more topics?</span>
            <p className="text-[11px] text-ink-500 mt-1">We periodically update this manual. Future sections including Cashiers, eTIMS, VAT, Backup &amp; Restore, and loyalty schemes will appear here automatically.</p>
          </div>
        </div>

        {/* Content Display Panel */}
        <div className="flex-1 card bg-white p-5 sm:p-6 min-h-[300px]">
          {SECTIONS.map((sec) => {
            if (activeTab !== sec.id) return null;
            return (
              <div key={sec.id} className="space-y-4 animate-fade-in">
                <div className="border-b border-ink-100 pb-3">
                  <h2 className="font-display text-lg font-bold text-ink-900">{sec.title}</h2>
                  <p className="text-xs text-ink-400 mt-1">{sec.desc}</p>
                </div>
                <div className="pt-2">{sec.content}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
````

## File: src/pages/Privacy.jsx
````javascript
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-sand text-ink-900 selection:bg-moss-200 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-800 mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to App
        </Link>

        <div className="card p-6 sm:p-10 space-y-8 bg-white border border-ink-100 shadow-sm">
          <div className="border-b border-ink-100 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-moss-50 text-moss-700 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6" strokeWidth={2} />
              </div>
              <h1 className="font-display text-2xl font-bold text-ink-900">
                Privacy Policy
              </h1>
            </div>

            <p className="text-sm text-ink-500">
              Effective Date: August 20, 2026 · Compliant with Kenya Data Protection Act (KDPA) 2019
            </p>
          </div>

          <div className="space-y-8 text-sm text-ink-700 leading-relaxed">

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                1. Introduction
              </h2>

              <p>
                FlowBiz is a business management platform designed to help small and
                medium-sized businesses manage sales, inventory, customers, debts,
                expenses, quotations, invoices, receipts, and related business
                operations.
              </p>

              <p>
                This Privacy Policy explains what information FlowBiz may process,
                why that information is processed, how it is stored and protected,
                and the choices available to individuals whose personal data is
                processed through the service.
              </p>

              <p>
                FlowBiz is committed to handling personal data in accordance with
                applicable Kenyan data protection laws, including the Data Protection
                Act, 2019 and applicable regulations and guidance issued by the
                Office of the Data Protection Commissioner (ODPC).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                2. Information We Collect
              </h2>

              <p>
                The information processed by FlowBiz depends on how the service is
                used. This may include:
              </p>

              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>
                  <strong>Account Information:</strong> email address, display name,
                  authentication information, business name, and business profile
                  information.
                </li>

                <li>
                  <strong>Business Information:</strong> business name, business
                  contact details, address, phone number, email address, tax or
                  registration information where voluntarily provided, and business
                  preferences.
                </li>

                <li>
                  <strong>Inventory Information:</strong> product names, product
                  descriptions, prices, quantities, stock levels, categories,
                  cost information, and stock adjustments.
                </li>

                <li>
                  <strong>Transaction Information:</strong> sales, quotations,
                  invoices, receipts, payment methods, transaction amounts,
                  discounts, refunds, expenses, and related records.
                </li>

                <li>
                  <strong>Customer Information:</strong> customer names, phone
                  numbers, email addresses, notes, purchase records, outstanding
                  balances, and other information entered by a business for
                  customer and debt-management purposes.
                </li>

                <li>
                  <strong>Staff Information:</strong> names, email addresses,
                  assigned roles, permissions, and activity associated with
                  business workspaces.
                </li>

                <li>
                  <strong>Device and Security Information:</strong> browser type,
                  device category, session information, approximate technical
                  information, login activity, and information necessary to manage
                  authorized devices and protect accounts.
                </li>

                <li>
                  <strong>Support Information:</strong> information you provide
                  when contacting FlowBiz for technical support, account assistance,
                  or privacy-related requests.
                </li>
              </ul>

              <p>
                FlowBiz does not require businesses to enter information that is
                unnecessary for the operation of their workspace. Businesses are
                responsible for ensuring that information they enter into FlowBiz
                is appropriate, accurate, and collected lawfully.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                3. How We Use Information
              </h2>

              <p>
                Information processed through FlowBiz may be used for purposes
                including:
              </p>

              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>Creating and managing user accounts and business workspaces.</li>
                <li>Providing sales, inventory, invoicing, quotation, and debt-management functionality.</li>
                <li>Synchronizing business information between authorized devices.</li>
                <li>Maintaining transaction history and business records.</li>
                <li>Providing account, security, and device-management functionality.</li>
                <li>Responding to support requests and resolving technical problems.</li>
                <li>Detecting, preventing, and investigating unauthorized access, fraud, abuse, or security incidents.</li>
                <li>Maintaining and improving the reliability and functionality of FlowBiz.</li>
                <li>Complying with applicable legal, regulatory, accounting, or law-enforcement requirements.</li>
              </ul>

              <p>
                FlowBiz does not sell customer contact information or use merchant
                customer records to build advertising profiles.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                4. Data Controller and Data Processor Roles
              </h2>

              <p>
                Businesses using FlowBiz generally determine what customer,
                employee, and operational information they collect and the purposes
                for which that information is used. In those circumstances, the
                business is generally the <strong>Data Controller</strong> and
                FlowBiz acts as a <strong>Data Processor</strong> processing that
                information on the business's behalf.
              </p>

              <p>
                FlowBiz may also act as a Data Controller for information it
                processes for its own purposes, such as account administration,
                service security, customer support, billing, legal compliance,
                and protection of the FlowBiz platform.
              </p>

              <p>
                The applicable role depends on the particular processing activity
                and the purposes for which the information is processed.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                5. Offline-First Storage
              </h2>

              <p>
                FlowBiz is designed with an offline-first architecture. Depending
                on the functionality being used, certain business information may
                be temporarily stored locally on an authorized device so that the
                application can continue operating when an internet connection is
                unavailable.
              </p>

              <p>
                Local storage may use browser-managed storage technologies such as
                IndexedDB. When connectivity becomes available, supported data is
                synchronized with FlowBiz's cloud infrastructure.
              </p>

              <p>
                Users should protect devices used to access FlowBiz with appropriate
                screen locks, passwords, operating-system security updates, and
                other security controls because locally stored information may be
                accessible to anyone who gains unauthorized access to the device.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                6. Data Synchronization and Transmission
              </h2>

              <p>
                When FlowBiz synchronizes information with its cloud services,
                information is transmitted using secure network protocols such as
                HTTPS and, where applicable, secure real-time communication
                protocols.
              </p>

              <p>
                FlowBiz uses technical and organizational safeguards intended to
                protect information against unauthorized access, alteration,
                disclosure, loss, or destruction. However, no internet-connected
                service or electronic storage system can be guaranteed to be
                completely secure.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                7. Third-Party Service Providers
              </h2>

              <p>
                FlowBiz may rely on trusted technology and infrastructure providers
                to operate parts of the service. Depending on the features enabled,
                these providers may support services such as authentication, cloud
                storage, application hosting, email delivery, payment processing,
                communications, analytics, or security.
              </p>

              <p>
                Such providers may process information only to the extent reasonably
                necessary to provide their services to FlowBiz and are expected to
                apply appropriate security and confidentiality measures.
              </p>

              <p>
                Where FlowBiz integrates with an external service selected or
                activated by a business, information shared with that service may
                also be subject to that provider's own privacy policy and terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                8. M-Pesa, Payment and Communication Integrations
              </h2>

              <p>
                FlowBiz may support or integrate with payment and communication
                services, including mobile-money, payment gateway, email, or
                messaging services.
              </p>

              <p>
                Where such integrations are enabled, relevant transaction or
                contact information may be transmitted to the applicable service
                provider to complete or support the requested operation.
              </p>

              <p>
                FlowBiz does not need to store sensitive payment credentials such
                as a customer's mobile-money PIN in order to record a payment
                transaction. Users should never enter payment PINs, passwords, or
                other authentication secrets into ordinary FlowBiz customer or
                transaction fields.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                9. Cookies and Local Technologies
              </h2>

              <p>
                FlowBiz may use browser storage, session technologies, authentication
                tokens, and similar technologies that are necessary to keep users
                signed in, remember application state, support offline operation,
                maintain security, and provide core functionality.
              </p>

              <p>
                Where optional analytics or similar technologies are introduced,
                FlowBiz will provide appropriate information and controls where
                required by applicable law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                10. Data Retention
              </h2>

              <p>
                FlowBiz retains information for as long as reasonably necessary to
                provide the service, maintain legitimate business and security
                records, resolve disputes, comply with legal obligations, and
                protect the rights and interests of FlowBiz and its users.
              </p>

              <p>
                Business owners are responsible for determining appropriate
                retention periods for customer and business records under their
                control, including accounting, tax, debt, and transaction records.
              </p>

              <p>
                When information is no longer required for a legitimate purpose,
                FlowBiz may delete, anonymize, or otherwise securely dispose of it,
                subject to applicable legal, security, backup, and dispute-related
                requirements.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                11. Data Subject Rights
              </h2>

              <p>
                Under applicable Kenyan data protection law, individuals may have
                rights concerning their personal data, including the right to be
                informed about processing, access personal data, object to certain
                processing, request correction of inaccurate information, and
                request deletion where legally applicable.
              </p>

              <p>
                Where a FlowBiz customer has entered an individual's information
                into their business workspace, the individual should normally
                contact that business first because the business may be the Data
                Controller responsible for that information.
              </p>

              <p>
                Requests relating to information for which FlowBiz is the Data
                Controller may be submitted using the contact details provided
                below. FlowBiz may need to verify the identity and authority of a
                person making a request before disclosing or modifying information.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                12. Account Deletion and Data Removal
              </h2>

              <p>
                Users may request closure of their FlowBiz account or deletion of
                personal information associated with the account, subject to
                applicable legal and operational requirements.
              </p>

              <p>
                Deleting an account may not immediately remove every record from
                backups, security logs, fraud-prevention systems, or records that
                FlowBiz is legally required to retain. Such information will be
                retained only for as long as reasonably necessary for the applicable
                purpose.
              </p>

              <p>
                Business owners should also consider exporting any records they
                need before permanently closing a workspace.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                13. Data Accuracy
              </h2>

              <p>
                FlowBiz provides tools for businesses to create, update, and manage
                their operational records. Businesses are responsible for ensuring
                that personal information entered into their workspace is accurate,
                relevant, and kept up to date where necessary.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                14. Data Transfers
              </h2>

              <p>
                Some FlowBiz infrastructure or service providers may process or
                store information outside Kenya. Where personal data is transferred
                outside Kenya, FlowBiz will seek to apply appropriate safeguards
                and comply with applicable requirements governing international
                transfers of personal data.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                15. Security Incidents and Data Breaches
              </h2>

              <p>
                FlowBiz maintains reasonable technical and organizational measures
                designed to identify, prevent, investigate, and respond to security
                incidents.
              </p>

              <p>
                If FlowBiz becomes aware of a personal data breach affecting
                information processed on behalf of a business, FlowBiz will notify
                the relevant Data Controller without undue delay and, where
                reasonably practicable, within the period required by applicable
                law or contractual arrangements.
              </p>

              <p>
                Where FlowBiz is itself the Data Controller for affected information,
                it will assess the incident and take any notification or remediation
                steps required by applicable data protection law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                16. Children's Data
              </h2>

              <p>
                FlowBiz is a business management service and is not intended to be
                directed at children as its primary users.
              </p>

              <p>
                Businesses should not knowingly collect or enter children's personal
                data into FlowBiz unless they have a lawful basis and have complied
                with applicable requirements governing the processing of children's
                data.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                17. Changes to This Policy
              </h2>

              <p>
                FlowBiz may update this Privacy Policy when its services, technology,
                legal obligations, or data-processing practices change.
              </p>

              <p>
                The effective date displayed at the beginning of this policy will
                be updated when material changes are made. Users are encouraged to
                review this page periodically.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                18. Contact Us
              </h2>

              <p>
                For privacy questions, data protection requests, security concerns,
                or requests relating to information for which FlowBiz is the Data
                Controller, contact:
              </p>

              <p className="font-medium text-ink-800">
                support@flowbiz.co.ke
              </p>

              <p>
                If you are a customer of a business using FlowBiz and your request
                concerns information held by that business, you should normally
                contact the business directly first.
              </p>
            </section>

            <section className="space-y-3 border-t border-ink-100 pt-6">
              <h2 className="font-display text-lg font-bold text-ink-900">
                19. Your Responsibility as a FlowBiz User
              </h2>

              <p>
                Businesses using FlowBiz are responsible for using the platform in
                compliance with applicable privacy, consumer-protection, employment,
                tax, accounting, and other laws relevant to their operations.
              </p>

              <p>
                This includes informing customers and staff where required,
                collecting information lawfully, limiting collection to information
                that is reasonably necessary, maintaining appropriate access
                controls, and protecting devices and account credentials used to
                access FlowBiz.
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
````

## File: src/pages/Reports.jsx
````javascript
import { useMemo, useState } from 'react';
import { where, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useFinancialsForRange } from '../hooks/useFinancials';
import { useDailySession } from '../hooks/useDailySession';
import { useSettings } from '../hooks/useSettings';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorBanner from '../components/common/ErrorBanner';
import Modal from '../components/common/Modal';
import { formatKES } from '../utils/currency';
import { formatDate, formatDateTime, getRangeForPreset, startOfDay, endOfDay, todayKey } from '../utils/dateRanges';
import { computeSupplierBalances, computeExpectedTillBalances } from '../utils/financials';
import { Printer, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
];

function Card({ label, value, tone = 'text-ink-900' }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default function Reports() {
  const { businessId } = useAuth();
  const [preset, setPreset] = useState('today');
  const [cStart, setCStart] = useState('');
  const [cEnd, setCEnd] = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const { start, end } = useMemo(() => {
    if (preset === 'custom' && cStart && cEnd) {
      return { start: startOfDay(new Date(cStart)), end: endOfDay(new Date(cEnd)) };
    }
    return getRangeForPreset(preset === 'custom' ? 'today' : preset);
  }, [preset, cStart, cEnd]);

  const {
    loading,
    error,
    sales,
    creditSales,
    summary,
    purchases,
    supplierPayments,
  } = useFinancialsForRange(start, end);

  const { session } = useDailySession();
  const { settings } = useSettings();

  const productsQ = useMemo(
    () => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null),
    [businessId]
  );
  const purchasesQ = useMemo(
    () => (businessId ? tenantQuery('purchases', businessId, where('paymentStatus', '==', 'pending_supplier_credit')) : null),
    [businessId]
  );
  const outstandingCreditQ = useMemo(
    () => (businessId ? tenantQuery('creditSales', businessId, where('status', 'in', ['pending', 'partial'])) : null),
    [businessId]
  );
  const supplierPaymentsQ = useMemo(
    () => (businessId ? tenantQuery('supplierPayments', businessId) : null),
    [businessId]
  );
  const suppliersQ = useMemo(
    () => (businessId ? tenantQuery('suppliers', businessId) : null),
    [businessId]
  );

  const { data: products } = useFirestoreCollection(productsQ);
  const { data: purchasesData } = useFirestoreCollection(purchasesQ);
  const { data: outstandingCreditSales } = useFirestoreCollection(outstandingCreditQ);
  const { data: supplierPaymentsData } = useFirestoreCollection(supplierPaymentsQ);
  const { data: suppliersData } = useFirestoreCollection(suppliersQ);

  const totalInventoryValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.stock || 0) * (p.costPrice || 0), 0);
  }, [products]);

  const lowStock = useMemo(() => {
    return products.filter((p) => p.stock <= (p.lowStockThreshold ?? 5));
  }, [products]);

  const supplierBalances = useMemo(
    () => computeSupplierBalances(purchasesData, supplierPaymentsData, suppliersData),
    [purchasesData, supplierPaymentsData, suppliersData]
  );

  // Cash and M-Pesa purchase/supplier payment breakdowns (same as Close Day)
  const cashPurchases = useMemo(
    () => (purchases || []).filter((p) => p.paymentStatus === 'paid' && p.paymentMethod === 'Cash').reduce((s, p) => s + (Number(p.totalCost) || 0), 0),
    [purchases]
  );
  const mpesaPurchases = useMemo(
    () => (purchases || []).filter((p) => p.paymentStatus === 'paid' && p.paymentMethod === 'M-Pesa').reduce((s, p) => s + (Number(p.totalCost) || 0), 0),
    [purchases]
  );
  const creditPurchases = useMemo(
    () => (purchases || []).filter((p) => p.paymentStatus === 'pending_supplier_credit').reduce((s, p) => s + (Number(p.totalCost) || 0), 0),
    [purchases]
  );
  const cashSupplierPay = useMemo(
    () => (supplierPayments || []).filter((p) => p.method === 'Cash').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [supplierPayments]
  );
  const mpesaSupplierPay = useMemo(
    () => (supplierPayments || []).filter((p) => p.method === 'M-Pesa').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [supplierPayments]
  );

  const productPerf = useMemo(() => {
    const m = {};
    const ensure = (name) => {
      if (!m[name]) m[name] = { name, qty: 0, revenue: 0, profit: 0 };
      return m[name];
    };
    (sales || []).forEach((s) => {
      if (s.isVoided) return;
      if (Array.isArray(s.items) && s.items.length > 0) {
        s.items.forEach((it) => {
          const row = ensure(it.productName);
          row.qty += Number(it.quantity) || 0;
          row.revenue += Number(it.lineTotal ?? ((it.quantity || 0) * (it.unitPrice || 0))) || 0;
          row.profit += Number(it.lineProfit ?? (((it.unitPrice || 0) - (it.costPrice || 0)) * (it.quantity || 0))) || 0;
        });
      } else {
        const row = ensure(s.productName);
        row.qty += Number(s.quantity) || 0;
        row.revenue += Number(s.totalAmount) || 0;
        row.profit += Number(s.profit) || 0;
      }
    });
    (creditSales || []).forEach((cs) => {
      if (cs.status === 'cancelled' || cs.status === 'refunded') return;
      if (Array.isArray(cs.items) && cs.items.length > 0) {
        cs.items.forEach((it) => {
          const row = ensure(it.productName);
          row.qty += Number(it.quantity) || 0;
        });
      } else {
        const row = ensure(cs.productName);
        row.qty += Number(cs.quantity) || 0;
      }
    });
    return Object.values(m);
  }, [sales, creditSales]);

  const bestSelling = [...productPerf].sort((a, b) => b.qty - a.qty).slice(0, 5);

  const { expectedCashAtClose, expectedMpesaAtClose } = computeExpectedTillBalances({
    openingCashFloat: preset === 'today' ? (session?.openingCashFloat || 0) : 0,
    openingMpesaFloat: preset === 'today' ? (session?.openingMpesaFloat || 0) : 0,
    totalCashSales: summary.totalCashSales,
    totalMpesaSales: summary.totalMpesaSales,
    totalDebtRepaymentsCash: summary.totalDebtRepaymentsCash,
    totalDebtRepaymentsMpesa: summary.totalDebtRepaymentsMpesa,
    totalExpensesCash: summary.totalExpensesCash,
    totalExpensesMpesa: summary.totalExpensesMpesa,
    totalCashOutflows: summary.totalCashOutflows,
    totalMpesaOutflows: summary.totalMpesaOutflows,
  });

  const businessName = settings?.shopName || 'FlowBiz Store';

  const doExport = async (action) => {
    try {
      const { jsPDF } = await import('jspdf');
      const { loadImageAsDataUrl } = await import('../utils/documentService');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 14;
      const contentWidth = pageWidth - (marginX * 2);
      let y = 14;

      // 1. Clean Header (No green background)
      const logoDataUrl = await loadImageAsDataUrl(settings.logoUrl);
      let textX = marginX;

      if (logoDataUrl) {
        try {
          const format = logoDataUrl.match(/data:image\/(\w+);/)?.[1]?.toUpperCase() || 'PNG';
          doc.addImage(logoDataUrl, format, marginX, y, 16, 16);
          textX = marginX + 20;
        } catch (err) {
          console.error('Logo embed error:', err);
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(21, 23, 29);
      doc.text(businessName.toUpperCase(), textX, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(90, 98, 115);
      const metaLine = [settings.phone, settings.email, settings.address].filter(Boolean).join(' · ');
      if (metaLine) {
        doc.text(metaLine, textX, y + 11);
      }
      doc.text(`FINANCIAL AUDIT & PERFORMANCE STATEMENT  |  ${formatDate(start)} to ${formatDate(end)}`, textX, y + 15.5);

      y += 22;
      doc.setDrawColor(21, 23, 29);
      doc.setLineWidth(0.4);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 6;

      // Helper for clean subsection headers
      const drawSectionHeader = (title) => {
        doc.setFillColor(246, 241, 231); // warm subtle sand
        doc.roundedRect(marginX, y, contentWidth, 6.5, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(21, 23, 29);
        doc.text(title.toUpperCase(), marginX + 3, y + 4.6);
        y += 9.5;
      };

      // Helper for clean data rows
      const drawDataRow = (label, value, isBold = false, isHighlight = false, valueColor = [21, 23, 29]) => {
        if (isHighlight) {
          doc.setFillColor(241, 250, 244);
          doc.roundedRect(marginX, y - 3.5, contentWidth, 6, 0.8, 0.8, 'F');
        }
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(54, 59, 72);
        doc.text(label, marginX + 3, y + 0.8);

        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.text(value, pageWidth - marginX - 3, y + 0.8, { align: 'right' });

        doc.setDrawColor(232, 234, 237);
        doc.setLineWidth(0.12);
        doc.line(marginX + 3, y + 2.5, pageWidth - marginX - 3, y + 2.5);

        y += 5.8;
      };

      // 2. Cash Drawer Reconciliation Breakdown
      drawSectionHeader('1. Cash Drawer Shift Reconciliation');
      if (preset === 'today') {
        drawDataRow('Opening Cash Float', formatKES(session?.openingCashFloat || 0));
      }
      drawDataRow('+ Cash Sales Received', formatKES(summary.totalCashSales));
      drawDataRow('+ Debt Repayments Collected (Cash)', formatKES(summary.totalDebtRepaymentsCash));
      drawDataRow('− Shop Expenses Paid (Cash)', `- ${formatKES(summary.totalExpensesCash)}`);
      drawDataRow('− Customer Refunds Issued (Cash)', `- ${formatKES(summary.totalRefundsCash)}`);
      drawDataRow('− Direct Stock Purchases Paid (Cash)', `- ${formatKES(cashPurchases)}`);
      drawDataRow('− Supplier Debt Payments (Cash)', `- ${formatKES(cashSupplierPay)}`);
      drawDataRow('= Net Expected Cash in Drawer', formatKES(expectedCashAtClose), true, true, [26, 98, 60]);
      y += 3;

      // 3. M-Pesa Till Reconciliation Breakdown
      drawSectionHeader('2. M-Pesa Till Shift Reconciliation');
      if (preset === 'today') {
        drawDataRow('Opening M-Pesa Balance', formatKES(session?.openingMpesaFloat || 0));
      }
      drawDataRow('+ M-Pesa Sales Received', formatKES(summary.totalMpesaSales));
      drawDataRow('+ Debt Repayments Collected (M-Pesa)', formatKES(summary.totalDebtRepaymentsMpesa));
      drawDataRow('− Shop Expenses Paid (M-Pesa)', `- ${formatKES(summary.totalExpensesMpesa)}`);
      drawDataRow('− Customer Refunds Issued (M-Pesa)', `- ${formatKES(summary.totalRefundsMpesa)}`);
      drawDataRow('− Direct Stock Purchases Paid (M-Pesa)', `- ${formatKES(mpesaPurchases)}`);
      drawDataRow('− Supplier Debt Payments (M-Pesa)', `- ${formatKES(mpesaSupplierPay)}`);
      drawDataRow('= Net Expected M-Pesa Till Balance', formatKES(expectedMpesaAtClose), true, true, [26, 98, 60]);
      y += 3;

      // 4. Profit & Loss Statement (Cash-Flow / Operating)
      drawSectionHeader('3. Cash-Flow Profit & Loss Statement');
      drawDataRow('Recognized Cash-Flow Revenue (Sales + Debt Repaid − Refunds)', formatKES(summary.revenue));
      drawDataRow('− Cost of Goods Sold (COGS)', `- ${formatKES(summary.costOfGoodsSold)}`);
      drawDataRow('= Gross Profit', formatKES(summary.grossProfit), true, true, [26, 98, 60]);
      drawDataRow('− Total Operating Expenses', `- ${formatKES(summary.totalExpenses)}`);
      drawDataRow('= Net Operating Profit', formatKES(summary.netProfit), true, true, summary.netProfit >= 0 ? [26, 98, 60] : [196, 68, 29]);
      y += 3;

      // 5. Purchases & Supplier Restocking Summary
      drawSectionHeader('4. Stock Purchases & Supplier Credit Activity');
      drawDataRow('Total Stock Purchases (Cash & M-Pesa Paid)', formatKES(cashPurchases + mpesaPurchases));
      drawDataRow('Stock Taken on Supplier Credit (Payables Added)', formatKES(creditPurchases), false, false, [196, 68, 29]);
      drawDataRow('Supplier Debt Payments Cleared', formatKES(cashSupplierPay + mpesaSupplierPay), false, false, [26, 98, 60]);
      drawDataRow('Total Current Supplier Balance Outstanding', formatKES(supplierBalances.reduce((a, b) => a + b.balance, 0)), true);
      y += 3;

      // 6. Top Sellers & Low Stock (compact)
      if (bestSelling.length > 0) {
        drawSectionHeader('5. Top-Performing Product Sales');
        bestSelling.forEach((p, idx) => {
          drawDataRow(`${idx + 1}. ${p.name} (${p.qty} units)`, formatKES(p.revenue));
        });
        y += 3;
      }

      // Footer
      doc.setFontSize(7.5);
      doc.setTextColor(140, 145, 155);
      doc.text(`Generated on ${formatDateTime(new Date())} · Official Record from FlowBiz Workstation`, marginX, 287);
      doc.text(`Page 1 of 1`, pageWidth - marginX, 287, { align: 'right' });

      if (action === 'download') {
        doc.save(`flowbiz-report-${preset}-${todayKey()}.pdf`);
      } else {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      }
      toast.success('Report ready.');
      setPdfModalOpen(false);
    } catch (err) {
      toast.error('Failed to generate PDF. Check console.');
      console.error(err);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-xl font-bold text-ink-900">Reports</h1>
        <Link to="/advanced-analytics" className="btn-outline">
          <TrendingUp className="h-4 w-4" /> Advanced Analytics
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              preset === p.id ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" className="input !w-auto" value={cStart} onChange={(e) => setCStart(e.target.value)} />
            <span className="text-ink-400">to</span>
            <input type="date" className="input !w-auto" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
          </div>
        )}
      </div>

      <ErrorBanner message={error ? `${error}` : null} />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div>
            <h2 className="mb-2 font-display text-sm font-bold text-ink-800">Financial Summary</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card label="Cash Balance" value={formatKES(expectedCashAtClose)} />
              <Card label="M-Pesa Balance" value={formatKES(expectedMpesaAtClose)} />
              <Card label="Credit Sales" value={formatKES(summary.totalCreditSales)} tone="text-rust-600" />
              <Card label="Repayments Collected" value={formatKES(summary.totalDebtRepayments)} tone="text-moss-700" />
            </div>
          </div>
          <div>
            <h2 className="mb-2 font-display text-sm font-bold text-ink-800">Profit Calculation</h2>
            <div className="card divide-y divide-ink-100">
              {[
                ['Revenue', summary.revenue, false],
                ['− Cost of goods sold', -summary.costOfGoodsSold, false],
                ['= Gross profit', summary.grossProfit, true],
                ['− Total expenses', -summary.totalExpenses, false],
                ['= Net profit', summary.netProfit, true],
              ].map(([label, value, bold], i) => (
                <div key={label} className={`flex items-center justify-between px-4 py-3 ${bold ? 'bg-ink-50/60' : ''}`}>
                  <span className={`text-sm ${bold ? 'font-bold text-ink-900' : 'text-ink-600'}`}>{label}</span>
                  <span className={`font-semibold ${value < 0 ? 'text-rust-600' : i === 4 ? 'text-moss-700' : 'text-ink-800'}`}>
                    {formatKES(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setPdfModalOpen(true)}>
              <Printer className="h-4 w-4" strokeWidth={1.75} /> Get PDF Report
            </button>
          </div>
        </>
      )}

      <Modal open={pdfModalOpen} onClose={() => setPdfModalOpen(false)} title="Export Financial Report">
        <div className="space-y-3">
          <p className="text-sm text-ink-500 mb-4">Export clean, print-ready accounting reports with full till reconciliation and purchases for your records.</p>
          <button className="btn-primary w-full" onClick={() => doExport('download')}>Download PDF Report</button>
          <button className="btn-outline w-full" onClick={() => doExport('print')}>Print Report Directly</button>
          <button className="btn-secondary w-full mt-2" onClick={() => setPdfModalOpen(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
````

## File: src/pages/Terms.jsx
````javascript
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-sand text-ink-900 selection:bg-moss-200 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-800 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to App
        </Link>

        <div className="card p-6 sm:p-10 space-y-8 bg-white border border-ink-100 shadow-sm">
          <div className="border-b border-ink-100 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-moss-50 text-moss-700 rounded-xl flex items-center justify-center">
                <FileText className="h-6 w-6" strokeWidth={2} />
              </div>

              <h1 className="font-display text-2xl font-bold text-ink-900">
                Terms of Service
              </h1>
            </div>

            <p className="text-sm text-ink-500">
              Effective Date: August 22, 2026
            </p>
          </div>

          <div className="space-y-8 text-sm text-ink-700 leading-relaxed">

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                1. Acceptance of Terms
              </h2>

              <p>
                By creating an account, accessing, or using FlowBiz (the
                "Service"), you agree to be bound by these Terms of Service
                ("Terms"), together with our Privacy Policy and any additional
                terms that apply to specific features or paid services.
              </p>

              <p>
                If you do not agree to these Terms, you must not create an
                account or use the Service.
              </p>

              <p>
                If you are using FlowBiz on behalf of a business or organization,
                you represent that you have the authority to accept these Terms
                on that organization's behalf.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                2. Description of the Service
              </h2>

              <p>
                FlowBiz is a cloud-enabled, offline-first business management
                and point-of-sale (POS) application designed primarily for
                small and medium-sized businesses.
              </p>

              <p>
                Depending on the plan and features enabled, FlowBiz may provide
                tools for:
              </p>

              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>Sales and point-of-sale transaction recording.</li>
                <li>Inventory and stock management.</li>
                <li>Customer and debtor management.</li>
                <li>Quotation and invoice creation.</li>
                <li>Receipt generation and sharing.</li>
                <li>Expense recording and business reporting.</li>
                <li>Staff accounts, roles, and permissions.</li>
                <li>Offline transaction recording and synchronization.</li>
                <li>Payment and communication integrations.</li>
                <li>Business analytics and operational insights.</li>
              </ul>

              <p>
                Features may vary by subscription plan and may be changed,
                introduced, restricted, or discontinued as FlowBiz evolves.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                3. Eligibility and Account Registration
              </h2>

              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>
                  You must provide accurate and reasonably complete information
                  when creating and maintaining your account.
                </li>

                <li>
                  You are responsible for maintaining the confidentiality of
                  your account credentials and for activity occurring through
                  your account.
                </li>

                <li>
                  You must notify FlowBiz promptly if you believe your account
                  has been accessed without authorization.
                </li>

                <li>
                  You must not create an account using false identity
                  information or impersonate another person or business.
                </li>
              </ul>

              <p>
                FlowBiz may require additional information or verification where
                reasonably necessary for account security, payment processing,
                fraud prevention, or legal compliance.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                4. Business Owners, Staff, and Permissions
              </h2>

              <p>
                A business owner or authorized administrator may invite staff
                members to access a FlowBiz workspace and may assign roles or
                permissions available within the Service.
              </p>

              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>
                  Business owners are responsible for determining which staff
                  members receive access.
                </li>

                <li>
                  Business owners are responsible for reviewing and removing
                  access when a staff member no longer requires it.
                </li>

                <li>
                  Business owners are responsible for the actions performed by
                  authorized staff members within their workspace.
                </li>

                <li>
                  Staff members must not share credentials or intentionally
                  access information beyond the permissions assigned to them.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                5. Your Business Data and Privacy Responsibilities
              </h2>

              <p>
                FlowBiz allows businesses to store information relating to
                customers, employees, products, transactions, debts, expenses,
                and other business operations.
              </p>

              <p>
                You are responsible for ensuring that you have a lawful basis
                and any required permissions, notices, consents, or other
                authorizations necessary to collect and process personal data
                entered into your FlowBiz workspace.
              </p>

              <p>
                Where you determine the purposes and means of processing
                customer or staff information, you may be the Data Controller
                for that information, while FlowBiz may act as a Data Processor
                on your behalf.
              </p>

              <p>
                FlowBiz may separately act as a Data Controller for information
                it processes for its own purposes, including account management,
                service security, support, billing, fraud prevention, and legal
                compliance.
              </p>

              <p>
                Please review our{' '}
                <Link
                  to="/privacy"
                  className="text-moss-600 hover:underline font-semibold"
                >
                  Privacy Policy
                </Link>{' '}
                for more information about data processing.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                6. Accuracy of Business Records
              </h2>

              <p>
                FlowBiz provides tools for recording and organizing business
                information. You are responsible for ensuring that information
                entered into the Service is accurate and that transactions,
                inventory quantities, prices, expenses, debts, payments,
                refunds, and other records are reviewed for accuracy.
              </p>

              <p>
                FlowBiz does not independently verify the accuracy of every
                transaction entered by users and is not responsible for losses
                resulting from incorrect information entered by you or your
                staff.
              </p>

              <p>
                You remain responsible for maintaining appropriate accounting,
                tax, financial, and statutory records for your business.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                7. Offline-First Functionality
              </h2>

              <p>
                FlowBiz is designed to support offline-first operation. Certain
                features may continue to function when an internet connection
                is unavailable, with supported information stored temporarily
                on the device and synchronized when connectivity is restored.
              </p>

              <p>
                Offline functionality does not guarantee that every feature will
                remain available without an internet connection. Certain
                operations, integrations, authentication activities, messaging
                functions, payment confirmations, and synchronization processes
                may require connectivity.
              </p>

              <p>
                Users are responsible for maintaining secure devices and should
                avoid using compromised or publicly accessible devices to access
                sensitive business information.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                8. Synchronization and Connectivity
              </h2>

              <p>
                When a device reconnects to the internet, FlowBiz may synchronize
                locally stored information with its cloud services.
              </p>

              <p>
                Synchronization may be affected by network availability,
                device storage, browser limitations, software errors, or other
                technical conditions.
              </p>

              <p>
                Users should allow synchronization to complete where reasonably
                possible and should not intentionally interfere with the
                synchronization process.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                9. Subscriptions and Payments
              </h2>

              <p>
                FlowBiz may offer free and paid subscription plans. The features,
                limits, pricing, and duration applicable to each plan will be
                presented at the time of purchase or upgrade.
              </p>

              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>
                  <strong>FlowBiz Pro:</strong> Paid plans may unlock additional
                  functionality such as WhatsApp document sharing, PDF
                  generation, additional staff functionality, advanced
                  analytics, and other Pro features.
                </li>

                <li>
                  <strong>Prepaid Billing:</strong> Where applicable, paid
                  subscriptions are purchased for a defined prepaid period.
                </li>

                <li>
                  <strong>No Automatic Renewal:</strong> Unless explicitly
                  stated otherwise at the time of purchase, FlowBiz does not
                  automatically charge your payment method when a subscription
                  period expires.
                </li>

                <li>
                  <strong>Payment Processing:</strong> Payments may be processed
                  through third-party payment providers such as Paystack. Your
                  use of such payment services may also be subject to the
                  provider's terms and policies.
                </li>
              </ul>

              <p>
                FlowBiz may change subscription pricing or introduce new plans
                in the future. Changes will not retroactively alter a prepaid
                subscription period that has already been purchased.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                10. Refunds
              </h2>

              <p>
                Unless otherwise required by applicable law or expressly stated
                at the time of purchase, FlowBiz subscriptions are generally
                non-refundable after activation.
              </p>

              <p>
                We generally do not provide prorated refunds for partially
                unused subscription periods.
              </p>

              <p>
                If a payment was made in error, duplicated, or affected by a
                technical problem, you may contact support so that the
                transaction can be reviewed.
              </p>

              <p>
                Nothing in this section limits any mandatory consumer or
                statutory rights that cannot legally be excluded.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                11. Third-Party Integrations
              </h2>

              <p>
                FlowBiz may provide integrations or links to third-party
                services, including payment providers, mobile-money services,
                email providers, messaging platforms, hosting infrastructure,
                and other external services.
              </p>

              <p>
                Third-party services operate independently from FlowBiz and may
                have their own terms, privacy policies, availability requirements,
                fees, and technical limitations.
              </p>

              <p>
                FlowBiz is not responsible for failures, delays, outages,
                incorrect responses, policy changes, or other issues caused by
                third-party services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                12. Acceptable Use
              </h2>

              <p>
                You agree not to use FlowBiz to:
              </p>

              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>
                  Engage in illegal, fraudulent, deceptive, or abusive
                  activities.
                </li>

                <li>
                  Store or transmit information that you do not have the legal
                  right to process.
                </li>

                <li>
                  Send unauthorized promotional messages, spam, or abusive
                  communications through FlowBiz integrations.
                </li>

                <li>
                  Attempt to gain unauthorized access to another user's account,
                  workspace, device, or business information.
                </li>

                <li>
                  Attempt to bypass subscription restrictions, usage limits,
                  authentication controls, or security mechanisms.
                </li>

                <li>
                  Reverse engineer, decompile, or otherwise attempt to extract
                  the source code or underlying technology of the Service except
                  where permitted by applicable law.
                </li>

                <li>
                  Introduce malware, malicious code, or other harmful material
                  into the Service.
                </li>

                <li>
                  Use automated methods to abuse, overload, scrape, or interfere
                  with the Service or its infrastructure.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                13. Intellectual Property
              </h2>

              <p>
                FlowBiz and its underlying software, interface, branding,
                logos, designs, documentation, features, and related intellectual
                property are owned by or licensed to FlowBiz and are protected
                by applicable intellectual property laws.
              </p>

              <p>
                Your subscription gives you a limited, non-exclusive,
                non-transferable right to access and use the Service for your
                legitimate business operations during the applicable subscription
                period.
              </p>

              <p>
                You retain ownership of business information and content that
                you lawfully submit to FlowBiz, subject to the rights necessary
                for FlowBiz to operate the Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                14. Service Availability and Changes
              </h2>

              <p>
                FlowBiz is provided on an "as available" basis. We aim to keep
                the Service reliable but do not guarantee uninterrupted or
                error-free operation.
              </p>

              <p>
                Service availability may be affected by maintenance, software
                updates, infrastructure failures, internet connectivity,
                third-party services, security incidents, or circumstances
                beyond our reasonable control.
              </p>

              <p>
                We may modify, improve, suspend, or discontinue features of the
                Service when reasonably necessary for security, technical,
                business, or legal reasons.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                15. Data Backups and Export
              </h2>

              <p>
                FlowBiz uses cloud synchronization and other technical measures
                to support the availability of business information. However,
                users should not treat FlowBiz as their only backup system for
                legally or commercially important records.
              </p>

              <p>
                Where export functionality is provided, users are responsible
                for periodically exporting and securely retaining records they
                are required to keep for accounting, tax, regulatory, or
                business-continuity purposes.
              </p>

              <p>
                FlowBiz does not guarantee recovery of every record in every
                circumstance, including circumstances involving unauthorized
                access, device failure, corruption, synchronization conflicts,
                accidental deletion, or events beyond our reasonable control.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                16. Disclaimers
              </h2>

              <p>
                <strong>Not Professional Advice:</strong> FlowBiz is a business
                management and record-keeping tool. It is not a substitute for
                professional accounting, tax, financial, legal, or business
                advice.
              </p>

              <p>
                <strong>Tax and Regulatory Compliance:</strong> FlowBiz does not
                guarantee compliance with KRA requirements, eTIMS, VAT
                requirements, accounting standards, or any other regulatory
                requirement unless a specific compliance feature is expressly
                identified and supported by FlowBiz.
              </p>

              <p>
                <strong>Payment Information:</strong> Recording a payment in
                FlowBiz does not by itself guarantee that money was successfully
                transferred, received, settled, or reversed by the relevant
                payment provider.
              </p>

              <p>
                <strong>As-Is Basis:</strong> To the maximum extent permitted by
                applicable law, the Service is provided "as is" and "as
                available" without warranties that the Service will always be
                uninterrupted, error-free, completely secure, or suitable for
                every particular business requirement.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                17. Limitation of Liability
              </h2>

              <p>
                To the maximum extent permitted by Kenyan law, FlowBiz and its
                owners, operators, developers, and service providers will not be
                liable for indirect, incidental, special, consequential, or
                exemplary losses arising from the use of, or inability to use,
                the Service.
              </p>

              <p>
                This may include losses relating to business interruption, lost
                profits, lost opportunities, loss of anticipated savings, or
                loss of data, except where such liability cannot legally be
                excluded or limited.
              </p>

              <p>
                Nothing in these Terms is intended to exclude liability that
                cannot lawfully be excluded under applicable Kenyan law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                18. Suspension and Termination
              </h2>

              <p>
                You may stop using FlowBiz and request closure of your account
                at any time.
              </p>

              <p>
                FlowBiz may temporarily suspend or terminate access where
                reasonably necessary because of:
              </p>

              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>Violation of these Terms.</li>
                <li>Fraudulent, abusive, or unlawful activity.</li>
                <li>Security risks or suspected unauthorized access.</li>
                <li>Non-payment of applicable fees.</li>
                <li>Legal or regulatory requirements.</li>
                <li>Conduct that materially threatens the Service or other users.</li>
              </ul>

              <p>
                Where reasonably practicable, FlowBiz may provide notice before
                taking termination action. Immediate suspension may be necessary
                where delay would create a security, legal, or operational risk.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                19. Effect of Termination
              </h2>

              <p>
                Following termination, your right to access paid or restricted
                features may end. Certain information may continue to be
                retained where required for legal, security, accounting, fraud
                prevention, dispute resolution, or other legitimate purposes.
              </p>

              <p>
                Where available, users should export important business records
                before terminating their account.
              </p>

              <p>
                Provisions relating to intellectual property, acceptable use,
                disclaimers, limitation of liability, governing law, and any
                obligations that by their nature should survive termination will
                continue to apply after termination.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                20. Changes to These Terms
              </h2>

              <p>
                We may update these Terms from time to time to reflect changes
                to the Service, business practices, technology, or applicable
                law.
              </p>

              <p>
                The updated Terms will be made available through FlowBiz and the
                effective date will be updated where appropriate. Continued use
                of the Service after the effective date of material changes
                constitutes acceptance of the updated Terms, to the extent
                permitted by applicable law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                21. Governing Law and Disputes
              </h2>

              <p>
                These Terms are governed by and construed in accordance with the
                laws of the Republic of Kenya.
              </p>

              <p>
                The parties will seek to resolve disputes relating to the Service
                or these Terms through good-faith communication before pursuing
                formal proceedings where reasonably practicable.
              </p>

              <p>
                Subject to any mandatory legal rights or dispute-resolution
                requirements, disputes that cannot be resolved informally will
                be subject to the jurisdiction of the courts of Kenya.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                22. Contact Us
              </h2>

              <p>
                If you have questions about these Terms, your account, billing,
                or the FlowBiz Service, contact:
              </p>

              <p className="font-medium text-ink-800">
                support@flowbiz.co.ke
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
````

## File: src/utils/customers.js
````javascript
// src/utils/customers.js
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { tenantCollection, withBusiness } from '../lib/tenant';
import { raceWithTimeout } from './offlineWrite';
import { normalizePhone } from './whatsapp';

export async function createCustomer(data, businessId) {
  if (!businessId) throw new Error('createCustomer() called with no businessId');
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Customer name is required.');

  const phone = data.phone ? normalizePhone(data.phone) : '';
  const customerCode = `CUS-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;

  // Generate reference synchronously so the ID is immediately available offline
  const customerRef = doc(tenantCollection('customers'));
  const customerId = customerRef.id;

  const customerPayload = withBusiness({
    name,
    phone: phone || '',
    customerCode,
    email: data.email || '',
    address: data.address || '',
    notes: data.notes || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  }, businessId);

  const write = setDoc(customerRef, customerPayload);
  const { queuedOffline, error } = await raceWithTimeout(write, 1500);
  if (error) throw error;

  return {
    id: customerId,
    customerCode,
    name,
    phone,
    queuedOffline,
  };
}

export async function updateCustomer(customerId, data, businessId) {
  if (!businessId) throw new Error('updateCustomer() called with no businessId');
  if (!customerId) throw new Error('updateCustomer() called with no customerId');

  const customerRef = doc(db, 'customers', customerId);
  const updates = { ...data };
  delete updates.businessId;
  delete updates.id;

  if (updates.phone) {
    updates.phone = normalizePhone(updates.phone);
  }

  updates.updatedAt = new Date();

  const write = updateDoc(customerRef, updates);
  const { queuedOffline, error } = await raceWithTimeout(write, 1500);
  if (error) throw error;

  return { queuedOffline };
}
````

## File: src/utils/offlineWrite.js
````javascript
// src/utils/offlineWrite.js — full file (small, and every call site depends on this exact contract)
export function raceWithTimeout(promise, timeoutMs = 4000) {
  timeoutMs = Math.min(timeoutMs, 1500); 
  return new Promise((resolve) => {
    // Already offline? There's no point waiting out the full timeout to
    // "discover" that — resolve as queued immediately instead of padding
    // every offline action with a fixed ~4s stall.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      resolve({ queuedOffline: true });
      promise.catch(() => {}); // still observed, just not blocking anything
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve({ queuedOffline: true }); }
    }, timeoutMs);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ queuedOffline: false, value });
      },
      (err) => {
        clearTimeout(timer);
        if (!settled) { settled = true; resolve({ queuedOffline: false, error: err }); }
      }
    );
  });
}
````

## File: src/utils/products.js
````javascript
import { collection, doc, writeBatch, updateDoc, deleteField, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { raceWithTimeout } from './offlineWrite';

function barcodeIndexRef(businessId, barcode) {
  return doc(db, 'barcodeIndex', `${businessId}__${barcode}`);
}

export async function permanentlyDeleteProduct(productId, barcode, businessId) {
  if (!businessId) throw new Error('permanentlyDeleteProduct() called with no businessId');
  const productRef = doc(db, 'products', productId);
  const trimmedBarcode = barcode ? String(barcode).trim() : null;

  const batch = writeBatch(db);
  if (trimmedBarcode) {
    const idxRef = barcodeIndexRef(businessId, trimmedBarcode);
    const idxSnap = await getDoc(idxRef);
    if (idxSnap.exists() && idxSnap.data().productId === productId) {
      batch.delete(idxRef);
    }
  }
  batch.delete(productRef);
  await batch.commit();
}

export async function createProduct(data, businessId) {
  if (!businessId) throw new Error('createProduct() called with no businessId');
  const barcode = data.barcode ? String(data.barcode).trim() : null;
  const newProductRef = doc(collection(db, 'products'));
  const internalCode = `FB-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;

  const batch = writeBatch(db);
  batch.set(newProductRef, {
    ...data,
    businessId,
    barcode: barcode || null,
    internalCode,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (barcode) {
    batch.set(barcodeIndexRef(businessId, barcode), { businessId, barcode, productId: newProductRef.id });
  }

  const { queuedOffline, error } = await raceWithTimeout(batch.commit(), 4000);
  if (error) throw error;

  return { id: newProductRef.id, queuedOffline };
}

export async function updateProduct(productId, data, previousBarcode, businessId) {
  if (!businessId) throw new Error('updateProduct() called with no businessId');
  const nextBarcode = data.barcode ? String(data.barcode).trim() : null;
  const prevBarcode = previousBarcode ? String(previousBarcode).trim() : null;
  const productRef = doc(db, 'products', productId);
  const { stock, businessId: _ignored, ...updatePayload } = data;

  const batch = writeBatch(db);
  batch.update(productRef, { ...updatePayload, barcode: nextBarcode || null, updatedAt: serverTimestamp() });

  if (prevBarcode && prevBarcode !== nextBarcode) {
    batch.delete(barcodeIndexRef(businessId, prevBarcode));
  }
  if (nextBarcode && nextBarcode !== prevBarcode) {
    batch.set(barcodeIndexRef(businessId, nextBarcode), { businessId, barcode: nextBarcode, productId });
  }

  const { queuedOffline, error } = await raceWithTimeout(batch.commit(), 4000);
  if (error) throw error;

  return { queuedOffline };
}

// FIX: archiving now also removes the barcode from barcodeIndex —
// previously only a *permanent* delete did this, so an archived product
// silently kept its barcode "reserved" behind the scenes.
export async function softDeleteProduct(productId, barcode, businessId) {
  const productRef = doc(db, 'products', productId);
  const trimmedBarcode = barcode ? String(barcode).trim() : null;

  const batch = writeBatch(db);
  batch.update(productRef, { deleted: true, deletedAt: serverTimestamp() });

  if (trimmedBarcode && businessId) {
    const idxRef = barcodeIndexRef(businessId, trimmedBarcode);
    const idxSnap = await getDoc(idxRef);
    if (idxSnap.exists() && idxSnap.data().productId === productId) {
      batch.delete(idxRef);
    }
  }

  await batch.commit();
}

// Restoring re-creates the barcode index entry — unless another product
// has since claimed that exact barcode while this one was archived, in
// which case we restore the product but clear its barcode rather than
// silently taking over the other product's index entry.
export async function restoreProduct(productId, barcode, businessId) {
  const productRef = doc(db, 'products', productId);
  const trimmedBarcode = barcode ? String(barcode).trim() : null;

  if (trimmedBarcode && businessId) {
    const idxRef = barcodeIndexRef(businessId, trimmedBarcode);
    const idxSnap = await getDoc(idxRef);
    if (idxSnap.exists()) {
      if (idxSnap.data().productId !== productId) {
        await updateDoc(productRef, { deleted: false, deletedAt: deleteField(), barcode: null });
        return { barcodeCleared: true };
      }
      // Already correctly indexed to this same product — nothing to do.
    } else {
      await setDoc(idxRef, { businessId, barcode: trimmedBarcode, productId });
    }
  }

  await updateDoc(productRef, { deleted: false, deletedAt: deleteField() });
  return { barcodeCleared: false };
}
````

## File: src/index.css
````css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Prevent double-tap zoom on interactive elements — smooth POS experience */
  * {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    box-sizing: border-box;
  }

  html {
    @apply font-sans text-ink-900;
    /* Prevent iOS bounce / overscroll that breaks fixed bottom nav */
    overscroll-behavior: none;
    -webkit-text-size-adjust: 100%;
  }

  body {
    @apply bg-sand m-0 p-0;
    overscroll-behavior: none;
    /* Safe area insets for notched phones */
    padding-bottom: env(safe-area-inset-bottom);
    padding-left:   env(safe-area-inset-left);
    padding-right:  env(safe-area-inset-right);
  }

  h1, h2, h3, h4 { @apply font-display; }

  /* Smooth scrolling for all scrollable areas */
  * { scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }

  /* Remove iOS input shadows while preserving default native checkboxes and radios */
  input:not([type="checkbox"]):not([type="radio"]), select, textarea, button {
    -webkit-appearance: none;
    appearance: none;
  }

  /* Minimum touch target for all interactive elements */
  button, a, [role="button"] {
    min-height: 44px;
    min-width: 44px;
  }
}

@layer components {
  .btn {
    @apply inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold
           transition-colors disabled:opacity-40 disabled:cursor-not-allowed
           min-h-[44px] active:scale-95;
  }
  .btn-primary   { @apply btn bg-moss-600  text-white   hover:bg-moss-700  active:bg-moss-800; }
  .btn-secondary { @apply btn bg-ink-100   text-ink-800 hover:bg-ink-200   active:bg-ink-300; }
  .btn-danger    { @apply btn bg-rust-600  text-white   hover:bg-rust-700  active:bg-rust-800; }
  .btn-outline   { @apply btn border border-ink-200 text-ink-700 hover:bg-ink-50 active:bg-ink-100; }

  .input {
    @apply w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900
           placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-moss-500
           focus:border-moss-500 min-h-[44px];
  }
  .label  { @apply block text-xs font-semibold uppercase tracking-wide text-ink-500 mb-1.5; }
  .card   { @apply bg-white rounded-xl2 border border-ink-100 shadow-sm; }
  .badge  { @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold; }

  /* Bottom nav safe area support on iOS notched devices */
  .bottom-nav-safe {
    padding-bottom: max(0.625rem, env(safe-area-inset-bottom));
  }
}
````

## File: src/main.jsx
````javascript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import toast from 'react-hot-toast';
import { registerSW } from 'virtual:pwa-register';
import { enterDemoMode, isDemoMode } from './demo/demoMode';
import { seedDemoDataIfNeeded } from './demo/seedData';

if (import.meta.env.MODE === 'demo' || isDemoMode()) {
  enterDemoMode();
  seedDemoDataIfNeeded();
}

if (import.meta.env.MODE !== 'demo') {
  const updateSW = registerSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      }, 60 * 1000);
    },
    onNeedRefresh() {
      updateSW(true);
    },
    onOfflineReady() {},
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
````

## File: firebase.json
````json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "emulators": {
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
````

## File: package.json
````json
{
  "name": "flowbiz",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:demo": "vite --mode demo",
    "build": "vite build && vite build --mode demo --outDir dist/demo --base /demo/",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@zxing/browser": "^0.2.1",
    "@zxing/library": "^0.23.0",
    "firebase": "^12.15.0",
    "jspdf": "^2.5.1",
    "lucide-react": "^1.22.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-hot-toast": "^2.4.1",
    "react-icons": "^5.7.0",
    "jszip": "^3.10.1",
    "react-router-dom": "^6.30.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.2",
    "autoprefixer": "^10.4.20",
    "eslint": "^10.5.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.3",
    "globals": "^17.6.0",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "vite": "^8.1.0",
    "vite-plugin-pwa": "^1.3.0"
  }
}
````

## File: src/components/layout/TopHeader.jsx
````javascript
// src/components/layout/TopHeader.jsx
import { useAuth } from '../../contexts/AuthContext';
import ConnectivityIndicator from '../common/ConnectivityIndicator';
import { isDemoMode } from '../../demo/demoMode';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function TopHeader() {
  const { profile, logout, isAdmin, isPro } = useAuth();
  const demo = isDemoMode();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-100 bg-sand/95 px-4 py-2 backdrop-blur sm:px-6 safe-top">
      <div className="flex min-w-0 items-center gap-3">
{demo ? (
  <div className="flex items-center gap-2">
    <span className="badge bg-amber-100 text-amber-800 font-bold flex items-center gap-1 border border-amber-200">
      <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Interactive Demo
    </span>
    <a
      href="/setup"
      className="bg-moss-700 hover:bg-moss-800 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
    >
      <span>Create Free Account</span>
      <ArrowRight className="h-3 w-3" />
    </a>
  </div>
) : (
  
          isAdmin && (
            <Link
              to="/pro"
              className={`inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                isPro
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-moss-600 text-white hover:bg-moss-700 active:bg-moss-800'
              }`}
            >
              {isPro ? 'Pro Activated' : 'FlowBiz Pro'}
            </Link>
          )
        )}

        <div className="hidden truncate text-sm text-ink-500 lg:block">
          Welcome, <span className="font-semibold text-ink-800">{profile?.displayName || (demo ? 'Demo Owner' : 'Manager')}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!demo && <ConnectivityIndicator />}

        <span className={`badge hidden sm:inline-flex ${profile?.role === 'owner' || demo ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-700'}`}>
          {profile?.role === 'owner' || demo ? 'Owner' : 'Cashier'}
        </span>

        {demo ? (
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = '/';
            }}
            className="btn-outline !px-3 !py-1.5 text-xs !min-h-0"
          >
            Exit Demo
          </button>
        ) : (
          <button onClick={logout} className="btn-outline !px-3 !py-1.5 text-xs !min-h-0">
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
````

## File: src/components/pos/CartList.jsx
````javascript
import { useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus, X } from 'lucide-react';
import { formatKES, roundMoney } from '../../utils/currency';

export default function CartList({ cart, onUpdateQuantity, onUpdatePrice, onRemove, onClear, onCheckout }) {
  const [expanded, setExpanded] = useState(true);
  if (!cart || cart.length === 0) return null;

  const total = roundMoney(cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0));

  return (
    <div className="card border-moss-200 shadow-md p-3 sm:p-4 space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left min-h-[36px]"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-display text-sm font-bold text-ink-800 shrink-0">
            Cart · {cart.length} product{cart.length !== 1 ? 's' : ''}
          </h2>
          <span className="font-display text-sm font-bold text-moss-700 shrink-0">{formatKES(total)}</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-ink-400 shrink-0" strokeWidth={2} /> : <ChevronDown className="h-4 w-4 text-ink-400 shrink-0" strokeWidth={2} />}
      </button>

      {expanded && (
        <div className="-mt-1">
      
          <div className="max-h-[220px] overflow-y-auto pr-1 divide-y divide-ink-100">
            {cart.map((item) => {
              const lineTotal = roundMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
              return (
                <div key={item.productId} className="py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-ink-800 text-sm leading-snug">{item.productName}</p>
                    <button
                      type="button"
                      onClick={() => onRemove(item.productId)}
                      className="shrink-0 rounded-lg p-1.5 text-ink-300 hover:bg-rust-50 hover:text-rust-500 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      aria-label={`Remove ${item.productName}`}
                    >
                      <X className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.productId, (Number(item.quantity) || 1) - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        className="input !w-16 !py-2 !min-h-0 text-center"
                        value={item.quantity}
                        onChange={(e) => onUpdateQuantity(item.productId, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.productId, (Number(item.quantity) || 0) + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-ink-400">@ KES</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input !w-24 !py-2 !min-h-0 text-right"
                        value={item.unitPrice}
                        onChange={(e) => onUpdatePrice(item.productId, e.target.value)}
                      />
                    </div>

                    <span className="ml-auto font-display text-sm font-bold text-ink-800">{formatKES(lineTotal)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-2 text-right">
            <button type="button" onClick={onClear} className="text-xs font-semibold text-rust-500 hover:underline">
              Clear cart
            </button>
          </div>
        </div>
      )}

      <button type="button" className="btn-primary w-full" onClick={onCheckout}>
        Sell  {formatKES(total)}
      </button>
    </div>
  );
}
````

## File: src/demo/localAuth.js
````javascript
export const DEMO_UID = 'demo-admin';

const DEMO_USER = {
  uid: DEMO_UID,
  email: 'demo@flowbiz.app',
  displayName: 'Demo Owner',
  emailVerified: true,
};

export function getAuth() {
  return { __demo: true, currentUser: DEMO_USER };
}

export function onAuthStateChanged(_auth, callback) {
  const timer = setTimeout(() => callback(DEMO_USER), 0);
  return () => clearTimeout(timer);
}

export async function signInWithEmailAndPassword() {
  return { user: DEMO_USER };
}

export async function signOut() {
  return Promise.resolve();
}

export async function createUserWithEmailAndPassword() {
  throw new Error('Account creation is not available in Demo Mode.');
}

export async function sendEmailVerification() {
  return Promise.resolve();
}

export async function reload() {
  return Promise.resolve();
}

export async function deleteUser() {
  return Promise.resolve();
}

export async function applyActionCode() {
  return Promise.resolve();
}

export async function checkActionCode() {
  return Promise.resolve({});
}

export async function sendPasswordResetEmail() {
  return Promise.resolve();
}

export async function verifyPasswordResetCode() {
  return Promise.resolve(DEMO_USER.email);
}

export async function confirmPasswordReset() {
  return Promise.resolve();
}

export const EmailAuthProvider = {
  credential: (email, password) => ({ email, password }),
};

export async function reauthenticateWithCredential() {
  return Promise.resolve();
}

export function connectAuthEmulator() {}
````

## File: src/hooks/useCameraScanner.js
````javascript
// src/hooks/useCameraScanner.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

const DEV = import.meta.env.DEV;
const devLog = (...args) => { if (DEV) console.log('[Scanner]', ...args); };
const devError = (...args) => { if (DEV) console.error('[Scanner]', ...args); };

function getInsecureContextReason() {
  if (typeof window === 'undefined') return null;
  if (window.isSecureContext) return null;
  return { protocol: window.location.protocol, hostname: window.location.hostname };
}

// Retail barcode formats we actually need, plus our own product QR
// codes. Kept narrow on purpose — fewer formats to check per frame
// means both the native detector and the ZXing fallback decide
// "nothing here yet" faster on every frame that isn't a hit.
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

// High enough resolution to read a barcode clearly, low enough to keep
// every frame cheap to process — and continuous autofocus so the
// camera keeps re-focusing on whatever's held up to it (most phone
// cameras default to a slower focus mode for plain video capture).
// `advanced` constraints are silently ignored by devices/browsers that
// don't support them, so this is safe everywhere.
function buildConstraintAttempts() {
  const base = { width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: 'continuous' }] };
  return [
    { label: 'exact environment', constraints: { video: { ...base, facingMode: { exact: 'environment' } } } },
    { label: 'ideal environment', constraints: { video: { ...base, facingMode: 'environment' } } },
    { label: 'user-facing', constraints: { video: { ...base, facingMode: 'user' } } },
    { label: 'any camera', constraints: { video: true } },
  ];
}

// Native, hardware-accelerated barcode decoding — the same engine behind
// the phone's own camera app / Google Lens. Where it's available and
// working well (mainly Chrome/Edge/Samsung Internet on Android) this is
// dramatically faster than software decoding. Not available at all on
// Safari/iOS, and quality can vary by Android device, which is why ZXing
// stays in place as the fallback below rather than being replaced.
let nativeFormatsPromise = null;
function getNativeSupportedFormats() {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return Promise.resolve(null);
  if (!nativeFormatsPromise) {
    nativeFormatsPromise = window.BarcodeDetector.getSupportedFormats()
      .then((supported) => {
        const usable = BARCODE_FORMATS.filter((f) => supported.includes(f));
        return usable.length > 0 ? usable : null;
      })
      .catch(() => null);
  }
  return nativeFormatsPromise;
}

export function useCameraScanner({ onDetected, active }) {
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const detectorLoopRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stopNativeLoop = useCallback(() => {
    const loop = detectorLoopRef.current;
    if (!loop) return;
    loop.cancelled = true;
    const video = videoRef.current;
    if (loop.frameHandle != null) {
      if (video?.cancelVideoFrameCallback) video.cancelVideoFrameCallback(loop.frameHandle);
      else cancelAnimationFrame(loop.frameHandle);
    }
    detectorLoopRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopNativeLoop();

    try { controlsRef.current?.stop(); } catch (err) { devError('controls.stop() failed', err); }
    controlsRef.current = null;

    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch (err) { devError('manual track stop failed', err); }
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;

    setTorchOn(false);
    setTorchSupported(false);
  }, [stopNativeLoop]);

  useEffect(() => {
    if (!active) { stop(); setStatus('idle'); return; }

    let cancelled = false;
    setStatus('starting');

    const insecure = getInsecureContextReason();
    if (insecure) {
      devError('Insecure context — navigator.mediaDevices is unavailable.', insecure);
      setStatus('insecure');
      return () => { cancelled = true; stop(); };
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      devError('navigator.mediaDevices.getUserMedia is not available in this browser.');
      setStatus('unavailable');
      return () => { cancelled = true; stop(); };
    }

    (async () => {
      const nativeFormats = await getNativeSupportedFormats();
      if (cancelled) return;
      devLog(nativeFormats ? `Using native BarcodeDetector (${nativeFormats.join(', ')})` : 'Native BarcodeDetector unavailable — using ZXing fallback');

      if (nativeFormats) {
        // ── FAST PATH ──────────────────────────────────────────────
        const attempts = buildConstraintAttempts();
        let stream = null;
        let usedLabel = null;
        let lastError = null;

        for (const attempt of attempts) {
          if (cancelled) return;
          try {
            // eslint-disable-next-line no-await-in-loop
            stream = await navigator.mediaDevices.getUserMedia(attempt.constraints);
            usedLabel = attempt.label;
            break;
          } catch (err) {
            lastError = err;
            devError(`[native] constraints [${attempt.label}] failed:`, err?.name, err?.message);
            if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError') break;
          }
        }

        if (cancelled) { stream?.getTracks().forEach((t) => t.stop()); return; }

        if (!stream) {
          devError('[native] all camera constraint attempts failed:', lastError?.name, lastError?.message);
          const name = lastError?.name;
          setStatus(name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
          return;
        }

        const video = videoRef.current;
        if (!video) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        video.srcObject = stream;
        try { await video.play(); } catch { /* muted video autoplay quirk on some browsers — safe to ignore */ }

        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.();
        setTorchSupported(!!capabilities?.torch);
        devLog(`[native] camera started using [${usedLabel}] — track:`, track?.label, 'capabilities:', capabilities);

        const detector = new window.BarcodeDetector({ formats: nativeFormats });
        const loop = { cancelled: false, frameHandle: null };
        detectorLoopRef.current = loop;
        let busy = false;

        const scanFrame = async () => {
          if (loop.cancelled) return;
          if (!busy && video.readyState >= 2) {
            busy = true;
            try {
              const results = await detector.detect(video);
              if (results.length > 0 && !loop.cancelled) {
                onDetected(results[0].rawValue);
                busy = false;
                return; // caller flips `active` off once a code is found
              }
            } catch (err) {
              devError('[native] detect() failed', err);
            }
            busy = false;
          }
          if (loop.cancelled) return;
          loop.frameHandle = video.requestVideoFrameCallback
            ? video.requestVideoFrameCallback(scanFrame)
            : requestAnimationFrame(scanFrame);
        };

        loop.frameHandle = video.requestVideoFrameCallback
          ? video.requestVideoFrameCallback(scanFrame)
          : requestAnimationFrame(scanFrame);
        setStatus('scanning');
        return;
      }

      // ── FALLBACK PATH (same proven ZXing flow, just better camera constraints) ──
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const attempts = buildConstraintAttempts();
      let lastError = null;

      for (const attempt of attempts) {
        if (cancelled) return;
        devLog(`[zxing] trying constraints [${attempt.label}]:`, attempt.constraints);
        try {
          // eslint-disable-next-line no-await-in-loop
          const controls = await reader.decodeFromConstraints(
            attempt.constraints,
            videoRef.current,
            (result, err) => {
              if (cancelled) return;
              if (result) { onDetected(result.getText()); return; }
              if (DEV && err && err.name !== 'NotFoundException') devError('[zxing] decode callback error:', err.name, err.message);
            }
          );

          if (cancelled) {
            try { controls.stop(); } catch (err) { devError('post-cancel controls.stop() failed', err); }
            return;
          }

          controlsRef.current = controls;
          setStatus('scanning');
          streamRef.current = videoRef.current?.srcObject || null;
          const track = streamRef.current?.getVideoTracks?.()[0];
          const capabilities = track?.getCapabilities?.();
          setTorchSupported(!!capabilities?.torch);
          devLog(`[zxing] camera started using [${attempt.label}] — track:`, track?.label, 'capabilities:', capabilities);
          return;
        } catch (err) {
          lastError = err;
          devError(`[zxing] constraints [${attempt.label}] failed:`, err?.name, err?.message);
          if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError') break;
        }
      }

      if (cancelled) return;
      devError('[zxing] all camera constraint attempts failed. Last error:', lastError?.name, lastError?.message);
      const name = lastError?.name;
      setStatus(
        name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
          ? 'denied'
          : 'unavailable'
      );
    })();

    return () => { cancelled = true; stop(); };
  }, [active, onDetected, stop, retryToken]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || !torchSupported) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (err) {
      devError('toggleTorch failed', err);
    }
  }, [torchOn, torchSupported]);

  return { videoRef, status, torchOn, torchSupported, toggleTorch, retry };
}
````

## File: src/pages/CloseDay.jsx
````javascript
// HP-7 FIX: chunk deletions to avoid 500-op batch limit; replace window.location.reload() with React state
import { useMemo, useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDailySession } from '../hooks/useDailySession';
import { useFinancialsForRange } from '../hooks/useFinancials';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner';
import { formatKES } from '../utils/currency';
import { startOfDay, endOfDay } from '../utils/dateRanges';
import { computeExpectedTillBalances } from '../utils/financials';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function CloseDay() {
  const { profile } = useAuth();
  const { session, loading:sessLoad, sessionId, isClosed, reopenSession } = useDailySession();
  const today = useMemo(() => ({ start:startOfDay(), end:endOfDay() }), []);
const { loading:finLoad, error:finErr, summary, purchases, supplierPayments } = useFinancialsForRange(today.start, today.end);

const cashPurchases   = purchases.filter(p => p.paymentStatus === 'paid' && p.paymentMethod === 'Cash').reduce((s,p)=>s+(p.totalCost||0),0);
const mpesaPurchases  = purchases.filter(p => p.paymentStatus === 'paid' && p.paymentMethod === 'M-Pesa').reduce((s,p)=>s+(p.totalCost||0),0);
const cashSupplierPay = supplierPayments.filter(p=>p.method==='Cash').reduce((s,p)=>s+(p.amount||0),0);
const mpesaSupplierPay= supplierPayments.filter(p=>p.method==='M-Pesa').reduce((s,p)=>s+(p.amount||0),0);  const [cash,      setCash]      = useState('');
  const [mpesa,     setMpesa]     = useState('');
  const [submitting,setSubmit]    = useState(false);

  if (sessLoad || finLoad) return <LoadingSpinner />;
  if (!session) return <EmptyState title="No session open today" description="The counter hasn't been opened yet today." />;

  const { expectedCashAtClose, expectedMpesaAtClose } = computeExpectedTillBalances({
    openingCashFloat:         session.openingCashFloat,
    openingMpesaFloat:        session.openingMpesaFloat,
    totalCashSales:           summary.totalCashSales,
    totalMpesaSales:          summary.totalMpesaSales,
    totalDebtRepaymentsCash:  summary.totalDebtRepaymentsCash,
    totalDebtRepaymentsMpesa: summary.totalDebtRepaymentsMpesa,
    totalExpensesCash:        summary.totalExpensesCash,
    totalExpensesMpesa:       summary.totalExpensesMpesa,
    totalCashOutflows:        summary.totalCashOutflows,
    totalMpesaOutflows:       summary.totalMpesaOutflows,
  });

  const cashVar  = (Number(cash) ||0) - expectedCashAtClose;
  const mpesaVar = (Number(mpesa)||0) - expectedMpesaAtClose;

  const handleClose = async () => {
    setSubmit(true);
try {
      const write = updateDoc(doc(db,'dailySessions',sessionId), {
        totalCashSales: summary.totalCashSales,
        totalMpesaSales: summary.totalMpesaSales,
        totalCreditSales: summary.totalCreditSales,
        totalDebtRepaymentsCash: summary.totalDebtRepaymentsCash,
        totalDebtRepaymentsMpesa: summary.totalDebtRepaymentsMpesa,
        totalExpensesCash: summary.totalExpensesCash,
        totalExpensesMpesa: summary.totalExpensesMpesa,
        totalRefundsCash: summary.totalRefundsCash,
        totalRefundsMpesa: summary.totalRefundsMpesa,
        expectedCashAtClose, actualCashAtClose:Number(cash)||0,
        expectedMpesaAtClose, actualMpesaAtClose:Number(mpesa)||0,
        cashVariance:cashVar, mpesaVariance:mpesaVar,
        closedAt:serverTimestamp(), closedBy:profile.uid,
      });
      const { queuedOffline, error } = await raceWithTimeout(write, 4000);
      if (error) throw error;
      toast.success(queuedOffline ? "Day closed offline. It'll sync later!" : 'Day closed. See you tomorrow!');
    } catch(err) { toast.error(friendlyErrorMessage(err)); } finally { setSubmit(false); }
  };

  if (isClosed) return (
    <div className="mx-auto max-w-2xl space-y-4">
      <EmptyState title="Today's session is closed" description="Counting resumes when the counter opens tomorrow." />
      <div className="card divide-y divide-ink-100">
        <SRow label="Expected cash"   value={expectedCashAtClose} />
        <SRow label="Actual cash"     value={session.actualCashAtClose||0} />
        <SRow label="Cash variance"   value={(session.actualCashAtClose||0)-expectedCashAtClose} variance />
        <SRow label="Expected M-Pesa" value={expectedMpesaAtClose} />
        <SRow label="Actual M-Pesa"   value={session.actualMpesaAtClose||0} />
        <SRow label="M-Pesa variance" value={(session.actualMpesaAtClose||0)-expectedMpesaAtClose} variance />
      </div>
      <button className="btn-primary w-full" onClick={reopenSession}>Reopen session</button>
    </div>
  );

  if (finErr) return <ErrorBanner message={`Failed to load figures: ${finErr}`} />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Close Day</h1>
      <div className="card divide-y divide-ink-100">
        <div className="px-4 py-3 text-sm font-bold text-ink-800">Cash drawer</div>
        <Row label="Opening float"             value={session.openingCashFloat} />
        <Row label="+ Cash sales"              value={summary.totalCashSales} />
        <Row label="+ Debt repayments (cash)"  value={summary.totalDebtRepaymentsCash} />
        <Row label="− Expenses (cash)"         value={-summary.totalExpensesCash} />
        <Row label="− Refunds (cash)"          value={-summary.totalRefundsCash} />
        <Row label="− Purchases paid (cash)" value={-cashPurchases} />
        <Row label="− Supplier debt payments (cash)" value={-cashSupplierPay} />
        <Row label="= Expected cash"           value={expectedCashAtClose} bold />
      </div>
      <div className="card p-4 space-y-2">
        <label className="label">Actual cash counted (KES)</label>
        <input type="number" className="input" value={cash} onChange={e=>setCash(e.target.value)} placeholder="0" />
        {cash!==''&&<Variance v={cashVar} />}
      </div>
      <div className="card divide-y divide-ink-100">
        <div className="px-4 py-3 text-sm font-bold text-ink-800">M-Pesa till</div>
        <Row label="Opening balance"             value={session.openingMpesaFloat} />
        <Row label="+ M-Pesa sales"              value={summary.totalMpesaSales} />
        <Row label="+ Debt repayments (M-Pesa)"  value={summary.totalDebtRepaymentsMpesa} />
        <Row label="− Expenses (M-Pesa)"         value={-summary.totalExpensesMpesa} />
        <Row label="− Refunds (M-Pesa)"          value={-summary.totalRefundsMpesa} />
        <Row label="− Purchases paid (M-Pesa)" value={-mpesaPurchases} />
        <Row label="− Supplier debt payments (M-Pesa)" value={-mpesaSupplierPay} />
        <Row label="= Expected M-Pesa"           value={expectedMpesaAtClose} bold />
      </div>
      <div className="card p-4 space-y-2">
        <label className="label">Actual M-Pesa balance (KES)</label>
        <input type="number" className="input" value={mpesa} onChange={e=>setMpesa(e.target.value)} placeholder="0" />
        {mpesa!==''&&<Variance v={mpesaVar} />}
      </div>
      <button className="btn-primary w-full" disabled={cash===''||mpesa===''||submitting} onClick={handleClose}>{submitting?'Closing…':'Confirm and close day'}</button>
    </div>
  );
}

function Row({ label, value, bold }) {
  return <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${bold?'bg-ink-50/60':''}`}><span className={bold?'font-bold text-ink-900':'text-ink-500'}>{label}</span><span className={bold?'font-bold text-ink-900':'text-ink-700'}>{formatKES(value)}</span></div>;
}
function SRow({ label, value, variance }) {
  const tone = variance ? (value===0?'text-moss-700':value<0?'text-rust-600':'text-amber-600') : 'text-ink-700';
  return <div className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="text-ink-500">{label}</span><span className={`font-semibold ${tone}`}>{formatKES(value)}</span></div>;
}
function Variance({ v }) {
  const tone = v===0?'text-moss-700':v<0?'text-rust-600':'text-amber-600';
  return <p className={`text-sm font-semibold ${tone}`}>{v===0?'✓ Matches exactly':v<0?`Shortage of ${formatKES(Math.abs(v))}`:`Surplus of ${formatKES(v)}`}</p>;
}
````

## File: src/pages/Customers.jsx
````javascript
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus, MessageCircle, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useSettings } from '../hooks/useSettings';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import AddCustomerModal from '../components/customers/AddCustomerModal';
import { createCustomer, updateCustomer } from '../utils/customers';
import { formatKES } from '../utils/currency';
import { formatDate } from '../utils/dateRanges';
import { openWhatsApp, buildDebtReminderMessage, isValidWhatsAppPhone } from '../utils/whatsapp';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Customers() {
  const { businessId, isPro } = useAuth();
  const { settings } = useSettings();

  const customersQ = useMemo(() => businessId ? tenantQuery('customers', businessId) : null, [businessId]);
  const creditQ = useMemo(() => businessId ? tenantQuery('creditSales', businessId) : null, [businessId]);

  const { data: customers, loading: custLoading } = useFirestoreCollection(customersQ);
  const { data: creditSales, loading: credLoading } = useFirestoreCollection(creditQ);
  
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const customerList = useMemo(() => {
    const map = {};
    for (const c of customers) {
      map[c.id] = { customerId: c.id, name: c.name, phone: c.phone, totalOwed: 0, purchaseCount: 0, lastPurchase: null, raw: c };
    }
    for (const cs of creditSales) {
      if (!cs.customerId) continue;
      if (!map[cs.customerId]) {
        map[cs.customerId] = { customerId: cs.customerId, name: cs.customerName, phone: cs.customerPhone, totalOwed: 0, purchaseCount: 0, lastPurchase: null, raw: null };
      }
      const e = map[cs.customerId];
      if (cs.status === 'pending' || cs.status === 'partial') {
        e.totalOwed += Number(cs.remainingBalance) || 0;
      }
      e.purchaseCount++;
      if (!e.lastPurchase || (cs.soldAt?.toMillis?.() ?? 0) > (e.lastPurchase?.toMillis?.() ?? 0)) {
        e.lastPurchase = cs.soldAt;
      }
    }
    return Object.values(map)
      .filter(d => d.name?.toLowerCase().includes(search.toLowerCase()) || d.phone?.includes(search))
      .sort((a, b) => b.totalOwed - a.totalOwed);
  }, [customers, creditSales, search]);

  const loading = custLoading || credLoading;
  const totalOut = customerList.reduce((acc, d) => acc + d.totalOwed, 0);

  const handleSaveCustomer = async ({ name, phone }) => {
    try {
      if (editingCustomer) {
        const { queuedOffline } = await updateCustomer(editingCustomer.customerId, { name, phone }, businessId);
        toast.success(queuedOffline ? "Updated offline — it'll sync later." : 'Customer updated successfully.');
      } else {
        const { queuedOffline } = await createCustomer({ name, phone }, businessId);
        toast.success(queuedOffline ? "Saved offline — it'll sync later." : 'Customer saved successfully.');
      }
      setModalOpen(false);
      setEditingCustomer(null);
    } catch (error) {
      toast.error(friendlyErrorMessage(error, { fallback: 'Unable to save customer. Please try again.' }));
    }
  };

  const handleSendReminder = (d) => {
    if (!isPro) {
      toast.error('WhatsApp sharing is available on FlowBiz Pro.');
      return;
    }
    if (!d.phone || !isValidWhatsAppPhone(d.phone)) {
      toast.error('Add a valid phone number for this customer before sending a WhatsApp reminder.');
      return;
    }
    const message = buildDebtReminderMessage({
      shopName: settings.shopName || 'FlowBiz Store',
      customerName: d.name,
      outstandingAmount: d.totalOwed,
      businessPhone: settings.phone,
      formatKES,
    });
    const opened = openWhatsApp(d.phone, message);
    toast[opened ? 'success' : 'error'](opened ? 'WhatsApp opened.' : 'WhatsApp could not be opened.');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Customers</h1>
          <p className="text-sm text-ink-400">Total outstanding debt: <span className="font-semibold text-rust-600">{formatKES(totalOut)}</span></p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingCustomer(null); setModalOpen(true); }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 shadow-sm hover:bg-ink-50 active:bg-ink-100"
          title="Add customer"
        >
          <UserPlus className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
      <input className="input" placeholder="Search customer…" value={search} onChange={e => setSearch(e.target.value)} />
      {loading ? <LoadingSpinner /> : customerList.length === 0 ? (
        <EmptyState title="No customers found" description="Add a customer, or they'll appear here after a credit sale." />
      ) : (
        <div className="space-y-2">
          {customerList.map(d => (
            <div key={d.customerId} className="card flex flex-col p-4 hover:shadow-md gap-2">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/customers/${d.customerId}`} className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-800 truncate">{d.name}</p>
                  <p className="text-xs text-ink-400">{d.phone || 'No phone'} · {d.purchaseCount} purchase{d.purchaseCount !== 1 ? 's' : ''} {d.lastPurchase ? `· last ${formatDate(d.lastPurchase)}` : ''}</p>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  <Link to={`/customers/${d.customerId}`} className={`font-display text-base font-bold ${d.totalOwed > 0 ? 'text-rust-600' : 'text-moss-700'}`}>
                    {d.totalOwed > 0 ? formatKES(d.totalOwed) : (d.purchaseCount > 0 ? 'Paid' : 'No history')}
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditingCustomer(d);
                      setModalOpen(true);
                    }}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
                    title="Edit customer details"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
              {d.totalOwed > 0 && (
                 <div className="flex justify-end border-t border-ink-100 pt-2 mt-1">
                    <button
                      type="button"
                      onClick={() => handleSendReminder(d)}
                      className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50"
                      title={isPro ? 'Send reminder via WhatsApp' : 'FlowBiz Pro feature'}
                    >
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Send reminder{!isPro && <span className="text-amber-600"> · PRO</span>}
                    </button>
                 </div>
              )}
            </div>
          ))}
        </div>
      )}
      <AddCustomerModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingCustomer(null); }}
        onSave={handleSaveCustomer}
        initialData={editingCustomer ? { name: editingCustomer.name, phone: editingCustomer.phone } : null}
        existingCustomers={customerList.map(d => ({ name: d.name, phone: d.phone }))}
      />
    </div>
  );
}
````

## File: src/pages/ForgotPassword.jsx
````javascript
import { useState } from 'react';
import { Link } from 'react-router-dom';
const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

const handleSubmit = async (e) => {
  e.preventDefault();
  setError(null);
  setSubmitting(true);
  try {
    const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/send-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    if (!response.ok) throw new Error('request-failed');
    setSent(true);
  } catch (err) {
    console.error('[FlowBiz] send-password-reset failed:', err.message);
    setError("Couldn't send the reset email. Please try again in a moment.");
  } finally {
    setSubmitting(false);
  }
};

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Reset your password</h1>
            <p className="text-sm text-ink-400">Enter your account email and we'll send you a reset link.</p>
          </div>
        </div>

        {sent ? (
          <div className="card p-6 text-center space-y-3">
            <div className="text-3xl">📧</div>
            <p className="text-sm text-ink-600">If an account exists for <span className="font-semibold">{email.trim()}</span>, a password reset link is on its way. Check your inbox (and spam folder).</p>
            <Link to="/login" className="btn-primary w-full">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4 p-6">
            {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
            <div>
              <label className="label">Email</label>
              <input type="email" required className="input" placeholder="owner@yourbusiness.co.ke" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" autoFocus />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</button>
          </form>
        )}

        <p className="text-center text-sm text-ink-400">
          Remembered it? <Link to="/login" className="font-semibold text-moss-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
````

## File: src/pages/InventoryIntelligence.jsx
````javascript
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { formatKES } from '../utils/currency';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MiniBarChart from '../components/charts/MiniBarChart';
import DonutChart from '../components/charts/DonutChart';
import {
  Lock, ArrowLeft, AlertCircle, CheckCircle2, Info, PackageOpen,
  Package, Tag, Truck, ClipboardCheck, AlertTriangle,
} from 'lucide-react';

const LOOKBACK_DAYS = 30;

function KpiCard({ label, value, tone = 'text-ink-900', bg = 'bg-white' }) {
  return (
    <div className={`card p-4 sm:p-5 ${bg} hover:shadow-md transition-shadow`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`mt-2 font-display text-xl sm:text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}

function Section({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="card p-5 sm:p-6 bg-white">
      <div className="mb-5 flex items-center gap-3 border-b border-ink-100 pb-4">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl2 bg-moss-50 text-moss-700">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
        )}
        <div>
          <h2 className="font-display text-sm font-bold text-ink-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function NoData({ children }) {
  return <div className="py-8 flex flex-col items-center justify-center text-center"><PackageOpen className="h-6 w-6 text-ink-300 mb-2" strokeWidth={1.5} /><p className="text-sm text-ink-500">{children}</p></div>;
}

export default function InventoryIntelligence() {
  const { isPro, businessId } = useAuth();

  const productsQ = useMemo(
    () => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null),
    [businessId]
  );
  const { data: products, loading } = useFirestoreCollection(productsQ);

  const suppliersQ = useMemo(() => (businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null), [businessId]);
  const { data: suppliers } = useFirestoreCollection(suppliersQ);

  // Same query shape (businessId + soldAt range + orderBy soldAt) already
  // used by useFinancials.js elsewhere in the app, so it reuses the same
  // Firestore composite index — no new index required.
  const thirtyDaysAgo = useMemo(() => new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000), []);
  const recentSalesQ = useMemo(
    () => (businessId ? tenantQuery('sales', businessId, where('soldAt', '>=', thirtyDaysAgo), orderBy('soldAt', 'desc')) : null),
    [businessId, thirtyDaysAgo]
  );
  const recentCreditSalesQ = useMemo(
    () => (businessId ? tenantQuery('creditSales', businessId, where('soldAt', '>=', thirtyDaysAgo), orderBy('soldAt', 'desc')) : null),
    [businessId, thirtyDaysAgo]
  );
  const { data: recentSales } = useFirestoreCollection(recentSalesQ);
  const { data: recentCreditSales } = useFirestoreCollection(recentCreditSalesQ);

  const metrics = useMemo(() => {
    let totalCost = 0;
    let totalRetail = 0;
    let unitsInStock = 0;
    const overstocked = [];
    const outOfStock = [];
    const lowStock = [];

    (products || []).forEach((p) => {
      const stock = Number(p.stock) || 0;
      const cost = Number(p.costPrice) || 0;
      const retail = Number(p.sellingPrice) || 0;
      const threshold = Number(p.lowStockThreshold) || 5;

      if (stock > 0) {
        totalCost += stock * cost;
        totalRetail += stock * retail;
        unitsInStock += stock;
      }

      if (stock <= 0) {
        outOfStock.push(p);
      } else if (stock > threshold * 4) {
        overstocked.push({ ...p, value: stock * cost });
      } else if (stock <= threshold) {
        lowStock.push(p);
      }
    });

    overstocked.sort((a, b) => b.value - a.value);
    const healthyCount = (products || []).length - outOfStock.length - overstocked.length - lowStock.length;

    return { totalCost, totalRetail, unitsInStock, overstocked, outOfStock, lowStock, healthyCount };
  }, [products]);

  // FIX (multi-product cart): a Counter.jsx cart sale can carry several
  // products on one sale/creditSale doc via `items`. Crediting the whole
  // doc's aggregate quantity/value to a single s.productId would badly
  // skew per-product velocity (ABC classification, reorder priority,
  // slow-moving detection) — each line item is now credited to its own
  // productId when `items` is present; legacy single-product docs (no
  // `items` field) are read exactly as before.
  const velocityData = useMemo(() => {
    const units = {};
    const value = {};
    const addLine = (productId, qty, amount) => {
      if (!productId) return;
      units[productId] = (units[productId] || 0) + qty;
      value[productId] = (value[productId] || 0) + amount;
    };
    (recentSales || []).forEach((s) => {
      if (s.isVoided) return;
      if (Array.isArray(s.items) && s.items.length > 0) {
        s.items.forEach((it) => addLine(it.productId, Number(it.quantity) || 0, Number(it.lineTotal ?? ((it.quantity || 0) * (it.unitPrice || 0))) || 0));
      } else {
        addLine(s.productId, Number(s.quantity) || 0, Number(s.totalAmount) || 0);
      }
    });
    (recentCreditSales || []).forEach((cs) => {
      if (cs.status === 'cancelled' || cs.status === 'refunded') return;
      if (Array.isArray(cs.items) && cs.items.length > 0) {
        cs.items.forEach((it) => addLine(it.productId, Number(it.quantity) || 0, Number(it.lineTotal ?? ((it.quantity || 0) * (it.unitPrice || 0))) || 0));
      } else {
        addLine(cs.productId, Number(cs.quantity) || 0, Number(cs.totalAmount) || 0);
      }
    });
    return { units, value };
  }, [recentSales, recentCreditSales]);

  const productInsights = useMemo(() => {
    const supplierNameById = {};
    (suppliers || []).forEach((s) => { supplierNameById[s.id] = s.name; });

    return (products || [])
      .filter((p) => (Number(p.stock) || 0) > 0)
      .map((p) => {
        const unitsSold = velocityData.units[p.id] || 0;
        const valueMoved = velocityData.value[p.id] || 0;
        const velocityPerDay = unitsSold / LOOKBACK_DAYS;
        const daysOfStock = velocityPerDay > 0 ? (Number(p.stock) || 0) / velocityPerDay : null;
        return {
          id: p.id,
          name: p.name,
          stock: Number(p.stock) || 0,
          costPrice: Number(p.costPrice) || 0,
          threshold: Number(p.lowStockThreshold) || 5,
          supplierName: supplierNameById[p.supplierId] || null,
          unitsSold,
          valueMoved,
          velocityPerDay,
          daysOfStock,
        };
      });
  }, [products, suppliers, velocityData]);

  // ABC / Pareto classification — "A" products drive roughly the first
  // 80% of sales value, "B" the next 15%, "C" the long tail.
  const abcClassification = useMemo(() => {
    const moving = [...productInsights].filter((p) => p.valueMoved > 0).sort((a, b) => b.valueMoved - a.valueMoved);
    const totalValue = moving.reduce((sum, p) => sum + p.valueMoved, 0);
    let cumulative = 0;
    const tiered = moving.map((p) => {
      cumulative += p.valueMoved;
      const cumulativePct = totalValue > 0 ? (cumulative / totalValue) * 100 : 0;
      const tier = cumulativePct <= 80 ? 'A' : cumulativePct <= 95 ? 'B' : 'C';
      return { ...p, tier };
    });
    const counts = tiered.reduce((acc, p) => { acc[p.tier] = (acc[p.tier] || 0) + 1; return acc; }, { A: 0, B: 0, C: 0 });
    return { tiered, counts };
  }, [productInsights]);

  const slowMoving = useMemo(
    () => productInsights.filter((p) => p.unitsSold === 0).sort((a, b) => (b.stock * b.costPrice) - (a.stock * a.costPrice)).slice(0, 8),
    [productInsights]
  );

  const reorderPriority = useMemo(
    () => productInsights
      .filter((p) => p.velocityPerDay > 0 && p.stock <= p.threshold * 2)
      .sort((a, b) => (a.daysOfStock ?? Infinity) - (b.daysOfStock ?? Infinity))
      .slice(0, 6)
      .map((p) => ({ ...p, suggestedQty: Math.max(1, Math.ceil(p.velocityPerDay * 14)) })),
    [productInsights]
  );

  const capitalBySupplier = useMemo(() => {
    const map = {};
    (products || []).forEach((p) => {
      if ((Number(p.stock) || 0) <= 0) return;
      const key = p.supplierId || 'unassigned';
      const name = key === 'unassigned' ? 'No supplier assigned' : (suppliers.find((s) => s.id === key)?.name || 'Unknown supplier');
      if (!map[key]) map[key] = { name, value: 0 };
      map[key].value += (Number(p.stock) || 0) * (Number(p.costPrice) || 0);
    });
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [products, suppliers]);

  const avgDaysOfStock = useMemo(() => {
    const withVelocity = productInsights.filter((p) => p.daysOfStock !== null && Number.isFinite(p.daysOfStock));
    if (!withVelocity.length) return null;
    return withVelocity.reduce((sum, p) => sum + p.daysOfStock, 0) / withVelocity.length;
  }, [productInsights]);

  // Deduped by product ID so a product that's both overstocked AND
  // slow-moving is only counted once — otherwise "at risk" capital would
  // be double-counted and the health % would understate itself.
  const capitalHealth = useMemo(() => {
    const seen = new Set();
    let atRiskValue = 0;
    const addRisk = (id, value) => {
      if (seen.has(id)) return;
      seen.add(id);
      atRiskValue += value;
    };
    metrics.overstocked.forEach((p) => addRisk(p.id, p.value));
    slowMoving.forEach((p) => addRisk(p.id, p.stock * p.costPrice));
    const healthyValue = Math.max(0, metrics.totalCost - atRiskValue);
    const pct = metrics.totalCost > 0 ? (healthyValue / metrics.totalCost) * 100 : 100;
    return { healthyValue, atRiskValue, pct: Math.max(0, Math.min(100, pct)) };
  }, [metrics, slowMoving]);

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="h-16 w-16 bg-ink-100 text-ink-500 rounded-full flex items-center justify-center mb-5">
          <Lock className="h-7 w-7" strokeWidth={2} />
        </div>
        <h2 className="font-display text-2xl font-bold text-ink-900">Inventory Intelligence Locked</h2>
        <p className="mt-3 text-sm text-ink-500 leading-relaxed">Instantly uncover dead stock holding up capital and detect urgent re-order limits before stockouts hit. Requires FlowBiz Pro.</p>
        <Link to="/pro" className="mt-8 btn-primary w-full">Unlock Pro Features</Link>
      </div>
    );
  }

  if (loading) return <div className="py-12"><LoadingSpinner /></div>;

  const potentialProfit = metrics.totalRetail - metrics.totalCost;
  const activeProductsCount = (products || []).length;
  const totalOverstockValue = metrics.overstocked.reduce((sum, p) => sum + p.value, 0);

  const insights = [];
  if (metrics.lowStock.length > 0) {
    insights.push({ tone: 'negative', text: `CRITICAL: ${metrics.lowStock.length} product(s) operating below safe threshold. Restock immediately.` });
  }
  if (metrics.outOfStock.length > 0) {
    insights.push({ tone: 'negative', text: `REVENUE LOSS: ${metrics.outOfStock.length} product(s) completely depleted. You are actively losing sales.` });
  }
  if (metrics.overstocked[0]) {
    insights.push({ tone: 'neutral', text: `CAPITAL TRAP: "${metrics.overstocked[0].name}" alone locks up ${formatKES(metrics.overstocked[0].value)} in inventory.` });
  }
  if (slowMoving.length > 0) {
    const slowValue = slowMoving.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
    insights.push({ tone: 'neutral', text: `SLOW-MOVING: ${slowMoving.length} product(s) with no sales in ${LOOKBACK_DAYS} days are holding ${formatKES(slowValue)} in capital.` });
  }
  if (reorderPriority.length > 0) {
    insights.push({ tone: 'negative', text: `REORDER NEEDED: ${reorderPriority.length} fast-moving product(s) are running low and should be restocked soon.` });
  }
  if (insights.length === 0 && activeProductsCount > 0) {
    insights.push({ tone: 'positive', text: 'OPTIMAL: Supply distribution perfectly matches current threshold configurations.' });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 tracking-tight">Inventory Intelligence</h1>
          <p className="text-sm text-ink-500 mt-1">Capital deployment and supply chain health.</p>
        </div>
        <Link to="/products" className="btn-outline text-xs bg-white">
          <ArrowLeft className="h-4 w-4 mr-1.5" strokeWidth={2} /> Back to Products
        </Link>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Capital &amp; stock</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Capital Deployed" value={formatKES(metrics.totalCost)} />
          <KpiCard label="Projected Gross Profit" value={formatKES(potentialProfit)} tone="text-moss-700" />
          <KpiCard label="Physical Units" value={metrics.unitsInStock.toLocaleString()} />
          <KpiCard label="Active SKUs" value={activeProductsCount.toLocaleString()} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Risk &amp; velocity</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Low Stock Risk" value={metrics.lowStock.length} tone={metrics.lowStock.length > 0 ? 'text-rust-600' : 'text-ink-900'} bg={metrics.lowStock.length > 0 ? 'bg-rust-50' : 'bg-white'} />
          <KpiCard label="Stockout Status" value={metrics.outOfStock.length} tone={metrics.outOfStock.length > 0 ? 'text-rust-600' : 'text-ink-900'} bg={metrics.outOfStock.length > 0 ? 'bg-rust-50' : 'bg-white'} />
          <KpiCard label="Overstocked SKUs" value={metrics.overstocked.length} tone="text-amber-600" />
          <KpiCard label="Capital Trapped" value={formatKES(totalOverstockValue)} tone="text-amber-600" />
          <KpiCard label="Avg Days of Stock" value={avgDaysOfStock != null ? `${avgDaysOfStock.toFixed(0)} days` : '—'} />
        </div>
      </div>

      <div className="card p-5 sm:p-6 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-sm font-bold text-ink-900">Capital Health</h2>
            <p className="mt-0.5 text-xs text-ink-500">Share of inventory capital that's healthy vs. tied up in overstock or slow movers</p>
          </div>
          <span className={`font-display text-2xl font-bold ${capitalHealth.pct >= 80 ? 'text-moss-700' : capitalHealth.pct >= 60 ? 'text-amber-600' : 'text-rust-600'}`}>{capitalHealth.pct.toFixed(0)}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-rust-100">
          <div className="h-full rounded-full bg-moss-600 transition-all" style={{ width: `${capitalHealth.pct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-ink-400">
          <span>Healthy: {formatKES(capitalHealth.healthyValue)}</span>
          <span>At risk: {formatKES(capitalHealth.atRiskValue)}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Global Supply Distribution" subtitle="System-wide inventory health check" icon={Package}>
          {activeProductsCount > 0 ? (
            <div className="pt-2">
              <DonutChart
                size={180}
                formatValue={(v) => `${v} SKU${v === 1 ? '' : 's'}`}
                segments={[
                  { label: 'Optimal Inventory', value: metrics.healthyCount, colorClassName: 'text-moss-600', dotClassName: 'bg-moss-600' },
                  { label: 'Low Stock Risk', value: metrics.lowStock.length, colorClassName: 'text-amber-500', dotClassName: 'bg-amber-500' },
                  { label: 'Critical Stockout', value: metrics.outOfStock.length, colorClassName: 'text-rust-600', dotClassName: 'bg-rust-600' },
                  { label: 'Capital Surplus (Overstock)', value: metrics.overstocked.length, colorClassName: 'text-ink-800', dotClassName: 'bg-ink-800' },
                ]}
              />
            </div>
          ) : (
            <NoData>System requires active inventory definitions.</NoData>
          )}
        </Section>

        <Section title="Overstock Concentration" subtitle="Items holding maximum illiquid capital" icon={AlertTriangle}>
          {metrics.overstocked.length > 0 ? (
            <div className="pt-2">
              <MiniBarChart
                orientation="horizontal"
                formatValue={formatKES}
                data={metrics.overstocked.slice(0, 6).map((p) => ({ label: p.name, value: p.value, colorClassName: 'bg-ink-800' }))}
              />
            </div>
          ) : (
            <NoData>No significant capital concentration found.</NoData>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Value Analysis (ABC)" subtitle="Which products drive most of your sales value" icon={Tag}>
          {abcClassification.tiered.length > 0 ? (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-moss-50 p-3">
                  <p className="font-display text-lg font-bold text-moss-700">{abcClassification.counts.A}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-moss-600">A — Top value</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="font-display text-lg font-bold text-amber-700">{abcClassification.counts.B}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">B — Moderate</p>
                </div>
                <div className="rounded-lg bg-ink-50 p-3">
                  <p className="font-display text-lg font-bold text-ink-700">{abcClassification.counts.C}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">C — Long tail</p>
                </div>
              </div>
              <div className="divide-y divide-ink-100">
                {abcClassification.tiered.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`badge shrink-0 ${p.tier === 'A' ? 'bg-moss-100 text-moss-700' : p.tier === 'B' ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-500'}`}>{p.tier}</span>
                      <span className="truncate font-medium text-ink-800">{p.name}</span>
                    </div>
                    <span className="shrink-0 font-semibold text-ink-700">{formatKES(p.valueMoved)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-ink-400">Based on sales value over the last {LOOKBACK_DAYS} days. "A" products drive roughly 80% of your sales value — protect their stock levels first.</p>
            </>
          ) : (
            <NoData>Not enough recent sales to classify products yet.</NoData>
          )}
        </Section>

        <Section title="Capital by Supplier" subtitle="Current inventory value tied to each supplier" icon={Truck}>
          {capitalBySupplier.length > 0 ? (
            <MiniBarChart orientation="horizontal" formatValue={formatKES} data={capitalBySupplier.map((s) => ({ label: s.name, value: s.value, colorClassName: 'bg-blue-600' }))} />
          ) : (
            <NoData>No supplier-linked stock found.</NoData>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Reorder Priority" subtitle="Fast-moving items running low — suggested 2-week restock quantity" icon={ClipboardCheck}>
          {reorderPriority.length > 0 ? (
            <div className="divide-y divide-ink-100">
              {reorderPriority.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{p.name}</p>
                    <p className="text-[11px] text-ink-400">{p.supplierName || 'No supplier assigned'} &middot; {p.daysOfStock != null ? `${p.daysOfStock.toFixed(0)} days of stock left` : 'Stock estimate unavailable'}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-rust-50 px-2.5 py-1 text-xs font-bold text-rust-700">+{p.suggestedQty} units</span>
                </div>
              ))}
            </div>
          ) : (
            <NoData>Nothing urgently needs restocking right now.</NoData>
          )}
        </Section>

        <Section title="Slow-Moving Stock" subtitle={`In stock, but no sales in the last ${LOOKBACK_DAYS} days`} icon={PackageOpen}>
          {slowMoving.length > 0 ? (
            <div className="divide-y divide-ink-100">
              {slowMoving.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{p.name}</p>
                    <p className="text-[11px] text-ink-400">{p.stock} units on the shelf</p>
                  </div>
                  <span className="shrink-0 font-semibold text-amber-700">{formatKES(p.stock * p.costPrice)}</span>
                </div>
              ))}
            </div>
          ) : (
            <NoData>Everything in stock has moved in the last {LOOKBACK_DAYS} days.</NoData>
          )}
        </Section>
      </div>

      <Section title="Automated Intelligence Briefing" subtitle="System-generated supply chain alerts" icon={Info}>
        <div className="space-y-4 pt-1">
          {insights.map((insight, i) => (
            <div key={i} className={`flex items-start gap-3 text-sm p-4 rounded-lg border ${insight.tone === 'positive' ? 'bg-moss-50 border-moss-200' : insight.tone === 'negative' ? 'bg-rust-50 border-rust-200' : 'bg-ink-50 border-ink-200'}`}>
              <div className="shrink-0 mt-0.5">
                {insight.tone === 'positive' ? <CheckCircle2 className="h-5 w-5 text-moss-600" strokeWidth={2} /> :
                 insight.tone === 'negative' ? <AlertCircle className="h-5 w-5 text-rust-600" strokeWidth={2} /> :
                 <Info className="h-5 w-5 text-ink-600" strokeWidth={2} />}
              </div>
              <span className={`font-medium leading-relaxed ${insight.tone === 'positive' ? 'text-moss-800' : insight.tone === 'negative' ? 'text-rust-800' : 'text-ink-800'}`}>{insight.text}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
````

## File: src/utils/financials.js
````javascript
// src/utils/financials.js
function sumBy(rows, field) {
  return rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
}

function getCostOfSale(row) {
  if (row && typeof row.costOfGoodsSold === 'number' && Number.isFinite(row.costOfGoodsSold)) {
    return row.costOfGoodsSold;
  }
  const costPerUnit = Number(row?.costPricePerUnit) || 0;
  const quantity = Number(row?.quantity) || 0;
  return costPerUnit * quantity;
}

export function isExpenseExcluded(expense) {
  const category = String(expense?.category || '').toLowerCase();
  const description = String(expense?.description || '').toLowerCase();
  return (
    category === 'stock purchase' ||
    category === 'supplier payment' ||
    description.includes('stock purchase') ||
    description.includes('supplier payment')
  );
}

function isCreditSaleReversed(creditSale) {
  return creditSale?.status === 'cancelled' || creditSale?.status === 'refunded';
}

function recognizeRepayment(repayment, creditSaleById) {
  const amount = Number(repayment?.amount) || 0;
  const creditSale = creditSaleById.get(repayment?.creditSaleId);
  if (!creditSale) {
    return { revenue: amount, cogs: 0 };
  }
  const totalAmount = Number(creditSale.totalAmount) || 0;
  const totalCost = getCostOfSale(creditSale);
  const ratio = totalAmount > 0 ? amount / totalAmount : 0;
  const cogs = totalCost * ratio;
  return { revenue: amount, cogs };
}

function recognizeRefund(refund, creditSaleById) {
  const amount = Number(refund?.amount) || 0;
  const creditSale = creditSaleById.get(refund?.creditSaleId);
  if (!creditSale) {
    return { revenue: amount, cogs: 0 };
  }
  const totalAmount = Number(creditSale.totalAmount) || 0;
  const totalCost = getCostOfSale(creditSale);
  const ratio = totalAmount > 0 ? amount / totalAmount : 0;
  const cogs = totalCost * ratio;
  return { revenue: amount, cogs };
}

export function computeFinancials({
  sales = [],
  creditSales = [],
  allCreditSales = null,
  expenses = [],
  debtRepayments = [],
  purchases = [],
  supplierPayments = [],
  refunds = [],
} = {}) {
  const activeSales = (sales || []).filter((sale) => !sale?.isVoided);
  const activeCreditSales = (creditSales || []).filter((cs) => !isCreditSaleReversed(cs));

  const cashSales  = activeSales.filter(s => s.paymentMethod === 'Cash');
  const mpesaSales = activeSales.filter(s => s.paymentMethod === 'M-Pesa');
  const totalCashSales  = sumBy(cashSales,  'totalAmount');
  const totalMpesaSales = sumBy(mpesaSales, 'totalAmount');

  const totalCreditSales = sumBy(activeCreditSales, 'totalAmount');

  const cashRepayments  = debtRepayments.filter(r => r.method === 'Cash');
  const mpesaRepayments = debtRepayments.filter(r => r.method === 'M-Pesa');
  const totalDebtRepaymentsCash  = sumBy(cashRepayments,  'amount');
  const totalDebtRepaymentsMpesa = sumBy(mpesaRepayments, 'amount');
  const totalDebtRepayments = totalDebtRepaymentsCash + totalDebtRepaymentsMpesa;

  const cashRefunds  = (refunds || []).filter(r => r.method === 'Cash');
  const mpesaRefunds = (refunds || []).filter(r => r.method === 'M-Pesa');
  const totalRefundsCash  = sumBy(cashRefunds,  'amount');
  const totalRefundsMpesa = sumBy(mpesaRefunds, 'amount');
  const totalRefunds = totalRefundsCash + totalRefundsMpesa;

  const creditSaleSource = allCreditSales || creditSales || [];
  const creditSaleById = new Map(creditSaleSource.map((cs) => [cs.id, cs]));

  let repaymentRevenue = 0;
  let repaymentCogs = 0;
  (debtRepayments || []).forEach((r) => {
    const { revenue, cogs } = recognizeRepayment(r, creditSaleById);
    repaymentRevenue += revenue;
    repaymentCogs += cogs;
  });

  let refundRevenue = 0;
  let refundCogs = 0;
  (refunds || []).forEach((ref) => {
    const { revenue, cogs } = recognizeRefund(ref, creditSaleById);
    refundRevenue += revenue;
    refundCogs += cogs;
  });

  const directSalesCostOfGoodsSold = activeSales.reduce((acc, s) => acc + getCostOfSale(s), 0);
  const costOfGoodsSold = directSalesCostOfGoodsSold + repaymentCogs - refundCogs;

  const grossSalesRevenue = totalCashSales + totalMpesaSales + totalCreditSales;
  const revenue = totalCashSales + totalMpesaSales + repaymentRevenue - refundRevenue;
  const grossProfit = revenue - costOfGoodsSold;

  const filteredExpenses = (expenses || []).filter((expense) => !isExpenseExcluded(expense));
  const cashExpenses  = filteredExpenses.filter(e => e.paymentMethod === 'Cash');
  const mpesaExpenses = filteredExpenses.filter(e => e.paymentMethod === 'M-Pesa');
  const totalExpensesCash  = sumBy(cashExpenses,  'amount');
  const totalExpensesMpesa = sumBy(mpesaExpenses, 'amount');
  const totalExpenses = totalExpensesCash + totalExpensesMpesa;
  const netProfit     = grossProfit - totalExpenses;

  // Realized net receipts by tender method
  const totalCashReceipts  = totalCashSales  + totalDebtRepaymentsCash  - totalRefundsCash;
  const totalMpesaReceipts = totalMpesaSales + totalDebtRepaymentsMpesa - totalRefundsMpesa;

  const purchasePaymentsCash  = (purchases || []).filter((p) => p.paymentStatus === 'paid' && p.paymentMethod === 'Cash');
  const purchasePaymentsMpesa = (purchases || []).filter((p) => p.paymentStatus === 'paid' && p.paymentMethod === 'M-Pesa');
  const supplierPaymentsCash  = (supplierPayments || []).filter((p) => p.method === 'Cash');
  const supplierPaymentsMpesa = (supplierPayments || []).filter((p) => p.method === 'M-Pesa');

  const totalCashOutflows  = sumBy(purchasePaymentsCash,  'totalCost') + sumBy(supplierPaymentsCash,  'amount') + totalRefundsCash;
  const totalMpesaOutflows = sumBy(purchasePaymentsMpesa, 'totalCost') + sumBy(supplierPaymentsMpesa, 'amount') + totalRefundsMpesa;

  return {
    grossSalesRevenue, totalCashSales, totalMpesaSales, totalCreditSales,
    revenue, costOfGoodsSold, grossProfit,
    totalCashReceipts, totalMpesaReceipts,
    totalDebtRepaymentsCash, totalDebtRepaymentsMpesa, totalDebtRepayments,
    totalExpensesCash, totalExpensesMpesa, totalExpenses, netProfit,
    totalRefundsCash, totalRefundsMpesa, totalRefunds,
    totalCashOutflows, totalMpesaOutflows,
  };
}

export function computeExpectedTillBalances({
  openingCashFloat = 0, openingMpesaFloat = 0,
  totalCashSales = 0, totalMpesaSales = 0,
  totalDebtRepaymentsCash = 0, totalDebtRepaymentsMpesa = 0,
  totalExpensesCash = 0, totalExpensesMpesa = 0,
  totalCashOutflows = 0, totalMpesaOutflows = 0,
}) {
  return {
    expectedCashAtClose:  Number(openingCashFloat)  + totalCashSales  + totalDebtRepaymentsCash  - totalExpensesCash - totalCashOutflows,
    expectedMpesaAtClose: Number(openingMpesaFloat) + totalMpesaSales + totalDebtRepaymentsMpesa - totalExpensesMpesa - totalMpesaOutflows,
  };
}

export function computeSupplierBalances(purchases = [], supplierPayments = [], suppliers = []) {
  const balanceById = {};

  (purchases || []).forEach((p) => {
    if (p?.paymentStatus !== 'pending_supplier_credit' || !p?.supplierId) return;
    balanceById[p.supplierId] = (balanceById[p.supplierId] || 0) + (Number(p.totalCost) || 0);
  });

  (supplierPayments || []).forEach((sp) => {
    if (!sp?.supplierId || balanceById[sp.supplierId] === undefined) return;
    balanceById[sp.supplierId] -= Number(sp.amount) || 0;
  });

  const nameById = {};
  (suppliers || []).forEach((s) => { nameById[s.id] = s.name; });

  return Object.entries(balanceById)
    .filter(([, balance]) => (Number(balance) || 0) > 0.005)
    .map(([supplierId, balance]) => ({
      supplierId,
      supplierName:
        nameById[supplierId] ||
        (purchases || []).find((p) => p.supplierId === supplierId)?.supplierName ||
        'Unknown supplier',
      balance,
    }))
    .sort((a, b) => b.balance - a.balance);
}
````

## File: src/utils/financials.test.js
````javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFinancials, computeExpectedTillBalances, computeSupplierBalances } from './financials.js';

test('1. Cash Sale creates immediate revenue, COGS, gross profit, and cash receipts', () => {
  const sale = {
    id: 's1',
    totalAmount: 1500,
    costPricePerUnit: 1000,
    quantity: 1,
    paymentMethod: 'Cash',
    isVoided: false,
  };
  const summary = computeFinancials({ sales: [sale] });

  assert.equal(summary.revenue, 1500);
  assert.equal(summary.costOfGoodsSold, 1000);
  assert.equal(summary.grossProfit, 500);
  assert.equal(summary.totalCashReceipts, 1500);
  assert.equal(summary.totalMpesaReceipts, 0);
});

test('2. Unpaid Credit Sale contributes zero revenue, COGS, and profit', () => {
  const creditSale = {
    id: 'c1',
    costPricePerUnit: 2000,
    quantity: 1,
    totalAmount: 3000,
    status: 'pending',
    amountPaid: 0,
  };
  const summary = computeFinancials({
    creditSales: [creditSale],
    allCreditSales: [creditSale],
  });

  assert.equal(summary.totalCreditSales, 3000);
  assert.equal(summary.revenue, 0);
  assert.equal(summary.costOfGoodsSold, 0);
  assert.equal(summary.grossProfit, 0);
  assert.equal(summary.netProfit, 0);
});

test('3. Partial Debt Repayment recognizes proportional revenue and COGS', () => {
  const creditSale = {
    id: 'c1',
    costPricePerUnit: 2000,
    quantity: 1,
    totalAmount: 3000,
    status: 'partial',
    amountPaid: 1000,
  };
  const summary = computeFinancials({
    creditSales: [creditSale],
    allCreditSales: [creditSale],
    debtRepayments: [{ id: 'r1', creditSaleId: 'c1', amount: 1000, method: 'Cash' }],
  });

  assert.equal(summary.revenue, 1000);
  assert.equal(Math.round(summary.costOfGoodsSold * 100) / 100, 666.67);
  assert.equal(Math.round(summary.grossProfit * 100) / 100, 333.33);
  assert.equal(summary.totalCashReceipts, 1000);
});

test('4. Full Debt Repayment recognizes full revenue and COGS', () => {
  const creditSale = {
    id: 'c1',
    costPricePerUnit: 2000,
    quantity: 1,
    totalAmount: 3000,
    status: 'paid',
    amountPaid: 3000,
  };
  const summary = computeFinancials({
    allCreditSales: [creditSale],
    debtRepayments: [
      { id: 'r1', creditSaleId: 'c1', amount: 1000, method: 'Cash' },
      { id: 'r2', creditSaleId: 'c1', amount: 2000, method: 'M-Pesa' },
    ],
  });

  assert.equal(summary.revenue, 3000);
  assert.equal(summary.costOfGoodsSold, 2000);
  assert.equal(summary.grossProfit, 1000);
  assert.equal(summary.totalCashReceipts, 1000);
  assert.equal(summary.totalMpesaReceipts, 2000);
});

test('5. Net Refund Exceeding Sales correctly produces negative net revenue and profit without zero-clamping', () => {
  const creditSale = {
    id: 'c1',
    costPricePerUnit: 3000,
    quantity: 1,
    totalAmount: 5000,
    status: 'refunded',
  };
  const summary = computeFinancials({
    sales: [{ totalAmount: 1000, costPricePerUnit: 600, quantity: 1, paymentMethod: 'Cash', isVoided: false }],
    allCreditSales: [creditSale],
    refunds: [{ id: 'ref1', creditSaleId: 'c1', amount: 5000, method: 'Cash' }],
  });

  assert.equal(summary.revenue, -4000);
  assert.equal(summary.costOfGoodsSold, -2400);
  assert.equal(summary.grossProfit, -1600);
  assert.equal(summary.totalCashReceipts, -4000);
});

test('6. Expected Till Balances maintain exact cash and M-Pesa float reconciliation', () => {
  const balances = computeExpectedTillBalances({
    openingCashFloat: 2000,
    openingMpesaFloat: 5000,
    totalCashSales: 4500,
    totalMpesaSales: 8000,
    totalDebtRepaymentsCash: 1500,
    totalDebtRepaymentsMpesa: 2000,
    totalExpensesCash: 800,
    totalExpensesMpesa: 500,
    totalCashOutflows: 1200, // stock purchases + supplier payments + refunds
    totalMpesaOutflows: 0,
  });

  // Expected Cash: 2000 + 4500 + 1500 - 800 - 1200 = 6000
  assert.equal(balances.expectedCashAtClose, 6000);
  // Expected M-Pesa: 5000 + 8000 + 2000 - 500 - 0 = 14500
  assert.equal(balances.expectedMpesaAtClose, 14500);
});

test('7. Supplier balance aggregation correctly matches purchases and payments', () => {
  const purchases = [
    { supplierId: 's1', totalCost: 10000, paymentStatus: 'pending_supplier_credit' },
    { supplierId: 's1', totalCost: 5000, paymentStatus: 'pending_supplier_credit' },
    { supplierId: 's2', totalCost: 8000, paymentStatus: 'paid' },
  ];
  const payments = [
    { supplierId: 's1', amount: 6000 },
  ];
  const suppliers = [
    { id: 's1', name: 'Wholesaler Alpha' },
    { id: 's2', name: 'Wholesaler Beta' },
  ];

  const balances = computeSupplierBalances(purchases, payments, suppliers);
  assert.equal(balances.length, 1);
  assert.equal(balances[0].supplierId, 's1');
  assert.equal(balances[0].balance, 9000);
});

test('8. Multi-item cart sale uses costOfGoodsSold aggregate properly', () => {
  const multiSale = {
    id: 's_multi',
    totalAmount: 2250,
    costOfGoodsSold: 1320,
    profit: 930,
    quantity: 6,
    paymentMethod: 'Cash',
    isVoided: false,
    items: [
      { productId: 'p1', productName: 'Book', quantity: 3, unitPrice: 500, costPrice: 300, lineTotal: 1500, lineCost: 900 },
      { productId: 'p2', productName: 'Storybook', quantity: 2, unitPrice: 350, costPrice: 200, lineTotal: 700, lineCost: 400 },
      { productId: 'p3', productName: 'Pen', quantity: 1, unitPrice: 50, costPrice: 20, lineTotal: 50, lineCost: 20 },
    ]
  };
  const summary = computeFinancials({ sales: [multiSale] });
  assert.equal(summary.revenue, 2250);
  assert.equal(summary.costOfGoodsSold, 1320);
  assert.equal(summary.grossProfit, 930);
});

test('9. Voided sales are excluded from active calculations', () => {
  const voidedSale = {
    id: 's_void',
    totalAmount: 5000,
    costPricePerUnit: 3000,
    quantity: 1,
    paymentMethod: 'Cash',
    isVoided: true,
  };
  const validSale = {
    id: 's_valid',
    totalAmount: 2000,
    costPricePerUnit: 1200,
    quantity: 1,
    paymentMethod: 'Cash',
    isVoided: false,
  };
  const summary = computeFinancials({ sales: [voidedSale, validSale] });
  assert.equal(summary.revenue, 2000);
  assert.equal(summary.costOfGoodsSold, 1200);
  assert.equal(summary.grossProfit, 800);
  assert.equal(summary.totalCashReceipts, 2000);
});

test('10. Expenses exclude supplier payments and stock purchases to prevent double-counting', () => {
  const expenses = [
    { id: 'e1', category: 'Rent', amount: 15000, paymentMethod: 'Cash' },
    { id: 'e2', category: 'Electricity', amount: 2500, paymentMethod: 'M-Pesa' },
    { id: 'e3', category: 'Supplier Payment', description: 'Supplier payment to Alpha', amount: 6000, paymentMethod: 'Cash' },
    { id: 'e4', category: 'Other', description: 'Stock Purchase direct', amount: 4000, paymentMethod: 'Cash' },
  ];
  const summary = computeFinancials({ expenses });
  assert.equal(summary.totalExpenses, 17500);
  assert.equal(summary.totalExpensesCash, 15000);
  assert.equal(summary.totalExpensesMpesa, 2500);
});
````

## File: cloudflare-worker/src/routes/paystackInitialize.js
````javascript
// src/routes/paystackInitialize.js
//
// POST /api/paystack/initialize
//
// Starts a Paystack transaction for the FlowBiz Pro plan. The price is
// fixed SERVER-SIDE — the browser never gets to say what the amount is.
// Records a pending payment doc first, so the webhook always has
// something authoritative to check the eventual callback against.

import { json, errorResponse } from '../lib/response.js';
import { verifyFirebaseIdToken } from '../lib/firebaseIdToken.js';
import { getDocument, createDocument } from '../lib/firestore.js';

export const PRO_PLAN_AMOUNT_KES = 599; 
export async function handlePaystackInitialize(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return errorResponse('Missing Authorization header.', 401);

  let caller;
  try {
    caller = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return errorResponse(`Invalid session: ${err.message}`, 401);
  }

  const callerProfile = await getDocument(env, 'users', caller.uid);
  if (!callerProfile) return errorResponse('Profile not found.', 403);
  if (callerProfile.role !== 'owner') return errorResponse('Only an owner can manage the subscription.', 403);
  if (callerProfile.active === false) return errorResponse('Your account is deactivated.', 403);
  if (!callerProfile.businessId) return errorResponse('No business associated with this account.', 400);

  const email = callerProfile.email || caller.email;
  if (!email) return errorResponse('No email on file for this account.', 400);

  const reference = `flowbiz_${callerProfile.businessId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const amountKobo = PRO_PLAN_AMOUNT_KES * 100;

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      currency: 'KES',
      reference,
      callback_url: env.PAYSTACK_CALLBACK_URL || undefined,
      metadata: { businessId: callerProfile.businessId, plan: 'pro' },
    }),
  });

  const paystackData = await paystackRes.json();
  if (!paystackRes.ok || !paystackData.status) {
    return errorResponse(paystackData.message || 'Could not start payment with Paystack.', 502);
  }

  // Recorded BEFORE handing the reference back to the browser — the
  // webhook checks the eventual payment against this, not the other way
  // around, so nothing the frontend says here needs to be trusted later.
  await createDocument(env, 'payments', reference, {
    businessId: callerProfile.businessId,
    plan: 'pro',
    amountKes: PRO_PLAN_AMOUNT_KES,
    status: 'pending',
    createdAt: new Date(),
    initializedBy: caller.uid,
  });

return json({ authorization_url: paystackData.data.authorization_url, access_code: paystackData.data.access_code, reference });}
````

## File: cloudflare-worker/src/index.js
````javascript
// src/index.js — the Worker's entry point / router.
//
// Deliberately a plain switch on pathname + method, no router library:
// a dependency here is a dependency every one of FlowBiz's privileged
// operations (and now the public document route) trusts.
//
// FIX: removed the /api/whatsapp/send route (routes/whatsappSend.js).
// Auditing it found it called the real Meta WhatsApp Cloud API — nothing
// in the frontend has ever called this endpoint (WhatsApp sharing has
// always gone through the client-side wa.me deep-link utility instead),
// so it was dead code, and its Cloud-API approach directly contradicts
// FlowBiz's "deep links only, no WhatsApp API" product requirement. See
// routes/whatsappSend.js.removed for the file that was deleted, and the
// project notes for the WHATSAPP_ACCESS_TOKEN secret this leaves unused.

import { corsHeaders, handleOptions } from './lib/cors.js';
import { errorResponse } from './lib/response.js';
import { handleDeleteStaff } from './routes/deleteStaff.js';
import { handlePaystackInitialize } from './routes/paystackInitialize.js';
import { handlePaystackWebhook } from './routes/paystackWebhook.js';
import { handlePublicDocument } from './routes/publicDocument.js';
import { handleProPrice } from './routes/proPrice.js';
import { handleSendVerificationEmail } from './routes/sendVerificationEmail.js';
import { handleSendPasswordReset } from './routes/sendPasswordResetEmail.js';
import { handleDeleteOwnProfile } from './routes/deleteOwnProfile.js';
function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Paystack calls the webhook directly (server-to-server) — it never
    // needs, and should never get, FlowBiz's browser CORS headers.
    if (url.pathname === '/api/paystack/webhook' && request.method === 'POST') {
      try {
        return await handlePaystackWebhook(request, env);
      } catch (err) {
        console.error('Webhook error:', err);
        return errorResponse('Internal server error.', 500);
      }
    }

    // Public receipt/invoice/debt-payment-receipt links (/r/<token>) are
    // opened directly by a customer's browser — a full-page navigation,
    // not a fetch() from the FlowBiz frontend — so it deliberately does
    // NOT go through verifyFirebaseIdToken like every other route below.
    // See routes/publicDocument.js for the token → document security
    // model. Handled up front, same as the webhook, since it returns
    // HTML rather than the JSON shape the block below assumes.
    if (url.pathname.startsWith('/r/') && request.method === 'GET') {
      const token = url.pathname.slice('/r/'.length);
      try {
        return await handlePublicDocument(request, env, token);
      } catch (err) {
        console.error('Public document error:', err);
        return errorResponse('Internal server error.', 500);
      }
    }

    const allowedOrigins = getAllowedOrigins(env);
    if (request.method === 'OPTIONS') return handleOptions(request, allowedOrigins);

    const origin = request.headers.get('Origin') || '';
    const extraHeaders = corsHeaders(origin, allowedOrigins);

    let response;
    try {
// cloudflare-worker/src/index.js
      if (url.pathname === '/api/auth/delete-staff' && request.method === 'POST') {
        response = await handleDeleteStaff(request, env);
      } else if (url.pathname === '/api/auth/send-verification-email' && request.method === 'POST') {
        response = await handleSendVerificationEmail(request, env);
      } else if (url.pathname === '/api/auth/send-password-reset' && request.method === 'POST') {
        response = await handleSendPasswordReset(request, env);
      } else if (url.pathname === '/api/paystack/initialize' && request.method === 'POST') {
        response = await handlePaystackInitialize(request, env);
      } else if (url.pathname === '/api/pro/price' && request.method === 'GET') {
        response = await handleProPrice();
              } else if (url.pathname === '/api/auth/delete-own-profile' && request.method === 'POST') {
        response = await handleDeleteOwnProfile(request, env);
      } else {
        response = errorResponse('Not found.', 404);
      }
    } catch (err) {
      console.error('Unhandled error:', err);
      response = errorResponse('Internal server error.', 500);
    }

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  },
};
````

## File: src/components/common/ProtectedRoute.jsx
````javascript
import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoMode } from '../../demo/demoMode';
import LoadingSpinner from './LoadingSpinner';
import { Ban, AlertCircle, RefreshCw, Store } from 'lucide-react';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const {
    firebaseUser, profile, loading, authError, accountRemoved, sessionRevoked,
    isAdmin, isActive, emailVerified, logout, reloadProfile, resendVerificationEmail,
    refreshEmailVerification,
  } = useAuth();
  const demo = isDemoMode();

  useEffect(() => {
    if (authError) console.error('ProtectedRoute captured authError:', authError);
  }, [authError]);

  useEffect(() => {
    if (demo || !firebaseUser || emailVerified) return;

    const handleFocus = () => { refreshEmailVerification(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshEmailVerification();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    const pollId = setInterval(() => {
      if (document.visibilityState === 'visible') refreshEmailVerification();
    }, 5000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(pollId);
    };
  }, [demo, firebaseUser, emailVerified, refreshEmailVerification]);

  const [checkingVerification, setCheckingVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);
  
  if (loading) return <LoadingSpinner label="Checking your session…" />;

  if (sessionRevoked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <h2 className="font-display text-lg font-bold text-ink-900">This device was signed out</h2>
          <p className="text-sm text-ink-500">An owner revoked access for this device from Settings → Device Management.</p>
          <button className="btn-primary w-full" onClick={() => (window.location.href = '/login')}>Go to sign in</button>
        </div>
      </div>
    );
  }

  if (!firebaseUser) return <Navigate to="/login" replace />;

  if (!profile) {
    if (accountRemoved) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-sand p-6">
          <div className="card max-w-sm w-full p-6 text-center space-y-4">
            <Store className="h-12 w-12 mx-auto text-moss-600" strokeWidth={1.5} />
            <h2 className="font-display text-lg font-bold text-ink-900">Business Setup Required</h2>
            <p className="text-sm text-ink-500">
              You are signed in as <span className="font-semibold text-ink-700">{firebaseUser.email}</span>, but your business workspace is not configured yet.
            </p>
            <div className="flex flex-col gap-2">
              <Link to="/setup" className="btn-primary w-full">Set Up Business Now</Link>
              <button className="btn-outline w-full" onClick={async () => { await logout(); window.location.href = '/login'; }}>Sign out</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-md w-full p-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-500" strokeWidth={1.5} />
          <h2 className="font-display text-lg font-bold text-ink-900">Loading Account Profile</h2>
          <p className="text-sm text-ink-500">
            Connecting to your business workspace. If this takes more than a few moments, click below.
          </p>
          <div className="flex flex-col gap-2">
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={reloadProfile}>
              <RefreshCw className="h-4 w-4" /> Reload Profile
            </button>
            <Link to="/setup" className="btn-outline w-full">Set Up / Reconfigure Business</Link>
            <button className="text-xs text-ink-400 hover:underline pt-1" onClick={async () => { await logout(); window.location.href = '/login'; }}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm p-6 text-center space-y-3">
          <Ban className="h-10 w-10 mx-auto text-rust-500" strokeWidth={1.5} />
          <h2 className="font-display text-lg font-bold text-ink-900">Account deactivated</h2>
          <p className="text-sm text-ink-500">Contact your business owner to regain access.</p>
          <button className="btn-outline w-full" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  if (!demo && !emailVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Verify your email</h2>
          <p className="text-sm text-ink-500">
            We sent a verification link to <span className="font-semibold text-ink-800">{firebaseUser.email}</span>. Please check your inbox (and spam/junk folder) and click the link to activate your account.
          </p>
          <div className="flex flex-col gap-2">
            <button
              className="btn-primary w-full"
              disabled={checkingVerification}
              onClick={async () => {
                setCheckingVerification(true);
                try {
                  const verified = await refreshEmailVerification();
                  if (!verified) toast.error("Not verified yet — check your inbox and click the link, then try again.");
                  else toast.success("Email verified! Welcome.");
                } finally {
                  setCheckingVerification(false);
                }
              }}
            >
              {checkingVerification ? 'Checking…' : "I've verified — check now"}
            </button>
            <button
              className="btn-outline w-full"
              disabled={resending || resendCooldown > 0}
              onClick={async () => {
                setResending(true);
                try {
                  await resendVerificationEmail();
                  toast.success('Verification email sent — check your inbox.');
                  setResendCooldown(60);
                } catch (err) {
                  console.error('[FlowBiz] resendVerificationEmail error:', err.message);
                  toast.error(
                    err.code === 'auth/too-many-requests'
                      ? 'Too many attempts. Please wait a minute before requesting another email.'
                      : "Couldn't send the verification email. Please try again shortly."
                  );
                  setResendCooldown(60);
                } finally {
                  setResending(false);
                }
              }}
            >
              {resending ? 'Sending…' : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend verification email'}
            </button>
            <button className="text-xs text-ink-400 hover:underline" onClick={logout}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  if (adminOnly && !isAdmin) return <Navigate to="/counter" replace />;
  return children;
}
````

## File: src/components/layout/Sidebar.jsx
````javascript
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as Lucide from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const C = Lucide[name] || Lucide.Circle;
  return <C className={className} strokeWidth={1.75} />;
};

// `collapsed` and `onToggleCollapse` are optional — any existing caller
// that renders <Sidebar /> with no props keeps behaving exactly as
// before (always expanded, no toggle button rendered).
export default function Sidebar({ collapsed = false, onToggleCollapse }) {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const items = NAV_ITEMS
    .filter((item) => !item.adminOnly || isAdmin)
    .filter((item) => item.to !== '/expenses' || isAdmin || settings.cashierCanRecordExpenses);

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-ink-100 bg-white transition-[width] duration-200 lg:flex ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                collapsed ? 'justify-center px-0' : 'px-3'
              } ${isActive ? 'bg-moss-50 text-moss-800' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'}`
            }
          >
            <Icon name={item.icon} />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      {onToggleCollapse && (
        <div className="border-t border-ink-100 p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`flex w-full items-center gap-2 rounded-lg py-2 text-xs font-semibold text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700 ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            )}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      )}
    </aside>
  );
}
````

## File: src/components/products/ProductFormModal.jsx
````javascript
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { raceWithTimeout } from '../../utils/offlineWrite';

const empty = {
  name: '',
  category: '',
  costPrice: '',
  sellingPrice: '',
  stock: '',
  lowStockThreshold: '5',
  supplierId: '',
  barcode: '',
  description: '',
};

const DEFAULT_CATEGORIES = [
  'Beverages',
  'Hardware',
  'Household',
  'Personal Care',
  'Stationery',
  'Airtime/Float',
  'Other',
];

const FREE_PLAN_PRODUCT_LIMIT = 100;

export default function ProductFormModal({
  open,
  onClose,
  onSave,
  suppliers = [],
  initialProduct = null,
  prefillBarcode = null,
  prefillSupplierId = null,
  onAddSupplier,
  newSupplierId,
  simplifiedForPurchase = false,
  productCount = 0,
}) {
  const { businessId, isPro } = useAuth();
  const [form, setForm] = useState(empty);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  // Only true if we are editing an existing product that already has a Firestore document ID
  const isEditing = Boolean(initialProduct && initialProduct.id);

  // Load permanent categories from Firestore
  useEffect(() => {
    if (!open || !businessId) return;
    const unsub = onSnapshot(doc(db, 'businessSettings', businessId), (snap) => {
      if (snap.exists() && Array.isArray(snap.data().categories)) {
        const cleaned = snap
          .data()
          .categories.filter((c) => c && c.trim().toLowerCase() !== 'groceries');
        setCategories(cleaned.length > 0 ? cleaned : DEFAULT_CATEGORIES);
      } else {
        setCategories(DEFAULT_CATEGORIES);
        setDoc(
          doc(db, 'businessSettings', businessId),
          { categories: DEFAULT_CATEGORIES },
          { merge: true }
        ).catch(console.error);
      }
    });
    return unsub;
  }, [open, businessId]);

  // Sync form state when modal opens
  useEffect(() => {
    setBusy(false);
    setShowAddCategory(false);
    setNewCategoryName('');
    if (open) {
      if (initialProduct && initialProduct.id) {
        setForm({
          ...empty,
          ...initialProduct,
          category: initialProduct.category || '',
          costPrice: initialProduct.costPrice ?? '',
          sellingPrice: initialProduct.sellingPrice ?? '',
          stock: initialProduct.stock ?? '',
          lowStockThreshold: initialProduct.lowStockThreshold ?? '5',
          supplierId: initialProduct.supplierId || '',
          barcode: initialProduct.barcode || '',
          description: initialProduct.description || '',
        });
      } else {
        setForm({
          ...empty,
          barcode: prefillBarcode || '',
          category: '', // Starts empty with "— Select Category —"
          supplierId: prefillSupplierId || initialProduct?.supplierId || '',
        });
      }
    }
  }, [initialProduct, prefillBarcode, prefillSupplierId, open]);

  useEffect(() => {
    if (newSupplierId) {
      setForm((prev) => ({ ...prev, supplierId: newSupplierId }));
    }
  }, [newSupplierId]);

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed || savingCategory) return;
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Category already exists.');
      return;
    }
    const updated = [...categories, trimmed];
    setSavingCategory(true);
    const write = setDoc(
      doc(db, 'businessSettings', businessId),
      { categories: updated },
      { merge: true }
    );
    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    setSavingCategory(false);
    if (error) {
      toast.error('Failed to add category: ' + error.message);
      return;
    }
    setForm((prev) => ({ ...prev, category: trimmed }));
    setShowAddCategory(false);
    setNewCategoryName('');
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Category added');
  };

  const handle = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || busy) return;
    if (!form.category) {
      toast.error('Please select a category.');
      return;
    }
    if (!simplifiedForPurchase && Number(form.costPrice) < 0) {
      toast.error('Cost price cannot be negative.');
      return;
    }
    if (Number(form.sellingPrice) <= 0) {
      toast.error('Selling price must be greater than zero.');
      return;
    }
    if (!isEditing && !simplifiedForPurchase && Number(form.stock) < 0) {
      toast.error('Stock cannot be negative.');
      return;
    }

    if (!isEditing && !isPro && productCount >= FREE_PLAN_PRODUCT_LIMIT) {
      toast.error(`Free plan is limited to ${FREE_PLAN_PRODUCT_LIMIT} products. Upgrade to FlowBiz Pro to add more.`);
      return;
    }

    const barcodeVal = form.barcode.trim();
    if (barcodeVal && /^FB-\d{6}$/i.test(barcodeVal)) {
      toast.error("That looks like an internal code, not a barcode. Scan or enter the item's manufacturer barcode.");
      return;
    }

    setBusy(true);
    try {
      const costPriceVal = simplifiedForPurchase ? 0 : (Number(form.costPrice) || 0);
      const sellingPriceVal = Number(form.sellingPrice) || 0;
      const stockVal = isEditing
        ? (Number(initialProduct.stock) || 0)
        : (simplifiedForPurchase ? 0 : (Number(form.stock) || 0));
      const thresholdVal = simplifiedForPurchase ? 5 : (Number(form.lowStockThreshold) || 5);

      await onSave({
        name: form.name.trim(),
        category: form.category,
        costPrice: costPriceVal,
        sellingPrice: sellingPriceVal,
        stock: stockVal,
        lowStockThreshold: thresholdVal,
        supplierId: form.supplierId || null,
        barcode: form.barcode.trim() || null,
        description: form.description.trim(),
      });
    } catch {
      // Handled by onSave
    } finally {
      // Guarantees the button is never stuck on "Saving..."
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (!busy) onClose();
  };

  const hasSuppliers = suppliers && suppliers.length > 0;

  return (
    <Modal open={open} onClose={handleClose} title={isEditing ? 'Edit product' : 'Add product'}>
      <form onSubmit={handle} className="space-y-3">
        <div>
          <label className="label">Product name</label>
          <input className="input" value={form.name} onChange={set('name')} disabled={busy} required autoFocus />
        </div>

        {isEditing && initialProduct?.internalCode && (
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
            Internal code: <span className="font-mono font-semibold text-ink-700">{initialProduct.internalCode}</span>
          </div>
        )}

        <div>
          <label className="label">Barcode <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
          <input className="input font-mono" value={form.barcode} onChange={set('barcode')} placeholder="Scan or type manufacturer barcode" disabled={busy} />
          {!isEditing && <p className="mt-1 text-xs text-ink-400">Leave blank if this product doesn't have a barcode.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={set('category')} disabled={busy} required>
              <option value="" disabled>— Select Category —</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {showAddCategory ? (
              <div className="mt-2 space-y-2 rounded-lg bg-ink-50 p-2.5">
                <label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wide">New Category</label>
                <input
                  className="input !py-1 !min-h-0 text-xs"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Accessories"
                  disabled={busy || savingCategory}
                  autoFocus
                />
                <div className="flex gap-1.5 justify-end">
                  <button type="button" className="btn-secondary !py-1 !px-2.5 !min-h-0 text-xs" onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} disabled={busy || savingCategory}>Cancel</button>
                  <button type="button" className="btn-primary !py-1 !px-2.5 !min-h-0 text-xs" onClick={handleAddCategory} disabled={busy || savingCategory}>{savingCategory ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            ) : (
              <button type="button" className="mt-1.5 text-xs font-semibold text-moss-700 hover:underline block" onClick={() => setShowAddCategory(true)} disabled={busy}>+ Add Category</button>
            )}
          </div>

          <div>
            <label className="label">Supplier <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
            <select className="input" value={form.supplierId || ''} onChange={set('supplierId')} disabled={busy}>
              <option value="">{hasSuppliers ? '— Select Supplier —' : '— None (No Suppliers) —'}</option>
              {hasSuppliers && suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {onAddSupplier && (
              <button type="button" className="mt-1.5 text-xs font-semibold text-moss-700 hover:underline block" onClick={onAddSupplier} disabled={busy}>+ Add new supplier</button>
            )}
          </div>
        </div>

        {simplifiedForPurchase ? (
          <div>
            <label className="label">Selling price (KES)</label>
            <input type="number" min="0.01" step="0.01" className="input" value={form.sellingPrice} onChange={set('sellingPrice')} disabled={busy} required />
            <p className="mt-1 text-xs text-ink-400">Stock &amp; buying cost will be recorded in the purchase form.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Buying price (KES)</label>
              <input type="number" min="0" step="0.01" className="input" value={form.costPrice} onChange={set('costPrice')} disabled={busy} required />
            </div>
            <div>
              <label className="label">Selling price (KES)</label>
              <input type="number" min="0.01" step="0.01" className="input" value={form.sellingPrice} onChange={set('sellingPrice')} disabled={busy} required />
            </div>
          </div>
        )}

        {!simplifiedForPurchase && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Stock qty</label>
              <input type="number" min="0" className="input disabled:bg-ink-50 disabled:text-ink-400" value={form.stock} onChange={set('stock')} disabled={isEditing || busy} required={!isEditing} />
              {isEditing && <p className="mt-1 text-[11px] text-ink-400">Stock is managed via Purchases, Sales, or Stock Take.</p>}
            </div>
            <div>
              <label className="label">Low stock alert</label>
              <input type="number" min="0" className="input" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} disabled={busy} />
            </div>
          </div>
        )}

        <div>
          <label className="label">Description <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
          <textarea className="input !min-h-[70px]" rows={2} value={form.description} onChange={set('description')} placeholder="Product details or notes" disabled={busy} />
        </div>

        {Number(form.sellingPrice) > 0 && Number(form.costPrice) > 0 && Number(form.sellingPrice) <= Number(form.costPrice) && (
          <p className="text-xs text-rust-600 font-medium">⚠️ Selling price is at or below cost — you will make no profit on this item.</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {isEditing ? 'Saving...' : 'Adding Product...'}
              </span>
            ) : (isEditing ? 'Save changes' : 'Add product')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
````

## File: src/pages/AdvancedAnalytics.jsx
````javascript
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useFinancialsForRange } from '../hooks/useFinancials';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { tenantQuery } from '../lib/tenant';
import { startOfDay, endOfDay, buildDateBuckets, toMillisValue } from '../utils/dateRanges';
import { formatKES } from '../utils/currency';
import { computeFinancials, isExpenseExcluded } from '../utils/financials';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MiniLineChart from '../components/charts/MiniLineChart';
import MiniBarChart from '../components/charts/MiniBarChart';
import DonutChart from '../components/charts/DonutChart';
import {
  TrendingUp, TrendingDown, Lock, AlertCircle, CheckCircle2, Info, ArrowLeft,
  Banknote, Package, Tag, BarChart3, Receipt, Users, UsersRound, ClipboardCheck,
} from 'lucide-react';

const PERIOD_OPTIONS = [
  { id: '7', label: '7 Days' },
  { id: '30', label: '30 Days' },
  { id: '90', label: '90 Days' },
  { id: 'custom', label: 'Custom' },
];

const CHART_PALETTE = [
  { text: 'text-moss-600', bg: 'bg-moss-600' },
  { text: 'text-blue-600', bg: 'bg-blue-600' },
  { text: 'text-amber-500', bg: 'bg-amber-500' },
  { text: 'text-rust-500', bg: 'bg-rust-500' },
  { text: 'text-ink-800', bg: 'bg-ink-800' },
  { text: 'text-moss-400', bg: 'bg-moss-400' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
function weekdayIndexNairobi(millis) {
  return new Date(millis + NAIROBI_OFFSET_MS).getUTCDay();
}

function KpiCard({ label, value, tone = 'text-ink-900', deltaPct, sparkline, sparklineColor = 'text-moss-600' }) {
  const isPositive = deltaPct !== null && deltaPct !== undefined && deltaPct >= 0;
  return (
    <div className="card p-4 sm:p-5 flex flex-col justify-between bg-white hover:shadow-md transition-shadow">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`mt-2 font-display text-xl sm:text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
      {deltaPct !== null && deltaPct !== undefined && Number.isFinite(deltaPct) && (
        <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${isPositive ? 'text-moss-700' : 'text-rust-600'}`}>
          {isPositive ? <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} /> : <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.5} />}
          <span>{Math.abs(deltaPct).toFixed(1)}% vs prior period</span>
        </div>
      )}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-3 -mb-1">
          <MiniLineChart data={sparkline} height={36} colorClassName={sparklineColor} compact />
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, icon: Icon, className = '', children }) {
  return (
    <div className={`card p-5 sm:p-6 bg-white ${className}`}>
      <div className="mb-5 flex items-center gap-3 border-b border-ink-100 pb-4">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl2 bg-moss-50 text-moss-700">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
        )}
        <div>
          <h2 className="font-display text-sm font-bold text-ink-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function NoData({ children }) {
  return <div className="py-8 flex flex-col items-center justify-center text-center"><Info className="h-6 w-6 text-ink-300 mb-2" strokeWidth={1.5} /><p className="text-sm text-ink-500">{children}</p></div>;
}

// Custom dual-series trend chart (no chart library installed in this
// project — built the same hand-rolled-SVG way MiniLineChart already is,
// just extended to plot two series with a shared scale and a legend).
function DualTrendChart({ data, series, height = 220, ariaLabel }) {
  if (!data || data.length === 0) return null;
  const width = 600;
  const padY = 16;
  const padBottom = 24;
  const plotHeight = height - padY - padBottom;
  const allValues = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
  const max = Math.max(...allValues, 0);
  const min = Math.min(...allValues, 0);
  const range = (max - min) || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const zeroY = padY + plotHeight - ((0 - min) / range) * plotHeight;

  const pointsFor = (key) => data.map((d, i) => {
    const x = data.length > 1 ? i * stepX : width / 2;
    const v = Number(d[key]) || 0;
    const y = padY + plotHeight - ((v - min) / range) * plotHeight;
    return { x, y };
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
            <span className={`h-2 w-2 rounded-full ${s.dotClassName}`} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" role="img" aria-label={ariaLabel || 'Trend chart'}>
        <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="currentColor" className="text-ink-100" strokeWidth="1" />
        {series.map((s) => {
          const points = pointsFor(s.key);
          const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
          const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${zeroY} L ${points[0].x.toFixed(1)} ${zeroY} Z`;
          return (
            <g key={s.key}>
              <path d={areaPath} className={s.colorClassName} fill="currentColor" opacity="0.06" />
              <path d={linePath} className={s.colorClassName} fill="none" stroke="currentColor" strokeWidth="2.25" vectorEffect="non-scaling-stroke" />
              {points.length <= 31 && points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="2.5" className={s.colorClassName} fill="currentColor" />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-400">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}

export default function AdvancedAnalytics() {
  const { isPro, businessId } = useAuth();

  const [period, setPeriod] = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { start, end } = useMemo(() => {
    if (period === 'custom' && customStart && customEnd) {
      return { start: startOfDay(new Date(customStart)), end: endOfDay(new Date(customEnd)) };
    }
    const days = Number(period) || 30;
    return { start: startOfDay(new Date(Date.now() - (days - 1) * 86400000)), end: endOfDay() };
  }, [period, customStart, customEnd]);

  const prevRange = useMemo(() => {
    if (period === 'custom' && customStart && customEnd) {
      const diff = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - diff);
      return { start: startOfDay(prevStart), end: endOfDay(prevEnd) };
    }
    const days = Number(period) || 30;
    const prevEnd = endOfDay(new Date(start.getTime() - 1));
    const prevStart = startOfDay(new Date(start.getTime() - days * 86400000));
    return { start: prevStart, end: prevEnd };
  }, [start, end, period, customStart, customEnd]);

  const { loading, sales, creditSales, expenses, repayments, summary } = useFinancialsForRange(start, end);
  const { loading: prevLoading, summary: prevSummary } = useFinancialsForRange(prevRange.start, prevRange.end);

  const allCreditSalesQ = useMemo(() => (businessId ? tenantQuery('creditSales', businessId) : null), [businessId]);
  const { data: allCreditSales } = useFirestoreCollection(allCreditSalesQ);

  const outstandingCreditQ = useMemo(
    () => (businessId ? tenantQuery('creditSales', businessId, where('status', 'in', ['pending', 'partial'])) : null),
    [businessId]
  );
  const { data: outstandingCreditSales } = useFirestoreCollection(outstandingCreditQ);
  const totalOutstanding = useMemo(
    () => outstandingCreditSales.reduce((acc, cs) => acc + (Number(cs.remainingBalance) || 0), 0),
    [outstandingCreditSales]
  );

  const topDebtors = useMemo(() => {
    const map = {};
    (outstandingCreditSales || []).forEach((cs) => {
      const key = cs.customerId || cs.customerName || 'unknown';
      if (!map[key]) map[key] = { name: cs.customerName || 'Unknown', balance: 0, customerId: cs.customerId };
      map[key].balance += Number(cs.remainingBalance) || 0;
    });
    return Object.values(map).sort((a, b) => b.balance - a.balance).slice(0, 5);
  }, [outstandingCreditSales]);

  const granularity = (end.getTime() - start.getTime()) > (45 * 86400000) ? 'week' : 'day';
  const buckets = useMemo(() => buildDateBuckets(start, end, granularity), [start, end, granularity]);

  const trend = useMemo(() => {
    if (!buckets.length) return [];
    const inBucket = (record, field, bucket) => {
      const t = toMillisValue(record[field]);
      return t !== null && t >= bucket.start.getTime() && t <= bucket.end.getTime();
    };
    return buckets.map((bucket) => {
      const bucketSales = (sales || []).filter((s) => inBucket(s, 'soldAt', bucket));
      const bucketExpenses = (expenses || []).filter((e) => inBucket(e, 'recordedAt', bucket));
      const bucketRepayments = (repayments || []).filter((r) => inBucket(r, 'paidAt', bucket));
      const f = computeFinancials({
        sales: bucketSales,
        creditSales: [],
        allCreditSales,
        expenses: bucketExpenses,
        debtRepayments: bucketRepayments,
      });
      return {
        label: bucket.label,
        revenue: f.revenue,
        netProfit: f.netProfit,
        grossProfit: f.grossProfit,
        expenses: f.totalExpenses,
        margin: f.revenue > 0 ? (f.grossProfit / f.revenue) * 100 : 0,
      };
    });
  }, [buckets, sales, expenses, repayments, allCreditSales]);

  // FIX (multi-product cart): a Counter.jsx cart sale can carry several
  // products on one sale/creditSale doc via `items`. Crediting the whole
  // doc's aggregate qty/revenue/profit to its (summary) productName would
  // badly skew Volume/Margin Drivers — each line item is now credited to
  // its own product when `items` is present; legacy single-product docs
  // (no `items` field) are read exactly as before.
  const productPerf = useMemo(() => {
    const map = {};
    const ensure = (name) => {
      if (!map[name]) map[name] = { name, qty: 0, revenue: 0, profit: 0 };
      return map[name];
    };
    (sales || []).forEach((s) => {
      if (s.isVoided) return;
      if (Array.isArray(s.items) && s.items.length > 0) {
        s.items.forEach((it) => {
          const row = ensure(it.productName);
          row.qty += Number(it.quantity) || 0;
          row.revenue += Number(it.lineTotal ?? ((it.quantity || 0) * (it.unitPrice || 0))) || 0;
          row.profit += Number(it.lineProfit ?? (((it.unitPrice || 0) - (it.costPrice || 0)) * (it.quantity || 0))) || 0;
        });
      } else {
        const row = ensure(s.productName);
        row.qty += Number(s.quantity) || 0;
        row.revenue += Number(s.totalAmount) || 0;
        row.profit += Number(s.profit) || 0;
      }
    });
    (creditSales || []).forEach((cs) => {
      if (cs.status === 'cancelled' || cs.status === 'refunded') return;
      if (Array.isArray(cs.items) && cs.items.length > 0) {
        cs.items.forEach((it) => {
          const row = ensure(it.productName);
          row.qty += Number(it.quantity) || 0;
        });
      } else {
        const row = ensure(cs.productName);
        row.qty += Number(cs.quantity) || 0;
      }
    });
    return Object.values(map);
  }, [sales, creditSales]);

  const bestSelling = useMemo(() => [...productPerf].sort((a, b) => b.qty - a.qty).slice(0, 5), [productPerf]);
  const mostProfitable = useMemo(() => [...productPerf].sort((a, b) => b.profit - a.profit).slice(0, 5), [productPerf]);

  const staffPerformance = useMemo(() => {
    const m = {};
    (sales || []).forEach((s) => {
      if (s.isVoided) return;
      if (!s.soldByName) return;
      if (!m[s.soldByName]) m[s.soldByName] = { name: s.soldByName, qty: 0, revenue: 0 };
      m[s.soldByName].qty += Number(s.quantity) || 0;
      m[s.soldByName].revenue += Number(s.totalAmount) || 0;
    });
    return Object.values(m).sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  const weekdayPerformance = useMemo(() => {
    const totals = Array(7).fill(0);
    const seenDates = Array.from({ length: 7 }, () => new Set());
    const addRecord = (timestamp, amount) => {
      const t = toMillisValue(timestamp);
      if (t == null) return;
      const idx = weekdayIndexNairobi(t);
      totals[idx] += amount;
      seenDates[idx].add(Math.floor((t + NAIROBI_OFFSET_MS) / 86400000));
    };
    (sales || []).forEach((s) => { if (!s.isVoided) addRecord(s.soldAt, Number(s.totalAmount) || 0); });
    (creditSales || []).forEach((cs) => { if (cs.status !== 'cancelled' && cs.status !== 'refunded') addRecord(cs.soldAt, Number(cs.totalAmount) || 0); });
    return WEEKDAY_LABELS.map((label, i) => ({ label, value: seenDates[i].size > 0 ? totals[i] / seenDates[i].size : 0 }));
  }, [sales, creditSales]);

  const weekdayBest = useMemo(() => {
    const withSales = weekdayPerformance.filter((d) => d.value > 0);
    if (!withSales.length) return null;
    return withSales.reduce((a, b) => (b.value > a.value ? b : a));
  }, [weekdayPerformance]);

  const expenseByCategory = useMemo(() => {
    const map = {};
    (expenses || []).filter((e) => !isExpenseExcluded(e)).forEach((e) => {
      const cat = e.category || 'Other';
      map[cat] = (map[cat] || 0) + (Number(e.amount) || 0);
    });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const revenueChangePct = !prevLoading && prevSummary.revenue > 0 ? ((summary.revenue - prevSummary.revenue) / prevSummary.revenue) * 100 : null;
  const profitChangePct = !prevLoading && prevSummary.netProfit !== 0 ? ((summary.netProfit - prevSummary.netProfit) / Math.abs(prevSummary.netProfit)) * 100 : null;

  const insights = useMemo(() => {
    const list = [];
    if (revenueChangePct !== null) {
      list.push({ tone: revenueChangePct >= 0 ? 'positive' : 'negative', text: `Recognized revenue is ${revenueChangePct >= 0 ? 'up' : 'down'} ${Math.abs(revenueChangePct).toFixed(1)}% vs prior period.` });
    }
    if (profitChangePct !== null) {
      list.push({ tone: profitChangePct >= 0 ? 'positive' : 'negative', text: `Net profit is ${profitChangePct >= 0 ? 'up' : 'down'} ${Math.abs(profitChangePct).toFixed(1)}% vs prior period.` });
    }
    if (mostProfitable[0]) {
      list.push({ tone: 'neutral', text: `"${mostProfitable[0].name}" drove the highest gross profit margin (${formatKES(mostProfitable[0].profit)}).` });
    }
    if (weekdayBest) {
      list.push({ tone: 'neutral', text: `${weekdayBest.label} is your strongest day, averaging ${formatKES(weekdayBest.value)} in sales per occurrence this period.` });
    }
    const salesActivity = summary.revenue + summary.totalCreditSales;
    if (salesActivity > 0 && summary.totalCreditSales > 0) {
      const pct = (summary.totalCreditSales / salesActivity) * 100;
      list.push({ tone: pct > 30 ? 'negative' : 'neutral', text: `Credit exposure: ${pct.toFixed(0)}% of sales activity was issued on credit.` });
    }
    return list;
  }, [revenueChangePct, profitChangePct, mostProfitable, weekdayBest, summary]);

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="h-16 w-16 bg-ink-100 text-ink-500 rounded-full flex items-center justify-center mb-5">
          <Lock className="h-7 w-7" strokeWidth={2} />
        </div>
        <h2 className="font-display text-2xl font-bold text-ink-900">Enterprise Analytics Locked</h2>
        <p className="mt-3 text-sm text-ink-500 leading-relaxed">Advanced Analytics provides institutional-grade visibility into profit margins, capital exposure, and staff performance trends. Requires FlowBiz Pro.</p>
        <Link to="/pro" className="mt-8 btn-primary w-full">Unlock Pro Features</Link>
      </div>
    );
  }

  if (loading) return <div className="py-12"><LoadingSpinner /></div>;

  const margin = summary.revenue > 0 ? (summary.grossProfit / summary.revenue) * 100 : 0;
  const avgTransactionValue = sales.length > 0 ? summary.revenue / sales.length : 0;
  const hasSalesData = sales.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 tracking-tight">Advanced Analytics</h1>
          <p className="text-sm text-ink-500 mt-1">A deeper look at profit, cash flow, and performance trends.</p>
        </div>
        <Link to="/reports" className="btn-outline text-xs bg-white">
          <ArrowLeft className="h-4 w-4 mr-1.5" strokeWidth={2} /> Standard Reports
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-xl border border-ink-200">
        <span className="hidden sm:inline text-xs font-semibold text-ink-500 uppercase tracking-wider pl-1">Range:</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPeriod(opt.id)}
              className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors ${period === opt.id ? 'bg-ink-900 text-white shadow-sm' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex w-full items-center gap-2 sm:w-auto sm:ml-1 animate-fade-in">
            <input type="date" className="input flex-1 !py-1.5 !min-h-0 text-xs sm:text-sm sm:!w-auto" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <span className="text-ink-400 text-xs">to</span>
            <input type="date" className="input flex-1 !py-1.5 !min-h-0 text-xs sm:text-sm sm:!w-auto" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        )}
      </div>
      

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Financial performance</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Recognized Revenue" value={formatKES(summary.revenue)} deltaPct={revenueChangePct} sparkline={trend.map((t) => ({ label: t.label, value: t.revenue }))} sparklineColor="text-moss-600" />
          <KpiCard label="Gross Profit" value={formatKES(summary.grossProfit)} tone="text-moss-700" sparkline={trend.map((t) => ({ label: t.label, value: t.grossProfit }))} sparklineColor="text-moss-600" />
          <KpiCard label="Net Profit" value={formatKES(summary.netProfit)} tone="text-moss-700" deltaPct={profitChangePct} sparkline={trend.map((t) => ({ label: t.label, value: t.netProfit }))} sparklineColor="text-blue-600" />
          <KpiCard label="Profit Margin" value={`${margin.toFixed(1)}%`} tone={margin > 20 ? 'text-moss-700' : margin < 10 ? 'text-rust-600' : 'text-ink-900'} sparkline={trend.map((t) => ({ label: t.label, value: t.margin }))} sparklineColor={margin >= 0 ? 'text-moss-600' : 'text-rust-500'} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Operational metrics</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Total Expenses" value={formatKES(summary.totalExpenses)} tone="text-rust-600" />
          <KpiCard label="Avg Transaction Size" value={hasSalesData ? formatKES(avgTransactionValue) : 'KES 0'} />
          <KpiCard label="Credit Issued" value={formatKES(summary.totalCreditSales)} tone="text-amber-600" />
          <KpiCard label="Total Outstanding Debt" value={formatKES(totalOutstanding)} tone="text-rust-600" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Revenue &amp; Profit Trend" subtitle="Recognized revenue vs. net profit over the selected period" icon={TrendingUp} className="lg:col-span-2">
          {hasSalesData ? (
            <DualTrendChart
              data={trend}
              series={[
                { key: 'revenue', label: 'Revenue', colorClassName: 'text-moss-600', dotClassName: 'bg-moss-600' },
                { key: 'netProfit', label: 'Net Profit', colorClassName: 'text-blue-600', dotClassName: 'bg-blue-600' },
              ]}
              ariaLabel="Revenue vs net profit trend"
            />
          ) : (
            <NoData>Insufficient data to chart trends yet.</NoData>
          )}
        </Section>
        <Section title="Payment Mix" subtitle="How sales value was collected this period" icon={Banknote}>
          {(summary.totalCashSales + summary.totalMpesaSales + summary.totalCreditSales) > 0 ? (
            <>
             <DonutChart
                size={150}
                stacked
                formatValue={formatKES}
                segments={[
                  { label: 'Cash', value: summary.totalCashSales, colorClassName: 'text-moss-600', dotClassName: 'bg-moss-600' },
                  { label: 'M-Pesa', value: summary.totalMpesaSales, colorClassName: 'text-blue-600', dotClassName: 'bg-blue-600' },
                  { label: 'Credit (uncollected)', value: summary.totalCreditSales, colorClassName: 'text-amber-500', dotClassName: 'bg-amber-500' },
                ]}
              />
              <p className="mt-3 text-[11px] leading-relaxed text-ink-400">Credit isn't counted as revenue until it's repaid see the Executive Summary below.</p>
            </>
          ) : (
            <NoData>No sales recorded yet this period.</NoData>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Volume Drivers" subtitle="Highest quantity moved" icon={Package}>
          {bestSelling.length > 0 ? (
            <MiniBarChart orientation="horizontal" formatValue={(v) => `${v.toLocaleString()} units`} data={bestSelling.map((p) => ({ label: p.name, value: p.qty, colorClassName: 'bg-ink-800' }))} />
          ) : (
            <NoData>No product movement detected.</NoData>
          )}
        </Section>
        <Section title="Margin Drivers" subtitle="Highest gross profit generated" icon={Tag}>
          {mostProfitable.length > 0 ? (
            <MiniBarChart orientation="horizontal" formatValue={formatKES} data={mostProfitable.map((p) => ({ label: p.name, value: p.profit, colorClassName: 'bg-moss-600' }))} />
          ) : (
            <NoData>No profit data generated.</NoData>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Sales by Day of Week" subtitle="Average sales value per occurrence of that weekday" icon={BarChart3}>
          {weekdayBest ? (
            <MiniBarChart orientation="vertical" formatValue={formatKES} data={weekdayPerformance} ariaLabel="Sales by day of week" />
          ) : (
            <NoData>No sales activity recorded yet this period.</NoData>
          )}
        </Section>
        <Section title="Expense Breakdown" subtitle="Where operating costs went this period" icon={Receipt}>
          {expenseByCategory.length > 0 ? (
            <DonutChart
              size={150}
              formatValue={formatKES}
              segments={expenseByCategory.map((e, i) => ({ label: e.label, value: e.value, colorClassName: CHART_PALETTE[i % CHART_PALETTE.length].text, dotClassName: CHART_PALETTE[i % CHART_PALETTE.length].bg }))}
            />
          ) : (
            <NoData>No expenses recorded this period.</NoData>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Capital &amp; Credit Exposure" subtitle="Liquidity tied up in customer credit" icon={Users}>
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3 text-sm">
              <span className="text-ink-600 font-medium">Credit Issued (This Period)</span>
              <span className="font-semibold text-ink-900">{formatKES(summary.totalCreditSales)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-ink-100 pb-3 text-sm">
              <span className="text-ink-600 font-medium">Debt Collected (This Period)</span>
              <span className="font-semibold text-moss-700">{formatKES(summary.totalDebtRepayments)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 text-sm bg-rust-50 p-3 rounded-lg border border-rust-100">
              <span className="font-bold text-rust-800 uppercase tracking-wide text-xs">Total Market Exposure</span>
              <span className="font-bold text-rust-700 text-base">{formatKES(totalOutstanding)}</span>
            </div>
          </div>
        </Section>
        <Section title="Top Debtors" subtitle="Customers with the highest outstanding balance" icon={Users}>
          {topDebtors.length > 0 ? (
            <div className="space-y-1">
              {topDebtors.map((d, i) => (
                <Link key={d.customerId || d.name} to={d.customerId ? `/customers/${d.customerId}` : '/customers'} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-ink-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rust-50 text-xs font-bold text-rust-700">{i + 1}</span>
                    <span className="truncate text-sm font-medium text-ink-800">{d.name}</span>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-rust-600">{formatKES(d.balance)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <NoData>No outstanding customer balances, nice and clean!</NoData>
          )}
        </Section>
      </div>

      <Section title="Staff Performance Index" subtitle="Revenue attribution by cashier" icon={UsersRound}>
        {staffPerformance.length === 0 ? (
          <NoData>No staff attribution data found.</NoData>
        ) : (
          <div className="overflow-hidden rounded-lg border border-ink-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-ink-50 text-xs uppercase tracking-wider font-semibold text-ink-500">
                <tr><th className="px-4 py-3 border-b border-ink-200">Staff Member</th><th className="px-4 py-3 border-b border-ink-200 text-right">Items Sold</th><th className="px-4 py-3 border-b border-ink-200 text-right">Revenue Generated</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {staffPerformance.map((st, i) => (
                  <tr key={st.name} className="hover:bg-ink-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-ink-900">
                      {st.name}
                      {i === 0 && <span className="badge ml-2 bg-amber-100 text-amber-800">Top</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-600">{st.qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-moss-700">{formatKES(st.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Executive Summary" subtitle="Automated business intelligence" icon={ClipboardCheck}>
        {insights.length > 0 ? (
          <div className="space-y-3 pt-1">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 text-sm bg-ink-50 p-3 rounded-lg border border-ink-100">
                <div className="shrink-0 mt-0.5">
                  {insight.tone === 'positive' ? <CheckCircle2 className="h-5 w-5 text-moss-600" strokeWidth={2} /> :
                   insight.tone === 'negative' ? <AlertCircle className="h-5 w-5 text-rust-600" strokeWidth={2} /> :
                   <Info className="h-5 w-5 text-ink-500" strokeWidth={2} />}
                </div>
                <span className="text-ink-800 font-medium leading-relaxed">{insight.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <NoData>More transaction volume required to generate insights.</NoData>
        )}
      </Section>
    </div>
  );
}
````

## File: src/pages/JoinStaff.jsx
````javascript
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

export function validatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

export default function JoinStaff() {
  const { inviteId } = useParams();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [invite, setInvite]     = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'staffInvites', inviteId));
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
          setChecking(false);
          return;
        }
        setInvite({ id: snap.id, ...snap.data() });
      } catch {
        setNotFound(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inviteId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    let freshSnap;
    try {
      freshSnap = await getDoc(doc(db, 'staffInvites', inviteId));
      if (!freshSnap.exists()) throw new Error('This invite is no longer valid.');
      if (freshSnap.data().claimed) throw new Error('This invite has already been used.');
    } catch (validationErr) {
      setError(validationErr.message || 'This invite could not be validated. Please try again.');
      setSubmitting(false);
      return;
    }
    const { businessId, role, displayName } = freshSnap.data();

    let targetUser = null;
    let isNewAuthUser = false;

    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      targetUser = cred.user;
      isNewAuthUser = true;
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        try {
          const signInCred = await signInWithEmailAndPassword(auth, email.trim(), password);
          targetUser = signInCred.user;
        } catch {
          setError('An account with this email already exists. Please verify your password or use a different email.');
          setSubmitting(false);
          return;
        }
      } else {
        const message =
          authErr.code === 'auth/invalid-email'  ? 'Please enter a valid email address.' :
          authErr.code === 'auth/weak-password'   ? 'Password should be at least 8 characters with upper, lower, and numbers.' :
          'Could not create your account. Please try again.';
        setError(message);
        setSubmitting(false);
        return;
      }
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', targetUser.uid), {
        uid: targetUser.uid,
        email: email.trim(),
        displayName,
        role,
        businessId,
        active: true,
        createdAt: new Date(),
        claimedFromInviteId: inviteId,
      });
      batch.update(doc(db, 'staffInvites', inviteId), {
        claimed: true,
        linkedUid: targetUser.uid,
        claimedAt: new Date(),
      });
      await batch.commit();
    } catch (dbErr) {
      console.error('[JoinStaff] Firestore write failed:', dbErr);
      if (isNewAuthUser) {
        try { await deleteUser(targetUser); } catch {}
      }
      setError('Something went wrong completing your signup. Please contact your business owner.');
      setSubmitting(false);
      return;
    }

    try {
      const idToken = await targetUser.getIdToken(true);
      const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error('send-verification-failed');
      toast.success(`Welcome, ${displayName}! Please check your email to verify your account.`);
    } catch {
      try { await sendEmailVerification(targetUser); } catch {}
      toast.success(`Welcome, ${displayName}! Your account is ready.`);
    }

    setSubmitting(false);
    navigate('/', { replace: true });
  };

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4"><p className="text-sm text-ink-400">Checking invite…</p></div>;

  if (notFound || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
        <div className="w-full max-w-sm card p-6 text-center space-y-3">
          <div className="text-3xl">🔗</div>
          <h1 className="font-display text-lg font-bold text-ink-900">Invite not found</h1>
          <p className="text-sm text-ink-500">This link may be invalid or was cancelled by the business owner.</p>
          <Link to="/login" className="btn-outline w-full">Go to sign in</Link>
        </div>
      </div>
    );
  }

  if (invite.claimed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
        <div className="w-full max-w-sm card p-6 text-center space-y-3">
          <div className="text-3xl">✅</div>
          <h1 className="font-display text-lg font-bold text-ink-900">Invite Already Claimed</h1>
          <p className="text-sm text-ink-500">This invite link has already been used. Please sign in with your email and password.</p>
          <Link to="/login" className="btn-primary w-full">Go to sign in</Link>
        </div>
      </div>
    );
  }

  const roleLabel = invite.role === 'owner' ? 'an owner' : 'a cashier';

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Welcome, {invite.displayName}</h1>
            <p className="text-sm text-ink-400">You have been invited as {roleLabel}.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}

          <div>
            <label className="label">Your email</label>
            <input type="email" className="input" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" />
          </div>
          <div>
            <label className="label">Choose a password</label>
            <input type="password" className="input" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 chars (upper, lower, number)" autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input type="password" className="input" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat password" autoComplete="new-password" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Setting up…' : 'Create my sign-in'}
          </button>
        </form>
      </div>
    </div>
  );
}
````

## File: src/pages/Login.jsx
````javascript
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
export default function Login() {
  const { login, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState(null);
const LOCKOUT_SCHEDULE = [60, 300, 900, 1800, 3600]; // 1m → 5m → 15m → 30m → 1h, then stays at 1h
const LOCKOUT_KEY = 'flowbiz_login_lockout';

function readLockout() {
  try { return JSON.parse(localStorage.getItem(LOCKOUT_KEY) || 'null'); } catch { return null; }
}
function writeLockout(state) {
  try { localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state)); } catch {}
}
  useEffect(() => {
    if (firebaseUser) navigate(location.state?.from?.pathname || '/', { replace: true });
  }, [firebaseUser, navigate, location]);

const [lockoutSeconds, setLockoutSeconds] = useState(0);

useEffect(() => {
  const saved = readLockout();
  if (saved?.until) {
    const remaining = Math.ceil((saved.until - Date.now()) / 1000);
    if (remaining > 0) setLockoutSeconds(remaining);
  }
}, []);

useEffect(() => {
  if (lockoutSeconds <= 0) return;
  const t = setTimeout(() => setLockoutSeconds((s) => s - 1), 1000);
  return () => clearTimeout(t);
}, [lockoutSeconds]);

  const handle = async e => {
    e.preventDefault(); setError(null); setSubmitting(true);
try {
  await login(email.trim(), password);
  toast.success('Welcome back!');
}
catch (err) {
  if (
    err.code === 'auth/invalid-credential' ||
    err.code === 'auth/wrong-password' ||
     err.code === 'auth/user-not-found' ||
   err.code === 'auth/invalid-email'
  ) {
    setError('Incorrect email or password.');
 } else if (err.code === 'auth/too-many-requests') {
  const saved = readLockout();
  const level = Math.min((saved?.level ?? -1) + 1, LOCKOUT_SCHEDULE.length - 1);
  const seconds = LOCKOUT_SCHEDULE[level];
  writeLockout({ level, until: Date.now() + seconds * 1000 });
  setLockoutSeconds(seconds);
  setError('Too many attempts. Please wait before trying again.');
} else if (err.code === 'auth/user-disabled') {
   setError('This account has been disabled. Please contact your business owner.');
   
  } else {
    setError('Something went wrong signing in. Please try again.');
  }
}
finally {
  setSubmitting(false);
}
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div><h1 className="font-display text-2xl font-bold text-white">FlowBiz</h1><p className="text-sm text-ink-400">Business Manager</p></div>
        </div>
        <form onSubmit={handle} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
          <div><label className="label">Email</label><input type="email" required className="input" placeholder="owner@yourbusiness.co.ke" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" /></div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label !mb-0">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-moss-400 hover:underline mb-1.5">Forgot password?</Link>
            </div>
            <input type="password" required className="input" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" />
          </div>

<button type="submit" className="btn-primary w-full" disabled={submitting || lockoutSeconds > 0}>
  {lockoutSeconds > 0 ? `Try again in ${lockoutSeconds}s` : submitting ? 'Signing in…' : 'Sign in'}
</button>        </form>
        <p className="text-center text-sm text-ink-400">New to FlowBiz? <Link to="/setup" className="font-semibold text-moss-400 hover:underline">Create a business</Link></p>
      </div>
    </div>
  );
}
````

## File: src/pages/Users.jsx
````javascript
// src/pages/Users.jsx
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Copy, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { tenantQuery } from '../lib/tenant';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Users() {
  const { createStaffInvite, cancelStaffInvite, removeStaffAccount, toggleMemberActive, profile, businessId, isPro } = useAuth();
  
  // Scoped tenant query with in-memory sorting to avoid composite index requirement
  const usersQ = useMemo(() => (businessId ? tenantQuery('users', businessId) : null), [businessId]);
  const { data: rawUsers, loading } = useFirestoreCollection(usersQ);
  const users = useMemo(() => [...rawUsers].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')), [rawUsers]);

  const invitesQ = useMemo(() => (businessId ? tenantQuery('staffInvites', businessId) : null), [businessId]);
  const { data: allInvites, loading: invitesLoading } = useFirestoreCollection(invitesQ);
  const invites = useMemo(() => allInvites.filter((i) => !i.claimed), [allInvites]);

  const ownerCount = useMemo(() => users.filter((u) => u.role === 'owner' && u.active !== false).length, [users]);
  const totalUsersCount = useMemo(() => users.filter((u) => u.active !== false).length, [users]);

  const [modal, setModal]                     = useState(false);
  const [newName, setNewName]                 = useState('');
  const [newRole, setNewRole]                 = useState('cashier');
  const [busy, setBusy]                       = useState(false);
  const [freshInvite, setFreshInvite]         = useState(null);
  const [pendToggle, setPendToggle]           = useState(null);
  const [pendDelete, setPendDelete]           = useState(null);
  const [pendCancelInvite, setPendCancelInvite] = useState(null);

  const inviteLink = (inviteId) => `${window.location.origin}/join/${inviteId}`;

  const copyLink = async (inviteId) => {
    try {
      await navigator.clipboard.writeText(inviteLink(inviteId));
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy — long-press the link to copy it manually.');
    }
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    if (!isPro && (totalUsersCount + invites.length) >= 2) {
      toast.error('Free plan allows a maximum of 1 Owner and 1 additional Staff member. Upgrade to FlowBiz Pro to add more, or cancel a pending invite first.');
      return;
    }

    setBusy(true);
    try {
      const invite = await createStaffInvite({ displayName: newName.trim(), role: newRole });
      if (invite.queuedOffline) {
        toast.success("Invite saved — the link will be ready once you're back online.");
        setModal(false);
      } else {
        setFreshInvite({ id: invite.id, displayName: newName.trim(), role: newRole });
      }
      setNewName('');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelInvite = async () => {
    if (!pendCancelInvite) return;
    try {
      await cancelStaffInvite(pendCancelInvite.id);
      toast.success('Invite cancelled');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPendCancelInvite(null);
    }
  };

  const handleToggle = async () => {
    if (!pendToggle) return;
    if (pendToggle.role === 'owner' && pendToggle.active !== false && ownerCount <= 1) {
      toast.error("This is the only active owner — deactivating them would lock everyone out. Invite another owner first.");
      setPendToggle(null);
      return;
    }
    try {
      await toggleMemberActive(pendToggle.id, pendToggle.active === false);
      toast.success(pendToggle.active !== false ? 'Account deactivated' : 'Account reactivated');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPendToggle(null);
    }
  };

  const handleDelete = async () => {
    if (!pendDelete) return;
    if (pendDelete.role === 'owner' && ownerCount <= 1) {
      toast.error('You cannot remove the only owner. Invite another owner first.');
      setPendDelete(null);
      return;
    }
    try {
      await removeStaffAccount(pendDelete.id);
      toast.success('Account removed.');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPendDelete(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Team</h1>
          <p className="text-sm text-ink-400">Manage who has access to this business.</p>
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => {
            setFreshInvite(null);
            setNewName('');
            setNewRole('cashier');
            setModal(true);
          }}
        >
          + Invite someone
        </button>
      </div>

      {invites.length > 0 && (
        <div className="card p-4 space-y-2">
          <h2 className="font-display text-sm font-bold text-ink-800">Pending invites</h2>
          <div className="divide-y divide-ink-100">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-800">
                    {inv.displayName}
                    <span className={`badge ml-2 ${inv.role === 'owner' ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-700'}`}>{inv.role}</span>
                  </p>
                  <p className="text-xs text-ink-400 truncate font-mono">{inviteLink(inv.id)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => copyLink(inv.id)}>
                    <Copy className="h-3.5 w-3.5" strokeWidth={1.75} /> Copy link
                  </button>
                  <button
                    className="rounded-lg p-2 text-rust-400 hover:bg-rust-50 min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Cancel invite"
                    onClick={() => setPendCancelInvite(inv)}
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading || invitesLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="card divide-y divide-ink-100">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-800 truncate">
                  {u.displayName || u.email?.split('@')[0] || 'Unnamed'}
                  {u.id === profile?.uid && <span className="text-xs font-normal text-ink-400"> (you)</span>}
                </p>
                <p className="text-xs text-ink-400 truncate">{u.email || 'No email'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${u.role === 'owner' ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-700'}`}>{u.role || '—'}</span>
                <span className={`badge ${u.active !== false ? 'bg-moss-100 text-moss-700' : 'bg-rust-100 text-rust-700'}`}>{u.active !== false ? 'Active' : 'Deactivated'}</span>
                <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => setPendToggle(u)}>
                  {u.active !== false ? 'Deactivate' : 'Reactivate'}
                </button>
                {u.id === profile?.uid ? (
                  <span className="text-xs text-ink-300 px-2">You</span>
                ) : (
                  <button
                    className="rounded-lg p-2 text-rust-400 hover:bg-rust-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Remove account"
                    onClick={() => setPendDelete(u)}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={freshInvite ? 'Invite ready' : 'Invite someone'}>
        {!freshInvite ? (
          <form onSubmit={handleCreateInvite} className="space-y-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required autoComplete="off" autoFocus />
            </div>
            <div>
              <label className="label">Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewRole('cashier')}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${newRole === 'cashier' ? 'border-moss-600 bg-moss-50 text-moss-800' : 'border-ink-200 text-ink-500'}`}
                >
                  Cashier
                </button>
                <button
                  type="button"
                  onClick={() => setNewRole('owner')}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${newRole === 'owner' ? 'border-moss-600 bg-moss-50 text-moss-800' : 'border-ink-200 text-ink-500'}`}
                >
                  Owner
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create invite'}</button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">Send this link to <span className="font-semibold">{freshInvite.displayName}</span> ({freshInvite.role}).</p>
            <div className="flex items-center gap-2">
              <input className="input font-mono text-xs" readOnly value={inviteLink(freshInvite.id)} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn-outline shrink-0" onClick={() => copyLink(freshInvite.id)}>
                <Copy className="h-4 w-4" strokeWidth={1.75} /> Copy
              </button>
            </div>
            <button type="button" className="btn-primary w-full" onClick={() => setModal(false)}>Done</button>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!pendToggle} title="Change Account Status?" confirmLabel="Confirm" onConfirm={handleToggle} onCancel={() => setPendToggle(null)} />
      <ConfirmDialog open={!!pendDelete} title="Remove Account?" confirmLabel="Remove" danger onConfirm={handleDelete} onCancel={() => setPendDelete(null)} />
      <ConfirmDialog open={!!pendCancelInvite} title="Cancel Invite?" confirmLabel="Cancel" danger onConfirm={handleCancelInvite} onCancel={() => setPendCancelInvite(null)} />
    </div>
  );
}
````

## File: src/utils/businessReset.js
````javascript
// src/utils/businessReset.js
import { collection, query, where, getDocs, writeBatch, doc, setDoc, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

const RESET_COLLECTIONS = [
  'products', 'sales', 'customers', 'suppliers', 'creditSales', 'expenses',
  'purchases', 'dailySessions', 'repayments', 'supplierPayments',
  'stockAdjustments', 'barcodeIndex', 'refunds',
  'debtPaymentReceipts', 'sharedDocuments', 'staffInvites', 'sessions',
];

const DEFAULT_CATEGORIES = [
'Beverages', 'Hardware', 'Household',
  'Personal Care', 'Stationery', 'Airtime/Float', 'Other'
];

async function deleteTenantCollection(name, businessId, chunkSize = 400) {
  let totalDeleted = 0;
  while (true) {
    const snap = await getDocs(query(collection(db, name), where('businessId', '==', businessId), limit(chunkSize)));
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    totalDeleted += snap.docs.length;
    if (snap.docs.length < chunkSize) break;
  }
  return totalDeleted;
}

export async function resetBusinessData(businessId, ownerUid) {
  if (!businessId) throw new Error('resetBusinessData() called with no businessId');
  const results = {};
  const failures = [];

  for (const name of RESET_COLLECTIONS) {
    try {
      results[name] = await deleteTenantCollection(name, businessId);
    } catch (err) {
      console.error(`[Reset] Collection ${name} cleanup FAILED:`, err);
      results[name] = 0;
      failures.push(`${name} (${err.message || 'unknown error'})`);
    }
  }

  try {
    const cashiersSnap = await getDocs(query(
      collection(db, 'users'), where('businessId', '==', businessId), where('role', '==', 'cashier')
    ));
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken(true) : null;

    for (const cashierDoc of cashiersSnap.docs) {
      const cashierUid = cashierDoc.id;
      if (idToken) {
        try {
          const res = await fetch(`${FLOWBIZ_API_URL}/api/auth/delete-staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ targetUid: cashierUid }),
          });
          if (!res.ok) failures.push(`cashier auth delete for ${cashierUid} (status ${res.status})`);
        } catch (authErr) {
          failures.push(`cashier auth delete for ${cashierUid} (${authErr.message})`);
        }
      }
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', cashierUid));
        await batch.commit();
      } catch (docErr) {
        failures.push(`cashier profile delete for ${cashierUid} (${docErr.message})`);
      }
    }
  } catch (cashierErr) {
    failures.push(`cashier cleanup (${cashierErr.message})`);
  }

  try {
    await setDoc(doc(db, 'businessSettings', businessId), {
      shopName: 'FlowBiz Store', phone: '', email: '', address: '', logoUrl: '',
      cashierCanRecordExpenses: true, categories: DEFAULT_CATEGORIES, receiptPaperWidth: 80,
      resetAt: new Date(), resetBy: ownerUid || null,
    }, { merge: true });
    results.businessSettings = 1;
  } catch (settingsErr) {
    failures.push(`businessSettings reset (${settingsErr.message})`);
  }

  results.performedBy = ownerUid || null;

  if (failures.length > 0) {
    const err = new Error(`Reset finished, but some data may not have been fully cleared: ${failures.join('; ')}`);
    err.partialResults = results;
    throw err;
  }

  return results;
}
````

## File: src/utils/whatsapp.js
````javascript
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
````

## File: index.html
````html
<!doctype html>
<html lang="en-KE">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
    <link rel="apple-touch-icon" href="/icons/icon-180.png" />
    <link rel="preconnect" href="https://js.paystack.co" crossorigin />
    <link rel="preconnect" href="https://api.paystack.co" crossorigin />
    <link rel="preconnect" href="https://flowbiz-api.flowbiz.workers.dev" crossorigin />
    <!-- PWA & Mobile Meta Tags -->
    <meta name="application-name" content="FlowBiz" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="FlowBiz" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#1a623c" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />

    <!-- SEO & Search Engine Optimization Meta Tags -->
    <title>FlowBiz — POS, Inventory & Business Manager for Kenyan SMBs</title>
    <meta name="description" content="Offline-first Point of Sale (POS), real-time stock inventory, M-Pesa till reconciliation, and customer credit (deni) ledger tailored for Kenyan retail shops, wholesalers, and supermarkets." />
    <meta name="keywords" content="POS Kenya, Point of Sale Nairobi, M-Pesa POS integration, retail management Kenya, duka inventory app, deni credit ledger, Kenyan business software, FlowBiz, stock control Kenya" />
    <meta name="author" content="FlowBiz" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://flowbiz.co.ke/" />

    <!-- Open Graph (Facebook, WhatsApp, LinkedIn, X preview) -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://flowbiz.co.ke/" />
    <meta property="og:title" content="FlowBiz — Modern POS & Business Manager for Kenyan Shops" />
    <meta property="og:description" content="Fast offline-first multi-product POS, automated M-Pesa float reconciliation, debt ledger, and inventory intelligence for Kenyan businesses." />
    <meta property="og:image" content="https://flowbiz.co.ke/icons/icon-512.png" />
    <meta property="og:locale" content="en_KE" />
    <meta property="og:site_name" content="FlowBiz" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="FlowBiz — POS & Inventory Management for Kenyan Businesses" />
    <meta name="twitter:description" content="Manage sales, track cash & M-Pesa till float, audit inventory, and record customer debt with zero false profit illusions." />
    <meta name="twitter:image" content="https://flowbiz.co.ke/icons/icon-512.png" />

    <!-- Structured Data (Schema.org JSON-LD for Google Rich Results) -->
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "FlowBiz",
        "operatingSystem": "Web, Android, iOS, Windows, macOS",
        "applicationCategory": "BusinessApplication",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "KES"
        },
        "description": "Offline-first POS and business management software for Kenyan retail, wholesale, and service shops with M-Pesa reconciliation and debt tracking."
      }
    </script>
      <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Does FlowBiz work when there is no internet connection?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. FlowBiz uses an offline-first architecture with persistent local caching. Sales, credit purchases, and expenses are saved immediately in your browser or phone storage and sync automatically when connectivity is restored."
      }
    },
    {
      "@type": "Question",
      "name": "How does M-Pesa reconciliation work at closing time?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "When recording sales, cashiers specify whether the payment was received via Cash or M-Pesa. At the end of the shift on the Close Day page, FlowBiz calculates the exact expected M-Pesa sum so you can reconcile it directly against your M-Pesa Till or Paybill balance."
      }
    },
    {
      "@type": "Question",
      "name": "Why does profit stay at zero when I record a Credit (Deni) sale?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "FlowBiz uses a cash-flow-first accounting model specifically designed for retail businesses. Revenue and gross profit are only recognized when the customer pays off their debt to prevent false profit illusions on uncollected credit."
      }
    }
  ]
}
</script>
    <!-- Google Fonts Preconnect & Stylesheets -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

    <!-- Firebase & Cloud Performance Preconnects -->
    <link rel="preconnect" href="https://firestore.googleapis.com" crossorigin />
    <link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossorigin />
    <link rel="preconnect" href="https://securetoken.googleapis.com" crossorigin />
  </head>
  <body class="bg-[#faf6ef] text-[#15171d] antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
    <!-- Paystack Inline Payment Gateway Script -->
    <script src="https://js.paystack.co/v2/inline.js"></script>
  </body>
</html>
````

## File: cloudflare-worker/wrangler.toml
````toml
name = "flowbiz-api"
main = "src/index.js"
compatibility_date = "2025-01-01"

# Secrets — set these with `wrangler secret put <NAME>`, NEVER written here:
#   FIREBASE_SERVICE_ACCOUNT_JSON   (the full service-account JSON, as one string)
#   PAYSTACK_SECRET_KEY
#
# FIX: removed WHATSAPP_ACCESS_TOKEN — it belonged to routes/whatsappSend.js
# (the unused Meta WhatsApp Cloud API route), which has been deleted. If a
# WHATSAPP_ACCESS_TOKEN secret still exists on this Worker from before,
# it's safe to remove: `wrangler secret delete WHATSAPP_ACCESS_TOKEN`.

[vars]
FIREBASE_PROJECT_ID = "swiftstock-bc6a3"
ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,https://flowbiz.pages.dev,https://flowbiz.co.ke"
PAYSTACK_CALLBACK_URL = "https://flowbiz.pages.dev/pro"
APP_BASE_URL = "https://flowbiz.co.ke"
````

## File: src/components/pos/SaleCompleteModal.jsx
````javascript
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../common/Modal';
import { generateReceiptPDF, printReceipt, generateInvoicePDF, printInvoice, sendWhatsAppDocument } from '../../utils/documentService';
import { getOrCreateShareLink } from '../../utils/documentSharing';
import { useSettings } from '../../hooks/useSettings';
import { useAuth } from '../../contexts/AuthContext';
import { formatKES } from '../../utils/currency';
import { Printer, Download, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock } from 'lucide-react';

export default function SaleCompleteModal({ open, sale, onClose }) {
  const { settings } = useSettings();
  const { isPro, businessId, profile } = useAuth();
  const [phone, setPhone] = useState(sale?.customerPhone || '');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  // Keep phone input synced when a new sale is opened
  useEffect(() => {
    if (sale?.customerPhone) {
      setPhone(sale.customerPhone);
    } else {
      setPhone('');
    }
  }, [sale]);

  if (!sale) return null;

  const docLabel = sale.isCredit ? 'Invoice' : 'Receipt';
  // FIX (multi-product cart): a sale built from Counter.jsx's cart carries
  // an `items` array when it has more than one line. Single-product sales
  // (Dashboard's own quick-scan sale, or a one-item cart checkout) never
  // set this, so the original single-line summary below still renders
  // exactly as before.
  const cartItems = Array.isArray(sale.items) && sale.items.length > 1 ? sale.items : null;

  // FIX (Pro-gating correction): View, Download, and Print are FlowBiz's
  // basic document access and stay free on every plan. Only WhatsApp
  // sharing — the convenience of pushing the document straight to the
  // customer's phone — is the Pro feature. Print/Download used to be
  // gated behind isPro here; that was a bug, not an intentional product
  // rule (nothing else in the app treats PDF access as paid), so it's
  // removed rather than preserved.
  const handlePrint = () => {
    if (sale.isCredit) printInvoice(sale, settings);
    else printReceipt(sale, settings);
  };

  const handleDownload = () => {
    if (sale.isCredit) generateInvoicePDF(sale, settings);
    else generateReceiptPDF(sale, settings);
  };

  const handleWhatsApp = async () => {
    if (!phone.trim()) {
      toast.error('Please enter a valid customer phone number.');
      return;
    }
    setSendingWhatsApp(true);
    try {
      const documentUrl = await getOrCreateShareLink({
        businessId,
        documentType: sale.isCredit ? 'invoice' : 'receipt',
        documentId: sale.id,
        createdBy: profile?.uid,
      });
      sendWhatsAppDocument(sale, settings, phone.trim(), documentUrl);
    } catch (e) {
      toast.error(e.message || 'Unable to generate the receipt link. Please try again.');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={sale.isCredit ? 'Credit Sale Recorded' : 'Sale Complete'}>
      <div className="space-y-4">
        {/* Fixed rounded-xl2 to rounded-2xl */}
        <div className={`flex flex-col items-center justify-center py-4 rounded-2xl border ${sale.isCredit ? 'bg-rust-50 border-rust-200' : 'bg-moss-50 border-moss-200'}`}>
          <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${sale.isCredit ? 'bg-rust-100 text-rust-700' : 'bg-moss-100 text-moss-700'}`}>
            {sale.isCredit ? <Clock className="h-5 w-5 text-rust-600" strokeWidth={2} /> : <CheckCircle2 className="h-5 w-5 text-moss-600" strokeWidth={2} />}
          </div>
          <h2 className={`font-display font-bold ${sale.isCredit ? 'text-rust-700' : 'text-moss-800'}`}>
            {sale.isCredit ? 'Credit sale recorded' : 'Sale recorded successfully'}
          </h2>

          {cartItems ? (
            <div className="w-full px-5 mt-2 space-y-1">
              {cartItems.map((item, idx) => (
                <div key={item.productId || idx} className="flex items-center justify-between text-xs text-ink-700">
                  <span>{item.quantity} × {item.productName}</span>
                  <span className="font-semibold">{formatKES(item.lineTotal ?? (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold mt-2 text-ink-800">{sale.quantity} × {sale.productName}</p>
          )}

          {sale.isCredit && sale.customerName && <p className="text-xs text-ink-500 mt-1">{sale.customerName}</p>}
          <p className="text-lg font-bold text-ink-900 mt-1">{formatKES(sale.totalAmount)}</p>
          <p className={`text-xs mt-1 font-semibold ${sale.isCredit ? 'text-rust-600' : 'text-ink-500'}`}>
            {sale.isCredit ? 'Payment Status: Unpaid' : sale.paymentMethod}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print {docLabel}
          </button>
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download {docLabel}
          </button>
        </div>

        <div className="rounded-lg border border-ink-100 p-3 space-y-2">
          <label className="label">
            WhatsApp {docLabel} {!isPro && <span className="text-amber-600">— PRO</span>}
          </label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Customer Phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              disabled={sendingWhatsApp}
            />
            {isPro ? (
              <button className="btn-primary flex items-center justify-center gap-2 shrink-0" onClick={handleWhatsApp} disabled={sendingWhatsApp}>
                <MessageCircle className="h-4 w-4" /> {sendingWhatsApp ? 'Preparing…' : 'Send'}
              </button>
            ) : (
              <Link to="/pro" className="btn-primary flex items-center justify-center gap-2 shrink-0">
                <MessageCircle className="h-4 w-4" /> Unlock
              </Link>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-ink-100">
          <button className="btn-secondary w-full" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
````

## File: src/pages/StockTake.jsx
````javascript
import { useMemo, useRef, useState } from 'react';
import {
  doc,
  collection,
  writeBatch,
  increment,
  serverTimestamp,
  orderBy,
  where,
  limit,
} from 'firebase/firestore';
import { formatDateTime } from '../utils/dateRanges';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function StockTake() {
  const { profile, businessId } = useAuth();

  // Products query
  const productsQ = useMemo(
    () =>
      businessId
        ? tenantQuery(
            'products',
            businessId,
            where('deleted', '!=', true),
            orderBy('deleted'),
            orderBy('name')
          )
        : null,
    [businessId]
  );

  const { data: products, loading } = useFirestoreCollection(productsQ);

  // Recent stock adjustments query
  // IMPORTANT: Hooks must be called at the top level of the component,
  // never inside handleSave or another callback.
  const adjustmentsQ = useMemo(
    () =>
      businessId
        ? tenantQuery(
            'stockAdjustments',
            businessId,
            orderBy('adjustedAt', 'desc'),
            limit(20)
          )
        : null,
    [businessId]
  );

  const { data: recentAdjustments } =
    useFirestoreCollection(adjustmentsQ);

  const [counts, setCounts] = useState({});
  const [reasons, setReasons] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);

  const rowRefs = useRef({});

  const getPhysical = (p) =>
    counts[p.id] !== undefined && counts[p.id] !== ''
      ? counts[p.id]
      : p.stock;

  const diffFor = (p) =>
    counts[p.id] !== undefined && counts[p.id] !== ''
      ? Number(counts[p.id]) - p.stock
      : 0;

  const changed = products.filter((p) => diffFor(p) !== 0);

  const handleScanDetected = (code) => {
    setScannerOpen(false);

    const found = findProductByCode(products, code);

    if (!found) {
      toast.error('Product not found.');
      return;
    }

    rowRefs.current[found.id]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    const inputEl =
      document.getElementById(`stocktake-count-${found.id}`) ||
      document.getElementById(`stocktake-count-mobile-${found.id}`);

    inputEl?.focus();
    inputEl?.select?.();
  };

  useHardwareScanner(handleScanDetected, {
    enabled: !scannerOpen && !confirm,
  });

  const handleSave = async () => {
    setSaving(true);

    try {
      const batch = writeBatch(db);

      for (const p of changed) {
        const physicalQty = Number(getPhysical(p)) || 0;
        const difference = physicalQty - p.stock;
        const ref = doc(db, 'products', p.id);

        batch.update(ref, {
          stock: increment(difference),
          updatedAt: serverTimestamp(),
        });

        const adjRef = doc(collection(db, 'stockAdjustments'));

        batch.set(adjRef, {
          businessId,
          productId: p.id,
          productName: p.name,
          systemQty: p.stock,
          physicalQty,
          difference,
          reason: reasons[p.id] || '',
          adjustedBy: profile.uid,
          adjustedByName: profile.displayName,
          adjustedAt: new Date(),
        });
      }

      const { queuedOffline, error } = await raceWithTimeout(
        batch.commit(),
        4000
      );

      if (error) {
        throw error;
      }

      toast.success(
        queuedOffline
          ? 'Stock take queued offline.'
          : `Stock take saved — ${changed.length} product(s) adjusted`
      );

      setCounts({});
      setReasons({});
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">
            Stock Take
          </h1>

          <p className="text-sm text-ink-400">
            Enter physical counts, or scan to jump to a product. Leave blank
            to keep unchanged.
          </p>
        </div>

        <button
          className="btn-primary"
          disabled={changed.length === 0}
          onClick={() => setConfirm(true)}
        >
          Save ({changed.length} changed)
        </button>
      </div>

      {/* Mobile */}
      <div className="space-y-3 sm:hidden">
        {products.map((p) => {
          const diff = diffFor(p);

          return (
            <div
              key={p.id}
              ref={(el) => {
                rowRefs.current[p.id] = el;
              }}
              className={`card p-4 space-y-3 transition-colors ${
                selectedProductId === p.id
                  ? 'border-moss-500 bg-moss-50 shadow-md ring-1 ring-moss-500'
                  : diff !== 0
                    ? 'border-rust-200 bg-rust-50/20'
                    : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink-800">
                  {p.name}
                </span>

                <span className="badge bg-ink-100 text-ink-600 text-xs">
                  System: {p.stock}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Physical count</label>

                  <input
                    id={`stocktake-count-mobile-${p.id}`}
                    type="number"
                    min="0"
                    className="input !py-2"
                    value={counts[p.id] ?? ''}
                    placeholder={String(p.stock)}
                    onFocus={() => setSelectedProductId(p.id)}
                    onBlur={() => setSelectedProductId(null)}
                    onChange={(e) =>
                      setCounts((c) => ({
                        ...c,
                        [p.id]: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="label">Difference</label>

                  <div
                    className={`input !py-2 flex items-center font-semibold ${
                      diff < 0
                        ? 'text-rust-600'
                        : diff > 0
                          ? 'text-moss-600'
                          : 'text-ink-400'
                    }`}
                  >
                    {diff !== 0
                      ? diff > 0
                        ? `+${diff}`
                        : diff
                      : '0'}
                  </div>
                </div>
              </div>

              {diff !== 0 && (
                <div>
                  <label className="label">
                    Reason for discrepancy
                  </label>

                  <input
                    className="input !py-2"
                    placeholder="e.g. damage, theft, expired"
                    value={reasons[p.id] || ''}
                    onChange={(e) =>
                      setReasons((r) => ({
                        ...r,
                        [p.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop */}
      <div className="hidden sm:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">System</th>
                <th className="px-4 py-3">Physical count</th>
                <th className="px-4 py-3">Diff</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-ink-100">
              {products.map((p) => {
                const diff = diffFor(p);

                return (
                  <tr
                    key={p.id}
                    ref={(el) => {
                      rowRefs.current[p.id] = el;
                    }}
                    className={`transition-colors ${
                      selectedProductId === p.id
                        ? 'bg-moss-50 shadow-inner'
                        : diff !== 0
                          ? 'bg-rust-50/30'
                          : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-ink-800">
                      {p.name}
                    </td>

                    <td className="px-4 py-3 text-ink-500">
                      {p.stock}
                    </td>

                    <td className="px-4 py-3">
                      <input
                        id={`stocktake-count-${p.id}`}
                        type="number"
                        min="0"
                        className="input !w-24 !py-1.5"
                        value={counts[p.id] ?? ''}
                        placeholder={String(p.stock)}
                        onFocus={() => setSelectedProductId(p.id)}
                        onBlur={() => setSelectedProductId(null)}
                        onChange={(e) =>
                          setCounts((c) => ({
                            ...c,
                            [p.id]: e.target.value,
                          }))
                        }
                      />
                    </td>

                    <td
                      className={`px-4 py-3 font-semibold ${
                        diff < 0
                          ? 'text-rust-600'
                          : diff > 0
                            ? 'text-moss-600'
                            : 'text-ink-300'
                      }`}
                    >
                      {diff !== 0
                        ? diff > 0
                          ? `+${diff}`
                          : diff
                        : '—'}
                    </td>

                    <td className="px-4 py-3">
                      <input
                        className="input !py-1.5"
                        placeholder="e.g. breakage, theft"
                        value={reasons[p.id] || ''}
                        disabled={diff === 0}
                        onChange={(e) =>
                          setReasons((r) => ({
                            ...r,
                            [p.id]: e.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent adjustments */}
      {recentAdjustments.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-ink-800">
            Recent stock adjustments
          </h2>

          <div className="divide-y divide-ink-100">
            {recentAdjustments.map((a) => (
              <div key={a.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-700">
                    {a.productName}
                  </span>

                  <span
                    className={`font-semibold ${
                      a.difference < 0
                        ? 'text-rust-600'
                        : 'text-moss-600'
                    }`}
                  >
                    {a.systemQty} → {a.physicalQty} (
                    {a.difference > 0 ? '+' : ''}
                    {a.difference})
                  </span>
                </div>

                <p className="text-xs text-ink-400">
                  {a.reason || 'No reason given'} ·{' '}
                  {formatDateTime(a.adjustedAt)} · {a.adjustedByName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ScanFab
        onClick={() => setScannerOpen(true)}
        label="Scan"
      />

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScanDetected}
      />

      <ConfirmDialog
        open={confirm}
        title="Save stock take?"
        message={`${changed.length} product(s) will be updated to match your physical count.`}
        confirmLabel={saving ? 'Saving…' : 'Save'}
        confirmDisabled={saving}
        onConfirm={handleSave}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
````

## File: firestore.rules
````
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ─────────────────────────────────────────────────────────
    function isSignedIn() { return request.auth != null; }

    function hasProfile() {
      return isSignedIn() && exists(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function myProfile() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isActive() {
      let data = myProfile();
      return !('active' in data) || data.active != false;
    }

    function isStaff() {
      return hasProfile() && isActive();
    }

    function myBusinessId() {
      return myProfile().businessId;
    }

    function isOwner() {
      return isStaff() && myProfile().role == 'owner';
    }

    function owns(data) {
      return isStaff() && data.businessId == myBusinessId();
    }

    function ownsUpdate(existing, incoming) {
      return owns(existing) && owns(incoming);
    }

    function isValidInviteClaim(inviteId, businessId, role) {
      let invite = get(/databases/$(database)/documents/staffInvites/$(inviteId)).data;
      return invite.claimed == false && invite.businessId == businessId && invite.role == role;
    }

    // ── Businesses ──────────────────────────────────────────────────────
    match /businesses/{businessId} {
      allow get: if isStaff() && myBusinessId() == businessId;
      allow create: if isSignedIn()
                    && request.resource.data.subscription.plan == 'free';
      allow update: if isOwner() && myBusinessId() == businessId
                    && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['subscription']);
      allow delete: if false;
    }

    match /barcodeIndex/{docId} {
      allow read: if isOwner() && owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow update: if isOwner() && owns(request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /productCodeCounters/{businessId} {
      allow read, write: if isOwner() && myBusinessId() == businessId;
    }

match /businessSettings/{businessId} {
  allow read: if isStaff() && myBusinessId() == businessId;
  allow create: if isSignedIn() && request.resource.data.businessId == businessId;
  allow update: if isOwner() && myBusinessId() == businessId;
  allow delete: if false;
}

    // ── Users & invites ─────────────────────────────────────────────────
    match /users/{userId} {
      allow get: if isSignedIn() && request.auth.uid == userId;
      allow list: if isOwner() && resource.data.businessId == myBusinessId();

      allow create: if isSignedIn() && request.auth.uid == userId
                    && request.resource.data.role in ['owner', 'cashier']
                    && request.resource.data.businessId is string
                    && request.resource.data.businessId.size() > 0
                    && (
                      request.resource.data.role == 'owner'
                      ||
                      (
                        request.resource.data.claimedFromInviteId is string
                        && isValidInviteClaim(request.resource.data.claimedFromInviteId, request.resource.data.businessId, request.resource.data.role)
                      )
                    );
      allow update: if (isOwner() && ownsUpdate(resource.data, request.resource.data))
                    ||
                    (isSignedIn() && request.auth.uid == userId
                     && request.resource.data.role == resource.data.role
                     && request.resource.data.businessId == resource.data.businessId);
      allow delete: if isOwner() && owns(resource.data) && userId != request.auth.uid;
    }

    match /staffInvites/{inviteId} {
      allow get: if true;
      allow list: if isOwner() && resource.data.businessId == myBusinessId();
      allow create: if isOwner() && request.resource.data.businessId == myBusinessId()
                    && request.resource.data.role in ['owner', 'cashier'];
      allow update: if (isOwner() && ownsUpdate(resource.data, request.resource.data))
                    ||
                    (isSignedIn()
                    && resource.data.claimed == false
                    && request.resource.data.claimed == true
                    && request.resource.data.linkedUid == request.auth.uid
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['claimed', 'linkedUid', 'claimedAt']));
      allow delete: if isOwner() && resource.data.businessId == myBusinessId();
    }

    // ── Device sessions ───────────────────────────────────────────────
    match /sessions/{sessionId} {
      allow create: if isStaff() && request.resource.data.uid == request.auth.uid && request.resource.data.businessId == myBusinessId();

      allow read: if isSignedIn() && (
        resource == null || 
        resource.data.uid == request.auth.uid || 
        (isStaff() && resource.data.businessId == myBusinessId())
      );

      allow update: if isSignedIn() && (
        (resource.data.uid == request.auth.uid
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastActiveAt', 'deviceLabel', 'userAgent', 'lastUserName', 'uid', 'businessId']))
        ||
        (isOwner() && resource.data.businessId == myBusinessId()
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['revoked']))
      );
      allow delete: if isOwner() && resource.data.businessId == myBusinessId();
    }

    // ── Business operational data ──────────────────────────────────────
    match /products/{id} {
      allow read: if owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow update: if ownsUpdate(resource.data, request.resource.data) && (
        isOwner() ||
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['stock', 'updatedAt'])
      );
      allow delete: if isOwner() && owns(resource.data);
    }

    match /suppliers/{id} {
      allow read: if owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /sales/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /customers/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /creditSales/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /repayments/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /debtPaymentReceipts/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /sharedDocuments/{token} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data)
                    && request.resource.data.documentType in ['receipt', 'invoice', 'debtPaymentReceipt'];
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /refunds/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /expenses/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /purchases/{id} {
      allow read: if owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /supplierPayments/{id} {
      allow read: if owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /stockAdjustments/{id} {
      allow read: if owns(resource.data);
      allow create: if isOwner() && owns(request.resource.data);
      allow update: if isOwner() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }

    match /dailySessions/{id} {
      allow read: if owns(resource.data);
      allow create: if owns(request.resource.data);
      allow update: if isStaff() && ownsUpdate(resource.data, request.resource.data);
      allow delete: if isOwner() && owns(resource.data);
    }
  }
}
````

## File: src/pages/Suppliers.jsx
````javascript
import { useMemo, useState } from 'react';
import { addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp, where, collection } from 'firebase/firestore'; // Removed orderBy

import toast from 'react-hot-toast';
import { Pencil, Trash2, Banknote, Smartphone } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner'; // Added Import
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import { formatKES } from '../utils/currency';
import { computeSupplierBalances } from '../utils/financials';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Suppliers() {
  const { profile, businessId } = useAuth();
  const suppQ   = useMemo(() => businessId ? tenantQuery('suppliers', businessId) : null, [businessId]); // Removed orderBy('name')
  const purchQ  = useMemo(() => businessId ? tenantQuery('purchases', businessId, where('paymentStatus', '==', 'pending_supplier_credit')) : null, [businessId]);
  const paymQ   = useMemo(() => businessId ? tenantQuery('supplierPayments', businessId) : null, [businessId]);
  
  const { data: rawSuppliers, loading, error, refetch } = useFirestoreCollection(suppQ); // Destructured error
  const { data: purchases }          = useFirestoreCollection(purchQ);
  const { data: spayments }          = useFirestoreCollection(paymQ);

  // Alphabetically sort suppliers in memory
  const suppliers = useMemo(() => {
    return [...rawSuppliers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [rawSuppliers]);

  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [pendDel, setPendDel]   = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [selSupp, setSelSupp]   = useState(null);
  const [payAmt, setPayAmt]     = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payCode, setPayCode]   = useState('');
  const [paying, setPaying]     = useState(false);

  const owedList = useMemo(
    () => computeSupplierBalances(purchases, spayments, suppliers),
    [purchases, spayments, suppliers]
  );
  const owedMap = useMemo(
    () => Object.fromEntries(owedList.map((o) => [o.supplierId, o.balance])),
    [owedList]
  );
  const totalOwed = owedList.reduce((a, o) => a + o.balance, 0);

  const [deleting, setDeleting] = useState(false);

  const handleSave = async data => {
    const write = editing
      ? updateDoc(doc(db,'suppliers',editing.id), data)
      : addDoc(tenantCollection('suppliers'), withBusiness({ ...data, createdAt:serverTimestamp() }, businessId));

    const { queuedOffline, error: writeError } = await raceWithTimeout(write, 4000);
    if (writeError) { toast.error(friendlyErrorMessage(writeError)); throw writeError; }
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : (editing ? 'Supplier updated' : 'Supplier added'));
    await refetch();
    setModal(false); setEditing(null);
  };

  const handleDel = async () => {
    const stillExists = suppliers.some((s) => s.id === pendDel.id);
    if (!stillExists) {
      toast.success('Already removed.');
      await refetch();
      setPendDel(null);
      return;
    }
    const balance = owedMap[pendDel.id] || 0;
    if (balance > 0.005) {
      toast.error(`Can't remove "${pendDel.name}" — they still have an outstanding balance of ${formatKES(balance)}. Pay it off first.`);
      setPendDel(null);
      return;
    }
    setDeleting(true);
    const { queuedOffline, error: deleteError } = await raceWithTimeout(deleteDoc(doc(db,'suppliers',pendDel.id)), 4000);
    setDeleting(false);
    if (deleteError) { toast.error(friendlyErrorMessage(deleteError)); return; }
    toast.success(queuedOffline ? "Removed — it'll sync once you're back online." : 'Supplier removed');
    setPendDel(null);
    await refetch();
  };

  const handlePay = async e => {
    e.preventDefault();
    const amount = Number(payAmt);
    const balance = owedMap[selSupp?.id]||0;
    if (amount<=0) { toast.error('Enter a positive amount.'); return; }
    if (amount > balance + 0.005) { toast.error(`Amount exceeds the outstanding balance of ${formatKES(balance)}.`); return; }
    if (payMethod==='M-Pesa'&&!payCode.trim()) { toast.error('Enter M-Pesa code.'); return; }
    setPaying(true);
    const batch = writeBatch(db);
    const expRef = doc(collection(db,'expenses'));
    batch.set(expRef, withBusiness({ description:`Supplier payment to ${selSupp.name}`, category:'Supplier Payment', amount, paymentMethod:payMethod, mpesaCode:payMethod==='M-Pesa'?payCode.trim():null,
     recordedBy:profile.uid, recordedByName:profile.displayName, recordedAt:new Date() }, businessId));
    const payRef = doc(collection(db,'supplierPayments'));
    batch.set(payRef, withBusiness({ supplierId:selSupp.id, supplierName:selSupp.name, amount, method:payMethod, mpesaCode:payMethod==='M-Pesa'?payCode.trim():null, paidAt:new Date(), recordedBy:profile.uid, recordedByName:profile.displayName }, businessId));

    const commit = batch.commit();
    const { queuedOffline, error: commitError } = await raceWithTimeout(commit, 4000);
    setPaying(false);
    if (commitError) { toast.error(friendlyErrorMessage(commitError)); return; }
    toast.success(queuedOffline ? "Payment saved — it'll sync once you're back online." : `Payment of ${formatKES(amount)} recorded for ${selSupp.name}`);
    if (queuedOffline) commit.catch((err) => toast.error(`A supplier payment from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
    setPayModal(false); setPayAmt(''); setPayCode('');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-xl font-bold text-ink-900">Suppliers</h1><p className="text-sm text-ink-400">Total owed: <span className="font-semibold text-rust-600">{formatKES(totalOwed)}</span></p></div>
        <button className="btn-primary" onClick={()=>{setEditing(null);setModal(true);}}>+ Add supplier</button>
      </div>
      <ErrorBanner message={error} /> {/* Display error if it occurs */}
      {loading?<LoadingSpinner />:suppliers.length===0?<EmptyState title="No suppliers yet" description="Add suppliers to track restocking and balances." />:(
        <div className="space-y-3">
          {suppliers.map(s=>{
            const balance = owedMap[s.id]||0;
            return (
              <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="font-semibold text-ink-800">{s.name}</p><p className="text-xs text-ink-400">{s.contactPerson&&`${s.contactPerson} · `}{s.phone||'No phone'}</p></div>
                <div className="flex items-center gap-3">
                  <div className="text-right"><p className="text-xs text-ink-400">Outstanding</p><p className={`font-semibold ${balance>0?'text-rust-600':'text-moss-600'}`}>{formatKES(balance)}</p></div>
                  {balance>0&&<button className="btn-primary !text-xs !px-3 !py-1.5 !min-h-0" onClick={()=>{setSelSupp(s);setPayModal(true);}}>Pay</button>}
                  <button className="rounded-lg p-2 text-ink-400 hover:bg-ink-100" onClick={()=>{setEditing(s);setModal(true);}}><Pencil className="h-4 w-4" strokeWidth={1.75}/></button>
                  <button className="rounded-lg p-2 text-rust-400 hover:bg-rust-50" onClick={()=>setPendDel(s)}><Trash2 className="h-4 w-4" strokeWidth={1.75}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <SupplierFormModal open={modal} onClose={()=>{setModal(false);setEditing(null);}} onSave={handleSave} initialSupplier={editing} />
      <ConfirmDialog
        open={!!pendDel}
        title="Remove supplier?"
        message={(owedMap[pendDel?.id]||0) > 0.005
          ? `"${pendDel?.name}" has an outstanding balance of ${formatKES(owedMap[pendDel?.id]||0)} — pay it off first.`
          : `"${pendDel?.name}" will be removed. Purchase records stay intact.`}
        confirmLabel={deleting ? 'Removing…' : 'Remove'}
        confirmDisabled={deleting}
        danger
        onConfirm={handleDel}
        onCancel={()=>{ if (!deleting) setPendDel(null); }}
      />      
      <Modal open={payModal} onClose={()=>setPayModal(false)} title={`Pay ${selSupp?.name||''}`}>
        <form onSubmit={handlePay} className="space-y-3">
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">Outstanding: <span className="font-semibold text-rust-600">{formatKES(owedMap[selSupp?.id]||0)}</span></div>
          <div><label className="label">Amount (KES)</label><input type="number" min="0.01" step="0.01" max={owedMap[selSupp?.id]||undefined} className="input" value={payAmt} onChange={e=>setPayAmt(e.target.value)} required autoFocus /></div>
          <div><label className="label">Method</label>
            <div className="grid grid-cols-2 gap-2">
              {['Cash','M-Pesa'].map(m=>(
                <button key={m} type="button" onClick={()=>setPayMethod(m)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${payMethod===m?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>
                  {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
                </button>
              ))}
            </div>
          </div>
          {payMethod==='M-Pesa'&&<div><label className="label">M-Pesa code</label><input className="input uppercase" value={payCode} onChange={e=>setPayCode(e.target.value.toUpperCase())} /></div>}
          <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={()=>setPayModal(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={paying}>{paying?'Recording…':'Record payment'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
````

## File: src/utils/documentService.js
````javascript
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
````

## File: src/pages/CustomerDetail.jsx
````javascript
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { where, orderBy, doc, writeBatch, increment, getDoc, serverTimestamp, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Receipt, Banknote, Smartphone, Undo2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import RepaymentModal from '../components/debtors/RepaymentModal';
import RefundModal from '../components/debtors/RefundModal';
import DebtPaymentReceiptModal from '../components/debtors/DebtPaymentReceiptModal';
import { formatKES } from '../utils/currency';
import { formatDateTime } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function CustomerDetail() {
  const { customerId } = useParams();
  const { profile, isAdmin, businessId } = useAuth();

  const customerQ   = useMemo(() => businessId ? tenantQuery('customers', businessId, where('__name__','==',customerId)) : null, [customerId, businessId]);
  const creditQ     = useMemo(() => businessId ? tenantQuery('creditSales', businessId, where('customerId','==',customerId)) : null, [customerId, businessId]);
  const repaymentsQ = useMemo(() => businessId ? tenantQuery('repayments', businessId, where('customerId','==',customerId), orderBy('paidAt','desc')) : null, [customerId, businessId]);

  const { data: customerData, loading: custLoad } = useFirestoreCollection(customerQ);
  const { data: creditSales, loading: credLoad, error } = useFirestoreCollection(creditQ);
  const { data: repayments } = useFirestoreCollection(repaymentsQ);
  
  const [repayOpen, setRepayOpen]       = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [receiptData, setReceiptData]   = useState(null);

  const customer = customerData[0];
  const sorted = [...creditSales].sort((a,b) => (b.soldAt?.toMillis?.() ?? 0) - (a.soldAt?.toMillis?.() ?? 0));
  const totalOwed = creditSales
    .filter(cs => cs.status !== 'cancelled' && cs.status !== 'refunded')
    .reduce((acc,cs) => acc + (Number(cs.remainingBalance) || 0), 0);

  const displayName = customer?.name || creditSales[0]?.customerName || 'Unknown Customer';
  const displayPhone = customer?.phone || creditSales[0]?.customerPhone || '';

  // A debt payment is a payment against existing debt — it updates the
  // credit sale(s) it applies to and nothing else. It never creates a new
  // sale or a second financial transaction (Part 28). If the customer has
  // more than one open credit sale, a single payment can span several of
  // them (oldest first, unchanged from the app's existing allocation
  // rule) — the receipt below reflects the payment at the customer level
  // (previous total owed → new total owed), with each sale's own
  // reference number kept for traceability (Part 18/19).
  const handleRepayment = async ({ amount, method, mpesaCode }) => {
    const openSales = [...creditSales]
      .filter(cs => cs.status !== 'cancelled' && cs.status !== 'refunded' && (Number(cs.remainingBalance) || 0) > 0.005)
      .sort((a,b) => (a.soldAt?.toMillis?.() ?? 0) - (b.soldAt?.toMillis?.() ?? 0));

    if (!openSales.length) { toast.error('No outstanding balance.'); return; }

    const previousBalance = totalOwed;

    try {
      const batch = writeBatch(db);
      let remaining = amount;
      const paymentReferences = [];

      for (const cs of openSales) {
        if (remaining <= 0.005) break;
        const owed    = Number(cs.remainingBalance) || 0;
        const portion = Math.min(owed, remaining);
        remaining    -= portion;
        const newPaid = (Number(cs.amountPaid) || 0) + portion;
        const newBal  = owed - portion;
        batch.update(doc(db,'creditSales',cs.id), { amountPaid: newPaid, remainingBalance: newBal, status: newBal <= 0.005 ? 'paid' : 'partial' });

        const repRef = doc(collection(db,'repayments'));
        // Reuses Firestore's own unique doc id for traceability rather than
        // introducing a second, parallel counter/ID system (Part 18) —
        // adapted to this app's existing ID conventions rather than
        // literally implementing PAY-000381-style sequential numbering.
        const paymentReference = `PAY-${repRef.id.slice(-6).toUpperCase()}`;
        paymentReferences.push(paymentReference);
        batch.set(repRef, {
          businessId,
          creditSaleId: cs.id,
          customerId: cs.customerId,
          customerName: cs.customerName,
          productName: cs.productName,
          amount: portion,
          method,
          mpesaCode: mpesaCode || null,
          paymentReference,
          paidAt: serverTimestamp(),
          recordedBy: profile.uid,
          recordedByName: profile.displayName,
        });
      }

      // Persist an immutable snapshot of the receipt itself (Parts 8/9/15
      // of the WhatsApp/document-sharing spec). A debt payment can span
      // several credit sales, so there's no single existing Firestore
      // document that already IS "the receipt" the way a sale or credit
      // sale doc already represents its own receipt — this is that
      // missing piece, written in the SAME batch as the repayment(s)
      // above so it can never exist without them (or vice versa). It's a
      // read-only summary for sharing, not a new payment/debt system —
      // the actual debt math above is untouched.
      const newTotalOwed = Math.max(0, previousBalance - amount);
      const receiptRef = doc(collection(db, 'debtPaymentReceipts'));
      batch.set(receiptRef, {
        businessId,
        customerId,
        customerName: displayName,
        customerPhone: displayPhone,
        amountPaid: amount,
        previousBalance,
        remainingBalance: newTotalOwed,
        isCleared: newTotalOwed <= 0.005,
        method,
        mpesaCode: mpesaCode || null,
        paymentReferences,
        paidAt: new Date(),
        recordedBy: profile.uid,
        recordedByName: profile.displayName,
      });

      const commit = batch.commit();
      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : `Recorded ${formatKES(amount)} repayment`);
      if (queuedOffline) commit.catch((err) => toast.error(`A repayment from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));

      setReceiptData({
        receiptDocId: receiptRef.id,
        customerId,
        customerName: displayName,
        customerPhone: displayPhone,
        amountPaid: amount,
        previousBalance,
        remainingBalance: newTotalOwed,
        isCleared: newTotalOwed <= 0.005,
        method,
        mpesaCode,
        paidAt: new Date(),
        paymentReferences,
      });
    } catch (err) { toast.error(friendlyErrorMessage(err)); throw err; }
  };

  // FIX (multi-product cart): a credit sale from Counter.jsx's cart can
  // carry several products via `items` on one creditSale doc. Cancelling
  // it now restores stock for every line item (falling back to the
  // single productId/quantity shape for pre-cart, legacy creditSale docs
  // — cancelling those still works exactly as before).
  const handleCancel = async (cs) => {
    setCancelTarget(null);
    try {
      const lineItems = Array.isArray(cs.items) && cs.items.length > 0
        ? cs.items
        : [{ productId: cs.productId, quantity: cs.quantity }];
      const targets = lineItems.filter((item) => item.productId);
      const snaps = await Promise.all(targets.map((item) => getDoc(doc(db, 'products', item.productId))));

      const batch = writeBatch(db);
      targets.forEach((item, idx) => {
        if (snaps[idx].exists()) {
          batch.update(doc(db, 'products', item.productId), { stock: increment(item.quantity), updatedAt: serverTimestamp() });
        }
      });
      batch.update(doc(db,'creditSales',cs.id), {
        status: 'cancelled', remainingBalance: 0,
        cancelledAt: serverTimestamp(), cancelledBy: profile.uid,
      });
      await batch.commit();
      toast.success('Credit sale cancelled and stock restored.');
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
  };

  // FIX (multi-product cart): same line-item restoration as handleCancel
  // above, applied to a refund (a credit sale that had some amount
  // already paid on it).
  const handleRefund = async (cs, { method }) => {
    try {
      const lineItems = Array.isArray(cs.items) && cs.items.length > 0
        ? cs.items
        : [{ productId: cs.productId, quantity: cs.quantity }];
      const targets = lineItems.filter((item) => item.productId);
      const snaps = await Promise.all(targets.map((item) => getDoc(doc(db, 'products', item.productId))));

      const batch = writeBatch(db);
      targets.forEach((item, idx) => {
        if (snaps[idx].exists()) {
          batch.update(doc(db, 'products', item.productId), { stock: increment(item.quantity), updatedAt: serverTimestamp() });
        }
      });
      batch.update(doc(db,'creditSales',cs.id), {
        status: 'refunded', remainingBalance: 0,
        refundedAt: serverTimestamp(), refundedBy: profile.uid,
      });
      const refundRef = doc(collection(db,'refunds'));
      batch.set(refundRef, {
        businessId,
        creditSaleId: cs.id, customerId: cs.customerId, customerName: cs.customerName,
        productName: cs.productName, amount: Number(cs.amountPaid) || 0, method,
        refundedAt: new Date(), refundedBy: profile.uid, refundedByName: profile.displayName,
      });
      await batch.commit();
      toast.success('Sale refunded and stock restored.');
      setRefundTarget(null);
    } catch (err) { toast.error(friendlyErrorMessage(err)); throw err; }
  };

  if (custLoad || credLoad) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={`Could not load data. ${error}`} />;
  if (!customer && creditSales.length === 0) return <EmptyState title="Customer not found" />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/customers" className="text-sm font-semibold text-ink-400 hover:text-ink-700">← Back to Customers</Link>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">{displayName}</h1>
          <p className="text-sm text-ink-400">{displayPhone || 'No phone'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-400">Outstanding Debt</p>
          <p className={`font-display text-xl font-bold ${totalOwed > 0 ? 'text-rust-600' : 'text-moss-700'}`}>{formatKES(totalOwed)}</p>
        </div>
      </div>
      <button className="btn-primary w-full sm:w-auto" disabled={totalOwed <= 0} onClick={() => setRepayOpen(true)}>
        <Receipt className="h-4 w-4" strokeWidth={1.75}/> Record repayment
      </button>

      {sorted.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-ink-800">Credit purchases</h2>
          <div className="divide-y divide-ink-100">
            {sorted.map(cs => {
              const reversed = cs.status === 'cancelled' || cs.status === 'refunded';
              return (
                <div key={cs.id} className={`flex items-center justify-between gap-2 py-2.5 text-sm ${reversed ? 'opacity-50' : ''}`}>
                  <div>
                    <p className="font-medium text-ink-700">{cs.quantity} × {cs.productName}</p>
                    <p className="text-xs text-ink-400">{formatDateTime(cs.soldAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={`font-semibold ${reversed ? 'line-through text-ink-400' : 'text-ink-800'}`}>{formatKES(cs.totalAmount)}</p>
                      <span className={`badge ${cs.status === 'paid' ? 'bg-moss-100 text-moss-700' : cs.status === 'partial' ? 'bg-rust-100 text-rust-700' : 'bg-ink-100 text-ink-500'}`}>{cs.status}</span>
                    </div>
                    {isAdmin && !reversed && (
                      <button
                        className="rounded-lg p-2 text-ink-400 hover:bg-ink-100"
                        title={Number(cs.amountPaid) > 0.005 ? 'Refund this sale' : 'Cancel this sale'}
                        onClick={() => (Number(cs.amountPaid) > 0.005 ? setRefundTarget(cs) : setCancelTarget(cs))}
                      >
                        <Undo2 className="h-4 w-4" strokeWidth={1.75}/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {repayments.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-ink-800">Repayment history</h2>
          <div className="divide-y divide-ink-100">
            {repayments.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink-700">{r.method === 'Cash' ? <><Banknote className="inline h-4 w-4 mr-1" strokeWidth={1.75}/>Cash</> : <><Smartphone className="inline h-4 w-4 mr-1" strokeWidth={1.75}/>M-Pesa {r.mpesaCode ? `(${r.mpesaCode})` : ''}</>}</p>
                  <p className="text-xs text-ink-400">
                    {formatDateTime(r.paidAt)}{r.paymentReference ? ` · ${r.paymentReference}` : ''}
                  </p>
                </div>
                <span className="font-semibold text-moss-700">{formatKES(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RepaymentModal open={repayOpen} customer={{ name: displayName }} totalOwed={totalOwed} onClose={() => setRepayOpen(false)} onSubmit={handleRepayment} />
      <RefundModal open={!!refundTarget} creditSale={refundTarget} onClose={() => setRefundTarget(null)} onSubmit={(opts) => handleRefund(refundTarget, opts)} />
      <DebtPaymentReceiptModal open={!!receiptData} receipt={receiptData} onClose={() => setReceiptData(null)} />
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this credit sale?"
        message={`"${cancelTarget?.productName}" (×${cancelTarget?.quantity}) will be cancelled and stock restored. Nothing has been paid on this sale yet.`}
        confirmLabel="Cancel sale"
        danger
        onConfirm={() => handleCancel(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
````

## File: src/pages/Pro.jsx
````javascript
// src/pages/Pro.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import toast from 'react-hot-toast';
import { friendlyErrorMessage } from '../utils/errorMessages';
import { Check, X, BarChart3, Boxes, FileText, MessageCircle, Users, Sparkles, ArrowLeft } from 'lucide-react';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

const FEATURE_CATEGORIES = [
  { icon: BarChart3, title: 'Advanced Analytics', description: 'Revenue & profit trends, payment mix, day-of-week patterns, expense breakdown, top debtors, and staff performance all in one dashboard.' },
  { icon: Boxes, title: 'Inventory Intelligence', description: 'Capital Health scoring, ABC value analysis, reorder suggestions, slow-moving stock alerts, and capital-by-supplier breakdowns.' },
  { icon: FileText, title: 'Professional Documents', description: 'Branded PDF receipts and invoices with your logo, ready to print or download.' },
  { icon: MessageCircle, title: 'WhatsApp Sharing', description: "Send receipts, invoices, and debt reminders straight to a customer's phone." },
];

const COMPARISON_ROWS = [
  { label: 'Products tracked', free: 'Up to 100', pro: 'Unlimited' },
  { label: 'Staff members', free: '1 owner + 1 staff', pro: 'Unlimited' },
  { label: 'Sales, credit & expense tracking', free: true, pro: true },
  { label: 'PDF receipts & invoices', free: true, pro: true },
  { label: 'Advanced Analytics (trends, staff, day-of-week)', free: false, pro: true },
  { label: 'Inventory Intelligence & Capital Health', free: false, pro: true },
  { label: 'Reorder suggestions & ABC value analysis', free: false, pro: true },
  { label: 'WhatsApp receipt & invoice sharing', free: false, pro: true },
];

export default function Pro() {
  const { isPro, subscription } = useAuth();
  const [loading, setLoading] = useState(false);
  const [proPrice, setProPrice] = useState(null);

  useEffect(() => {
    fetch(`${FLOWBIZ_API_URL}/api/pro/price`)
      .then((r) => r.json())
      .then((data) => setProPrice(data.amountKes))
      .catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    if (loading) return;
    setLoading(true);
    try {

      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch(`${FLOWBIZ_API_URL}/api/paystack/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      const data = await response.json();
      if (data?.access_code && window.PaystackPop) {
        const popup = new window.PaystackPop();
        popup.resumeTransaction(data.access_code, {
          onSuccess: () => toast.success('Payment received activating your subscription…'),
          onCancel: () => toast('Payment cancelled.'),
        });
      } else if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.error(data?.error || "Couldn't initialize payment. Please try again.");
      }
    } catch (err) {
      toast.error(friendlyErrorMessage(err, { fallback: 'Unable to load the payment page. Please check your connection and try again.' }));
    } finally {
      setLoading(false);
    }
  };

  const expiresLabel = subscription?.expiresAt
    ? new Date(subscription.expiresAt.toMillis ? subscription.expiresAt.toMillis() : subscription.expiresAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-moss-700">FlowBiz Pro</p>
          <h1 className="font-display text-2xl font-bold text-ink-900 mt-0.5">Run your shop with sharper insight</h1>
        </div>
        <Link to="/" className="btn-outline text-xs shrink-0">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Dashboard
        </Link>
      </div>

      <div className="card overflow-hidden border-moss-200">
        <div className="bg-gradient-to-br from-moss-700 to-moss-900 px-6 py-10 text-center sm:px-10">

          <h2 className="mt-4 font-display text-4xl font-extrabold text-white">
            {proPrice != null ? `KSh ${proPrice.toLocaleString('en-KE')}` : '…'}
            <span className="text-base font-medium text-moss-200"> / 30 days</span>
          </h2>
          <p className="mt-3 max-w-md mx-auto text-sm text-moss-100">Manual renewal, no auto-billing, no surprise charges. You're always in control.</p>
          {isPro ? (
            <div className="mt-7 flex flex-col items-center gap-3">
              <span className="badge bg-white text-moss-800 px-4 py-1.5 text-sm font-bold">FlowBiz Pro Active</span>
              {expiresLabel && <p className="text-xs text-moss-200">Renews / expires on {expiresLabel}</p>}
              <button onClick={handleSubscribe} disabled={loading} className="btn-outline !border-white/40 !text-white hover:!bg-white/10">
                {loading ? 'Loading…' : 'Extend subscription'}
              </button>
            </div>
          ) : (
            <button onClick={handleSubscribe} disabled={loading} className="mt-7 btn-primary !bg-white !text-moss-800 hover:!bg-moss-50 px-8 py-3 text-base">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-moss-300 border-t-moss-800" />
                  Loading payment page…
                </span>
              ) : `Upgrade to Pro KSh ${proPrice != null ? proPrice.toLocaleString('en-KE') : '…'}`}
            </button>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-500 mb-3">What's included</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CATEGORIES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="card p-5 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl2 bg-moss-50 text-moss-700">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h4 className="font-display text-sm font-bold text-ink-900">{title}</h4>
              <p className="text-xs leading-relaxed text-ink-500">{description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-500 mb-3">Free vs Pro</h3>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <tr><th className="px-4 py-3">Feature</th><th className="px-4 py-3 text-center">Free</th><th className="px-4 py-3 text-center text-moss-700">Pro</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 font-medium text-ink-700">{row.label}</td>
                    <td className="px-4 py-3 text-center text-ink-500">
                      {typeof row.free === 'boolean' ? (row.free ? <Check className="mx-auto h-4 w-4 text-moss-600" strokeWidth={2} /> : <X className="mx-auto h-4 w-4 text-ink-300" strokeWidth={2} />) : row.free}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-moss-700">
                      {typeof row.pro === 'boolean' ? (row.pro ? <Check className="mx-auto h-4 w-4 text-moss-600" strokeWidth={2} /> : <X className="mx-auto h-4 w-4 text-ink-300" strokeWidth={2} />) : row.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-ink-400">
        
        Built for Kenyan shops pay in KES via M-Pesa or card, powered by Paystack.
      </div>
    </div>
  );
}
````

## File: src/pages/Products.jsx
````javascript
import { useMemo, useState } from 'react';
import { orderBy, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Pencil, Trash2, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, withBusiness, tenantCollection } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct, updateProduct, softDeleteProduct } from '../utils/products';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorBanner from '../components/common/ErrorBanner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES } from '../utils/currency';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Products() {
  const { businessId } = useAuth();
  const productsQ = useMemo(
    () => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null),
    [businessId]
  );
  const suppliersQ = useMemo(() => (businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null), [businessId]);
  const { data: products, loading, error } = useFirestoreCollection(productsQ);
  const { data: suppliers, refetch: refetchSuppliers } = useFirestoreCollection(suppliersQ);
  
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [pendingDel, setPendingDel] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanFoundProduct, setScanFoundProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.includes(search.trim())) ||
      (p.internalCode && p.internalCode.toLowerCase().includes(search.toLowerCase()))
  );
  
  const suppName = (id) => suppliers.find((s) => s.id === id)?.name || '—';

  const closeFormModal = () => {
    setModal(false);
    setEditing(null);
    setPrefillBarcode(null);
  };

  const handleSave = async (data) => {
    try {
      if (editing) {
        const { queuedOffline } = await updateProduct(editing.id, data, editing.barcode, businessId);
        toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product updated');
      } else {
        const { queuedOffline } = await createProduct(data, businessId);
        toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product added');
      }
      closeFormModal();
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
      throw err;
    }
  };

  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); throw error; }
    if (!queuedOffline) {
      setNewSupplierId(ref.id);
      await refetchSuppliers();
    }
    setSupplierModal(false);
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Supplier added');
  };

  const handleDel = async () => {
    setDeleting(true);
    const { queuedOffline, error } = await raceWithTimeout(softDeleteProduct(pendingDel.id, pendingDel.barcode, businessId), 4000);
    setDeleting(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(queuedOffline ? "Archived offline — it'll sync later." : 'Product archived');
    setPendingDel(null);
  };

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) setScanFoundProduct(found);
    else { setEditing(null); setPrefillBarcode(code); setModal(true); }
  };

  useHardwareScanner(handleScanDetected, { enabled: !modal && !supplierModal && !scannerOpen && !scanFoundProduct });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-xl font-bold text-ink-900">Products</h1><p className="text-sm text-ink-400">{products.length} items</p></div>
        <div className="flex gap-2">
          <Link to="/inventory-intelligence" className="btn-outline">
            <TrendingUp className="h-4 w-4" /> Intelligence
          </Link>
          <button className="btn-primary" onClick={() => { setEditing(null); setPrefillBarcode(null); setModal(true); }}>+ Add product</button>
        </div>
      </div>
      <input className="input" placeholder="Search by name, category, or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ErrorBanner message={error} />
      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState title="No products yet" description="Add your first product to start tracking stock." action={<button className="btn-primary" onClick={() => setModal(true)}>+ Add product</button>} />
      ) : (
        <>
          <div className="space-y-2.5 sm:hidden">
            {filtered.map((p) => (
              <div key={p.id} className={`card p-3.5 space-y-2 ${p.stock <= (p.lowStockThreshold ?? 5) ? 'border-rust-200 bg-rust-50/20' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="badge bg-ink-100 text-ink-500 text-[10px] mb-1">{p.category}</span>
                    <h3 className="font-semibold text-ink-800 leading-tight truncate">{p.name}</h3>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100" onClick={() => { setEditing(p); setPrefillBarcode(null); setModal(true); }}><Pencil className="h-4 w-4" strokeWidth={1.75} /></button>
                    <button className="rounded-lg p-1.5 text-rust-400 hover:bg-rust-50" onClick={() => setPendingDel(p)}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-ink-100 text-xs">
                  <div className="space-x-3">
                    <span><span className="text-ink-400">Cost: </span><span className="font-semibold text-ink-600">{formatKES(p.costPrice)}</span></span>
                    <span><span className="text-ink-400">Retail: </span><span className="font-display font-bold text-moss-700">{formatKES(p.sellingPrice)}</span></span>
                  </div>
                  <span className={`font-semibold ${p.stock <= (p.lowStockThreshold ?? 5) ? 'text-rust-600' : 'text-ink-700'}`}>{p.stock} in stock {p.stock <= (p.lowStockThreshold ?? 5) ? '⚠️' : ''}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Cat.</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Retail</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3 w-16"></th></tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filtered.map((p) => (
                    <tr key={p.id} className={p.stock <= (p.lowStockThreshold ?? 5) ? 'bg-rust-50/40' : ''}>
                      <td className="px-4 py-3 font-semibold text-ink-800">{p.name}</td>
                      <td className="px-4 py-3 text-ink-500">{p.category}</td>
                      <td className="px-4 py-3 text-ink-500">{formatKES(p.costPrice)}</td>
                      <td className="px-4 py-3 font-semibold text-moss-700">{formatKES(p.sellingPrice)}</td>
                      <td className="px-4 py-3"><span className={p.stock <= (p.lowStockThreshold ?? 5) ? 'font-bold text-rust-600' : 'text-ink-700'}>{p.stock}</span></td>
                      <td className="px-4 py-3 text-ink-500">{suppName(p.supplierId)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button className="rounded p-1.5 text-ink-400 hover:bg-ink-100" onClick={() => { setEditing(p); setPrefillBarcode(null); setModal(true); }}><Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /></button>
                          <button className="rounded p-1.5 text-rust-400 hover:bg-rust-50" onClick={() => setPendingDel(p)}><Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!scanFoundProduct} onClose={() => setScanFoundProduct(null)} title="Barcode already registered" widthClass="max-w-xs">
        <p className="text-sm text-ink-500 mb-4">This barcode already belongs to <span className="font-semibold text-ink-800">{scanFoundProduct?.name}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setScanFoundProduct(null)}>Cancel</button>
          <button className="btn-primary" onClick={() => { setEditing(scanFoundProduct); setPrefillBarcode(null); setScanFoundProduct(null); setModal(true); }}>View Product</button>
        </div>
      </Modal>

      <ProductFormModal open={modal} onClose={closeFormModal} onSave={handleSave} suppliers={suppliers} initialProduct={editing} prefillBarcode={prefillBarcode} onAddSupplier={() => setSupplierModal(true)} newSupplierId={newSupplierId} productCount={products.length} />
      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
      <ConfirmDialog open={!!pendingDel} title="Archive this product?" message={`"${pendingDel?.name}" will be moved to Archived Data. You can restore it later from Settings.`} confirmLabel={deleting ? "Archiving..." : "Archive"} confirmDisabled={deleting} danger onConfirm={handleDel} onCancel={() => setPendingDel(null)} />
    </div>
  );
}
````

## File: src/pages/Purchases.jsx
````javascript
import { useEffect, useMemo, useState } from 'react';
import { doc, writeBatch, increment, serverTimestamp, orderBy, where, limit, addDoc, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct } from '../utils/products';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES } from '../utils/currency';
import { formatDateTime } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

const empty = { supplierId: '', productId: '', quantity: '', costPricePerUnit: '', paymentStatus: 'paid', paymentMethod: 'Cash', mpesaCode: '' };

export default function Purchases() {
  const { profile, businessId } = useAuth();
  const productsQ = useMemo(() => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null), [businessId]);
  const suppliersQ = useMemo(() => (businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null), [businessId]);
  const purchasesQ = useMemo(() => (businessId ? tenantQuery('purchases', businessId, orderBy('purchasedAt', 'desc'), limit(50)) : null), [businessId]);

  const { data: products } = useFirestoreCollection(productsQ);
  const { data: suppliers, refetch: refetchSuppliers } = useFirestoreCollection(suppliersQ);
  const { data: purchases, loading } = useFirestoreCollection(purchasesQ);

  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  useEffect(() => {
    if (newSupplierId) setForm((p) => ({ ...p, supplierId: newSupplierId }));
  }, [newSupplierId]);

  const selProd = products.find((p) => p.id === form.productId);
  const selSupp = suppliers.find((s) => s.id === form.supplierId);
  const totalCost = (Number(form.quantity) || 0) * (Number(form.costPricePerUnit) || 0);

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) {
      setForm((p) => ({ ...p, productId: found.id, costPricePerUnit: found.costPrice || p.costPricePerUnit }));
      toast.success(`Selected ${found.name}`);
    } else {
      setPrefillBarcode(code);
      setProductModal(true);
    }
  };

  useHardwareScanner(handleScanDetected, { enabled: !productModal && !supplierModal && !scannerOpen });

  const handle = async (e) => {
    e.preventDefault();
    if (!form.supplierId) {
      toast.error('Please select a supplier.');
      return;
    }
    if (!form.productId) {
      toast.error('Please select a product.');
      return;
    }
    if (!form.quantity || !form.costPricePerUnit) {
      toast.error('Enter quantity and cost price.');
      return;
    }
    if (form.paymentStatus === 'paid' && form.paymentMethod === 'M-Pesa' && !form.mpesaCode.trim()) {
      toast.error('Enter M-Pesa transaction code.');
      return;
    }

    setBusy(true);
    try {
      const qty = Number(form.quantity);
      const cost = Number(form.costPricePerUnit);
      const total = qty * cost;
      const batch = writeBatch(db);

      // Links the selected supplier to the product
      const productRef = doc(db, 'products', form.productId);
      const productUpdates = {
        stock: increment(qty),
        costPrice: cost,
        updatedAt: serverTimestamp(),
      };
      if (form.supplierId) {
        productUpdates.supplierId = form.supplierId;
      }
      batch.update(productRef, productUpdates);

      const purchRef = doc(collection(db, 'purchases'));
      batch.set(
        purchRef,
        withBusiness(
          {
            supplierId: form.supplierId,
            supplierName: selSupp?.name || '',
            productId: form.productId,
            productName: selProd?.name || '',
            quantity: qty,
            costPricePerUnit: cost,
            totalCost: total,
            purchasedBy: profile.uid,
            purchasedByName: profile.displayName,
            purchasedAt: new Date(),
            paymentStatus: form.paymentStatus === 'paid' ? 'paid' : 'pending_supplier_credit',
            paymentMethod: form.paymentStatus === 'paid' ? form.paymentMethod : null,
            mpesaCode: form.paymentStatus === 'paid' && form.paymentMethod === 'M-Pesa' ? form.mpesaCode.trim() : null,
          },
          businessId
        )
      );

      const commit = batch.commit();
      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;

      toast.success(queuedOffline ? "Purchase queued offline — it'll sync soon." : 'Purchase recorded and stock updated');
      if (queuedOffline) commit.catch((err) => toast.error(`A purchase from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));

      setForm(empty);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); throw error; }
    if (!queuedOffline) {
      setNewSupplierId(ref.id);
      await refetchSuppliers();
    }
    setSupplierModal(false);
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Supplier added');
  };

  const hasSuppliers = suppliers && suppliers.length > 0;
  const hasProducts = products && products.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Record Purchase</h1>
      <form onSubmit={handle} className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={form.supplierId} onChange={set('supplierId')} required>
              <option value="" disabled>{hasSuppliers ? '— Select Supplier —' : '— None (No Suppliers) —'}</option>
              {hasSuppliers && suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button type="button" className="mt-2 text-sm font-semibold text-moss-700 hover:underline" onClick={() => setSupplierModal(true)}>+ Add new supplier</button>
          </div>
          <div>
            <label className="label">Product</label>
            <select className="input" value={form.productId} onChange={set('productId')} required>
              <option value="" disabled>{hasProducts ? '— Select Product —' : '— None (No Products) —'}</option>
              {hasProducts && products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="button" className="mt-2 text-sm font-semibold text-moss-700 hover:underline" onClick={() => { setPrefillBarcode(null); setProductModal(true); }}>+ Add new product</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Qty received</label>
            <input type="number" min="1" className="input" value={form.quantity} onChange={set('quantity')} required />
          </div>
          <div>
            <label className="label">Cost / unit (KES)</label>
            <input type="number" min="0" step="0.01" className="input" value={form.costPricePerUnit} onChange={set('costPricePerUnit')} required />
          </div>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">
          Total cost: <span className="font-semibold text-ink-900">{formatKES(totalCost)}</span>
        </div>
        <div>
          <label className="label">Payment status</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setForm((p) => ({ ...p, paymentStatus: 'paid' }))} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.paymentStatus === 'paid' ? 'border-moss-600 bg-moss-50 text-moss-800' : 'border-ink-200 text-ink-500'}`}>Paid now</button>
            <button type="button" onClick={() => setForm((p) => ({ ...p, paymentStatus: 'credit' }))} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.paymentStatus === 'credit' ? 'border-rust-500 bg-rust-50 text-rust-700' : 'border-ink-200 text-ink-500'}`}>On credit</button>
          </div>
        </div>
        {form.paymentStatus === 'paid' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Paid via</label>
              <select className="input" value={form.paymentMethod} onChange={set('paymentMethod')}>
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
              </select>
            </div>
            {form.paymentMethod === 'M-Pesa' && (
              <div>
                <label className="label">M-Pesa code</label>
                <input className="input uppercase" value={form.mpesaCode} onChange={set('mpesaCode')} placeholder="e.g. QWE1234567" required />
              </div>
            )}
          </div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Record purchase'}
        </button>
      </form>
      <h2 className="font-display text-sm font-bold text-ink-800">Recent purchases</h2>

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <ProductFormModal
        open={productModal}
        onClose={() => { setProductModal(false); setPrefillBarcode(null); }}
        prefillSupplierId={form.supplierId || null}
        onSave={async (data) => {
          try {
            const { id, queuedOffline } = await createProduct(data, businessId);
            setForm((p) => ({
              ...p,
              productId: id,
              supplierId: data.supplierId || p.supplierId || '',
              costPricePerUnit: data.costPrice || p.costPricePerUnit,
            }));
            setProductModal(false);
            setPrefillBarcode(null);
            toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product added and selected');
          } catch (err) {
            toast.error(friendlyErrorMessage(err));
            throw err;
          }
        }}
        suppliers={suppliers}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
        simplifiedForPurchase
      />
      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
      {loading ? (
        <LoadingSpinner />
      ) : purchases.length === 0 ? (
        <EmptyState title="No purchases yet" />
      ) : (
        <div className="card divide-y divide-ink-100">
          {purchases.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
              <div>
                <p className="font-medium text-ink-700">{p.quantity} × {p.productName}</p>
                <p className="text-xs text-ink-400">{p.supplierName || 'Supplier'} · {formatDateTime(p.purchasedAt)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink-800">{formatKES(p.totalCost)}</p>
                <span className={`badge ${p.paymentStatus === 'paid' ? 'bg-moss-100 text-moss-700' : 'bg-rust-100 text-rust-700'}`}>
                  {p.paymentStatus === 'paid' ? 'Paid' : 'On credit'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
````

## File: src/pages/Setup.jsx
````javascript
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, collection, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_CATEGORIES = ['Beverages', 'Hardware', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other'];
const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

export default function Setup() {
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const creatingRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (firebaseUser && profile?.businessId && !creatingRef.current) {
      navigate(profile.role === 'owner' ? '/dashboard' : '/counter', { replace: true });
    }
  }, [firebaseUser, profile, authLoading, navigate]);

  const [businessName, setBusinessName] = useState('');
  const [displayName, setDisplayName]   = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!businessName.trim()) { setError('Enter your business name.'); return; }
    if (!displayName.trim()) { setError('Enter your name.'); return; }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must include at least one uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError('Password must include at least one lowercase letter.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must include at least one number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    creatingRef.current = true;

    let targetUser = null;

    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      targetUser = cred.user;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        try {
          const signInCred = await signInWithEmailAndPassword(auth, email.trim(), password);
          const existingProfileSnap = await getDoc(doc(db, 'users', signInCred.user.uid));
          if (existingProfileSnap.exists() && existingProfileSnap.data()?.businessId) {
            setError('An account with this email already exists. Please sign in instead.');
            creatingRef.current = false;
            setSubmitting(false);
            return;
          }
          targetUser = signInCred.user;
        } catch {
          setError('An account with this email already exists. Please sign in or use another email.');
          creatingRef.current = false;
          setSubmitting(false);
          return;
        }
      } else {
        const message =
          err.code === 'auth/invalid-email' ? 'Please enter a valid email address.' :
          err.code === 'auth/weak-password'  ? 'Password is too weak. Please choose a stronger password.' :
          'Could not create your account. Please try again.';
        setError(message);
        creatingRef.current = false;
        setSubmitting(false);
        return;
      }
    }

    if (!targetUser) {
      setError('Failed to authenticate. Please try again.');
      creatingRef.current = false;
      setSubmitting(false);
      return;
    }

    const businessId = doc(collection(db, 'businesses')).id;

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'businesses', businessId), {
        name: businessName.trim(),
        ownerIds: [targetUser.uid],
        createdAt: serverTimestamp(),
        createdBy: targetUser.uid,
        subscription: { plan: 'free', status: 'active', expiresAt: null },
      });
      batch.set(doc(db, 'users', targetUser.uid), {
        uid: targetUser.uid,
        email: email.trim(),
        displayName: displayName.trim(),
        role: 'owner',
        businessId,
        active: true,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'businessSettings', businessId), {
        businessId,
        shopName: businessName.trim(),
        cashierCanRecordExpenses: true,
        categories: DEFAULT_CATEGORIES,
      });
      await batch.commit();
    } catch (err) {
      console.error('[FlowBiz] Business setup write failed:', err.code || err.name, err.message);
      setError('Something went wrong setting up your business records. Please try again.');
      creatingRef.current = false;
      setSubmitting(false);
      return;
    }

    try {
      const idToken = await targetUser.getIdToken(true);
      const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error('worker-send-failed');
      toast.success(`Welcome to FlowBiz, ${displayName.trim()}! Please check your email to verify your account.`);
    } catch (err) {
      console.warn('[FlowBiz] Worker email send failed, attempting direct send:', err.message);
      try {
        await sendEmailVerification(targetUser);
        toast.success(`Welcome to FlowBiz, ${displayName.trim()}! Check your email to verify.`);
      } catch {
        toast.success(`Welcome to FlowBiz, ${displayName.trim()}!`);
      }
    }

    setSubmitting(false);
    navigate('/', { replace: true });
  };

  if (authLoading && !creatingRef.current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Create your business</h1>
            <p className="text-sm text-ink-400">Set up FlowBiz in under a minute.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
          <div>
            <label className="label">Business name</label>
            <input className="input" required value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="e.g. Nairobi Smart Retail" disabled={submitting} />
          </div>
          <div>
            <label className="label">Your name</label>
            <input className="input" required value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="e.g. John Kamau" disabled={submitting} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@yourbusiness.co.ke" autoComplete="username" disabled={submitting} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 chars (upper, lower, number)" autoComplete="new-password" disabled={submitting} />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input type="password" className="input" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat password" autoComplete="new-password" disabled={submitting} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Setting up…' : 'Create business'}
          </button>
        </form>
        <p className="text-center text-sm text-ink-400">
          Already have an account? <Link to="/login" className="font-semibold text-moss-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
````

## File: src/pages/Counter.jsx
````javascript
// src/pages/Counter.jsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { doc, addDoc, writeBatch, increment, serverTimestamp, orderBy, where, limit, getDoc, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import {
  Trash2, ShoppingCart, Banknote, Smartphone, BookOpen, Printer, Download,
  MessageCircle, CheckCircle2, X, Plus, Minus, ArrowUpRight
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDailySession } from '../hooks/useDailySession';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct } from '../utils/products';
import { printReceipt, generateReceiptPDF, printInvoice, generateInvoicePDF, sendWhatsAppDocument } from '../utils/documentService';
import { getOrCreateShareLink } from '../utils/documentSharing';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import ProductGrid from '../components/pos/ProductGrid';
import CartList from '../components/pos/CartList';
import CartCheckoutModal from '../components/pos/CartCheckoutModal';
import SaleCompleteModal from '../components/pos/SaleCompleteModal';
import OpenSessionPrompt from '../components/pos/OpenSessionPrompt';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES, roundMoney } from '../utils/currency';
import { formatDateTime } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

// ── Everything below this line down to the component itself is 100%
// unchanged business logic — no Firestore calls, no auth handling, and
// no data flow were touched in this pass. Only the JSX returned at the
// bottom (the desktop layout) was reworked. ──────────────────────────

function toLineItem(cartRow) {
  const quantity = Number(cartRow.quantity) || 0;
  const unitPrice = Number(cartRow.unitPrice) || 0;
  const costPrice = Number(cartRow.costPrice) || 0;
  const lineTotal = roundMoney(quantity * unitPrice);
  const lineCost = roundMoney(quantity * costPrice);
  return {
    productId: cartRow.productId,
    productName: cartRow.productName,
    quantity,
    unitPrice,
    costPrice,
    lineTotal,
    lineCost,
    lineProfit: roundMoney(lineTotal - lineCost),
    barcode: cartRow.barcode || null,
  };
}

function summarizeProductName(lineItems) {
  if (lineItems.length === 1) return lineItems[0].productName;
  return `${lineItems[0].productName} +${lineItems.length - 1} more`;
}

export default function Counter() {
  const { profile, isAdmin, isPro, businessId } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();

  const productsQ = useMemo(() => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null), [businessId]);
  const customersQ = useMemo(() => (businessId ? tenantQuery('customers', businessId, orderBy('name')) : null), [businessId]);
  const salesQ = useMemo(() => (businessId ? tenantQuery('sales', businessId, orderBy('soldAt', 'desc'), limit(100)) : null), [businessId]);
  const creditSalesQ = useMemo(() => (businessId ? tenantQuery('creditSales', businessId, orderBy('soldAt', 'desc'), limit(100)) : null), [businessId]);
  const suppliersQ = useMemo(() => (businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null), [businessId]);

  const { data: products, loading: prodLoading } = useFirestoreCollection(productsQ);
  const { data: customers } = useFirestoreCollection(customersQ);
  const { data: sales, loading: salesLoading } = useFirestoreCollection(salesQ);
  const { data: creditSales, loading: creditLoading } = useFirestoreCollection(creditSalesQ);
  const { data: suppliers, refetch: refetchSuppliers } = useFirestoreCollection(suppliersQ);
  const { session, loading: sessLoading, isClosed, openSession, reopenSession } = useDailySession();

  const [search, setSearch] = useState('');

  // Cart State
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);

  // Desktop In-Place Checkout & Direct Document State
  const [desktopMethod, setDesktopMethod] = useState('Cash');
  const [desktopMpesaCode, setDesktopMpesaCode] = useState('');
  const [desktopCustomerId, setDesktopCustomerId] = useState('');
  const [desktopNewMode, setDesktopNewMode] = useState(false);
  const [desktopNewName, setDesktopNewName] = useState('');
  const [desktopNewPhone, setDesktopNewPhone] = useState('');
  const [desktopSubmitting, setDesktopSubmitting] = useState(false);
  const [desktopLastSale, setDesktopLastSale] = useState(null);
  const [desktopCustomerPhone, setDesktopCustomerPhone] = useState('');
  const [desktopSendingWhatsApp, setDesktopSendingWhatsApp] = useState(false);

  const [pendingVoid, setPendingVoid] = useState(null);
  const [prodModal, setProdModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState(null);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    if (location.state?.autoScan && session && !isClosed) {
      setScannerOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, session, isClosed]);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search.trim())) ||
      (p.internalCode && p.internalCode.toLowerCase().includes(search.toLowerCase()))
  );

  const cartQuantities = useMemo(
    () => Object.fromEntries(cart.map((item) => [item.productId, item.quantity])),
    [cart]
  );

  const mergedSales = useMemo(() => {
    const list = [];
    sales.forEach((s) => { list.push({ ...s, isCredit: false, paymentType: s.paymentMethod || 'Cash' }); });
    creditSales.forEach((cs) => { list.push({ ...cs, isCredit: true, paymentType: 'Credit' }); });
    return list.sort((a, b) => {
      const aTime = a.soldAt?.toMillis?.() ?? a.soldAt?.toDate?.()?.getTime?.() ?? new Date(a.soldAt || 0).getTime();
      const bTime = b.soldAt?.toMillis?.() ?? b.soldAt?.toDate?.()?.getTime?.() ?? new Date(b.soldAt || 0).getTime();
      return bTime - aTime;
    }).slice(0, 100);
  }, [sales, creditSales]);

  // Cart operations
  const addToCart = (product, qty = 1) => {
    if (!product) return;
    if ((product.stock || 0) <= 0) {
      toast.error(`${product.name} is out of stock.`);
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.productId === product.id);
      if (idx >= 0) {
        const nextQty = (Number(prev[idx].quantity) || 0) + qty;
        if (nextQty > product.stock) {
          toast.error(`Only ${product.stock} of ${product.name} in stock.`);
          return prev;
        }
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: nextQty };
        return next;
      }
      if (qty > product.stock) {
        toast.error(`Only ${product.stock} of ${product.name} in stock.`);
        return prev;
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: qty,
          unitPrice: product.sellingPrice,
          costPrice: product.costPrice,
          barcode: product.barcode || null,
        },
      ];
    });
  };

  const updateCartQuantity = (productId, rawQty) => {
    const product = products.find((p) => p.id === productId);
    let qty = parseInt(rawQty, 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (product && qty > product.stock) {
      toast.error(`Only ${product.stock} of ${product.name} in stock.`);
      qty = product.stock;
    }
    if (qty < 1) return;
    setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, quantity: qty } : item)));
  };

  const updateCartPrice = (productId, rawPrice) => {
    let price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) price = 0;
    setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, unitPrice: price } : item)));
  };

  const removeCartItem = (productId) => setCart((prev) => prev.filter((item) => item.productId !== productId));
  const clearCart = () => setCart([]);

  const cartTotal = useMemo(
    () => roundMoney(cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)),
    [cart]
  );
  const cartCost = useMemo(
    () => roundMoney(cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.costPrice) || 0), 0)),
    [cart]
  );
  const cartEstimatedProfit = Math.max(0, cartTotal - cartCost);

  function validateCartAgainstStock() {
    for (const row of cart) {
      const product = products.find((p) => p.id === row.productId);
      if (!product) throw new Error(`${row.productName} is no longer available.`);
      if ((Number(row.quantity) || 0) > product.stock) {
        throw new Error(`Only ${product.stock} of ${row.productName} left in stock.`);
      }
    }
  }

  const handleCartSale = ({ paymentMethod, mpesaCode }) => {
    validateCartAgainstStock();
    const lineItems = cart.map(toLineItem);
    const totalAmount = roundMoney(lineItems.reduce((s, i) => s + i.lineTotal, 0));
    const costOfGoodsSold = roundMoney(lineItems.reduce((s, i) => s + i.lineCost, 0));
    const profit = roundMoney(totalAmount - costOfGoodsSold);
    const quantity = lineItems.reduce((s, i) => s + i.quantity, 0);

    const saleRef = doc(collection(db, 'sales'));
    const saleData = withBusiness(
      {
        items: lineItems,
        productName: summarizeProductName(lineItems),
        quantity,
        totalAmount,
        costOfGoodsSold,
        profit,
        ...(lineItems.length === 1 ? { costPricePerUnit: lineItems[0].costPrice, soldPricePerUnit: lineItems[0].unitPrice } : {}),
        paymentMethod,
        mpesaCode: mpesaCode || null,
        soldBy: profile.uid,
        soldByName: profile.displayName,
        soldAt: new Date(),
        isCredit: false,
        isVoided: false,
      },
      businessId
    );

    const batch = writeBatch(db);
    lineItems.forEach((item) => {
      batch.update(doc(db, 'products', item.productId), { stock: increment(-item.quantity), updatedAt: serverTimestamp() });
    });
    batch.set(saleRef, saleData);

    return { record: { id: saleRef.id, ...saleData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleCartCredit = ({ customerId, customerName, customerPhone }) => {
    validateCartAgainstStock();
    const lineItems = cart.map(toLineItem);
    const totalAmount = roundMoney(lineItems.reduce((s, i) => s + i.lineTotal, 0));
    const costOfGoodsSold = roundMoney(lineItems.reduce((s, i) => s + i.lineCost, 0));
    const quantity = lineItems.reduce((s, i) => s + i.quantity, 0);

    const creditRef = doc(collection(db, 'creditSales'));
    const creditData = withBusiness(
      {
        customerId,
        customerName,
        customerPhone: customerPhone || '',
        items: lineItems,
        productName: summarizeProductName(lineItems),
        quantity,
        totalAmount,
        costOfGoodsSold,
        ...(lineItems.length === 1 ? { costPricePerUnit: lineItems[0].costPrice, soldPricePerUnit: lineItems[0].unitPrice } : {}),
        soldBy: profile.uid,
        soldByName: profile.displayName,
        soldAt: serverTimestamp(),
        status: 'pending',
        amountPaid: 0,
        remainingBalance: totalAmount,
        paymentHistory: [],
        isCredit: true,
      },
      businessId
    );

    const batch = writeBatch(db);
    lineItems.forEach((item) => {
      batch.update(doc(db, 'products', item.productId), { stock: increment(-item.quantity), updatedAt: serverTimestamp() });
    });
    batch.set(creditRef, creditData);

    return { record: { id: creditRef.id, ...creditData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleCreateCustomer = async ({ name, phone }) => {
    const ref = await addDoc(tenantCollection('customers'), withBusiness({ name, phone, email: '', address: '', notes: '', createdAt: serverTimestamp() }, businessId));
    return { id: ref.id, name, phone };
  };

  // In-Place Desktop Checkout (Direct execution on PC screen)
  const handleDesktopCheckout = async () => {
    if (cart.length === 0 || desktopSubmitting) return;
    if (desktopMethod === 'M-Pesa' && !desktopMpesaCode.trim()) {
      toast.error('Enter M-Pesa transaction code.');
      return;
    }
    if (desktopMethod === 'Credit' && !desktopCustomerId && !(desktopNewMode && desktopNewName.trim())) {
      toast.error('Please select or create a customer for credit sales.');
      return;
    }

    setDesktopSubmitting(true);
    try {
      let cId = desktopCustomerId;
      let cName = customers.find((c) => c.id === desktopCustomerId)?.name;
      let cPhone = customers.find((c) => c.id === desktopCustomerId)?.phone;

      if (desktopMethod === 'Credit' && desktopNewMode) {
        const cr = await handleCreateCustomer({ name: desktopNewName.trim(), phone: desktopNewPhone.trim() });
        cId = cr.id;
        cName = cr.name;
        cPhone = cr.phone;
      }

      const { record, commit } =
        desktopMethod === 'Credit'
          ? handleCartCredit({ customerId: cId, customerName: cName, customerPhone: cPhone })
          : handleCartSale({ paymentMethod: desktopMethod, mpesaCode: desktopMethod === 'M-Pesa' ? desktopMpesaCode.trim() : null });

      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;

      if (queuedOffline) {
        toast.success("Sale saved — it'll sync once you're back online.");
        commit.catch((err) => toast.error(`A sale from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      } else {
        toast.success('Sale completed!');
      }

      setDesktopLastSale(record);
      setDesktopCustomerPhone(cPhone || record.customerPhone || '');
      clearCart();
      setDesktopMpesaCode('');
      setDesktopCustomerId('');
      setDesktopNewMode(false);
      setDesktopNewName('');
      setDesktopNewPhone('');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setDesktopSubmitting(false);
    }
  };

  // Direct In-Panel WhatsApp Sender
  const handleDesktopWhatsApp = async () => {
    if (!desktopCustomerPhone.trim()) {
      toast.error('Enter a valid customer phone number.');
      return;
    }
    if (!desktopLastSale) return;
    setDesktopSendingWhatsApp(true);
    try {
      const documentUrl = await getOrCreateShareLink({
        businessId,
        documentType: desktopLastSale.isCredit ? 'invoice' : 'receipt',
        documentId: desktopLastSale.id,
        createdBy: profile?.uid,
      });
      sendWhatsAppDocument(desktopLastSale, settings, desktopCustomerPhone.trim(), documentUrl);
      toast.success('WhatsApp opened.');
    } catch (err) {
      toast.error(err.message || 'Could not send WhatsApp receipt.');
    } finally {
      setDesktopSendingWhatsApp(false);
    }
  };

  const handleCheckoutClose = (record) => {
    setCheckoutOpen(false);
    if (record && record.id) {
      setCompletedSale(record);
      setDesktopLastSale(record);
      setDesktopCustomerPhone(record.customerPhone || '');
      clearCart();
    }
  };

  const handleVoid = async () => {
    const sale = pendingVoid;
    setVoiding(true);
    try {
      const lineItems = Array.isArray(sale.items) && sale.items.length > 0 ? sale.items : [{ productId: sale.productId, quantity: sale.quantity }];
      const targets = lineItems.filter((item) => item.productId);
      const snaps = await Promise.all(targets.map((item) => getDoc(doc(db, 'products', item.productId))));

      const batch = writeBatch(db);
      let anyProductMissing = false;
      targets.forEach((item, idx) => {
        if (snaps[idx].exists()) {
          batch.update(doc(db, 'products', item.productId), { stock: increment(item.quantity), updatedAt: serverTimestamp() });
        } else {
          anyProductMissing = true;
        }
      });

      batch.update(doc(db, 'sales', sale.id), { isVoided: true, voidedAt: serverTimestamp(), voidedBy: profile.uid });

      const { queuedOffline, error } = await raceWithTimeout(batch.commit(), 4000);
      if (error) throw error;

      toast.success(queuedOffline ? 'Sale voided offline.' : anyProductMissing ? 'Sale voided (some deleted products not restored).' : 'Sale voided and stock restored.');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setVoiding(false);
      setPendingVoid(null);
    }
  };

  const handleProductSave = async (data) => {
    try {
      const { id, queuedOffline } = await createProduct(data, businessId);
      toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product added');
      if (prefillBarcode !== null && !queuedOffline) {
        addToCart({ id, name: data.name, sellingPrice: data.sellingPrice, costPrice: data.costPrice, stock: data.stock ?? 0, barcode: data.barcode || null }, 1);
      }
      setProdModal(false);
      setPrefillBarcode(null);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
      throw err;
    }
  };

  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) {
      toast.error(friendlyErrorMessage(error));
      throw error;
    }
    if (!queuedOffline) {
      setNewSupplierId(ref.id);
      await refetchSuppliers();
    }
    setSupplierModal(false);
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Supplier added');
  };

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) {
      addToCart(found, 1);
      toast.success(`${found.name} added to cart`, { duration: 1200 });
    } else {
      setNotFoundCode(code);
    }
  };

  useHardwareScanner(handleScanDetected, {
    enabled: !!session && !isClosed && !prodModal && !supplierModal && !scannerOpen && !notFoundCode && !completedSale && !checkoutOpen,
  });

  if (sessLoading) return <LoadingSpinner label="Loading today's session…" />;
  if (isClosed) {
    return (
      <div className="mx-auto max-w-sm pt-8 space-y-4 text-center">
        <EmptyState title="Today's session is closed" description="Sales are locked. An owner can reopen to continue trading." />
        {isAdmin && <button className="btn-primary w-full" onClick={reopenSession}>Reopen session</button>}
      </div>
    );
  }
  if (!session) return <OpenSessionPrompt onOpen={(floats) => openSession({ ...floats, openedBy: profile.uid })} />;

  // Display-only helper for the desktop post-sale panel — mirrors the
  // same items[] check SaleCompleteModal already uses for the mobile
  // receipt, so a multi-product cart is itemized instead of collapsed
  // into "Product A +2 more". Reads only; nothing is written here.
  const desktopSaleItems =
    desktopLastSale && Array.isArray(desktopLastSale.items) && desktopLastSale.items.length > 1
      ? desktopLastSale.items
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Counter</h1>
          <p className="text-sm text-ink-400">Scan a barcode, search, or click a product to add it to the sale.</p>
        </div>
      </div>

      {/* Desktop gets a fixed-width checkout column so it never gets
          squeezed by the product grid; mobile is untouched (single
          column, cart pinned to the top). */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_336px] xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-6">

        {/* LEFT: product catalog + sales log */}
        <div className="min-w-0 space-y-4">

          {/* Mobile-only cart bar, pinned to the top of the screen */}
          <div className="sticky top-2 z-20 lg:hidden">
            <CartList
              cart={cart}
              onUpdateQuantity={updateCartQuantity}
              onUpdatePrice={updateCartPrice}
              onRemove={removeCartItem}
              onClear={clearCart}
              onCheckout={() => setCheckoutOpen(true)}
            />
          </div>

          <input
            className="input"
            placeholder="Search products by name, category, or barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {prodLoading ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <EmptyState title="No products match" description="Try another search keyword or scan a barcode." />
          ) : (
            <ProductGrid products={filtered} onSelect={(product) => addToCart(product, 1)} isAdmin={false} cartQuantities={cartQuantities} />
          )}

          {isAdmin && (
            <div className="mt-6 space-y-2 border-t border-ink-100 pt-4">
              <h2 className="font-display text-sm font-bold text-ink-800">Sales log (last 100)</h2>
              {salesLoading || creditLoading ? (
                <LoadingSpinner />
              ) : mergedSales.length === 0 ? (
                <EmptyState title="No sales recorded" />
              ) : (
                <div className="card max-h-96 divide-y divide-ink-100 overflow-y-auto">
                  {mergedSales.map((s) => (
                    <div key={s.id} className={`flex items-center justify-between px-4 py-3 text-sm ${s.isVoided ? 'opacity-40 line-through' : ''}`}>
                      <div>
                        <p className="font-medium text-ink-700">
                          {s.quantity} × {s.productName} — {formatKES(s.totalAmount)}
                          {Array.isArray(s.items) && s.items.length > 1 && (
                            <span className="badge ml-2 bg-ink-100 text-ink-500 align-middle">{s.items.length} products</span>
                          )}
                        </p>
                        <p className="text-xs text-ink-400">
                          {s.paymentType === 'Credit' ? `Credit (${s.customerName})` : s.paymentMethod}
                          {s.mpesaCode ? ` (${s.mpesaCode})` : ''} · {formatDateTime(s.soldAt)} · {s.soldByName || 'Staff'}
                        </p>
                      </div>
                      {!s.isVoided && !s.isCredit && isAdmin && (
                        <button onClick={() => setPendingVoid(s)} className="flex min-h-[44px] min-w-[44px] items-center justify-center p-1 text-rust-400 hover:text-rust-600" title="Void sale">
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      )}
                      {s.isCredit && isAdmin && (
                        <Link to={`/customers/${s.customerId}`} className="btn-outline !min-h-0 !px-2.5 !py-1 text-xs text-ink-500 hover:text-ink-700">
                          View customer
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: desktop-only checkout terminal — hidden below the lg
            breakpoint, so mobile always renders the single-column view
            above with the cart bar and the mobile checkout modal
            further down this file. */}
        <div className="hidden lg:sticky lg:top-4 lg:flex lg:flex-col lg:gap-4">

          <div className="card space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Current order</p>
                <p className="mt-0.5 text-sm font-semibold text-ink-800">
                  {cart.length === 0 ? 'No items yet' : `${cart.length} item${cart.length !== 1 ? 's' : ''} in cart`}
                </p>
              </div>
              {cart.length > 0 && (
                <button type="button" onClick={clearCart} className="text-xs font-semibold text-rust-500 hover:underline">
                  Clear all
                </button>
              )}
            </div>

            <div className="max-h-60 divide-y divide-ink-100 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-ink-200 bg-ink-50 py-8 text-center">
                  <ShoppingCart className="h-5 w-5 text-ink-300" strokeWidth={1.5} />
                  <p className="px-4 text-xs text-ink-400">Select products from the list to add them here.</p>
                </div>
              ) : (
                cart.map((item) => {
                  const lineTotal = roundMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
                  return (
                    <div key={item.productId} className="space-y-1.5 py-2.5 first:pt-0">
                      <div className="flex items-start justify-between gap-1 text-xs">
                        <span className="truncate pr-1 font-semibold leading-snug text-ink-800">{item.productName}</span>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.productId)}
                          className="shrink-0 rounded p-0.5 text-ink-400 hover:text-rust-500"
                          aria-label={`Remove ${item.productName}`}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                            className="flex h-6 w-6 items-center justify-center rounded text-ink-500 hover:bg-ink-50"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" strokeWidth={2} />
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-ink-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                            className="flex h-6 w-6 items-center justify-center rounded text-ink-500 hover:bg-ink-50"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" strokeWidth={2} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-ink-400">
                          <span>@ KES</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateCartPrice(item.productId, e.target.value)}
                            className="w-16 rounded border border-ink-200 px-1.5 py-0.5 text-right text-xs font-bold text-ink-900"
                            aria-label={`Unit price for ${item.productName}`}
                          />
                        </div>
                        <span className="font-display text-sm font-bold text-moss-700">{formatKES(lineTotal)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-2.5 border-t border-ink-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Payment method</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'Cash', label: 'Cash', Icon: Banknote },
                  { id: 'M-Pesa', label: 'M-Pesa', Icon: Smartphone },
                  { id: 'Credit', label: 'Deni', Icon: BookOpen },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDesktopMethod(id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border py-2 text-xs font-semibold ${
                      desktopMethod === id
                        ? 'border-moss-600 bg-moss-50 text-moss-800'
                        : 'border-ink-200 text-ink-500 hover:bg-ink-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    {label}
                  </button>
                ))}
              </div>

              {desktopMethod === 'M-Pesa' && (
                <div className="space-y-1 rounded-lg bg-ink-50 p-2.5">
                  <label className="text-[11px] font-semibold text-ink-600">
                    M-Pesa transaction code <span className="text-rust-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={desktopMpesaCode}
                    onChange={(e) => setDesktopMpesaCode(e.target.value.toUpperCase())}
                    placeholder="e.g. QWE1234567"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold uppercase text-ink-900"
                  />
                </div>
              )}

              {desktopMethod === 'Credit' && (
                <div className="space-y-2 rounded-lg bg-ink-50 p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-ink-600">Customer (Deni)</label>
                    <button
                      type="button"
                      onClick={() => setDesktopNewMode((v) => !v)}
                      className="text-[11px] font-semibold text-moss-700 hover:underline"
                    >
                      {desktopNewMode ? 'Use existing' : '+ New customer'}
                    </button>
                  </div>
                  {!desktopNewMode ? (
                    <select
                      className="input !min-h-0 !py-1.5 text-xs"
                      value={desktopCustomerId}
                      onChange={(e) => setDesktopCustomerId(e.target.value)}
                    >
                      <option value="">— Select customer —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.phone ? ` · ${c.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        className="input !min-h-0 !py-1.5 text-xs"
                        placeholder="Customer name"
                        value={desktopNewName}
                        onChange={(e) => setDesktopNewName(e.target.value)}
                      />
                      <input
                        className="input !min-h-0 !py-1.5 text-xs"
                        placeholder="Phone (07xx...)"
                        value={desktopNewPhone}
                        onChange={(e) => setDesktopNewPhone(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-ink-100 pt-2.5">
                <div>
                  <p className="text-[11px] text-ink-400">Total</p>
                  {cartEstimatedProfit > 0 && (
                    <p className="text-[11px] font-semibold text-moss-700">Margin +{formatKES(cartEstimatedProfit)}</p>
                  )}
                </div>
                <p className="font-display text-xl font-bold text-ink-900">{formatKES(cartTotal)}</p>
              </div>

              <button
                type="button"
                disabled={cart.length === 0 || desktopSubmitting}
                onClick={handleDesktopCheckout}
                className="btn-primary flex w-full items-center justify-center gap-1.5 !py-3"
              >
                <span>{desktopSubmitting ? 'Recording…' : desktopMethod === 'Credit' ? 'Record credit' : 'Complete sale'}</span>
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Post-sale receipt actions — only shown right after a sale
              completes on this screen, same pattern as the mobile
              SaleCompleteModal, just inline instead of a popup. */}
          {desktopLastSale && (
            <div className="card space-y-3 p-4">
              <div className="flex items-center justify-between border-b border-ink-100 pb-2.5">
                <div className="flex items-center gap-1.5 text-moss-700">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                  <span className="text-xs font-semibold">Sale completed</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDesktopLastSale(null)}
                  className="rounded p-1 text-ink-400 hover:text-ink-700"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>

              <div className="space-y-1">
                {desktopSaleItems ? (
                  desktopSaleItems.map((item, idx) => (
                    <div key={item.productId || idx} className="flex items-center justify-between text-xs text-ink-600">
                      <span>{item.quantity} × {item.productName}</span>
                      <span className="font-semibold text-ink-800">
                        {formatKES(item.lineTotal ?? (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-ink-600">{desktopLastSale.productName}</p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-ink-100 pt-2.5 text-sm">
                <span className="font-semibold text-ink-700">
                  {desktopLastSale.isCredit ? 'Amount due' : 'Total paid'}
                </span>
                <span className="font-display font-bold text-ink-900">{formatKES(desktopLastSale.totalAmount)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (desktopLastSale.isCredit) printInvoice(desktopLastSale, settings);
                    else printReceipt(desktopLastSale, settings);
                  }}
                  className="btn-outline !min-h-0 flex items-center justify-center gap-1.5 !py-1.5 text-xs"
                >
                  <Printer className="h-3.5 w-3.5" strokeWidth={1.75} /> Print
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (desktopLastSale.isCredit) generateInvoicePDF(desktopLastSale, settings);
                    else generateReceiptPDF(desktopLastSale, settings);
                  }}
                  className="btn-outline !min-h-0 flex items-center justify-center gap-1.5 !py-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> Download
                </button>
              </div>

              <div className="space-y-1.5 rounded-lg bg-ink-50 p-2.5">
                <label className="text-[11px] font-semibold text-ink-600">
                  WhatsApp {desktopLastSale.isCredit ? 'invoice' : 'receipt'} {!isPro && <span className="text-amber-600">— Pro</span>}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Customer phone (07xx...)"
                    value={desktopCustomerPhone}
                    onChange={(e) => setDesktopCustomerPhone(e.target.value)}
                    className="input !min-h-0 flex-1 !py-1.5 text-xs"
                  />
                  {isPro ? (
                    <button
                      type="button"
                      onClick={handleDesktopWhatsApp}
                      disabled={desktopSendingWhatsApp}
                      className="btn-primary !min-h-0 flex shrink-0 items-center gap-1 !py-1.5 !px-3 text-xs"
                    >
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {desktopSendingWhatsApp ? 'Sending…' : 'Send'}
                    </button>
                  ) : (
                    <Link to="/pro" className="btn-primary !min-h-0 flex shrink-0 items-center gap-1 !py-1.5 !px-3 text-xs">
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} /> Unlock
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Floating & scanner elements */}
      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!notFoundCode} onClose={() => setNotFoundCode(null)} title="Product not found" widthClass="max-w-xs">
        <p className="mb-4 text-sm text-ink-500">
          No product matches barcode <span className="font-mono">{notFoundCode}</span>.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setNotFoundCode(null)}>Cancel</button>
          {isAdmin ? (
            <button
              className="btn-primary"
              onClick={() => {
                setPrefillBarcode(notFoundCode);
                setNotFoundCode(null);
                setProdModal(true);
              }}
            >
              Create product
            </button>
          ) : (
            <span className="self-center text-xs text-ink-400">Ask an owner to add this product.</span>
          )}
        </div>
      </Modal>

      {/* Mobile checkout modal */}
      <CartCheckoutModal
        open={checkoutOpen}
        cart={cart}
        total={cartTotal}
        customers={customers}
        onClose={handleCheckoutClose}
        onConfirmSale={handleCartSale}
        onConfirmCredit={handleCartCredit}
        onCreateCustomer={handleCreateCustomer}
      />

      {/* Mobile sale-complete modal */}
      <SaleCompleteModal open={!!completedSale} sale={completedSale} onClose={() => setCompletedSale(null)} />

      <ProductFormModal
        open={prodModal}
        onClose={() => {
          setProdModal(false);
          setPrefillBarcode(null);
        }}
        onSave={handleProductSave}
        suppliers={suppliers}
        initialProduct={null}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
      />

      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />

      <ConfirmDialog
        open={!!pendingVoid}
        title="Void this sale?"
        message={`Stock for "${pendingVoid?.productName}" will be restored${
          Array.isArray(pendingVoid?.items) && pendingVoid.items.length > 1
            ? ` for all ${pendingVoid.items.length} products in this sale`
            : ` (×${pendingVoid?.quantity})`
        }.`}
        confirmLabel={voiding ? 'Voiding...' : 'Void sale'}
        confirmDisabled={voiding}
        danger
        onConfirm={handleVoid}
        onCancel={() => setPendingVoid(null)}
      />
    </div>
  );
}
````

## File: src/pages/Dashboard.jsx
````javascript
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, addDoc, writeBatch, increment, serverTimestamp, orderBy, where, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDailySession } from '../hooks/useDailySession';
import { useFinancialsForRange } from '../hooks/useFinancials';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct, updateProduct } from '../utils/products';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import SaleModal from '../components/pos/SaleModal';
import SaleCompleteModal from '../components/pos/SaleCompleteModal';
import OpenSessionPrompt from '../components/pos/OpenSessionPrompt';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES } from '../utils/currency';
import { startOfDay, endOfDay, formatDateTime } from '../utils/dateRanges';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

function StatCard({ label, value, tone = 'text-ink-900', sub }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-400">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { profile, isAdmin, businessId, isPro } = useAuth();
  const today = useMemo(() => ({ start: startOfDay(), end: endOfDay() }), []);
  const { loading: financialsLoading, summary, sales, creditSales, expenses, repayments, purchases } = useFinancialsForRange(today.start, today.end);

  const productsQuery = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  
  const customersQuery = useMemo(() => businessId ? tenantQuery('customers', businessId, orderBy('name')) : null, [businessId]);
  const suppliersQuery = useMemo(() => businessId ? tenantQuery('suppliers', businessId) : null, [businessId]); // Removed orderBy('name')
  const { data: products } = useFirestoreCollection(productsQuery);
  const { data: customers } = useFirestoreCollection(customersQuery);
  const { data: rawSuppliers, refetch: refetchSuppliers } = useFirestoreCollection(suppliersQuery);
  const { session, loading: sessionLoading, isClosed, openSession, reopenSession } = useDailySession();
  const [activeProduct, setActiveProduct] = useState(null);
  const [completedSale, setCompletedSale] = useState(null);
  const [editProduct, setEditProd] = useState(null);
  const [prodModal, setProdModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState(null);

  const [privacyMode, setPrivacyMode] = useState(() => {
    try { return localStorage.getItem('flowbiz_dashboard_privacy') === 'true'; }
    catch { return false; }
  });

  // Alphabetically sort suppliers in memory
  const suppliers = useMemo(() => {
    return [...rawSuppliers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [rawSuppliers]);

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => {
      const next = !prev;
      try { localStorage.setItem('flowbiz_dashboard_privacy', String(next)); }
      catch (err) { console.error('Failed to save privacy mode setting', err); }
      return next;
    });
  };

  const formatVal = (val) => (privacyMode ? '••••••••' : formatKES(val));

  const dashboardCashReceived = summary.totalCashReceipts;
  const dashboardMpesaReceived = summary.totalMpesaReceipts;
  const dashboardExpenses = summary.totalExpenses;
  const dashboardNetProfit = summary.netProfit;

  const lowStock = products.filter((p) => p.stock <= (p.lowStockThreshold ?? 5));
  const totalInventoryValue = products.reduce((acc, p) => acc + (p.stock || 0) * (p.costPrice || 0), 0);
  const debtorsQuery = useMemo(() => businessId ? tenantQuery('creditSales', businessId) : null, [businessId]);
  const { data: allCreditSales } = useFirestoreCollection(debtorsQuery);
  const totalOutstanding = allCreditSales.reduce((acc, cs) => acc + (Number(cs.remainingBalance) || 0), 0);

  const recentActivity = useMemo(() => {
    const list = [];
    (sales || []).forEach((s) => {
      if (s.isVoided) return;
      list.push({ id: `sale-${s.id}`, type: 'Sale', title: `${s.quantity} × ${s.productName}`, subtitle: `Sold by ${s.soldByName || 'Staff'}`, amount: s.totalAmount, method: s.paymentMethod, timestamp: s.soldAt, isPositive: true });
    });
    (repayments || []).forEach((r) => {
      list.push({ id: `repayment-${r.id}`, type: 'Debt Repayment', title: `${r.customerName || 'Customer'} — ${r.productName || 'repayment'}`, subtitle: `Recorded by ${r.recordedByName || 'Staff'}`, amount: r.amount, method: r.method, timestamp: r.paidAt, isPositive: true });
    });
    (creditSales || []).forEach((cs) => {
      if (cs.status === 'cancelled' || cs.status === 'refunded') return;
      list.push({
        id: `credit-${cs.id}`, type: 'Credit Sale',
        title: `${cs.quantity} × ${cs.productName}`,
        subtitle: `${cs.customerName || 'Customer'} · Sold by ${cs.soldByName || 'Staff'}`,
        amount: cs.totalAmount, method: 'Credit', timestamp: cs.soldAt, isPositive: false,
      });
    });
    return list.sort((a, b) => {
      const aTime = a.timestamp?.toMillis?.() ?? a.timestamp?.toDate?.()?.getTime?.() ?? new Date(a.timestamp || 0).getTime();
      const bTime = b.timestamp?.toMillis?.() ?? b.timestamp?.toDate?.()?.getTime?.() ?? new Date(b.timestamp || 0).getTime();
      return bTime - aTime;
    }).slice(0, 8);
  }, [sales, repayments, creditSales]);

  const handleCreateCustomer = async ({ name, phone }) => {
    const ref = await addDoc(tenantCollection('customers'), withBusiness({ name, phone, email: '', address: '', notes: '', createdAt: serverTimestamp() }, businessId));
    return { id: ref.id, name, phone };
  };

  const handleConfirmSale = ({ product, quantity, soldPricePerUnit, paymentMethod, mpesaCode }) => {
    const productRef = doc(db, 'products', product.id);
    const saleRef = doc(collection(db, 'sales'));
    const saleData = withBusiness({
      productId: product.id, productName: product.name, quantity,
      costPricePerUnit: product.costPrice, soldPricePerUnit,
      totalAmount: soldPricePerUnit * quantity,
      profit: (soldPricePerUnit - product.costPrice) * quantity,
      paymentMethod, mpesaCode: mpesaCode || null,
      soldBy: profile.uid, soldByName: profile.displayName,
      soldAt: new Date(), isCredit: false, isVoided: false,
    }, businessId);

    const batch = writeBatch(db);
    batch.update(productRef, { stock: increment(-quantity), updatedAt: serverTimestamp() });
    batch.set(saleRef, saleData);

    return { record: { id: saleRef.id, ...saleData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleConfirmCredit = ({ product, quantity, soldPricePerUnit, customerId, customerName, customerPhone }) => {
    const productRef = doc(db, 'products', product.id);
    const totalAmount = soldPricePerUnit * quantity;
    const creditRef = doc(collection(db, 'creditSales'));
    const creditData = withBusiness({
      customerId, customerName, customerPhone: customerPhone || '',
      productId: product.id, productName: product.name, quantity,
      costPricePerUnit: product.costPrice, soldPricePerUnit, totalAmount,
      soldBy: profile.uid, soldByName: profile.displayName, soldAt: serverTimestamp(),
      status: 'pending', amountPaid: 0, remainingBalance: totalAmount, paymentHistory: [],
      isCredit: true
    }, businessId);

    const batch = writeBatch(db);
    batch.update(productRef, { stock: increment(-quantity), updatedAt: serverTimestamp() });
    batch.set(creditRef, creditData);

    return { record: { id: creditRef.id, ...creditData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleProductSave = async (data) => {
    try {
      if (editProduct) {
        const { queuedOffline } = await updateProduct(editProduct.id, data, editProduct.barcode, businessId);
        toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product updated');
      } else {
        const { queuedOffline } = await createProduct(data, businessId);
        toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product added');
      }
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
    finally { setEditProd(null); setProdModal(false); setPrefillBarcode(null); }
  };

  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); throw error; }
    if (!queuedOffline) {
      setNewSupplierId(ref.id);
      await refetchSuppliers();
    }
    setSupplierModal(false);
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Supplier added');
  };

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) setActiveProduct(found);
    else setNotFoundCode(code);
  };

  useHardwareScanner(handleScanDetected, {
    enabled: !!session && !isClosed && !activeProduct && !prodModal && !supplierModal && !scannerOpen && !notFoundCode && !completedSale,
  });

  if (sessionLoading) return <LoadingSpinner label="Loading today's session…" />;

  if (isClosed) {
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <EmptyState title="Day is closed" description="Sales are locked until you reopen the session or tomorrow starts." />
        {isAdmin && <button className="btn-primary w-full" onClick={reopenSession}>Reopen today's session</button>}
      </div>
    );
  }
  if (!session) {
    return <OpenSessionPrompt onOpen={(floats) => openSession({ ...floats, openedBy: profile.uid })} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Hello, {profile?.displayName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-ink-400">{isAdmin ? "Here's how the shop is doing today." : 'Ready to make a sale.'}</p>
          </div>
        </div>
        <button
          onClick={togglePrivacyMode}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-400 hover:bg-ink-100 hover:text-ink-700 shadow-sm transition-colors"
          title={privacyMode ? 'Show sensitive balances' : 'Hide sensitive balances'}
        >
          {privacyMode ? <EyeOff className="h-5 w-5 text-rust-600 animate-fade-in" strokeWidth={1.75} /> : <Eye className="h-5 w-5 text-moss-700 animate-fade-in" strokeWidth={1.75} />}
        </button>
      </div>

      {isAdmin && (
        <>
          {financialsLoading ? <LoadingSpinner /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-in">
              <StatCard label="Cash Received Today" value={formatVal(dashboardCashReceived)} />
              <StatCard label="M-Pesa Received Today" value={formatVal(dashboardMpesaReceived)} />
              <StatCard label="Today's net profit" value={formatVal(dashboardNetProfit)} tone="text-moss-700" />
              <StatCard label="Today's expenses" value={formatVal(dashboardExpenses)} tone="text-rust-600" />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Inventory value (cost)" value={formatVal(totalInventoryValue)} />
            <StatCard label="Outstanding debt (Deni)" value={formatVal(totalOutstanding)} tone="text-rust-600" sub={<Link to="/customers" className="font-semibold text-moss-700 hover:underline">View customers</Link>} />
            <StatCard label="Low stock items" value={lowStock.length} tone={lowStock.length > 0 ? 'text-rust-600' : 'text-moss-700'} sub={<Link to="/products" className="font-semibold text-moss-700 hover:underline">View products</Link>} />
          </div>
        </>
      )}

      <div>
        <h2 className="font-display text-sm font-bold text-ink-800 mb-2">Today's Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-400">No activity recorded today yet.</div>
        ) : (
          <div className="card divide-y divide-ink-100">
            {recentActivity.map((act) => (
              <div key={act.id} className="flex items-center justify-between p-3 text-sm">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-ink-800 truncate">{act.title}</p>
                    <span className="badge bg-moss-100 text-moss-800">{act.type}</span>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">{act.method} · {formatDateTime(act.timestamp)}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-semibold text-moss-700">+{formatVal(act.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SaleModal 
        open={!!activeProduct} 
        product={activeProduct} 
        customers={customers} 
        onClose={(record) => {
          setActiveProduct(null);
          if (record && record.id) setCompletedSale(record);
        }} 
        onConfirmSale={handleConfirmSale} 
        onConfirmCredit={handleConfirmCredit} 
        onCreateCustomer={handleCreateCustomer} 
      />
      <SaleCompleteModal open={!!completedSale} sale={completedSale} onClose={() => setCompletedSale(null)} />

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!notFoundCode} onClose={() => setNotFoundCode(null)} title="Product not found" widthClass="max-w-xs">
        <p className="text-sm text-ink-500 mb-4">No product matches barcode <span className="font-mono">{notFoundCode}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setNotFoundCode(null)}>Cancel</button>
          {isAdmin ? (
            <button className="btn-primary" onClick={() => { setEditProd(null); setPrefillBarcode(notFoundCode); setNotFoundCode(null); setProdModal(true); }}>Create Product</button>
          ) : (
            <span className="self-center text-xs text-ink-400">Ask an owner to add this product.</span>
          )}
        </div>
      </Modal>

      <ProductFormModal
        open={prodModal}
        onClose={() => { setProdModal(false); setEditProd(null); setPrefillBarcode(null); }}
        onSave={handleProductSave}
        suppliers={suppliers}
        initialProduct={editProduct}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
      />
      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
    </div>
  );
}
````

## File: src/pages/Settings.jsx
````javascript
import { useEffect, useMemo, useState, useRef } from 'react'; // Added useRef import
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { resetBusinessData } from '../utils/businessReset';
import { restoreProduct, permanentlyDeleteProduct } from '../utils/products';
import { isDemoMode } from '../demo/demoMode';
import { resetDemoData } from '../demo/seedData';
import { formatDateTime } from '../utils/dateRanges';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal'; 
import { raceWithTimeout } from '../utils/offlineWrite';
import { buildExportZip } from '../utils/dataExport';
import { readExportZip, checkExistingData, importBusinessData } from '../utils/dataImport';

const RESET_CONFIRM_PHRASE = 'RESET';
const DELETE_ACCOUNT_CONFIRM_PHRASE = 'DELETE';

export default function Settings() {
  const { profile, businessId, emailVerified, listBusinessSessions, revokeSession, currentSessionId, isPro, deleteOwnAccount } = useAuth();
  const demo = isDemoMode();
  const [loading, setLoading]     = useState(true);
  
  const [shopName, setShopName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [address, setAddress]     = useState('');
  const [logoFile, setLogoFile]   = useState(null);
  const [logoUrl, setLogoUrl]     = useState('');
  const [cashierExp, setCashierExp] = useState(true);
  
  const [saving, setSaving]       = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [otherOwnersCount, setOtherOwnersCount] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);

  const fileInputRef = useRef(null);
  const [checkingImport, setCheckingImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [pendingImport, setPendingImport] = useState(null); // { manifest, nonEmptyCollections, fileName }
  const [importConfirmChecked, setImportConfirmChecked] = useState(false);

  const handleImportFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setCheckingImport(true);
    try {
      const manifest = await readExportZip(file);
      const nonEmptyCollections = await checkExistingData(businessId, manifest);
      setPendingImport({ manifest, nonEmptyCollections, fileName: file.name });
      setImportConfirmChecked(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckingImport(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    setImporting(true);
    setImportProgress(null);
    try {
      const results = await importBusinessData(businessId, pendingImport.manifest, {
        onProgress: (name, i, total) => setImportProgress(`${name} (${i + 1}/${total})`),
      });
      const totalDocs = Object.values(results).reduce((a, b) => a + b, 0);
      toast.success(`Import complete — ${totalDocs} record(s) restored.`);
      setPendingImport(null);
    } catch (err) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(null);
    try {
      const blob = await buildExportZip(businessId, {
        onProgress: (name, i, total) => setExportProgress(`${name} (${i + 1}/${total})`),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `flowbiz-export-${businessId}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Export downloaded.');
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const deviceGroups = useMemo(() => {
    const groups = new Map();
    for (const s of sessions) {
      const key = `${s.deviceLabel || 'Unknown device'}|${s.userAgent || ''}`;
      const lastActiveMs = s.lastActiveAt?.toMillis ? s.lastActiveAt.toMillis() : (s.lastActiveAt ? new Date(s.lastActiveAt).getTime() : 0);
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { key, deviceLabel: s.deviceLabel, lastUserName: s.lastUserName, lastActiveMs, ids: [s.id], anyActive: s.revoked !== true });
      } else {
        existing.ids.push(s.id);
        if (s.revoked !== true) existing.anyActive = true;
        if (lastActiveMs > existing.lastActiveMs) {
          existing.lastActiveMs = lastActiveMs;
          existing.lastUserName = s.lastUserName;
        }
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.lastActiveMs - a.lastActiveMs);
  }, [sessions]);

  const [archived, setArchived] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const settingsRef = useMemo(() => (businessId ? doc(db, 'businessSettings', businessId) : null), [businessId]);

  function compressImage(file, maxDimension = 480, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Could not process image.')); return; }
          resolve(blob);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image file.')); };
      img.src = url;
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  useEffect(() => {
    if (!settingsRef) {
      setLoading(false);
      return;
    }
    getDoc(settingsRef).then((snap) => {
      if (snap.exists()) { 
        const d = snap.data(); 
        setShopName(d.shopName || ''); 
        setPhone(d.phone || '');
        setEmail(d.email || '');
        setAddress(d.address || '');
        setLogoUrl(d.logoUrl || '');
        setCashierExp(d.cashierCanRecordExpenses !== false); 
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [settingsRef]);

  useEffect(() => {
    if (!businessId) {
      setSessionsLoading(false);
      return;
    }
    listBusinessSessions().then(setSessions).finally(() => setSessionsLoading(false));
  }, [businessId, listBusinessSessions]);

  const loadArchived = async () => {
    if (!businessId) return;
    setArchivedLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'products'), where('businessId', '==', businessId), where('deleted', '==', true)));
      setArchived(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setArchivedLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault(); 
    if (!settingsRef) return;
    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;

      if (logoFile) {
        try {
          const compressed = await compressImage(logoFile, 480, 0.75);
          if (compressed.size > 700 * 1024) {
            toast.error('Logo is still too large after compression, try a simpler image.');
          } else {
            finalLogoUrl = await blobToDataUrl(compressed);
          }
        } catch (logoErr) {
          toast.error(`Logo processing failed, but the rest of your settings will still be saved: ${logoErr.message}`);
        }
      }

      const write = setDoc(settingsRef, { 
        shopName: shopName.trim(), 
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        logoUrl: finalLogoUrl,
      }, { merge: true });

      const { queuedOffline, error } = await raceWithTimeout(write, 4000);
      if (error) throw error;

      setLogoUrl(finalLogoUrl);
      toast.success(queuedOffline ? "Saved, it'll sync once you're back online." : 'Business information saved');
      setLogoFile(null);
    } catch (err) { 
      toast.error(err.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleSavePermissions = async () => {
    if (!settingsRef) return;
    setSavingPermissions(true);
    const write = setDoc(settingsRef, { cashierCanRecordExpenses: cashierExp }, { merge: true });
    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    setSavingPermissions(false);
    if (error) { toast.error(error.message); return; }
    toast.success(queuedOffline ? "Saved, it'll sync once you're back online." : 'Permissions saved');
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      if (demo) {
        resetDemoData();
        toast.success('Demo data reset. Reloading…');
      } else {
        await resetBusinessData(businessId, profile?.uid);
        toast.success('Business data reset. Reloading…');
      }
      window.location.href = '/';
    } catch (err) {
      toast.error(`Reset failed: ${err.message}`);
      setResetting(false);
      setResetDialogOpen(false);
    }
  };

  const openDeleteAccount = async () => {
    setDeleteAccountPassword('');
    setDeleteAccountConfirmText('');
    setOtherOwnersCount(null);
    setDeleteAccountOpen(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('businessId', '==', businessId), where('role', '==', 'owner')));
      const others = snap.docs.filter((d) => d.id !== profile.uid && d.data().active !== false);
      setOtherOwnersCount(others.length);
    } catch {
      setOtherOwnersCount(0); // fail toward showing the more serious warning
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteOwnAccount({ password: deleteAccountPassword });
      toast.success('Your account has been removed.');
    } catch (err) {
      toast.error(err.message);
      setDeletingAccount(false);
    }
  };

  const handleRevokeGroup = async (group) => {
    try {
      await Promise.all(group.ids.map((id) => revokeSession(id)));
      setSessions((s) => s.map((x) => (group.ids.includes(x.id) ? { ...x, revoked: true } : x)));
      toast.success('Device signed out.');
    } catch (err) { toast.error(err.message); }
  };

  const handleRestore = async (productId) => {
    const target = archived.find(p => p.id === productId);
    try {
      const { barcodeCleared } = await restoreProduct(productId, target?.barcode, businessId);
      setArchived(a => a.filter(p => p.id !== productId));
      toast.success(barcodeCleared
        ? 'Product restored, its old barcode is now used by another product, so it was cleared. Add a new one from Products if needed.'
        : 'Product restored');
    } catch (err) { toast.error(err.message); }
  };

  const handlePermanentDelete = async (productId) => {
    const target = archived.find(p => p.id === productId);
    try {
      await permanentlyDeleteProduct(productId, target?.barcode, businessId);
      setArchived(a => a.filter(p => p.id !== productId));
      toast.success('Product permanently deleted');
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="mx-auto max-w-xl"><p className="text-sm text-ink-400">Loading…</p></div>;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="font-display text-xl font-bold text-ink-900">Settings</h1>

      <div className="card p-5 space-y-2">
        <h2 className="font-display text-base font-bold text-ink-800">Account &amp; Security</h2>
        <Row label="Email verification" value={demo ? 'Not applicable (Demo Mode)' : emailVerified ? 'Verified ✓' : 'Not verified'} tone={!demo && !emailVerified ? 'text-rust-600' : ''} />
        <Row label="Your role" value={profile?.role === 'owner' ? 'Owner' : 'Cashier'} />
        <Row label="Business ID" value={businessId || '—'} mono />
      </div>

      <form onSubmit={handleSave} className="card space-y-4 p-5">
        <h2 className="font-display text-base font-bold text-ink-800">Business Information</h2>
        <p className="text-sm text-ink-500 mb-2">This info dynamically populates your customer-facing documents (receipts, invoices).</p>
        
        <div><label className="label">Business name</label><input className="input" value={shopName} onChange={e=>setShopName(e.target.value)} placeholder="Your Business Name" /></div>
        
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Business Phone</label><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Official Contact Number" /></div>
          <div><label className="label">Business Email</label><input type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="contact@example.com" /></div>
        </div>

        <div><label className="label">Business Address</label><input className="input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Physical location" /></div>
        
        <div>
          <label className="label">Business Logo</label>
          <div className="flex items-center gap-4">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-12 object-cover rounded-lg border border-ink-200" />}
            <input type="file" accept="image/*" className="text-sm" onChange={(e) => setLogoFile(e.target.files ? e.target.files[0] : null)} />
          </div>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
      </form>

      <div className="card p-5 space-y-3">
        <h2 className="font-display text-base font-bold text-ink-800">Permissions</h2>
        <div className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-3">
          <div><p className="text-sm font-semibold text-ink-800">Let cashiers record expenses</p><p className="text-xs text-ink-400">Turn off if only owners should log expenses.</p></div>
          <button type="button" onClick={()=>setCashierExp(v=>!v)} className={`h-6 w-11 shrink-0 rounded-full transition-colors ${cashierExp?'bg-moss-600':'bg-ink-200'}`} role="switch" aria-checked={cashierExp}>
            <span className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform ${cashierExp?'translate-x-5':''}`} />
          </button>
        </div>
        <button type="button" className="btn-primary w-full" onClick={handleSavePermissions} disabled={savingPermissions}>
          {savingPermissions ? 'Saving…' : 'Save permissions'}
        </button>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-display text-base font-bold text-ink-800">Team Management</h2>
        <p className="text-sm text-ink-500">Invite owners or cashiers, and manage pending invites and access.</p>
        <Link to="/users" className="btn-outline w-full flex items-center justify-center gap-2">Manage users &amp; invites</Link>
      </div>

      {!demo && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink-800">Logged-in Devices</h2>
          </div>
          <p className="text-sm text-ink-500 mb-2">Devices currently or recently associated with your business.</p>
          {sessionsLoading ? (
            <p className="text-sm text-ink-400">Loading…</p>
          ) : deviceGroups.length === 0 ? (
            <p className="text-sm text-ink-400">No device sessions recorded yet.</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {deviceGroups.map((group) => {
                const isCurrent = group.ids.includes(currentSessionId);
                const isActiveNow = isCurrent || (Date.now() - group.lastActiveMs < 20 * 60 * 1000);
                const isRevoked = !group.anyActive;
                return (
                  <div key={group.key} className="flex items-center justify-between py-3 text-sm">
                    <div className="min-w-0 pr-3">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold text-ink-800 truncate">{group.deviceLabel || 'Unknown device'}</p>
                        {isCurrent && <span className="badge bg-ink-900 text-white border border-ink-900 shrink-0">This device</span>}
                        {!isCurrent && isActiveNow && !isRevoked && <span className="badge bg-moss-50 text-moss-700 border border-moss-200 shrink-0">Active</span>}
                        {!isCurrent && !isActiveNow && !isRevoked && <span className="badge bg-ink-50 text-ink-600 border border-ink-200 shrink-0">Inactive</span>}
                      </div>
                      <p className="text-[11px] text-ink-500 truncate">
                        <span className="font-medium text-ink-700">{group.lastUserName || 'Unknown User'}</span> &middot; {isActiveNow ? 'Last seen: Just now' : `Last seen: ${formatDateTime(group.lastActiveMs)}`}
                      </p>
                    </div>
                    {isRevoked ? (
                      <span className="badge bg-rust-50 text-rust-600 border border-rust-200 shrink-0">Signed out</span>
                    ) : (
                      !isCurrent && <button className="btn-outline !px-3 !py-1.5 !min-h-0 text-xs shrink-0" onClick={() => handleRevokeGroup(group)}>Sign out</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-ink-800">Data</h2>
          <div className="flex gap-2">
            <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => { setArchivedOpen(o => !o); if (!archivedOpen) loadArchived(); }}>
              {archivedOpen ? 'Hide' : 'View archive'}
            </button>
          </div>
        </div>
        <p className="text-sm text-ink-500">Deleted products are archived here first, never destroyed immediately.</p>
        {archivedOpen && (
          archivedLoading ? <p className="text-sm text-ink-400">Loading…</p> : archived.length === 0 ? (
            <p className="text-sm text-ink-400">Nothing archived.</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {archived.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-ink-700">{p.name}</span>
                  <div className="flex gap-2">
                    <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => handleRestore(p.id)}>Restore</button>
                    <button className="btn-danger !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => handlePermanentDelete(p.id)}>Delete forever</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <div className="card p-5 space-y-2">
        <h2 className="font-display text-base font-bold text-ink-800">Subscription</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-500">Status: <span className={`font-semibold ${isPro ? 'text-amber-600' : 'text-ink-600'}`}>{isPro ? 'FlowBiz Pro' : 'Free'}</span></p>
          <Link to="/pro" className="btn-outline text-xs !px-2 !py-1 !min-h-0">Manage</Link>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-display text-base font-bold text-ink-800">Help &amp; Guide</h2>
        <Link to="/help" className="btn-outline w-full flex items-center justify-center gap-2"><span>View Help &amp; Guide</span></Link>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-display text-base font-bold text-ink-800">Backup & Restore</h2>
        <p className="text-sm text-ink-500">
          Download everything this business has stored as a .zip (CSVs plus a FlowBiz backup file), or restore a previous FlowBiz export back into this business.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-outline" onClick={handleExport} disabled={exporting || importing || checkingImport}>
            {exporting ? (exportProgress || 'Preparing…') : 'Export (.zip)'}
          </button>
          <button type="button" className="btn-outline" onClick={() => fileInputRef.current?.click()} disabled={exporting || importing || checkingImport}>
            {checkingImport ? 'Reading file…' : 'Import (.zip)'}
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleImportFileSelected} />
      </div>

      <Modal open={!!pendingImport} onClose={() => { if (!importing) setPendingImport(null); }} title="Import this backup?">
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            <span className="font-mono text-xs">{pendingImport?.fileName}</span> contains:
          </p>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-ink-100 divide-y divide-ink-100">
            {pendingImport && Object.entries(pendingImport.manifest.collections)
              .filter(([, docs]) => docs.length > 0)
              .map(([name, docs]) => (
                <div key={name} className="flex justify-between px-3 py-1.5 text-xs">
                  <span className="text-ink-500">{name}</span>
                  <span className="font-semibold text-ink-800">{docs.length}</span>
                </div>
              ))}
          </div>

          {pendingImport?.nonEmptyCollections.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              This business already has data in: {pendingImport.nonEmptyCollections.join(', ')}. Importing will add these records alongside what's already there — any record that shares the exact same ID as one you already have will be overwritten.
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-ink-600">
            <input type="checkbox" checked={importConfirmChecked} onChange={(e) => setImportConfirmChecked(e.target.checked)} disabled={importing} className="mt-0.5" />
            I understand and want to proceed with this import.
          </label>

          {importing && <p className="text-xs text-ink-400">{importProgress || 'Starting…'}</p>}

          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setPendingImport(null)} disabled={importing}>Cancel</button>
            <button type="button" className="btn-primary flex-1" onClick={handleConfirmImport} disabled={!importConfirmChecked || importing}>
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      </Modal>

      <div className="card space-y-3 border-rust-200 p-5">
        <div>
          <h2 className="font-display text-base font-bold text-rust-700">Danger Zone</h2>
          <p className="mt-1 text-sm text-ink-500">
            {demo
              ? 'Demo Reset clears all sample data stored in this browser.'
              : "Business Reset permanently deletes ALL of this business's data and removes cashier staff accounts. The owner account and Pro subscription remain active."}
          </p>
        </div>
        <button type="button" className="btn-danger w-full" onClick={() => { setResetConfirmText(''); setResetDialogOpen(true); }}>
          {demo ? 'Demo Reset' : 'Business Reset'}
        </button>
      </div>

      <div className="card space-y-3 border-rust-200 p-5">
        <div>
          <h2 className="font-display text-base font-bold text-rust-700">Delete My Account</h2>
          <p className="mt-1 text-sm text-ink-500">
            Removes your own FlowBiz sign-in permanently. What happens to the business depends on whether other owners exist. Export your data first if you're the only owner.
          </p>
        </div>
        <button type="button" className="btn-danger w-full" onClick={openDeleteAccount}>
          Delete my account
        </button>
      </div>

      <div className="pt-6 pb-2 text-center space-y-3">
        <div className="flex items-center justify-center gap-4 text-sm font-semibold">
          <Link to="/privacy" className="text-ink-500 hover:text-ink-800 transition-colors">Privacy Policy</Link>
          <span className="text-ink-300">&middot;</span>
          <Link to="/terms" className="text-ink-500 hover:text-ink-800 transition-colors">Terms of Service</Link>
        </div>
        <p className="text-xs text-ink-400">FlowBiz ensures all data handling complies with Kenyan Data Protection Act.</p>
      </div>

      <ConfirmDialog
        open={resetDialogOpen}
        title={demo ? 'Reset the demo data?' : 'This will permanently delete all store data & staff'}
        message={
          demo ? (
            <p>All sample data in this browser will be cleared and replaced with the original demo dataset.</p>
          ) : (
            <>
              <p className="mb-2">All products, sales, debt, expenses, and cashier staff will be deleted. Your owner account and Pro plan will remain intact.</p>
              <label className="label mt-3">Type <span className="font-mono font-bold">{RESET_CONFIRM_PHRASE}</span> to confirm</label>
              <input className="input" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} autoFocus />
            </>
          )
        }
        confirmLabel={resetting ? 'Resetting…' : demo ? 'Reset demo data' : 'Delete everything'}
        danger
        onConfirm={demo ? (!resetting ? handleReset : () => {}) : (resetConfirmText === RESET_CONFIRM_PHRASE && !resetting ? handleReset : () => {})}
        onCancel={() => { if (!resetting) setResetDialogOpen(false); }}
      />

      <Modal open={deleteAccountOpen} onClose={() => { if (!deletingAccount) setDeleteAccountOpen(false); }} title="Delete your account">
        <div className="space-y-4">
          {otherOwnersCount === null ? (
            <p className="text-sm text-ink-400">Checking your business…</p>
          ) : otherOwnersCount > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              Another owner is on this account. The business and all its data stay intact, and they'll take over as the business's main contact. Only your own sign-in will be removed.
            </div>
          ) : (
            <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2.5 text-sm text-rust-700">
              <strong>You're the only owner.</strong> Deleting your account permanently erases every product, sale, customer, and record this business has. This cannot be undone.
            </div>
          )}

          <div>
            <label className="label">Confirm your password</label>
            <input type="password" className="input" value={deleteAccountPassword} onChange={(e) => setDeleteAccountPassword(e.target.value)} autoComplete="current-password" disabled={deletingAccount} />
          </div>

          <div>
            <label className="label">Type <span className="font-mono font-bold">{DELETE_ACCOUNT_CONFIRM_PHRASE}</span> to confirm</label>
            <input className="input" value={deleteAccountConfirmText} onChange={(e) => setDeleteAccountConfirmText(e.target.value)} disabled={deletingAccount} />
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setDeleteAccountOpen(false)} disabled={deletingAccount}>Cancel</button>
            <button
              type="button"
              className="btn-danger flex-1"
              disabled={deletingAccount || deleteAccountConfirmText !== DELETE_ACCOUNT_CONFIRM_PHRASE || !deleteAccountPassword || otherOwnersCount === null}
              onClick={handleDeleteAccount}
            >
              {deletingAccount ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value, tone = '', mono = false }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className={`font-semibold ${mono ? 'font-mono text-xs' : ''} ${tone || 'text-ink-800'}`}>{value}</span>
    </div>
  );
}
````

## File: src/router/AppRouter.jsx
````javascript
// src/router/AppRouter.jsx
import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import AppShell from '../components/layout/AppShell';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { isDemoMode } from '../demo/demoMode'; // <--- Added import
import { prefetchRoutes } from './routePrefetch';
import RequireOpenSession from '../components/common/RequireOpenSession';
import LandingPage from '../pages/LandingPage';
import DemoLanding from '../pages/DemoLanding';

const routeLoaders = {
  setup: () => import('../pages/Setup'),
  login: () => import('../pages/Login'),
  forgotPassword: () => import('../pages/ForgotPassword'),
  joinStaff: () => import('../pages/JoinStaff'),
  authAction: () => import('../pages/AuthAction'),
  dashboard: () => import('../pages/Dashboard'),
  counter: () => import('../pages/Counter'),
  customers: () => import('../pages/Customers'),
  customerDetail: () => import('../pages/CustomerDetail'),
  expenses: () => import('../pages/Expenses'),
  purchases: () => import('../pages/Purchases'),
  products: () => import('../pages/Products'),
  suppliers: () => import('../pages/Suppliers'),
  stockTake: () => import('../pages/StockTake'),
  reports: () => import('../pages/Reports'),
  closeDay: () => import('../pages/CloseDay'),
  users: () => import('../pages/Users'),
  settings: () => import('../pages/Settings'),
  helpGuide: () => import('../pages/HelpGuide'),
  pro: () => import('../pages/Pro'),
  advancedAnalytics: () => import('../pages/AdvancedAnalytics'),
  inventoryIntelligence: () => import('../pages/InventoryIntelligence'),
  privacy: () => import('../pages/Privacy'),
  terms: () => import('../pages/Terms'),
};

const Setup                 = lazy(routeLoaders.setup);
const Login                 = lazy(routeLoaders.login);
const ForgotPassword         = lazy(routeLoaders.forgotPassword);
const JoinStaff             = lazy(routeLoaders.joinStaff);
const AuthAction            = lazy(routeLoaders.authAction);
const Dashboard             = lazy(routeLoaders.dashboard);
const Counter               = lazy(routeLoaders.counter);
const Customers             = lazy(routeLoaders.customers);
const CustomerDetail        = lazy(routeLoaders.customerDetail);
const Expenses              = lazy(routeLoaders.expenses);
const Purchases             = lazy(routeLoaders.purchases);
const Products              = lazy(routeLoaders.products);
const Suppliers             = lazy(routeLoaders.suppliers);
const StockTake             = lazy(routeLoaders.stockTake);
const Reports               = lazy(routeLoaders.reports);
const CloseDay              = lazy(routeLoaders.closeDay);
const Users                 = lazy(routeLoaders.users);
const Settings              = lazy(routeLoaders.settings);
const HelpGuide             = lazy(routeLoaders.helpGuide);
const Pro                   = lazy(routeLoaders.pro);
const AdvancedAnalytics     = lazy(routeLoaders.advancedAnalytics);
const InventoryIntelligence = lazy(routeLoaders.inventoryIntelligence);
const Privacy               = lazy(routeLoaders.privacy);
const Terms                 = lazy(routeLoaders.terms);

function Page({ children, adminOnly = false, requireOpenDay = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <AppShell>
        <Suspense fallback={<LoadingSpinner />}>
          {requireOpenDay ? <RequireOpenSession>{children}</RequireOpenSession> : children}
        </Suspense>
      </AppShell>
    </ProtectedRoute>
  );
}

function PublicOnly({ children }) {
  const { firebaseUser, loading } = useAuth();
  if (loading) return <LoadingSpinner label="Starting FlowBiz…" />;
  if (firebaseUser) return <Navigate to="/dashboard" replace />;
  return children;
}

function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function RootRoute() {
  const { firebaseUser, loading, isAdmin } = useAuth();
  const demo = isDemoMode();

  if (demo) {
    return <Navigate to="/counter" replace />;
  }

  if (!loading && firebaseUser) {
    return <Navigate to={isAdmin ? "/dashboard" : "/counter"} replace />;
  }
  if (!loading && !firebaseUser && isStandalonePWA()) {
    return <Navigate to="/login" replace />;
  }
  return <LandingPage />;
}

function RoutePrefetcher() {
  const { firebaseUser, isAdmin } = useAuth();
  useEffect(() => {
    if (!firebaseUser) return;
    const common = [routeLoaders.counter, routeLoaders.customers, routeLoaders.customerDetail, routeLoaders.expenses, routeLoaders.helpGuide];
    const adminOnly = [routeLoaders.dashboard, routeLoaders.products, routeLoaders.purchases, routeLoaders.suppliers, routeLoaders.stockTake, routeLoaders.reports, routeLoaders.closeDay, routeLoaders.users, routeLoaders.settings, routeLoaders.pro, routeLoaders.advancedAnalytics, routeLoaders.inventoryIntelligence];
    prefetchRoutes(isAdmin ? [...common, ...adminOnly] : common);
  }, [firebaseUser, isAdmin]);
  return null;
}

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading..." />}>
      <RoutePrefetcher />
      <Routes>
        {/* Landing Page for visitors; redirects to Dashboard/Counter when logged in */}
        <Route path="/" element={<RootRoute />} />

        {/* Dedicated Live Demo Entry (Zero sign-in prompt) */}
        <Route path="/demo" element={<DemoLanding />} />

        {/* Public Authentication & Setup */}
        <Route path="/setup" element={<Setup />} />
        <Route path="/signup" element={<Setup />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/signin" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        <Route path="/join/:inviteId" element={<JoinStaff />} />
        <Route path="/auth/action" element={<AuthAction />} />
        
        {/* Public Legal Pages */}
        <Route path="/privacy" element={<Suspense fallback={<LoadingSpinner />}><Privacy /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<LoadingSpinner />}><Terms /></Suspense>} />

        {/* Protected Store Management Routes */}
        <Route path="/dashboard"    element={<Page adminOnly><Dashboard /></Page>} />
        <Route path="/pro"          element={<Page adminOnly><Pro /></Page>} />
        <Route path="/advanced-analytics" element={<Page adminOnly><AdvancedAnalytics /></Page>} />
        <Route path="/inventory-intelligence" element={<Page adminOnly><InventoryIntelligence /></Page>} />

        <Route path="/counter"      element={<Page><Counter /></Page>} />
        <Route path="/customers"    element={<Page><Customers /></Page>} />
        <Route path="/customers/:customerId" element={<Page><CustomerDetail /></Page>} />
        <Route path="/expenses"     element={<Page requireOpenDay><Expenses /></Page>} />
        <Route path="/purchases"    element={<Page adminOnly><Purchases /></Page>} />
        <Route path="/products"     element={<Page adminOnly><Products /></Page>} />
        <Route path="/suppliers"    element={<Page adminOnly><Suppliers /></Page>} />
        <Route path="/stock-take"   element={<Page adminOnly><StockTake /></Page>} />
        <Route path="/reports"      element={<Page adminOnly><Reports /></Page>} />
        <Route path="/close-day"    element={<Page adminOnly requireOpenDay><CloseDay /></Page>} />
        <Route path="/users"        element={<Page adminOnly><Users /></Page>} />
        <Route path="/settings"     element={<Page adminOnly><Settings /></Page>} />
        <Route path="/help"         element={<Page><HelpGuide /></Page>} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
````

## File: src/contexts/AuthContext.jsx
````javascript
// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, sendEmailVerification, reload,
  deleteUser, EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import {
  doc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { isDemoMode, exitDemoMode } from '../demo/demoMode';
import { DEMO_UID } from '../demo/localAuth';
import { DEMO_BUSINESS_ID } from '../demo/seedData';
import { raceWithTimeout } from '../utils/offlineWrite';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';
const AuthContext = createContext(null);

const DEMO_USER = {
  uid: DEMO_UID,
  email: 'demo@flowbiz.app',
  displayName: 'Demo Owner',
  emailVerified: true,
};

const DEMO_PROFILE = {
  uid: DEMO_UID,
  email: 'demo@flowbiz.app',
  displayName: 'Demo Owner',
  role: 'owner',
  businessId: DEMO_BUSINESS_ID,
  active: true,
  createdAt: new Date(),
};

function getDeviceId() {
  let id = localStorage.getItem('flowbiz_device_id');
  if (!id) {
    id = `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('flowbiz_device_id', id);
  }
  return id;
}

function getSessionDocId(uid) {
  return `${getDeviceId()}__${uid}`;
}

function guessDeviceLabel() {
  const ua = navigator.userAgent || '';
  let os = 'Unknown device';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = '';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
  if (isStandalone) return browser ? `${os} app (${browser})` : `${os} app`;
  return browser ? `${browser} on ${os}` : os;
}

export function AuthProvider({ children }) {
  const demoActive = isDemoMode();

  const [firebaseUser, setFirebaseUser] = useState(demoActive ? DEMO_USER : null);
  const [profile, setProfile] = useState(demoActive ? DEMO_PROFILE : null);
  const [subscription, setSubscription] = useState(demoActive ? { plan: 'pro', status: 'active' } : { plan: 'free', status: 'active' });
  const [loading, setLoading] = useState(!demoActive);
  const [authError, setAuthError] = useState(null);
  const [accountRemoved, setAccountRemoved] = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);
  const [emailVerified, setEmailVerified] = useState(demoActive);

  const profileUnsubRef = useRef(null);
  const sessionUnsubRef = useRef(null);
  const businessUnsubRef = useRef(null);
  const sessionRegisteredRef = useRef(null);

  const stopListeners = useCallback(() => {
    profileUnsubRef.current?.();
    profileUnsubRef.current = null;
    sessionUnsubRef.current?.();
    sessionUnsubRef.current = null;
    businessUnsubRef.current?.();
    businessUnsubRef.current = null;
    sessionRegisteredRef.current = null;
  }, []);

  const registerSession = useCallback(async (uid, businessId, userName) => {
    if (isDemoMode() || !uid || !businessId) return;
    const key = `${uid}:${businessId}`;
    if (sessionRegisteredRef.current === key) return;
    sessionRegisteredRef.current = key;

    try {
      let sessionId = getSessionDocId(uid);
      let ref = doc(db, 'sessions', sessionId);
      let currentSnap = await getDoc(ref).catch(() => null);

      if (currentSnap && currentSnap.exists() && currentSnap.data().revoked === true) {
        sessionId = `${sessionId}__${Date.now().toString(36)}`;
        ref = doc(db, 'sessions', sessionId);
        currentSnap = await getDoc(ref).catch(() => null);
      }

      const baseFields = {
        uid,
        businessId,
        lastUserName: userName || auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown',
        deviceLabel: guessDeviceLabel(),
        userAgent: navigator.userAgent,
        lastActiveAt: serverTimestamp(),
      };

      if (!currentSnap || !currentSnap.exists()) {
        await setDoc(ref, { ...baseFields, createdAt: serverTimestamp(), revoked: false });
      } else {
        await updateDoc(ref, baseFields).catch(() => {});
      }

      sessionUnsubRef.current?.();
      sessionUnsubRef.current = onSnapshot(ref, (sessionSnap) => {
        if (sessionSnap.exists() && sessionSnap.data().revoked === true) {
          setSessionRevoked(true);
          fbSignOut(auth);
        }
      });
    } catch (err) {
      console.warn('[FlowBiz] registerSession non-fatal warning:', err.message);
    }
  }, []);

  const loadProfile = useCallback(function doLoad(user, retryCount = 0) {
    stopListeners();
    setAuthError(null);
    setAccountRemoved(false);
    setSessionRevoked(false);

    if (isDemoMode()) {
      setFirebaseUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setSubscription({ plan: 'pro', status: 'active' });
      setEmailVerified(true);
      setLoading(false);
      return;
    }

    if (!user) {
      setProfile(null);
      setSubscription({ plan: 'free', status: 'active' });
      setEmailVerified(false);
      setLoading(false);
      return;
    }

    setEmailVerified(!!user.emailVerified);
    setLoading(true);

    const userRef = doc(db, 'users', user.uid);

    profileUnsubRef.current = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          (async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
              await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
              if (auth.currentUser?.uid !== user.uid) return;
              try {
                const recheck = await getDoc(userRef);
                if (recheck.exists()) return;
              } catch (err) {
                if (attempt === 2) {
                  setAuthError(`${err.code || err.name || 'unknown'}: ${err.message}`);
                  setProfile(null);
                  setLoading(false);
                  return;
                }
              }
            }
            setAccountRemoved(true);
            setProfile(null);
            setLoading(false);
          })();
          return;
        }

        setAccountRemoved(false);
        const data = { uid: user.uid, ...snap.data() };
        setProfile(data);
        setLoading(false);

        if (data.businessId && data.active !== false) {
          registerSession(user.uid, data.businessId, data.displayName).catch(console.error);
          businessUnsubRef.current = onSnapshot(doc(db, 'businesses', data.businessId), (bizSnap) => {
            if (bizSnap.exists()) {
              setSubscription(bizSnap.data().subscription || { plan: 'free', status: 'active' });
            }
          });
        }
      },
      (err) => {
        if (err.code === 'permission-denied' && retryCount < 5) {
          const delay = Math.min(1000 * 2 ** retryCount, 6000);
          setTimeout(() => {
            if (auth.currentUser?.uid === user.uid) doLoad(user, retryCount + 1);
          }, delay);
          return;
        }
        console.error(`[FlowBiz] onSnapshot(users/${user.uid}) error:`, err.code || err.name, err.message);
        setAuthError(`${err.code || err.name || 'unknown'}: ${err.message}`);
        setProfile(null);
        setLoading(false);
      }
    );
  }, [registerSession, stopListeners]);

  useEffect(() => {
    if (isDemoMode()) {
      setFirebaseUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setSubscription({ plan: 'pro', status: 'active' });
      setEmailVerified(true);
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      loadProfile(user);
    });
    return () => { unsub(); stopListeners(); };
  }, [loadProfile, stopListeners]);

  const login = (email, password) => {
    exitDemoMode();
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    exitDemoMode();
    stopListeners();
    return fbSignOut(auth);
  };

  const resendVerificationEmail = async () => {
    if (isDemoMode()) return;
    if (!auth.currentUser) throw new Error('Not signed in.');
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        let message = 'Could not send the verification email.';
        try { const body = await response.json(); message = body?.error || message; } catch {}
        throw new Error(message);
      }
    } catch (workerErr) {
      console.warn('[FlowBiz] Worker email send failed, falling back to direct Firebase Auth send:', workerErr.message);
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshEmailVerification = useCallback(async () => {
    if (isDemoMode()) return true;
    if (!auth.currentUser) return false;
    try {
      await reload(auth.currentUser);
    } catch (err) {
      console.error('[FlowBiz] refreshEmailVerification reload error:', err.code || err.name, err.message);
      return auth.currentUser?.emailVerified ?? false;
    }
    const verified = !!auth.currentUser.emailVerified;
    setEmailVerified(verified);
    return verified;
  }, []);

  const createStaffInvite = async ({ displayName, role = 'cashier' }) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can invite staff.');
    if (!['owner', 'cashier'].includes(role)) throw new Error('Invalid role.');
    const trimmed = (displayName || '').trim();
    if (!trimmed) throw new Error('Enter a name.');
    const write = addDoc(collection(db, 'staffInvites'), {
      businessId: profile.businessId,
      displayName: trimmed,
      role,
      createdBy: profile.uid,
      createdByName: profile.displayName,
      createdAt: serverTimestamp(),
      claimed: false,
      linkedUid: null,
    });
    const { queuedOffline, value, error } = await raceWithTimeout(write, 4000);
    if (error) throw error;
    if (queuedOffline) return { id: null, queuedOffline: true };
    return { id: value.id };
  };

  const cancelStaffInvite = async (inviteId) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can cancel an invite.');
    await deleteDoc(doc(db, 'staffInvites', inviteId));
  };

  const revokeSessionsForStaffMember = useCallback(async (uid) => {
    if (!profile?.businessId) return;
    const snap = await getDocs(query(collection(db, 'sessions'), where('uid', '==', uid), where('businessId', '==', profile.businessId)));
    await Promise.all(
      snap.docs.filter((d) => d.data().revoked !== true).map((d) => updateDoc(doc(db, 'sessions', d.id), { revoked: true }))
    );
  }, [profile]);

  const removeStaffAccount = async (uid) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can remove staff accounts.');
    if (uid === profile.uid) throw new Error("You can't remove your own account here.");
    if (!auth.currentUser) throw new Error('Your session has expired. Please sign in again.');

    const idToken = await auth.currentUser.getIdToken(true);
    await revokeSessionsForStaffMember(uid);

    let response;
    try {
      response = await fetch(`${FLOWBIZ_API_URL}/api/auth/delete-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ targetUid: uid }),
      });
    } catch {
      throw new Error(`Failed to reach the API server. Check your connection.`);
    }

    let result = null;
    try { result = await response.json(); } catch { }
    if (!response.ok) throw new Error(result?.error || result?.message || `Failed to delete the staff account (${response.status}).`);

    const { queuedOffline, error: deleteError } = await raceWithTimeout(deleteDoc(doc(db, 'users', uid)), 4000);
    if (deleteError) {
      throw new Error(`Staff sign-in was removed, but their profile record couldn't be deleted (${deleteError.message}). It should clear automatically once back online.`);
    }
    if (queuedOffline) {
      throw new Error("Staff sign-in was removed, but you're offline — their profile record will finish deleting once you're back online.");
    }
  };

  const toggleMemberActive = async (uid, active) => {
    if (!profile || profile.role !== 'owner') throw new Error('Only an owner can do this.');
    await updateDoc(doc(db, 'users', uid), { active });
    if (active === false) await revokeSessionsForStaffMember(uid);
  };

  const deleteOwnAccount = async ({ password }) => {
    if (!profile || !auth.currentUser) throw new Error('You need to be signed in to do this.');

    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error('That password is incorrect.');
      }
      throw new Error('Could not verify your password. Please try again.');
    }

    let mode = 'self-only';

    if (profile.role === 'owner') {
      const othersSnap = await getDocs(query(
        collection(db, 'users'),
        where('businessId', '==', profile.businessId),
        where('role', '==', 'owner')
      ));
      const otherOwners = othersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== profile.uid && u.active !== false);

      if (otherOwners.length > 0) {
        const bizSnap = await getDoc(doc(db, 'businesses', profile.businessId));
        const business = bizSnap.exists() ? bizSnap.data() : null;
        if (business && business.createdBy === profile.uid) {
          const oldest = [...otherOwners].sort((a, b) => {
            const at = a.createdAt?.toMillis?.() ?? 0;
            const bt = b.createdAt?.toMillis?.() ?? 0;
            return at - bt;
          })[0];
          await updateDoc(doc(db, 'businesses', profile.businessId), { createdBy: oldest.id });
        }
      } else {
        mode = 'full-wipe';
        const { resetBusinessData } = await import('../utils/businessReset');
        await resetBusinessData(profile.businessId, profile.uid);
      }
    }

    const idToken = await auth.currentUser.getIdToken(true);
    const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/delete-own-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ mode }),
    });
    let result = null;
    try { result = await response.json(); } catch { }
    if (!response.ok) {
      throw new Error(result?.error || `Could not finish removing your account (${response.status}).`);
    }

    try {
      await deleteUser(auth.currentUser);
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        throw new Error("Your business data was handled, but we couldn't remove your sign-in for security reasons — please sign out and back in, then try 'Delete my account' again.");
      }
      throw new Error("Your business data was handled, but removing your sign-in failed. Please try again.");
    }
  };

  const revokeSession = async (sessionId) => {
    await updateDoc(doc(db, 'sessions', sessionId), { revoked: true });
  };

  const listMySessions = async () => {
    if (!profile) return [];
    const snap = await getDocs(query(collection(db, 'sessions'), where('uid', '==', profile.uid)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const listBusinessSessions = async () => {
    if (!profile?.businessId) return [];
    const snap = await getDocs(query(collection(db, 'sessions'), where('businessId', '==', profile.businessId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const isOwner = profile?.role === 'owner';
  
  const expiresMs = subscription?.expiresAt?.toMillis 
    ? subscription.expiresAt.toMillis() 
    : (subscription?.expiresAt ? new Date(subscription.expiresAt).getTime() : 0);

  const isPro = isDemoMode() || (
    subscription?.plan === 'pro' && 
    subscription?.status === 'active' &&
    (!subscription.expiresAt || expiresMs > Date.now())
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser, profile, subscription, isPro, loading, authError, accountRemoved, sessionRevoked,
        businessId: profile?.businessId ?? null, role: profile?.role ?? null, isAdmin: isOwner, isOwner,
        isActive: profile?.active !== false, emailVerified,
        login, logout, resendVerificationEmail, refreshEmailVerification, createStaffInvite, cancelStaffInvite, removeStaffAccount,
        toggleMemberActive, revokeSession, listMySessions, listBusinessSessions, deleteOwnAccount,
        currentSessionId: firebaseUser ? getSessionDocId(firebaseUser.uid) : getDeviceId(),
        reloadProfile: async () => loadProfile(auth.currentUser),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
````

## File: src/pages/AuthAction.jsx
````javascript
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  checkActionCode,
} from 'firebase/auth';
import toast from 'react-hot-toast';
import { auth } from '../firebase';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

export default function AuthAction() {
  const [searchParams] = useSearchParams();

  const urlMode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  const [resolvedMode, setResolvedMode] = useState(urlMode || null);
  const [checkingMode, setCheckingMode] = useState(!urlMode && !!oobCode);

  useEffect(() => {
    if (urlMode || !oobCode) return;

    let cancelled = false;

    checkActionCode(auth, oobCode)
      .then((info) => {
        if (cancelled) return;

        if (info.operation === 'PASSWORD_RESET') {
          setResolvedMode('resetPassword');
        } else if (info.operation === 'VERIFY_EMAIL') {
          setResolvedMode('verifyEmail');
        } else {
          setResolvedMode('unknown');
        }
      })
      .catch((err) => {
        console.error('[FlowBiz] Failed to determine auth action:', err.code, err.message);
        if (!cancelled) setResolvedMode('unknown');
      })
      .finally(() => {
        if (!cancelled) setCheckingMode(false);
      });

    return () => {
      cancelled = true;
    };
  }, [urlMode, oobCode]);

  if (checkingMode) {
    return (
      <Shell>
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
        <p className="text-sm text-ink-500">Checking your link…</p>
      </Shell>
    );
  }

  const flow = searchParams.get('flow');

  if (!oobCode) {
    if (flow === 'resetPassword' || flow === 'verifyEmail') {
      return (
        <Shell>
          <CheckCircle2 className="h-12 w-12 mx-auto text-moss-600" strokeWidth={1.5} />
          <h1 className="font-display text-lg font-bold text-ink-900">
            {flow === 'resetPassword' ? 'Password updated' : 'Email verified'}
          </h1>
          <p className="text-sm text-ink-500">
            {flow === 'resetPassword'
              ? 'Your password was changed. You can now sign in with it.'
              : 'Your email address is verified. You can continue to FlowBiz now.'}
          </p>
          <Link to={flow === 'resetPassword' ? '/login' : '/dashboard'} className="btn-primary w-full">
            {flow === 'resetPassword' ? 'Go to sign in' : 'Continue to Dashboard'}
          </Link>
        </Shell>
      );
    }
    return (
      <Shell>
        <AlertCircle className="h-12 w-12 mx-auto text-rust-500" strokeWidth={1.5} />
        <h1 className="font-display text-lg font-bold text-ink-900">Invalid link</h1>
        <p className="text-sm text-ink-500">This authentication link is missing required parameters. Please request a new link.</p>
        <Link to="/login" className="btn-outline w-full">Go to sign in</Link>
      </Shell>
    );
  }

  if (resolvedMode === 'resetPassword') {
    return <ResetPasswordPanel oobCode={oobCode} />;
  }

  if (resolvedMode === 'verifyEmail') {
    return <VerifyEmailPanel mode="verifyEmail" oobCode={oobCode} />;
  }

  return (
    <Shell>
      <AlertCircle className="h-12 w-12 mx-auto text-rust-500" strokeWidth={1.5} />
      <h1 className="font-display text-lg font-bold text-ink-900">Invalid authentication link</h1>
      <p className="text-sm text-ink-500">We couldn't determine what this link is intended to do. Please request a new link.</p>
      <Link to="/login" className="btn-outline w-full">Go to sign in</Link>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-8">
      <div className="w-full max-w-sm card p-6 text-center space-y-4">
        <img src="/icons/icon-192.png" alt="FlowBiz" className="mx-auto h-14 w-14 rounded-2xl shadow-lg" />
        {children}
      </div>
    </div>
  );
}

function VerifyEmailPanel({ mode, oobCode }) {
  const [status, setStatus] = useState('working');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();
  const { refreshEmailVerification, reloadProfile, firebaseUser } = useAuth();

  useEffect(() => {
    if (!oobCode || mode !== 'verifyEmail') {
      setStatus('error');
      setMessage('This verification link is incomplete or invalid. Please request a new link.');
      return;
    }

    let active = true;

    (async () => {
      setStatus('working');
      try {
        await applyActionCode(auth, oobCode);
        if (!active) return;

        if (auth.currentUser) {
          await refreshEmailVerification();
          await reloadProfile();
          toast.success('Email verified successfully! Welcome to FlowBiz.');
          navigate('/dashboard', { replace: true });
        } else {
          setStatus('success');
        }
      } catch (err) {
        if (!active) return;
        const code = err.code || '';

        if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
          const verified = await refreshEmailVerification();
          if (verified || auth.currentUser?.emailVerified) {
            await reloadProfile();
            toast.success('Your email is verified!');
            navigate('/dashboard', { replace: true });
            return;
          }
        }

        setStatus('error');
        setMessage(
          code === 'auth/expired-action-code'
            ? 'This verification link has expired. Please request a new one below.'
            : code === 'auth/invalid-action-code'
              ? "This verification link has already been used or has expired. If you've already verified, you can enter your dashboard below."
              : "We couldn't verify your email with this link. Please request a new link below."
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [oobCode, mode, refreshEmailVerification, reloadProfile, navigate]);

  const handleRequestNewEmail = async () => {
    if (!auth.currentUser) {
      navigate('/login', { replace: true });
      return;
    }
    setResending(true);
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error('request-failed');
      toast.success('A new verification email has been sent — check your inbox.');
    } catch (err) {
      console.error('[FlowBiz] AuthAction resend failed:', err.message);
      toast.error("Couldn't send a new verification email right now. Please try again in a moment.");
    } finally {
      setResending(false);
    }
  };

  return (
    <Shell>
      {status === 'working' && (
        <>
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
          <h1 className="font-display text-lg font-bold text-ink-900">Verifying your email…</h1>
          <p className="text-sm text-ink-500">Activating your account and taking you to your dashboard.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 className="h-12 w-12 mx-auto text-moss-600" strokeWidth={1.5} />
          <h1 className="font-display text-lg font-bold text-ink-900">Email verified!</h1>
          <p className="text-sm text-ink-500">Your account is fully activated. You can now sign in to your dashboard.</p>
          <Link
            to="/login"
            className="btn-primary w-full"
          >
            Sign in to Dashboard
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="h-12 w-12 mx-auto text-rust-500" strokeWidth={1.5} />
          <h1 className="font-display text-lg font-bold text-ink-900">Verification Link Notice</h1>
          <p className="text-sm text-ink-500">{message}</p>
          <div className="flex flex-col gap-2 pt-2">
            <Link to={firebaseUser ? '/dashboard' : '/login'} className="btn-primary w-full">
              {firebaseUser ? 'Go to Dashboard' : 'Sign In'}
            </Link>
            {auth.currentUser && (
              <button className="btn-outline w-full" onClick={handleRequestNewEmail} disabled={resending}>
                {resending ? 'Sending…' : 'Request new verification email'}
              </button>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

function ResetPasswordPanel({ oobCode }) {
  const [status, setStatus] = useState('ready');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!oobCode) {
      setStatus('error');
      setMessage('This link is missing required information. Please request a new password reset email.');
      return;
    }

    setStatus('checking');

    try {
      const verifiedEmail = await verifyPasswordResetCode(auth, oobCode);
      setEmail(verifiedEmail);
      setStatus('form');
    } catch (err) {
      const code = err.code || '';
      setStatus('error');
      setMessage(
        code === 'auth/expired-action-code'
          ? 'This reset link has expired. Please request a new one.'
          : code === 'auth/invalid-action-code'
            ? 'This reset link has already been used or is invalid. Please request a new one.'
            : 'This reset link is invalid. Please request a new one.'
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setMessage('Password must contain at least one uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setMessage('Password must contain at least one lowercase letter.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setMessage('Password must contain at least one number.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setMessage('');
    setSubmitting(true);

    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('success');
    } catch (err) {
      const code = err.code || '';
      setMessage(
        code === 'auth/expired-action-code'
          ? 'This reset link has expired. Please request a new one.'
          : code === 'auth/weak-password'
            ? 'Please choose a stronger password.'
            : "Couldn't reset your password. Please request a new link and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      {status === 'ready' && (
        <>
          <h1 className="font-display text-lg font-bold text-ink-900">Reset your password</h1>
          <p className="text-sm text-ink-500">Click below to enter your new password.</p>
          <button className="btn-primary w-full" onClick={handleContinue}>Continue</button>
        </>
      )}

      {status === 'checking' && (
        <>
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
          <p className="text-sm text-ink-500">Verifying link…</p>
        </>
      )}

      {status === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="text-center">
            <h1 className="font-display text-lg font-bold text-ink-900">Choose a new password</h1>
            {email && <p className="mt-1 text-sm text-ink-500">for <span className="font-semibold">{email}</span></p>}
          </div>

          {message && (
            <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">
              {message}
            </div>
          )}

          <div>
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 chars (upper, lower, number)"
              autoComplete="new-password"
              autoFocus
            />
          </div>

          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              className="input"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 className="h-12 w-12 text-moss-600 mx-auto" strokeWidth={1.5} />
          <h1 className="font-display text-lg font-bold text-ink-900">Password updated</h1>
          <p className="text-sm text-ink-500">You can now sign in with your new password.</p>
          <Link to="/login" className="btn-primary w-full">Go to sign in</Link>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="h-12 w-12 text-rust-500 mx-auto" strokeWidth={1.5} />
          <h1 className="font-display text-lg font-bold text-ink-900">Password Reset Issue</h1>
          <p className="text-sm text-ink-500">{message}</p>
          <Link to="/forgot-password" className="btn-primary w-full">Request new reset link</Link>
        </>
      )}
    </Shell>
  );
}
````
