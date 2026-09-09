// src/pages/admin/AdminBusinessDetail.jsx
//
// The Business Inspector — the support console for one business.
//
// A support agent opens this with a question ("why is my inventory
// wrong?", "how much does Mama Njeri owe?", "why can't I see my
// products?") and the tab bar is the answer to that question. It is
// deliberately shaped around the QUESTIONS, not around the database.
//
// ── Read-only by default ──────────────────────────────────────────────
// Nothing on the data tabs can write. The only actions that exist are the
// account actions that already existed before this rebuild — change plan,
// suspend, email the owner, delete — and each is rendered only when the
// server said this administrator holds the capability for it. That render
// check is a convenience, not a control: the Worker re-checks the same
// permission on every request, so hiding a button and refusing the call
// are two independent locks and only the second one matters.
//
// ── Cost ──────────────────────────────────────────────────────────────
// Opening this page fetches the business, its settings, its staff and its
// usage summary. It does NOT fetch products, sales, customers, credit,
// suppliers, expenses, stock, documents, photos or payments — each of
// those loads only when its tab is opened, once, 25-30 rows at a time,
// through a cursor. There are no Firestore listeners anywhere in the
// admin console.

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import WhatsAppContact from '../../components/admin/WhatsAppContact';
import {
  fetchAdminBusinessDetail,
  fetchBusinessUsage,
  fetchAdminAuditLogs,
  updateBusinessSubscription,
  updateBusinessIndustry,
  deleteBusinessCompletely,
  toggleBusinessStatus,
  sendOwnerPasswordReset,
  sendOwnerVerification,
  performSecurityAction,
} from '../../utils/adminService';
import { useAdmin } from '../../components/admin/AdminProtectedRoute';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AdminApiError from '../../components/admin/AdminApiError';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PageHeader from '../../components/ui/PageHeader';
import Section from '../../components/ui/Section';
import MetricRail, { Metric } from '../../components/ui/MetricRail';
import StatementBlock, { StatementRow } from '../../components/ui/StatementBlock';
import StatusPill from '../../components/ui/StatusPill';
import DataTable from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import Money from '../../components/ui/Money';
import UsagePanel, { formatBytes } from '../../components/admin/inspector/UsagePanel';
import AdminLicensingSection from '../../components/admin/AdminLicensingSection';
import {
  ProductsSection, SalesSection, CustomersSection, CreditsSection,
  RepaymentsSection, SuppliersSection, ExpensesSection, PurchasesSection,
  StockSection, DocumentsSection, SessionsSection, PhotosSection,
  PaymentsSection,
} from '../../components/admin/inspector/InspectorSections';
import { formatDate, formatDateTime } from '../../utils/dateRanges';
import { resolveIndustryConfig } from '../../industry/config';
import { profilesByFamily, getProfile } from '../../industry/profiles';
import { CAPABILITIES } from '../../industry/capabilities';
import {
  Building2, ArrowLeft, Gauge, Package, ShoppingCart, Users, BookOpen,
  Truck, Receipt, Boxes, FileText, Smartphone, Image as ImageIcon,
  CreditCard, Settings as SettingsIcon, ScrollText, Copy, Trash2,
  KeyRound, MailCheck, PauseCircle, PlayCircle, Sparkles, ShieldCheck, Store,
} from 'lucide-react';

