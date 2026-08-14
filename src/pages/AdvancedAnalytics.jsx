import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useFinancialsForRange } from '../hooks/useFinancials';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { tenantQuery } from '../lib/tenant';
import { startOfDay, endOfDay, buildDateBuckets, toMillisValue } from '../utils/dateRanges';
import { formatKES } from '../utils/currency';
import { computeFinancials } from '../utils/financials';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MiniLineChart from '../components/charts/MiniLineChart';
import MiniBarChart from '../components/charts/MiniBarChart';
import DonutChart from '../components/charts/DonutChart';
import { TrendingUp, TrendingDown, Lock, AlertCircle, CheckCircle2, Info, ArrowLeft } from 'lucide-react';

const PERIOD_OPTIONS = [
  { id: '7', label: '7 Days' },
  { id: '30', label: '30 Days' },
  { id: '90', label: '90 Days' },
  { id: 'custom', label: 'Custom' },
];

function KpiCard({ label, value, tone = 'text-ink-900', deltaPct }) {
  const isPositive = deltaPct !== null && deltaPct >= 0;
  const isNegative = deltaPct !== null && deltaPct < 0;

  return (
    <div className="card p-4 sm:p-5 flex flex-col justify-between bg-white hover:shadow-md transition-shadow">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <div className="mt-2">
        <p className={`font-display text-xl sm:text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
      </div>
      {deltaPct !== null && deltaPct !== undefined && Number.isFinite(deltaPct) && (
        <div className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${isPositive ? 'text-moss-700' : 'text-rust-600'}`}>
          {isPositive ? <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} /> : <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.5} />}
          <span>{Math.abs(deltaPct).toFixed(1)}% vs prior period</span>
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="card p-5 bg-white">
      <div className="mb-4 border-b border-ink-100 pb-3">
        <h2 className="font-display text-sm font-bold text-ink-900 uppercase tracking-wide">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-ink-500">{subtitle}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function NoData({ children }) {
  return <div className="py-8 flex flex-col items-center justify-center text-center"><Info className="h-6 w-6 text-ink-300 mb-2" strokeWidth={1.5}/><p className="text-sm text-ink-500">{children}</p></div>;
}

