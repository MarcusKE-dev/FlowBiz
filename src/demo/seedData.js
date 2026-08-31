// src/demo/seedData.js
import { seedDoc, seedCommit, clearAllDemoData, makeTimestamp } from './localFirestore';
import { DEMO_UID } from './localAuth';
import { todayKey } from '../utils/dateRanges';

// MULTI-TENANT CHANGE: every collection in the real app is now scoped by
// `businessId`, and `tenantQuery()` throws if it's ever called without
// one. The demo dataset previously seeded documents with no businessId at
// all — under the new architecture that would make every single page's
// queries throw immediately on `npm run dev:demo`. This file now stamps
// a fixed DEMO_BUSINESS_ID onto every seeded document, and the demo
// user's own profile carries that same businessId + the new `role:
// 'owner'` value (replacing the old `role: 'admin'`), exactly mirroring
// what a real signed-up owner's profile looks like.
export const DEMO_BUSINESS_ID = 'demo-business';

const SUPPLIERS = [
  {
    id: 'sup_nairobi_electronics',
    name: 'Nairobi Electronics Wholesale Ltd',
    contactPerson: 'Peter Mwangi',
    phone: '0722 445 108',
    email: 'sales@nairobielectronics.co.ke',
    address: 'River Road, Nairobi',
    notes: 'Main supplier for accessories and cables.',
  },
  {
    id: 'sup_techhub',
    name: 'TechHub Distributors Kenya',
    contactPerson: 'Grace Wanjiru',
    phone: '0733 219 764',
    email: 'orders@techhubke.com',
    address: 'Kimathi Street, Nairobi',
    notes: 'Supplies laptops, monitors, and peripherals.',
  },
];

// FIX: added one 17th product, deliberately at zero stock, so Inventory
// Intelligence's "Critical Stockout" / "REVENUE LOSS" insight has
// something real to show — every other product already had at least 2
// units.
const PRODUCTS = [
  { name: 'Wireless Mouse',            category: 'Electronics', costPrice: 650,   sellingPrice: 950,   stock: 40, lowStockThreshold: 8,  barcode: '6009880123451', supplierId: 'sup_nairobi_electronics' },
  { name: 'Mechanical Keyboard',       category: 'Electronics', costPrice: 2800,  sellingPrice: 3999,  stock: 15, lowStockThreshold: 5,  barcode: '6009880123452', supplierId: 'sup_techhub' },
  { name: 'USB Flash Disk 32GB',       category: 'Electronics', costPrice: 350,   sellingPrice: 599,   stock: 60, lowStockThreshold: 10, barcode: '6009880123453', supplierId: 'sup_nairobi_electronics' },
  { name: 'External Hard Drive 1TB',   category: 'Electronics', costPrice: 4200,  sellingPrice: 5499,  stock: 12, lowStockThreshold: 4,  barcode: '6009880123454', supplierId: 'sup_techhub' },
  { name: 'Power Bank 10000mAh',       category: 'Electronics', costPrice: 1100,  sellingPrice: 1699,  stock: 25, lowStockThreshold: 6,  barcode: '6009880123455', supplierId: 'sup_nairobi_electronics' },
  { name: 'USB-C Charger 20W',         category: 'Electronics', costPrice: 550,   sellingPrice: 899,   stock: 4,  lowStockThreshold: 8,  barcode: '6009880123456', supplierId: 'sup_nairobi_electronics' },
  { name: 'Phone Charger (Micro-USB)', category: 'Electronics', costPrice: 300,   sellingPrice: 549,   stock: 3,  lowStockThreshold: 8,  barcode: '6009880123457', supplierId: 'sup_nairobi_electronics' },
  { name: 'HDMI Cable 1.5m',           category: 'Electronics', costPrice: 250,   sellingPrice: 449,   stock: 30, lowStockThreshold: 6,  barcode: '6009880123458', supplierId: 'sup_nairobi_electronics' },
  { name: 'Monitor 24" LED',           category: 'Electronics', costPrice: 12500, sellingPrice: 15999, stock: 6,  lowStockThreshold: 3,  barcode: '6009880123459', supplierId: 'sup_techhub' },
  { name: 'Laptop Stand',              category: 'Electronics', costPrice: 900,   sellingPrice: 1450,  stock: 18, lowStockThreshold: 5,  barcode: '6009880123460', supplierId: 'sup_techhub' },
  { name: 'Bluetooth Speaker',         category: 'Electronics', costPrice: 1800,  sellingPrice: 2699,  stock: 2,  lowStockThreshold: 5,  barcode: '6009880123461', supplierId: 'sup_techhub' },
  { name: 'Earbuds (Wireless)',        category: 'Electronics', costPrice: 1200,  sellingPrice: 1899,  stock: 22, lowStockThreshold: 6,  barcode: '6009880123462', supplierId: 'sup_nairobi_electronics' },
  { name: 'Headphones (Over-ear)',     category: 'Electronics', costPrice: 2200,  sellingPrice: 3299,  stock: 10, lowStockThreshold: 4,  barcode: '6009880123463', supplierId: 'sup_techhub' },
  { name: 'Extension Cable (4-way)',   category: 'Electronics', costPrice: 700,   sellingPrice: 1099,  stock: 20, lowStockThreshold: 5,  barcode: '6009880123464', supplierId: 'sup_nairobi_electronics' },
  { name: 'Router (Wireless N)',       category: 'Electronics', costPrice: 2600,  sellingPrice: 3599,  stock: 9,  lowStockThreshold: 4,  barcode: '6009880123465', supplierId: 'sup_techhub' },
  { name: 'Smart Watch',               category: 'Electronics', costPrice: 3500,  sellingPrice: 4999,  stock: 7,  lowStockThreshold: 3,  barcode: '6009880123466', supplierId: 'sup_techhub' },
  { name: 'Wireless Charging Pad',     category: 'Electronics', costPrice: 950,   sellingPrice: 1499,  stock: 0,  lowStockThreshold: 5,  barcode: '6009880123467', supplierId: 'sup_techhub' },
];