// Tabs are grouped the way a support conversation moves: what the shop
// is, what it sells, who owes it money, what it spends, and how it is
// running.
const TAB_GROUPS = [
  {
    label: 'Account',
    tabs: [
      { id: 'overview', label: 'Overview', icon: Building2 },
      { id: 'usage', label: 'Usage', icon: Gauge },
      { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
  {
    label: 'Trading',
    tabs: [
      { id: 'products', label: 'Products', icon: Package },
      { id: 'sales', label: 'Sales', icon: ShoppingCart },
      { id: 'stock', label: 'Stock activity', icon: Boxes },
      { id: 'purchases', label: 'Purchases', icon: Truck },
    ],
  },
  {
    label: 'People & money',
    tabs: [
      { id: 'customers', label: 'Customers', icon: Users },
      { id: 'credits', label: 'Credit & debtors', icon: BookOpen },
      { id: 'repayments', label: 'Repayments', icon: Receipt },
      { id: 'suppliers', label: 'Suppliers', icon: Truck },
      { id: 'expenses', label: 'Expenses', icon: Receipt },
    ],
  },
  {
    label: 'Operations',
    tabs: [
      { id: 'documents', label: 'Receipts & invoices', icon: FileText },
      { id: 'sessions', label: 'Devices', icon: Smartphone },
      { id: 'photos', label: 'Photos', icon: ImageIcon },
      { id: 'payments', label: 'Payments', icon: CreditCard, needs: 'canSeePayments' },
      { id: 'audit', label: 'Admin activity', icon: ScrollText, needs: 'canSeeAudit' },
    ],
  },
];

const AUDIT_TONE = {
  DELETE_BUSINESS_COMPLETELY: 'negative',
  TOGGLE_BUSINESS_STATUS: 'caution',
  UPDATE_SUBSCRIPTION: 'caution',
  ADMIN_TRIGGERED_PASSWORD_RESET: 'caution',
  ADMIN_TRIGGERED_VERIFICATION_EMAIL: 'caution',
  SEND_COMMUNICATION: 'info',
};

// Settings keys that are large blobs or internal plumbing rather than
// anything a support agent needs to read.
const SETTINGS_HIDDEN = new Set(['logoDataUrl', 'logo', 'businessId', 'id']);

// What switched an account off, said in the Team list rather than left to
// be inferred from a red pill. A deactivated account with no reason
// recorded is the fingerprint of a suspension performed before those
// stamps existed — the state that stranded merchants with no way back.
const DEACTIVATION_LABELS = {
  workspace_suspended: 'by this workspace suspension',
  owner_deactivated: 'by the business owner',
  platform_security: 'by a platform security action',
};

// Why the workspace restore declined to switch an account back on. Each
// one is a deliberate refusal, not a failure — and each has a different
// answer, which is why the console names them rather than counting them.
const SKIP_REASONS = {
  platform_security: 'disabled by a platform security action',
  owner_deactivated: 'switched off by the business owner',
  not_attributable: 'the suspension cannot prove it switched them off',
};

function SettingsTab({ settings }) {
  const entries = Object.entries(settings || {})
    .filter(([key, value]) => !SETTINGS_HIDDEN.has(key) && typeof value !== 'object')
    .sort(([a], [b]) => a.localeCompare(b));

  const hasLogo = Boolean(settings?.logoDataUrl || settings?.logo);

  if (!entries.length && !hasLogo) {
    return (
      <EmptyState
        icon={SettingsIcon}
        title="No settings saved"
        description="This business has not customised its shop configuration."
      />
    );
  }

  return (
    <Section
      title="Shop configuration"
      hint="Read-only. A change has to come from the shop, or from an administrative action with its own confirmation."
    >
      <StatementBlock>
        {entries.map(([key, value]) => (
          <StatementRow
            key={key}
            label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
            value={typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '-')}
          />
        ))}
        {hasLogo && <StatementRow label="Shop logo" value="Stored" hint="not shown here" />}
      </StatementBlock>
    </Section>
  );
}

function AuditTab({ businessId }) {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAdminAuditLogs({ businessId, limit: 50 })
      .then((data) => { setLogs(data.logs || []); setMeta(data); })
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, [businessId]);

  if (loading) return <SkeletonRows rows={6} />;
  if (error) return <AdminApiError error={error} onRetry={load} />;
  if (!logs.length) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No administrative activity"
        description="No FlowBiz administrator has inspected or changed this business."
      />
    );
  }

  return (
    <Section
      title="Administrative activity on this business"
      hint="Who looked, who changed what, and when. Repeated inspections within ten minutes are recorded once."
    >
      {meta?.degradedOrdering && (
        <p className="rounded-panel border border-line bg-surface px-3 py-2 text-cell text-ink-600">
          {meta.degradedReason}
        </p>
      )}
      <DataTable
        mobileLayout="row"
        columns={[
          { key: 'timestamp', header: 'When', primary: true, render: (l) => formatDateTime(l.timestamp) },
          {
            key: 'action', header: 'Action', mobileTrailing: true,
            render: (l) => <StatusPill tone={AUDIT_TONE[l.action] || 'neutral'}>{l.action}</StatusPill>,
          },
          { key: 'adminEmail', header: 'Administrator', render: (l) => l.adminEmail || l.adminName || '-' },
          { key: 'adminRole', header: 'Role', render: (l) => l.adminRole || '-' },
          { key: 'targetResource', header: 'Resource', render: (l) => l.targetResource || '-' },
        ]}
        rows={logs}
      />
    </Section>
  );
}

