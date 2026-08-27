// src/demo/seedData.js
import { seedDoc, seedCommit, clearAllDemoData, makeTimestamp } from './localFirestore';
import { DEMO_UID } from './localAuth';
import { todayKey } from '../utils/dateRanges';

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
];

function buildAndSeed() {
  const now = makeTimestamp(Date.now());
  const touched = new Set();
  const today = todayKey();

  SUPPLIERS.forEach((s) => {
    const { id, ...data } = s;
    seedDoc('suppliers', id, { ...data, businessId: DEMO_BUSINESS_ID, createdAt: now });
    touched.add('suppliers');
  });

  PRODUCTS.forEach((p, i) => {
    const id = `demo_product_${i + 1}`;
    const internalCode = `FB-${String(i + 1).padStart(6, '0')}`;
    seedDoc('products', id, { ...p, businessId: DEMO_BUSINESS_ID, internalCode, deleted: false, createdAt: now, updatedAt: now });
    seedDoc('barcodeIndex', `${DEMO_BUSINESS_ID}__${p.barcode}`, { businessId: DEMO_BUSINESS_ID, barcode: p.barcode, productId: id });
    touched.add('products');
    touched.add('barcodeIndex');
  });
  seedDoc('productCodeCounters', DEMO_BUSINESS_ID, { businessId: DEMO_BUSINESS_ID, lastNumber: PRODUCTS.length });
  touched.add('productCodeCounters');

  seedDoc('businesses', DEMO_BUSINESS_ID, {
    name: 'FlowBiz Demo Store',
    ownerIds: [DEMO_UID],
    createdAt: now,
    createdBy: DEMO_UID,
    subscription: { plan: 'free', status: 'active', expiry: null },
  });
  touched.add('businesses');

  seedDoc('users', DEMO_UID, {
    uid: DEMO_UID, email: 'demo@flowbiz.app', displayName: 'Demo Owner',
    role: 'owner', businessId: DEMO_BUSINESS_ID, active: true, createdAt: now,
  });
  touched.add('users');

  seedDoc('businessSettings', DEMO_BUSINESS_ID, {
    shopName: 'FlowBiz Demo Store',
    cashierCanRecordExpenses: true,
    categories: ['Groceries', 'Beverages', 'Electronics', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other'],
  });
  touched.add('businessSettings');

  // Pre-seed an open shift session for today so Counter opens immediately
  seedDoc('dailySessions', `${DEMO_BUSINESS_ID}_${today}`, {
    businessId: DEMO_BUSINESS_ID,
    date: today,
    openingCashFloat: 2000,
    openingMpesaFloat: 5000,
    openedBy: DEMO_UID,
    openedAt: now,
    closedAt: null,
    closedBy: null,
  });
  touched.add('dailySessions');

  seedCommit([...touched]);
}

export function seedDemoDataIfNeeded() {
  const today = todayKey();
  const sessionDocId = `${DEMO_BUSINESS_ID}_${today}`;
  if (localStorage.getItem('flowbiz_demo_seeded_v3') === 'true') {
    // Ensure today's session is always open even across calendar days
    seedDoc('dailySessions', sessionDocId, {
      businessId: DEMO_BUSINESS_ID,
      date: today,
      openingCashFloat: 2000,
      openingMpesaFloat: 5000,
      openedBy: DEMO_UID,
      openedAt: makeTimestamp(Date.now()),
      closedAt: null,
      closedBy: null,
    });
    seedCommit(['dailySessions']);
    return;
  }
  buildAndSeed();
  localStorage.setItem('flowbiz_demo_seeded_v3', 'true');
}

export function resetDemoData() {
  clearAllDemoData();
  buildAndSeed();
  localStorage.setItem('flowbiz_demo_seeded_v3', 'true');
}