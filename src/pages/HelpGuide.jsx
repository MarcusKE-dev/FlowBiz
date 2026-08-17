import { useState } from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  {
    id: 'getting-started',
    title: '1. Getting Started',
    desc: 'The essential daily workflows: adding inventory, recording purchases, making sales, and logging daily expenses.',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          Welcome to FlowBiz! To run your shop efficiently every day, follow these five essential steps:
        </p>
        <div className="space-y-3">
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 1: Add Your Products</h4>
            <p className="text-sm text-ink-600 mt-1">
              Go to <strong className="text-ink-800">Products</strong> and tap <strong className="text-ink-800">+ Add product</strong>. Enter the product name, its buying price (cost), and selling price. If the item has a barcode, scan it using your device's camera or standard USB scanner.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 2: Record Purchases (Restocking)</h4>
            <p className="text-sm text-ink-600 mt-1">
              When a supplier delivers new stock, record it on the <strong className="text-ink-800">Purchases</strong> page. Select the supplier, pick the product, enter the quantity received, and specify if you paid them now or took the stock on credit. FlowBiz will automatically increase your stock levels.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 3: Record Sales (Counter)</h4>
            <p className="text-sm text-ink-600 mt-1">
              On the <strong className="text-ink-800">Counter</strong> page, tap any product card or scan its barcode to sell. Select whether the customer paid in Cash, via M-Pesa, or took it on credit (Deni). Tap confirm, and inventory levels will update in real-time.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 4: Record Expenses</h4>
            <p className="text-sm text-ink-600 mt-1">
              Keep a record of rent, electricity, transport, wages, or airtime float under <strong className="text-ink-800">Expenses</strong>. Logging every small expense ensures your end-of-day net profit calculations remain accurate.
            </p>
          </div>
          <div className="rounded-lg bg-ink-50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-800">Step 5: Record Debt Repayments</h4>
            <p className="text-sm text-ink-600 mt-1">
              When a debtor pays off what they owe, go to <strong className="text-ink-800">Customers</strong>, click their name, and record the repayment amountWhen a debtor pays off what they owe, go to <strong className="text-ink-800">Customers</strong>, click their name, and record the repayment amount (Cash or M-Pesa). Do not create a new sale; this updates their remaining balance and logs the cash received.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'understanding-dashboard',
    title: "2. Understanding the Dashboard",
    desc: "A brief guide to today's summary cards, tracking balances, and checking inventory health.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          The dashboard is your shop's cockpit, offering a real-time summary of today's events:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Cash Received Today</span>
            <p className="text-xs text-ink-600 mt-1">All the physical cash collected today from direct cash sales and debtor repayments combined.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">M-Pesa Received Today</span>
            <p className="text-xs text-ink-600 mt-1">All digital payments transferred to your till today from direct M-Pesa sales and debtor repayments.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Today's Net Profit</span>
            <p className="text-xs text-ink-600 mt-1">Today's realized gross profit minus today's recorded shop expenses. Shows exactly what you made in hand.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Today's Expenses</span>
            <p className="text-xs text-ink-600 mt-1">The sum of all shop operational expenses recorded today (excluding purchases made on credit).</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Inventory Value (Cost)</span>
            <p className="text-xs text-ink-600 mt-1">The total buying price of all items currently on your shelves. Helps you see exactly how much capital is tied up in stock.</p>
          </div>
          <div className="border border-ink-100 rounded-lg p-3">
            <span className="font-semibold text-xs text-ink-800 block">Outstanding Debt (Deni)</span>
            <p className="text-xs text-ink-600 mt-1">The total amount of money your credit customers still owe you. Keep this number as close to zero as possible!</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'understanding-reports',
    title: '3. Understanding Reports',
    desc: 'How the reports compile and measure credit sales, margins, expenses, and profits over time.',
    content: (
      <div className="space-y-3 text-sm text-ink-600">
        <p>Reports allow you to view the shop's financial performance over preset periods (Today, This Week, This Month, or Custom dates):</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><strong>Gross Revenue:</strong> Represents actual money in your hand, direct cash/M-Pesa sales plus whatever portion of debtor repayments was collected in this period.</li>
          <li><strong>Cost of Goods Sold (COGS):</strong> The total wholesale cost of the items you sold during this period. For credit repayments, COGS is recognized proportionally.</li>
          <li><strong>Gross Profit:</strong> Gross Revenue minus Cost of Goods Sold. Tells you how much markup you earned on items sold.</li>
          <li><strong>Expenses:</strong> Rent, bills, wages, etc., logged during this period.</li>
          <li><strong>Net Profit:</strong> Gross Profit minus Expenses. The ultimate bottom-line earnings of your business during this reporting window.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'credit-sales',
    title: '4. How Credit Sales (Deni) Work',
    desc: 'The cash-flow-first model: why profit stays at zero until money is collected.',
    content: (
      <div className="space-y-4 text-sm text-ink-600">
        <p>
          Most standard software registers revenue the moment you sell an item, even if the customer leaves without empty pockets. This is called *accrual accounting*, but it can be confusing for everyday Kenyan businesses where cash flow is king.
        </p>
        <p>
          <strong>FlowBiz uses a cash-flow-first hybrid model</strong> designed specifically for Kenyan SMEs:
        </p>
        <div className="border-l-2 border-moss-600 pl-4 space-y-2 py-1 font-mono text-xs bg-moss-50/50 rounded-r">
          <div>Customer buys on credit (e.g., KES 15,000)</div>
          <div className="text-ink-400">↓</div>
          <div>Inventory decreases immediately (real-time stock health)</div>
          <div className="text-ink-400">↓</div>
          <div>Outstanding Debt (Deni) increases by KES 15,000</div>
          <div className="text-ink-400">↓</div>
          <div className="text-rust-600 font-semibold">Revenue and Profit remain at KES 0.00 (not collected yet)</div>
          <div className="text-ink-400">↓</div>
          <div>Customer pays KES 5,000 partial payment later</div>
          <div className="text-ink-400">↓</div>
          <div className="text-moss-700 font-semibold">KES 5,000 is recognized as Revenue</div>
          <div className="text-moss-700 font-semibold font-bold">COGS &amp; proportional profit are recognized at last!</div>
          <div className="text-ink-400">↓</div>
          <div>Outstanding Debt reduces to KES 10,000</div>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          This system ensures you only see, report, and spend profits that have actually entered your cash drawer or M-Pesa till.
        </p>
      </div>
    )
  },
  {
    id: 'cash-mpesa',
    title: '5. Cash, M-Pesa, & Close Day',
    desc: 'Reconciling floats, recording withdrawals, and closing today’s session correctly.',
    content: (
      <div className="space-y-3 text-sm text-ink-600">
        <p>
          Every morning, open the Counter by entering your starting balances (the <strong>Opening Float</strong>). This is the cash in your drawer and the float on your phone.
        </p>
        <p>
          During the day, every sale, expense, debtor repayment, and refund adjusts the "Expected" balances inside the system. 
        </p>
        <p>
          At closing time, visit the <strong>Close Day</strong> page:
        </p>
        <ol className="list-decimal pl-5 space-y-1.5 mt-2">
          <li>Count the physical cash in your drawer and type the amount into the input.</li>
          <li>Check your M-Pesa statement balance and type it.</li>
          <li>FlowBiz will instantly compare these to the "Expected" amounts and display a <strong>Shortage</strong> (rust) or <strong>Surplus</strong> (amber) if there's any variance.</li>
          <li>Press <strong>Confirm and Close Day</strong>. This locks the sales log and stores today's records.</li>
        </ol>
      </div>
    )
  },
  {
    id: 'inventory-management',
    title: '6. Inventory & Stock Take',
    desc: 'Understanding stock movements, low stock limits, and discrepancy audits.',
    content: (
      <div className="space-y-3 text-sm text-ink-600">
        <p>Inventory level is updated automatically through three daily events:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Purchases (+):</strong> Increases your stock when you record incoming stock from a supplier.</li>
          <li><strong>Sales &amp; Credit Sales (-):</strong> Decreases your stock the second an item leaves your counter.</li>
          <li><strong>Stock Take (+/-):</strong> Used to override the system count with a physical hand-count (e.g. to adjust for damage, expiration, or theft).</li>
        </ul>
        <div className="rounded bg-rust-50 p-3 text-xs text-rust-700">
          <strong>Discrepancy Note:</strong> Stock Take is purely an auditing tool. Correcting a stock discrepancy does not create cash transactions or expenses automatically. It logs the audit discrepancy under <strong>stockAdjustments</strong> for tracking.
        </div>
      </div>
    )
  },
  {
    id: 'suppliers-team',
    title: '7. Suppliers & Team',
    desc: 'Tracking what you owe suppliers, and managing owner and cashier access.',
    content: (
      <div className="space-y-4 text-sm text-ink-600">
        <p>The <strong className="text-ink-800">Suppliers</strong> page tracks who you buy stock from and what you owe them. Every purchase recorded "on credit" (Purchases page) adds to that supplier's outstanding balance automatically — record a payment from the Suppliers page when you pay them, and it logs both the payment and the matching expense in one step.</p>
        <p><strong className="text-ink-800">Team</strong> (under Settings) is where an owner invites staff. There are two roles:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Owner:</strong> full access — Products, Purchases, Suppliers, Reports, Settings, Team, and Close Day.</li>
          <li><strong>Cashier:</strong> Counter, Customers, and Expenses (if the owner allows it) — enough to run daily sales without touching sensitive business data.</li>
        </ul>
        <p>An owner can deactivate a staff account at any time from Team, or sign a device out remotely from Settings → Device Management if a phone is lost or a staff member leaves.</p>
      </div>
    ),
  },
  {
    id: 'pro-analytics',
    title: '8. FlowBiz Pro & Analytics',
    desc: 'What Advanced Analytics, Inventory Intelligence, and WhatsApp sharing add on top of the free plan.',
    content: (
      <div className="space-y-4 text-sm text-ink-600">
        <p><strong className="text-ink-800">Advanced Analytics</strong> (Pro) goes beyond the standard Reports page: it compares the current period against the one before it, breaks down which products drive the most volume versus the most profit, and attributes revenue per staff member.</p>
        <p><strong className="text-ink-800">Inventory Intelligence</strong> (Pro) looks at your stock from a capital point of view: how much cash is tied up in inventory right now, which products are overstocked and quietly locking up that cash, and which are close to running out.</p>
        <p><strong className="text-ink-800">WhatsApp sharing</strong> (Pro) lets you send a receipt, invoice, or debt reminder straight to a customer's phone with one tap.</p>
        <p className="text-xs text-ink-500">Printing and downloading receipts/invoices as PDF is available on every plan — Pro specifically unlocks Analytics, Inventory Intelligence, WhatsApp sharing, and unlimited products/staff.</p>
      </div>
    ),
  },
  {
    id: 'faq',
    title: '7. Frequently Asked Questions',
    desc: 'Troubleshooting and immediate answers to common user questions.',
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Why is my profit still zero after a credit sale?</strong>
          <p className="text-xs text-ink-600 pl-4">A: Since no cash or M-Pesa has been collected yet, no revenue is earned. Once the customer repays, profit is recognized proportionally based on the amount paid.</p>
        </div>
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Why did my inventory reduce before I received any money?</strong>
          <p className="text-xs text-ink-600 pl-4">A: Real-time inventory tracking is crucial. Even on credit, physical stock leaves the shelves, so the system must deduct it immediately to prevent double-selling.</p>
        </div>
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Can I edit or void a closed session?</strong>
          <p className="text-xs text-ink-600 pl-4">A: No. Once a daily session is closed, it is securely saved. If you made an error, an administrator can click "Reopen session" on the Close Day page to make adjustments.</p>
        </div>
        <div className="space-y-2">
          <strong className="text-sm text-ink-800 block">Q: Where do I edit or delete products?</strong>
          <p className="text-xs text-ink-600 pl-4">A: Editing and deleting products is restricted to administrators and must be done on the dedicated <strong>Products</strong> page, keeping the Counter screen clean and secure.</p>
        </div>
      </div>
    )
  },
  {
    id: 'best-practices',
    title: '8. FlowBiz Best Practices',
    desc: 'Golden rules for keeping your shop books accurate and reliable.',
    content: (
      <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-600">
        <li><strong>Record expenses immediately:</strong> Log your County Council fees, electricity, and lunch costs right when they occur so you do not forget at close-of-day.</li>
        <li><strong>Record credit repayments inside Customers:</strong> Never create a new direct sale to record a repayment, this would double-count your revenue and duplicate items sold.</li>
        <li><strong>Perform Stock Take regularly:</strong> Plan a quick physical stock take every weekend or fortnight to ensure physical inventory matches your screens exactly.</li>
        <li><strong>Keep the general settings updated:</strong> Shop name edits immediately personalize your generated PDF reports for presentation to accountants.</li>
      </ul>
    )
  },
  {
    id: 'about-flowbiz',
    title: '9. About FlowBiz',
    desc: 'Who we are and our vision for empowering Kenyan small businesses.',
    content: (
      <p className="text-sm text-ink-600">
        FlowBiz is a localized, production-ready Business Manager custom-built to meet the unique operational challenges of Kenyan SMBs. By prioritizing cash-flow visibility, offering native barcode scanning, and supporting local transaction models like Deni and M-Pesa, we aim to make day-to-day recordkeeping effortless and stress-free.
      </p>
    )
  }
];

