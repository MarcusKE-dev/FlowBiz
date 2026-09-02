import { useMemo, useState } from 'react';
import { where, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useFinancialsForRange } from '../hooks/useFinancials';
import { useDailySession } from '../hooks/useDailySession';
import { useSettings } from '../contexts/SettingsContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorBanner from '../components/common/ErrorBanner';
import Modal from '../components/common/Modal';
import { formatKES } from '../utils/currency';
import { formatDate, formatDateTime, getRangeForPreset, startOfDay, endOfDay, todayKey } from '../utils/dateRanges';
import { computeSupplierBalances, computeExpectedTillBalances } from '../utils/financials';
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
import { amountOnly } from '../components/ui/format';
import toast from 'react-hot-toast';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
];

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

  // Query kept (it feeds the PDF export path); the list itself is no
  // longer read on screen since inventory value moved to Dashboard.
  useFirestoreCollection(productsQ);
  const { data: purchasesData } = useFirestoreCollection(purchasesQ);
  useFirestoreCollection(outstandingCreditQ);
  const { data: supplierPaymentsData } = useFirestoreCollection(supplierPaymentsQ);
  const { data: suppliersData } = useFirestoreCollection(suppliersQ);

  const bestSellers = useMemo(() => {
    const map = {};
    const ensure = (name) => {
      const key = name || 'Unnamed product';
      if (!map[key]) map[key] = { name: key, qty: 0, revenue: 0, profit: 0 };
      return map[key];
    };
    (sales || []).forEach((sale) => {
      if (sale.isVoided) return;
      if (Array.isArray(sale.items) && sale.items.length > 0) {
        sale.items.forEach((it) => {
          const row = ensure(it.productName);
          row.qty += Number(it.quantity) || 0;
          row.revenue += Number(it.lineTotal ?? ((it.quantity || 0) * (it.unitPrice || 0))) || 0;
          row.profit += Number(it.lineProfit ?? (((it.unitPrice || 0) - (it.costPrice || 0)) * (it.quantity || 0))) || 0;
        });
      } else {
        const row = ensure(sale.productName);
        row.qty += Number(sale.quantity) || 0;
        row.revenue += Number(sale.totalAmount) || 0;
        row.profit += Number(sale.profit) || 0;
      }
    });
    (creditSales || []).forEach((cs) => {
      if (cs.status === 'cancelled' || cs.status === 'refunded') return;
      if (Array.isArray(cs.items) && cs.items.length > 0) {
        cs.items.forEach((it) => { ensure(it.productName).qty += Number(it.quantity) || 0; });
      } else {
        ensure(cs.productName).qty += Number(cs.quantity) || 0;
      }
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [sales, creditSales]);

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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Reports"
        description="Where the money went over the period you choose."
        actions={
          <>
            <Link to="/advanced-analytics" className="btn-secondary">
              <TrendingUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Advanced analytics
            </Link>
            <button className="btn-primary" onClick={() => setPdfModalOpen(true)}>
              <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Export report
            </button>
          </>
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
            <MetricRail columns={4}>
              <Metric label="Cash balance"        prefix="KES" value={amountOnly(expectedCashAtClose)} />
              <Metric label="M-Pesa balance"      prefix="KES" value={amountOnly(expectedMpesaAtClose)} />
              <Metric label="Credit sales"        prefix="KES" value={amountOnly(summary.totalCreditSales)} />
              <Metric label="Repayments collected" prefix="KES" value={amountOnly(summary.totalDebtRepayments)} />
            </MetricRail>
          </Section>

          <Section title="How the profit is made">
            <StatementBlock>
              <StatementRow label="Revenue"            prefix="KES" value={amountOnly(summary.revenue)} />
              <StatementRow label="Cost of goods sold" prefix="KES" value={amountOnly(-summary.costOfGoodsSold)} tone={summary.costOfGoodsSold ? 'negative' : 'muted'} />
              <StatementRow label="Gross profit"       prefix="KES" value={amountOnly(summary.grossProfit)} strong />
              <StatementRow label="Total expenses"     prefix="KES" value={amountOnly(-summary.totalExpenses)} tone={summary.totalExpenses ? 'negative' : 'muted'} />
              <StatementResult
                label="Net profit"
                prefix="KES"
                value={amountOnly(summary.netProfit)}
                tone={summary.netProfit < 0 ? 'negative' : 'positive'}
              />
            </StatementBlock>
          </Section>

          <Section title="Best sellers" hint="By units sold over this period">
            <DataTable
              caption="Best selling products over the selected period"
              rows={bestSellers}
              rowKey={(r) => r.name}
              columns={[
                {
                  key: 'name',
                  header: 'Product',
                  primary: true,
                  render: (r) => <span className="font-medium text-ink-900">{r.name}</span>,
                },
                { key: 'qty', header: 'Units', numeric: true, render: (r) => <span className="font-semibold text-ink-900">{r.qty}</span> },
                { key: 'revenue', header: 'Revenue', numeric: true, render: (r) => <Money value={r.revenue} /> },
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