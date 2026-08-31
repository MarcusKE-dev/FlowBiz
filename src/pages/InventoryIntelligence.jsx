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
              <p className="mt-3 text-[11px] leading-relaxed text-ink-400">Based on sales value over the last {LOOKBACK_DAYS} days. "A" products drive roughly 80% of your sales value, protect their stock levels first.</p>
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
        <Section title="Reorder Priority" subtitle="Fast-moving items running low, suggested 2-week restock quantity" icon={ClipboardCheck}>
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