export default function HelpGuide() {
  const [activeTab, setActiveTab] = useState('getting-started');

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900"> Help &amp; Guide</h1>
          <p className="text-sm text-ink-400">FlowBiz user guide and best-practice operating manual.</p>
        </div>
        <Link to="/settings" className="btn-outline text-xs !px-3 !py-1.5 !min-h-0">
          ← Back to Settings
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Navigation panel */}
        <div className="w-full lg:w-1/3 space-y-2">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveTab(sec.id)}
              className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1 min-h-[50px] ${
                activeTab === sec.id
                  ? 'border-moss-600 bg-moss-50 text-moss-800 shadow-sm'
                  : 'border-ink-100 bg-white text-ink-600 hover:bg-ink-50'
              }`}
            >
              <span className="font-semibold text-sm block">{sec.title}</span>
              <span className="text-xs text-ink-400 line-clamp-1">{sec.desc}</span>
            </button>
          ))}
          
          <div className="rounded-lg bg-moss-50/50 border border-dashed border-moss-200 p-4 text-center mt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-moss-800 block">Need more topics?</span>
            <p className="text-[11px] text-ink-500 mt-1">We periodically update this manual. Future sections including Cashiers, eTIMS, VAT, Backup &amp; Restore, and loyalty schemes will appear here automatically.</p>
          </div>
        </div>

        {/* Content Display Panel */}
        <div className="flex-1 card bg-white p-5 sm:p-6 min-h-[300px]">
          {SECTIONS.map((sec) => {
            if (activeTab !== sec.id) return null;
            return (
              <div key={sec.id} className="space-y-4 animate-fade-in">
                <div className="border-b border-ink-100 pb-3">
                  <h2 className="font-display text-lg font-bold text-ink-900">{sec.title}</h2>
                  <p className="text-xs text-ink-400 mt-1">{sec.desc}</p>
                </div>
                <div className="pt-2">{sec.content}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}