export default function AdvancedAnalytics() {
  const { isPro, businessId } = useAuth();
  
  const [period, setPeriod] = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const range = useMemo(() => {
    if (period === 'custom' && customStart && customEnd) {
      return { start: startOfDay(new Date(customStart)), end: endOfDay(new Date(customEnd)) };
    }
    const days = Number(period) || 30;
    return { start: startOfDay(new Date(Date.now() - (days - 1) * 86400000)), end: endOfDay() };
  }, [period, customStart, customEnd]);

  const prevRange = useMemo(() => {
    if (period === 'custom' && customStart && customEnd) {
      const diff = range.end.getTime() - range.start.getTime();
      const prevEnd = new Date(range.start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - diff);
      return { start: startOfDay(prevStart), end: endOfDay(prevEnd) };
    }
    const days = Number(period) || 30;
    const prevEnd = endOfDay(new Date(range.start.getTime() - 1));
    const prevStart = startOfDay(new Date(range.start.getTime() - days * 86400000));
    return { start: prevStart, end: prevEnd };
  }, [range, period, customStart, customEnd]);

  const { loading, sales, creditSales, expenses, repayments, summary } = useFinancialsForRange(range.start, range.end);
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

  const granularity = (range.end.getTime() - range.start.getTime()) > (45 * 86400000) ? 'week' : 'day';
  const buckets = useMemo(() => buildDateBuckets(range.start, range.end, granularity), [range, granularity]);

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
      return { label: bucket.label, revenue: f.revenue, netProfit: f.netProfit };
    });
  }, [buckets, sales, expenses, repayments, allCreditSales]);

  const productPerf = useMemo(() => {
    const map = {};
    (sales || []).forEach((s) => {
      if (s.isVoided) return;
      if (!map[s.productName]) map[s.productName] = { name: s.productName, qty: 0, revenue: 0, profit: 0 };
      map[s.productName].qty += Number(s.quantity) || 0;
      map[s.productName].revenue += Number(s.totalAmount) || 0;
      map[s.productName].profit += Number(s.profit) || 0;
    });
    (creditSales || []).forEach((cs) => {
      if (cs.status === 'cancelled' || cs.status === 'refunded') return;
      if (!map[cs.productName]) map[cs.productName] = { name: cs.productName, qty: 0, revenue: 0, profit: 0 };
      map[cs.productName].qty += Number(cs.quantity) || 0;
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
    const salesActivity = summary.revenue + summary.totalCreditSales;
    if (salesActivity > 0 && summary.totalCreditSales > 0) {
      const pct = (summary.totalCreditSales / salesActivity) * 100;
      list.push({ tone: pct > 30 ? 'negative' : 'neutral', text: `Credit exposure: ${pct.toFixed(0)}% of sales activity was issued on credit.` });
    }
    return list;
  }, [revenueChangePct, profitChangePct, mostProfitable, summary, period]);

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

  const margin = summary.revenue > 0 ? (summary.grossProfit / summary.revenue) * 100 : 0;
  const avgTransactionValue = sales.length > 0 ? summary.revenue / sales.length : 0;
  const hasSalesData = sales.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 tracking-tight">Advanced Analytics</h1>
          <p className="text-sm text-ink-500 mt-1">Deep financial insights and performance tracking.</p>
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
              <input type="date" className="input !w-auto !py-1.5 !min-h-0 text-sm" value={customStart} onChange={e=>setCustomStart(e.target.value)} />
              <span className="text-ink-400 text-sm font-medium">to</span>
              <input type="date" className="input !w-auto !py-1.5 !min-h-0 text-sm" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {loading ? <div className="py-12"><LoadingSpinner /></div> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Recognized Revenue" value={formatKES(summary.revenue)} deltaPct={revenueChangePct} />
            <KpiCard label="Gross Profit" value={formatKES(summary.grossProfit)} tone="text-moss-700" />
            <KpiCard label="Net Profit" value={formatKES(summary.netProfit)} tone="text-moss-700" deltaPct={profitChangePct} />
            <KpiCard label="Profit Margin" value={`${margin.toFixed(1)}%`} tone={margin > 20 ? 'text-moss-700' : margin < 10 ? 'text-rust-600' : 'text-ink-900'} />
            <KpiCard label="Total Expenses" value={formatKES(summary.totalExpenses)} tone="text-rust-600" />
            <KpiCard label="Avg Transaction Size" value={hasSalesData ? formatKES(avgTransactionValue) : 'KES 0'} />
            <KpiCard label="Credit Issued" value={formatKES(summary.totalCreditSales)} tone="text-amber-600" />
            <KpiCard label="Total Outstanding Debt" value={formatKES(totalOutstanding)} tone="text-rust-600" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Revenue Trajectory" subtitle="Recognized revenue tracking over selected period">
              {hasSalesData ? (
                <MiniLineChart data={trend.map((t) => ({ label: t.label, value: t.revenue }))} formatValue={formatKES} ariaLabel="Sales trend" colorClassName="text-moss-600" />
              ) : (
                <NoData>Insufficient data to chart trajectory.</NoData>
              )}
            </Section>
            <Section title="Net Profit Trend" subtitle="Actual profit realized after expenses">
              {hasSalesData ? (
                <MiniBarChart data={trend.map((t) => ({ label: t.label, value: t.netProfit }))} orientation="vertical" formatValue={formatKES} ariaLabel="Profit trend" />
              ) : (
                <NoData>Insufficient data to chart profit.</NoData>
              )}
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Volume Drivers" subtitle="Highest quantity moved">
              {bestSelling.length > 0 ? (
                <MiniBarChart orientation="horizontal" formatValue={(v) => `${v.toLocaleString()} units`} data={bestSelling.map((p) => ({ label: p.name, value: p.qty, colorClassName: 'bg-ink-800' }))} />
              ) : (
                <NoData>No product movement detected.</NoData>
              )}
            </Section>
            <Section title="Margin Drivers" subtitle="Highest gross profit generated">
              {mostProfitable.length > 0 ? (
                <MiniBarChart orientation="horizontal" formatValue={formatKES} data={mostProfitable.map((p) => ({ label: p.name, value: p.profit, colorClassName: 'bg-moss-600' }))} />
              ) : (
                <NoData>No profit data generated.</NoData>
              )}
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Capital & Credit Exposure" subtitle="Liquidity analysis">
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

            <Section title="Executive Summary" subtitle="Automated business intelligence">
              {insights.length > 0 ? (
                <div className="space-y-4 pt-1">
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

          <Section title="Staff Performance Index" subtitle="Revenue attribution by cashier">
            {staffPerformance.length === 0 ? (
              <NoData>No staff attribution data found.</NoData>
            ) : (
              <div className="overflow-hidden rounded-lg border border-ink-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-ink-50 text-xs uppercase tracking-wider font-semibold text-ink-500">
                    <tr><th className="px-4 py-3 border-b border-ink-200">Staff Member</th><th className="px-4 py-3 border-b border-ink-200 text-right">Items Sold</th><th className="px-4 py-3 border-b border-ink-200 text-right">Revenue Generated</th></tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {staffPerformance.map((st) => (
                      <tr key={st.name} className="hover:bg-ink-50/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-ink-900">{st.name}</td>
                        <td className="px-4 py-3 text-right text-ink-600">{st.qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-semibold text-moss-700">{formatKES(st.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}