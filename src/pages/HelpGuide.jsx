import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { Link } from 'react-router-dom';

// The manual, rewritten short.
//
// It used to explain each screen in several paragraphs, and several of
// those paragraphs had gone out of date: it sent owners to Settings for
// the team (Team is its own page now), it described a cashier as having
// "Counter, Customers, and Expenses if the owner allows it" (there is a
// whole permission catalogue now), and it promised backup and restore as
// a future section when Settings already does it. Everything below has
// been checked against the application as it stands.

/** One instruction: what to do, then the shortest true sentence about it. */
function Step({ title, children }) {
  return (
    <div>
      <h4 className="section-title">{title}</h4>
      <p className="mt-0.5 text-body text-ink-600">{children}</p>
    </div>
  );
}

const SECTIONS = [
  {
    id: 'getting-started',
    title: '1. Getting started',
    desc: 'The five things you do every day.',
    content: (
      <div className="space-y-4">
        <Step title="Add your products">
          On <strong className="text-ink-900">Products</strong>, enter a name, buying price and
          selling price. Scan the barcode if it has one.
        </Step>
        <Step title="Record purchases">
          On <strong className="text-ink-900">Purchases</strong>, pick the supplier and product,
          enter the quantity, and say whether you paid or took it on credit. Stock goes up
          automatically.
        </Step>
        <Step title="Sell at the counter">
          On <strong className="text-ink-900">Counter</strong>, tap a product or scan it, choose
          Cash, M-Pesa or credit, and confirm. Stock comes down as you sell.
        </Step>
        <Step title="Record expenses">
          Log rent, electricity, transport and the rest on{' '}
          <strong className="text-ink-900">Expenses</strong>. Anything you miss overstates your
          profit.
        </Step>
        <Step title="Take debt repayments">
          Open the customer under <strong className="text-ink-900">Customers</strong> and enter the
          repayment. Never record it as a new sale.
        </Step>
      </div>
    ),
  },
  {
    id: 'understanding-dashboard',
    title: '2. The dashboard',
    desc: "Today's figures, and what each one counts.",
    content: (
      <div className="space-y-4">
        <p className="text-body text-ink-600">
          Which panels appear, and in what order, is yours to set under Settings, Customize your
          business.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Cash received', 'Cash sales plus cash debt repayments, today.'],
            ['M-Pesa received', 'M-Pesa sales plus M-Pesa debt repayments, today.'],
            ['Net profit', "Today's gross profit less today's expenses."],
            ['Expenses', 'What you recorded today, excluding stock bought on credit.'],
            ['Inventory value at cost', 'What the stock on your shelves cost you.'],
            ['Outstanding debt', 'What your credit customers still owe.'],
          ].map(([label, text]) => (
            <div key={label} className="rounded-panel border border-divider p-3">
              <span className="block text-secondary font-semibold text-ink-800">{label}</span>
              <p className="mt-1 text-secondary text-ink-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'understanding-reports',
    title: '3. Reports',
    desc: 'What each line means over the period you choose.',
    content: (
      <div className="space-y-3 text-body text-ink-600">
        <p>Choose Today, This week, This month or a custom range, then export a PDF if you need one.</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li><strong>Revenue:</strong> money actually received: cash and M-Pesa sales, plus debt repaid in the period, less refunds.</li>
          <li><strong>Cost of goods sold:</strong> what the goods sold cost you. On a debt repayment it is recognised in proportion to the amount paid.</li>
          <li><strong>Gross profit:</strong> revenue less cost of goods sold.</li>
          <li><strong>Total expenses:</strong> what you recorded in the period.</li>
          <li><strong>Net profit:</strong> gross profit less total expenses.</li>
        </ul>
        <p className="text-secondary text-ink-500">
          What you owe suppliers right now is on the Suppliers page, not here. Reports cover a
          period; a balance does not.
        </p>
      </div>
    ),
  },
  {
    id: 'credit-sales',
    title: '4. Credit sales (deni)',
    desc: 'Why profit stays at zero until the money arrives.',
    content: (
      <div className="space-y-4 text-body text-ink-600">
        <p>
          FlowBiz counts revenue when you are paid, not when you hand over the goods. That way the
          profit on your screen is money you can actually spend.
        </p>
        <div className="space-y-2 rounded-panel border border-line bg-surface p-4 font-mono text-secondary">
          <div>Customer buys on credit, KES 15,000</div>
          <ChevronDown className="mx-auto h-4 w-4 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
          <div>Stock comes down straight away</div>
          <ChevronDown className="mx-auto h-4 w-4 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
          <div>Outstanding debt goes up by KES 15,000</div>
          <ChevronDown className="mx-auto h-4 w-4 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
          <div className="font-semibold text-danger-600">Revenue and profit stay at KES 0.00</div>
          <ChevronDown className="mx-auto h-4 w-4 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
          <div>Customer pays KES 5,000</div>
          <ChevronDown className="mx-auto h-4 w-4 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
          <div className="font-semibold text-ink-900">KES 5,000 becomes revenue, with its share of cost and profit</div>
          <ChevronDown className="mx-auto h-4 w-4 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
          <div>Outstanding debt falls to KES 10,000</div>
        </div>
      </div>
    ),
  },
  {
    id: 'cash-mpesa',
    title: '5. Opening and closing the day',
    desc: 'Floats, expected balances and the till count.',
    content: (
      <div className="space-y-3 text-body text-ink-600">
        <p>Open the counter each morning with the cash in the drawer and the float on your phone.</p>
        <p>During the day, every sale, expense, repayment and refund moves the expected balances.</p>
        <p>At closing, on <strong>Close day</strong>:</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>Count the cash and type it in.</li>
          <li>Check your M-Pesa balance and type it in.</li>
          <li>FlowBiz shows Short by, Over by, or Balanced.</li>
          <li>Confirm and close. An owner can reopen the session from the same page to correct a mistake.</li>
        </ol>
      </div>
    ),
  },
  {
    id: 'inventory-management',
    title: '6. Stock',
    desc: 'What moves your stock, and how to correct it.',
    content: (
      <div className="space-y-3 text-body text-ink-600">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Purchases</strong> add stock.</li>
          <li><strong>Sales</strong>, including credit sales, take it away as the goods leave.</li>
          <li><strong>Stock take</strong> replaces the recorded figure with what you counted.</li>
        </ul>
        <p>
          Use a stock take for damage, expiry and shrinkage. It is an audit tool: it moves no money
          and creates no expense, and each adjustment is recorded so the change is traceable.
        </p>
      </div>
    ),
  },
  {
    id: 'suppliers-team',
    title: '7. Suppliers and team',
    desc: 'What you owe suppliers, and who can do what.',
    content: (
      <div className="space-y-4 text-body text-ink-600">
        <p>
          <strong className="text-ink-900">Suppliers</strong> tracks who you buy from and what you
          owe. A purchase on credit adds to that supplier's balance; recording a payment there logs
          the payment and its expense together.
        </p>
        <p>
          <strong className="text-ink-900">Team</strong> is where you invite owners and cashiers,
          and where you set what cashiers can do. Each permission is a switch: selling, credit
          sales, refunds, the product list, receiving stock, stock takes, customers, expenses,
          closing the day, reports. What is offered depends on your business type, so a restaurant
          is asked about orders and a shop is not.
        </p>
        <p>
          Settings, the team, the plan, the business type and your data stay with owners. No switch
          can grant them.
        </p>
        <p>
          You can deactivate a staff account from Team, or sign a device out from Settings under
          Devices, if a phone is lost or someone leaves.
        </p>
      </div>
    ),
  },
  {
    id: 'customize',
    title: '8. Customize your business',
    desc: 'Pages, units, dashboard, words and categories.',
    content: (
      <div className="space-y-3 text-body text-ink-600">
        <p>
          Settings, Customize your business is where you turn off anything you do not use, choose
          which units the product form offers, arrange your dashboard, rename what FlowBiz calls the
          things you sell, and manage both your product and your expense categories.
        </p>
        <p>
          Nothing there deletes anything. Turning a page off hides it, and turning it back on brings
          everything back. Removing a category takes the word off the list; whatever was already
          filed under it keeps it.
        </p>
        <p>
          Your business type is not editable, because your products, prices, stock and reports are
          all recorded against it. Contact FlowBiz support if it was set up wrongly.
        </p>
      </div>
    ),
  },
  {
    id: 'backup',
    title: '9. Backup and restore',
    desc: 'Taking a copy of your data, and putting one back.',
    content: (
      <div className="space-y-3 text-body text-ink-600">
        <p>
          Settings, Backup and restore downloads everything this business has stored as a .zip:
          CSVs you can open in a spreadsheet, plus a FlowBiz backup file.
        </p>
        <p>
          Importing that file adds its records to this business and overwrites any record with the
          same ID. It never clears what is already there, so import into an empty business unless
          you mean to merge.
        </p>
      </div>
    ),
  },
  {
    id: 'offline',
    title: '10. Working offline',
    desc: 'What happens when the signal drops.',
    content: (
      <div className="space-y-3 text-body text-ink-600">
        <p>
          Keep selling. Sales, expenses, purchases, customers, repayments and stock takes are saved
          on the device and sync on their own when you reconnect. The indicator in the header says
          Offline while you are, and a message says so when something is saved that way.
        </p>
        <p>
          Two things do need a connection, because they are not stored data: signing in for the
          first time on a device, and anything that sends an email or takes a payment.
        </p>
      </div>
    ),
  },
  {
    id: 'pro-analytics',
    title: '11. FlowBiz Pro',
    desc: 'What Pro adds to the free plan.',
    content: (
      <div className="space-y-3 text-body text-ink-600">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-ink-900">Advanced analytics:</strong> this period against the last, which products drive volume against profit, and revenue per staff member.</li>
          <li><strong className="text-ink-900">Inventory intelligence:</strong> cash tied up in stock, what is overstocked, and what is about to run out.</li>
          <li><strong className="text-ink-900">WhatsApp sharing:</strong> send a receipt, invoice or debt reminder to a customer in one tap.</li>
          <li>Unlimited products and staff.</li>
        </ul>
        <p className="text-secondary text-ink-500">
          Printing and downloading receipts, invoices and reports as PDF is on every plan.
        </p>
      </div>
    ),
  },
  {
    id: 'faq',
    title: '12. Common questions',
    desc: 'Short answers to what people ask most.',
    content: (
      <div className="space-y-4">
        {[
          ['Why is my profit zero after a credit sale?', 'No money has come in yet. Profit is recognised as the customer repays, in proportion to what they pay.'],
          ['Why did stock go down before I was paid?', 'The goods left the shelf. Counting them out immediately is what stops you selling them twice.'],
          ['Can I edit a closed day?', 'An owner can reopen the session on the Close day page, make the correction, and close it again.'],
          ['Where do I edit or delete a product?', 'On the Products page. Deleting is owner-only, and a deleted product is archived in Settings before it is destroyed.'],
          ['I need an expense category FlowBiz does not have.', 'Add it under Settings, Customize your business, Expense categories.'],
        ].map(([q, a]) => (
          <div key={q} className="space-y-1">
            <strong className="block text-body text-ink-800">{q}</strong>
            <p className="pl-4 text-secondary text-ink-600">{a}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'best-practices',
    title: '13. Habits worth keeping',
    desc: 'Four things that keep the books honest.',
    content: (
      <ul className="list-disc space-y-1.5 pl-5 text-body text-ink-600">
        <li><strong>Record expenses as they happen.</strong> Nobody remembers them at closing time.</li>
        <li><strong>Record repayments under Customers.</strong> A new sale would double-count the revenue and the stock.</li>
        <li><strong>Do a stock take regularly.</strong> Weekly or fortnightly keeps the shelf and the screen in agreement.</li>
        <li><strong>Keep your business details current.</strong> They print on every receipt, invoice and report.</li>
      </ul>
    ),
  },
];

export default function HelpGuide() {
  const [activeTab, setActiveTab] = useState('getting-started');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Help and guide"
        description="How to run a shop on FlowBiz."
        actions={
          <Link to="/settings" className="btn-secondary">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Back to settings
          </Link>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full space-y-2 lg:w-1/3">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveTab(sec.id)}
              className={`relative flex w-full flex-col gap-0.5 rounded-control p-3 text-left transition-colors ${
                activeTab === sec.id
                  ? 'bg-primary-50 text-primary-800 before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary-600 before:content-[""]'
                  : 'text-ink-700 hover:bg-ink-50'
              }`}
            >
              <span className="block text-body font-medium">{sec.title}</span>
              <span className="line-clamp-1 text-secondary text-ink-500">{sec.desc}</span>
            </button>
          ))}
        </div>

        <div className="min-h-[300px] flex-1 rounded-panel border border-line bg-surface p-5 sm:p-6">
          {SECTIONS.map((sec) => {
            if (activeTab !== sec.id) return null;
            return (
              <div key={sec.id} className="animate-fade-in space-y-4">
                <div className="border-b border-line pb-3">
                  <h2 className="font-display text-page-title text-ink-900">{sec.title}</h2>
                  <p className="mt-1 text-secondary text-ink-500">{sec.desc}</p>
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
