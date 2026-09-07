// src/pages/Counter.jsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { doc, addDoc, updateDoc, writeBatch, serverTimestamp, orderBy, where, limit, getDoc, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import {
  Trash2, Undo2, ShoppingCart, Printer, Download,
  MessageCircle, X, Plus, Minus
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useIndustry } from '../hooks/useIndustry';
import { usePermissions } from '../hooks/usePermissions';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDailySession } from '../hooks/useDailySession';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode, isContinuousScanEnabled } from '../utils/scannerService';
import { searchCatalogue, activeCategories } from '../utils/catalogueSearch';
import {
  buildLineItem, sumLineTotals, sumLineCosts, summaryQuantity,
  normalizeQuantity, minimumQuantity, productUnit, validateAgainstStock,
  saleQuantityLabel,
} from '../utils/lineItems';
import { formatQuantityWithUnit, roundQuantity, unitStep, getUnit } from '../industry/units';
import { hasVariants, findVariant, findVariantByBarcode } from '../utils/variants';
import { resolveStockDeltas, validateComponentStock } from '../utils/inventory';
import { applyStockDeltas } from '../utils/stockWrites';
import { buildRefundDocument, isFullyReturned, returnState } from '../utils/returns';
import {
  allocateFefo, allocatedUnitCost, sellableBatchStockFor, todayISO,
  expiryStatus, daysBetween, EXPIRY_STATUS,
} from '../utils/batches';
import { hasModifiers, describeModifiers } from '../utils/modifiers';
import {
  buildOrderDocument, orderToCart, orderToSaleFields, orderRowKey,
  DEFAULT_DINING_MODE, ORDER_STATUS,
} from '../utils/orders';
import { createProduct } from '../utils/products';
import { printReceipt, generateReceiptPDF, printInvoice, generateInvoicePDF, sendWhatsAppDocument } from '../utils/documentService';
import { getOrCreateShareLink } from '../utils/documentSharing';
import { useCloudDocuments } from '../hooks/useCloudDocuments';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import ProductGrid from '../components/pos/ProductGrid';
import CartList from '../components/pos/CartList';
import PaymentMethodSelect from '../components/pos/PaymentMethodSelect';
import CartCheckoutModal from '../components/pos/CartCheckoutModal';
import ReturnSaleModal from '../components/pos/ReturnSaleModal';
import SaleCompleteModal from '../components/pos/SaleCompleteModal';
import OpenSessionPrompt from '../components/pos/OpenSessionPrompt';
import VariantPickerModal from '../components/pos/VariantPickerModal';
import ModifierPickerModal from '../components/pos/ModifierPickerModal';
import OrderBar from '../components/pos/OrderBar';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScannerDock from '../components/scanner/ScannerDock';
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

// The line-item arithmetic now lives in utils/lineItems.js, where it is
// tested against the decimal and measured-unit cases a hardware shop
// actually sells in. The stored shape is unchanged: a piece line item is
// byte-for-byte what it always was, with no `unit` field added.
const toLineItem = buildLineItem;

// A cart row's identity. Product id for a plain product; product id plus
// version id for a product with versions, so two sizes of the same shirt
// are two independently editable lines.
function cartRowKey(item) {
  return item?.rowKey || item?.productId;
}

function summarizeProductName(lineItems) {
  if (lineItems.length === 1) return lineItems[0].productName;
  return `${lineItems[0].productName} +${lineItems.length - 1} more`;
}

// Below lg the phone camera IS the scanner, so it gets the continuous
// dock unless this device has opted out. From lg up a USB scanner is
// already continuous through useHardwareScanner, so the one-shot modal
// stays the right camera flow there.
function shouldUseScannerDock() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1023px)').matches && isContinuousScanEnabled();
}

