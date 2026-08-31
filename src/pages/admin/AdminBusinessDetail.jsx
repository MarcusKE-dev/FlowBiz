// src/pages/admin/AdminBusinessDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  fetchAdminBusinessDetail,
  fetchAdminBusinessData,
  updateBusinessSubscription,
  deleteBusinessCompletely,
  toggleBusinessStatus,
  sendOwnerPasswordReset,
  sendOwnerVerification,
} from '../../utils/adminService';
import { useAdmin } from '../../components/admin/AdminProtectedRoute';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBanner from '../../components/common/ErrorBanner';
import Modal from '../../components/common/Modal';
import { formatKES } from '../../utils/currency';
import { formatDate, formatDateTime } from '../../utils/dateRanges';
import {
  Building2,
  ArrowLeft,
  Shield,
  Sparkles,
  Package,
  ShoppingCart,
  BookOpen,
  Users,
  Receipt,
  Truck,
  FileText,
  Settings,
  ScrollText,
  Copy,
  Trash2,
  KeyRound,
  MailCheck,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'products', label: 'Products & Stock', icon: Package },
  { id: 'sales', label: 'Sales Log', icon: ShoppingCart },
  { id: 'creditSales', label: 'Credit (Deni)', icon: BookOpen },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'purchases', label: 'Purchases & Suppliers', icon: Truck },
  { id: 'receipts', label: 'Receipts & Invoices', icon: FileText },
  { id: 'team', label: 'Team & Devices', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'audit', label: 'Admin Audit Trail', icon: ScrollText },
];

