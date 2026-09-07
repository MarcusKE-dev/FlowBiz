// src/components/admin/inspector/InspectorSections.jsx
//
// One component per Inspector tab. Each is a thin wiring of
// useInspectorSection (paging) to InspectorPanel (frame) plus the column
// definitions for that record type.
//
// Every column reads a field that actually exists in FlowBiz's Firestore
// documents — the schemas were read out of the code that writes them
// (Counter.jsx for sales and credit sales, ProductFormModal for products,
// Expenses.jsx, StockTake.jsx, utils/customers.js, AuthContext for
// sessions). Nothing here invents a field, and nothing here recomputes a
// figure the merchant app already stores: `remainingBalance`, `profit` and
// `difference` are DISPLAYED as written, never re-derived. Support has to
// see what the shop sees, including when what the shop sees is wrong.

import { useState } from 'react';
import {
  Package, ShoppingCart, Users, BookOpen, Truck, Receipt,
  FileText, Boxes, Smartphone, ImageIcon, CreditCard, ShieldCheck,
} from 'lucide-react';
import useInspectorSection from './useInspectorSection';
import InspectorPanel from './InspectorPanel';
import Money from '../../ui/Money';
import StatusPill from '../../ui/StatusPill';
import { formatDate, formatDateTime } from '../../../utils/dateRanges';

const dash = <span className="text-ink-400">-</span>;

function text(value) {
  if (value === null || value === undefined || value === '') return dash;
  return String(value);
}

