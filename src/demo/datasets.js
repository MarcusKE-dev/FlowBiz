// src/demo/datasets.js
//
// THE DEMO'S SAMPLE BUSINESSES, one per trade you can try.
//
// The demo used to be one hard-coded electronics shop, which is a fine
// way to show a counter, a stock list and a report, and no way at all to
// show a kitchen screen, a floor, or a customer display. Somebody
// evaluating FlowBiz for a restaurant saw a shop selling HDMI cables.
//
// So the dataset is now a parameter. `seedData.js` holds the machinery
// (ids, timestamps, seventy days of generated history) and this file
// holds the CONTENT: what the business is called, what it sells, who
// supplies it, and which settings its trade needs. Adding a third trade
// later is a new entry here and nothing else.
//
// WHAT EVERY DATASET MUST PROVIDE is documented on SHOP below, because
// that one is the original and is the reference for the shape.
//
// PHOTOS. A product's `image` is a slug, and the seed resolves it to
// `public/product-photos/<slug>.webp`. A file that is not there yet falls
// back to the neutral icon and nothing breaks, so a dataset can ship
// before its photographs do. See the README in that folder.

// ── Shop: the original demo, unchanged ───────────────────────────────

const SHOP = {
  id: 'GENERAL_RETAIL',
  label: 'General shop',
  blurb: 'An electronics counter with stock, suppliers, credit customers and ten weeks of trading.',
  shopName: 'FlowBiz Demo Store',

  // Written onto businessSettings. `industryProfile` is absent here on
  // purpose: General Retail IS the default, and seeding the default
  // explicitly would be the only copy of it outside industry/profiles.js.
  settings: {},

  suppliers: [
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
  ],

  // The 17th is deliberately at zero stock so Inventory Intelligence's
  // "Critical Stockout" insight has something real to show.
  products: [
    { name: 'Wireless Mouse',            category: 'Electronics', costPrice: 650,   sellingPrice: 950,   stock: 40, lowStockThreshold: 8,  barcode: '6009880123451', supplierId: 'sup_nairobi_electronics', image: 'wireless-mouse' },
    { name: 'Mechanical Keyboard',       category: 'Electronics', costPrice: 2800,  sellingPrice: 3999,  stock: 15, lowStockThreshold: 5,  barcode: '6009880123452', supplierId: 'sup_techhub', image: 'mechanical-keyboard' },
    { name: 'USB Flash Disk 32GB',       category: 'Electronics', costPrice: 350,   sellingPrice: 599,   stock: 60, lowStockThreshold: 10, barcode: '6009880123453', supplierId: 'sup_nairobi_electronics', image: 'usb-flash-disk-32gb' },
    { name: 'External Hard Drive 1TB',   category: 'Electronics', costPrice: 4200,  sellingPrice: 5499,  stock: 12, lowStockThreshold: 4,  barcode: '6009880123454', supplierId: 'sup_techhub', image: 'external-hard-drive-1tb' },
    { name: 'Power Bank 10000mAh',       category: 'Electronics', costPrice: 1100,  sellingPrice: 1699,  stock: 25, lowStockThreshold: 6,  barcode: '6009880123455', supplierId: 'sup_nairobi_electronics', image: 'power-bank-10000mah' },
    { name: 'USB-C Charger 20W',         category: 'Electronics', costPrice: 550,   sellingPrice: 899,   stock: 4,  lowStockThreshold: 8,  barcode: '6009880123456', supplierId: 'sup_nairobi_electronics', image: 'usb-c-charger-20w' },
    { name: 'Phone Charger (Micro-USB)', category: 'Electronics', costPrice: 300,   sellingPrice: 549,   stock: 3,  lowStockThreshold: 8,  barcode: '6009880123457', supplierId: 'sup_nairobi_electronics', image: 'phone-charger-micro-usb' },
    { name: 'HDMI Cable 1.5m',           category: 'Electronics', costPrice: 250,   sellingPrice: 449,   stock: 30, lowStockThreshold: 6,  barcode: '6009880123458', supplierId: 'sup_nairobi_electronics', image: 'hdmi-cable-1-5m' },
    { name: 'Monitor 24" LED',           category: 'Electronics', costPrice: 12500, sellingPrice: 15999, stock: 6,  lowStockThreshold: 3,  barcode: '6009880123459', supplierId: 'sup_techhub', image: 'monitor-24-led' },
    { name: 'Laptop Stand',              category: 'Electronics', costPrice: 900,   sellingPrice: 1450,  stock: 18, lowStockThreshold: 5,  barcode: '6009880123460', supplierId: 'sup_techhub', image: 'laptop-stand' },
    { name: 'Bluetooth Speaker',         category: 'Electronics', costPrice: 1800,  sellingPrice: 2699,  stock: 2,  lowStockThreshold: 5,  barcode: '6009880123461', supplierId: 'sup_techhub', image: 'bluetooth-speaker' },
    { name: 'Earbuds (Wireless)',        category: 'Electronics', costPrice: 1200,  sellingPrice: 1899,  stock: 22, lowStockThreshold: 6,  barcode: '6009880123462', supplierId: 'sup_nairobi_electronics', image: 'earbuds-wireless' },
    { name: 'Headphones (Over-ear)',     category: 'Electronics', costPrice: 2200,  sellingPrice: 3299,  stock: 10, lowStockThreshold: 4,  barcode: '6009880123463', supplierId: 'sup_techhub', image: 'headphones-over-ear' },
    { name: 'Extension Cable (4-way)',   category: 'Electronics', costPrice: 700,   sellingPrice: 1099,  stock: 20, lowStockThreshold: 5,  barcode: '6009880123464', supplierId: 'sup_nairobi_electronics', image: 'extension-cable-4-way' },
    { name: 'Router (Wireless N)',       category: 'Electronics', costPrice: 2600,  sellingPrice: 3599,  stock: 9,  lowStockThreshold: 4,  barcode: '6009880123465', supplierId: 'sup_techhub', image: 'router-wireless-n' },
    { name: 'Smart Watch',               category: 'Electronics', costPrice: 3500,  sellingPrice: 4999,  stock: 7,  lowStockThreshold: 3,  barcode: '6009880123466', supplierId: 'sup_techhub', image: 'smart-watch' },
    { name: 'Wireless Charging Pad',     category: 'Electronics', costPrice: 950,   sellingPrice: 1499,  stock: 0,  lowStockThreshold: 5,  barcode: '6009880123467', supplierId: 'sup_techhub', image: 'wireless-charging-pad' },
  ],

  customers: [
    { id: 'demo_cust_1', name: 'John Kamau',    phone: '0722334455' },
    { id: 'demo_cust_2', name: 'Grace Wanjiru', phone: '0711223344' },
    { id: 'demo_cust_3', name: 'Peter Otieno',  phone: '0733445566' },
    { id: 'demo_cust_4', name: 'Mary Njeri',    phone: '0700112233' },
    { id: 'demo_cust_5', name: 'Samuel Kiprop', phone: '0745667788' },
  ],

  // Given ZERO sales anywhere in the history, so Inventory Intelligence's
  // "Slow-Moving Stock" section has real, consistent examples.
  slow: ['Router (Wireless N)', 'Smart Watch', 'Monitor 24" LED'],
  // Given EXTRA sales weight. Combined with their low starting stock this
  // gives "Reorder Priority" real fast movers that are genuinely running
  // out, rather than low stock with no signal either way.
  hot: ['USB-C Charger 20W', 'Phone Charger (Micro-USB)', 'Wireless Mouse', 'USB Flash Disk 32GB'],

  expenses: [
    ['Rent', 15000], ['Electricity', 2500], ['Transport', 800], ['Wages', 8000],
    ['Airtime Float', 1000], ['Shop Supplies', 1200], ['Security', 1500], ['Other', 600],
  ],

  openTickets: [],
};

