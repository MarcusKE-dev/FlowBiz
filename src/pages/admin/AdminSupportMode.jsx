import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { enterSupportSession, fetchAdminBusinessDetail } from '../../utils/adminService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBanner from '../../components/common/ErrorBanner';
import { formatKES } from '../../utils/currency';
import {
  ShieldAlert,
  ShoppingCart,
  Boxes,
  Users,
  Lock,
  LayoutDashboard,
} from 'lucide-react';

export default function AdminSupportMode() {
  const { businessId } = useParams();

  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('counter');

  useEffect(() => {
    Promise.all([
      enterSupportSession(businessId),
      fetchAdminBusinessDetail(businessId),
    ])
      .then(([sess, detail]) => {
        setSession(sess);
        setData(detail);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) return <LoadingSpinner label="Initializing Support Inspection Mode…" />;
  if (error) return <ErrorBanner message={error} />;

  const { business, settings, metrics } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Prominent Read-Only Notice */}
      <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 space-y-1 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="h-5 w-5 text-amber-700" />
            <span>SUPPORT INSPECTION CONSOLE &middot; {settings.shopName || business.name}</span>
          </div>
          <Link to={`/admin/businesses/${businessId}`} className="btn-outline !min-h-0 !py-1 !px-2.5 text-xs font-bold bg-white text-ink-900">
            Exit Support Mode
          </Link>
        </div>
        <p className="text-xs text-amber-800">
          Viewing business state for diagnostics. All write actions are strictly disabled in Support Mode.
        </p>
      </div>

      {/* Store Header */}
      <div className="card p-5 bg-white space-y-3">
        <div className="flex items-center justify-between border-b border-ink-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-moss-600 text-white flex items-center justify-center font-black">
              {settings.shopName?.[0] || 'S'}
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-ink-900">{settings.shopName || business.name}</h2>
              <p className="text-xs text-ink-500">
                {settings.phone || 'No phone'} &middot; {settings.email || 'No email'} &middot; Plan: {business.subscription?.plan?.toUpperCase()}
              </p>
            </div>
          </div>
          <span className="badge bg-moss-100 text-moss-800 font-bold">
            Simulated Storefront
          </span>
        </div>

        {/* View Navigation */}
        <div className="grid grid-cols-5 gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('counter')}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 border ${activeTab === 'counter' ? 'bg-moss-50 border-moss-500 text-moss-800' : 'border-ink-200 text-ink-600'}`}
          >
            <ShoppingCart className="h-3.5 w-3.5" /> POS Counter
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 border ${activeTab === 'dashboard' ? 'bg-moss-50 border-moss-500 text-moss-800' : 'border-ink-200 text-ink-600'}`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 border ${activeTab === 'inventory' ? 'bg-moss-50 border-moss-500 text-moss-800' : 'border-ink-200 text-ink-600'}`}
          >
            <Boxes className="h-3.5 w-3.5" /> Inventory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 border ${activeTab === 'customers' ? 'bg-moss-50 border-moss-500 text-moss-800' : 'border-ink-200 text-ink-600'}`}
          >
            <Users className="h-3.5 w-3.5" /> Customers (Deni)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('closeday')}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 border ${activeTab === 'closeday' ? 'bg-moss-50 border-moss-500 text-moss-800' : 'border-ink-200 text-ink-600'}`}
          >
            <Lock className="h-3.5 w-3.5" /> Close Day
          </button>
        </div>
      </div>

      {/* Simulated Content Panels */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card p-4 bg-white">
            <span className="text-xs font-semibold uppercase text-ink-400">Total Sales</span>
            <p className="text-xl font-bold text-moss-700 mt-1">{formatKES(metrics.totalSalesRevenue)}</p>
          </div>
          <div className="card p-4 bg-white">
            <span className="text-xs font-semibold uppercase text-ink-400">Gross Margin</span>
            <p className="text-xl font-bold text-moss-700 mt-1">{formatKES(metrics.totalGrossProfit)}</p>
          </div>
          <div className="card p-4 bg-white">
            <span className="text-xs font-semibold uppercase text-ink-400">Uncollected Debt</span>
            <p className="text-xl font-bold text-rust-600 mt-1">{formatKES(metrics.totalOutstandingDebt)}</p>
          </div>
          <div className="card p-4 bg-white">
            <span className="text-xs font-semibold uppercase text-ink-400">Total Expenses</span>
            <p className="text-xl font-bold text-ink-800 mt-1">{formatKES(metrics.totalExpensesAmount)}</p>
          </div>
        </div>
      )}

      {activeTab === 'counter' && (
        <div className="card p-6 bg-white text-center space-y-3">
          <ShoppingCart className="h-10 w-10 mx-auto text-ink-300" />
          <h3 className="font-bold text-ink-900">POS Checkout Simulated View</h3>
          <p className="text-xs text-ink-500 max-w-sm mx-auto">
            The merchant currently has <strong className="text-ink-800">{metrics.productsCount} products</strong> in their catalog with <strong className="text-ink-800">{metrics.lowStockCount} items</strong> flagged as low stock.
          </p>
          <div className="pt-2">
            <button type="button" disabled className="btn-primary opacity-50 cursor-not-allowed text-xs">
              Checkout (Disabled in Support Mode)
            </button>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="card p-6 bg-white text-center space-y-2">
          <Boxes className="h-10 w-10 mx-auto text-ink-300" />
          <h3 className="font-bold text-ink-900">Inventory Status</h3>
          <p className="text-xs text-ink-500">
            Total Capital Deployed: <strong className="text-ink-900">{formatKES(metrics.totalInventoryCost)}</strong> &middot; Out of Stock: <strong className="text-rust-600">{metrics.outOfStockCount}</strong>
          </p>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="card p-6 bg-white text-center space-y-2">
          <Users className="h-10 w-10 mx-auto text-ink-300" />
          <h3 className="font-bold text-ink-900">Customer &amp; Debt Ledger</h3>
          <p className="text-xs text-ink-500">
            Registered Customers: <strong className="text-ink-900">{metrics.customersCount}</strong> &middot; Outstanding Market Exposure: <strong className="text-rust-600">{formatKES(metrics.totalOutstandingDebt)}</strong>
          </p>
        </div>
      )}

      {activeTab === 'closeday' && (
        <div className="card p-6 bg-white text-center space-y-2">
          <Lock className="h-10 w-10 mx-auto text-ink-300" />
          <h3 className="font-bold text-ink-900">Shift Reconciliation State</h3>
          <p className="text-xs text-ink-500">
            Cash Sales: <strong className="text-moss-700">{formatKES(metrics.cashSalesAmount)}</strong> &middot; M-Pesa Sales: <strong className="text-moss-700">{formatKES(metrics.mpesaSalesAmount)}</strong>
          </p>
        </div>
      )}
    </div>
  );
}