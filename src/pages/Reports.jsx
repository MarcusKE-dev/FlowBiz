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

const PRESETS = [{id:'today',label:'Today'},{id:'week',label:'This Week'},{id:'month',label:'This Month'},{id:'custom',label:'Custom'}];

function Card({ label, value, tone='text-ink-900' }) {
  return <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p><p className={`mt-1 font-display text-lg font-bold ${tone}`}>{value}</p></div>;
}

export default function Reports() {
  const { businessId, isPro } = useAuth();
  const [preset, setPreset]         = useState('today');
  const [cStart, setCStart]         = useState('');
  const [cEnd,   setCEnd]           = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const { start, end } = useMemo(() => {
    if (preset==='custom'&&cStart&&cEnd) return { start:startOfDay(new Date(cStart)), end:endOfDay(new Date(cEnd)) };
    return getRangeForPreset(preset==='custom'?'today':preset);
  }, [preset,cStart,cEnd]);

  const { loading, error, sales, creditSales, summary } = useFinancialsForRange(start, end);
  const { session } = useDailySession();
  const { settings } = useSettings();

  // FIX: Matches Dashboard and Products exactly to utilize correct offline index
  const productsQ = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  
  const purchasesQ = useMemo(() => businessId ? tenantQuery('purchases', businessId, where('paymentStatus', '==', 'pending_supplier_credit')) : null, [businessId]);
  const outstandingCreditQ = useMemo(() => businessId ? tenantQuery('creditSales', businessId, where('status', 'in', ['pending', 'partial'])) : null, [businessId]);
  const supplierPaymentsQ = useMemo(() => businessId ? tenantQuery('supplierPayments', businessId) : null, [businessId]);
  const suppliersQ = useMemo(() => businessId ? tenantQuery('suppliers', businessId) : null, [businessId]);

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

  // FIX: Added Credit Sales to product performance mapping
  //
  // FIX (multi-product cart): a Counter.jsx cart sale carries several
  // products on ONE sale/creditSale doc via `items` — attributing the
  // whole doc's aggregate quantity/revenue/profit to its (misleading)
  // summary productName would badly skew best-seller/most-profitable
  // rankings. When `items` is present, each line item is credited to its
  // own product individually instead; legacy single-product docs (no
  // `items` field) are read exactly as before.
  const productPerf = useMemo(() => {
    const m = {};
    const ensure = (name) => {
      if (!m[name]) m[name] = { name, qty: 0, revenue: 0, profit: 0 };
      return m[name];
    };
    sales.forEach((s) => {
      if (s.isVoided) return;
      if (Array.isArray(s.items) && s.items.length > 0) {
        s.items.forEach((it) => {
          const row = ensure(it.productName);
          row.qty     += Number(it.quantity) || 0;
          row.revenue += Number(it.lineTotal ?? ((it.quantity || 0) * (it.unitPrice || 0))) || 0;
          row.profit  += Number(it.lineProfit ?? (((it.unitPrice || 0) - (it.costPrice || 0)) * (it.quantity || 0))) || 0;
        });
      } else {
        const row = ensure(s.productName);
        row.qty     += Number(s.quantity) || 0;
        row.revenue += Number(s.totalAmount) || 0;
        row.profit  += Number(s.profit) || 0;
      }
    });
    creditSales.forEach((cs) => {
      if (cs.status === 'cancelled' || cs.status === 'refunded') return;
      if (Array.isArray(cs.items) && cs.items.length > 0) {
        cs.items.forEach((it) => {
          const row = ensure(it.productName);
          row.qty += Number(it.quantity) || 0;
          // Revenue and Profit are zero until repaid via repayments collection
        });
      } else {
        const row = ensure(cs.productName);
        row.qty += Number(cs.quantity) || 0;
        // Revenue and Profit are zero until repaid via repayments collection
      }
    });
    return Object.values(m);
  }, [sales, creditSales]);

  const bestSelling    = [...productPerf].sort((a,b)=>b.qty-a.qty).slice(0,5);
  const mostProfitable = [...productPerf].sort((a,b)=>b.profit-a.profit).slice(0,5);

  const { expectedCashAtClose, expectedMpesaAtClose } = computeExpectedTillBalances({
    openingCashFloat:         preset === 'today' ? (session?.openingCashFloat || 0) : 0,
    openingMpesaFloat:        preset === 'today' ? (session?.openingMpesaFloat || 0) : 0,
    totalCashSales:           summary.totalCashSales,
    totalMpesaSales:          summary.totalMpesaSales,
    totalDebtRepaymentsCash:  summary.totalDebtRepaymentsCash,
    totalDebtRepaymentsMpesa: summary.totalDebtRepaymentsMpesa,
    totalExpensesCash:        summary.totalExpensesCash,
    totalExpensesMpesa:       summary.totalExpensesMpesa,
    totalCashOutflows:        summary.totalCashOutflows,
    totalMpesaOutflows:       summary.totalMpesaOutflows,
  });

  const businessName = settings?.shopName || 'FlowBiz Store';

  const doExport = async (action) => {
    if (!isPro) { toast.error("Professional reports require FlowBiz Pro."); return; }
    try {
      const { jsPDF } = await import('jspdf');
      const { loadImageAsDataUrl } = await import('../utils/documentService');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 15;
      let y = 15;

      const logoDataUrl = await loadImageAsDataUrl(settings.logoUrl);
      if (logoDataUrl) {
        const format = logoDataUrl.match(/data:image\/(\w+);/)?.[1]?.toUpperCase() || 'PNG';
        try { doc.addImage(logoDataUrl, format, marginX, y, 18, 18); } catch (err) { console.error('Logo embed failed:', err); }
      }

      const textX = logoDataUrl ? marginX + 24 : marginX;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(businessName, textX, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(`FlowBiz Financial Report · ${formatDate(start)} — ${formatDate(end)}`, textX, y + 13);
      doc.setTextColor(0, 0, 0);
      y += 26;

      doc.setDrawColor(210, 210, 210);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 8;

      const sectionTitle = (title) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(title, marginX, y);
        y += 6;
        doc.setDrawColor(230, 230, 230);
        doc.line(marginX, y - 3.5, pageWidth - marginX, y - 3.5);
      };

      const row = (label, value, opts = {}) => {
        doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
        doc.setFontSize(10);
        doc.text(label, marginX, y);
        doc.text(value, pageWidth - marginX, y, { align: 'right' });
        y += 6.5;
      };

      sectionTitle('Financial Summary');
      row('Cash balance', formatKES(expectedCashAtClose));
      row('M-Pesa balance', formatKES(expectedMpesaAtClose));
      row('Credit sales (this period)', formatKES(summary.totalCreditSales));
      row('Debt repayments collected', formatKES(summary.totalDebtRepayments));
      y += 4;

      sectionTitle('Profit Calculation');
      row('Revenue', formatKES(summary.revenue));
      row('Cost of goods sold', `- ${formatKES(summary.costOfGoodsSold)}`);
      row('Gross profit', formatKES(summary.grossProfit), { bold: true });
      row('Total expenses', `- ${formatKES(summary.totalExpenses)}`);
      row('Net profit', formatKES(summary.netProfit), { bold: true });
      y += 4;

      if (bestSelling.length > 0) {
        sectionTitle('Top Selling Products');
        bestSelling.forEach((p) => row(p.name, `${p.qty} sold · ${formatKES(p.revenue)}`));
        y += 4;
      }

      if (lowStock.length > 0) {
        sectionTitle('Low Stock Alerts');
        lowStock.slice(0, 10).forEach((p) => row(p.name, `${p.stock} left`));
        y += 4;
      }

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated ${formatDateTime(new Date())} · FlowBiz`, marginX, 287);

      if (action === 'download') {
        doc.save(`flowbiz-report-${preset}-${todayKey()}.pdf`);
      } else {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      }
      toast.success('Report generated successfully.');
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
        {PRESETS.map(p=>(
          <button key={p.id} onClick={()=>setPreset(p.id)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${preset===p.id?'bg-ink-900 text-white':'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>{p.label}</button>
        ))}
        {preset==='custom'&&(
          <div className="flex items-center gap-2">
            <input type="date" className="input !w-auto" value={cStart} onChange={e=>setCStart(e.target.value)} />
            <span className="text-ink-400">to</span>
            <input type="date" className="input !w-auto" value={cEnd} onChange={e=>setCEnd(e.target.value)} />
          </div>
        )}
      </div>

      <ErrorBanner message={error ? `${error}` : null} />
      
      {loading ? <LoadingSpinner /> : (
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
                ['Revenue',               summary.revenue,             false],
                ['− Cost of goods sold',  -summary.costOfGoodsSold,    false],
                ['= Gross profit',        summary.grossProfit,          true ],
                ['− Total expenses',      -summary.totalExpenses,       false],
                ['= Net profit',          summary.netProfit,            true ],
              ].map(([label,value,bold],i)=>(
                <div key={label} className={`flex items-center justify-between px-4 py-3 ${bold?'bg-ink-50/60':''}`}>
                  <span className={`text-sm ${bold?'font-bold text-ink-900':'text-ink-600'}`}>{label}</span>
                  <span className={`font-semibold ${value<0?'text-rust-600':i===4?'text-moss-700':'text-ink-800'}`}>{formatKES(value)}</span>
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

      <Modal open={pdfModalOpen} onClose={() => setPdfModalOpen(false)} title="Get PDF Report">
        <div className="space-y-3">
          <p className="text-sm text-ink-500 mb-4">Choose how you want to export your professional financial report.</p>
          <button className="btn-primary w-full" onClick={() => doExport('download')}>Download PDF</button>
          <button className="btn-outline w-full" onClick={() => doExport('print')}>Print Report</button>
          <button className="btn-secondary w-full mt-2" onClick={() => setPdfModalOpen(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