// ── Restaurant ───────────────────────────────────────────────────────
//
// A sit-down grill on Ngong Road: eight tables across two zones, three
// kitchen sections, three courses, and a menu built the way the F&B
// engine expects one to be built.
//
// WHAT MAKES THIS DATASET WORTH HAVING, and what a flat list of dishes
// would not show:
//
//   INGREDIENTS ARE REAL ROWS. Beef, buns, cheese and potatoes carry
//   `catalogRole: 'ingredient'`, so they are stocked, counted, costed and
//   wasted, and never appear on the till. That one field is the whole
//   difference between a menu and a menu that knows what it costs.
//
//   DISHES ARE COSTED FROM THEIR RECIPES. Every made-to-order item has
//   `costPrice: 0` and a recipe, exactly as a real one should, so the
//   counter computes its margin at the moment it is rung.
//
//   THREE TICKETS ARE ALREADY OPEN, at three different stages. Without
//   them the kitchen screen, the floor and the customer display all open
//   empty, which is the one thing a demo must never do.

const RESTAURANT = {
  id: 'RESTAURANT',
  label: 'Restaurant',
  blurb: 'A grill with tables, a kitchen screen, recipes costed from ingredients, and orders already running.',
  shopName: 'Ngong Road Grill',

  settings: {
    industryProfile: 'RESTAURANT',
    tables: [
      'Table 1', 'Table 2', 'Table 3', 'Table 4',
      'Table 5', 'Table 6', 'Terrace 1', 'Terrace 2',
    ],
    floorPlan: [
      { name: 'Table 1',   x: 0, y: 0, seats: 4, zone: 'Main hall' },
      { name: 'Table 2',   x: 1, y: 0, seats: 4, zone: 'Main hall' },
      { name: 'Table 3',   x: 2, y: 0, seats: 2, zone: 'Main hall' },
      { name: 'Table 4',   x: 0, y: 1, seats: 6, zone: 'Main hall' },
      { name: 'Table 5',   x: 1, y: 1, seats: 2, zone: 'Main hall' },
      { name: 'Table 6',   x: 2, y: 1, seats: 4, zone: 'Main hall' },
      { name: 'Terrace 1', x: 5, y: 0, seats: 4, zone: 'Terrace' },
      { name: 'Terrace 2', x: 5, y: 1, seats: 6, zone: 'Terrace' },
    ],
    stations: [
      { id: 'grill', name: 'Grill' },
      { id: 'cold',  name: 'Cold section' },
      { id: 'bar',   name: 'Bar' },
    ],
    courses: [
      { id: 'starters', name: 'Starters' },
      { id: 'mains',    name: 'Mains' },
      { id: 'dessert',  name: 'Dessert' },
    ],
    serviceChargeRate: 10,
  },

  suppliers: [
    {
      id: 'sup_mama_mboga',
      name: 'Soko Fresh Produce',
      contactPerson: 'Alice Mutindi',
      phone: '0722 118 340',
      email: 'orders@sokofresh.co.ke',
      address: 'Marikiti Market, Nairobi',
      notes: 'Vegetables and salad, delivered every morning before nine.',
    },
    {
      id: 'sup_butchery',
      name: 'Ngong Road Butchery',
      contactPerson: 'Joseph Kariuki',
      phone: '0733 907 214',
      email: 'sales@ngongbutchery.co.ke',
      address: 'Ngong Road, Nairobi',
      notes: 'Beef, chicken and goat. Order by six the evening before.',
    },
    {
      id: 'sup_drinks',
      name: 'Highland Beverages',
      contactPerson: 'Faith Chebet',
      phone: '0711 662 890',
      email: 'trade@highlandbev.co.ke',
      address: 'Industrial Area, Nairobi',
      notes: 'Sodas and water, weekly on a returnable crate account.',
    },
  ],

  products: [
    // ── Ingredients. Stocked and costed, never on the till. ──────────
    { name: 'Beef mince',        category: 'Ingredients', unit: 'kilogram', costPrice: 620, sellingPrice: 0, stock: 14.5, lowStockThreshold: 4, catalogRole: 'ingredient', supplierId: 'sup_butchery',   image: 'beef-mince' },
    { name: 'Chicken breast',    category: 'Ingredients', unit: 'kilogram', costPrice: 540, sellingPrice: 0, stock: 11,   lowStockThreshold: 4, catalogRole: 'ingredient', supplierId: 'sup_butchery',   image: 'chicken-breast' },
    { name: 'Burger bun',        category: 'Ingredients', unit: 'piece',    costPrice: 25,  sellingPrice: 0, stock: 180,  lowStockThreshold: 40, catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'burger-bun' },
    { name: 'Cheddar slice',     category: 'Ingredients', unit: 'piece',    costPrice: 18,  sellingPrice: 0, stock: 240,  lowStockThreshold: 50, catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'cheddar-slice' },
    { name: 'Potatoes',          category: 'Ingredients', unit: 'kilogram', costPrice: 90,  sellingPrice: 0, stock: 46,   lowStockThreshold: 10, catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'potatoes' },
    { name: 'Cooking oil',       category: 'Ingredients', unit: 'litre',    costPrice: 340, sellingPrice: 0, stock: 18,   lowStockThreshold: 5,  catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'cooking-oil' },
    { name: 'Lettuce',           category: 'Ingredients', unit: 'kilogram', costPrice: 150, sellingPrice: 0, stock: 5.5,  lowStockThreshold: 2,  catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'lettuce' },
    { name: 'Tomatoes',          category: 'Ingredients', unit: 'kilogram', costPrice: 120, sellingPrice: 0, stock: 8,    lowStockThreshold: 3,  catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'tomatoes' },
    { name: 'Rice',              category: 'Ingredients', unit: 'kilogram', costPrice: 165, sellingPrice: 0, stock: 32,   lowStockThreshold: 8,  catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'rice' },
    { name: 'Ugali flour',       category: 'Ingredients', unit: 'kilogram', costPrice: 85,  sellingPrice: 0, stock: 24,   lowStockThreshold: 6,  catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'ugali-flour' },
    { name: 'Tea leaves',        category: 'Ingredients', unit: 'kilogram', costPrice: 900, sellingPrice: 0, stock: 2.4,  lowStockThreshold: 1, catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'tea-leaves' },
    { name: 'Milk',              category: 'Ingredients', unit: 'litre',    costPrice: 90,  sellingPrice: 0, stock: 22,   lowStockThreshold: 6, catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'milk' },
    { name: 'Honey',             category: 'Ingredients', unit: 'litre',    costPrice: 800, sellingPrice: 0, stock: 3,    lowStockThreshold: 1, catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'honey' },
    { name: 'Lemon',             category: 'Ingredients', unit: 'piece',    costPrice: 15,  sellingPrice: 0, stock: 60,   lowStockThreshold: 15, catalogRole: 'ingredient', supplierId: 'sup_mama_mboga', image: 'lemon' },

    // ── The menu. Made to order, so cost comes from the recipe. ──────
    {
      name: 'Cheeseburger', category: 'Main Course', sellingPrice: 850, costPrice: 0, stock: 0,
      station: 'grill', kitchenName: 'Cheeseburger', course: 'mains', image: 'cheeseburger',
      barcode: '6009880220101',
      recipe: [
        { componentName: 'Beef mince',    quantity: 0.18, unit: 'kilogram' },
        { componentName: 'Burger bun',    quantity: 1 },
        { componentName: 'Cheddar slice', quantity: 2 },
        { componentName: 'Lettuce',       quantity: 0.02, unit: 'kilogram' },
      ],
    },
    {
      name: 'Chicken burger', category: 'Main Course', sellingPrice: 790, costPrice: 0, stock: 0,
      station: 'grill', kitchenName: 'Chicken burger', course: 'mains', image: 'chicken-burger',
      barcode: '6009880220102',
      recipe: [
        { componentName: 'Chicken breast', quantity: 0.16, unit: 'kilogram' },
        { componentName: 'Burger bun',     quantity: 1 },
        { componentName: 'Lettuce',        quantity: 0.03, unit: 'kilogram' },
      ],
    },
    {
      name: 'Nyama choma platter', category: 'Grill', sellingPrice: 1450, costPrice: 0, stock: 0,
      station: 'grill', kitchenName: 'Choma platter, half kilo', course: 'mains', image: 'nyama-choma',
      barcode: '6009880220103',
      recipe: [
        { componentName: 'Beef mince',  quantity: 0.5, unit: 'kilogram' },
        { componentName: 'Ugali flour', quantity: 0.2, unit: 'kilogram' },
        { componentName: 'Tomatoes',    quantity: 0.1, unit: 'kilogram' },
      ],
    },
    {
      name: 'Grilled chicken quarter', category: 'Grill', sellingPrice: 950, costPrice: 0, stock: 0,
      station: 'grill', kitchenName: 'Chicken quarter', course: 'mains', image: 'grilled-chicken',
      barcode: '6009880220104',
      recipe: [
        { componentName: 'Chicken breast', quantity: 0.3, unit: 'kilogram' },
        { componentName: 'Cooking oil',    quantity: 0.02, unit: 'litre' },
      ],
    },
    {
      name: 'Pilau', category: 'Main Course', sellingPrice: 620, costPrice: 0, stock: 0,
      station: 'grill', course: 'mains', image: 'pilau', barcode: '6009880220105',
      recipe: [
        { componentName: 'Rice',       quantity: 0.22, unit: 'kilogram' },
        { componentName: 'Beef mince', quantity: 0.09, unit: 'kilogram' },
        { componentName: 'Cooking oil', quantity: 0.03, unit: 'litre' },
      ],
    },
    {
      name: 'Chips', category: 'Sides', sellingPrice: 300, costPrice: 0, stock: 0,
      station: 'grill', course: 'mains', image: 'chips', barcode: '6009880220106',
      recipe: [
        { componentName: 'Potatoes',    quantity: 0.25, unit: 'kilogram' },
        { componentName: 'Cooking oil', quantity: 0.05, unit: 'litre' },
      ],
    },
    {
      name: 'Ugali', category: 'Sides', sellingPrice: 150, costPrice: 0, stock: 0,
      station: 'grill', course: 'mains', image: 'ugali', barcode: '6009880220107',
      recipe: [{ componentName: 'Ugali flour', quantity: 0.18, unit: 'kilogram' }],
    },
    {
      name: 'Garden salad', category: 'Salads', sellingPrice: 450, costPrice: 0, stock: 0,
      station: 'cold', course: 'starters', image: 'garden-salad', barcode: '6009880220108',
      recipe: [
        { componentName: 'Lettuce',  quantity: 0.12, unit: 'kilogram' },
        { componentName: 'Tomatoes', quantity: 0.08, unit: 'kilogram' },
      ],
    },
    {
      name: 'Kachumbari', category: 'Starters', sellingPrice: 200, costPrice: 0, stock: 0,
      station: 'cold', course: 'starters', image: 'kachumbari', barcode: '6009880220109',
      recipe: [{ componentName: 'Tomatoes', quantity: 0.15, unit: 'kilogram' }],
    },
    {
      name: 'Soup of the day', category: 'Starters', sellingPrice: 350, costPrice: 0, stock: 0,
      station: 'grill', course: 'starters', image: 'soup-of-the-day', barcode: '6009880220110',
      recipe: [
        { componentName: 'Chicken breast', quantity: 0.06, unit: 'kilogram' },
        { componentName: 'Tomatoes',       quantity: 0.05, unit: 'kilogram' },
      ],
    },

    // ── Bought in. Real stock, real cost, and never fired to a pass. ──
    { name: 'Coca-Cola 500ml', category: 'Soft Drinks', sellingPrice: 150, costPrice: 70,  stock: 96, lowStockThreshold: 24, routable: false, station: 'bar', barcode: '6009880220111', supplierId: 'sup_drinks', image: 'coca-cola' },
    { name: 'Fanta 500ml',     category: 'Soft Drinks', sellingPrice: 150, costPrice: 70,  stock: 72, lowStockThreshold: 24, routable: false, station: 'bar', barcode: '6009880220112', supplierId: 'sup_drinks', image: 'fanta' },
    { name: 'Water 500ml',     category: 'Soft Drinks', sellingPrice: 100, costPrice: 40,  stock: 120, lowStockThreshold: 30, routable: false, station: 'bar', barcode: '6009880220113', supplierId: 'sup_drinks', image: 'water' },
    {
      name: 'Dawa', category: 'Hot Drinks', sellingPrice: 250, costPrice: 0, stock: 0,
      station: 'bar', course: 'starters', image: 'dawa', barcode: '6009880220114',
      recipe: [
        { componentName: 'Honey', quantity: 0.03, unit: 'litre' },
        { componentName: 'Lemon', quantity: 1 },
      ],
    },
    {
      name: 'Kenyan tea', category: 'Hot Drinks', sellingPrice: 120, costPrice: 0, stock: 0,
      station: 'bar', course: 'starters', image: 'kenyan-tea', barcode: '6009880220115',
      recipe: [
        { componentName: 'Tea leaves', quantity: 0.008, unit: 'kilogram' },
        { componentName: 'Milk',       quantity: 0.15,  unit: 'litre' },
      ],
    },
    { name: 'Chocolate cake',  category: 'Desserts',    sellingPrice: 400, costPrice: 160, stock: 14, lowStockThreshold: 4, routable: false, station: 'cold', course: 'dessert', barcode: '6009880220116', image: 'chocolate-cake' },
    { name: 'Fruit salad',     category: 'Desserts',    sellingPrice: 300, costPrice: 110, stock: 9,  lowStockThreshold: 3, routable: false, station: 'cold', course: 'dessert', barcode: '6009880220117', image: 'fruit-salad' },
  ],

  customers: [
    { id: 'demo_cust_1', name: 'John Kamau',      phone: '0722334455' },
    { id: 'demo_cust_2', name: 'Grace Wanjiru',   phone: '0711223344' },
    { id: 'demo_cust_3', name: 'Peter Otieno',    phone: '0733445566' },
    { id: 'demo_cust_4', name: 'Mary Njeri',      phone: '0700112233' },
    { id: 'demo_cust_5', name: 'Corporate lunch account', phone: '0745667788' },
  ],

  slow: ['Fruit salad', 'Kenyan tea', 'Kachumbari'],
  hot: ['Cheeseburger', 'Chips', 'Nyama choma platter', 'Coca-Cola 500ml'],

  expenses: [
    ['Rent', 45000], ['Electricity', 9500], ['Gas', 6000], ['Wages', 38000],
    ['Cleaning', 2200], ['Licences', 3500], ['Transport', 1800], ['Other', 1200],
  ],

  // ── Three tickets, already open ──────────────────────────────────
  //
  // Deliberately TWO SHAPES. `array` is what Counter.jsx writes today:
  // one document with an `items` list and a single kitchenStatus. `lines`
  // is the one-document-per-line model the F&B engine was built for.
  // Seeding both means the demo shows what every screen actually does
  // with the data it will really meet, including the whole-ticket
  // fallback on the kitchen screen.
  openTickets: [
    {
      id: 'demo_ticket_terrace1',
      model: 'array',
      table: 'Terrace 1',
      diningMode: 'dine-in',
      minutesAgo: 24,
      kitchenStatus: 'ready',
      items: [
        { product: 'Nyama choma platter', quantity: 1 },
        { product: 'Ugali', quantity: 2 },
        { product: 'Coca-Cola 500ml', quantity: 2 },
      ],
    },
    {
      id: 'demo_ticket_table3',
      model: 'array',
      table: 'Table 3',
      diningMode: 'dine-in',
      minutesAgo: 11,
      kitchenStatus: 'preparing',
      items: [
        { product: 'Cheeseburger', quantity: 2 },
        { product: 'Chips', quantity: 2 },
        { product: 'Water 500ml', quantity: 2 },
      ],
    },
    {
      id: 'demo_ticket_table6',
      model: 'lines',
      table: 'Table 6',
      diningMode: 'dine-in',
      minutesAgo: 6,
      lines: [
        { product: 'Garden salad',    quantity: 2, fulfillment: 'ready', course: 'starters', firedMinutesAgo: 5, readyMinutesAgo: 1 },
        { product: 'Grilled chicken quarter', quantity: 2, fulfillment: 'sent', course: 'mains', firedMinutesAgo: 4 },
        { product: 'Fanta 500ml',     quantity: 2, fulfillment: 'ready', routed: false, readyMinutesAgo: 6 },
        { product: 'Chocolate cake',  quantity: 1, fulfillment: 'new',   course: 'dessert' },
      ],
    },
  ],
};