export default function Counter() {
  const { profile, isAdmin, isPro, businessId } = useAuth();
  const { canPublish: canShareLink, blockedMessage: shareBlockedMessage } = useCloudDocuments();
  // What this person may do at the counter, from the one catalogue in
  // src/industry/permissions.js. `isAdmin` still answers the questions
  // that are the owner's alone; everything an owner can DELEGATE is asked
  // here, so a cashier the owner trusts with returns gets the button and
  // one they do not never sees it. The writes behind each are refused by
  // firestore.rules independently.
  const permissions = usePermissions();
  const { settings } = useSettings();
  const industry = useIndustry();
  const location = useLocation();
  const navigate = useNavigate();

  const productsQ = useMemo(() => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null), [businessId]);
  const customersQ = useMemo(() => (businessId ? tenantQuery('customers', businessId, orderBy('name')) : null), [businessId]);
  const salesQ = useMemo(() => (businessId ? tenantQuery('sales', businessId, orderBy('soldAt', 'desc'), limit(100)) : null), [businessId]);
  const creditSalesQ = useMemo(() => (businessId ? tenantQuery('creditSales', businessId, orderBy('soldAt', 'desc'), limit(100)) : null), [businessId]);
  const suppliersQ = useMemo(() => (businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null), [businessId]);
  // Batches, for FEFO at the till. Like the orders listener below, this
  // is opened ONLY when the capability is on — a shop that does not track
  // batches never subscribes to the collection and never pays for it.
  const batchesQ = useMemo(
    () => (businessId && industry.can('batches')
      ? tenantQuery('productBatches', businessId, orderBy('expiryDate', 'asc'))
      : null),
    [businessId, industry]
  );

  // Open tickets. Queried ONLY when the capability is on, so a retail shop
  // opens no listener and pays for no reads it will never use.
  const ordersQ = useMemo(
    () => (businessId && industry.can('orders')
      ? tenantQuery('orders', businessId, where('status', '==', ORDER_STATUS.OPEN), orderBy('openedAt', 'desc'), limit(100))
      : null),
    [businessId, industry]
  );

  const { data: products, loading: prodLoading } = useFirestoreCollection(productsQ);
  const { data: customers } = useFirestoreCollection(customersQ);
  const { data: sales, loading: salesLoading } = useFirestoreCollection(salesQ);
  const { data: creditSales, loading: creditLoading } = useFirestoreCollection(creditSalesQ);
  const { data: suppliers, refetch: refetchSuppliers } = useFirestoreCollection(suppliersQ);
  const { data: openOrders } = useFirestoreCollection(ordersQ);
  const { data: batches } = useFirestoreCollection(batchesQ);
  const { session, loading: sessLoading, isClosed, openSession, reopenSession } = useDailySession();

  const [search, setSearch] = useState('');
  // Category narrowing, offered per trade — see the threshold on the
  // industry configuration. A duka never sees this row; a menu always does.
  const [category, setCategory] = useState(null);

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
  const [returnTarget, setReturnTarget] = useState(null);
  // The checkout waiting on an age confirmation. One step, one dialog —
  // see withAgeCheck below.
  const [pendingAgeCheck, setPendingAgeCheck] = useState(null);
  const [prodModal, setProdModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  // The bottom-docked continuous scanner, phone only. `dockOpen` and
  // `scannerOpen` are mutually exclusive: which one the Scan button opens
  // depends on screen width and the per-device preference.
  const [dockOpen, setDockOpen] = useState(false);
  const [lastScanLabel, setLastScanLabel] = useState(null);
  const [notFoundCode, setNotFoundCode] = useState(null);
  const [voiding, setVoiding] = useState(false);
  // The product whose versions are being chosen from. Only ever set for a
  // product that actually has versions, so a shop without them never sees
  // this modal exist.
  const [variantPick, setVariantPick] = useState(null);
  // The item whose choices are being made. `{ product, variant }`.
  const [modifierPick, setModifierPick] = useState(null);
  // The open ticket this cart belongs to, if any. Null means a walk-up
  // sale, which is exactly what the counter has always done.
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [orderTable, setOrderTable] = useState(null);
  const [orderDiningMode, setOrderDiningMode] = useState(DEFAULT_DINING_MODE);
  const [orderNote, setOrderNote] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    if (location.state?.autoScan && session && !isClosed) {
      if (shouldUseScannerDock()) setDockOpen(true);
      else setScannerOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, session, isClosed]);

  // One ranked pass over the catalogue, memoised on the inputs, capped at
  // a page of tiles. At duka size this is identical to what the counter
  // always did; at supermarket size it is the difference between keeping
  // up with a queue and not. See utils/catalogueSearch.js.
  const { results: filtered, total: matchCount, truncated } = useMemo(
    () => searchCatalogue(products, { query: search, category }),
    [products, search, category]
  );

  const categories = useMemo(
    () => activeCategories(products, industry.categories),
    [products, industry.categories]
  );
  // Progressive disclosure, per trade. For a shop the filter row is a
  // supermarket tool and stays hidden until the catalogue is big enough
  // to need it — General Retail's threshold is the 40 it has always been.
  // For a menu it is how the till is read, so the food profiles show it
  // from the first item. The rule lives on the profile, not here.
  const showCategoryFilter =
    products.length >= industry.categoryFilterThreshold && categories.length > 1;

  // The badge on a product tile. Aggregated per PRODUCT, so a shirt with
  // two sizes in the cart shows the combined count on its one tile.
  const cartQuantities = useMemo(() => {
    const totals = {};
    for (const item of cart) {
      totals[item.productId] = roundQuantity((totals[item.productId] || 0) + (Number(item.quantity) || 0), item.unit);
    }
    return totals;
  }, [cart]);

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
  // Tapping a tile adds one whole unit of whatever the product is sold in
  // — one piece, one metre, one kilogram. The exact 2.5 m is then typed
  // into the cart row, which is how a hardware counter actually works:
  // you cut the cable and then enter what you cut.
  // A product with versions cannot be added directly — tapping it opens
  // the picker, and the picker calls back in with a variant. Everything
  // downstream of this point treats a variant line exactly like any other
  // line, which is what keeps the checkout, the receipt and the reports
  // from needing to know about variants at all.
  const modifiersOn = industry.can('modifiers');

  // Tapping a tile resolves in at most two questions, in this order:
  // which version, then which choices. Both are skipped when the product
  // does not have them, so a shop with neither taps once, exactly as
  // FlowBiz has always worked.
  const selectProduct = (product, variant = null) => {
    if (!variant && hasVariants(product)) {
      setVariantPick(product);
      return;
    }
    if (modifiersOn && hasModifiers(product)) {
      setModifierPick({ product, variant });
      return;
    }
    addToCart(product, 1, variant);
  };

  const addToCart = (product, qty = null, variant = null, extras = null) => {
    if (!product) return;
    const unit = productUnit(product);
    // Neither a service nor a dish assembled to order has stock of its
    // own — its ingredients do, and those are checked at checkout.
    const untracked = product.kind === 'service' || (Array.isArray(product.recipe) && product.recipe.length > 0 && product.producedInAdvance !== true);
    const stock = untracked
      ? Infinity
      : roundQuantity(Number(variant ? variant.stock : product.stock) || 0, unit);
    const step = qty === null ? 1 : qty;
    const modifiers = extras?.modifiers || [];
    const label = [
      variant ? `${product.name} (${variant.label})` : product.name,
      modifiers.length > 0 ? `(${describeModifiers(modifiers)})` : '',
    ].filter(Boolean).join(' ');
    // One cart line per product, version AND set of choices: a burger with
    // bacon and a burger without are two lines, because they are two
    // different things at two different prices.
    const rowKey = orderRowKey({ productId: product.id, variantId: variant?.id, modifiers });

    if (stock <= 0) {
      toast.error(`${label} is out of stock.`);
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((item) => (item.rowKey || item.productId) === rowKey);
      const currentQty = idx >= 0 ? Number(prev[idx].quantity) || 0 : 0;
      const nextQty = roundQuantity(currentQty + step, unit);
      if (nextQty > stock) {
        toast.error(`Only ${formatQuantityWithUnit(stock, unit, { showPiece: true })} of ${label} in stock.`);
        return prev;
      }
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: nextQty };
        return next;
      }
      const basePrice = variant ? variant.sellingPrice : product.sellingPrice;
      return [
        ...prev,
        {
          rowKey,
          productId: product.id,
          productName: label,
          quantity: nextQty,
          unitPrice: extras?.unitPrice ?? basePrice,
          basePrice,
          costPrice: variant ? variant.costPrice : product.costPrice,
          barcode: (variant ? variant.barcode : product.barcode) || null,
          unit,
          ...(variant ? { variantId: variant.id, variantLabel: variant.label } : {}),
          ...(modifiers.length > 0 ? { modifiers } : {}),
          ...(extras?.note ? { note: extras.note } : {}),
        },
      ];
    });
  };

  // Cart rows are addressed by `rowKey`, which is the product id for a
  // plain product and `productId::variantId` for a version. A product with
  // no versions therefore keeps exactly its old identity.
  const updateCartQuantity = (rowKey, rawQty) => {
    const row = cart.find((item) => cartRowKey(item) === rowKey);
    const product = products.find((p) => p.id === row?.productId);
    const unit = productUnit(product);
    // An empty or half-typed field is kept as-is rather than snapped to a
    // number — otherwise typing "2." in a metres field jumps the cursor.
    if (rawQty === '' || rawQty === null || rawQty === undefined) {
      setCart((prev) => prev.map((item) => (cartRowKey(item) === rowKey ? { ...item, quantity: '' } : item)));
      return;
    }
    let qty = normalizeQuantity(rawQty, unit);
    if (qty <= 0) qty = minimumQuantity(unit);
    if (product && product.kind !== 'service') {
      const available = row?.variantId
        ? roundQuantity(Number(findVariant(product, row.variantId)?.stock) || 0, unit)
        : roundQuantity(Number(product.stock) || 0, unit);
      if (qty > available) {
        const label = row?.variantLabel ? `${product.name} (${row.variantLabel})` : product.name;
        toast.error(`Only ${formatQuantityWithUnit(available, unit, { showPiece: true })} of ${label} in stock.`);
        qty = available;
      }
    }
    if (qty <= 0) return;
    setCart((prev) => prev.map((item) => (cartRowKey(item) === rowKey ? { ...item, quantity: qty } : item)));
  };

  const updateCartPrice = (rowKey, rawPrice) => {
    let price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) price = 0;
    setCart((prev) => prev.map((item) => (cartRowKey(item) === rowKey ? { ...item, unitPrice: price } : item)));
  };

  const removeCartItem = (rowKey) => setCart((prev) => prev.filter((item) => cartRowKey(item) !== rowKey));

  // ── Open orders ───────────────────────────────────────────────────
  //
  // An open ticket is a saved cart and nothing more. It holds NO stock:
  // inventory moves only when it is charged, in the same batch that
  // writes the sale, exactly as a walk-up sale does. See utils/orders.js
  // for why reserving stock at ticket time is the wrong trade here.

  const ordersOn = industry.can('orders');
  const tablesOn = industry.can('tables');
  const kitchenOn = industry.can('kitchen');
  const diningModesOn = industry.can('diningModes');

  const clearOrderContext = () => {
    setActiveOrderId(null);
    setOrderTable(null);
    setOrderNote('');
    setOrderDiningMode(DEFAULT_DINING_MODE);
  };

  const handleOpenOrder = (order) => {
    if (!order) return;
    if (cart.length > 0 && order.id !== activeOrderId) {
      toast.error('Finish or clear the current order first.');
      return;
    }
    setCart(orderToCart(order));
    setActiveOrderId(order.id);
    setOrderTable(order.tableName || null);
    setOrderDiningMode(order.diningMode || DEFAULT_DINING_MODE);
    setOrderNote(order.note || '');
  };

  // A ticket handed over from the Orders page. Resolved once the orders
  // snapshot has arrived, then the navigation state is cleared so a
  // refresh does not reopen it.
  useEffect(() => {
    const wantedId = location.state?.openOrderId;
    if (!wantedId || !ordersOn) return;
    const order = openOrders.find((o) => o.id === wantedId);
    if (!order) return;
    // A one-shot hand-off from another page: it can only fire once per
    // navigation, because the navigation state is cleared on the same
    // tick, and there is nowhere earlier to do it — the order does not
    // exist on this page until its snapshot arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleOpenOrder(order);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.openOrderId, openOrders, ordersOn]);

  const handleSaveOrder = async () => {
    if (cart.length === 0 || savingOrder) return;
    const componentProblem = validateComponentStock(cart, products, { recipes: industry.can('recipes') });
    if (componentProblem) {
      toast.error(componentProblem);
      return;
    }
    setSavingOrder(true);
    try {
      const payload = buildOrderDocument(cart, {
        tableName: tablesOn ? orderTable : null,
        diningMode: diningModesOn ? orderDiningMode : DEFAULT_DINING_MODE,
        note: orderNote,
        openedBy: profile.uid,
        openedByName: profile.displayName,
      });

      let write;
      if (activeOrderId) {
        // Re-saving an existing ticket keeps its identity, its opener and
        // its kitchen state — only the contents, the totals and the
        // context move. Listed explicitly rather than by omission, so that
        // a field added to buildOrderDocument later cannot silently start
        // overwriting an open ticket's history.
        write = updateDoc(doc(db, 'orders', activeOrderId), {
          items: payload.items,
          productName: payload.productName,
          quantity: payload.quantity,
          totalAmount: payload.totalAmount,
          costOfGoodsSold: payload.costOfGoodsSold,
          profit: payload.profit,
          name: payload.name,
          tableName: payload.tableName,
          diningMode: payload.diningMode,
          note: payload.note,
          updatedAt: serverTimestamp(),
        });
      } else {
        write = addDoc(tenantCollection('orders'), withBusiness(payload, businessId));
      }

      const { queuedOffline, value, error } = await raceWithTimeout(write, 4000);
      if (error) throw error;
      if (!activeOrderId && value?.id) setActiveOrderId(value.id);

      toast.success(queuedOffline ? 'Order saved offline. It will sync when you reconnect.' : 'Order saved.');
      clearCart();
      clearOrderContext();
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setSavingOrder(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!activeOrderId) return;
    setSavingOrder(true);
    try {
      // Cancelled, never deleted: an order that was opened and abandoned
      // is a thing that happened, and a shop that wants to know how often
      // it happens needs the record to still be there.
      const write = updateDoc(doc(db, 'orders', activeOrderId), {
        status: ORDER_STATUS.CANCELLED,
        cancelledAt: serverTimestamp(),
        cancelledBy: profile.uid,
        updatedAt: serverTimestamp(),
      });
      const { error } = await raceWithTimeout(write, 4000);
      if (error) throw error;
      toast.success('Order cancelled.');
      clearCart();
      clearOrderContext();
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setSavingOrder(false);
    }
  };

  const clearCart = () => setCart([]);

  // Totalled through the same line-item builder that writes the sale, so
  // what the cart shows and what Firestore stores cannot disagree by a
  // rounding step.
  const cartLines = useMemo(() => cart.map(toLineItem), [cart]);
  const cartTotal = useMemo(() => sumLineTotals(cartLines), [cartLines]);
  const cartCost = useMemo(() => sumLineCosts(cartLines), [cartLines]);
  const cartEstimatedProfit = Math.max(0, cartTotal - cartCost);

  // ── FEFO ──────────────────────────────────────────────────────────
  //
  // Which physical box each line comes out of, worked out at the moment
  // of sale from the live batch list: earliest expiry first, split across
  // batches when one cannot cover the line, and EXPIRED STOCK NEVER
  // CHOSEN. The allocation is written onto the line item, so a pharmacy
  // can answer "which batch did we sell" from the sale record alone.
  //
  // The line's cost becomes the cost of the batches it actually came
  // from, so profit is the profit on the box that left the shelf rather
  // than on an average nobody paid.
  const batchesOn = industry.can('batches');
  const expiryAlertsOn = industry.can('expiryAlerts');

  function withBatchAllocations(lineItems) {
    if (!batchesOn) return lineItems;
    const today = todayISO();
    return lineItems.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product || product.kind === 'service') return item;
      const productBatches = batches.filter((b) => b.productId === item.productId);
      if (productBatches.length === 0) return item;

      const { allocations, shortfall } = allocateFefo(productBatches, item.quantity, {
        unit: product.unit, today,
      });
      if (allocations.length === 0) return item;

      // EXPIRY ALERTS at the till. FEFO has already picked the earliest
      // box that is still in date; this says so when that box is close to
      // its date, so a pharmacist can look at what they are about to hand
      // over rather than finding out from the dashboard tomorrow.
      //
      // It is a warning, never a block: the stock is in date and legal to
      // sell, and refusing it would strand a shop with a shelf it could
      // not clear. Gated on `expiryAlerts`, which is what an owner turns
      // off when they do not want to be told.
      if (expiryAlertsOn) {
        const soonest = allocations.find(
          (a) => a.expiryDate && expiryStatus({ expiryDate: a.expiryDate }, { today }) === EXPIRY_STATUS.EXPIRING
        );
        if (soonest) {
          const days = daysBetween(today, soonest.expiryDate);
          toast(
            days <= 0
              ? `${item.productName}: this batch expires today.`
              : `${item.productName}: this batch expires in ${days} day${days === 1 ? '' : 's'} (${soonest.expiryDate}).`,
            { icon: '⏳' }
          );
        }
      }

      if (shortfall > 0) {
        // Some of the line has no batch behind it. The sale still goes
        // through on the product total — refusing it would strand a
        // pharmacy whose batch records are mid-migration — but only the
        // part that IS accounted for is written against a batch.
        toast(`${item.productName}: only part of this could be matched to a batch.`, { icon: '⚠️' });
      }
      return {
        ...item,
        batchAllocations: allocations,
        costPrice: allocatedUnitCost(allocations, item.costPrice),
        lineCost: roundMoney(allocatedUnitCost(allocations, item.costPrice) * item.quantity),
        lineProfit: roundMoney(item.lineTotal - allocatedUnitCost(allocations, item.costPrice) * item.quantity),
      };
    });
  }

  function validateCartAgainstStock() {
    const problem = validateAgainstStock(cart, products);
    if (problem) throw new Error(problem);

    // With batches on, `product.stock` is the whole shelf — expired boxes
    // included. What can actually be SOLD is the unexpired part, so the
    // counter is held to that instead. Without this a pharmacy could sell
    // 140 when only 120 were safe to sell, and the FEFO allocator would
    // then quietly come up short.
    if (batchesOn) {
      const today = todayISO();
      const wanted = new Map();
      for (const row of cart) {
        const product = products.find((p) => p.id === row.productId);
        if (!product || product.kind === 'service') continue;
        if (!batches.some((b) => b.productId === product.id)) continue;
        const running = roundQuantity((wanted.get(product.id) || 0) + (Number(row.quantity) || 0), product.unit);
        wanted.set(product.id, running);
        const sellable = sellableBatchStockFor(batches, product.id, { unit: product.unit, today });
        if (running > sellable) {
          throw new Error(
            `Only ${formatQuantityWithUnit(sellable, product.unit, { showPiece: true })} of ${product.name} is within date.`
          );
        }
      }
    }
    // A dish assembled to order has no stock of its own; its ingredients
    // do, and running out of patties has to stop the sale too.
    const componentProblem = validateComponentStock(cart, products, { recipes: industry.can('recipes') });
    if (componentProblem) throw new Error(componentProblem);
  }

  // Charging an open ticket closes it in the SAME batch as the sale, so
  // there is no window in which a ticket has been paid for but still shows
  // as open — including offline, where the whole batch queues as one
  // mutation and applies atomically when it syncs.
  function closeActiveOrder(batch, saleId) {
    if (!activeOrderId) return;
    batch.update(doc(db, 'orders', activeOrderId), {
      status: ORDER_STATUS.COMPLETED,
      kitchenStatus: 'served',
      saleId,
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // The restaurant context a sale carries: which table, eat in or take
  // away, which ticket. Additions to the existing sale shape, never
  // replacements — every field computeFinancials() reads is untouched.
  function orderContextFields() {
    if (!ordersOn) return {};
    return orderToSaleFields({
      id: activeOrderId,
      tableName: tablesOn ? orderTable : null,
      diningMode: diningModesOn ? orderDiningMode : null,
      note: orderNote,
    });
  }

  // One Firestore update per product, carrying the product total and — for
  // a product with versions — the per-version quantity, in the SAME batch
  // as the sale document. Same batch matters twice over: the two can never
  // diverge, and offline the whole thing queues as one atomic mutation.
  //
  // The resolution and the write are now both shared: utils/inventory.js
  // decides what moves and utils/stockWrites.js writes it, so the
  // counter, purchases, the stock take, the dashboard and every reversal
  // path go through the same arithmetic instead of four copies of it.
  function applyCartStock(batch, rows, { reverse = false, only = null } = {}) {
    const deltas = resolveStockDeltas(rows, products, {
      recipes: industry.can('recipes'), packSizes: industry.can('packSizes'), reverse,
    });
    applyStockDeltas(batch, deltas, { only });
  }

  // ── Age-restricted goods ──────────────────────────────────────────
  //
  // Kenya's Alcoholic Drinks Control Act, 2010 prohibits selling an
  // alcoholic drink to a person under eighteen. When the cart holds an
  // item the owner has marked, the counter asks the person serving to
  // confirm — ONCE per checkout, not once per item, because a bartender
  // dismissing five dialogs stops reading them.
  //
  // It is a reminder to a human being, and nothing more. FlowBiz cannot
  // see the customer, does not record an age, does not scan an ID and
  // makes no claim about compliance: the check itself, and responsibility
  // for the sale, remain entirely the licensee's.
  const ageRestrictionOn = industry.can('ageRestriction');
  const restrictedInCart = useMemo(() => {
    if (!ageRestrictionOn) return [];
    const names = new Set();
    for (const row of cart) {
      const product = products.find((p) => p.id === row.productId);
      if (product?.ageRestricted === true) names.add(product.name);
    }
    return [...names];
  }, [ageRestrictionOn, cart, products]);

  /**
   * Run `proceed` now, or after the person serving has confirmed. Both
   * checkout paths — the phone's modal and the desktop panel — go through
   * this, so there is exactly one place the question is asked.
   */
  const withAgeCheck = (proceed) => {
    if (restrictedInCart.length === 0) {
      proceed();
      return;
    }
    setPendingAgeCheck(() => proceed);
  };

  const handleCartSale = ({ paymentMethod, mpesaCode }) => {
    validateCartAgainstStock();
    const lineItems = withBatchAllocations(cart.map(toLineItem));
    const totalAmount = sumLineTotals(lineItems);
    const costOfGoodsSold = sumLineCosts(lineItems);
    const profit = roundMoney(totalAmount - costOfGoodsSold);
    const quantity = summaryQuantity(lineItems);

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
        ...(lineItems.length === 1 && lineItems[0].unit ? { unit: lineItems[0].unit } : {}),
        ...orderContextFields(),
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
    applyCartStock(batch, lineItems);
    batch.set(saleRef, saleData);
    closeActiveOrder(batch, saleRef.id);

    return { record: { id: saleRef.id, ...saleData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleCartCredit = ({ customerId, customerName, customerPhone }) => {
    validateCartAgainstStock();
    const lineItems = withBatchAllocations(cart.map(toLineItem));
    const totalAmount = sumLineTotals(lineItems);
    const costOfGoodsSold = sumLineCosts(lineItems);
    const quantity = summaryQuantity(lineItems);

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
        ...(lineItems.length === 1 && lineItems[0].unit ? { unit: lineItems[0].unit } : {}),
        ...orderContextFields(),
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
    applyCartStock(batch, lineItems);
    batch.set(creditRef, creditData);
    closeActiveOrder(batch, creditRef.id);

    return { record: { id: creditRef.id, ...creditData, soldAt: new Date() }, commit: batch.commit() };
  };

  const handleCreateCustomer = async ({ name, phone }) => {
    const ref = await addDoc(tenantCollection('customers'), withBusiness({ name, phone, email: '', address: '', notes: '', createdAt: serverTimestamp() }, businessId));
    return { id: ref.id, name, phone };
  };

  // In-Place Desktop Checkout (Direct execution on PC screen)
  const handleDesktopCheckout = async () => {
    if (cart.length === 0 || desktopSubmitting) return;
    if (restrictedInCart.length > 0) {
      setPendingAgeCheck(() => runDesktopCheckout);
      return;
    }
    await runDesktopCheckout();
  };

  const runDesktopCheckout = async () => {
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
        toast.success('Sale saved offline. It will sync when you reconnect.');
        commit.catch((err) => toast.error(`A sale from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      } else {
        toast.success('Sale recorded.');
      }

      setDesktopLastSale(record);
      setDesktopCustomerPhone(cPhone || record.customerPhone || '');
      clearCart();
      clearOrderContext();
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
    // Publishing the public document link is a cloud service. Print and
    // Download beside this button are not, and stay available either way.
    if (!canShareLink) {
      toast.error(shareBlockedMessage);
      return;
    }
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
      clearOrderContext();
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
      // Voiding puts stock back exactly where the sale took it from —
      // including the specific version, so voiding a Black / M does not
      // credit the shirts back to the wrong size.
      applyCartStock(batch, targets, {
        reverse: true,
        only: targets.filter((item, idx) => snaps[idx].exists()).map((item) => item.productId),
      });
      targets.forEach((item, idx) => {
        if (!snaps[idx].exists()) {
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

  // ── Returning a completed sale ────────────────────────────────────
  //
  // A void says "this sale never really happened"; a return says "it did,
  // and here is the money back". Both restore stock through the SAME
  // inventory foundation, and the return additionally writes an ORDINARY
  // refund document — the same collection and the same fields the credit
  // refund path has always used — so close day, the till reconciliation
  // and every report account for it with no change of their own.
  //
  // Everything lands in ONE write batch: the stock, the refund and the
  // stamp on the sale that records how much of it has now come back. That
  // is what stops a return being counted twice, including offline, where
  // the whole thing queues as a single atomic mutation.
  const handleReturn = async ({ returned, method, reason }) => {
    const sale = returnTarget;
    if (!sale || returned.isEmpty) return;
    try {
      const targets = returned.rows.filter((row) => row.productId);
      const snaps = await Promise.all(targets.map((row) => getDoc(doc(db, 'products', row.productId))));
      const live = targets.filter((row, idx) => snaps[idx].exists()).map((row) => row.productId);

      const batch = writeBatch(db);
      applyCartStock(batch, targets, { reverse: true, only: live });

      const refundRef = doc(collection(db, 'refunds'));
      batch.set(refundRef, withBusiness(buildRefundDocument({
        sale, returned, method, reason,
        refundedBy: profile.uid,
        refundedByName: profile.displayName,
      }), businessId));

      // How much of each line has now come back, so a second return of
      // the same shirt cannot refund it twice.
      batch.update(doc(db, 'sales', sale.id), {
        returnedQuantities: returned.returnedQuantities,
        lastReturnedAt: serverTimestamp(),
      });

      const commit = batch.commit();
      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      if (queuedOffline) commit.catch((err) => toast.error(`A return from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));

      toast.success(
        queuedOffline
          ? 'Return saved offline. It will sync when you reconnect.'
          : live.length < targets.length
            ? 'Return recorded (some deleted products were not restored).'
            : 'Return recorded and stock restored.'
      );
      setReturnTarget(null);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    }
  };

  const handleProductSave = async (data) => {
    try {
      const { id, queuedOffline } = await createProduct(data, businessId);
      toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Product added');
      if (prefillBarcode !== null && !queuedOffline) {
        addToCart({ id, name: data.name, sellingPrice: data.sellingPrice, costPrice: data.costPrice, stock: data.stock ?? 0, barcode: data.barcode || null }, 1);
      }
      setProdModal(false);
      setPrefillBarcode(null);
      // Returned so ProductFormModal can attach a photo to the new product.
      return { id };
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
    if (ref?.id) {
      setNewSupplierId(ref.id);
      await refetchSuppliers();
    }
    setSupplierModal(false);
    toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Supplier added');
  };

  // A scan resolves in three steps, in this order: a barcode printed on a
  // specific VERSION (a boutique labelling each size), then the product's
  // own barcode or internal code, then nothing. A product with versions
  // that is reached by its parent code opens the picker rather than
  // guessing which size the customer is holding.
  const resolveScan = (code) => {
    const variantHit = findVariantByBarcode(products, code);
    if (variantHit) return variantHit;
    const found = findProductByCode(products, code);
    return found ? { product: found, variant: null } : null;
  };

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const hit = resolveScan(code);
    if (!hit) {
      setNotFoundCode(code);
      return;
    }
    if (hit.variant) {
      addToCart(hit.product, 1, hit.variant);
      toast.success(`${hit.product.name} (${hit.variant.label}) added`, { duration: 1200 });
      return;
    }
    if (hasVariants(hit.product)) {
      setVariantPick(hit.product);
      return;
    }
    addToCart(hit.product, 1);
    toast.success(`${hit.product.name} added to cart`, { duration: 1200 });
  };

  // Continuous variant: no toast (they stack badly at this rate) and the
  // dock stays open. A miss closes the dock so the "not found" prompt is
  // not buried behind the camera.
  const handleDockScan = (code) => {
    const hit = resolveScan(code);
    if (hit) {
      if (hit.variant) {
        addToCart(hit.product, 1, hit.variant);
        setLastScanLabel(`${hit.product.name} (${hit.variant.label})`);
      } else if (hasVariants(hit.product)) {
        // Choosing a size needs the screen, so the dock steps aside.
        setDockOpen(false);
        setVariantPick(hit.product);
      } else {
        addToCart(hit.product, 1);
        setLastScanLabel(hit.product.name);
      }
    } else {
      setDockOpen(false);
      setNotFoundCode(code);
    }
  };

  const openScanner = () => {
    if (shouldUseScannerDock()) {
      setLastScanLabel(null);
      setDockOpen(true);
    } else {
      setScannerOpen(true);
    }
  };

  useHardwareScanner(handleScanDetected, {
    enabled: !!session && !isClosed && !prodModal && !supplierModal && !scannerOpen && !dockOpen && !notFoundCode && !completedSale && !checkoutOpen,
  });

  if (sessLoading) return <LoadingSpinner label="Loading today's session…" />;
  if (isClosed) {
    return (
      <div className="mx-auto max-w-sm pt-8 space-y-4 text-center">
        <EmptyState title="Today's session is closed" description="Sales are locked. An owner can reopen to continue trading." />
        {permissions.can('day.close') && <button className="btn-primary w-full" onClick={reopenSession}>Reopen session</button>}
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
              onCheckout={() => withAgeCheck(() => setCheckoutOpen(true))}
              onSaveOrder={ordersOn ? handleSaveOrder : null}
              saveOrderLabel={activeOrderId ? industry.terms.updateOrder : industry.terms.saveOrder}
              savingOrder={savingOrder}
            />
          </div>

          {ordersOn && (
            <OrderBar
              openOrders={openOrders}
              tables={settings.tables}
              activeOrderId={activeOrderId}
              tableName={orderTable}
              diningMode={orderDiningMode}
              showTables={tablesOn}
              showDiningModes={diningModesOn}
              showKitchen={kitchenOn}
              onPickTable={(name) => setOrderTable((prev) => (prev === name ? null : name))}
              onDiningModeChange={setOrderDiningMode}
              onOpenOrder={handleOpenOrder}
              busy={savingOrder || desktopSubmitting}
            />
          )}

          <input
            className="input"
            placeholder={`Search ${industry.terms.catalogueItemPlural} by name, category, or barcode…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {showCategoryFilter && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by category">
              <button
                type="button"
                onClick={() => setCategory(null)}
                aria-pressed={category === null}
                className={`shrink-0 rounded-pill border px-3 py-1 text-button transition-colors ${
                  category === null
                    ? 'border-primary-600 bg-primary-50 text-primary-800'
                    : 'border-line bg-surface text-ink-600 hover:bg-ink-50'
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setCategory((prev) => (prev === c.name ? null : c.name))}
                  aria-pressed={category === c.name}
                  className={`shrink-0 rounded-pill border px-3 py-1 text-button transition-colors ${
                    category === c.name
                      ? 'border-primary-600 bg-primary-50 text-primary-800'
                      : 'border-line bg-surface text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {prodLoading ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <EmptyState title="No products match" description="Try another search keyword or scan a barcode." />
          ) : (
            <>
              <ProductGrid products={filtered} onSelect={selectProduct} isAdmin={false} cartQuantities={cartQuantities} />
              {truncated && (
                <p className="text-secondary text-ink-500">
                  Showing the first <span className="num">{filtered.length}</span> of{' '}
                  <span className="num">{matchCount}</span> matches. Scan a barcode or keep typing.
                </p>
              )}
            </>
          )}

          {permissions.can('sales.history') && (
            <Section title="Sales log" hint="Last 100 sales and credit sales">
              {salesLoading || creditLoading ? (
                <LoadingSpinner />
              ) : (
                <DataTable
                  caption="Sales and credit sales recorded on this counter"
                  maxHeight="24rem"
                  rows={mergedSales}
                  rowKey={(s) => s.id}
                  mobileLayout="row"
                  columns={[
                    {
                      key: 'productName',
                      header: 'Sale',
                      primary: true,
                      render: (s) => (
                        <span className={s.isVoided ? 'text-ink-400 line-through' : 'text-ink-900'}>
                          <span className="num">{saleQuantityLabel(s)}</span> × {s.productName}
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
                      mobileTrailing: true,
                      // A returned sale is not a plain "Paid" one. The
                      // money went back over the counter, and a cashier
                      // reconciling the till has to be able to see that
                      // from the row rather than from opening it.
                      render: (s) => {
                        if (s.isVoided) return <StatusPill tone="negative">Voided</StatusPill>;
                        if (s.isCredit) return <StatusPill tone="caution">On credit</StatusPill>;
                        const returned = returnState(s);
                        if (returned === 'full') return <StatusPill tone="negative">Returned</StatusPill>;
                        if (returned === 'partial') return <StatusPill tone="caution">Part returned</StatusPill>;
                        return <StatusPill tone="positive">Paid</StatusPill>;
                      },
                    },
                    {
                      key: 'totalAmount',
                      header: 'Amount',
                      numeric: true,
                      mobileTrailing: true,
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
                      {/* A return, for a sale that was genuinely paid for
                          and is genuinely coming back. Offered on any
                          completed cash or M-Pesa sale that still has
                          something left to return — unlike Void, which is
                          for a mistake rung up moments ago. */}
                      {!s.isVoided && !s.isCredit && permissions.can('sales.return') && !isFullyReturned(s) && (
                        <button
                          type="button"
                          onClick={() => setReturnTarget(s)}
                          className="btn-ghost !px-2 text-ink-500 hover:text-ink-900"
                          title="Return this sale"
                          aria-label={`Return the sale of ${s.productName}`}
                        >
                          <Undo2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      )}
                      {s.isCredit && permissions.can('customers.view') && (
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
                  const lineTotal = toLineItem(item).lineTotal;
                  const rowUnit = item.unit || 'piece';
                  const rowStep = unitStep(rowUnit);
                  const rowMeasured = rowUnit !== 'piece';
                  return (
                    <div key={cartRowKey(item)} className="space-y-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-body font-medium text-ink-900">
                          {item.productName}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCartItem(cartRowKey(item))}
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
                            onClick={() => updateCartQuantity(cartRowKey(item), roundQuantity((Number(item.quantity) || 0) - 1, item.unit))}
                            className="flex h-7 w-7 items-center justify-center rounded-l-control text-ink-600 hover:bg-ink-50"
                            aria-label={`Decrease quantity of ${item.productName}`}
                          >
                            <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                          {/* An input rather than a label, so a measured
                              quantity like 2.5 m can be typed straight in
                              instead of being nudged with the buttons. */}
                          <input
                            type="number"
                            min={rowStep}
                            step={rowStep}
                            inputMode={rowMeasured ? 'decimal' : 'numeric'}
                            value={item.quantity}
                            onChange={(e) => updateCartQuantity(cartRowKey(item), e.target.value)}
                            aria-label={`Quantity of ${item.productName}`}
                            className={`num h-7 border-0 bg-transparent text-center text-cell font-semibold text-ink-900 focus:outline-none ${
                              rowMeasured ? 'w-16' : 'w-8'
                            }`}
                          />
                          {rowMeasured && (
                            <span className="pr-1 text-label uppercase text-ink-400">{getUnit(rowUnit).short}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(cartRowKey(item), roundQuantity((Number(item.quantity) || 0) + 1, item.unit))}
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
                            onChange={(e) => updateCartPrice(cartRowKey(item), e.target.value)}
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
                    <p className="text-secondary text-ink-500">
                      Margin <Money value={cartEstimatedProfit} tone="positive" />
                    </p>
                  )}
                </div>
                <p className="text-money text-ink-900"><Money value={cartTotal} /></p>
              </div>

              {/* Two ways out of a food order: park it, or charge it.
                  Parking is the more common one during service, so it
                  sits first — but charging keeps the primary weight. */}
              {ordersOn && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={cart.length === 0 || savingOrder || desktopSubmitting}
                    onClick={handleSaveOrder}
                    className="btn-secondary flex-1"
                  >
                    {savingOrder ? 'Saving…' : activeOrderId ? industry.terms.updateOrder : industry.terms.saveOrder}
                  </button>
                  {activeOrderId && (
                    <button
                      type="button"
                      disabled={savingOrder || desktopSubmitting}
                      onClick={handleCancelOrder}
                      className="btn-ghost text-ink-600 hover:text-danger-700"
                    >
                      Cancel order
                    </button>
                  )}
                </div>
              )}

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
            <div className="rounded-panel border border-line bg-surface space-y-3 p-4">
              <div className="flex items-center justify-between border-b border-divider pb-2.5">
                <StatusPill tone="positive">Sale completed</StatusPill>
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
                    <div key={cartRowKey(item) || idx} className="flex items-center justify-between text-secondary text-ink-600">
                      <span>{formatQuantityWithUnit(item.quantity, item.unit)} × {item.productName}</span>
                      <span className="font-semibold text-ink-800">
                        {formatKES(item.lineTotal ?? (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-secondary text-ink-600">{desktopLastSale.productName}</p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-divider pt-2.5 text-body">
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
 className="btn-outline flex items-center justify-center gap-1.5 text-secondary"
                >
                  <Printer className="h-3.5 w-3.5" strokeWidth={1.75} /> Print
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (desktopLastSale.isCredit) generateInvoicePDF(desktopLastSale, settings);
                    else generateReceiptPDF(desktopLastSale, settings);
                  }}
 className="btn-outline flex items-center justify-center gap-1.5 text-secondary"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> Download
                </button>
              </div>

              <div className="space-y-1.5 rounded-panel bg-ink-50 p-2.5">
                <label className="text-label font-semibold text-ink-600">
                  WhatsApp {desktopLastSale.isCredit ? 'invoice' : 'receipt'} {!isPro && <span className="text-warning-700">(Pro)</span>}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Customer phone (07xx...)"
                    value={desktopCustomerPhone}
                    onChange={(e) => setDesktopCustomerPhone(e.target.value)}
 className="input flex-1 text-secondary"
                  />
                  {isPro ? (
                    <button
                      type="button"
                      onClick={handleDesktopWhatsApp}
                      disabled={desktopSendingWhatsApp || !canShareLink}
 className="btn-primary flex shrink-0 items-center gap-1 !px-3 text-secondary"
                    >
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {desktopSendingWhatsApp ? 'Sending…' : 'Send'}
                    </button>
                  ) : (
 <Link to="/pro" className="btn-primary flex shrink-0 items-center gap-1 !px-3 text-secondary">
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} /> Unlock
                    </Link>
                  )}
                </div>
                {!canShareLink && (
                  <p className="text-label leading-relaxed text-ink-500">{shareBlockedMessage}</p>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Floating & scanner elements */}
      <VariantPickerModal
        open={!!variantPick}
        product={variantPick}
        onSelect={(variant) => {
          const product = variantPick;
          setVariantPick(null);
          // A version may still have choices to make on top of it.
          if (modifiersOn && hasModifiers(product)) setModifierPick({ product, variant });
          else addToCart(product, 1, variant);
        }}
        onClose={() => setVariantPick(null)}
      />

      {modifierPick && (
        <ModifierPickerModal
          product={modifierPick.product}
          variant={modifierPick.variant}
          onAdd={(extras) => {
            addToCart(modifierPick.product, 1, modifierPick.variant, extras);
            setModifierPick(null);
          }}
          onClose={() => setModifierPick(null)}
        />
      )}

      <ScanFab onClick={openScanner} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />
      <ScannerDock
        open={dockOpen}
        onClose={() => setDockOpen(false)}
        onDetected={handleDockScan}
        lastScanLabel={lastScanLabel && `${lastScanLabel} added`}
        cartTotal={cartTotal}
      />

      <Modal open={!!notFoundCode} onClose={() => setNotFoundCode(null)} title="Product not found" widthClass="max-w-xs">
        <p className="mb-4 text-body text-ink-500">
          No product matches barcode <span className="font-mono">{notFoundCode}</span>.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setNotFoundCode(null)}>Cancel</button>
          {permissions.can('catalogue.manage') ? (
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
            <span className="self-center text-secondary text-ink-400">Ask an owner to add this product.</span>
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
        allProducts={products}
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

      <ReturnSaleModal
        open={!!returnTarget}
        sale={returnTarget}
        onClose={() => setReturnTarget(null)}
        onSubmit={handleReturn}
      />

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

      {/* One confirmation, once per checkout. The wording asks about the
          customer, because that is the check being made — it does not
          claim FlowBiz has verified anything, and nothing is recorded. */}
      <ConfirmDialog
        open={!!pendingAgeCheck}
        title="Is the customer 18 or over?"
        message={`This sale includes ${restrictedInCart.join(', ')}. These may not be sold to anyone under 18.`}
        confirmLabel="Yes, continue"
        cancelLabel="No, cancel"
        onConfirm={() => {
          const proceed = pendingAgeCheck;
          setPendingAgeCheck(null);
          proceed?.();
        }}
        onCancel={() => setPendingAgeCheck(null)}
      />
    </div>
  );
}