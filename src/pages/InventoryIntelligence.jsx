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
import { Lock, ArrowLeft, AlertCircle, CheckCircle2, Info, PackageOpen } from 'lucide-react';

function KpiCard({ label, value, tone = 'text-ink-900', bg = 'bg-white' }) {
  return (
    <div className={`card p-4 sm:p-5 ${bg} hover:shadow-md transition-shadow`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`mt-2 font-display text-xl sm:text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
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
  return <div className="py-8 flex flex-col items-center justify-center text-center"><PackageOpen className="h-6 w-6 text-ink-300 mb-2" strokeWidth={1.5}/><p className="text-sm text-ink-500">{children}</p></div>;
}

export default function InventoryIntelligence() {
  const { isPro, businessId } = useAuth();
  
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
      } else if (stock > threshold * 4) {
        // Lowered threshold multiplier to catch capital traps sooner
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Capital Deployed" value={formatKES(metrics.totalCost)} />
        <KpiCard label="Projected Gross Profit" value={formatKES(potentialProfit)} tone="text-moss-700" />
        <KpiCard label="Physical Units" value={metrics.unitsInStock.toLocaleString()} />
        <KpiCard label="Active SKUs" value={activeProductsCount.toLocaleString()} />
        <KpiCard label="Low Stock Risk" value={metrics.lowStock.length} tone={metrics.lowStock.length > 0 ? 'text-rust-600' : 'text-ink-900'} bg={metrics.lowStock.length > 0 ? 'bg-rust-50' : 'bg-white'} />
        <KpiCard label="Stockout Status" value={metrics.outOfStock.length} tone={metrics.outOfStock.length > 0 ? 'text-rust-600' : 'text-ink-900'} bg={metrics.outOfStock.length > 0 ? 'bg-rust-50' : 'bg-white'} />
        <KpiCard label="Overstocked SKUs" value={metrics.overstocked.length} tone="text-amber-600" />
        <KpiCard label="Capital Trapped" value={formatKES(totalOverstockValue)} tone="text-amber-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Global Supply Distribution" subtitle="System-wide inventory health check">
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

        <Section title="Capital Concentration" subtitle="Items holding maximum illiquid capital">
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

      <Section title="Automated Intelligence Briefing" subtitle="System-generated supply chain alerts">
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