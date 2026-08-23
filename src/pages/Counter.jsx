import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { doc, addDoc, writeBatch, increment, serverTimestamp, orderBy, where, limit, getDoc, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDailySession } from '../hooks/useDailySession';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { createProduct } from '../utils/products';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import ProductGrid from '../components/pos/ProductGrid';
import CartList from '../components/pos/CartList';
import CartCheckoutModal from '../components/pos/CartCheckoutModal';
import SaleCompleteModal from '../components/pos/SaleCompleteModal';
import OpenSessionPrompt from '../components/pos/OpenSessionPrompt';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import { formatKES, roundMoney } from '../utils/currency';
import { formatDateTime } from '../utils/dateRanges';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

// Builds one line item for the cart doc from a cart row. Rounds every
// money figure through roundMoney() so summing several lines (and their
// quantity × price multiplication) never leaves floating-point noise in
// what gets shown or written to Firestore.
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
  const { profile, isAdmin, businessId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const productsQ  = useMemo(() => businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null, [businessId]);  
  const customersQ = useMemo(() => businessId ? tenantQuery('customers', businessId, orderBy('name')) : null, [businessId]);
  const salesQ     = useMemo(() => businessId ? tenantQuery('sales', businessId, orderBy('soldAt','desc'), limit(100)) : null, [businessId]);
  const creditSalesQ = useMemo(() => businessId ? tenantQuery('creditSales', businessId, orderBy('soldAt','desc'), limit(100)) : null, [businessId]);
  const suppliersQ = useMemo(() => businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null, [businessId]);

  const { data: products,  loading: prodLoading }  = useFirestoreCollection(productsQ);
  const { data: customers }                         = useFirestoreCollection(customersQ);
  const { data: sales,     loading: salesLoading }  = useFirestoreCollection(salesQ);
  const { data: creditSales, loading: creditLoading } = useFirestoreCollection(creditSalesQ);
const { data: suppliers, refetch: refetchSuppliers } = useFirestoreCollection(suppliersQ);  const { session, loading: sessLoading, isClosed, openSession, reopenSession } = useDailySession();

  const [search, setSearch]           = useState('');

  // Cart: client-side only ("current sale") state — nothing is written to
  // Firestore until checkout is confirmed in CartCheckoutModal. One row
  // per distinct product; scanning/adding the same product again bumps
  // its quantity instead of creating a duplicate row.
  const [cart, setCart]               = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [completedSale, setCompletedSale] = useState(null);
  const [pendingVoid, setPendingVoid] = useState(null);
  const [prodModal, setProdModal]     = useState(false);
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

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search.trim())) ||
    (p.internalCode && p.internalCode.toLowerCase().includes(search.toLowerCase()))
  );

  // Live productId -> quantity map, used to badge cards already in the
  // cart (see ProductGrid) so tapping/scanning a product gives lasting
  // visual confirmation, not just a toast that disappears.
  const cartQuantities = useMemo(
    () => Object.fromEntries(cart.map((item) => [item.productId, item.quantity])),
    [cart]
  );

  const mergedSales = useMemo(() => {
    const list = [];
    sales.forEach(s => { list.push({ ...s, isCredit: false, paymentType: s.paymentMethod || 'Cash' }); });
    creditSales.forEach(cs => { list.push({ ...cs, isCredit: true, paymentType: 'Credit' }); });
    return list.sort((a, b) => {
      const aTime = a.soldAt?.toMillis?.() ?? a.soldAt?.toDate?.()?.getTime?.() ?? new Date(a.soldAt || 0).getTime();
      const bTime = b.soldAt?.toMillis?.() ?? b.soldAt?.toDate?.()?.getTime?.() ?? new Date(b.soldAt || 0).getTime();
      return bTime - aTime;
    }).slice(0, 100);
  }, [sales, creditSales]);

  // ── Cart operations ──────────────────────────────────────────────────

  const addToCart = (product, qty = 1) => {
    if (!product) return;
    if ((product.stock || 0) <= 0) { toast.error(`${product.name} is out of stock.`); return; }
    setCart(prev => {
      const idx = prev.findIndex(item => item.productId === product.id);
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
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice: product.sellingPrice,
        costPrice: product.costPrice,
        barcode: product.barcode || null,
      }];
    });
  };

  const updateCartQuantity = (productId, rawQty) => {
    const product = products.find(p => p.id === productId);
    let qty = parseInt(rawQty, 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (product && qty > product.stock) {
      toast.error(`Only ${product.stock} of ${product.name} in stock.`);
      qty = product.stock;
    }
    if (qty < 1) return; // nothing in stock — leave the row as-is rather than a 0/invalid quantity
    setCart(prev => prev.map(item => item.productId === productId ? { ...item, quantity: qty } : item));
  };

  const updateCartPrice = (productId, rawPrice) => {
    let price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) price = 0;
    setCart(prev => prev.map(item => item.productId === productId ? { ...item, unitPrice: price } : item));
  };

  const removeCartItem = (productId) => setCart(prev => prev.filter(item => item.productId !== productId));
  const clearCart = () => setCart([]);

  const cartTotal = useMemo(
    () => roundMoney(cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)),
    [cart]
  );

  // Re-validates the cart against the LIVE product list right before
  // building the write — stock may have moved since items were added
  // (another cashier selling the same product, a stock take, etc).
  function validateCartAgainstStock() {
    for (const row of cart) {
      const product = products.find(p => p.id === row.productId);
      if (!product) throw new Error(`${row.productName} is no longer available.`);
      if ((Number(row.quantity) || 0) > product.stock) {
        throw new Error(`Only ${product.stock} of ${row.productName} left in stock.`);
      }
    }
  }

  // FIX: same writeBatch + increment() pattern the app already uses
  // everywhere else for offline-first sales (see CR-8 in the README) —
  // one sale doc now carries every product in the cart as `items`, with
  // one stock decrement per line item in the same batch. Aggregate
  // fields (totalAmount, quantity, productName, costOfGoodsSold, profit)
  // are still written at the top level so every existing consumer that
  // only reads those fields — Dashboard's activity feed, this page's own
  // sales log, useFinancials — keeps working unchanged.
  const handleCartSale = ({ paymentMethod, mpesaCode }) => {
    validateCartAgainstStock();
    const lineItems = cart.map(toLineItem);
    const totalAmount = roundMoney(lineItems.reduce((s, i) => s + i.lineTotal, 0));
    const costOfGoodsSold = roundMoney(lineItems.reduce((s, i) => s + i.lineCost, 0));
    const profit = roundMoney(totalAmount - costOfGoodsSold);
    const quantity = lineItems.reduce((s, i) => s + i.quantity, 0);

    const saleRef = doc(collection(db, 'sales'));
    const saleData = withBusiness({
      items: lineItems,
      productName: summarizeProductName(lineItems),
      quantity,
      totalAmount,
      costOfGoodsSold,
      profit,
      // Legacy single-product compatibility: only meaningful when the
      // cart has exactly one distinct product, mirroring exactly what
      // the previous single-item sale flow wrote.
      ...(lineItems.length === 1 ? { costPricePerUnit: lineItems[0].costPrice, soldPricePerUnit: lineItems[0].unitPrice } : {}),
      paymentMethod, mpesaCode: mpesaCode || null,
      soldBy: profile.uid, soldByName: profile.displayName,
      soldAt: new Date(), isCredit: false, isVoided: false,
    }, businessId);

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
    const creditData = withBusiness({
      customerId, customerName, customerPhone: customerPhone || '',
      items: lineItems,
      productName: summarizeProductName(lineItems),
      quantity,
      totalAmount,
      costOfGoodsSold,
      ...(lineItems.length === 1 ? { costPricePerUnit: lineItems[0].costPrice, soldPricePerUnit: lineItems[0].unitPrice } : {}),
      soldBy: profile.uid, soldByName: profile.displayName, soldAt: serverTimestamp(),
      status: 'pending', amountPaid: 0, remainingBalance: totalAmount, paymentHistory: [],
      isCredit: true,
    }, businessId);

    const batch = writeBatch(db);
    lineItems.forEach((item) => {
      batch.update(doc(db, 'products', item.productId), { stock: increment(-item.quantity), updatedAt: serverTimestamp() });
    });
    batch.set(creditRef, creditData);

    return { record: { id: creditRef.id, ...creditData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleCreateCustomer = async ({ name, phone }) => {
    const ref = await addDoc(tenantCollection('customers'), withBusiness({ name, phone, email:'', address:'', notes:'', createdAt:serverTimestamp() }, businessId));
    return { id:ref.id, name, phone };
  };

  const handleCheckoutClose = (record) => {
    setCheckoutOpen(false);
    if (record && record.id) {
      setCompletedSale(record);
      clearCart();
    }
    // record === null → cashier backed out of checkout; cart is left intact.
  };

  // Voiding restores stock for every line item on the sale (falls back to
  // the single productId/quantity shape for pre-cart, legacy sale docs).
  const handleVoid = async () => {
    const sale = pendingVoid;
    setVoiding(true);
    try {
      const lineItems = Array.isArray(sale.items) && sale.items.length > 0
        ? sale.items
        : [{ productId: sale.productId, quantity: sale.quantity }];

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

      toast.success(queuedOffline ? 'Sale voided offline.' : (anyProductMissing ? 'Sale voided (some products were deleted, stock not restored for those).' : 'Sale voided and stock restored.'));
    } catch (err) { toast.error(friendlyErrorMessage(err)); }
    finally { setVoiding(false); setPendingVoid(null); }
  };

  const handleProductSave = async (data) => {
    try {
      const { id, queuedOffline } = await createProduct(data, businessId);
      toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Product added');
      // If this product was created to resolve a scanned/typed barcode
      // that didn't match anything, add it straight to the cart so the
      // scanning flow isn't interrupted any more than necessary.
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
  if (error) { toast.error(friendlyErrorMessage(error)); throw error; }
  if (!queuedOffline) {
    setNewSupplierId(ref.id);
    await refetchSuppliers();
  }
  setSupplierModal(false);
  toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Supplier added');
};

  // Scanning adds straight to the cart and keeps going — no confirmation
  // step per scan, and scanning the same product again just bumps its
  // quantity (handled inside addToCart).
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
  if (isClosed) return (
    <div className="mx-auto max-w-sm pt-8 space-y-4 text-center">
      <EmptyState title="Today's session is closed" description="Sales are locked. An owner can reopen to continue trading." />
      {isAdmin && <button className="btn-primary w-full" onClick={reopenSession}>Reopen session</button>}
    </div>
  );
  if (!session) return <OpenSessionPrompt onOpen={floats => openSession({ ...floats, openedBy:profile.uid })} />;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="font-display text-xl font-bold text-ink-900">Counter</h1><p className="text-sm text-ink-400">Scan, search, or tap a product to add it to the cart.</p></div>
      </div>

      {/* FIX (cart visibility): pinned to the top and sticky as the page
          scrolls, so after adding something the cart is never "far down"
          below a long product list. Renders nothing when the cart is
          empty — no placeholder clutter until there's something to show. */}
      <div className="sticky top-2 z-20">
        <CartList
          cart={cart}
          onUpdateQuantity={updateCartQuantity}
          onUpdatePrice={updateCartPrice}
          onRemove={removeCartItem}
          onClear={clearCart}
          onCheckout={() => setCheckoutOpen(true)}
        />
      </div>

      <input className="input" placeholder="Search products or codes…" value={search} onChange={e=>setSearch(e.target.value)} />
      {prodLoading ? <LoadingSpinner /> : filtered.length===0 ? <EmptyState title="No products match" /> :
        <ProductGrid products={filtered} onSelect={(product) => addToCart(product, 1)} isAdmin={false} cartQuantities={cartQuantities} />}


      {isAdmin && (
        <div className="mt-4">
          <h2 className="font-display text-sm font-bold text-ink-800 mb-2">Sales log (last 100)</h2>
          {salesLoading || creditLoading ? <LoadingSpinner /> : mergedSales.length === 0 ? <EmptyState title="No sales recorded" /> : (
            <div className="card divide-y divide-ink-100">
              {mergedSales.map(s=>(
                <div key={s.id} className={`flex items-center justify-between px-4 py-3 text-sm ${s.isVoided?'opacity-40 line-through':''}`}>
                  <div>
                    <p className="font-medium text-ink-700">
                      {s.quantity} × {s.productName} — {formatKES(s.totalAmount)}
                      {Array.isArray(s.items) && s.items.length > 1 && (
                        <span className="badge bg-ink-100 text-ink-500 ml-2 align-middle">{s.items.length} products</span>
                      )}
                    </p>
                    <p className="text-xs text-ink-400">
                      {s.paymentType === 'Credit' ? `Credit (${s.customerName})` : s.paymentMethod}
                      {s.mpesaCode ? ` (${s.mpesaCode})` : ''} · {formatDateTime(s.soldAt)} · {s.soldByName || 'Staff'}
                    </p>
                  </div>
                  {!s.isVoided && !s.isCredit && isAdmin && (
                    <button onClick={()=>setPendingVoid(s)} className="p-1 text-rust-400 hover:text-rust-600 min-h-[44px] min-w-[44px] flex items-center justify-center" title="Void sale"><Trash2 className="h-4 w-4" strokeWidth={1.75}/></button>
                  )}
                  {s.isCredit && isAdmin && (
                    <Link to={`/customers/${s.customerId}`} className="btn-outline !py-1 !px-2.5 !min-h-0 text-xs text-ink-500 hover:text-ink-700">View Customer</Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={()=>setScannerOpen(false)} onDetected={handleScanDetected} />

      <Modal open={!!notFoundCode} onClose={()=>setNotFoundCode(null)} title="Product not found" widthClass="max-w-xs">
        <p className="text-sm text-ink-500 mb-4">No product matches barcode <span className="font-mono">{notFoundCode}</span>.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={()=>setNotFoundCode(null)}>Cancel</button>
          {isAdmin ? (
            <button className="btn-primary" onClick={()=>{ setPrefillBarcode(notFoundCode); setNotFoundCode(null); setProdModal(true); }}>Create Product</button>
          ) : (
            <span className="self-center text-xs text-ink-400">Ask an owner to add this product.</span>
          )}
        </div>
      </Modal>

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
      <SaleCompleteModal
        open={!!completedSale}
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
      />

      <ProductFormModal
        open={prodModal}
        onClose={()=>{setProdModal(false);setPrefillBarcode(null);}}
        onSave={handleProductSave}
        suppliers={suppliers}
        initialProduct={null}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
      />
      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
      <ConfirmDialog open={!!pendingVoid} title="Void this sale?" message={`Stock for "${pendingVoid?.productName}" will be restored${Array.isArray(pendingVoid?.items) && pendingVoid.items.length > 1 ? ` for all ${pendingVoid.items.length} products in this sale` : ` (×${pendingVoid?.quantity})`}.`} confirmLabel={voiding ? "Voiding..." : "Void sale"} confirmDisabled={voiding} danger onConfirm={handleVoid} onCancel={()=>setPendingVoid(null)} />
    </div>
  );
}
