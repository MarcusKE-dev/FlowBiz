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
import PlotFrame from '../components/charts/PlotFrame';
import ChartEmpty from '../components/charts/ChartEmpty';
import { isPlottable } from '../components/charts/chartGeometry';
import MiniBarChart from '../components/charts/MiniBarChart';
import DonutChart from '../components/charts/DonutChart';
import { CHART_SERIES, CAUTION, PRIMARY, DEEP, NEGATIVE } from '../theme/tokens';
import UiSection from '../components/ui/Section';
import Toolbar from '../components/ui/Toolbar';
import SegmentedControl from '../components/ui/SegmentedControl';
import PageHeader from '../components/ui/PageHeader';
import { TrendingUp, TrendingDown, Lock, AlertCircle, CheckCircle2, Info, ArrowLeft, ChartArea, ChartLine, ChartColumn } from 'lucide-react';

// How the revenue/profit trend is drawn. Three ways of showing the same
// two series, because "which shape is readable" is a property of the
// reader, not of the data: an area reads as volume, a plain line reads as
// direction, and columns read as discrete periods you can compare one by
// one. The choice is remembered per device — it is a preference about
// eyes, not about the business.
const TREND_VARIANTS = [
  { value: 'area', title: 'Area', label: <ChartArea className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> },
  { value: 'line', title: 'Line', label: <ChartLine className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> },
  { value: 'bars', title: 'Columns', label: <ChartColumn className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> },
];
const TREND_VARIANT_KEY = 'flowbiz_trend_chart_variant';

const PERIOD_OPTIONS = [
  { id: '7', label: '7 Days' },
  { id: '30', label: '30 Days' },
  { id: '90', label: '90 Days' },
  { id: 'custom', label: 'Custom' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
function weekdayIndexNairobi(millis) {
  return new Date(millis + NAIROBI_OFFSET_MS).getUTCDay();
}

function KpiCard({ label, value, tone = 'text-ink-900', deltaPct, sparkline, sparklineColor = PRIMARY, sparklineCaption }) {
  const isPositive = deltaPct !== null && deltaPct !== undefined && deltaPct >= 0;
  return (
    <div className="flex flex-col justify-between bg-surface p-4">
      <p className="text-label uppercase text-ink-500">{label}</p>
      <p className={`num mt-1.5 text-money ${tone}`}>{value}</p>
      {deltaPct !== null && deltaPct !== undefined && Number.isFinite(deltaPct) && (
        <div className={`mt-2 flex items-center gap-1.5 text-secondary font-semibold ${isPositive ? 'text-primary-700' : 'text-danger-600'}`}>
          {isPositive ? <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} /> : <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.5} />}
          <span>{Math.abs(deltaPct).toFixed(1)}% vs prior period</span>
        </div>
      )}
      {/* Bars rather than a line, and captioned. A 36px line with no
          axis, no zero and no unit is a decoration — there is nothing in
          it a reader can name. One bar per period, the latest at full
          strength, with a caption saying what a bar IS, is a shape
          somebody can actually read at this size. */}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-3">
          <MiniBarChart data={sparkline} height={34} color={sparklineColor} compact />
          {sparklineCaption && (
            <p className="mt-1.5 text-label text-ink-400">{sparklineCaption}</p>
          )}
        </div>
      )}
    </div>
  );
}

// Sections sit on the canvas now: no card, no border, and no tinted
// icon chip above the heading. The `icon` prop is accepted and ignored
// so call sites did not all have to change in one go.
function Section({ title, subtitle, action, className = '', children }) {
  return (
    <UiSection title={title} hint={subtitle} action={action} className={className}>
      {children}
    </UiSection>
  );
}

function NoData({ children }) {
  return <div className="py-8 flex flex-col items-center justify-center text-center"><Info className="h-6 w-6 text-ink-300 mb-2" strokeWidth={1.5} /><p className="text-body text-ink-500">{children}</p></div>;
}