export default function AdminBusinessDetail() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAdmin();

  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tabData, setTabData] = useState({});
  const [tabLoading, setTabLoading] = useState(false);

  // Subscription Modal
  const [subModal, setSubModal] = useState(false);
  const [subPlan, setSubPlan] = useState('pro');
  const [subStatus, setSubStatus] = useState('active');
  const [subDays, setSubDays] = useState(30);
  const [subReason, setSubReason] = useState('Support grant / manual extension');
  const [subUpdating, setSubUpdating] = useState(false);

  // Complete Business Purge Modal
  const [deleteModal, setDeleteModal] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadOverview = () => {
    setLoading(true);
    setError(null);
    fetchAdminBusinessDetail(businessId)
      .then((res) => {
        setData(res);
        setSubPlan(res.business?.subscription?.plan || 'pro');
        setSubStatus(res.business?.subscription?.status || 'active');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOverview();
  }, [businessId]);

  const loadTabData抓 = async (collectionName) => {
    setTabLoading(true);
    try {
      const res = await fetchAdminBusinessData(businessId, { collection: collectionName, limit: 100 });
      setTabData((prev) => ({ ...prev, [collectionName]: res.data }));
    } catch (err) {
      toast.error(`Failed to load ${collectionName}: ${err.message}`);
    } finally {
      setTabLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'products') loadTabData抓('products');
    else if (activeTab === 'sales') loadTabData抓('sales');
    else if (activeTab === 'creditSales') loadTabData抓('creditSales');
    else if (activeTab === 'customers') loadTabData抓('customers');
    else if (activeTab === 'expenses') loadTabData抓('expenses');
    else if (activeTab === 'purchases') loadTabData抓('purchases');
    else if (activeTab === 'receipts') loadTabData抓('debtPaymentReceipts');
  }, [activeTab, businessId]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(businessId);
    toast.success('Business ID copied to clipboard.');
  };

  const handleUpdateSubscription = async (e) => {
    e.preventDefault();
    setSubUpdating(true);
    try {
      await updateBusinessSubscription(businessId, {
        plan: subPlan,
        status: subStatus,
        durationDays: Number(subDays),
        reason: subReason,
      });
      toast.success('Subscription updated successfully.');
      setSubModal(false);
      loadOverview();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubUpdating(false);
    }
  };

  const handleDeleteBusiness = async (e) => {
    e.preventDefault();
    setDeleting(true);
    try {
      await deleteBusinessCompletely(businessId, confirmPhrase.trim());
      toast.success(`Business "${business.name || businessId}" and all its records permanently deleted.`);
      setDeleteModal(false);
      navigate('/admin/businesses', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (newStatus) => {
    const actionLabel = newStatus === 'suspended' ? 'suspend' : 'reactivate';
    if (!confirm(`Are you sure you want to ${actionLabel} this store?`)) return;
    try {
      await toggleBusinessStatus(businessId, newStatus, `Admin action: ${actionLabel}`);
      toast.success(`Store ${actionLabel}ed.`);
      loadOverview();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSendReset = async () => {
    try {
      const res = await sendOwnerPasswordReset(businessId);
      toast.success(`Password reset email dispatched to ${res.email}.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSendVerification = async () => {
    try {
      const res = await sendOwnerVerification(businessId);
      toast.success(`Email verification link sent to ${res.email}.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingSpinner label="Inspecting business profile…" />;
  if (error) return <ErrorBanner message={error} />;

  const { business, settings, metrics, staff } = data;
  const isSuspended = business.status === 'suspended';
  const expectedDeletePhrase = `DELETE ${business.name || businessId}`.trim();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Top Header Card */}
      <div className="card p-5 sm:p-6 bg-white space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/admin/businesses" className="text-xs font-semibold text-ink-400 hover:text-ink-700 flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Businesses
              </Link>
              <span className="text-ink-300">/</span>
              <span className="text-xs font-mono font-bold text-ink-500">{businessId}</span>
              {isSuspended && <span className="badge bg-rust-100 text-rust-800 font-bold ml-1">SUSPENDED</span>}
            </div>
            <h1 className="font-display text-2xl font-bold text-ink-900 mt-1">
              {business.name || settings.shopName || 'Unnamed Business'}
            </h1>
            <p className="text-xs text-ink-500 mt-0.5">
              Registered on {formatDate(business.createdAt)} &middot; Created by {business.createdBy || 'Unknown'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyId}
              className="btn-outline !min-h-0 !py-1.5 !px-3 text-xs font-semibold flex items-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> Copy ID
            </button>
            <button
              type="button"
              onClick={() => setSubModal(true)}
              className="btn-outline !min-h-0 !py-1.5 !px-3 text-xs font-semibold flex items-center gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              <Sparkles className="h-3.5 w-3.5" /> Plan: {business.subscription?.plan?.toUpperCase()}
            </button>
            <Link
              to={`/admin/businesses/${businessId}/support`}
              className="btn-primary !min-h-0 !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 bg-ink-900 hover:bg-ink-950"
            >
              <Shield className="h-3.5 w-3.5" /> Support Inspection Mode
            </Link>
          </div>
        </div>

        {/* Operational KPI Counters */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 pt-1">
          <div className="rounded-xl bg-sand p-3">
            <span className="text-[10px] font-bold uppercase text-ink-400 block">Catalog SKUs</span>
            <span className="font-display text-lg font-bold text-ink-900">{metrics.productsCount}</span>
          </div>
          <div className="rounded-xl bg-sand p-3">
            <span className="text-[10px] font-bold uppercase text-ink-400 block">Inventory Cost</span>
            <span className="font-display text-lg font-bold text-ink-900">{formatKES(metrics.totalInventoryCost)}</span>
          </div>
          <div className="rounded-xl bg-sand p-3">
            <span className="text-[10px] font-bold uppercase text-ink-400 block">Sales Recorded</span>
            <span className="font-display text-lg font-bold text-moss-700">{metrics.salesCount}</span>
          </div>
          <div className="rounded-xl bg-sand p-3">
            <span className="text-[10px] font-bold uppercase text-ink-400 block">Gross Revenue</span>
            <span className="font-display text-lg font-bold text-moss-700">{formatKES(metrics.totalSalesRevenue)}</span>
          </div>
          <div className="rounded-xl bg-sand p-3">
            <span className="text-[10px] font-bold uppercase text-rust-600 block">Uncollected Deni</span>
            <span className="font-display text-lg font-bold text-rust-700">{formatKES(metrics.totalOutstandingDebt)}</span>
          </div>
          <div className="rounded-xl bg-sand p-3">
            <span className="text-[10px] font-bold uppercase text-ink-400 block">Expenses Paid</span>
            <span className="font-display text-lg font-bold text-ink-800">{formatKES(metrics.totalExpensesAmount)}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-ink-200 pb-2 scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold shrink-0 transition-colors ${
                isActive
                  ? 'bg-ink-900 text-white shadow-xs'
                  : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: Overview & Support Controls */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5 bg-white space-y-3">
              <h3 className="font-display text-sm font-bold text-ink-900 border-b border-ink-100 pb-2">
                Shop Configuration
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-ink-50">
                  <span className="text-ink-400">Shop Name:</span>
                  <span className="font-semibold text-ink-800">{settings.shopName || business.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-ink-50">
                  <span className="text-ink-400">Phone:</span>
                  <span className="font-semibold text-ink-800">{settings.phone || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-ink-50">
                  <span className="text-ink-400">Email:</span>
                  <span className="font-semibold text-ink-800">{settings.email || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-ink-50">
                  <span className="text-ink-400">Address:</span>
                  <span className="font-semibold text-ink-800">{settings.address || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-ink-50">
                  <span className="text-ink-400">Receipt Paper Width:</span>
                  <span className="font-semibold text-ink-800">{settings.receiptPaperWidth || 80}mm</span>
                </div>
                <div className="flex justify-between py-1 border-b border-ink-50">
                  <span className="text-ink-400">Cashier Expenses:</span>
                  <span className="font-semibold text-ink-800">{settings.cashierCanRecordExpenses !== false ? 'Allowed' : 'Owner Only'}</span>
                </div>
              </div>
            </div>

            <div className="card p-5 bg-white space-y-3">
              <h3 className="font-display text-sm font-bold text-ink-900 border-b border-ink-100 pb-2">
                Staff &amp; Users ({staff.length})
              </h3>
              <div className="divide-y divide-ink-100 text-xs">
                {staff.map((u) => (
                  <div key={u.id} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-ink-900 block">{u.displayName || 'Staff'}</span>
                      <span className="text-[11px] text-ink-400">{u.email || u.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`badge ${u.role === 'owner' ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-800'}`}>
                        {u.role}
                      </span>
                      <span className={`badge ${u.active !== false ? 'bg-moss-50 text-moss-700' : 'bg-rust-50 text-rust-600'}`}>
                        {u.active !== false ? 'Active' : 'Deactivated'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Support Actions Panel */}
          <div className="card p-5 bg-white space-y-3 border-ink-200">
            <h3 className="font-display text-sm font-bold text-ink-900">Merchant Account Assistance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                type="button"
                onClick={handleSendReset}
                className="btn-outline !py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <KeyRound className="h-4 w-4" /> Send Owner Password Reset
              </button>
              <button
                type="button"
                onClick={handleSendVerification}
                className="btn-outline !py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <MailCheck className="h-4 w-4" /> Send Email Verification
              </button>
              {isSuspended ? (
                <button
                  type="button"
                  onClick={() => handleToggleStatus('active')}
                  className="btn-outline !py-2 text-xs font-semibold flex items-center justify-center gap-1.5 text-moss-700 border-moss-300"
                >
                  <PlayCircle className="h-4 w-4" /> Reactivate Workspace
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleStatus('suspended')}
                  className="btn-outline !py-2 text-xs font-semibold flex items-center justify-center gap-1.5 text-rust-600 border-rust-200"
                >
                  <PauseCircle className="h-4 w-4" /> Suspend Workspace
                </button>
              )}
            </div>
          </div>

          {/* Danger Zone: Delete Business Completely */}
          {isSuperAdmin && (
            <div className="card p-5 bg-white space-y-3 border-rust-200">
              <div>
                <h3 className="font-display text-sm font-bold text-rust-700">Danger Zone: Permanent Business Deletion</h3>
                <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">
                  Permanently erase this business, its inventory, sales logs, debt records, customers, and associated Firebase Auth accounts from Firestore.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setConfirmPhrase(''); setDeleteModal(true); }}
                className="btn-danger !py-2 text-xs font-bold flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" /> Delete Business Completely
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Products */}
      {activeTab === 'products' && (
        <div className="card p-5 bg-white space-y-4">
          <h3 className="font-display text-sm font-bold text-ink-900">
            Product Catalog ({tabData.products?.length || 0})
          </h3>
          {tabLoading ? (
            <LoadingSpinner label="Loading products…" />
          ) : !tabData.products?.length ? (
            <p className="text-xs text-ink-400 py-6 text-center">No products registered in this store.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-ink-50 uppercase text-[10px] font-bold text-ink-400 border-b border-ink-100">
                  <tr>
                    <th className="px-3 py-2.5">Product Name</th>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">Cost Price</th>
                    <th className="px-3 py-2.5">Selling Price</th>
                    <th className="px-3 py-2.5">Current Stock</th>
                    <th className="px-3 py-2.5">Barcode</th>
                    <th className="px-3 py-2.5">Internal Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 font-medium">
                  {tabData.products.map((p) => (
                    <tr key={p.id} className={p.stock <= (p.lowStockThreshold || 5) ? 'bg-rust-50/30' : ''}>
                      <td className="px-3 py-2 font-bold text-ink-900">{p.name}</td>
                      <td className="px-3 py-2 text-ink-500">{p.category}</td>
                      <td className="px-3 py-2 text-ink-600">{formatKES(p.costPrice)}</td>
                      <td className="px-3 py-2 font-semibold text-moss-700">{formatKES(p.sellingPrice)}</td>
                      <td className="px-3 py-2">
                        <span className={p.stock <= 0 ? 'text-rust-700 font-bold' : 'text-ink-800'}>
                          {p.stock} units
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-ink-500">{p.barcode || '—'}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-ink-500">{p.internalCode || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Sales */}
      {activeTab === 'sales' && (
        <div className="card p-5 bg-white space-y-4">
          <h3 className="font-display text-sm font-bold text-ink-900">
            Recorded Sales ({tabData.sales?.length || 0})
          </h3>
          {tabLoading ? (
            <LoadingSpinner label="Loading sales…" />
          ) : !tabData.sales?.length ? (
            <p className="text-xs text-ink-400 py-6 text-center">No sales recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-ink-50 uppercase text-[10px] font-bold text-ink-400 border-b border-ink-100">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Items</th>
                    <th className="px-3 py-2.5">Total Amount</th>
                    <th className="px-3 py-2.5">COGS</th>
                    <th className="px-3 py-2.5">Profit</th>
                    <th className="px-3 py-2.5">Tender</th>
                    <th className="px-3 py-2.5">Cashier</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 font-medium">
                  {tabData.sales.map((s) => (
                    <tr key={s.id} className={s.isVoided ? 'opacity-40 line-through' : ''}>
                      <td className="px-3 py-2 text-ink-500">{formatDateTime(s.soldAt)}</td>
                      <td className="px-3 py-2 font-semibold text-ink-900">
                        {s.items?.length ? `${s.items.length} items (${s.productName})` : `${s.quantity} × ${s.productName}`}
                      </td>
                      <td className="px-3 py-2 font-bold text-ink-900">{formatKES(s.totalAmount)}</td>
                      <td className="px-3 py-2 text-ink-500">{formatKES(s.costOfGoodsSold || 0)}</td>
                      <td className="px-3 py-2 font-semibold text-moss-700">{formatKES(s.profit || 0)}</td>
                      <td className="px-3 py-2">
                        <span className="badge bg-ink-100 text-ink-700">
                          {s.paymentMethod} {s.mpesaCode ? `(${s.mpesaCode})` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink-600">{s.soldByName || 'Staff'}</td>
                      <td className="px-3 py-2">
                        <span className={`badge ${s.isVoided ? 'bg-rust-100 text-rust-800' : 'bg-moss-100 text-moss-800'}`}>
                          {s.isVoided ? 'Voided' : 'Completed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Subscription Modal */}
      <Modal open={subModal} onClose={() => setSubModal(false)} title="Manage Platform Subscription">
        <form onSubmit={handleUpdateSubscription} className="space-y-4">
          <div>
            <label className="label">Plan</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSubPlan('free')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border ${subPlan === 'free' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200'}`}
              >
                Free Starter
              </button>
              <button
                type="button"
                onClick={() => setSubPlan('pro')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border ${subPlan === 'pro' ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-ink-200'}`}
              >
                FlowBiz Pro
              </button>
            </div>
          </div>

          <div>
            <label className="label">Status</label>
            <select value={subStatus} onChange={(e) => setSubStatus(e.target.value)} className="input text-xs">
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {subPlan === 'pro' && (
            <div>
              <label className="label">Extend Duration (Days from now)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={subDays}
                onChange={(e) => setSubDays(e.target.value)}
                className="input text-xs font-bold"
              />
            </div>
          )}

          <div>
            <label className="label">Administrative Reason (Logged in Audit Trail)</label>
            <input
              type="text"
              required
              value={subReason}
              onChange={(e) => setSubReason(e.target.value)}
              className="input text-xs"
              placeholder="e.g. Support resolution / courtesy grant"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setSubModal(false)} disabled={subUpdating}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 !bg-ink-900" disabled={subUpdating}>
              {subUpdating ? 'Updating…' : 'Save Subscription'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete Business Purge Modal */}
      <Modal open={deleteModal} onClose={() => { if (!deleting) setDeleteModal(false); }} title="Permanently Delete Business">
        <form onSubmit={handleDeleteBusiness} className="space-y-4">
          <div className="rounded-xl border border-rust-200 bg-rust-50 p-4 text-xs font-medium text-rust-700 leading-relaxed space-y-1.5">
            <p className="font-bold text-rust-900">WARNING: Permanent, Irreversible Action</p>
            <p>
              This action will permanently purge <strong>all products, sales, debt records, customers, supplier history, and settings</strong> belonging to <strong>{business.name || businessId}</strong>.
            </p>
            <p>All associated staff and owner Firebase Auth accounts will be deleted immediately.</p>
          </div>

          <div>
            <label className="label">
              Type <span className="font-mono font-bold text-rust-700">{expectedDeletePhrase}</span> to confirm
            </label>
            <input
              type="text"
              required
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={expectedDeletePhrase}
              className="input text-xs font-mono font-bold"
              disabled={deleting}
              autoFocus
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setDeleteModal(false)} disabled={deleting}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={deleting || confirmPhrase.trim().toUpperCase() !== expectedDeletePhrase.toUpperCase()}
              className="btn-danger flex-1"
            >
              {deleting ? 'Purging All Records…' : 'Delete Business Completely'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}