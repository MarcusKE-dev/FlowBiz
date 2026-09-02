// src/pages/Counter.jsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { doc, addDoc, writeBatch, increment, serverTimestamp, orderBy, where, limit, getDoc, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import {
  Trash2, ShoppingCart, Printer, Download,
  MessageCircle, CheckCircle2, X, Plus, Minus
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDailySession } from '../hooks/useDailySession';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct } from '../utils/products';
import { printReceipt, generateReceiptPDF, printInvoice, generateInvoicePDF, sendWhatsAppDocument } from '../utils/documentService';
import { getOrCreateShareLink } from '../utils/documentSharing';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import ProductGrid from '../components/pos/ProductGrid';
import CartList from '../components/pos/CartList';
import PaymentMethodSelect from '../components/pos/PaymentMethodSelect';
import CartCheckoutModal from '../components/pos/CartCheckoutModal';
import SaleCompleteModal from '../components/pos/SaleCompleteModal';
import OpenSessionPrompt from '../components/pos/OpenSessionPrompt';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import DataTable from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Money from '../components/ui/Money';
import { formatKES, roundMoney } from '../utils/currency';
import { formatDateTime } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

// ── Everything below this line down to the component itself is 100%
// unchanged business logic — no Firestore calls, no auth handling, and
// no data flow were touched in this pass. Only the JSX returned at the
// bottom (the desktop layout) was reworked. ──────────────────────────

function toLineItem(cartRow) {
  const quantity = Number(cartRow.quantity) || 0;
  const unitPrice = Number(cartRow.unitPrice) || 0;
  const costPrice = Number(cartRow.costPrice) || 0;
  const lineTotal = roundMoney(quantity * unitPrice);
  const lineCost = roundMoney(quantity * costPrice);
  return {
    productId: cartRow.productId,
    productName: cartRow.productName,
    quantity,
    unitPrice,
    costPrice,
    lineTotal,
    lineCost,
    lineProfit: roundMoney(lineTotal - lineCost),
    barcode: cartRow.barcode || null,
  };
}

function summarizeProductName(lineItems) {
  if (lineItems.length === 1) return lineItems[0].productName;
  return `${lineItems[0].productName} +${lineItems.length - 1} more`;
}

