import { useState, useMemo } from 'react';
import { 
  ShoppingCart, 
  LayoutDashboard, 
  Users, 
  Boxes, 
  Lock, 
  Banknote, 
  Smartphone, 
  BookOpen, 
  Plus, 
  Minus, 
  CheckCircle2, 
  ScanLine, 
  Printer, 
  X,
  Wifi,
  MessageCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  ArrowUpRight,
  TrendingUp,
  Percent
} from 'lucide-react';

const INITIAL_PRODUCTS = [
  { id: '1', name: 'Wireless Mouse 2.4G', category: 'Electronics', price: 950, cost: 650, stock: 38, barcode: '600101' },
  { id: '2', name: 'USB Flash Disk 32GB', category: 'Accessories', price: 599, cost: 350, stock: 54, barcode: '600102' },
  { id: '3', name: 'USB-C Fast Charger 20W', category: 'Power', price: 899, cost: 550, stock: 4, barcode: '600103' },
  { id: '4', name: 'HDMI Cable 1.5m Gold', category: 'Cables', price: 449, cost: 250, stock: 26, barcode: '600104' },
  { id: '5', name: 'Bluetooth Earbuds Bass', category: 'Audio', price: 1899, cost: 1200, stock: 19, barcode: '600105' },
  { id: '6', name: 'Laptop Cooling Stand', category: 'Accessories', price: 1450, cost: 900, stock: 12, barcode: '600106' },
  { id: '7', name: 'Original iPhone Cable', category: 'Cables', price: 750, cost: 400, stock: 3, barcode: '600107' },
  { id: '8', name: 'Extension Socket 4-Way', category: 'Power', price: 1200, cost: 750, stock: 15, barcode: '600108' },
];

const INITIAL_DEBTORS = [
  { id: 'd1', name: 'John Kamau', phone: '+254 722 000 111', location: 'Westlands', balance: 4500, invoice: 'FB-042', item: '2x External HDD', overdueDays: 3 },
  { id: 'd2', name: 'Grace Wanjiku', phone: '+254 711 333 444', location: 'CBD City Market', balance: 1800, invoice: 'FB-051', item: '1x Bluetooth Speaker', overdueDays: 0 },
  { id: 'd3', name: 'David Ochieng', phone: '+254 733 999 888', location: 'Industrial Area', balance: 7200, invoice: 'FB-038', item: '3x Fast Charger Hubs', overdueDays: 12 },
];

