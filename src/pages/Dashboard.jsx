import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, addDoc, writeBatch, increment, serverTimestamp, orderBy, where, collection } from 'firebase/firestore';
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

  const lowStock = products.filter((p) => p.stock <= (p.lowStockThreshold ?? 5));
  const totalInventoryValue = products.reduce((acc, p) => acc + (p.stock || 0) * (p.costPrice || 0), 0);
  const debtorsQuery = useMemo(() => businessId ? tenantQuery('creditSales', businessId) : null, [businessId]);
  const { data: allCreditSales } = useFirestoreCollection(debtorsQuery);
  const totalOutstanding = allCreditSales.reduce((acc, cs) => acc + (Number(cs.remainingBalance) || 0), 0);

  const recentActivity = useMemo(() => {
    const list = [];
    (sales || []).forEach((s) => {
      if (s.isVoided) return;
      list.push({ id: `sale-${s.id}`, type: 'Sale', title: `${s.quantity} × ${s.productName}`, subtitle: `Sold by ${s.soldByName || 'Staff'}`, amount: s.totalAmount, method: s.paymentMethod, timestamp: s.soldAt, isPositive: true });
    });
    (repayments || []).forEach((r) => {
      list.push({ id: `repayment-${r.id}`, type: 'Debt Repayment', title: `${r.customerName || 'Customer'} — ${r.productName || 'repayment'}`, subtitle: `Recorded by ${r.recordedByName || 'Staff'}`, amount: r.amount, method: r.method, timestamp: r.paidAt, isPositive: true });
    });
    (creditSales || []).forEach((cs) => {
      if (cs.status === 'cancelled' || cs.status === 'refunded') return;
      list.push({
        id: `credit-${cs.id}`, type: 'Credit Sale',
        title: `${cs.quantity} × ${cs.productName}`,
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

  const handleConfirmSale = ({ product, quantity, soldPricePerUnit, paymentMethod, mpesaCode }) => {
    const productRef = doc(db, 'products', product.id);
    const saleRef = doc(collection(db, 'sales'));
    const saleData = withBusiness({
      productId: product.id, productName: product.name, quantity,
      costPricePerUnit: product.costPrice, soldPricePerUnit,
      totalAmount: soldPricePerUnit * quantity,
      profit: (soldPricePerUnit - product.costPrice) * quantity,
      paymentMethod, mpesaCode: mpesaCode || null,
      soldBy: profile.uid, soldByName: profile.displayName,
      soldAt: new Date(), isCredit: false, isVoided: false,
    }, businessId);

    const batch = writeBatch(db);
    batch.update(productRef, { stock: increment(-quantity), updatedAt: serverTimestamp() });
    batch.set(saleRef, saleData);

    return { record: { id: saleRef.id, ...saleData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleConfirmCredit = ({ product, quantity, soldPricePerUnit, customerId, customerName, customerPhone }) => {
    const productRef = doc(db, 'products', product.id);
    const totalAmount = soldPricePerUnit * quantity;
    const creditRef = doc(collection(db, 'creditSales'));
    const creditData = withBusiness({
      customerId, customerName, customerPhone: customerPhone || '',
      productId: product.id, productName: product.name, quantity,
      costPricePerUnit: product.costPrice, soldPricePerUnit, totalAmount,
      soldBy: profile.uid, soldByName: profile.displayName, soldAt: serverTimestamp(),
      status: 'pending', amountPaid: 0, remainingBalance: totalAmount, paymentHistory: [],
      isCredit: true
    }, businessId);

    const batch = writeBatch(db);
    batch.update(productRef, { stock: increment(-quantity), updatedAt: serverTimestamp() });
    batch.set(creditRef, creditData);

    return { record: { id: creditRef.id, ...creditData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleProductSave = async (data) => {
    try {
      if (editProduct) {
        const { queuedOffline } = await updateProduct(editProduct.id, data, editProduct.barcode, businessId);
        toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product updated');
      } else {
        const { queuedOffline } = await createProduct(data, businessId);
        toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product added');
      }
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
    finally { setEditProd(null); setProdModal(false); setPrefillBarcode(null); }
  };

  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); throw error; }
    if (!queuedOffline) {
      setNewSupplierId(ref.id);
      await refetchSuppliers();
    }
    setSupplierModal(false);
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Supplier added');
  };

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) setActiveProduct(found);
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
            {privacyMode ? 'Show figures' : 'Hide figures'}
          </button>
        }
      />

      {isAdmin && (
        <>
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
                hint={<Link to="/products" className="font-medium text-primary-700 hover:underline">View products</Link>}
              />
            </MetricRail>
          </Section>
        </>
      )}

      <Section title="Activity today">
        <DataTable
          caption="Sales, credit sales and debt repayments recorded today"
          rows={recentActivity}
          rowKey={(r) => r.id}
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
        <p className="text-sm text-ink-500 mb-4">No product matches barcode <span className="font-mono">{notFoundCode}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setNotFoundCode(null)}>Cancel</button>
          {isAdmin ? (
            <button className="btn-primary" onClick={() => { setEditProd(null); setPrefillBarcode(notFoundCode); setNotFoundCode(null); setProdModal(true); }}>Create Product</button>
          ) : (
            <span className="self-center text-xs text-ink-400">Ask an owner to add this product.</span>
          )}
        </div>
      </Modal>

      <ProductFormModal
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