// ── The catalogue of trades you can try ──────────────────────────────

export const DEMO_DATASETS = { GENERAL_RETAIL: SHOP, RESTAURANT };

export const DEMO_PROFILE_IDS = Object.keys(DEMO_DATASETS);

export const DEFAULT_DEMO_PROFILE = 'GENERAL_RETAIL';

export function demoDataset(profileId) {
  return DEMO_DATASETS[profileId] || DEMO_DATASETS[DEFAULT_DEMO_PROFILE];
}

/**
 * What a dish costs, for the seeded HISTORY only.
 *
 * A made-to-order dish stores `costPrice: 0` and computes its real cost
 * from its recipe at the moment it is rung, which is correct and is what
 * the live counter does. The seeded history has no counter to run, so
 * without this every demo sale of a dish would report a 100% margin and
 * the whole reporting story would be a fiction.
 *
 * Resolved from the recipe against the dataset's own ingredient rows, so
 * it stays right when a price or a quantity here changes.
 */
export function demoHistoryCost(product, dataset) {
  if (!Array.isArray(product?.recipe) || product.recipe.length === 0) {
    return Number(product?.costPrice) || 0;
  }
  const byName = new Map((dataset?.products || []).map((p) => [p.name, p]));
  let total = 0;
  for (const line of product.recipe) {
    const component = byName.get(line.componentName);
    if (!component) continue;
    total += (Number(component.costPrice) || 0) * (Number(line.quantity) || 0);
  }
  return Math.round(total * 100) / 100;
}
