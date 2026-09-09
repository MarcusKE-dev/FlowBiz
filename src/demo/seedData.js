// src/demo/seedData.js
import { seedDoc, seedCommit, clearAllDemoData, makeTimestamp } from './localFirestore';
import { DEMO_UID } from './localAuth';
import { todayKey } from '../utils/dateRanges';
import {
  demoDataset, demoHistoryCost, DEFAULT_DEMO_PROFILE, DEMO_PROFILE_IDS,
} from './datasets';

// WHICH SAMPLE BUSINESS THIS BROWSER IS TRYING.
//
// Stored on its own rather than read back out of the seeded settings,
// because the reseed has to know which dataset to build BEFORE it clears
// the old one. Absent means the shop, which is what the demo has always
// been.
const PROFILE_KEY = 'flowbiz_demo_profile';

export function demoProfileId() {
  try {
    const stored = localStorage.getItem(PROFILE_KEY);
    return DEMO_PROFILE_IDS.includes(stored) ? stored : DEFAULT_DEMO_PROFILE;
  } catch {
    return DEFAULT_DEMO_PROFILE;
  }
}

function rememberProfile(profileId) {
  try { localStorage.setItem(PROFILE_KEY, profileId); } catch { /* not fatal */ }
}

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

// DEMO PRODUCT PHOTOS: the one case where a product's photo is a plain
// file rather than a Firestore document.
//
// A real product stores its photo in `productImages/{businessId}__{id}`
// (see utils/productImages.js). The demo store is localStorage, which has
// a ~5MB quota for the ENTIRE dataset, so base64 photos would eat most of
// it and start throwing QuotaExceededError mid-seed. Demo products point
// `imageUrl` at a static file in the public folder instead, which the app
// already renders directly and which costs the demo store nothing but a
// short string.
//
// Drop `<slug>.webp` into public/product-photos/ for each `image` slug in
// datasets.js. A file that is not there yet falls back to the neutral
// package icon; nothing breaks.
//
// BASE_URL, not a bare '/', because the demo build is served from /demo/
// (see vite.config.js) and a root-absolute path would 404 there.
const demoPhotoUrl = (slug) =>
  (slug ? `${import.meta.env.BASE_URL || '/'}product-photos/${slug}.webp`.replace(/\/{2,}/g, '/') : null);