export function PosSimulationMockup() {
  const [activeTab, setActiveTab] = useState('counter');
  
  // Products & Inventory State
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // POS Counter Cart State
  const [cart, setCart] = useState([
    { product: INITIAL_PRODUCTS[0], quantity: 2, unitPrice: 950 },
    { product: INITIAL_PRODUCTS[1], quantity: 1, unitPrice: 599 },
  ]);
  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  const [mpesaCode, setMpesaCode] = useState('QWE89412KL');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customerName, setCustomerName] = useState('Peter Mwangi');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState(null);

  // Debtors State
  const [debtors, setDebtors] = useState(INITIAL_DEBTORS);
  const [repayModal, setRepayModal] = useState(null);
  const [repayAmount, setRepayAmount] = useState(1000);
  const [toastMsg, setToastMsg] = useState('');

  // Dashboard Range
  const [timeRange, setTimeRange] = useState('Today');

  // Streamlined Till Reconciliation State (Single inputs)
  const [actualCash, setActualCash] = useState(18500);
  const [actualMpesa, setActualMpesa] = useState(24350);

  const categories = ['All', 'Electronics', 'Accessories', 'Power', 'Cables', 'Audio'];

  // Filtered product catalog
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart actions
  const addItem = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: product.price }];
    });
  };

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const updateUnitPrice = (id, newPrice) => {
    const val = Number(newPrice);
    if (isNaN(val) || val < 0) return;
    setCart((prev) =>
      prev.map((item) => (item.product.id === id ? { ...item, unitPrice: val } : item))
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const totalAmount = subtotal - discountAmount;
  const totalCost = cart.reduce((sum, item) => sum + item.quantity * item.product.cost, 0);
  const estimatedProfit = totalAmount - totalCost;

  const showNotification = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Complete Sale
  const handleCompleteSale = () => {
    const saleData = {
      items: [...cart],
      total: totalAmount,
      method: paymentMethod,
      mpesaCode: paymentMethod === 'M-Pesa' ? mpesaCode : null,
      customer: customerName,
      profit: estimatedProfit,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      invoiceNo: `FB-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    // Deduct inventory
    setProducts((prev) =>
      prev.map((prod) => {
        const cartItem = cart.find((i) => i.product.id === prod.id);
        if (cartItem) {
          return { ...prod, stock: Math.max(0, prod.stock - cartItem.quantity) };
        }
        return prod;
      })
    );

    setLastCompletedSale(saleData);
    setShowReceiptModal(true);
    setCart([]);
  };

  // Restock action in inventory
  const handleRestock = (id, amount = 10) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock: p.stock + amount } : p))
    );
    showNotification(`Restocked +${amount} units successfully`);
  };

  // Debtor repayment
  const handleRecordPayment = () => {
    if (!repayModal) return;
    setDebtors((prev) =>
      prev.map((d) => {
        if (d.id === repayModal.id) {
          const newBal = Math.max(0, d.balance - repayAmount);
          return { ...d, balance: newBal };
        }
        return d;
      })
    );
    showNotification(`Received KES ${repayAmount.toLocaleString()} from ${repayModal.name}`);
    setRepayModal(null);
  };

  // Expected balances
  const expectedCashBalance = 18500;
  const expectedMpesaBalance = 24350;
  const cashVariance = Number(actualCash || 0) - expectedCashBalance;
  const mpesaVariance = Number(actualMpesa || 0) - expectedMpesaBalance;
  const totalVariance = cashVariance + mpesaVariance;

  return (
    <div className="relative mx-auto max-w-5xl text-left">
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-[#1a623c] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="rounded-3xl border border-[#cfd3da] bg-white shadow-xl overflow-hidden flex flex-col">
        
        {/* Top Header Simulation Bar */}
        <div className="bg-[#15171d] text-white px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs font-medium border-b border-[#2b303c] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#1a623c] animate-pulse" />
            <span className="font-bold text-white tracking-wide">FlowBiz Workstation</span>
            <span className="text-[#767f8f] hidden sm:inline">| Main Counter (Shop 01)</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#cfd3da]">
            <span className="flex items-center gap-1">
              <Wifi className="h-3.5 w-3.5 text-[#1a623c]" /> Offline Mode Active
            </span>
            <span className="hidden sm:inline bg-[#2b303c] px-2 py-0.5 rounded text-white font-mono text-[10px]">
              KES Currency
            </span>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="min-h-[500px] bg-[#faf6ef] flex flex-col">
          
          {/* TAB 1: POS COUNTER */}
          {activeTab === 'counter' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#e8eaed] flex-1">
              
              {/* Left Column: Product Catalog */}
              <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col space-y-3">
                
                {/* Search Bar & Category Filter */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-[#767f8f]" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search product or scan barcode (e.g. 600101)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-[#cfd3da] rounded-xl pl-9 pr-8 py-2 text-xs text-[#15171d] placeholder:text-[#8d95a5] focus:border-[#1a623c] focus:outline-hidden shadow-2xs"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#767f8f] hover:text-[#15171d]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 bg-white border border-[#cfd3da] rounded-xl px-3 py-2 text-xs font-semibold text-[#1a623c] shadow-2xs">
                      <ScanLine className="h-3.5 w-3.5" />
                      <span>Scanner</span>
                    </div>
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                          selectedCategory === cat
                            ? 'bg-[#1a623c] text-white shadow-xs'
                            : 'bg-white border border-[#cfd3da] text-[#5a6273] hover:text-[#15171d]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Cards Grid with Fixed Badge Alignment */}
                <div className="flex-1 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pb-2">
                    {filteredProducts.map((prod) => {
                      const inCart = cart.find((i) => i.product.id === prod.id);
                      const isLow = prod.stock <= 5;
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => addItem(prod)}
                          className={`relative text-left p-3 rounded-2xl border transition-all flex flex-col justify-between h-32 ${
                            inCart
                              ? 'border-[#1a623c] bg-[#f1faf4] ring-1 ring-[#1a623c] shadow-xs'
                              : 'border-[#cfd3da] bg-white hover:border-[#1a623c] hover:bg-[#fbf7f2]'
                          }`}
                        >
                          {/* Inside Top Right Quantity Badge (Never Half Clipped) */}
                          {inCart && (
                            <div className="absolute top-2 right-2 min-w-5 h-5 px-1.5 rounded-full bg-[#1a623c] text-white text-[11px] font-black flex items-center justify-center shadow-xs">
                              {inCart.quantity}
                            </div>
                          )}

                          <div>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-[#767f8f] uppercase mb-1">
                              <span className="truncate max-w-[70px]">{prod.category}</span>
                              <span className="font-mono text-[9px] bg-[#faf6ef] px-1 rounded">{prod.barcode}</span>
                            </div>
                            <span className="text-xs font-bold text-[#15171d] block line-clamp-2 leading-snug pr-4">
                              {prod.name}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-[#e8eaed]">
                            <span className="text-xs font-black text-[#1a623c]">
                              KES {prod.price.toLocaleString()}
                            </span>
                            <span className={`text-[10px] font-semibold ${isLow ? 'text-[#c4441d] bg-[#fdf4ef] px-1 rounded' : 'text-[#767f8f]'}`}>
                              {isLow ? `Low (${prod.stock})` : `${prod.stock} left`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {filteredProducts.length === 0 && (
                    <div className="py-12 text-center text-xs text-[#767f8f]">
                      No products found matching &ldquo;{searchQuery}&rdquo;.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Cart & Direct Sale Controls */}
              <div className="lg:col-span-5 bg-white p-4 sm:p-5 flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  
                  {/* Cart Header */}
                  <div className="flex items-center justify-between border-b border-[#e8eaed] pb-2">
                    <div className="flex items-center gap-1.5">
                      <ShoppingCart className="h-4 w-4 text-[#1a623c]" />
                      <span className="text-xs sm:text-sm font-bold text-[#15171d]">
                        Current Sale ({cart.length} items)
                      </span>
                    </div>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCart([])}
                        className="text-[11px] font-semibold text-[#c4441d] hover:underline"
                      >
                        Clear Cart
                      </button>
                    )}
                  </div>

                  {/* Cart Item Rows */}
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {cart.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#767f8f] bg-[#faf6ef] rounded-xl border border-dashed border-[#cfd3da]">
                        Cart is empty. Tap products on the left to add.
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div
                          key={item.product.id}
                          className="p-2 rounded-xl border border-[#e8eaed] bg-[#faf6ef] space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-[#15171d]">
                            <span className="truncate pr-1">{item.product.name}</span>
                            <span className="text-[#1a623c] font-bold shrink-0">
                              KES {(item.quantity * item.unitPrice).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs gap-2">
                            {/* Quantity Adjuster */}
                            <div className="flex items-center gap-1 bg-white border border-[#cfd3da] rounded-lg px-1.5 py-0.5 shrink-0">
                              <button type="button" onClick={() => updateQty(item.product.id, -1)} aria-label="Decrease">
                                <Minus className="h-3 w-3 text-[#5a6273]" />
                              </button>
                              <span className="font-bold text-[#15171d] px-1 text-xs">{item.quantity}</span>
                              <button type="button" onClick={() => updateQty(item.product.id, 1)} aria-label="Increase">
                                <Plus className="h-3 w-3 text-[#5a6273]" />
                              </button>
                            </div>

                            {/* Editable Unit Price */}
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="text-[#767f8f]">@ KES</span>
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => updateUnitPrice(item.product.id, e.target.value)}
                                className="w-16 bg-white border border-[#cfd3da] rounded px-1 py-0.5 text-xs font-bold text-[#15171d] text-right"
                                title="Edit unit price (Bargaining)"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Promo Discount Toggle */}
                  <div className="flex items-center justify-between pt-1 text-[11px] border-t border-[#e8eaed]">
                    <span className="text-[#767f8f] font-semibold flex items-center gap-1">
                      <Percent className="h-3 w-3 text-[#1a623c]" /> Discount:
                    </span>
                    <div className="flex gap-1">
                      {[0, 5, 10].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDiscountPercent(pct)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            discountPercent === pct
                              ? 'bg-[#1a623c] text-white border-[#1a623c]'
                              : 'bg-[#faf6ef] border-[#cfd3da] text-[#5a6273]'
                          }`}
                        >
                          {pct === 0 ? 'None' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#767f8f] block">
                      Tender Payment Method
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Cash')}
                        className={`py-1.5 px-1 text-xs font-bold rounded-xl border flex flex-col items-center gap-0.5 transition-all ${
                          paymentMethod === 'Cash'
                            ? 'border-[#1a623c] bg-[#f1faf4] text-[#1a623c] shadow-2xs'
                            : 'border-[#cfd3da] text-[#5a6273]'
                        }`}
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        <span>Cash</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('M-Pesa')}
                        className={`py-1.5 px-1 text-xs font-bold rounded-xl border flex flex-col items-center gap-0.5 transition-all ${
                          paymentMethod === 'M-Pesa'
                            ? 'border-[#1a623c] bg-[#f1faf4] text-[#1a623c] shadow-2xs'
                            : 'border-[#cfd3da] text-[#5a6273]'
                        }`}
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        <span>M-Pesa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Credit')}
                        className={`py-1.5 px-1 text-xs font-bold rounded-xl border flex flex-col items-center gap-0.5 transition-all ${
                          paymentMethod === 'Credit'
                            ? 'border-[#c4441d] bg-[#fdf4ef] text-[#c4441d] shadow-2xs'
                            : 'border-[#cfd3da] text-[#5a6273]'
                        }`}
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Deni</span>
                      </button>
                    </div>
                  </div>

                  {paymentMethod === 'M-Pesa' && (
                    <div className="bg-[#f1faf4] border border-[#bbe6c9] rounded-xl p-2 space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-[#1a623c]">
                        <span>M-Pesa Till Code</span>
                        <button
                          type="button"
                          onClick={() => setMpesaCode(`QWE${Math.floor(10000 + Math.random() * 90000)}`)}
                          className="hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="h-2.5 w-2.5" /> Gen New
                        </button>
                      </div>
                      <input
                        type="text"
                        value={mpesaCode}
                        onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                        className="w-full bg-white border border-[#bbe6c9] rounded-lg px-2.5 py-1 text-xs font-mono font-bold uppercase text-[#15171d]"
                      />
                    </div>
                  )}

                  {paymentMethod === 'Credit' && (
                    <div className="bg-[#fdf4ef] border border-[#f6c8ae] rounded-xl p-2 space-y-1">
                      <label className="text-[10px] font-bold uppercase text-[#c4441d] block">
                        Customer Ledger Account (Deni)
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-white border border-[#f6c8ae] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#15171d]"
                      />
                    </div>
                  )}
                </div>

                {/* Total & Complete Sale Button */}
                <div className="pt-2 border-t border-[#e8eaed] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-[#767f8f] block">Amount Payable</span>
                      <span className="text-[10px] text-[#1a623c] font-bold">
                        Profit Margin: +KES {estimatedProfit.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xl font-black text-[#1a623c]">
                      KES {totalAmount.toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={handleCompleteSale}
                    className="w-full bg-[#1a623c] text-white py-2.5 rounded-xl font-bold hover:bg-[#144f30] transition-all disabled:opacity-50 shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>Complete Sale ({paymentMethod})</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e8eaed] pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#15171d]">Operational Store Intelligence</h4>
                  <p className="text-xs text-[#767f8f]">Audited financial stats and cashier velocity</p>
                </div>
                {/* Time Range Toggle */}
                <div className="flex gap-1 bg-white border border-[#cfd3da] p-0.5 rounded-xl">
                  {['Today', 'This Week', 'This Month'].map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        timeRange === range
                          ? 'bg-[#1a623c] text-white'
                          : 'text-[#5a6273] hover:text-[#15171d]'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-[#e8eaed] space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[#767f8f] block">Gross Revenue</span>
                  <p className="text-lg font-black text-[#15171d]">
                    {timeRange === 'Today' ? 'KES 42,850.00' : timeRange === 'This Week' ? 'KES 284,500.00' : 'KES 1,142,000.00'}
                  </p>
                  <span className="text-[10px] text-[#1a623c] font-bold flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" /> +18.4% growth
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#e8eaed] space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[#767f8f] block">Realized Profit</span>
                  <p className="text-lg font-black text-[#1a623c]">
                    {timeRange === 'Today' ? 'KES 14,200.00' : timeRange === 'This Week' ? 'KES 98,300.00' : 'KES 392,000.00'}
                  </p>
                  <span className="text-[10px] text-[#767f8f]">Margin: 33.1% clean</span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#e8eaed] space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[#767f8f] block">Debt Recovered</span>
                  <p className="text-lg font-black text-[#363b48]">
                    {timeRange === 'Today' ? 'KES 6,500.00' : timeRange === 'This Week' ? 'KES 38,200.00' : 'KES 145,000.00'}
                  </p>
                  <span className="text-[10px] text-[#1a623c] font-bold">100% Cash flow reconciled</span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#e8eaed] space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[#767f8f] block">M-Pesa vs Cash</span>
                  <p className="text-lg font-black text-[#15171d]">76% M-Pesa</p>
                  <span className="text-[10px] text-[#767f8f]">24% Cash in drawer</span>
                </div>
              </div>

              {/* Cashier Performance */}
              <div className="bg-white p-4 rounded-2xl border border-[#e8eaed] space-y-2.5">
                <span className="text-xs font-bold text-[#15171d] block">Cashier Performance Today</span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#faf6ef]">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#1a623c] text-white flex items-center justify-center font-bold text-[10px]">
                        1
                      </div>
                      <span className="font-bold text-[#15171d]">Sarah M. (Counter 1)</span>
                    </div>
                    <span className="font-extrabold text-[#1a623c]">KES 28,450 (31 sales)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#faf6ef]">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#767f8f] text-white flex items-center justify-center font-bold text-[10px]">
                        2
                      </div>
                      <span className="font-bold text-[#15171d]">Brian K. (Counter 2)</span>
                    </div>
                    <span className="font-bold text-[#5a6273]">KES 14,400 (18 sales)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMERS & DEBT */}
          {activeTab === 'customers' && (
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between border-b border-[#e8eaed] pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#15171d]">Customer Debt (Deni) Ledger</h4>
                  <p className="text-xs text-[#767f8f]">Track credit balances, WhatsApp reminders, and real repayments</p>
                </div>
                <span className="text-xs font-bold text-[#c4441d] bg-[#fdf4ef] px-3 py-1 rounded-xl border border-[#f6c8ae]">
                  Total Outstanding: KES {debtors.reduce((s, d) => s + d.balance, 0).toLocaleString()}
                </span>
              </div>

              {/* Debtors List */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {debtors.map((debtor) => (
                  <div key={debtor.id} className="bg-white p-3.5 rounded-2xl border border-[#e8eaed] space-y-2.5 shadow-2xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#15171d]">{debtor.name}</p>
                        <p className="text-[10px] text-[#767f8f]">{debtor.phone}</p>
                      </div>
                      <span className="bg-[#fdf4ef] text-[#c4441d] border border-[#f6c8ae] text-[10px] font-bold px-2 py-0.5 rounded">
                        Owes KES {debtor.balance.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-[#faf6ef] p-2 rounded-lg text-[11px] space-y-0.5">
                      <div className="flex justify-between text-[#5a6273]">
                        <span>Invoice #{debtor.invoice}:</span>
                        <span className="font-semibold">{debtor.item}</span>
                      </div>
                      <div className="text-[10px] text-[#c4441d] font-semibold">
                        {debtor.overdueDays > 0 ? `${debtor.overdueDays} days overdue` : 'Due today'}
                      </div>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRepayModal(debtor);
                          setRepayAmount(Math.min(1000, debtor.balance));
                        }}
                        disabled={debtor.balance === 0}
                        className="flex-1 text-center py-1.5 border border-[#cfd3da] rounded-lg text-xs font-bold text-[#1a623c] hover:bg-[#f1faf4] disabled:opacity-40"
                      >
                        Record Pay
                      </button>
                      <button
                        type="button"
                        onClick={() => showNotification(`Copied WhatsApp statement for ${debtor.name}`)}
                        className="flex-1 bg-[#1a623c] text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#144f30]"
                      >
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: INVENTORY */}
          {activeTab === 'inventory' && (
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between border-b border-[#e8eaed] pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#15171d]">Inventory Intelligence &amp; Stock Velocity</h4>
                  <p className="text-xs text-[#767f8f]">Interactive ABC valuation and one-tap restock simulations</p>
                </div>
                <span className="text-xs font-bold text-[#15171d] bg-white px-3 py-1 rounded-xl border border-[#cfd3da]">
                  Total Units: {products.reduce((s, p) => s + p.stock, 0)}
                </span>
              </div>

              {/* Actionable Alerts */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#15171d] block">Stockout Velocity Alerts</span>
                {products
                  .filter((p) => p.stock <= 5)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#fdf4ef] border border-[#f6c8ae] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-[#c4441d] shrink-0" />
                        <div>
                          <p className="font-bold text-[#6a261b]">{p.name}</p>
                          <p className="text-[10px] text-[#822b1c]">
                            Only {p.stock} left in stock · Runout in ~2 days
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestock(p.id, 15)}
                        className="bg-[#c4441d] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#a63614] transition-colors"
                      >
                        + Restock 15
                      </button>
                    </div>
                  ))}
              </div>

              {/* Product Stock Table */}
              <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
                <div className="p-3 border-b border-[#e8eaed] flex justify-between items-center text-xs font-bold text-[#15171d]">
                  <span>Product Catalog Valuation</span>
                  <span className="text-[#767f8f] font-normal">Tap &lsquo;+10&rsquo; to test restock velocity</span>
                </div>
                <div className="divide-y divide-[#e8eaed] max-h-48 overflow-y-auto">
                  {products.map((p) => (
                    <div key={p.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-[#15171d]">{p.name}</p>
                        <p className="text-[10px] text-[#767f8f]">Cost: KES {p.cost} · Retail: KES {p.price}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${p.stock <= 5 ? 'text-[#c4441d]' : 'text-[#1a623c]'}`}>
                          {p.stock} units
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRestock(p.id, 10)}
                          className="bg-[#faf6ef] border border-[#cfd3da] hover:border-[#1a623c] px-2 py-1 rounded text-[11px] font-bold text-[#15171d]"
                        >
                          +10
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: STREAMLINED CLOSE DAY (SINGLE CASH & MPESA BALANCE INPUTS) */}
          {activeTab === 'closeday' && (
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between border-b border-[#e8eaed] pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#15171d]">End-of-Day Shift Reconciliation</h4>
                  <p className="text-xs text-[#767f8f]">Enter closing cash and M-Pesa balance to audit shift variance</p>
                </div>
                <span className="text-xs font-bold text-[#1a623c] bg-[#f1faf4] px-3 py-1 rounded-xl border border-[#bbe6c9]">
                  Shift #429 Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Expected System Balances */}
                <div className="bg-white p-4 rounded-2xl border border-[#e8eaed] space-y-2.5 text-xs">
                  <span className="font-bold text-[#15171d] text-sm block">System Calculated Figures</span>
                  <div className="flex justify-between text-[#5a6273]">
                    <span>Morning Cash Float:</span>
                    <span>KES 2,000.00</span>
                  </div>
                  <div className="flex justify-between text-[#5a6273]">
                    <span>+ Cash Sales &amp; Debt Pay:</span>
                    <span>+KES 17,350.00</span>
                  </div>
                  <div className="flex justify-between text-[#c4441d]">
                    <span>− Shop Expenses:</span>
                    <span>−KES 850.00</span>
                  </div>
                  <div className="pt-2 border-t border-[#e8eaed] flex justify-between font-bold text-xs text-[#15171d]">
                    <span>Expected Drawer Cash:</span>
                    <span className="text-[#1a623c]">KES {expectedCashBalance.toLocaleString()}.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs text-[#15171d]">
                    <span>Expected M-Pesa Till:</span>
                    <span className="text-[#1a623c]">KES {expectedMpesaBalance.toLocaleString()}.00</span>
                  </div>
                </div>

                {/* Single Cash and M-Pesa Inputs */}
                <div className="bg-white p-4 rounded-2xl border border-[#e8eaed] space-y-3">
                  <span className="font-bold text-[#15171d] text-xs block">Actual Counted Balances</span>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-bold text-[#5a6273] block mb-1">
                        Actual Physical Cash in Drawer (KES)
                      </label>
                      <input
                        type="number"
                        value={actualCash}
                        onChange={(e) => setActualCash(Number(e.target.value))}
                        className="w-full bg-[#faf6ef] border border-[#cfd3da] rounded-xl px-3 py-2 text-sm font-bold text-[#15171d]"
                        placeholder="e.g. 18500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#5a6273] block mb-1">
                        Actual M-Pesa Till Closing Balance (KES)
                      </label>
                      <input
                        type="number"
                        value={actualMpesa}
                        onChange={(e) => setActualMpesa(Number(e.target.value))}
                        className="w-full bg-[#faf6ef] border border-[#cfd3da] rounded-xl px-3 py-2 text-sm font-bold text-[#15171d]"
                        placeholder="e.g. 24350"
                      />
                    </div>
                  </div>

                  {/* Live Variance Status */}
                  <div
                    className={`p-2.5 rounded-xl flex items-center justify-between text-xs font-bold ${
                      totalVariance === 0
                        ? 'bg-[#f1faf4] border border-[#bbe6c9] text-[#1a623c]'
                        : 'bg-[#fdf4ef] border border-[#f6c8ae] text-[#c4441d]'
                    }`}
                  >
                    <span>Total Variance: KES {totalVariance.toLocaleString()}</span>
                    <span>{totalVariance === 0 ? '✓ Balanced (Zero Loss)' : totalVariance > 0 ? 'Surplus' : 'Shortage'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      showNotification('Shift #429 closed and reconciled successfully!')
                    }
                    className="w-full bg-[#1a623c] text-white py-2 rounded-xl text-xs font-bold hover:bg-[#144f30]"
                  >
                    Lock &amp; Reconcile Shift
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Authentic In-App Bottom Navigation Bar */}
        <div className="bg-white border-t border-[#e8eaed] px-2 sm:px-6 py-2 shrink-0">
          <div className="grid grid-cols-5 gap-1 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => setActiveTab('counter')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                activeTab === 'counter'
                  ? 'bg-[#f1faf4] text-[#1a623c] font-bold'
                  : 'text-[#5a6273] hover:text-[#15171d]'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="text-[10px] truncate">Counter</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-[#f1faf4] text-[#1a623c] font-bold'
                  : 'text-[#5a6273] hover:text-[#15171d]'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="text-[10px] truncate">Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                activeTab === 'customers'
                  ? 'bg-[#f1faf4] text-[#1a623c] font-bold'
                  : 'text-[#5a6273] hover:text-[#15171d]'
              }`}
            >
              <Users className="h-4 w-4" />
              <span className="text-[10px] truncate">Deni (Credit)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                activeTab === 'inventory'
                  ? 'bg-[#f1faf4] text-[#1a623c] font-bold'
                  : 'text-[#5a6273] hover:text-[#15171d]'
              }`}
            >
              <Boxes className="h-4 w-4" />
              <span className="text-[10px] truncate">Inventory</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('closeday')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                activeTab === 'closeday'
                  ? 'bg-[#f1faf4] text-[#1a623c] font-bold'
                  : 'text-[#5a6273] hover:text-[#15171d]'
              }`}
            >
              <Lock className="h-4 w-4" />
              <span className="text-[10px] truncate">Close Day</span>
            </button>
          </div>
        </div>

      </div>

      {/* Record Repayment Modal */}
      {repayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 border border-[#e8eaed] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e8eaed] pb-2">
              <span className="font-bold text-sm text-[#15171d]">Record Repayment: {repayModal.name}</span>
              <button type="button" onClick={() => setRepayModal(null)}>
                <X className="h-4 w-4 text-[#767f8f]" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[#767f8f]">
                <span>Current Total Debt:</span>
                <span className="font-bold text-[#c4441d]">KES {repayModal.balance.toLocaleString()}</span>
              </div>
              <label className="text-[11px] font-bold text-[#15171d] block">
                Amount Received (KES)
              </label>
              <input
                type="number"
                value={repayAmount}
                onChange={(e) => setRepayAmount(Number(e.target.value))}
                className="w-full bg-[#faf6ef] border border-[#cfd3da] rounded-xl px-3 py-2 text-sm font-bold text-[#15171d]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRepayModal(null)}
                className="flex-1 border border-[#cfd3da] py-2 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                className="flex-1 bg-[#1a623c] text-white py-2 rounded-xl text-xs font-bold"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Modal */}
      {showReceiptModal && lastCompletedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xs w-full p-5 border border-[#e8eaed] shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#e8eaed] pb-2">
              <div className="flex items-center gap-1.5 text-[#1a623c]">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-bold text-xs text-[#15171d]">Sale Completed</span>
              </div>
              <button type="button" onClick={() => setShowReceiptModal(false)}>
                <X className="h-4 w-4 text-[#767f8f]" />
              </button>
            </div>

            {/* 58mm Receipt Render */}
            <div className="bg-[#faf6ef] p-3 rounded-xl border border-[#e8eaed] font-mono text-[11px] space-y-2 text-[#15171d]">
              <div className="text-center pb-1 border-b border-dashed border-[#cfd3da]">
                <div className="font-bold text-xs">FLOWBIZ STORE</div>
                <div className="text-[9px] text-[#767f8f]">Nairobi, Kenya · Tel: +254 700 000 000</div>
                <div className="text-[9px] text-[#767f8f]">Receipt #{lastCompletedSale.invoiceNo} · {lastCompletedSale.date}</div>
              </div>
              <div className="space-y-1 py-1">
                {lastCompletedSale.items.map((item) => (
                  <div key={item.product.id} className="flex justify-between">
                    <span className="truncate pr-1">{item.quantity}x {item.product.name.slice(0, 14)}</span>
                    <span className="font-bold shrink-0">KES {(item.quantity * item.unitPrice).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-[#cfd3da] pt-1.5 space-y-0.5">
                <div className="flex justify-between font-bold text-xs text-[#1a623c]">
                  <span>TOTAL PAID:</span>
                  <span>KES {lastCompletedSale.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] text-[#5a6273]">
                  <span>Payment Method:</span>
                  <span>{lastCompletedSale.method}</span>
                </div>
                {lastCompletedSale.mpesaCode && (
                  <div className="flex justify-between text-[10px] text-[#1a623c] font-mono">
                    <span>M-Pesa Ref:</span>
                    <span>{lastCompletedSale.mpesaCode}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  showNotification('Printing 58mm thermal receipt...');
                  setShowReceiptModal(false);
                }}
                className="flex-1 border border-[#cfd3da] py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#faf6ef]"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
              <button
                type="button"
                onClick={() => {
                  showNotification('Receipt sent to customer WhatsApp!');
                  setShowReceiptModal(false);
                }}
                className="flex-1 bg-[#1a623c] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#144f30]"
              >
                <Smartphone className="h-3.5 w-3.5" /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}