// Custom dual-series trend chart. No chart library is installed in this
// project — built the same hand-rolled-SVG way MiniLineChart is, extended
// to plot two series on a shared scale, and sharing MiniLineChart's frame
// so both charts get the same axes, gridlines and hover readout.
function DualTrendChart({ data, series, height = 260, ariaLabel, variant = 'area' }) {
  const all = data ? data.flatMap((d) => series.map((sv) => Number(d[sv.key]) || 0)) : [];
  if (!data || !isPlottable(all)) {
    return <ChartEmpty>Not enough data to chart this period yet.</ChartEmpty>;
  }

  const bars = variant === 'bars';

  // Columns sit in a band they own; lines and areas sit on their points.
  // That is the whole difference between the two branches — the scale,
  // the axes, the gridlines and the readout are the frame's, and are the
  // same whichever shape is on top.
  const groupGeometry = (plot) => {
    const groupW = plot.band * 0.68;
    return { groupW, barW: Math.max(groupW / series.length, 1) };
  };
  const barRect = (d, i, sv, si, { yAt, plot }, extra) => {
    const { groupW, barW } = groupGeometry(plot);
    const zeroY = yAt(0);
    const y = yAt(d[sv.key]);
    return (
      <rect
        key={sv.key}
        x={plot.left + plot.band * i + (plot.band - groupW) / 2 + barW * si}
        y={Math.min(y, zeroY)}
        width={Math.max(barW - 1, 1)}
        height={Math.max(Math.abs(zeroY - y), 1)}
        fill={sv.color}
        rx="1"
        {...extra}
      />
    );
  };

  const renderLines = ({ xAt, yAt, plot }) => (
    <g>
      {series.map((sv) => {
        const pts = data.map((d, i) => ({ x: xAt(i), y: yAt(d[sv.key]) }));
        const line = pts
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ');
        const floor = plot.top + plot.height;
        const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${floor} L ${pts[0].x.toFixed(1)} ${floor} Z`;
        return (
          <g key={sv.key}>
            {/* The fill is what separates "area" from "line": with two
                series stacked in front of each other it reads as volume,
                and without it the two paths read as direction. */}
            {variant === 'area' && <path d={area} fill={sv.color} opacity="0.06" />}
            <path d={line} fill="none" stroke={sv.color} strokeWidth="2.25" />
            {data.length <= 31 && pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={sv.color} />
            ))}
          </g>
        );
      })}
    </g>
  );

  const renderBars = (scales) => (
    <g>
      {data.map((d, i) => (
        <g key={i}>{series.map((sv, si) => barRect(d, i, sv, si, scales))}</g>
      ))}
    </g>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {series.map((sv) => (
          <span key={sv.key} className="flex items-center gap-1.5 text-secondary font-semibold text-ink-600">
            <span className="h-2 w-2 rounded-pill" style={{ background: sv.color }} aria-hidden="true" />
            {sv.label}
          </span>
        ))}
      </div>

      <PlotFrame
        data={data}
        values={all}
        height={height}
        xMode={bars ? 'band' : 'point'}
        ariaLabel={ariaLabel || 'Trend chart'}
        renderSeries={bars ? renderBars : renderLines}
        renderHovered={
          bars
            ? (scales) => (
                <g>
                  {series.map((sv, si) =>
                    barRect(data[scales.i], scales.i, sv, si, scales, {
                      stroke: '#FFFFFF',
                      strokeWidth: '1.5',
                    })
                  )}
                </g>
              )
            : ({ i, xAt, yAt }) => (
                <g>
                  {series.map((sv) => (
                    <circle
                      key={sv.key}
                      cx={xAt(i)}
                      cy={yAt(data[i][sv.key])}
                      r="4.5"
                      fill={sv.color}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  ))}
                </g>
              )
        }
        renderTooltip={(i) => (
          <>
            <div className="font-semibold text-ink-900">{data[i].label}</div>
            {series.map((sv) => (
              <div key={sv.key} className="mt-0.5 flex items-center gap-2 whitespace-nowrap">
                <span className="h-2 w-2 shrink-0 rounded-pill" style={{ background: sv.color }} aria-hidden="true" />
                <span className="text-ink-500">{sv.label}</span>
                <span className="num ml-auto text-ink-900">{formatKES(Number(data[i][sv.key]) || 0)}</span>
              </div>
            ))}
          </>
        )}
      />
    </div>
  );
}

export default function AdvancedAnalytics() {
  const { isPro, businessId } = useAuth();

  const [period, setPeriod] = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Which shape the trend chart is drawn in. Remembered per device, like
  // the dashboard's privacy toggle — it is a preference about how this
  // person reads a chart, not a fact about the business.
  const [trendVariant, setTrendVariant] = useState(() => {
    try { return localStorage.getItem(TREND_VARIANT_KEY) || 'area'; }
    catch { return 'area'; }
  });
  const chooseTrendVariant = (next) => {
    setTrendVariant(next);
    try { localStorage.setItem(TREND_VARIANT_KEY, next); }
    catch (err) { console.error('Failed to save chart style', err); }
  };

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
        <h2 className="font-display text-page-title font-bold text-ink-900">Advanced analytics is a Pro feature</h2>
        <p className="mt-3 text-body text-ink-500 leading-relaxed">See profit margins, capital exposure and staff performance trends over any period. Available on FlowBiz Pro.</p>
        <Link to="/pro" className="mt-8 btn-primary w-full">See FlowBiz Pro</Link>
      </div>
    );
  }

  if (loading) return <div className="py-12"><LoadingSpinner /></div>;

  const margin = summary.revenue > 0 ? (summary.grossProfit / summary.revenue) * 100 : 0;
  const avgTransactionValue = sales.length > 0 ? summary.revenue / sales.length : 0;
  const hasSalesData = sales.length > 0;

  // A caption for the KPI sparklines, so a bar has a stated meaning
  // rather than being a shape the reader has to infer.
  const sparkCaption = `${trend.length} ${granularity === 'week' ? 'weeks' : 'days'}`;

  return (
    // Full width, like every other page: the KPI strips below run to the
    // edge of the content area, which a centred column would stop short of.
    <div className="space-y-6">
      <PageHeader
        title="Advanced analytics"
        description="A deeper look at profit, cash flow, and performance trends."
        actions={
          <Link to="/reports" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Back to reports
          </Link>
        }
      />
      <Toolbar>
        <SegmentedControl
          ariaLabel="Reporting range"
          options={PERIOD_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
          value={period}
          onChange={setPeriod}
        />
        {period === 'custom' && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <input type="date" className="input !w-auto" value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="Start date" />
            <span className="text-secondary text-ink-500">to</span>
            <input type="date" className="input !w-auto" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="End date" />
          </div>
        )}
      </Toolbar>

      <div>
        <h2 className="section-title mb-2">Financial performance</h2>
        <div className="-mx-4 grid grid-cols-2 gap-px overflow-hidden border-y border-line bg-line sm:-mx-6 lg:grid-cols-4">
          <KpiCard sparklineCaption={sparkCaption} label="Recognised revenue" value={formatKES(summary.revenue)} deltaPct={revenueChangePct} sparkline={trend.map((t) => ({ label: t.label, value: t.revenue }))} sparklineColor={PRIMARY} />
          <KpiCard sparklineCaption={sparkCaption} label="Gross profit" value={formatKES(summary.grossProfit)} tone={summary.grossProfit < 0 ? 'text-danger-700' : 'text-primary-700'} sparkline={trend.map((t) => ({ label: t.label, value: t.grossProfit }))} sparklineColor={PRIMARY} />
          <KpiCard sparklineCaption={sparkCaption} label="Net profit" value={formatKES(summary.netProfit)} tone={summary.netProfit < 0 ? 'text-danger-700' : 'text-primary-700'} deltaPct={profitChangePct} sparkline={trend.map((t) => ({ label: t.label, value: t.netProfit }))} sparklineColor={DEEP} />
          <KpiCard sparklineCaption={sparkCaption} label="Profit margin" value={`${margin.toFixed(1)}%`} tone={margin > 20 ? 'text-primary-700' : margin < 10 ? 'text-danger-600' : 'text-ink-900'} sparkline={trend.map((t) => ({ label: t.label, value: t.margin }))} sparklineColor={margin >= 0 ? PRIMARY : NEGATIVE} />
        </div>
      </div>

      <div>
        <h2 className="section-title mb-2">Operational metrics</h2>
        <div className="-mx-4 grid grid-cols-2 gap-px overflow-hidden border-y border-line bg-line sm:-mx-6 lg:grid-cols-4">
          <KpiCard label="Total expenses" value={formatKES(summary.totalExpenses)} tone="text-danger-600" />
          <KpiCard label="Average transaction size" value={hasSalesData ? formatKES(avgTransactionValue) : 'KES 0'} />
          <KpiCard label="Credit issued" value={formatKES(summary.totalCreditSales)} tone="text-warning-600" />
          <KpiCard label="Total outstanding debt" value={formatKES(totalOutstanding)} tone="text-danger-600" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section
          title="Revenue and profit trend"
          subtitle="Recognised revenue against net profit over the selected period"
          className="lg:col-span-2"
          action={hasSalesData ? (
            <SegmentedControl
              ariaLabel="Chart style"
              options={TREND_VARIANTS}
              value={trendVariant}
              onChange={chooseTrendVariant}
            />
          ) : null}
        >
          {hasSalesData ? (
            <DualTrendChart
              data={trend}
              variant={trendVariant}
              series={[
                { key: 'revenue', label: 'Revenue', color: PRIMARY },
                { key: 'netProfit', label: 'Net profit', color: DEEP },
              ]}
              ariaLabel="Revenue vs net profit trend"
            />
          ) : (
            <NoData>Insufficient data to chart trends yet.</NoData>
          )}
        </Section>
        <Section title="Payment mix" subtitle="How sales value was collected this period">
          {(summary.totalCashSales + summary.totalMpesaSales + summary.totalCreditSales) > 0 ? (
            <>
             <DonutChart
                size={150}
                stacked
                formatValue={formatKES}
                segments={[
                  { label: 'Cash', value: summary.totalCashSales, color: PRIMARY },
                  { label: 'M-Pesa', value: summary.totalMpesaSales, color: DEEP },
                  { label: 'Credit (uncollected)', value: summary.totalCreditSales, color: CAUTION },
                ]}
              />
              <p className="mt-3 text-label leading-relaxed text-ink-400">Credit is not counted as revenue until it is repaid.</p>
            </>
          ) : (
            <NoData>No sales recorded yet this period.</NoData>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Volume drivers" subtitle="The products that moved the most units">
          {bestSelling.length > 0 ? (
            <MiniBarChart orientation="horizontal" formatValue={(v) => `${v.toLocaleString()} units`} data={bestSelling.map((p) => ({ label: p.name, value: p.qty, color: PRIMARY }))} />
          ) : (
            <NoData>No product movement detected.</NoData>
          )}
        </Section>
        <Section title="Margin drivers" subtitle="The products that earned the most gross profit">
          {mostProfitable.length > 0 ? (
            <MiniBarChart orientation="horizontal" formatValue={formatKES} data={mostProfitable.map((p) => ({ label: p.name, value: p.profit, color: DEEP }))} />
          ) : (
            <NoData>No profit data generated.</NoData>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Sales by day of the week" subtitle="Average sales value per occurrence of that weekday">
          {weekdayBest ? (
            <MiniBarChart orientation="vertical" formatValue={formatKES} data={weekdayPerformance} ariaLabel="Sales by day of week" />
          ) : (
            <NoData>No sales activity recorded yet this period.</NoData>
          )}
        </Section>
        <Section title="Expense breakdown" subtitle="Where operating costs went this period">
          {expenseByCategory.length > 0 ? (
            <DonutChart
              size={150}
              formatValue={formatKES}
              segments={expenseByCategory.map((e, i) => ({ label: e.label, value: e.value, color: CHART_SERIES[i % CHART_SERIES.length] }))}
            />
          ) : (
            <NoData>No expenses recorded this period.</NoData>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Capital and credit exposure" subtitle="Cash tied up in customer credit">
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between border-b border-divider pb-3 text-body">
              <span className="text-ink-600 font-medium">Credit Issued (This Period)</span>
              <span className="font-semibold text-ink-900">{formatKES(summary.totalCreditSales)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-divider pb-3 text-body">
              <span className="text-ink-600 font-medium">Debt Collected (This Period)</span>
              <span className="font-semibold text-primary-700">{formatKES(summary.totalDebtRepayments)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 text-body bg-danger-50 p-3 rounded-panel border border-danger-100">
              <span className="font-bold text-danger-800 uppercase tracking-wide text-secondary">Total outstanding</span>
              <span className="num text-money font-bold text-danger-700">{formatKES(totalOutstanding)}</span>
            </div>
          </div>
        </Section>
        <Section title="Top debtors" subtitle="Customers with the highest outstanding balance">
          {topDebtors.length > 0 ? (
            <div className="space-y-1">
              {topDebtors.map((d, i) => (
                <Link key={d.customerId || d.name} to={d.customerId ? `/customers/${d.customerId}` : '/customers'} className="flex items-center justify-between gap-3 rounded-panel px-2 py-2.5 hover:bg-ink-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger-50 text-secondary font-bold text-danger-700">{i + 1}</span>
                    <span className="truncate text-body font-medium text-ink-800">{d.name}</span>
                  </div>
                  <span className="shrink-0 text-body font-bold text-danger-600">{formatKES(d.balance)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <NoData>No outstanding customer balances, nice and clean!</NoData>
          )}
        </Section>
      </div>

      <Section title="Staff performance" subtitle="Revenue by cashier">
        {staffPerformance.length === 0 ? (
          <NoData>No staff attribution data found.</NoData>
        ) : (
          <div className="panel-bleed overflow-x-auto">
            <table className="w-full min-w-[22rem] text-body text-left">
              <thead className="bg-ink-50 text-secondary uppercase tracking-wider font-semibold text-ink-500">
                <tr><th className="px-4 py-3 border-b border-line">Staff member</th><th className="px-4 py-3 border-b border-line text-right">Items sold</th><th className="px-4 py-3 border-b border-line text-right">Revenue</th></tr>
              </thead>
              <tbody className="divide-y divide-divider bg-white">
                {staffPerformance.map((st, i) => (
                  <tr key={st.name} className="hover:bg-ink-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-ink-900">
                      {st.name}
                      {i === 0 && <span className="ml-2 text-label font-semibold text-warning-700">Top</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-600">{st.qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary-700">{formatKES(st.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Summary" subtitle="What the figures above add up to">
        {insights.length > 0 ? (
          <div className="space-y-3 pt-1">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 text-body bg-ink-50 p-3 rounded-panel border border-divider">
                <div className="shrink-0 mt-0.5">
                  {insight.tone === 'positive' ? <CheckCircle2 className="h-5 w-5 text-primary-600" strokeWidth={1.75} /> :
                   insight.tone === 'negative' ? <AlertCircle className="h-5 w-5 text-danger-600" strokeWidth={2} /> :
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