export default function Counter() {
  const { profile, isAdmin, isPro, businessId } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();

  const productsQ = useMemo(() => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null), [businessId]);
  const customersQ = useMemo(() => (businessId ? tenantQuery('customers', businessId, orderBy('name')) : null), [businessId]);
  const salesQ = useMemo(() => (businessId ? tenantQuery('sales', businessId, orderBy('soldAt', 'desc'), limit(100)) : null), [businessId]);
  const creditSalesQ = useMemo(() => (businessId ? tenantQuery('creditSales', businessId, orderBy('soldAt', 'desc'), limit(100)) : null), [businessId]);
  const suppliersQ = useMemo(() => (businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null), [businessId]);

  const { data: products, loading: prodLoading } = useFirestoreCollection(productsQ);
  const { data: customers } = useFirestoreCollection(customersQ);
  const { data: sales, loading: salesLoading } = useFirestoreCollection(salesQ);
  const { data: creditSales, loading: creditLoading } = useFirestoreCollection(creditSalesQ);
  const { data: suppliers, refetch: refetchSuppliers } = useFirestoreCollection(suppliersQ);
  const { session, loading: sessLoading, isClosed, openSession, reopenSession } = useDailySession();

  const [search, setSearch] = useState('');

  // Cart State
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);

  // Desktop In-Place Checkout & Direct Document State
  const [desktopMethod, setDesktopMethod] = useState('Cash');
  const [desktopMpesaCode, setDesktopMpesaCode] = useState('');
  const [desktopCustomerId, setDesktopCustomerId] = useState('');
  const [desktopNewMode, setDesktopNewMode] = useState(false);
  const [desktopNewName, setDesktopNewName] = useState('');
  const [desktopNewPhone, setDesktopNewPhone] = useState('');
  const [desktopSubmitting, setDesktopSubmitting] = useState(false);
  const [desktopLastSale, setDesktopLastSale] = useState(null);
  const [desktopCustomerPhone, setDesktopCustomerPhone] = useState('');
  const [desktopSendingWhatsApp, setDesktopSendingWhatsApp] = useState(false);

  const [pendingVoid, setPendingVoid] = useState(null);
  const [prodModal, setProdModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState(null);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    if (location.state?.autoScan && session && !isClosed) {
      setScannerOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, session, isClosed]);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search.trim())) ||
      (p.internalCode && p.internalCode.toLowerCase().includes(search.toLowerCase()))
  );

  const cartQuantities = useMemo(
    () => Object.fromEntries(cart.map((item) => [item.productId, item.quantity])),
    [cart]
  );

  const mergedSales = useMemo(() => {
    const list = [];
    sales.forEach((s) => { list.push({ ...s, isCredit: false, paymentType: s.paymentMethod || 'Cash' }); });
    creditSales.forEach((cs) => { list.push({ ...cs, isCredit: true, paymentType: 'Credit' }); });
    return list.sort((a, b) => {
      const aTime = a.soldAt?.toMillis?.() ?? a.soldAt?.toDate?.()?.getTime?.() ?? new Date(a.soldAt || 0).getTime();
      const bTime = b.soldAt?.toMillis?.() ?? b.soldAt?.toDate?.()?.getTime?.() ?? new Date(b.soldAt || 0).getTime();
      return bTime - aTime;
    }).slice(0, 100);
  }, [sales, creditSales]);

  // Cart operations
  const addToCart = (product, qty = 1) => {
    if (!product) return;
    if ((product.stock || 0) <= 0) {
      toast.error(`${product.name} is out of stock.`);
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.productId === product.id);
      if (idx >= 0) {
        const nextQty = (Number(prev[idx].quantity) || 0) + qty;
        if (nextQty > product.stock) {
          toast.error(`Only ${product.stock} of ${product.name} in stock.`);
          return prev;
        }
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: nextQty };
        return next;
      }
      if (qty > product.stock) {
        toast.error(`Only ${product.stock} of ${product.name} in stock.`);
        return prev;
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: qty,
          unitPrice: product.sellingPrice,
          costPrice: product.costPrice,
          barcode: product.barcode || null,
        },
      ];
    });
  };

  const updateCartQuantity = (productId, rawQty) => {
    const product = products.find((p) => p.id === productId);
    let qty = parseInt(rawQty, 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (product && qty > product.stock) {
      toast.error(`Only ${product.stock} of ${product.name} in stock.`);
      qty = product.stock;
    }
    if (qty < 1) return;
    setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, quantity: qty } : item)));
  };

  const updateCartPrice = (productId, rawPrice) => {
    let price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) price = 0;
    setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, unitPrice: price } : item)));
  };

  const removeCartItem = (productId) => setCart((prev) => prev.filter((item) => item.productId !== productId));
  const clearCart = () => setCart([]);

  const cartTotal = useMemo(
    () => roundMoney(cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)),
    [cart]
  );
  const cartCost = useMemo(
    () => roundMoney(cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.costPrice) || 0), 0)),
    [cart]
  );
  const cartEstimatedProfit = Math.max(0, cartTotal - cartCost);

  function validateCartAgainstStock() {
    for (const row of cart) {
      const product = products.find((p) => p.id === row.productId);
      if (!product) throw new Error(`${row.productName} is no longer available.`);
      if ((Number(row.quantity) || 0) > product.stock) {
        throw new Error(`Only ${product.stock} of ${row.productName} left in stock.`);
      }
    }
  }

  const handleCartSale = ({ paymentMethod, mpesaCode }) => {
    validateCartAgainstStock();
    const lineItems = cart.map(toLineItem);
    const totalAmount = roundMoney(lineItems.reduce((s, i) => s + i.lineTotal, 0));
    const costOfGoodsSold = roundMoney(lineItems.reduce((s, i) => s + i.lineCost, 0));
    const profit = roundMoney(totalAmount - costOfGoodsSold);
    const quantity = lineItems.reduce((s, i) => s + i.quantity, 0);

    const saleRef = doc(collection(db, 'sales'));
    const saleData = withBusiness(
      {
        items: lineItems,
        productName: summarizeProductName(lineItems),
        quantity,
        totalAmount,
        costOfGoodsSold,
        profit,
        ...(lineItems.length === 1 ? { costPricePerUnit: lineItems[0].costPrice, soldPricePerUnit: lineItems[0].unitPrice } : {}),
        paymentMethod,
        mpesaCode: mpesaCode || null,
        soldBy: profile.uid,
        soldByName: profile.displayName,
        soldAt: new Date(),
        isCredit: false,
        isVoided: false,
      },
      businessId
    );

    const batch = writeBatch(db);
    lineItems.forEach((item) => {
      batch.update(doc(db, 'products', item.productId), { stock: increment(-item.quantity), updatedAt: serverTimestamp() });
    });
    batch.set(saleRef, saleData);

    return { record: { id: saleRef.id, ...saleData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleCartCredit = ({ customerId, customerName, customerPhone }) => {
    validateCartAgainstStock();
    const lineItems = cart.map(toLineItem);
    const totalAmount = roundMoney(lineItems.reduce((s, i) => s + i.lineTotal, 0));
    const costOfGoodsSold = roundMoney(lineItems.reduce((s, i) => s + i.lineCost, 0));
    const quantity = lineItems.reduce((s, i) => s + i.quantity, 0);

    const creditRef = doc(collection(db, 'creditSales'));
    const creditData = withBusiness(
      {
        customerId,
        customerName,
        customerPhone: customerPhone || '',
        items: lineItems,
        productName: summarizeProductName(lineItems),
        quantity,
        totalAmount,
        costOfGoodsSold,
        ...(lineItems.length === 1 ? { costPricePerUnit: lineItems[0].costPrice, soldPricePerUnit: lineItems[0].unitPrice } : {}),
        soldBy: profile.uid,
        soldByName: profile.displayName,
        soldAt: serverTimestamp(),
        status: 'pending',
        amountPaid: 0,
        remainingBalance: totalAmount,
        paymentHistory: [],
        isCredit: true,
      },
      businessId
    );

    const batch = writeBatch(db);
    lineItems.forEach((item) => {
      batch.update(doc(db, 'products', item.productId), { stock: increment(-item.quantity), updatedAt: serverTimestamp() });
    });
    batch.set(creditRef, creditData);

    return { record: { id: creditRef.id, ...creditData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleCreateCustomer = async ({ name, phone }) => {
    const ref = await addDoc(tenantCollection('customers'), withBusiness({ name, phone, email: '', address: '', notes: '', createdAt: serverTimestamp() }, businessId));
    return { id: ref.id, name, phone };
  };

  // In-Place Desktop Checkout (Direct execution on PC screen)
  const handleDesktopCheckout = async () => {
    if (cart.length === 0 || desktopSubmitting) return;
    if (desktopMethod === 'M-Pesa' && !desktopMpesaCode.trim()) {
      toast.error('Enter M-Pesa transaction code.');
      return;
    }
    if (desktopMethod === 'Credit' && !desktopCustomerId && !(desktopNewMode && desktopNewName.trim())) {
      toast.error('Please select or create a customer for credit sales.');
      return;
    }

    setDesktopSubmitting(true);
    try {
      let cId = desktopCustomerId;
      let cName = customers.find((c) => c.id === desktopCustomerId)?.name;
      let cPhone = customers.find((c) => c.id === desktopCustomerId)?.phone;

      if (desktopMethod === 'Credit' && desktopNewMode) {
        const cr = await handleCreateCustomer({ name: desktopNewName.trim(), phone: desktopNewPhone.trim() });
        cId = cr.id;
        cName = cr.name;
        cPhone = cr.phone;
      }

      const { record, commit } =
        desktopMethod === 'Credit'
          ? handleCartCredit({ customerId: cId, customerName: cName, customerPhone: cPhone })
          : handleCartSale({ paymentMethod: desktopMethod, mpesaCode: desktopMethod === 'M-Pesa' ? desktopMpesaCode.trim() : null });

      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;

      if (queuedOffline) {
        toast.success("Sale saved — it'll sync once you're back online.");
        commit.catch((err) => toast.error(`A sale from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      } else {
        toast.success('Sale completed!');
      }

      setDesktopLastSale(record);
      setDesktopCustomerPhone(cPhone || record.customerPhone || '');
      clearCart();
      setDesktopMpesaCode('');
      setDesktopCustomerId('');
      setDesktopNewMode(false);
      setDesktopNewName('');
      setDesktopNewPhone('');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setDesktopSubmitting(false);
    }
  };

  // Direct In-Panel WhatsApp Sender
  const handleDesktopWhatsApp = async () => {
    if (!desktopCustomerPhone.trim()) {
      toast.error('Enter a valid customer phone number.');
      return;
    }
    if (!desktopLastSale) return;
    setDesktopSendingWhatsApp(true);
    try {
      const documentUrl = await getOrCreateShareLink({
        businessId,
        documentType: desktopLastSale.isCredit ? 'invoice' : 'receipt',
        documentId: desktopLastSale.id,
        createdBy: profile?.uid,
      });
      sendWhatsAppDocument(desktopLastSale, settings, desktopCustomerPhone.trim(), documentUrl);
      toast.success('WhatsApp opened.');
    } catch (err) {
      toast.error(err.message || 'Could not send WhatsApp receipt.');
    } finally {
      setDesktopSendingWhatsApp(false);
    }
  };

  const handleCheckoutClose = (record) => {
    setCheckoutOpen(false);
    if (record && record.id) {
      setCompletedSale(record);
      setDesktopLastSale(record);
      setDesktopCustomerPhone(record.customerPhone || '');
      clearCart();
    }
  };

  const handleVoid = async () => {
    const sale = pendingVoid;
    setVoiding(true);
    try {
      const lineItems = Array.isArray(sale.items) && sale.items.length > 0 ? sale.items : [{ productId: sale.productId, quantity: sale.quantity }];
      const targets = lineItems.filter((item) => item.productId);
      const snaps = await Promise.all(targets.map((item) => getDoc(doc(db, 'products', item.productId))));

      const batch = writeBatch(db);
      let anyProductMissing = false;
      targets.forEach((item, idx) => {
        if (snaps[idx].exists()) {
          batch.update(doc(db, 'products', item.productId), { stock: increment(item.quantity), updatedAt: serverTimestamp() });
        } else {
          anyProductMissing = true;
        }
      });

      batch.update(doc(db, 'sales', sale.id), { isVoided: true, voidedAt: serverTimestamp(), voidedBy: profile.uid });

      const { queuedOffline, error } = await raceWithTimeout(batch.commit(), 4000);
      if (error) throw error;

      toast.success(queuedOffline ? 'Sale voided offline.' : anyProductMissing ? 'Sale voided (some deleted products not restored).' : 'Sale voided and stock restored.');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setVoiding(false);
      setPendingVoid(null);
    }
  };

  const handleProductSave = async (data) => {
    try {
      const { id, queuedOffline } = await createProduct(data, businessId);
      toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product added');
      if (prefillBarcode !== null && !queuedOffline) {
        addToCart({ id, name: data.name, sellingPrice: data.sellingPrice, costPrice: data.costPrice, stock: data.stock ?? 0, barcode: data.barcode || null }, 1);
      }
      setProdModal(false);
      setPrefillBarcode(null);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
      throw err;
    }
  };

  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) {
      toast.error(friendlyErrorMessage(error));
      throw error;
    }
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
    if (found) {
      addToCart(found, 1);
      toast.success(`${found.name} added to cart`, { duration: 1200 });
    } else {
      setNotFoundCode(code);
    }
  };

  useHardwareScanner(handleScanDetected, {
    enabled: !!session && !isClosed && !prodModal && !supplierModal && !scannerOpen && !notFoundCode && !completedSale && !checkoutOpen,
  });

  if (sessLoading) return <LoadingSpinner label="Loading today's session…" />;
  if (isClosed) {
    return (
      <div className="mx-auto max-w-sm pt-8 space-y-4 text-center">
        <EmptyState title="Today's session is closed" description="Sales are locked. An owner can reopen to continue trading." />
        {isAdmin && <button className="btn-primary w-full" onClick={reopenSession}>Reopen session</button>}
      </div>
    );
  }
  if (!session) return <OpenSessionPrompt onOpen={(floats) => openSession({ ...floats, openedBy: profile.uid })} />;

  // Display-only helper for the desktop post-sale panel — mirrors the
  // same items[] check SaleCompleteModal already uses for the mobile
  // receipt, so a multi-product cart is itemized instead of collapsed
  // into "Product A +2 more". Reads only; nothing is written here.
  const desktopSaleItems =
    desktopLastSale && Array.isArray(desktopLastSale.items) && desktopLastSale.items.length > 1
      ? desktopLastSale.items
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Counter"
        description="Scan a barcode, search, or select a product to add it to the sale."
      />

      {/* Desktop gets a fixed-width checkout column so it never gets
          squeezed by the product grid; mobile is untouched (single
          column, cart pinned to the top). */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_336px] xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-6">

        {/* LEFT: product catalog + sales log */}
        <div className="min-w-0 space-y-4">

          {/* Mobile-only cart bar, pinned to the top of the screen */}
          <div className="sticky top-2 z-20 lg:hidden">
            <CartList
              cart={cart}
              onUpdateQuantity={updateCartQuantity}
              onUpdatePrice={updateCartPrice}
              onRemove={removeCartItem}
              onClear={clearCart}
              onCheckout={() => setCheckoutOpen(true)}
            />
          </div>

          <input
            className="input"
            placeholder="Search products by name, category, or barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {prodLoading ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <EmptyState title="No products match" description="Try another search keyword or scan a barcode." />
          ) : (
            <ProductGrid products={filtered} onSelect={(product) => addToCart(product, 1)} isAdmin={false} cartQuantities={cartQuantities} />
          )}

          {isAdmin && (
            <Section title="Sales log" hint="Last 100 sales and credit sales">
              {salesLoading || creditLoading ? (
                <LoadingSpinner />
              ) : (
                <DataTable
                  caption="Sales and credit sales recorded on this counter"
                  maxHeight="24rem"
                  rows={mergedSales}
                  rowKey={(s) => s.id}
                  columns={[
                    {
                      key: 'productName',
                      header: 'Sale',
                      primary: true,
                      render: (s) => (
                        <span className={s.isVoided ? 'text-ink-400 line-through' : 'text-ink-900'}>
                          <span className="num">{s.quantity}</span> × {s.productName}
                          {Array.isArray(s.items) && s.items.length > 1 && (
                            <StatusPill tone="neutral" className="ml-2 align-middle">
                              {s.items.length} products
                            </StatusPill>
                          )}
                        </span>
                      ),
                    },
                    {
                      key: 'paymentMethod',
                      header: 'Method',
                      render: (s) => (
                        <span className="text-ink-600">
                          {s.paymentType === 'Credit' ? `Credit · ${s.customerName}` : s.paymentMethod}
                          {s.mpesaCode ? ` (${s.mpesaCode})` : ''}
                        </span>
                      ),
                    },
                    { key: 'soldByName', header: 'Sold by', render: (s) => <span className="text-ink-600">{s.soldByName || 'Staff'}</span> },
                    { key: 'soldAt', header: 'Time', render: (s) => <span className="text-ink-600">{formatDateTime(s.soldAt)}</span> },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (s) =>
                        s.isVoided
                          ? <StatusPill tone="negative">Voided</StatusPill>
                          : s.isCredit
                            ? <StatusPill tone="caution">On credit</StatusPill>
                            : <StatusPill tone="positive">Paid</StatusPill>,
                    },
                    {
                      key: 'totalAmount',
                      header: 'Amount',
                      numeric: true,
                      render: (s) => (
                        <span className={`font-semibold ${s.isVoided ? 'text-ink-400 line-through' : ''}`}>
                          <Money value={s.totalAmount} />
                        </span>
                      ),
                    },
                  ]}
                  rowActions={(s) => (
                    <>
                      {!s.isVoided && !s.isCredit && isAdmin && (
                        <button
                          type="button"
                          onClick={() => setPendingVoid(s)}
                          className="btn-ghost !px-2 text-ink-500 hover:text-danger-700"
                          title="Void sale"
                          aria-label={`Void sale of ${s.productName}`}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      )}
                      {s.isCredit && isAdmin && (
                        <Link to={`/customers/${s.customerId}`} className="btn-ghost !px-2 text-ink-600">
                          View customer
                        </Link>
                      )}
                    </>
                  )}
                  empty={<EmptyState title="No sales recorded yet" description="Sales made at this counter will be listed here." />}
                />
              )}
            </Section>
          )}
        </div>

        {/* RIGHT: desktop-only checkout terminal — hidden below the lg
            breakpoint, so mobile always renders the single-column view
            above with the cart bar and the mobile checkout modal
            further down this file. */}
        <div className="hidden lg:sticky lg:top-4 lg:flex lg:flex-col lg:gap-4">

          <div className="overflow-hidden rounded-panel border border-line bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="text-label uppercase text-ink-500">Current order</p>
                <p className="mt-0.5 text-body font-semibold text-ink-900">
                  {cart.length === 0 ? 'No items yet' : `${cart.length} item${cart.length !== 1 ? 's' : ''} in cart`}
                </p>
              </div>
              {cart.length > 0 && (
                <button type="button" onClick={clearCart} className="btn-ghost !px-2 text-ink-600 hover:text-danger-700">
                  Clear all
                </button>
              )}
            </div>

            {/* The cart is a ledger: one line per product, quantity and
                unit price editable in place, line total right-aligned on
                tabular figures. */}
            <div className="max-h-64 divide-y divide-divider overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
                  <ShoppingCart className="h-5 w-5 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
                  <p className="text-secondary text-ink-500">Select a product to add it to this sale.</p>
                </div>
              ) : (
                cart.map((item) => {
                  const lineTotal = roundMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
                  return (
                    <div key={item.productId} className="space-y-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-body font-medium text-ink-900">
                          {item.productName}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.productId)}
                          className="-m-1 shrink-0 rounded-control p-1 text-ink-400 hover:text-danger-700"
                          aria-label={`Remove ${item.productName}`}
                        >
                          <X className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center rounded-control border border-line">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-l-control text-ink-600 hover:bg-ink-50"
                            aria-label={`Decrease quantity of ${item.productName}`}
                          >
                            <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                          <span className="num w-7 text-center text-cell font-semibold text-ink-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-r-control text-ink-600 hover:bg-ink-50"
                            aria-label={`Increase quantity of ${item.productName}`}
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-label uppercase text-ink-400">KES</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateCartPrice(item.productId, e.target.value)}
                            className="num w-20 rounded-control border border-line px-2 py-1 text-right text-cell font-medium text-ink-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600"
                            aria-label={`Unit price for ${item.productName}`}
                          />
                        </div>

                        <span className="num shrink-0 text-cell font-semibold text-ink-900">
                          {formatKES(lineTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-3 border-t border-line px-4 py-3">
              <div>
                <p className="label">Payment method</p>
                <PaymentMethodSelect value={desktopMethod} onChange={setDesktopMethod} idPrefix="counter" />
              </div>

              {desktopMethod === 'M-Pesa' && (
                <div>
                  <label className="label" htmlFor="counter-mpesa-code">
                    M-Pesa transaction code <span className="text-danger-600" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="counter-mpesa-code"
                    type="text"
                    value={desktopMpesaCode}
                    onChange={(e) => setDesktopMpesaCode(e.target.value.toUpperCase())}
                    placeholder="e.g. QWE1234567"
                    className="input num uppercase"
                  />
                </div>
              )}

              {desktopMethod === 'Credit' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="label mb-0" htmlFor="counter-customer">Customer (deni)</label>
                    <button
                      type="button"
                      onClick={() => setDesktopNewMode((v) => !v)}
                      className="text-secondary font-medium text-primary-700 hover:underline"
                    >
                      {desktopNewMode ? 'Use existing' : 'New customer'}
                    </button>
                  </div>
                  {!desktopNewMode ? (
                    <select
                      id="counter-customer"
                      className="input"
                      value={desktopCustomerId}
                      onChange={(e) => setDesktopCustomerId(e.target.value)}
                    >
                      <option value="">Select a customer</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.phone ? ` · ${c.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input
                        className="input"
                        placeholder="Customer name"
                        value={desktopNewName}
                        onChange={(e) => setDesktopNewName(e.target.value)}
                        aria-label="New customer name"
                      />
                      <input
                        className="input"
                        placeholder="Phone (07xx…)"
                        value={desktopNewPhone}
                        onChange={(e) => setDesktopNewPhone(e.target.value)}
                        aria-label="New customer phone"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-end justify-between gap-3 border-t border-divider pt-3">
                <div>
                  <p className="text-label uppercase text-ink-500">Total</p>
                  {cartEstimatedProfit > 0 && (
                    <p className="text-secondary text-success-700">
                      Margin <Money value={cartEstimatedProfit} />
                    </p>
                  )}
                </div>
                <p className="text-money text-ink-900"><Money value={cartTotal} /></p>
              </div>

              <button
                type="button"
                disabled={cart.length === 0 || desktopSubmitting}
                onClick={handleDesktopCheckout}
                className="btn-primary w-full"
              >
                {desktopSubmitting ? 'Recording…' : desktopMethod === 'Credit' ? 'Record credit sale' : 'Complete sale'}
              </button>
            </div>
          </div>

          {/* Post-sale receipt actions — only shown right after a sale
              completes on this screen, same pattern as the mobile
              SaleCompleteModal, just inline instead of a popup. */}
          {desktopLastSale && (
            <div className="card space-y-3 p-4">
              <div className="flex items-center justify-between border-b border-ink-100 pb-2.5">
                <div className="flex items-center gap-1.5 text-moss-700">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                  <span className="text-xs font-semibold">Sale completed</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDesktopLastSale(null)}
                  className="rounded p-1 text-ink-400 hover:text-ink-700"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>

              <div className="space-y-1">
                {desktopSaleItems ? (
                  desktopSaleItems.map((item, idx) => (
                    <div key={item.productId || idx} className="flex items-center justify-between text-xs text-ink-600">
                      <span>{item.quantity} × {item.productName}</span>
                      <span className="font-semibold text-ink-800">
                        {formatKES(item.lineTotal ?? (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-ink-600">{desktopLastSale.productName}</p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-ink-100 pt-2.5 text-sm">
                <span className="font-semibold text-ink-700">
                  {desktopLastSale.isCredit ? 'Amount due' : 'Total paid'}
                </span>
                <span className="font-display font-bold text-ink-900">{formatKES(desktopLastSale.totalAmount)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (desktopLastSale.isCredit) printInvoice(desktopLastSale, settings);
                    else printReceipt(desktopLastSale, settings);
                  }}
                  className="btn-outline !min-h-0 flex items-center justify-center gap-1.5 !py-1.5 text-xs"
                >
                  <Printer className="h-3.5 w-3.5" strokeWidth={1.75} /> Print
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (desktopLastSale.isCredit) generateInvoicePDF(desktopLastSale, settings);
                    else generateReceiptPDF(desktopLastSale, settings);
                  }}
                  className="btn-outline !min-h-0 flex items-center justify-center gap-1.5 !py-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> Download
                </button>
              </div>

              <div className="space-y-1.5 rounded-lg bg-ink-50 p-2.5">
                <label className="text-[11px] font-semibold text-ink-600">
                  WhatsApp {desktopLastSale.isCredit ? 'invoice' : 'receipt'} {!isPro && <span className="text-amber-600">— Pro</span>}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Customer phone (07xx...)"
                    value={desktopCustomerPhone}
                    onChange={(e) => setDesktopCustomerPhone(e.target.value)}
                    className="input !min-h-0 flex-1 !py-1.5 text-xs"
                  />
                  {isPro ? (
                    <button
                      type="button"
                      onClick={handleDesktopWhatsApp}
                      disabled={desktopSendingWhatsApp}
                      className="btn-primary !min-h-0 flex shrink-0 items-center gap-1 !py-1.5 !px-3 text-xs"
                    >
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {desktopSendingWhatsApp ? 'Sending…' : 'Send'}
                    </button>
                  ) : (
                    <Link to="/pro" className="btn-primary !min-h-0 flex shrink-0 items-center gap-1 !py-1.5 !px-3 text-xs">
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} /> Unlock
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Floating & scanner elements */}
      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!notFoundCode} onClose={() => setNotFoundCode(null)} title="Product not found" widthClass="max-w-xs">
        <p className="mb-4 text-sm text-ink-500">
          No product matches barcode <span className="font-mono">{notFoundCode}</span>.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setNotFoundCode(null)}>Cancel</button>
          {isAdmin ? (
            <button
              className="btn-primary"
              onClick={() => {
                setPrefillBarcode(notFoundCode);
                setNotFoundCode(null);
                setProdModal(true);
              }}
            >
              Create product
            </button>
          ) : (
            <span className="self-center text-xs text-ink-400">Ask an owner to add this product.</span>
          )}
        </div>
      </Modal>

      {/* Mobile checkout modal */}
      <CartCheckoutModal
        open={checkoutOpen}
        cart={cart}
        total={cartTotal}
        customers={customers}
        onClose={handleCheckoutClose}
        onConfirmSale={handleCartSale}
        onConfirmCredit={handleCartCredit}
        onCreateCustomer={handleCreateCustomer}
      />

      {/* Mobile sale-complete modal */}
      <SaleCompleteModal open={!!completedSale} sale={completedSale} onClose={() => setCompletedSale(null)} />

      <ProductFormModal
        open={prodModal}
        onClose={() => {
          setProdModal(false);
          setPrefillBarcode(null);
        }}
        onSave={handleProductSave}
        suppliers={suppliers}
        initialProduct={null}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
      />

      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />

      <ConfirmDialog
        open={!!pendingVoid}
        title="Void this sale?"
        message={`Stock for "${pendingVoid?.productName}" will be restored${
          Array.isArray(pendingVoid?.items) && pendingVoid.items.length > 1
            ? ` for all ${pendingVoid.items.length} products in this sale`
            : ` (×${pendingVoid?.quantity})`
        }.`}
        confirmLabel={voiding ? 'Voiding...' : 'Void sale'}
        confirmDisabled={voiding}
        danger
        onConfirm={handleVoid}
        onCancel={() => setPendingVoid(null)}
      />
    </div>
  );
}