function bytes(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return dash;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Shared plumbing: search + date state, hook, panel. */
function useSectionState() {
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({ from: null, to: null });
  return { search, setSearch, range, setRange };
}

// ── Products ─────────────────────────────────────────────────────────
export function ProductsSection({ businessId, active }) {
  const { search, setSearch } = useSectionState();
  const state = useInspectorSection(businessId, 'products', { enabled: active, search, limit: 30 });

  const columns = [
    {
      key: 'name',
      header: 'Product',
      primary: true,
      render: (p) => (
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-ink-900">{p.name || 'Unnamed'}</span>
          {p.deleted === true && <StatusPill tone="negative">Deleted</StatusPill>}
        </span>
      ),
    },
    { key: 'category', header: 'Category', render: (p) => text(p.category) },
    {
      key: 'barcode',
      header: 'Barcode',
      render: (p) => (p.barcode ? <span className="num text-ink-600">{p.barcode}</span> : dash),
    },
    { key: 'costPrice', header: 'Cost', numeric: true, render: (p) => <Money value={p.costPrice} tone="muted" /> },
    {
      key: 'sellingPrice', header: 'Price', numeric: true, mobileTrailing: true,
      render: (p) => <Money value={p.sellingPrice} />,
    },
    {
      key: 'stock',
      header: 'Stock',
      numeric: true,
      mobileTrailing: true,
      render: (p) => {
        const stock = Number(p.stock) || 0;
        const threshold = Number(p.lowStockThreshold) || 5;
        const tone = stock <= 0 ? 'negative' : stock <= threshold ? 'caution' : 'neutral';
        const label = stock <= 0 ? 'Out' : stock <= threshold ? 'Low' : null;
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="num">{stock}</span>
            {label && <StatusPill tone={tone}>{label}</StatusPill>}
          </span>
        );
      },
    },
    {
      key: 'photo',
      header: 'Photo',
      render: (p) => (p.hasImage || p.imageUrl ? <StatusPill tone="info">Has photo</StatusPill> : dash),
    },
  ];

  return (
    <InspectorPanel
      title="Product catalogue"
      description="Every product this business has created, exactly as the shop sees it. Photos are counted here and sized on the Usage tab."
      columns={columns}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Product name, barcode or category…"
      emptyTitle="No products"
      emptyDescription="Nothing in this catalogue yet."
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Sales ────────────────────────────────────────────────────────────
export function SalesSection({ businessId, active }) {
  const { search, setSearch, range, setRange } = useSectionState();
  const state = useInspectorSection(businessId, 'sales', { enabled: active, search, from: range.from, to: range.to, limit: 30 });

  const columns = [
    {
      key: 'soldAt', header: 'When', primary: true,
      render: (s) => <span className="text-ink-800">{formatDateTime(s.soldAt)}</span>,
    },
    {
      key: 'productName', header: 'Items',
      render: (s) => (
        <span className="truncate text-ink-700">
          {s.productName || dash}
          {s.quantity ? <span className="text-ink-400"> · {s.quantity} unit{s.quantity === 1 ? '' : 's'}</span> : null}
        </span>
      ),
    },
    {
      key: 'paymentMethod', header: 'Tender',
      render: (s) => (
        <span className="text-ink-700">
          {text(s.paymentMethod)}
          {s.mpesaCode ? <span className="num ml-1 text-ink-400">{s.mpesaCode}</span> : null}
        </span>
      ),
    },
    { key: 'soldByName', header: 'Cashier', render: (s) => text(s.soldByName) },
    { key: 'costOfGoodsSold', header: 'COGS', numeric: true, render: (s) => <Money value={s.costOfGoodsSold} tone="muted" /> },
    { key: 'profit', header: 'Profit', numeric: true, render: (s) => <Money value={s.profit} /> },
    {
      key: 'totalAmount', header: 'Total', numeric: true, mobileTrailing: true,
      render: (s) => <Money value={s.totalAmount} />,
    },
    {
      key: 'isVoided', header: 'Status', mobileTrailing: true,
      render: (s) => (
        <StatusPill tone={s.isVoided ? 'negative' : 'positive'}>
          {s.isVoided ? 'Voided' : 'Completed'}
        </StatusPill>
      ),
    },
  ];

  return (
    <InspectorPanel
      title="Sales log"
      description="Cash and M-Pesa sales, newest first, exactly as the shop recorded them. Nothing here recalculates money."
      columns={columns}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Product, M-Pesa code or cashier…"
      dateRange={range}
      onDateRange={setRange}
      dateLabel="Sold between"
      emptyTitle="No sales in this range"
      emptyDescription="Widen the date range, or this business has not rung up a sale yet."
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Customers ────────────────────────────────────────────────────────
export function CustomersSection({ businessId, active }) {
  const { search, setSearch } = useSectionState();
  const state = useInspectorSection(businessId, 'customers', { enabled: active, search, limit: 30 });

  const columns = [
    { key: 'name', header: 'Customer', primary: true, render: (c) => <span className="font-medium text-ink-900">{text(c.name)}</span> },
    { key: 'phone', header: 'Phone', mobileTrailing: true, render: (c) => (c.phone ? <span className="num text-ink-700">{c.phone}</span> : dash) },
    { key: 'customerCode', header: 'Code', render: (c) => (c.customerCode ? <span className="num text-ink-500">{c.customerCode}</span> : dash) },
    { key: 'email', header: 'Email', render: (c) => text(c.email) },
    { key: 'address', header: 'Address', render: (c) => text(c.address) },
    { key: 'createdAt', header: 'Added', render: (c) => (c.createdAt ? formatDate(c.createdAt) : dash) },
  ];

  return (
    <InspectorPanel
      title="Customer book"
      description="The shop's customer records. Balances are held against credit sales, so open Credit and debtors for what a customer owes."
      columns={columns}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Name, phone or customer code…"
      emptyTitle="No customers"
      emptyDescription="This business has not saved a customer yet. A shop can sell without one; a credit sale cannot."
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Credit / debtors ─────────────────────────────────────────────────
const CREDIT_TONE = {
  pending: 'caution',
  partial: 'caution',
  paid: 'positive',
  cancelled: 'neutral',
  refunded: 'neutral',
};

export function CreditsSection({ businessId, active }) {
  const { search, setSearch, range, setRange } = useSectionState();
  const state = useInspectorSection(businessId, 'credits', { enabled: active, search, from: range.from, to: range.to, limit: 30 });

  const columns = [
    {
      key: 'customerName', header: 'Customer', primary: true,
      render: (c) => (
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink-900">{text(c.customerName)}</span>
          {c.customerPhone && <span className="num block text-label text-ink-400">{c.customerPhone}</span>}
        </span>
      ),
    },
    { key: 'soldAt', header: 'Taken', render: (c) => (c.soldAt ? formatDateTime(c.soldAt) : dash) },
    { key: 'productName', header: 'Items', render: (c) => text(c.productName) },
    { key: 'totalAmount', header: 'Original', numeric: true, render: (c) => <Money value={c.totalAmount} tone="muted" /> },
    { key: 'amountPaid', header: 'Paid', numeric: true, render: (c) => <Money value={c.amountPaid} /> },
    {
      key: 'remainingBalance', header: 'Still owed', numeric: true, mobileTrailing: true,
      render: (c) => <Money value={c.remainingBalance} tone={Number(c.remainingBalance) > 0 ? 'negative' : undefined} />,
    },
    {
      key: 'status', header: 'Status', mobileTrailing: true,
      render: (c) => <StatusPill tone={CREDIT_TONE[c.status] || 'neutral'}>{text(c.status)}</StatusPill>,
    },
  ];

  return (
    <InspectorPanel
      title="Credit & debtors (deni)"
      description="Every credit sale and what is left on it. Still owed is the shop's stored figure, never re-derived here."
      columns={columns}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Customer name, phone or item…"
      dateRange={range}
      onDateRange={setRange}
      dateLabel="Taken between"
      emptyTitle="No credit sales"
      emptyDescription="Nothing has been sold on credit in this range."
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Repayments ───────────────────────────────────────────────────────
export function RepaymentsSection({ businessId, active }) {
  const { search, setSearch, range, setRange } = useSectionState();
  const state = useInspectorSection(businessId, 'repayments', { enabled: active, search, from: range.from, to: range.to, limit: 30 });

  const columns = [
    { key: 'paidAt', header: 'When', primary: true, render: (r) => (r.paidAt ? formatDateTime(r.paidAt) : dash) },
    { key: 'customerName', header: 'Customer', render: (r) => text(r.customerName) },
    { key: 'paymentMethod', header: 'Method', render: (r) => text(r.paymentMethod) },
    { key: 'mpesaCode', header: 'Reference', render: (r) => (r.mpesaCode ? <span className="num text-ink-600">{r.mpesaCode}</span> : dash) },
    { key: 'amount', header: 'Amount', numeric: true, mobileTrailing: true, render: (r) => <Money value={r.amount ?? r.amountPaid} /> },
  ];

  return (
    <InspectorPanel
      title="Debt repayments"
      description="Payments made against credit sales, newest first."
      columns={columns}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Customer or M-Pesa code…"
      dateRange={range}
      onDateRange={setRange}
      dateLabel="Paid between"
      emptyTitle="No repayments recorded"
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Suppliers ────────────────────────────────────────────────────────
export function SuppliersSection({ businessId, active }) {
  const { search, setSearch } = useSectionState();
  const state = useInspectorSection(businessId, 'suppliers', { enabled: active, search, limit: 30 });

  const columns = [
    { key: 'name', header: 'Supplier', primary: true, render: (s) => <span className="font-medium text-ink-900">{text(s.name)}</span> },
    { key: 'contactPerson', header: 'Contact', render: (s) => text(s.contactPerson) },
    { key: 'phone', header: 'Phone', mobileTrailing: true, render: (s) => (s.phone ? <span className="num text-ink-700">{s.phone}</span> : dash) },
    { key: 'email', header: 'Email', render: (s) => text(s.email) },
    { key: 'address', header: 'Address', render: (s) => text(s.address) },
  ];

  return (
    <InspectorPanel
      title="Suppliers"
      description="The suppliers this business buys from."
      columns={columns}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Supplier name, contact or phone…"
      emptyTitle="No suppliers"
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Expenses ─────────────────────────────────────────────────────────
export function ExpensesSection({ businessId, active }) {
  const { search, setSearch, range, setRange } = useSectionState();
  const state = useInspectorSection(businessId, 'expenses', { enabled: active, search, from: range.from, to: range.to, limit: 30 });

  const columns = [
    { key: 'recordedAt', header: 'When', primary: true, render: (e) => (e.recordedAt ? formatDateTime(e.recordedAt) : dash) },
    { key: 'description', header: 'Description', render: (e) => text(e.description) },
    { key: 'category', header: 'Category', render: (e) => text(e.category) },
    {
      key: 'paymentMethod', header: 'Method',
      render: (e) => (
        <span className="text-ink-700">
          {text(e.paymentMethod)}
          {e.mpesaCode ? <span className="num ml-1 text-ink-400">{e.mpesaCode}</span> : null}
        </span>
      ),
    },
    { key: 'recordedByName', header: 'Recorded by', render: (e) => text(e.recordedByName) },
    { key: 'amount', header: 'Amount', numeric: true, mobileTrailing: true, render: (e) => <Money value={e.amount} /> },
  ];

  return (
    <InspectorPanel
      title="Expenses"
      description="Money the shop recorded going out. Read-only: this console never edits an expense."
      columns={columns}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Description or category…"
      dateRange={range}
      onDateRange={setRange}
      dateLabel="Recorded between"
      emptyTitle="No expenses in this range"
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Purchases ────────────────────────────────────────────────────────
export function PurchasesSection({ businessId, active }) {
  const { search, setSearch, range, setRange } = useSectionState();
  const state = useInspectorSection(businessId, 'purchases', { enabled: active, search, from: range.from, to: range.to, limit: 30 });

  const columns = [
    { key: 'purchasedAt', header: 'When', primary: true, render: (p) => (p.purchasedAt ? formatDateTime(p.purchasedAt) : dash) },
    { key: 'supplierName', header: 'Supplier', render: (p) => text(p.supplierName) },
    { key: 'invoiceNumber', header: 'Invoice', render: (p) => (p.invoiceNumber ? <span className="num text-ink-600">{p.invoiceNumber}</span> : dash) },
    { key: 'recordedByName', header: 'Recorded by', render: (p) => text(p.recordedByName) },
    { key: 'totalCost', header: 'Total cost', numeric: true, mobileTrailing: true, render: (p) => <Money value={p.totalCost} /> },
  ];

  return (
    <InspectorPanel
      title="Stock purchases"
      description="Goods bought in, as recorded on the Purchases screen."
      columns={columns}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Supplier or invoice number…"
      dateRange={range}
      onDateRange={setRange}
      dateLabel="Purchased between"
      emptyTitle="No purchases in this range"
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Stock activity ───────────────────────────────────────────────────
export function StockSection({ businessId, active }) {
  const { search, setSearch, range, setRange } = useSectionState();
  const state = useInspectorSection(businessId, 'stock', { enabled: active, search, from: range.from, to: range.to, limit: 30 });

  const columns = [
    { key: 'adjustedAt', header: 'When', primary: true, render: (a) => (a.adjustedAt ? formatDateTime(a.adjustedAt) : dash) },
    { key: 'productName', header: 'Product', render: (a) => text(a.productName) },
    { key: 'systemQty', header: 'System', numeric: true, render: (a) => <span className="num">{a.systemQty ?? dash}</span> },
    { key: 'physicalQty', header: 'Counted', numeric: true, render: (a) => <span className="num">{a.physicalQty ?? dash}</span> },
    {
      key: 'difference', header: 'Difference', numeric: true, mobileTrailing: true,
      render: (a) => {
        const d = Number(a.difference) || 0;
        return (
          <span className={`num ${d < 0 ? 'text-danger-700' : d > 0 ? 'text-primary-700' : 'text-ink-600'}`}>
            {d > 0 ? `+${d}` : d}
          </span>
        );
      },
    },
    { key: 'reason', header: 'Reason', render: (a) => text(a.reason) },
    { key: 'adjustedByName', header: 'By', render: (a) => text(a.adjustedByName) },
  ];

  return (
    <InspectorPanel
      title="Stock activity"
      description="What the system held, what was counted, and the difference."
      columns={columns}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Product, reason or staff name…"
      dateRange={range}
      onDateRange={setRange}
      dateLabel="Adjusted between"
      emptyTitle="No stock adjustments"
      emptyDescription="This business has not run a stock take. Stock has only moved through sales and purchases."
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Shared documents (receipts & invoices) ───────────────────────────
export function DocumentsSection({ businessId, active }) {
  const { search, setSearch, range, setRange } = useSectionState();
  const state = useInspectorSection(businessId, 'documents', { enabled: active, search, from: range.from, to: range.to, limit: 30 });

  const columns = [
    { key: 'createdAt', header: 'Shared', primary: true, render: (d) => (d.createdAt ? formatDateTime(d.createdAt) : dash) },
    {
      key: 'documentType', header: 'Type', mobileTrailing: true,
      render: (d) => <StatusPill tone="info">{text(d.documentType)}</StatusPill>,
    },
    { key: 'documentId', header: 'Source record', render: (d) => (d.documentId ? <span className="num text-ink-600">{d.documentId}</span> : dash) },
    { key: 'id', header: 'Share token', render: (d) => <span className="num text-ink-400">{d.id}</span> },
  ];

  return (
    <InspectorPanel
      title="Shared receipts & invoices"
      description="Links this shop generated for a customer. Tokens are shown for support reference; this console does not open or re-issue them."
      columns={columns}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Type or source record id…"
      dateRange={range}
      onDateRange={setRange}
      dateLabel="Shared between"
      emptyTitle="No shared documents"
      emptyDescription="Nobody in this shop has sent a receipt or invoice link yet."
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Sessions / devices ───────────────────────────────────────────────
export function SessionsSection({ businessId, active }) {
  const state = useInspectorSection(businessId, 'sessions', { enabled: active, limit: 50 });

  const columns = [
    {
      key: 'lastUserName', header: 'Signed in as', primary: true,
      render: (s) => <span className="font-medium text-ink-900">{text(s.lastUserName)}</span>,
    },
    { key: 'deviceLabel', header: 'Device', render: (s) => text(s.deviceLabel) },
    {
      key: 'lastActiveAt', header: 'Last active', mobileTrailing: true,
      render: (s) => (s.lastActiveAt ? formatDateTime(s.lastActiveAt) : dash),
    },
    { key: 'createdAt', header: 'First seen', render: (s) => (s.createdAt ? formatDate(s.createdAt) : dash) },
    {
      key: 'revoked', header: 'Status', mobileTrailing: true,
      render: (s) => (
        <StatusPill tone={s.revoked === true ? 'negative' : 'positive'}>
          {s.revoked === true ? 'Revoked' : 'Active'}
        </StatusPill>
      ),
    },
    {
      key: 'userAgent', header: 'Browser',
      render: (s) => <span className="truncate text-label text-ink-400">{text(s.userAgent)}</span>,
    },
  ];

  return (
    <InspectorPanel
      title="Devices & sessions"
      description="Devices registered against this business. Monitoring only: nothing here revokes or limits."
      columns={columns}
      emptyTitle="No devices registered"
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Product photos ───────────────────────────────────────────────────
export function PhotosSection({ businessId, active }) {
  const state = useInspectorSection(businessId, 'productImages', { enabled: active, limit: 30 });

  const columns = [
    { key: 'productId', header: 'Product id', primary: true, render: (i) => <span className="num text-ink-800">{text(i.productId)}</span> },
    { key: 'contentType', header: 'Format', render: (i) => text(i.contentType) },
    {
      key: 'dimensions', header: 'Dimensions',
      render: (i) => (i.width && i.height ? <span className="num text-ink-600">{i.width}×{i.height}</span> : dash),
    },
    { key: 'bytes', header: 'Stored size', numeric: true, mobileTrailing: true, render: (i) => <span className="num">{bytes(i.bytes)}</span> },
    { key: 'stamp', header: 'Uploaded', mobileTrailing: true, render: (i) => (i.stamp ? formatDateTime(new Date(Number(i.stamp))) : dash) },
  ];

  return (
    <InspectorPanel
      title="Product photos"
      description="One row per stored photo, with its recorded byte size. The images are not loaded: weighing a photo does not require downloading it."
      columns={columns}
      emptyTitle="No product photos"
      emptyDescription="This business has not attached a photo to any product."
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

// ── Payments ─────────────────────────────────────────────────────────
const PAYMENT_TONE = { success: 'positive', pending: 'caution', failed: 'negative' };

export function PaymentsSection({ businessId, active }) {
  const { range, setRange } = useSectionState();
  const state = useInspectorSection(businessId, 'payments', { enabled: active, from: range.from, to: range.to, limit: 25 });

  const columns = [
    { key: 'createdAt', header: 'Started', primary: true, render: (p) => (p.createdAt ? formatDateTime(p.createdAt) : dash) },
    { key: 'plan', header: 'Plan', render: (p) => text(p.plan) },
    { key: 'amountKes', header: 'Amount', numeric: true, mobileTrailing: true, render: (p) => <Money value={p.amountKes} /> },
    {
      key: 'status', header: 'Status', mobileTrailing: true,
      render: (p) => <StatusPill tone={PAYMENT_TONE[p.status] || 'neutral'}>{text(p.status)}</StatusPill>,
    },
    { key: 'confirmedAt', header: 'Confirmed', render: (p) => (p.confirmedAt ? formatDateTime(p.confirmedAt) : dash) },
    { key: 'id', header: 'Reference', render: (p) => <span className="num text-label text-ink-400">{p.id}</span> },
  ];

  return (
    <InspectorPanel
      title="Payment records"
      description="What this business started, and what the Paystack webhook confirmed. Paystack's dashboard remains the authority on settled money."
      columns={columns}
      dateRange={range}
      onDateRange={setRange}
      dateLabel="Started between"
      emptyTitle="No payment records"
      emptyDescription="This business has never begun a Pro or Lifetime checkout."
      {...state}
      onLoadMore={state.loadMore}
      onReload={state.reload}
    />
  );
}

export const SECTION_ICONS = {
  products: Package,
  sales: ShoppingCart,
  customers: Users,
  credits: BookOpen,
  repayments: Receipt,
  suppliers: Truck,
  expenses: Receipt,
  purchases: Truck,
  stock: Boxes,
  documents: FileText,
  sessions: Smartphone,
  productImages: ImageIcon,
  payments: CreditCard,
  audit: ShieldCheck,
};
