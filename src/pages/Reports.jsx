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