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

const PERIOD_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

function KpiCard({ label, value, tone = 'text-ink-900', deltaPct }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${tone}`}>{value}</p>
      {deltaPct !== null && deltaPct !== undefined && Number.isFinite(deltaPct) && (
        <p className={`mt-1 text-xs font-semibold ${deltaPct >= 0 ? 'text-moss-700' : 'text-rust-600'}`}>
          {deltaPct >= 0 ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}% vs previous period
        </p>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="card p-4 sm:p-5">
      <h2 className="font-display text-sm font-bold text-ink-800">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function NoData({ children }) {
  return <p className="py-6 text-center text-sm text-ink-400">{children}</p>;
}

export default function AdvancedAnalytics() {
  const { isPro, businessId } = useAuth();
  const [periodDays, setPeriodDays] = useState(30);

  const range = useMemo(() => {
    const end = endOfDay();
    const start = startOfDay(new Date(Date.now() - (periodDays - 1) * 86400000));
    return { start, end };
  }, [periodDays]);

  const prevRange = useMemo(() => {
    const prevEnd = endOfDay(new Date(range.start.getTime() - 1));
    const prevStart = startOfDay(new Date(range.start.getTime() - periodDays * 86400000));
    return { start: prevStart, end: prevEnd };
  }, [range, periodDays]);

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

  const granularity = periodDays > 45 ? 'week' : 'day';
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

  // FIX: Properly map credit sales into the active product volume calculation
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
      list.push({ tone: revenueChangePct >= 0 ? 'positive' : 'negative', text: `Revenue is ${revenueChangePct >= 0 ? 'up' : 'down'} ${Math.abs(revenueChangePct).toFixed(1)}% compared to the previous ${periodDays}-day period.` });
    }
    if (profitChangePct !== null) {
      list.push({ tone: profitChangePct >= 0 ? 'positive' : 'negative', text: `Net profit is ${profitChangePct >= 0 ? 'up' : 'down'} ${Math.abs(profitChangePct).toFixed(1)}% compared to the previous period.` });
    }
    if (mostProfitable[0]) {
      list.push({ tone: 'neutral', text: `"${mostProfitable[0].name}" generated the most gross profit this period (${formatKES(mostProfitable[0].profit)}).` });
    }
    const salesActivity = summary.revenue + summary.totalCreditSales;
    if (salesActivity > 0 && summary.totalCreditSales > 0) {
      const pct = (summary.totalCreditSales / salesActivity) * 100;
      list.push({ tone: pct > 30 ? 'negative' : 'neutral', text: `Credit sales made up ${pct.toFixed(0)}% of this period's sales activity.` });
    }
    if (totalOutstanding > 0) {
      list.push({ tone: 'neutral', text: `${formatKES(totalOutstanding)} is currently outstanding across all customers on credit.` });
    }
    return list;
  }, [revenueChangePct, profitChangePct, mostProfitable, summary, totalOutstanding, periodDays]);

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
        <div className="h-16 w-16 bg-ink-100 text-ink-400 rounded-full flex items-center justify-center mb-4 font-bold text-2xl">?</div>
        <h2 className="font-display text-xl font-bold text-ink-900">FlowBiz Pro Required</h2>
        <p className="mt-2 text-sm text-ink-500">Advanced Analytics gives you deep insights into sales patterns, staff performance, and profit margins. Upgrade to Pro to unlock.</p>
        <Link to="/pro" className="mt-6 btn-primary w-full">Explore Pro</Link>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  const margin = summary.revenue > 0 ? (summary.grossProfit / summary.revenue) * 100 : 0;
  const avgTransactionValue = sales.length > 0 ? summary.revenue / sales.length : 0;
  const hasSalesData = sales.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Advanced Analytics</h1>
          <p className="text-sm text-ink-400">Business health for the selected period</p>
        </div>
        <Link to="/reports" className="btn-outline text-xs">Back to Reports</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setPeriodDays(opt.days)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${periodDays === opt.days ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Revenue" value={formatKES(summary.revenue)} deltaPct={revenueChangePct} />
        <KpiCard label="Gross Profit" value={formatKES(summary.grossProfit)} tone="text-moss-700" />
        <KpiCard label="Net Profit" value={formatKES(summary.netProfit)} tone="text-moss-700" deltaPct={profitChangePct} />
        <KpiCard label="Profit Margin" value={`${margin.toFixed(1)}%`} />
        <KpiCard label="Expenses" value={formatKES(summary.totalExpenses)} tone="text-rust-600" />
        <KpiCard label="Avg Transaction Value" value={hasSalesData ? formatKES(avgTransactionValue) : 'KES 0'} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Sales Trend" subtitle="Recognized revenue per period">
          {hasSalesData ? (
            <MiniLineChart data={trend.map((t) => ({ label: t.label, value: t.revenue }))} formatValue={formatKES} ariaLabel="Sales trend" />
          ) : (
            <NoData>Not enough sales data yet. Continue recording sales to see this trend.</NoData>
          )}
        </Section>
        <Section title="Profit Trend" subtitle="Net profit per period">
          {hasSalesData ? (
            <MiniBarChart data={trend.map((t) => ({ label: t.label, value: t.netProfit }))} orientation="vertical" formatValue={formatKES} ariaLabel="Profit trend" />
          ) : (
            <NoData>Not enough data yet to chart profit over time.</NoData>
          )}
        </Section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Payment Method Breakdown">
          {summary.totalCashSales + summary.totalMpesaSales + summary.totalCreditSales > 0 ? (
            <DonutChart
              formatValue={formatKES}
              segments={[
                { label: 'Cash', value: summary.totalCashSales, colorClassName: 'text-blue-600', dotClassName: 'bg-blue-600' },
                { label: 'M-Pesa', value: summary.totalMpesaSales, colorClassName: 'text-ink-500', dotClassName: 'bg-ink-500' },
                { label: 'Credit', value: summary.totalCreditSales, colorClassName: 'text-rust-400', dotClassName: 'bg-rust-400' },
              ]}
            />
          ) : (
            <NoData>No sales recorded in this period yet.</NoData>
          )}
        </Section>
        <Section title="Credit Intelligence" subtitle="How much money is tied up in credit">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">Credit issued this period</span>
              <span className="font-semibold text-ink-800">{formatKES(summary.totalCreditSales)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">Repayments collected this period</span>
              <span className="font-semibold text-moss-700">{formatKES(summary.totalDebtRepayments)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
              <span className="font-semibold text-ink-700">Outstanding across all customers</span>
              <span className="font-bold text-rust-600">{formatKES(totalOutstanding)}</span>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Best-Selling Products" subtitle="By quantity sold">
          {bestSelling.length > 0 ? (
            <MiniBarChart orientation="horizontal" formatValue={(v) => `${v} sold`} data={bestSelling.map((p) => ({ label: p.name, value: p.qty }))} />
          ) : (
            <NoData>No product sales in this period yet.</NoData>
          )}
        </Section>
        <Section title="Most Profitable Products" subtitle="By gross profit">
          {mostProfitable.length > 0 ? (
            <MiniBarChart orientation="horizontal" formatValue={formatKES} data={mostProfitable.map((p) => ({ label: p.name, value: p.profit, colorClassName: 'bg-moss-600' }))} />
          ) : (
            <NoData>No product sales in this period yet.</NoData>
          )}
        </Section>
      </div>

      <Section title="Business Insights" subtitle="What's changed and what deserves attention">
        {insights.length > 0 ? (
          <ul className="space-y-2.5">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    insight.tone === 'positive' ? 'bg-moss-600' : insight.tone === 'negative' ? 'bg-rust-500' : 'bg-blue-500'
                  }`}
                />
                <span className="text-ink-700">{insight.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <NoData>Insights will appear here once there's enough activity to compare against the previous period.</NoData>
        )}
      </Section>

      <Section title="Staff Sales Performance">
        {staffPerformance.length === 0 ? (
          <NoData>No staff sales data for this period.</NoData>
        ) : (
          <div className="divide-y divide-ink-100">
            {staffPerformance.map((st) => (
              <div key={st.name} className="flex justify-between py-2.5 text-sm">
                <span className="font-semibold text-ink-800">{st.name}</span>
                <span className="text-ink-600">{formatKES(st.revenue)} ({st.qty} items)</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}