const DEMO_CUSTOMERS = [
  { id: 'demo_cust_1', name: 'John Kamau', phone: '0722334455' },
  { id: 'demo_cust_2', name: 'Grace Wanjiru', phone: '0711223344' },
  { id: 'demo_cust_3', name: 'Peter Otieno', phone: '0733445566' },
  { id: 'demo_cust_4', name: 'Mary Njeri', phone: '0700112233' },
  { id: 'demo_cust_5', name: 'Samuel Kiprop', phone: '0745667788' },
];

const STAFF_NAMES = ['Demo Owner', 'Sarah M.', 'Brian K.'];
const PAYMENT_WEIGHTED = ['Cash', 'Cash', 'M-Pesa', 'M-Pesa', 'M-Pesa'];
const EXPENSE_ENTRIES = [
  ['Rent', 15000], ['Electricity', 2500], ['Transport', 800], ['Wages', 8000],
  ['Airtime Float', 1000], ['Shop Supplies', 1200], ['Security', 1500], ['Other', 600],
];

// Deliberately given ZERO sales anywhere in the seeded history, so
// Inventory Intelligence's "Slow-Moving Stock" section has real,
// consistent examples (in stock, but nothing sold in 30 days).
const SLOW_PRODUCT_NAMES = ['Router (Wireless N)', 'Smart Watch', 'Monitor 24" LED'];
// Deliberately given EXTRA sales weight — combined with their already-low
// starting stock above, this gives Inventory Intelligence's "Reorder
// Priority" section real fast-movers that are genuinely running low,
// not just low stock with no signal either way.
const HOT_PRODUCT_NAMES = ['USB-C Charger 20W', 'Phone Charger (Micro-USB)', 'Wireless Mouse', 'USB Flash Disk 32GB'];