const STAFF_NAMES = ['Demo Owner', 'Sarah M.', 'Brian K.'];
const PAYMENT_WEIGHTED = ['Cash', 'Cash', 'M-Pesa', 'M-Pesa', 'M-Pesa'];

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
function seedHistory(touched, businessId, data) {
  const rng = createRng(20260830);
  const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const productWithId = (product) => {
    const index = data.products.indexOf(product);
    return { productId: `demo_product_${index + 1}`, product };
  };

  // A dish assembled to order has stock 0 by design, so "in stock" is
  // the wrong filter for a menu. Anything with a recipe is always
  // sellable; everything else needs stock on the shelf.
  const sellable = (p) => Array.isArray(p.recipe) ? p.recipe.length > 0 : p.stock > 0;
  const onTheMenu = data.products.filter((p) => p.catalogRole !== 'ingredient');
  const salesPool = onTheMenu.filter((p) => !data.slow.includes(p.name) && sellable(p));
  const hotPool = onTheMenu.filter((p) => data.hot.includes(p.name));

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
      // A made-to-order dish stores `costPrice: 0` and is costed from its
      // recipe when the counter rings it. The seeded history has no
      // counter to run, so it resolves the recipe here. Without this
      // every demo sale of a dish would report a 100% margin.
      const unitCost = demoHistoryCost(product, data);
      const profit = quantity * (product.sellingPrice - unitCost);
      const method = pick(PAYMENT_WEIGHTED);
      const isVoided = !voidedPlaced && dayOffset === 12 && i === 0;
      if (isVoided) voidedPlaced = true;

      seedDoc('sales', `demo_sale_${dayOffset}_${i}`, {
        businessId,
        productId, productName: product.name,
        quantity, costPricePerUnit: unitCost, soldPricePerUnit: product.sellingPrice,
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
    const customer = pick(data.customers);
    const { productId, product } = productWithId(pick(salesPool));
    const quantity = randInt(1, 2);
    const totalAmount = quantity * product.sellingPrice;
    const unitCost = demoHistoryCost(product, data);
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
      costPricePerUnit: unitCost, soldPricePerUnit: product.sellingPrice, totalAmount,
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
    const [category, base] = pick(data.expenses);
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

/**
 * TICKETS THAT ARE ALREADY OPEN when the demo loads.
 *
 * Without these the floor, the kitchen screen and the customer display
 * all open empty, and an empty screen shows nothing about what a screen
 * does. A restaurant demo with no service running is a picture of a
 * restaurant that has not opened yet.
 *
 * Both storage shapes are seeded on purpose:
 *
 *   'array'  one document with an `items` list and a single
 *            `kitchenStatus`, which is what Counter.jsx writes today.
 *   'lines'  one document per line in `orderLines`, which is what the
 *            F&B engine was built for and what per-item firing needs.
 *
 * Seeding both is the honest demo, because both are what a real business
 * will have during the migration, and it exercises the whole-ticket
 * fallback on the kitchen screen as well as the per-item path.
 */
function seedOpenTickets(touched, data, productIdByName) {
  const tickets = data.openTickets || [];
  if (tickets.length === 0) return;

  const byName = new Map(data.products.map((p) => [p.name, p]));
  const minsAgo = (m) => makeTimestamp(Date.now() - m * 60000);

  tickets.forEach((ticket) => {
    const opened = minsAgo(ticket.minutesAgo);
    const rows = ticket.model === 'lines' ? ticket.lines : ticket.items;

    const priced = rows.map((row) => {
      const product = byName.get(row.product);
      const unitPrice = Number(product?.sellingPrice) || 0;
      return {
        row,
        product,
        productId: productIdByName.get(row.product) || null,
        unitPrice,
        unitCost: demoHistoryCost(product, data),
        lineTotal: unitPrice * row.quantity,
      };
    });

    const totalAmount = priced.reduce((sum, p) => sum + p.lineTotal, 0);
    const costOfGoodsSold = priced.reduce((sum, p) => sum + p.unitCost * p.row.quantity, 0);
    const round = (n) => Math.round(n * 100) / 100;

    const header = {
      businessId: DEMO_BUSINESS_ID,
      status: 'open',
      name: ticket.table,
      tableName: ticket.table,
      diningMode: ticket.diningMode,
      totalAmount: round(totalAmount),
      costOfGoodsSold: round(costOfGoodsSold),
      profit: round(totalAmount - costOfGoodsSold),
      openedAt: opened,
      updatedAt: opened,
      openedBy: DEMO_UID,
      openedByName: 'Demo Owner',
      note: '',
    };

    if (ticket.model === 'lines') {
      // `lineModel` is what readTicket() reads to decide which shape this
      // ticket stores. Absent means the legacy array, so it is written
      // only for the new shape.
      header.lineModel = 'lines';
      header.productName = priced[0]?.row.product || 'Order';
      header.quantity = priced.reduce((sum, p) => sum + p.row.quantity, 0);
      seedDoc('orders', ticket.id, header);

      priced.forEach((p, index) => {
        const line = p.row;
        seedDoc('orderLines', `${ticket.id}_l${index + 1}`, {
          businessId: DEMO_BUSINESS_ID,
          orderId: ticket.id,
          seq: index + 1,
          open: true,
          voided: false,
          productId: p.productId,
          productName: line.product,
          ...(p.product?.kitchenName ? { kitchenName: p.product.kitchenName } : {}),
          quantity: line.quantity,
          unit: p.product?.unit || 'piece',
          unitPrice: p.unitPrice,
          lineTotal: round(p.lineTotal),
          unitCost: p.unitCost,
          lineCost: round(p.unitCost * line.quantity),
          fulfillment: line.fulfillment || 'new',
          ...(line.course ? { course: line.course } : {}),
          ...(p.product?.station ? { station: p.product.station } : {}),
          // Absent means routed. Only the false case is stored, exactly
          // as the real write path does it.
          ...(line.routed === false ? { routed: false } : {}),
          ...(line.firedMinutesAgo ? { firedAt: minsAgo(line.firedMinutesAgo) } : {}),
          ...(line.readyMinutesAgo ? { readyAt: minsAgo(line.readyMinutesAgo) } : {}),
          createdAt: opened,
          updatedAt: opened,
        });
      });
      touched.add('orderLines');
    } else {
      header.kitchenStatus = ticket.kitchenStatus || 'new';
      header.productName = priced.length === 1
        ? priced[0].row.product
        : `${priced[0]?.row.product || 'Order'} +${priced.length - 1} more`;
      header.quantity = priced.reduce((sum, p) => sum + p.row.quantity, 0);
      header.items = priced.map((p) => ({
        productId: p.productId,
        productName: p.row.product,
        quantity: p.row.quantity,
        unitPrice: p.unitPrice,
        basePrice: p.unitPrice,
        costPrice: p.unitCost,
        unit: p.product?.unit || 'piece',
        lineTotal: round(p.lineTotal),
      }));
      seedDoc('orders', ticket.id, header);
    }

    touched.add('orders');
  });
}

function buildAndSeed(profileId) {
  const data = demoDataset(profileId);
  const now = makeTimestamp(Date.now());
  const touched = new Set();

  data.suppliers.forEach((s) => {
    const { id, ...fields } = s;
    seedDoc('suppliers', id, { ...fields, businessId: DEMO_BUSINESS_ID, createdAt: now });
    touched.add('suppliers');
  });

  // A recipe names its components by NAME in the dataset, because a
  // dataset a human edits should not have to carry generated ids. The
  // seed resolves them to the ids it is minting right here, which is the
  // shape a real recipe stores.
  const productIdByName = new Map(
    data.products.map((p, i) => [p.name, `demo_product_${i + 1}`])
  );

  data.products.forEach((p, i) => {
    const id = `demo_product_${i + 1}`;
    const internalCode = `FB-${String(i + 1).padStart(6, '0')}`;
    // `image`, `recipe` and `course` are seed-file concerns; the product
    // document carries the resolved forms the real app renders from.
    const { image, recipe, course, ...fields } = p;
    seedDoc('products', id, {
      ...fields,
      imageUrl: demoPhotoUrl(image),
      ...(Array.isArray(recipe) && recipe.length > 0
        ? {
          recipe: recipe
            .map((line) => ({
              componentId: productIdByName.get(line.componentName) || null,
              componentName: line.componentName,
              quantity: line.quantity,
              ...(line.unit ? { unit: line.unit } : {}),
            }))
            .filter((line) => line.componentId),
          producedInAdvance: false,
        }
        : {}),
      businessId: DEMO_BUSINESS_ID, internalCode, deleted: false, createdAt: now, updatedAt: now,
    });
    // Flat, businessId-prefixed doc id, matching utils/products.js exactly,
    // so a demo-seeded barcode round-trips through the same lookup code a
    // real business's products do. Not every demo row has one: an
    // ingredient is never scanned at a till.
    if (p.barcode) {
      seedDoc('barcodeIndex', `${DEMO_BUSINESS_ID}__${p.barcode}`, { businessId: DEMO_BUSINESS_ID, barcode: p.barcode, productId: id });
      touched.add('barcodeIndex');
    }
    touched.add('products');
  });
  seedDoc('productCodeCounters', DEMO_BUSINESS_ID, { businessId: DEMO_BUSINESS_ID, lastNumber: data.products.length });
  touched.add('productCodeCounters');

  seedOpenTickets(touched, data, productIdByName);

  data.customers.forEach((c) => {
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
    name: data.shopName,
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
    shopName: data.shopName,
    cashierCanRecordExpenses: true,
    // Whatever the trade needs: the industry profile, and for a
    // restaurant its tables, floor plan, kitchen sections, courses and
    // service charge. A shop contributes an empty object here and its
    // settings document is byte for byte what it always was.
    ...data.settings,
    // No category list is seeded. The demo business runs on a real
    // industry profile, and its categories are that profile's — seeding a
    // mixed list here is precisely the fossil that made the Customize
    // page show every trade's categories at once. See
    // src/industry/categories.js.
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

  seedHistory(touched, DEMO_BUSINESS_ID, data);

  seedCommit([...touched]);
}

// The seeded flag means "has this browser already built its local demo
// data?". Bumping the version forces everyone who tried the demo before
// a change to get a fresh reseed rather than silently keeping their old
// dataset forever. v5 adds the trade switch and the restaurant.
const SEEDED_KEY = 'flowbiz_demo_seeded_v5';

export function seedDemoDataIfNeeded() {
  if (localStorage.getItem(SEEDED_KEY) === 'true') return;
  buildAndSeed(demoProfileId());
  localStorage.setItem(SEEDED_KEY, 'true');
}

/**
 * Wipe and rebuild. With no argument it rebuilds the trade this browser
 * is already on, which is what the "Reset demo data" button has always
 * meant. With one, it switches trade and rebuilds as that.
 */
export function resetDemoData(profileId) {
  const next = profileId || demoProfileId();
  rememberProfile(next);
  clearAllDemoData();
  buildAndSeed(next);
  localStorage.setItem(SEEDED_KEY, 'true');
}