export default function AdminBusinessDetail() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { admin } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') || 'overview';
  const setActiveTab = (tab) => setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState(null);

  const [subModal, setSubModal] = useState(false);
  const [subPlan, setSubPlan] = useState('pro');
  const [subStatus, setSubStatus] = useState('active');
  const [subDays, setSubDays] = useState(30);
  const [subReason, setSubReason] = useState('Support grant / manual extension');
  const [subUpdating, setSubUpdating] = useState(false);

  const [deleteModal, setDeleteModal] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState(null);
  const [reactivating, setReactivating] = useState(null);

  const loadOverview = () => {
    setLoading(true);
    setError(null);
    fetchAdminBusinessDetail(businessId)
      .then((res) => {
        setData(res);
        setUsage(res.usage || null);
        setSubPlan(res.business?.subscription?.plan || 'pro');
        setSubStatus(res.business?.subscription?.status || 'active');
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(loadOverview, [businessId]);

  const refreshUsage = () => {
    setUsageLoading(true);
    setUsageError(null);
    fetchBusinessUsage(businessId)
      .then((res) => setUsage(res.usage))
      .catch(setUsageError)
      .finally(() => setUsageLoading(false));
  };

  // Memoised because it feeds a useMemo below — a fresh {} on every render
  // would rebuild the tab list on every keystroke in a child.
  const permissions = useMemo(() => data?.permissions || {}, [data]);
  // Audit visibility is not returned by the detail endpoint, so it is
  // taken from the verified admin profile. If it is wrong the tab simply
  // shows the server's 403 — the data is protected either way.
  const canSeeAudit = Boolean(admin?.permissions?.['audit.read']);

  const visibleGroups = useMemo(() => {
    const flags = { ...permissions, canSeeAudit };
    return TAB_GROUPS
      .map((group) => ({ ...group, tabs: group.tabs.filter((t) => !t.needs || flags[t.needs]) }))
      .filter((group) => group.tabs.length > 0);
  }, [permissions, canSeeAudit]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(businessId);
    toast.success('Business ID copied.');
  };

  // ── Industry profile ──────────────────────────────────────────────
  // Read straight off the settings document the detail endpoint already
  // returns, and resolved through the same resolver the merchant's own
  // app uses — so what an administrator sees here is exactly what the
  // merchant sees, not a second interpretation of the same fields.
  const industry = useMemo(() => resolveIndustryConfig(data?.settings), [data]);
  const [industryModal, setIndustryModal] = useState(false);
  const [industryChoice, setIndustryChoice] = useState(null);
  const [industryReason, setIndustryReason] = useState('');
  const [industryUpdating, setIndustryUpdating] = useState(false);

  const openIndustryModal = () => {
    setIndustryChoice(industry.profileId);
    setIndustryReason('');
    setIndustryModal(true);
  };

  const runIndustryUpdate = async (payload, message) => {
    setIndustryUpdating(true);
    try {
      await updateBusinessIndustry(businessId, { ...payload, reason: industryReason });
      toast.success(message);
      setIndustryModal(false);
      loadOverview();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIndustryUpdating(false);
    }
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
      toast.success('Subscription updated.');
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
      toast.success('Business and all its records permanently deleted.');
      setDeleteModal(false);
      navigate('/admin/businesses', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
    }
  };

  const applyStatus = async (newStatus, { restoreStaff = false } = {}) => {
    try {
      const res = await toggleBusinessStatus(
        businessId,
        newStatus,
        restoreStaff ? 'Administrator action: restore staff access' : `Administrator action: ${newStatus}`,
        { restoreStaff }
      );
      if (newStatus === 'suspended') {
        toast.success(`Workspace suspended. ${res.staffDeactivated} account(s) signed out.`);
      } else if (res.staffRestored > 0) {
        toast.success(`Workspace active. ${res.staffRestored} account(s) can sign in again.`);
      } else if (res.staffLeftInactive > 0) {
        // A restore that restored nothing while accounts are still locked
        // out is the one outcome an administrator must never read as
        // success — it is what sent them round the same button twice.
        const why = (res.skipped || []).map((a) => SKIP_REASONS[a.reason] || a.reason);
        toast.error(
          `Workspace active, but ${res.staffLeftInactive} account(s) are still deactivated`
            + `${why.length ? `: ${[...new Set(why)].join('; ')}` : ''}. `
            + 'Use Reactivate on the account itself in the Team list.',
          { duration: 8000 }
        );
      } else {
        toast.success('Workspace active. No account needed restoring.');
      }
      loadOverview();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStatusConfirm(null);
    }
  };

  // The per-account escape hatch.
  //
  // Every restore path above reasons about WHY an account is off, and each
  // of those inferences can be wrong or inapplicable — an account
  // deactivated by a deployment that stamped nothing, one an owner
  // switched off and now wants back, one the workspace sweep declines to
  // claim. This asks no questions: it switches this one account on, in
  // Firebase and in its FlowBiz profile, with the administrator's name on
  // the audit entry. It is the answer to "the buttons all say success and
  // the merchant still cannot sign in".
  const reactivateAccount = async (user) => {
    setReactivating(user.id);
    try {
      await performSecurityAction({
        action: 'enableUser',
        uid: user.id,
        reason: `Reactivated from the business inspector (${data?.business?.name || businessId})`,
      });
      toast.success(`${user.email || 'Account'} can sign in again.`);
      loadOverview();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReactivating(null);
    }
  };

  const runOwnerEmail = async (fn, label) => {
    try {
      const res = await fn(businessId);
      toast.success(`${label} sent to ${res.email}.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingSpinner label="Opening business inspector…" />;
  if (error) return <AdminApiError error={error} onRetry={loadOverview} />;

  const { business, settings, metrics, staff } = data;
  const isSuspended = business.status === 'suspended';
  // A workspace that is ACTIVE while its people are not. It is the state a
  // suspension performed by an earlier deployment leaves behind — the
  // status went back, the accounts did not — and without a control for it
  // the only way out is editing Firestore by hand.
  const strandedStaff = staff.filter(
    (u) => u.active === false && u.disabledByPlatform !== true && u.deactivationReason !== 'owner_deactivated'
  );
  const expectedDeletePhrase = `DELETE ${business.name || businessId}`.trim();
  const sync = usage?.sync;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          to="/admin/businesses"
          className="inline-flex items-center gap-1.5 text-cell text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> Business directory
        </Link>
      </div>

      <PageHeader
        title={business.name || settings.shopName || 'Unnamed business'}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="num text-ink-600">{businessId}</span>
            <span className="text-ink-300">·</span>
            <span>Registered {formatDate(business.createdAt)}</span>
            {sync?.lastKnownActivityAt && (
              <>
                <span className="text-ink-300">·</span>
                <span>Last activity {formatDateTime(sync.lastKnownActivityAt)}</span>
              </>
            )}
          </span>
        }
        actions={
          <>
            <StatusPill tone={business.effectivePlan === 'free' ? 'neutral' : 'info'}>
              {(business.effectivePlan || 'free').toUpperCase()}
            </StatusPill>
            <StatusPill tone={isSuspended ? 'negative' : 'positive'}>
              {isSuspended ? 'Suspended' : 'Active'}
            </StatusPill>
            <button type="button" onClick={handleCopyId} className="btn-outline !px-2.5 flex items-center gap-1.5 text-button">
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} /> Copy ID
            </button>
            {permissions.canInspect && (
              <Link to={`/admin/businesses/${businessId}/support`} className="btn-outline !px-2.5 flex items-center gap-1.5 text-button">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} /> Support mode
              </Link>
            )}
          </>
        }
      />

      <MetricRail columns={4}>
        <Metric label="Products" value={(metrics.productsCount ?? '-').toLocaleString?.('en-KE') ?? '-'} hint="Catalogue" />
        <Metric label="Sales recorded" value={(metrics.salesCount ?? 0).toLocaleString('en-KE')} hint="All time" />
        <Metric label="Customers" value={(metrics.customersCount ?? 0).toLocaleString('en-KE')} hint="Customer book" />
        <Metric
          label="Outstanding credit"
          prefix="KES"
          value={Number(metrics.totalOutstandingDebt || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}
          hint="Owed to this shop"
        />
      </MetricRail>

      {/* Tab bar. Grouped, scrollable, and it never loads a tab's data
          until that tab is the one on screen. */}
      <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Business inspector sections">
        <div className="flex w-max items-center gap-4 border-b border-line pb-2">
          {visibleGroups.map((group) => (
            <div key={group.label} className="flex items-center gap-1.5">
              <span className="shrink-0 pr-1 text-label uppercase text-ink-400">{group.label}</span>
              {group.tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex shrink-0 items-center gap-1.5 rounded-control px-2.5 py-1.5 text-button transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-800'
                        : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Account & plan">
              <StatementBlock>
                <StatementRow label="Plan" value={(business.effectivePlan || 'free').toUpperCase()} />
                <StatementRow label="Subscription status" value={business.subscription?.status || 'active'} />
                <StatementRow
                  label="Renews / expires"
                  value={business.subscription?.expiresAt ? formatDate(business.subscription.expiresAt) : 'Never'}
                  hint={data.licensing?.license?.owned ? 'perpetual licence, see below' : undefined}
                />
                <StatementRow label="Account status" value={business.status || 'active'} tone={isSuspended ? 'negative' : 'default'} />
                {business.statusReason && <StatementRow label="Status reason" value={business.statusReason} tone="muted" />}
                <StatementRow label="Created" value={formatDate(business.createdAt)} />
                <StatementRow label="Owner uid" value={business.createdBy || '-'} tone="muted" />
              </StatementBlock>
            </Section>

            <Section title="Shop profile">
              <StatementBlock>
                <StatementRow label="Shop name" value={settings.shopName || business.name || '-'} />
                <StatementRow label="Phone" value={settings.phone || '-'} />
                <StatementRow label="Email" value={settings.email || '-'} />
                <StatementRow label="Address" value={settings.address || '-'} />
                <StatementRow label="Inventory at cost" value={<Money value={metrics.totalInventoryCost} />} />
                <StatementRow label="Low stock items" value={metrics.lowStockCount ?? '-'} />
                <StatementRow
                  label="Product photos"
                  value={usage?.images?.available
                    ? `${usage.images.imageCount.value} · ${formatBytes(usage.images.totalBytes.value)}`
                    : '-'}
                />
              </StatementBlock>
            </Section>
          </div>

          {/* LICENCE AND SERVICES, ABOVE EVERYTHING ELSE THAT CAN BE
              CHANGED. An operator who is about to act on this business
              should see what it owns, what it renews and what is running
              before they see any button that alters one of them. */}
          <AdminLicensingSection
            businessId={businessId}
            licensing={data.licensing}
            permissions={permissions}
            onChanged={loadOverview}
          />

          <Section
            title="Business type"
            hint="Changing this never touches sales, stock, customers, payments or the plan."
            action={permissions.canChangeIndustry ? (
              <button type="button" onClick={openIndustryModal} className="btn-outline flex items-center gap-2 text-button">
                <Store className="h-4 w-4" strokeWidth={1.75} /> Change
              </button>
            ) : undefined}
          >
            <StatementBlock>
              <StatementRow label="Profile" value={industry.label} />
              <StatementRow label="Family" value={industry.family} tone="muted" />
              <StatementRow
                label="Configuration"
                value={industry.usesDefaults ? 'Industry defaults' : 'Custom overrides'}
                tone={industry.usesDefaults ? 'default' : 'muted'}
              />
              <StatementRow
                label="Categories"
                value={
                  industry.customCategories.length === 0 && industry.hiddenCategories.length === 0
                    ? `${industry.categories.length}, the suggested list for ${industry.label}`
                    : `${industry.categories.length} in use · ${industry.customCategories.length} added by the business · ${industry.hiddenCategories.length} removed`
                }
                tone="muted"
              />
              <StatementRow
                label="Capabilities on"
                value={
                  Object.keys(industry.capabilities).filter((k) => industry.capabilities[k]).length === 0
                    ? 'None, core FlowBiz only'
                    : Object.keys(industry.capabilities)
                        .filter((k) => industry.capabilities[k])
                        .map((k) => CAPABILITIES[k].label)
                        .join(', ')
                }
              />
              {!industry.usesDefaults && (
                <StatementRow
                  label="Differs from defaults"
                  value={Object.entries(industry.effectiveOverrides)
                    .map(([k, v]) => `${CAPABILITIES[k].label}: ${v ? 'on' : 'off'}`)
                    .join(', ')}
                  tone="muted"
                />
              )}
            </StatementBlock>
          </Section>

          {(business?.status || 'active') === 'active' && strandedStaff.length > 0 && permissions.canSuspend && (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-panel border border-warning-300 bg-warning-50 p-4">
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink-900">
                  This workspace is active, but {strandedStaff.length} account
                  {strandedStaff.length === 1 ? ' is' : 's are'} still deactivated
                </p>
                <p className="text-secondary text-ink-600">
                  They cannot sign in: the workspace was reactivated and these accounts were not.
                  Restoring switches them back on and touches nothing else. An account you or the
                  owner disabled deliberately is left alone; use Reactivate against it in the Team
                  list below.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary shrink-0"
                onClick={() => applyStatus('active', { restoreStaff: true })}
              >
                Restore staff access
              </button>
            </div>
          )}

          <Section
            title={`Team (${staff.length})`}
            hint="Owner and staff accounts on this business. A phone number opens a WhatsApp chat with a follow-up already typed. It is sent from whichever WhatsApp account you are signed in to, and nothing sends until you press send."
          >
            {staff.length === 0 ? (
              <EmptyState icon={Users} title="No staff accounts" />
            ) : (
              <DataTable
                mobileLayout="row"
                columns={[
                  { key: 'displayName', header: 'Name', primary: true, render: (u) => u.displayName || 'Staff' },
                  { key: 'email', header: 'Email', render: (u) => u.email || u.id },
                  {
                    key: 'phone',
                    header: 'Phone',
                    render: (u) => (
                      <WhatsAppContact
                        phone={u.phone}
                        ownerName={u.displayName}
                        businessName={business.name}
                        emptyLabel="-"
                      />
                    ),
                  },
                  { key: 'role', header: 'Role', mobileTrailing: true, render: (u) => <StatusPill tone={u.role === 'owner' ? 'info' : 'neutral'}>{u.role}</StatusPill> },
                  {
                    key: 'active', header: 'Status', mobileTrailing: true,
                    render: (u) => (
                      <div className="space-y-0.5">
                        <StatusPill tone={u.active !== false ? 'positive' : 'negative'}>
                          {u.active !== false ? 'Active' : 'Deactivated'}
                        </StatusPill>
                        {u.active === false && (
                          <p className="text-caption text-ink-500">
                            {DEACTIVATION_LABELS[
                              u.disabledByPlatform === true ? 'platform_security' : u.deactivationReason
                            ] || 'reason not recorded'}
                          </p>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'reactivate', header: '',
                    render: (u) =>
                      u.active === false && permissions.canReactivateAccount ? (
                        <button
                          type="button"
                          className="btn-outline"
                          disabled={reactivating === u.id}
                          onClick={() => reactivateAccount(u)}
                        >
                          {reactivating === u.id ? 'Reactivating…' : 'Reactivate'}
                        </button>
                      ) : null,
                  },
                ]}
                rows={staff}
              />
            )}
          </Section>

          {(permissions.canChangePlan || permissions.canEmailOwner || permissions.canSuspend) && (
            <Section
              title="Administrative actions"
              hint="These change the merchant's account. Every one is recorded in the audit trail with your name against it."
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {permissions.canChangePlan && (
                  <button type="button" onClick={() => setSubModal(true)} className="btn-outline flex items-center justify-center gap-2 text-button">
                    <Sparkles className="h-4 w-4" strokeWidth={1.75} /> Change plan
                  </button>
                )}
                {permissions.canEmailOwner && (
                  <>
                    <button type="button" onClick={() => runOwnerEmail(sendOwnerPasswordReset, 'Password reset')} className="btn-outline flex items-center justify-center gap-2 text-button">
                      <KeyRound className="h-4 w-4" strokeWidth={1.75} /> Send password reset
                    </button>
                    <button type="button" onClick={() => runOwnerEmail(sendOwnerVerification, 'Verification email')} className="btn-outline flex items-center justify-center gap-2 text-button">
                      <MailCheck className="h-4 w-4" strokeWidth={1.75} /> Send verification
                    </button>
                  </>
                )}
                {permissions.canSuspend && (
                  isSuspended ? (
                    <button type="button" onClick={() => setStatusConfirm('active')} className="btn-outline flex items-center justify-center gap-2 text-button">
                      <PlayCircle className="h-4 w-4" strokeWidth={1.75} /> Reactivate
                    </button>
                  ) : (
                    <button type="button" onClick={() => setStatusConfirm('suspended')} className="btn-outline flex items-center justify-center gap-2 border-danger-200 text-button text-danger-700">
                      <PauseCircle className="h-4 w-4" strokeWidth={1.75} /> Suspend workspace
                    </button>
                  )
                )}
              </div>
            </Section>
          )}

          {permissions.canDelete && (
            <Section title="Danger zone">
              <div className="rounded-panel border border-danger-200 bg-surface p-4">
                <p className="text-cell text-ink-600">
                  Permanently erases this business, its catalogue, sales, credit records, customers,
                  supplier history, photos, settings and every staff sign-in. There is no undo.
                </p>
                <button
                  type="button"
                  onClick={() => { setConfirmPhrase(''); setDeleteModal(true); }}
                  className="btn-danger mt-3 flex items-center gap-2 text-button"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Delete business completely
                </button>
              </div>
            </Section>
          )}
        </div>
      )}

      {activeTab === 'usage' && (
        <UsagePanel
          usage={usage}
          computedAt={data.usageComputedAt}
          loading={usageLoading}
          error={usageError}
          onReload={refreshUsage}
        />
      )}

      {activeTab === 'settings' && <SettingsTab settings={settings} />}
      {activeTab === 'products' && <ProductsSection businessId={businessId} active />}
      {activeTab === 'sales' && <SalesSection businessId={businessId} active />}
      {activeTab === 'stock' && <StockSection businessId={businessId} active />}
      {activeTab === 'purchases' && <PurchasesSection businessId={businessId} active />}
      {activeTab === 'customers' && <CustomersSection businessId={businessId} active />}
      {activeTab === 'credits' && <CreditsSection businessId={businessId} active />}
      {activeTab === 'repayments' && <RepaymentsSection businessId={businessId} active />}
      {activeTab === 'suppliers' && <SuppliersSection businessId={businessId} active />}
      {activeTab === 'expenses' && <ExpensesSection businessId={businessId} active />}
      {activeTab === 'documents' && <DocumentsSection businessId={businessId} active />}
      {activeTab === 'sessions' && <SessionsSection businessId={businessId} active />}
      {activeTab === 'photos' && <PhotosSection businessId={businessId} active />}
      {activeTab === 'payments' && permissions.canSeePayments && <PaymentsSection businessId={businessId} active />}
      {activeTab === 'audit' && canSeeAudit && <AuditTab businessId={businessId} />}

      {/* ── Change plan ── */}
      <Modal
        open={industryModal}
        onClose={() => !industryUpdating && setIndustryModal(false)}
        title="Change business type"
      >
        <div className="space-y-4">
          <p className="text-cell text-ink-600">
            This changes which pages, options and wording the merchant is offered. It writes two
            fields on their settings document and nothing else. No sale, product, customer, batch,
            payment, plan or entitlement is read or altered, and records behind a capability that
            is switched off are kept exactly where they are.
          </p>
          <p className="text-cell text-ink-600">
            Categories follow the same rule. The new trade's suggested groups replace the old
            trade's, and every category this business added or removed itself stays as it is. A
            product keeps the word it was filed under either way.
          </p>

          <div className="max-h-[40vh] space-y-3 overflow-y-auto pr-1">
            {profilesByFamily().map((family) => (
              <div key={family.id} className="space-y-1.5">
                <p className="text-label uppercase text-ink-400">{family.label}</p>
                {family.profiles.map((p) => {
                  const selected = p.id === industryChoice;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setIndustryChoice(p.id)}
                      aria-pressed={selected}
                      className={`flex w-full items-start gap-3 rounded-panel border px-3 py-2 text-left transition-colors ${
                        selected ? 'border-primary-600 bg-primary-50' : 'border-line bg-surface hover:bg-ink-50'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-cell font-medium text-ink-900">{p.label}</span>
                        <span className="block text-secondary text-ink-500">{p.tagline}</span>
                      </span>
                      {p.id === industry.profileId && (
                        <StatusPill tone="neutral">Current</StatusPill>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div>
            <label className="label">Reason (recorded in the audit trail)</label>
            <input
              className="input"
              value={industryReason}
              onChange={(e) => setIndustryReason(e.target.value)}
              placeholder="e.g. Merchant asked support to switch to Pharmacy"
              disabled={industryUpdating}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setIndustryModal(false)} disabled={industryUpdating}>
              Cancel
            </button>
            {!industry.usesDefaults && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => runIndustryUpdate({ resetOverrides: true }, 'Reset to industry defaults.')}
                disabled={industryUpdating}
              >
                Reset overrides
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={() => runIndustryUpdate(
                { industryProfile: industryChoice },
                `Business type set to ${getProfile(industryChoice).label}.`
              )}
              disabled={industryUpdating || industryChoice === industry.profileId}
            >
              {industryUpdating ? 'Saving…' : 'Apply business type'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={subModal} onClose={() => setSubModal(false)} title="Change platform plan">
        <form onSubmit={handleUpdateSubscription} className="space-y-4">
          <div>
            <label className="label">Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {['free', 'pro', 'lifetime'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSubPlan(p)}
                  className={`rounded-control border px-3 py-2 text-button ${
                    subPlan === p ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-line text-ink-600'
                  }`}
                >
                  {p === 'free' ? 'Free' : p === 'pro' ? 'Pro' : 'Lifetime'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="sub-status">Status</label>
            <select id="sub-status" value={subStatus} onChange={(e) => setSubStatus(e.target.value)} className="input">
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {subPlan === 'pro' && (
            <div>
              <label className="label" htmlFor="sub-days">Extend by (days)</label>
              <input
                id="sub-days"
                type="number"
                min="1"
                max="365"
                value={subDays}
                onChange={(e) => setSubDays(e.target.value)}
                className="input num"
              />
              <p className="section-hint mt-1">Capped at 365 days server-side, whatever this field is set to.</p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="sub-reason">Reason (recorded in the audit trail)</label>
            <input
              id="sub-reason"
              type="text"
              required
              value={subReason}
              onChange={(e) => setSubReason(e.target.value)}
              className="input"
              placeholder="e.g. Support resolution / courtesy grant"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setSubModal(false)} disabled={subUpdating}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={subUpdating}>
              {subUpdating ? 'Updating…' : 'Save plan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Suspend / reactivate ── */}
      <ConfirmDialog
        open={Boolean(statusConfirm)}
        title={statusConfirm === 'suspended' ? 'Suspend this workspace?' : 'Reactivate this workspace?'}
        message={
          statusConfirm === 'suspended'
            ? 'Suspending deactivates every staff account in this business and signs out every device, so nobody can sign in until it is reactivated. Nothing is deleted.'
            : 'Every account this suspension deactivated is switched back on, and the people in it can sign in again. An account you or the owner disabled deliberately is left alone. If any account stays deactivated afterwards, this page will offer to restore it.'
        }
        confirmLabel={statusConfirm === 'suspended' ? 'Suspend' : 'Reactivate'}
        danger={statusConfirm === 'suspended'}
        onConfirm={() => applyStatus(statusConfirm)}
        onCancel={() => setStatusConfirm(null)}
      />

      {/* ── Permanent deletion ── */}
      <Modal open={deleteModal} onClose={() => { if (!deleting) setDeleteModal(false); }} title="Permanently delete business">
        <form onSubmit={handleDeleteBusiness} className="space-y-4">
          <div className="rounded-panel border border-danger-200 bg-danger-50 p-4 text-cell text-danger-700">
            <p className="font-semibold text-danger-800">This cannot be undone.</p>
            <p className="mt-1">
              Every product, sale, credit record, customer, supplier, photo and setting belonging to{' '}
              <strong>{business.name || businessId}</strong> is erased, and every staff sign-in for it is deleted.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="delete-phrase">
              Type <span className="num font-semibold text-danger-700">{expectedDeletePhrase}</span> to confirm
            </label>
            <input
              id="delete-phrase"
              type="text"
              required
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={expectedDeletePhrase}
              className="input num"
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
              {deleting ? 'Deleting…' : 'Delete completely'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