// Small, seeded (not Math.random) pseudo-random generator — mulberry32.
// Using a fixed seed means resetting the demo (Settings → Demo Reset)
// always regenerates the SAME history rather than a different random
// story every time, which is easier to reason about and support.
function createRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateAt(daysAgoCount, hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgoCount);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Builds ~70 days of sales, credit sales + repayments, and expenses —
// enough for the 7/30/90-day Advanced Analytics windows to all have
// data, for period-over-period comparisons to have a real "previous
// period" to compare against, and for every Inventory Intelligence
// section (ABC classification, slow-moving, reorder priority,
// overstock, stockout) to have a genuine example rather than an empty
// state.
function seedHistory(touched, businessId) {
  const rng = createRng(20260830);
  const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const productWithId = (product) => {
    const index = PRODUCTS.indexOf(product);
    return { productId: `demo_product_${index + 1}`, product };
  };

  const salesPool = PRODUCTS.filter((p) => !SLOW_PRODUCT_NAMES.includes(p.name) && p.stock > 0);
  const hotPool = PRODUCTS.filter((p) => HOT_PRODUCT_NAMES.includes(p.name));

  const HISTORY_DAYS = 69; // ~10 weeks
  let saleCounter = 0;
  let voidedPlaced = false;

  for (let dayOffset = HISTORY_DAYS; dayOffset >= 0; dayOffset--) {
    const salesToday = randInt(0, 3);
    for (let i = 0; i < salesToday; i++) {
      const useHot = hotPool.length > 0 && rng() < 0.35;
      const { productId, product } = productWithId(useHot ? pick(hotPool) : pick(salesPool));
      const quantity = randInt(1, 3);
      const totalAmount = quantity * product.sellingPrice;
      const profit = quantity * (product.sellingPrice - product.costPrice);
      const method = pick(PAYMENT_WEIGHTED);
      const isVoided = !voidedPlaced && dayOffset === 12 && i === 0;
      if (isVoided) voidedPlaced = true;

      seedDoc('sales', `demo_sale_${dayOffset}_${i}`, {
        businessId,
        productId, productName: product.name,
        quantity, costPricePerUnit: product.costPrice, soldPricePerUnit: product.sellingPrice,
        totalAmount, profit,
        paymentMethod: method, mpesaCode: method === 'M-Pesa' ? `QW${randInt(100000, 999999)}KE` : null,
        soldBy: DEMO_UID, soldByName: pick(STAFF_NAMES),
        soldAt: makeTimestamp(dateAt(dayOffset, randInt(8, 19), randInt(0, 59)).getTime()),
        isCredit: false, isVoided,
      });
      touched.add('sales');
      saleCounter++;
    }
  }

  // Credit sales, each with 0-2 repayments depending on how much (if
  // any) of the balance has been collected — this is what feeds Top
  // Debtors, Capital & Credit Exposure, and the payment-mix chart's
  // credit slice.
  let creditIndex = 0;
  for (let dayOffset = 65; dayOffset >= 3; dayOffset -= randInt(3, 6)) {
    const customer = pick(DEMO_CUSTOMERS);
    const { productId, product } = productWithId(pick(salesPool));
    const quantity = randInt(1, 2);
    const totalAmount = quantity * product.sellingPrice;
    const creditId = `demo_credit_${creditIndex}`;
    const outcome = rng();
    let status, amountPaid, remainingBalance;
    if (outcome < 0.4) {
      status = 'paid'; amountPaid = totalAmount; remainingBalance = 0;
    } else if (outcome < 0.75) {
      status = 'partial';
      amountPaid = Math.round(totalAmount * (0.3 + rng() * 0.4));
      remainingBalance = totalAmount - amountPaid;
    } else {
      status = 'pending'; amountPaid = 0; remainingBalance = totalAmount;
    }

    seedDoc('creditSales', creditId, {
      businessId,
      customerId: customer.id, customerName: customer.name, customerPhone: customer.phone,
      productId, productName: product.name, quantity,
      costPricePerUnit: product.costPrice, soldPricePerUnit: product.sellingPrice, totalAmount,
      soldBy: DEMO_UID, soldByName: pick(STAFF_NAMES),
      soldAt: makeTimestamp(dateAt(dayOffset, randInt(9, 17), randInt(0, 59)).getTime()),
      status, amountPaid, remainingBalance, paymentHistory: [],
      isCredit: true,
    });
    touched.add('creditSales');

    if (amountPaid > 0) {
      const splitInTwo = amountPaid > 1000 && rng() < 0.5;
      const firstAmt = splitInTwo ? Math.round(amountPaid * 0.5) : amountPaid;
      seedDoc('repayments', `demo_repay_${creditIndex}_a`, {
        businessId, creditSaleId: creditId, customerId: customer.id, customerName: customer.name,
        productName: product.name, amount: firstAmt, method: pick(PAYMENT_WEIGHTED),
        mpesaCode: null, paymentReference: `PAY-${creditIndex}A`,
        paidAt: makeTimestamp(dateAt(Math.max(dayOffset - randInt(1, 5), 0), randInt(9, 18), randInt(0, 59)).getTime()),
        recordedBy: DEMO_UID, recordedByName: pick(STAFF_NAMES),
      });
      touched.add('repayments');

      if (splitInTwo) {
        seedDoc('repayments', `demo_repay_${creditIndex}_b`, {
          businessId, creditSaleId: creditId, customerId: customer.id, customerName: customer.name,
          productName: product.name, amount: amountPaid - firstAmt, method: pick(PAYMENT_WEIGHTED),
          mpesaCode: null, paymentReference: `PAY-${creditIndex}B`,
          paidAt: makeTimestamp(dateAt(Math.max(dayOffset - randInt(6, 10), 0), randInt(9, 18), randInt(0, 59)).getTime()),
          recordedBy: DEMO_UID, recordedByName: pick(STAFF_NAMES),
        });
        touched.add('repayments');
      }
    }
    creditIndex++;
  }

  // Expenses — spread across the same window, cycling through every
  // category so the Expense Breakdown donut has more than one slice.
  let expenseIndex = 0;
  for (let dayOffset = 68; dayOffset >= 0; dayOffset -= randInt(2, 4)) {
    const [category, base] = pick(EXPENSE_ENTRIES);
    const amount = Math.round(base * (0.8 + rng() * 0.4));
    const method = pick(PAYMENT_WEIGHTED);
    seedDoc('expenses', `demo_expense_${expenseIndex}`, {
      businessId,
      description: category,
      category, amount, paymentMethod: method,
      mpesaCode: method === 'M-Pesa' ? `QW${randInt(100000, 999999)}KE` : null,
      recordedBy: DEMO_UID, recordedByName: pick(STAFF_NAMES),
      recordedAt: makeTimestamp(dateAt(dayOffset, randInt(8, 18), randInt(0, 59)).getTime()),
    });
    touched.add('expenses');
    expenseIndex++;
  }

  return { saleCount: saleCounter, creditCount: creditIndex, expenseCount: expenseIndex };
}

