import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinancialsForRange } from '../hooks/useFinancials';
import { useDailySession } from '../hooks/useDailySession';
import { useSettings } from '../contexts/SettingsContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorBanner from '../components/common/ErrorBanner';
import Modal from '../components/common/Modal';
import { formatPdfMoney } from '../utils/currency';
import { formatDate, formatDateTime, getRangeForPreset, todayKey, startOfDateInput, endOfDateInput } from '../utils/dateRanges';
import { productPerformance } from '../utils/productPerformance';
import { computeExpectedTillBalances } from '../utils/financials';
import { Printer, TrendingUp } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Toolbar from '../components/ui/Toolbar';
import Section from '../components/ui/Section';
import SegmentedControl from '../components/ui/SegmentedControl';
import MetricRail, { Metric } from '../components/ui/MetricRail';
import StatementBlock, { StatementRow, StatementResult } from '../components/ui/StatementBlock';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/common/EmptyState';
import Money from '../components/ui/Money';
import { PDF } from '../theme/tokens';
import toast from 'react-hot-toast';
import { roundQuantity } from '../industry/units';
import { currencyMarker, formatAmount, tenderLabel } from '../lib/region';
import { savePdf, openForPrint } from '../platform/files';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

export default function Reports() {
  const [preset, setPreset] = useState('today');
  const [cStart, setCStart] = useState('');
  const [cEnd, setCEnd] = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const { start, end } = useMemo(() => {
    if (preset === 'custom' && cStart && cEnd) {
      return { start: startOfDateInput(cStart), end: endOfDateInput(cEnd) };
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
    refunds,
  } = useFinancialsForRange(start, end);

  const { session } = useDailySession();
  const { settings } = useSettings();

  // FIVE WHOLE-BUSINESS LISTENERS USED TO OPEN HERE and feed nothing.
  // The products and outstanding-credit ones had their results discarded
  // outright (a comment claimed they fed the PDF; nothing read them), and
  // the purchases / supplierPayments / suppliers three existed only for
  // the "current supplier balance" line, which was wrong to compute from
  // this page's data and has been replaced by the period figure the PDF
  // already had in hand. Every number on this page and in its export now
  // comes from useFinancialsForRange, which is date-bounded — so opening
  // Reports no longer streams a shop's entire catalogue, purchase history
  // and open credit book to the device for nothing.

  // Net of returns, and at what each line was actually paid — see
  // utils/productPerformance.js. The summary above already nets refunds;
  // the product tables used to show the original sale regardless.
  const performance = useMemo(
    () => productPerformance({ sales, creditSales, refunds }),
    [sales, creditSales, refunds]
  );
  const bestSellers = useMemo(
    () => [...performance].sort((a, b) => b.qty - a.qty).slice(0, 8),
    [performance]
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

  const productPerf = performance;

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
      doc.setTextColor(...PDF.ink);
      doc.text(businessName.toUpperCase(), textX, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...PDF.ink2);
      const metaLine = [settings.phone, settings.email, settings.address].filter(Boolean).join(' · ');
      if (metaLine) {
        doc.text(metaLine, textX, y + 11);
      }
      doc.text(`FINANCIAL AUDIT & PERFORMANCE STATEMENT  |  ${formatDate(start)} to ${formatDate(end)}`, textX, y + 15.5);

      y += 22;
      doc.setDrawColor(...PDF.ink);
      doc.setLineWidth(0.4);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 6;

      // Helper for clean subsection headers
      const drawSectionHeader = (title) => {
        doc.setFillColor(...PDF.canvas);
        doc.roundedRect(marginX, y, contentWidth, 6.5, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...PDF.ink);
        doc.text(title.toUpperCase(), marginX + 3, y + 4.6);
        y += 9.5;
      };

      // Helper for clean data rows
      const drawDataRow = (label, value, isBold = false, isHighlight = false, valueColor = PDF.ink) => {
        if (isHighlight) {
          doc.setFillColor(...PDF.primaryTint);
          doc.roundedRect(marginX, y - 3.5, contentWidth, 6, 0.8, 0.8, 'F');
        }
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...PDF.ink2);
        doc.text(label, marginX + 3, y + 0.8);

        doc.setTextColor(...valueColor);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.text(value, pageWidth - marginX - 3, y + 0.8, { align: 'right' });

        doc.setDrawColor(...PDF.divider);
        doc.setLineWidth(0.12);
        doc.line(marginX + 3, y + 2.5, pageWidth - marginX - 3, y + 2.5);

        y += 5.8;
      };

      // 2. Cash Drawer Reconciliation Breakdown
      drawSectionHeader('1. Cash Drawer Shift Reconciliation');
      if (preset === 'today') {
        drawDataRow('Opening Cash Float', formatPdfMoney(session?.openingCashFloat || 0));
      }
      drawDataRow('+ Cash Sales Received', formatPdfMoney(summary.totalCashSales));
      drawDataRow('+ Debt Repayments Collected (Cash)', formatPdfMoney(summary.totalDebtRepaymentsCash));
      drawDataRow('- Shop Expenses Paid (Cash)', `- ${formatPdfMoney(summary.totalExpensesCash)}`);
      drawDataRow('- Customer Refunds Issued (Cash)', `- ${formatPdfMoney(summary.totalRefundsCash)}`);
      drawDataRow('- Direct Stock Purchases Paid (Cash)', `- ${formatPdfMoney(cashPurchases)}`);
      drawDataRow('- Supplier Debt Payments (Cash)', `- ${formatPdfMoney(cashSupplierPay)}`);
      drawDataRow('= Net Expected Cash in Drawer', formatPdfMoney(expectedCashAtClose), true, true, PDF.primary);
      y += 3;

      // 3. M-Pesa Till Reconciliation Breakdown
      drawSectionHeader(`2. ${tenderLabel('M-Pesa')} Shift Reconciliation`);
      if (preset === 'today') {
        drawDataRow(`Opening ${tenderLabel('M-Pesa')} Balance`, formatPdfMoney(session?.openingMpesaFloat || 0));
      }
      drawDataRow(`+ ${tenderLabel('M-Pesa')} Sales Received`, formatPdfMoney(summary.totalMpesaSales));
      drawDataRow(`+ Debt Repayments Collected (${tenderLabel('M-Pesa')})`, formatPdfMoney(summary.totalDebtRepaymentsMpesa));
      drawDataRow(`- Shop Expenses Paid (${tenderLabel('M-Pesa')})`, `- ${formatPdfMoney(summary.totalExpensesMpesa)}`);
      drawDataRow(`- Customer Refunds Issued (${tenderLabel('M-Pesa')})`, `- ${formatPdfMoney(summary.totalRefundsMpesa)}`);
      drawDataRow(`- Direct Stock Purchases Paid (${tenderLabel('M-Pesa')})`, `- ${formatPdfMoney(mpesaPurchases)}`);
      drawDataRow(`- Supplier Debt Payments (${tenderLabel('M-Pesa')})`, `- ${formatPdfMoney(mpesaSupplierPay)}`);
      drawDataRow(`= Net Expected ${tenderLabel('M-Pesa')} Balance`, formatPdfMoney(expectedMpesaAtClose), true, true, PDF.primary);
      y += 3;

      // 4. Profit & Loss Statement (Cash-Flow / Operating)
      drawSectionHeader('3. Cash-Flow Profit & Loss Statement');
      drawDataRow('Recognized Cash-Flow Revenue (Sales + Debt Repaid - Refunds)', formatPdfMoney(summary.revenue));
      drawDataRow('- Cost of Goods Sold (COGS)', `- ${formatPdfMoney(summary.costOfGoodsSold)}`);
      drawDataRow('= Gross Profit', formatPdfMoney(summary.grossProfit), true, true, PDF.primary);
      drawDataRow('- Total Operating Expenses', `- ${formatPdfMoney(summary.totalExpenses)}`);
      drawDataRow('= Net Operating Profit', formatPdfMoney(summary.netProfit), true, true, summary.netProfit >= 0 ? PDF.primary : PDF.negative);
      y += 3;

      // 5. Purchases & Supplier Restocking Summary
      drawSectionHeader('4. Stock Purchases & Supplier Credit Activity');
      drawDataRow(`Total Stock Purchases (Cash & ${tenderLabel('M-Pesa')} Paid)`, formatPdfMoney(cashPurchases + mpesaPurchases));
      drawDataRow('Stock Taken on Supplier Credit (Payables Added)', formatPdfMoney(creditPurchases), false, false, PDF.negative);
      drawDataRow('Supplier Debt Payments Cleared', formatPdfMoney(cashSupplierPay + mpesaSupplierPay));
      // This is the PERIOD's net movement, and it is labelled as such.
      // It used to say "Total Current Supplier Balance Outstanding" while
      // being computed from the date-ranged purchase and payment lists
      // this page already listens to — so a report run for "Today"
      // announced that a shop owed its suppliers almost nothing, and a
      // payment made in the period against a purchase from before it was
      // dropped entirely. What a business owes right now is a balance,
      // not a period figure; the Suppliers page computes it from the
      // whole ledger and remains the place to read it.
      drawDataRow('Net Change in Supplier Credit This Period', formatPdfMoney(creditPurchases - (cashSupplierPay + mpesaSupplierPay)), true);
      y += 3;

      // 6. Top Sellers & Low Stock (compact)
      if (bestSelling.length > 0) {
        drawSectionHeader('5. Top-Performing Product Sales');
        bestSelling.forEach((p, idx) => {
          // Rounded at the point of display: summing decimal quantities
          // across a month accumulates the usual binary noise, and a
          // report that says "50.30900000000001 units" is a bug report.
          drawDataRow(`${idx + 1}. ${p.name} (${roundQuantity(p.qty, 'metre')} units)`, formatPdfMoney(p.revenue));
        });
        y += 3;
      }

      // Footer
      doc.setFontSize(7.5);
      doc.setTextColor(...PDF.ink3);
      doc.text(`Generated on ${formatDateTime(new Date())} · Official Record from FlowBiz Workstation`, marginX, 287);
      doc.text(`Page 1 of 1`, pageWidth - marginX, 287, { align: 'right' });

      // Browser: download or print. Android app: the share sheet, since a
      // WebView can do neither — see platform/files.js.
      const fileName = `flowbiz-report-${preset}-${todayKey()}.pdf`;
      if (action === 'download') {
        await savePdf(doc, fileName, { title: 'FlowBiz report' });
      } else {
        await openForPrint(doc, fileName);
      }
      toast.success('Report ready.');
      setPdfModalOpen(false);
    } catch (err) {
      toast.error('The report could not be generated. Try a shorter date range, or reload the page.');
      console.error(err);
    }
  };

  return (
    // Full width. The tables and strips below run to the edge of the
    // content area, which a centred column would stop short of; the
    // 1800px ceiling lives in AppShell so every page shares one. The
    // profit statement is the exception and caps its own measure — see
    // StatementBlock.
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Where the money went over the period you choose."
        actions={
          <Link to="/advanced-analytics" className="btn-secondary">
            <TrendingUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Advanced analytics
          </Link>
        }
      />

      <Toolbar>
        <SegmentedControl
          ariaLabel="Reporting period"
          options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          value={preset}
          onChange={setPreset}
        />
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input !w-auto"
              value={cStart}
              onChange={(e) => setCStart(e.target.value)}
              aria-label="Start date"
            />
            <span className="text-secondary text-ink-500">to</span>
            <input
              type="date"
              className="input !w-auto"
              value={cEnd}
              onChange={(e) => setCEnd(e.target.value)}
              aria-label="End date"
            />
          </div>
        )}
      </Toolbar>

      <ErrorBanner message={error ? `${error}` : null} />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <Section title="Position">
            <MetricRail columns={4} bleed>
              <Metric label="Cash balance"        prefix={currencyMarker()} value={formatAmount(expectedCashAtClose)} />
              <Metric label={`${tenderLabel('M-Pesa')} balance`}      prefix={currencyMarker()} value={formatAmount(expectedMpesaAtClose)} />
              <Metric label="Credit sales"        prefix={currencyMarker()} value={formatAmount(summary.totalCreditSales)} />
              <Metric label="Repayments collected" prefix={currencyMarker()} value={formatAmount(summary.totalDebtRepayments)} />
            </MetricRail>
          </Section>

          <Section title="How the profit is made">
            <StatementBlock>
              <StatementRow label="Revenue"            prefix={currencyMarker()} value={formatAmount(summary.revenue)} />
              <StatementRow label="Cost of goods sold" prefix={currencyMarker()} value={formatAmount(-summary.costOfGoodsSold)} tone={summary.costOfGoodsSold ? 'negative' : 'muted'} />
              <StatementRow label="Gross profit"       prefix={currencyMarker()} value={formatAmount(summary.grossProfit)} strong />
              <StatementRow label="Total expenses"     prefix={currencyMarker()} value={formatAmount(-summary.totalExpenses)} tone={summary.totalExpenses ? 'negative' : 'muted'} />
              <StatementResult
                label="Net profit"
                prefix={currencyMarker()}
                value={formatAmount(summary.netProfit)}
                tone={summary.netProfit < 0 ? 'negative' : 'positive'}
              />
            </StatementBlock>
          </Section>

          <Section title="Best sellers" hint="By units sold over this period">
            <DataTable
              bleed
              caption="Best selling products over the selected period"
              rows={bestSellers}
              rowKey={(r) => r.name}
              mobileLayout="row"
              columns={[
                {
                  key: 'name',
                  header: 'Product',
                  primary: true,
                  render: (r) => <span className="font-medium text-ink-900">{r.name}</span>,
                },
                { key: 'qty', header: 'Units', numeric: true, mobileTrailing: true, render: (r) => <span className="font-semibold text-ink-900">{roundQuantity(r.qty, 'metre')}</span> },
                { key: 'revenue', header: 'Revenue', numeric: true, mobileTrailing: true, render: (r) => <Money value={r.revenue} /> },
                {
                  key: 'profit',
                  header: 'Profit',
                  numeric: true,
                  render: (r) => (
                    <span className="font-semibold">
                      <Money value={r.profit} tone={r.profit < 0 ? 'negative' : 'positive'} />
                    </span>
                  ),
                },
              ]}
              empty={
                <EmptyState
                  title="No sales in this period"
                  description="Pick a wider date range, or record a sale at the counter."
                />
              }
            />
          </Section>

          {/* The export is an action on this period's data, not on the
              page, so it sits at the end of the data rather than in the
              header — you decide to export after reading the report. */}
          <div className="panel-bleed flex flex-col gap-3 p-4
                          sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body text-ink-600">
              A print-ready accounting statement for this period, including full till reconciliation.
            </p>
            <button
              className="btn-primary shrink-0 sm:w-auto"
              onClick={() => setPdfModalOpen(true)}
            >
              <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Export report
            </button>
          </div>
        </>
      )}

      <Modal open={pdfModalOpen} onClose={() => setPdfModalOpen(false)} title="Export financial report">
        <div className="space-y-3">
          <p className="text-body text-ink-600">A print-ready accounting report for this period, with full till reconciliation and purchases.</p>
          <button className="btn-primary w-full" onClick={() => doExport('download')}>Download PDF</button>
          <button className="btn-secondary w-full" onClick={() => doExport('print')}>Print report</button>
          <button className="btn-ghost w-full" onClick={() => setPdfModalOpen(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}