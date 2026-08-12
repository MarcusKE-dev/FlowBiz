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

function KpiCard({ label, value, tone = 'text-ink-900' }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${tone}`}>{value}</p>
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

export default function InventoryIntelligence() {
  const { isPro, businessId } = useAuth();
  // MINOR CONSISTENCY FIX: every other page that reads `products`
  // (Products.jsx, Counter.jsx, Dashboard.jsx, Purchases.jsx, StockTake.jsx)
  // filters out archived items server-side with `where('deleted','!=',true)`.
  // This page previously fetched every product (including archived ones)
  // and only excluded them inside the metrics calculation below — same
  // end result, just less efficient. Filtering at the query matches the
  // rest of the app and reads less data.
  const productsQ = useMemo(
    () => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null),
    [businessId]
  );
  const { data: products, loading } = useFirestoreCollection(productsQ);

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
      } else if (stock > threshold * 5) {
        overstocked.push({ ...p, value: stock * cost });
      } else if (stock <= threshold) {
        lowStock.push(p);
      }
    });

    overstocked.sort((a, b) => b.value - a.value);
    const healthyCount = (products || []).length - outOfStock.length - overstocked.length - lowStock.length;

    return { totalCost, totalRetail, unitsInStock, outOfStock, overstocked, lowStock, healthyCount };
  }, [products]);

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
        <h2 className="font-display text-xl font-bold text-ink-900">FlowBiz Pro Required</h2>
        <p className="mt-2 text-sm text-ink-500">Inventory Intelligence automatically uncovers dead stock, overstock, and capital tie-ups. Upgrade to Pro to unlock.</p>
        <Link to="/pro" className="mt-6 btn-primary w-full">Explore Pro</Link>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  const potentialProfit = metrics.totalRetail - metrics.totalCost;
  const activeProductsCount = (products || []).length;

  const insights = [];
  if (metrics.lowStock.length > 0) {
    insights.push({ tone: 'negative', text: `${metrics.lowStock.length} product${metrics.lowStock.length === 1 ? ' is' : 's are'} low on stock.` });
  }
  if (metrics.outOfStock.length > 0) {
    insights.push({ tone: 'negative', text: `${metrics.outOfStock.length} product${metrics.outOfStock.length === 1 ? ' is' : 's are'} out of stock — restock to avoid missed sales.` });
  }
  if (metrics.overstocked[0]) {
    insights.push({ tone: 'neutral', text: `"${metrics.overstocked[0].name}" is the biggest capital tie-up, holding ${formatKES(metrics.overstocked[0].value)} in stock.` });
  }
  if (insights.length === 0 && activeProductsCount > 0) {
    insights.push({ tone: 'positive', text: 'Stock levels look healthy across your product range right now.' });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Inventory Intelligence</h1>
          <p className="text-sm text-ink-400">Where your stock capital is right now</p>
        </div>
        <Link to="/products" className="btn-outline text-xs">Back to Products</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Capital Tied Up" value={formatKES(metrics.totalCost)} />
        <KpiCard label="Potential Gross Profit" value={formatKES(potentialProfit)} tone="text-moss-700" />
        <KpiCard label="Units in Stock" value={metrics.unitsInStock.toLocaleString()} />
        <KpiCard label="Active Products" value={activeProductsCount.toLocaleString()} />
        <KpiCard label="Low Stock" value={metrics.lowStock.length} tone={metrics.lowStock.length > 0 ? 'text-rust-600' : 'text-ink-900'} />
        <KpiCard label="Out of Stock" value={metrics.outOfStock.length} tone={metrics.outOfStock.length > 0 ? 'text-rust-600' : 'text-ink-900'} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Stock Health">
          {activeProductsCount > 0 ? (
            <DonutChart
              formatValue={(v) => `${v} product${v === 1 ? '' : 's'}`}
              segments={[
                { label: 'Healthy', value: metrics.healthyCount, colorClassName: 'text-moss-600', dotClassName: 'bg-moss-600' },
                { label: 'Low stock', value: metrics.lowStock.length, colorClassName: 'text-amber-500', dotClassName: 'bg-amber-500' },
                { label: 'Out of stock', value: metrics.outOfStock.length, colorClassName: 'text-rust-500', dotClassName: 'bg-rust-500' },
                { label: 'Overstocked', value: metrics.overstocked.length, colorClassName: 'text-blue-600', dotClassName: 'bg-blue-600' },
              ]}
            />
          ) : (
            <NoData>Add products to see stock health here.</NoData>
          )}
        </Section>

        <Section title="Top Capital Tie-Ups" subtitle="Overstocked items holding the most capital">
          {metrics.overstocked.length > 0 ? (
            <MiniBarChart
              orientation="horizontal"
              formatValue={formatKES}
              data={metrics.overstocked.slice(0, 6).map((p) => ({ label: p.name, value: p.value }))}
            />
          ) : (
            <NoData>No overstock detected.</NoData>
          )}
        </Section>
      </div>

      <Section title="Inventory Insights">
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
      </Section>
    </div>
  );
}