function buildAndSeed() {
  const now = makeTimestamp(Date.now());
  const touched = new Set();

  SUPPLIERS.forEach((s) => {
    const { id, ...data } = s;
    seedDoc('suppliers', id, { ...data, businessId: DEMO_BUSINESS_ID, createdAt: now });
    touched.add('suppliers');
  });

  PRODUCTS.forEach((p, i) => {
    const id = `demo_product_${i + 1}`;
    const internalCode = `FB-${String(i + 1).padStart(6, '0')}`;
    seedDoc('products', id, { ...p, businessId: DEMO_BUSINESS_ID, internalCode, deleted: false, createdAt: now, updatedAt: now });
    // Flat, businessId-prefixed doc id — matches utils/products.js exactly,
    // so a demo-seeded barcode round-trips through the same lookup code a
    // real business's products do.
    seedDoc('barcodeIndex', `${DEMO_BUSINESS_ID}__${p.barcode}`, { businessId: DEMO_BUSINESS_ID, barcode: p.barcode, productId: id });
    touched.add('products');
    touched.add('barcodeIndex');
  });
  seedDoc('productCodeCounters', DEMO_BUSINESS_ID, { businessId: DEMO_BUSINESS_ID, lastNumber: PRODUCTS.length });
  touched.add('productCodeCounters');

  DEMO_CUSTOMERS.forEach((c) => {
    seedDoc('customers', c.id, {
      businessId: DEMO_BUSINESS_ID, name: c.name, phone: c.phone,
      customerCode: `CUS-${c.id.slice(-6).toUpperCase()}`,
      email: '', address: '', notes: '', createdAt: now, updatedAt: now,
    });
    touched.add('customers');
  });

  // Business record + owner profile — mirrors exactly what Setup.jsx
  // creates for a real signed-up owner, so nothing downstream needs to
  // special-case Demo Mode.
  seedDoc('businesses', DEMO_BUSINESS_ID, {
    name: 'FlowBiz Demo Store',
    ownerIds: [DEMO_UID],
    createdAt: now,
    createdBy: DEMO_UID,
    // Seeded as an active Pro subscription with no expiry, instead of
    // free, so anyone trying the demo can explore every Pro feature —
    // Advanced Analytics, Inventory Intelligence, WhatsApp sharing,
    // unlimited products/staff — without needing a real payment. This
    // is read by AuthContext's `isPro` computation exactly the same way
    // a real business's subscription is; it only ever affects this
    // local, throwaway demo record and has zero bearing on real
    // subscriptions.
    subscription: { plan: 'pro', status: 'active', expiresAt: null },
  });
  touched.add('businesses');

  seedDoc('users', DEMO_UID, {
    uid: DEMO_UID, email: 'demo@flowbiz.app', displayName: 'Demo Owner',
    role: 'owner', businessId: DEMO_BUSINESS_ID, active: true, createdAt: now,
  });
  touched.add('users');

  // Replaces the old settings/general + settings/categories docs — see
  // useSettings.js and ProductFormModal.jsx, both of which now read this
  // single per-business document.
  seedDoc('businessSettings', DEMO_BUSINESS_ID, {
    shopName: 'FlowBiz Demo Store',
    cashierCanRecordExpenses: true,
    categories: ['Groceries', 'Beverages', 'Electronics', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other'],
  });
  touched.add('businessSettings');

  // Today's counter session, opened, so a demo visitor lands straight on
  // Dashboard/Counter without first having to click through "Open
  // today's counter" themselves.
  seedDoc('dailySessions', `${DEMO_BUSINESS_ID}_${todayKey()}`, {
    businessId: DEMO_BUSINESS_ID,
    date: todayKey(),
    openingCashFloat: 5000,
    openingMpesaFloat: 10000,
    openedBy: DEMO_UID,
    openedAt: now,
    closedAt: null,
    closedBy: null,
  });
  touched.add('dailySessions');

  seedHistory(touched, DEMO_BUSINESS_ID);

  seedCommit([...touched]);
}

// FIX: bumped v3 -> v4 (history/customers/session are new). This flag
// just means "has this browser already seeded its local demo data?" —
// bumping the name forces everyone who tried the demo before this
// change to get a fresh reseed with the full history, instead of
// silently keeping their old, mostly-empty demo data forever.
export function seedDemoDataIfNeeded() {
  if (localStorage.getItem('flowbiz_demo_seeded_v4') === 'true') return;
  buildAndSeed();
  localStorage.setItem('flowbiz_demo_seeded_v4', 'true');
}

export function resetDemoData() {
  clearAllDemoData();
  buildAndSeed();
  localStorage.setItem('flowbiz_demo_seeded_v4', 'true');
}