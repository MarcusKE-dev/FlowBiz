import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, addDoc, writeBatch, serverTimestamp, orderBy, where, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDailySession } from '../hooks/useDailySession';
import { useFinancialsForRange } from '../hooks/useFinancials';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct, updateProduct } from '../utils/products';
import { saleQuantityLabel, productUnit, normalizeQuantity } from '../utils/lineItems';
import { isStockItem, isService, resolveStockDeltas } from '../utils/inventory';
import { applyStockDeltas } from '../utils/stockWrites';
import { hasVariants } from '../utils/variants';
import { requiresModifierChoice } from '../utils/modifiers';
import { useIndustry } from '../hooks/useIndustry';
import { summarizeOpenOrders, KITCHEN_STATUSES, KITCHEN_LABELS, ORDER_STATUS } from '../utils/orders';
import { summarizeExpiry, todayISO } from '../utils/batches';
import { roundMoney } from '../utils/currency';
import { DEFAULT_UNIT, formatQuantityWithUnit } from '../industry/units';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import SaleModal from '../components/pos/SaleModal';
import SaleCompleteModal from '../components/pos/SaleCompleteModal';
import OpenSessionPrompt from '../components/pos/OpenSessionPrompt';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { startOfDay, endOfDay, formatDateTime } from '../utils/dateRanges';
import { Eye, EyeOff } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import MetricRail, { Metric } from '../components/ui/MetricRail';
import DataTable from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Money from '../components/ui/Money';
import { amountOnly } from '../components/ui/format';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Dashboard() {
  const { profile, isAdmin, businessId } = useAuth();
  const industry = useIndustry();
  // Which widgets this business gets, and in what order. A profile
  // contributes an ORDERING over shared widgets — it never contributes a
  // dashboard of its own. Every tile below is the same MetricRail, the
  // same DataTable and the same Section a General Retail shop sees.
  const widgets = industry.dashboard;
  // A widget is offered when the profile lists it AND, where one exists,
  // the capability behind it is on. `expiry` is the case that matters:
  // the Expiry PAGE is a ledger and belongs to `batches`, but the
  // dashboard tile and the counter's warning are ALERTS, and an owner who
  // turns alerts off is asking not to be warned. Without this the switch
  // was a dead one — it appeared in the owner's settings and changed
  // nothing anywhere in the product.
  const WIDGET_CAPABILITY = { expiry: 'expiryAlerts' };
  const wants = (id) => {
    if (!widgets.includes(id)) return false;
    const capability = WIDGET_CAPABILITY[id];
    return !capability || industry.can(capability);
  };
  const today = useMemo(() => ({ start: startOfDay(), end: endOfDay() }), []);
  const { loading: financialsLoading, summary, sales, creditSales, repayments } = useFinancialsForRange(today.start, today.end);

  const productsQuery = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  
  const customersQuery = useMemo(() => businessId ? tenantQuery('customers', businessId, orderBy('name')) : null, [businessId]);
  const suppliersQuery = useMemo(() => businessId ? tenantQuery('suppliers', businessId) : null, [businessId]); // Removed orderBy('name')
  const { data: products } = useFirestoreCollection(productsQuery);
  const { data: customers } = useFirestoreCollection(customersQuery);
  const { data: rawSuppliers, refetch: refetchSuppliers } = useFirestoreCollection(suppliersQuery);
  const { session, loading: sessionLoading, isClosed, openSession, reopenSession } = useDailySession();
  const [activeProduct, setActiveProduct] = useState(null);
  const [completedSale, setCompletedSale] = useState(null);
  const [editProduct, setEditProd] = useState(null);
  const [prodModal, setProdModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState(null);

  const [privacyMode, setPrivacyMode] = useState(() => {
    try { return localStorage.getItem('flowbiz_dashboard_privacy') === 'true'; }
    catch { return false; }
  });

  // Alphabetically sort suppliers in memory
  const suppliers = useMemo(() => {
    return [...rawSuppliers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [rawSuppliers]);

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => {
      const next = !prev;
      try { localStorage.setItem('flowbiz_dashboard_privacy', String(next)); }
      catch (err) { console.error('Failed to save privacy mode setting', err); }
      return next;
    });
  };

  // Digits only — the KES prefix is rendered separately and muted.
  const railValue = (val) => (privacyMode ? '••••••' : amountOnly(val));

  const dashboardCashReceived = summary.totalCashReceipts;
  const dashboardMpesaReceived = summary.totalMpesaReceipts;
  const dashboardExpenses = summary.totalExpenses;
  const dashboardNetProfit = summary.netProfit;

  // Services and made-to-order dishes have no stock, so they are neither
  // "low" nor part of inventory value. Without this filter a salon would
  // open FlowBiz every morning to a low-stock warning for every haircut
  // on its price list.
  const stockItems = useMemo(() => products.filter(isStockItem), [products]);
  const lowStock = stockItems.filter((p) => p.stock <= (p.lowStockThreshold ?? 5));
  const totalInventoryValue = stockItems.reduce((acc, p) => acc + (p.stock || 0) * (p.costPrice || 0), 0);
  const debtorsQuery = useMemo(() => businessId ? tenantQuery('creditSales', businessId) : null, [businessId]);
  const { data: allCreditSales } = useFirestoreCollection(debtorsQuery);
  const totalOutstanding = allCreditSales.reduce((acc, cs) => acc + (Number(cs.remainingBalance) || 0), 0);

  // Industry widgets each open their own listener, and ONLY when the
  // profile actually shows them. A General Retail dashboard therefore
  // makes exactly the queries it has always made — the industry layer
  // adds no reads to a business that does not use it.
  const ordersQuery = useMemo(
    () => (businessId && wants('openOrders')
      ? tenantQuery('orders', businessId, where('status', '==', ORDER_STATUS.OPEN), orderBy('openedAt', 'desc'))
      : null),
    [businessId, widgets] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const batchesQuery = useMemo(
    () => (businessId && wants('expiry') ? tenantQuery('productBatches', businessId) : null),
    [businessId, widgets, industry] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const productionsQuery = useMemo(
    () => (businessId && wants('productionToday')
      ? tenantQuery('productions', businessId, where('producedAt', '>=', today.start), where('producedAt', '<=', today.end), orderBy('producedAt', 'desc'))
      : null),
    [businessId, widgets, today] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { data: openOrders } = useFirestoreCollection(ordersQuery);
  const { data: batches } = useFirestoreCollection(batchesQuery);
  const { data: productionsToday } = useFirestoreCollection(productionsQuery);

  const orderSummary = useMemo(() => summarizeOpenOrders(openOrders), [openOrders]);
  const expirySummary = useMemo(
    () => summarizeExpiry(batches, products, { today: todayISO() }),
    [batches, products]
  );
  const productionCost = useMemo(
    () => productionsToday.reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0),
    [productionsToday]
  );
  const servicesSoldToday = useMemo(() => {
    const serviceIds = new Set(products.filter(isService).map((p) => p.id));
    let count = 0;
    for (const sale of sales || []) {
      if (sale.isVoided) continue;
      const items = Array.isArray(sale.items) ? sale.items : [{ productId: sale.productId, quantity: sale.quantity }];
      for (const item of items) {
        if (serviceIds.has(item.productId)) count += Number(item.quantity) || 0;
      }
    }
    return count;
  }, [products, sales]);

  const recentActivity = useMemo(() => {
    const list = [];
    (sales || []).forEach((s) => {
      if (s.isVoided) return;
      list.push({ id: `sale-${s.id}`, type: 'Sale', title: `${saleQuantityLabel(s)} × ${s.productName}`, subtitle: `Sold by ${s.soldByName || 'Staff'}`, amount: s.totalAmount, method: s.paymentMethod, timestamp: s.soldAt, isPositive: true });
    });
    (repayments || []).forEach((r) => {
      list.push({ id: `repayment-${r.id}`, type: 'Debt Repayment', title: `${r.customerName || 'Customer'}: ${r.productName || 'repayment'}`, subtitle: `Recorded by ${r.recordedByName || 'Staff'}`, amount: r.amount, method: r.method, timestamp: r.paidAt, isPositive: true });
    });
    (creditSales || []).forEach((cs) => {
      if (cs.status === 'cancelled' || cs.status === 'refunded') return;
      list.push({
        id: `credit-${cs.id}`, type: 'Credit Sale',
        title: `${saleQuantityLabel(cs)} × ${cs.productName}`,
        subtitle: `${cs.customerName || 'Customer'} · Sold by ${cs.soldByName || 'Staff'}`,
        amount: cs.totalAmount, method: 'Credit', timestamp: cs.soldAt, isPositive: false,
      });
    });
    return list.sort((a, b) => {
      const aTime = a.timestamp?.toMillis?.() ?? a.timestamp?.toDate?.()?.getTime?.() ?? new Date(a.timestamp || 0).getTime();
      const bTime = b.timestamp?.toMillis?.() ?? b.timestamp?.toDate?.()?.getTime?.() ?? new Date(b.timestamp || 0).getTime();
      return bTime - aTime;
    }).slice(0, 8);
  }, [sales, repayments, creditSales]);

  const handleCreateCustomer = async ({ name, phone }) => {
    const ref = await addDoc(tenantCollection('customers'), withBusiness({ name, phone, email: '', address: '', notes: '', createdAt: serverTimestamp() }, businessId));
    return { id: ref.id, name, phone };
  };

  // The dashboard's scan-to-sell used to write `stock: increment(-qty)`
  // straight onto the product — a second inventory engine that knew
  // nothing about services, recipes, versions or batches. It now resolves
  // through the same foundation the counter uses, so a salon's haircut
  // moves no stock, a made-to-order dish takes its ingredients, and a
  // pharmacy's sale is still refused a shortcut past FEFO below.
  const applyQuickSaleStock = (batch, product, qty) => {
    const deltas = resolveStockDeltas(
      [{ productId: product.id, quantity: qty }],
      products,
      { recipes: industry.can('recipes'), packSizes: industry.can('packSizes') }
    );
    applyStockDeltas(batch, deltas);
  };

  // Quick sell is a ONE-TAP path with no version picker, no modifier
  // sheet and no batch allocation. Rather than let it write a half-sale
  // that breaks an invariant the counter maintains, a product that needs
  // one of those is sent to the counter, which has all three.
  const quickSaleBlockedReason = (product) => {
    if (!product) return null;
    if (hasVariants(product)) return `${product.name} is sold by size or colour. Ring it up at the counter so the right one comes off the shelf.`;
    if (industry.can('batches') && !isService(product)) return `${product.name} is tracked by batch. Ring it up at the counter so it comes out of the right one.`;
    if (requiresModifierChoice(product)) return `${product.name} needs its options chosen. Ring it up at the counter.`;
    return null;
  };

  const handleConfirmSale = ({ product, quantity, soldPricePerUnit, paymentMethod, mpesaCode }) => {
    const saleRef = doc(collection(db, 'sales'));
    // Rounded as money rather than left as a raw float: with measured
    // units a quantity can be 0.333, and 0.333 × 33.33 is not a price.
    const unit = productUnit(product);
    const qty = normalizeQuantity(quantity, unit);
    const totalAmount = roundMoney(qty * soldPricePerUnit);
    const costOfGoodsSold = roundMoney(qty * (Number(product.costPrice) || 0));
    const saleData = withBusiness({
      productId: product.id, productName: product.name, quantity: qty,
      costPricePerUnit: product.costPrice, soldPricePerUnit,
      ...(unit !== DEFAULT_UNIT ? { unit } : {}),
      totalAmount,
      costOfGoodsSold,
      profit: roundMoney(totalAmount - costOfGoodsSold),
      paymentMethod, mpesaCode: mpesaCode || null,
      soldBy: profile.uid, soldByName: profile.displayName,
      soldAt: new Date(), isCredit: false, isVoided: false,
    }, businessId);

    const batch = writeBatch(db);
    applyQuickSaleStock(batch, product, qty);
    batch.set(saleRef, saleData);

    return { record: { id: saleRef.id, ...saleData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleConfirmCredit = ({ product, quantity, soldPricePerUnit, customerId, customerName, customerPhone }) => {
    const unit = productUnit(product);
    const qty = normalizeQuantity(quantity, unit);
    const totalAmount = roundMoney(qty * soldPricePerUnit);
    const creditRef = doc(collection(db, 'creditSales'));
    const creditData = withBusiness({
      customerId, customerName, customerPhone: customerPhone || '',
      productId: product.id, productName: product.name, quantity: qty,
      costPricePerUnit: product.costPrice, soldPricePerUnit, totalAmount,
      costOfGoodsSold: roundMoney(qty * (Number(product.costPrice) || 0)),
      ...(unit !== DEFAULT_UNIT ? { unit } : {}),
      soldBy: profile.uid, soldByName: profile.displayName, soldAt: serverTimestamp(),
      status: 'pending', amountPaid: 0, remainingBalance: totalAmount, paymentHistory: [],
      isCredit: true
    }, businessId);

    const batch = writeBatch(db);
    applyQuickSaleStock(batch, product, qty);
    batch.set(creditRef, creditData);

    return { record: { id: creditRef.id, ...creditData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleProductSave = async (data) => {
    let created = null;
    try {
      if (editProduct) {
        const { queuedOffline } = await updateProduct(editProduct.id, data, editProduct.barcode, businessId);
        toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Product updated');
      } else {
        const { id, queuedOffline } = await createProduct(data, businessId);
        created = { id };
        toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Product added');
      }
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
    finally { setEditProd(null); setProdModal(false); setPrefillBarcode(null); }
    // Returned so ProductFormModal can attach a photo to the new product.
    return created;
  };

  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); throw error; }
    if (ref?.id) {
      setNewSupplierId(ref.id);
      await refetchSuppliers();
    }
    setSupplierModal(false);
    toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Supplier added');
  };

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) {
      const blocked = quickSaleBlockedReason(found);
      if (blocked) { toast(blocked, { icon: 'ℹ️' }); return; }
      setActiveProduct(found);
    }
    else setNotFoundCode(code);
  };

  useHardwareScanner(handleScanDetected, {
    enabled: !!session && !isClosed && !activeProduct && !prodModal && !supplierModal && !scannerOpen && !notFoundCode && !completedSale,
  });

  if (sessionLoading) return <LoadingSpinner label="Loading today's session…" />;

  if (isClosed) {
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <EmptyState title="Day is closed" description="Sales are locked until you reopen the session or tomorrow starts." />
        {isAdmin && <button className="btn-primary w-full" onClick={reopenSession}>Reopen today's session</button>}
      </div>
    );
  }
  if (!session) {
    return <OpenSessionPrompt onOpen={(floats) => openSession({ ...floats, openedBy: profile.uid })} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={`Hello, ${profile?.displayName}`}
        description={isAdmin ? "Here's how the shop is doing today." : 'Ready to make a sale.'}
        actions={
          <button
            type="button"
            onClick={togglePrivacyMode}
            className="btn-secondary"
            aria-pressed={privacyMode}
            title={privacyMode ? 'Show sensitive balances' : 'Hide sensitive balances'}
          >
            {privacyMode
              ? <EyeOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              : <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
          </button>
        }
      />

      {isAdmin && wants('moneyToday') && (
        <Section title="Money today">
          {financialsLoading ? (
            <div className="h-[86px] animate-pulse rounded-panel border border-line bg-ink-50" aria-hidden="true" />
          ) : (
            <MetricRail columns={4}>
              <Metric label="Cash received"  prefix={privacyMode ? null : 'KES'} value={railValue(dashboardCashReceived)} />
              <Metric label="M-Pesa received" prefix={privacyMode ? null : 'KES'} value={railValue(dashboardMpesaReceived)} />
              <Metric label="Net profit"      prefix={privacyMode ? null : 'KES'} value={railValue(dashboardNetProfit)} />
              <Metric label="Expenses"        prefix={privacyMode ? null : 'KES'} value={railValue(dashboardExpenses)} />
            </MetricRail>
          )}
        </Section>
      )}

      {/* Food. What is on the floor right now, which is the first thing a
          restaurant owner looks for and the last thing a shop needs. */}
      {isAdmin && wants('openOrders') && (
        <Section
          title="On the floor"
          action={<Link to="/orders" className="btn-secondary">Open orders</Link>}
        >
          <MetricRail columns={industry.can('tables') ? 3 : 2}>
            <Metric label="Open orders" value={orderSummary.count} />
            <Metric label="Value on the floor" prefix={privacyMode ? null : 'KES'} value={railValue(orderSummary.total)} />
            {industry.can('tables') && (
              <Metric label="Tables in use" value={orderSummary.tablesOccupied} />
            )}
          </MetricRail>
        </Section>
      )}

      {isAdmin && wants('kitchenQueue') && industry.can('kitchen') && (
        <Section title="Kitchen">
          <div className="flex flex-wrap gap-2">
            {KITCHEN_STATUSES.map((status) => (
              <span key={status} className="flex items-center gap-2 rounded-panel border border-line bg-surface px-3 py-2">
                <StatusPill tone={status === 'ready' ? 'positive' : status === 'new' ? 'caution' : 'neutral'}>
                  {KITCHEN_LABELS[status]}
                </StatusPill>
                <span className="num text-body font-semibold text-ink-900">
                  {orderSummary.byKitchenStatus[status]}
                </span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Pharmacy. Expiry is the thing that costs a pharmacy money while
          it is not looking, so it sits above the general position. */}
      {isAdmin && wants('expiry') && (
        <Section
          title="Expiry"
          tone={expirySummary.expiredCount > 0 ? 'danger' : undefined}
          action={<Link to="/expiry" className="btn-secondary">View batches</Link>}
        >
          <MetricRail columns={3}>
            <Metric label="Expired batches" value={expirySummary.expiredCount} />
            <Metric label="Expiring in 90 days" value={expirySummary.expiringCount} />
            <Metric
              label="Value at risk"
              prefix={privacyMode ? null : 'KES'}
              value={railValue(expirySummary.expiringValue + expirySummary.expiredValue)}
            />
          </MetricRail>
        </Section>
      )}

      {/* Bakery. What was made today, and what it cost to make. */}
      {isAdmin && wants('productionToday') && (
        <Section
          title="Made today"
          action={<Link to="/production" className="btn-secondary">Record production</Link>}
        >
          <MetricRail columns={2}>
            <Metric label="Production runs" value={productionsToday.length} />
            <Metric label="Cost of what was made" prefix={privacyMode ? null : 'KES'} value={railValue(productionCost)} />
          </MetricRail>
        </Section>
      )}

      {isAdmin && wants('position') && (
        <Section title="Position">
          <MetricRail columns={3}>
            <Metric
              label="Inventory value at cost"
              prefix={privacyMode ? null : 'KES'}
              value={railValue(totalInventoryValue)}
            />
            <Metric
              label="Outstanding debt"
              prefix={privacyMode ? null : 'KES'}
              value={railValue(totalOutstanding)}
              hint={<Link to="/customers" className="font-medium text-primary-700 hover:underline">View customers</Link>}
            />
            <Metric
              label="Low stock items"
              value={lowStock.length}
              hint={<Link to="/products" className="font-medium text-primary-700 hover:underline">View {industry.terms.catalogueItemPlural}</Link>}
            />
          </MetricRail>
        </Section>
      )}

      {/* Services. A salon carries little stock, so "inventory value" is
          not the number it wants. How much work went through the chair
          today, and who still owes, are. */}
      {isAdmin && wants('servicePosition') && (
        <Section title="Position">
          <MetricRail columns={3}>
            <Metric label="Services done today" value={servicesSoldToday} />
            <Metric
              label="Outstanding debt"
              prefix={privacyMode ? null : 'KES'}
              value={railValue(totalOutstanding)}
              hint={<Link to="/customers" className="font-medium text-primary-700 hover:underline">View customers</Link>}
            />
            <Metric
              label="Products low on stock"
              value={lowStock.length}
              hint={<Link to="/products" className="font-medium text-primary-700 hover:underline">View {industry.terms.catalogueItemPlural}</Link>}
            />
          </MetricRail>
        </Section>
      )}

      {/* Supermarket, hardware and bakery: the reorder list, spelled out
          rather than reduced to a count, because at those catalogue sizes
          the count on its own is not actionable. */}
      {isAdmin && wants('lowStock') && lowStock.length > 0 && (
        <Section
          title="Running low"
          action={<Link to="/purchases" className="btn-secondary">Record a purchase</Link>}
        >
          <DataTable
            caption="Items at or below their low-stock level"
            rows={lowStock.slice(0, 8)}
            rowKey={(p) => p.id}
            mobileLayout="row"
            columns={[
              { key: 'name', header: 'Item', primary: true, render: (p) => p.name },
              { key: 'category', header: 'Category', render: (p) => <span className="text-ink-600">{p.category || '-'}</span> },
              {
                key: 'stock', header: 'Left', numeric: true, mobileTrailing: true,
                render: (p) => (
                  <StatusPill tone={p.stock <= 0 ? 'negative' : 'caution'}>
                    {formatQuantityWithUnit(p.stock, p.unit, { showPiece: true })}
                  </StatusPill>
                ),
              },
            ]}
          />
        </Section>
      )}

      <Section title="Activity today">
        <DataTable
          caption="Sales, credit sales and debt repayments recorded today"
          rows={recentActivity}
          rowKey={(r) => r.id}
          mobileLayout="row"
          columns={[
            {
              key: 'title',
              header: 'Item',
              primary: true,
              render: (a) => (
                <span className="font-medium text-ink-900">{a.title}</span>
              ),
            },
            {
              key: 'type',
              header: 'Type',
              mobileTrailing: true,
              render: (a) => (
                <StatusPill tone={a.isPositive ? 'positive' : 'caution'}>{a.type}</StatusPill>
              ),
            },
            { key: 'method', header: 'Method', render: (a) => <span className="text-ink-600">{a.method}</span> },
            {
              key: 'timestamp',
              header: 'Time',
              render: (a) => <span className="text-ink-600">{formatDateTime(a.timestamp)}</span>,
            },
            {
              key: 'amount',
              header: 'Amount',
              numeric: true,
              mobileTrailing: true,
              render: (a) => (
                /* Credit sales are stock leaving on account, not money in,
                   so they stay ink rather than reading as a receipt. The
                   Type pill on each row says which is which. */
                <span className="font-semibold">
                  <Money value={a.amount} masked={privacyMode} tone={a.isPositive ? 'positive' : undefined} />
                </span>
              ),
            },
          ]}
          empty={
            <EmptyState
              title="Nothing recorded yet today"
              description="Sales, credit sales and debt repayments will appear here as they happen."
            />
          }
        />
      </Section>

      <SaleModal 
        open={!!activeProduct} 
        product={activeProduct} 
        customers={customers} 
        onClose={(record) => {
          setActiveProduct(null);
          if (record && record.id) setCompletedSale(record);
        }} 
        onConfirmSale={handleConfirmSale} 
        onConfirmCredit={handleConfirmCredit} 
        onCreateCustomer={handleCreateCustomer} 
      />
      <SaleCompleteModal open={!!completedSale} sale={completedSale} onClose={() => setCompletedSale(null)} />

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!notFoundCode} onClose={() => setNotFoundCode(null)} title="Product not found" widthClass="max-w-xs">
        <p className="text-body text-ink-500 mb-4">No product matches barcode <span className="font-mono">{notFoundCode}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setNotFoundCode(null)}>Cancel</button>
          {isAdmin ? (
            <button className="btn-primary" onClick={() => { setEditProd(null); setPrefillBarcode(notFoundCode); setNotFoundCode(null); setProdModal(true); }}>Create Product</button>
          ) : (
            <span className="self-center text-secondary text-ink-400">Ask an owner to add this product.</span>
          )}
        </div>
      </Modal>

      <ProductFormModal
        allProducts={products}
        open={prodModal}
        onClose={() => { setProdModal(false); setEditProd(null); setPrefillBarcode(null); }}
        onSave={handleProductSave}
        suppliers={suppliers}
        initialProduct={editProduct}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
      />
      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
    </div>
  );
}