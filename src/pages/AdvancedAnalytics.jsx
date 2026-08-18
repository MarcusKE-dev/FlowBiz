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

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3 rounded-xl border border-ink-200">
        <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider pl-1">Date Range:</span>
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPeriod(opt.id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${period === opt.id ? 'bg-ink-900 text-white shadow-sm' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}
            >
              {opt.label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-1 animate-fade-in">
              <input type="date" className="input !w-auto !py-1.5 !min-h-0 text-sm" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span className="text-ink-400 text-sm font-medium">to</span>
              <input type="date" className="input !w-auto !py-1.5 !min-h-0 text-sm" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}
        </div>
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
                formatValue={formatKES}
                segments={[
                  { label: 'Cash', value: summary.totalCashSales, colorClassName: 'text-moss-600', dotClassName: 'bg-moss-600' },
                  { label: 'M-Pesa', value: summary.totalMpesaSales, colorClassName: 'text-blue-600', dotClassName: 'bg-blue-600' },
                  { label: 'Credit (uncollected)', value: summary.totalCreditSales, colorClassName: 'text-amber-500', dotClassName: 'bg-amber-500' },
                ]}
              />
              <p className="mt-3 text-[11px] leading-relaxed text-ink-400">Credit isn't counted as revenue until it's repaid — see the Executive Summary below.</p>
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
            <NoData>No outstanding customer balances — nice and clean!</NoData>
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
