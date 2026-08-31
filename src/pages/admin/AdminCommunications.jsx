// src/pages/admin/AdminCommunications.jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import { sendAdminCommunication } from '../../utils/adminService';
import {
  Send,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  HelpCircle,
  Gift,
  RotateCcw,
  Printer,
  BookOpen,
  Eye,
  Edit3,
} from 'lucide-react';

const CATEGORIES = ['All', 'Follow-up', 'Support', 'Promotions', 'Tips & Guides', 'Inactive'];

const PRESET_TEMPLATES = [
  // 1. Follow-up: Signed up but haven't started trading yet
  {
    id: 'onboarding-new',
    category: 'Follow-up',
    name: 'New Sign-up Follow-up (Not started yet)',
    icon: HelpCircle,
    badge: 'Onboarding Support',
    subject: 'Welcome to FlowBiz! Need help setting up your store?',
    title: 'Checking in on your shop setup',
    whatsappText: 'Hello FlowBiz! I just signed up and would like some help adding my products and setting up my counter.',
    content: `Hello,

Thank you for signing up for FlowBiz! We noticed you recently created your business workspace.

Setting up a new system can take a few minutes, so we wanted to reach out personally and see if you need any assistance adding your products or testing your first sale.

Here are 3 quick steps to get trading:
1. Add your products: Go to Products → tap '+ Add product' to enter your stock items and buying costs.
2. Open Counter: Tap any item or scan its barcode to record a test cash or M-Pesa sale.
3. Track Deni: Record customer credit sales without false profit illusions until debt is repaid.

If it is easier, tap the WhatsApp button below or reply directly to this email for a free 5-minute walkthrough.

We are excited to help your business grow!

Best regards,
The FlowBiz Support Team`,
  },

  // 2. First Sale Follow-up
  {
    id: 'first-sale-congrats',
    category: 'Follow-up',
    name: 'First Sale Congrats & Shift Close Guide',
    icon: Sparkles,
    badge: 'Merchant Success',
    subject: 'Congratulations on your first sales with FlowBiz!',
    title: 'Great start! Here are 2 tips to keep your books clean',
    whatsappText: 'Hello FlowBiz Support! I started recording sales and have a quick question.',
    content: `Hello,

Congratulations on recording your first sales on FlowBiz! Your store is now actively tracking real-time inventory and revenue.

Here are two essential daily habits for your shop:
• Reconcile your till at closing: At the end of each shift, open the Close Day tab to verify your cash drawer against your M-Pesa till balance.
• Send WhatsApp receipts: After completing any sale, tap 'Send via WhatsApp' to deliver an official branded receipt with zero SMS costs.

Have any questions or need extra staff accounts? Tap the WhatsApp button below to talk with our support team anytime!

Best regards,
FlowBiz Customer Success`,
  },

  // 3. General Support Check-in
  {
    id: 'support-checkin',
    category: 'Support',
    name: 'General Storefront Check-in',
    icon: MessageSquare,
    badge: 'Customer Care',
    subject: 'How is FlowBiz working for your shop today?',
    title: 'FlowBiz Support Check-in',
    whatsappText: 'Hi FlowBiz Support! I would like some assistance with my store dashboard.',
    content: `Hello,

We are checking in to see how your store operations and daily bookkeeping are going on FlowBiz.

Is there any feature you need help with, such as end-of-day till closing, supplier restock tracking, or barcode scanning?

If you need any guidance or want to share feedback, tap the WhatsApp button below or reply directly to this email. We are always ready to help!

Warm regards,
FlowBiz Support Desk`,
  },

  // 4. Hardware & Thermal Printer Support
  {
    id: 'printer-scanner-help',
    category: 'Support',
    name: 'Thermal Printer & Barcode Scanner Setup',
    icon: Printer,
    badge: 'Hardware Support',
    subject: 'Need help connecting your printer or barcode scanner to FlowBiz?',
    title: 'Free Help: Thermal Printers & Barcode Scanners',
    whatsappText: 'Hi FlowBiz! I need help setting up my 58mm/80mm thermal receipt printer with FlowBiz.',
    content: `Hello,

Did you know that FlowBiz natively supports standard 58mm & 80mm Bluetooth/USB thermal receipt printers and handheld barcode scanners?

If you need help configuring your thermal printer, setting up custom paper widths in Settings, or scanning barcodes using your phone camera, our technical team is ready to assist.

Tap the WhatsApp button below to chat with our hardware setup team!

Best regards,
FlowBiz Technical Desk`,
  },

  // 5. Educational: Deni & WhatsApp Digital Receipts
  {
    id: 'deni-ledger-tips',
    category: 'Tips & Guides',
    name: 'How to Track Deni & Send WhatsApp Receipts',
    icon: BookOpen,
    badge: 'Store Best Practices',
    subject: 'Quick Tip: How to track Deni & send WhatsApp receipts on FlowBiz',
    title: 'Stop losing money on uncollected credit',
    whatsappText: 'Hi FlowBiz Support! I would like to learn more about tracking customer debt.',
    content: `Hello,

Did you know that FlowBiz uses a cash-flow-first accounting model specifically designed for retail businesses?

When a customer takes items on credit (Deni):
• Physical stock is deducted immediately to prevent double-selling.
• Revenue and profit remain at KES 0.00 until the customer repays—preventing false profit illusions on uncollected money.
• When debt is repaid, revenue is recognized and you can send an official Debt Repayment Receipt straight to their WhatsApp in 1 tap!

Open your Customers tab in FlowBiz to view your outstanding balances anytime.

Best regards,
FlowBiz Support`,
  },

  // 6. Pro Upgrade Offer
  {
    id: 'pro-upgrade-discovery',
    category: 'Promotions',
    name: 'FlowBiz Pro Discovery (KES 599 / 30 Days)',
    icon: Gift,
    badge: 'Special Offer',
    subject: 'Unlock Unlimited Products and WhatsApp Receipts with FlowBiz Pro',
    title: 'Grow faster with FlowBiz Pro',
    whatsappText: 'Hello FlowBiz! I would like more details on upgrading to FlowBiz Pro.',
    content: `Hello,

We hope your business is thriving!

If your catalog has grown and you need:
✓ Unlimited products and catalog items
✓ Unlimited cashier staff accounts
✓ 1-tap WhatsApp digital receipts and debt reminders
✓ Advanced profit margin analytics and inventory intelligence

You can upgrade to FlowBiz Pro for just KES 599 for 30 days prepaid (via M-Pesa or Card, with no auto-billing surprises).

Upgrade anytime from Settings → Manage Subscription, or tap the WhatsApp button below if you would like a demo!

Best regards,
FlowBiz Team`,
  },

  // 7. Inactive Store Win-Back
  {
    id: 'inactive-winback',
    category: 'Inactive',
    name: 'Inactive Store Check-in (We miss you)',
    icon: RotateCcw,
    badge: 'Customer Success',
    subject: 'We miss you at FlowBiz! Can we help you restart?',
    title: 'We are here to help you get back on track',
    whatsappText: 'Hi FlowBiz! I would like to reactivate my shop on FlowBiz.',
    content: `Hello,

We noticed you haven't recorded transactions on FlowBiz recently and wanted to check in.

Did you run into any challenges during setup, or is there a specific feature you needed that we can help you with?

Your store data is safely saved in your account. If you would like help reorganizing your inventory or training your cashiers, tap the WhatsApp button below to chat with our team.

We would love to help you get your shop running smoothly again!

Warm regards,
The FlowBiz Support Team`,
  },
];

export default function AdminCommunications() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [recipient, setRecipient] = useState('');
  const [title, setTitle] = useState(PRESET_TEMPLATES[0].title);
  const [badge, setBadge] = useState(PRESET_TEMPLATES[0].badge);
  const [subject, setSubject] = useState(PRESET_TEMPLATES[0].subject);
  const [whatsappText, setWhatsappText] = useState(PRESET_TEMPLATES[0].whatsappText);
  const [content, setContent] = useState(PRESET_TEMPLATES[0].content);
  const [viewMode, setViewMode] = useState('compose');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const filteredTemplates = PRESET_TEMPLATES.filter(
    (t) => selectedCategory === 'All' || t.category === selectedCategory
  );

  const applyTemplate = (tmpl) => {
    setTitle(tmpl.title);
    setBadge(tmpl.badge);
    setSubject(tmpl.subject);
    setContent(tmpl.content);
    setWhatsappText(tmpl.whatsappText);
    toast.success(`Template loaded: "${tmpl.name}"`);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!recipient.trim() || !subject.trim() || !content.trim()) {
      toast.error('Recipient email, subject, and message body are required.');
      return;
    }

    setSending(true);
    setSentSuccess(false);
    try {
      await sendAdminCommunication({
        to: recipient.trim(),
        subject: subject.trim(),
        title: title.trim() || subject.trim(),
        badge: badge.trim() || 'Customer Support',
        htmlContent: `<p>${content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
        plainText: content,
        whatsappNumber: '254741104469',
        whatsappText: whatsappText.trim(),
        showWhatsappButton: true,
        whatsappButtonLabel: 'WhatsApp Us',
      });
      toast.success('Customer follow-up email dispatched.');
      setSentSuccess(true);
      setRecipient('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 tracking-tight">
            Customer Communications &amp; Follow-ups
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-0.5">
            Send friendly support notices, check-ins, and onboarding follow-ups with 1-tap WhatsApp contact buttons.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-white border border-ink-200 p-1 rounded-xl self-start sm:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('compose')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'compose' ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" /> Compose Form
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'preview' ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            <Eye className="h-3.5 w-3.5" /> Live Email Preview
          </button>
        </div>
      </div>

      {/* Preset Template Selector */}
      <div className="card p-5 bg-white space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink-100 pb-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
            Select Message Template
          </label>
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-colors ${
                  selectedCategory === cat
                    ? 'bg-moss-700 text-white'
                    : 'bg-sand text-ink-600 hover:bg-ink-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredTemplates.map((tmpl) => {
            const Icon = tmpl.icon;
            const isSelected = subject === tmpl.subject;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  isSelected
                    ? 'border-moss-600 bg-moss-50/60 ring-1 ring-moss-600'
                    : 'border-ink-200 hover:bg-ink-50'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${isSelected ? 'text-moss-700' : 'text-ink-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-bold text-ink-900 truncate">{tmpl.name}</p>
                    <span className="badge bg-sand text-[9px] font-bold text-ink-600 uppercase shrink-0">
                      {tmpl.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500 truncate mt-0.5">{tmpl.subject}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Composer or Live Preview */}
      {viewMode === 'compose' ? (
        <div className="card p-6 bg-white space-y-5 shadow-sm">
          {sentSuccess && (
            <div className="rounded-xl bg-moss-50 border border-moss-200 p-4 text-xs font-semibold text-moss-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-moss-600 shrink-0" />
              <span>Follow-up email dispatched successfully via Resend with official WhatsApp support links.</span>
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="label">Recipient Customer / Owner Email</label>
              <input
                type="email"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. shopowner@gmail.com"
                className="input text-xs sm:text-sm"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Email Subject Line</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Welcome to FlowBiz! Need help setting up?"
                  className="input text-xs sm:text-sm font-semibold"
                />
              </div>
              <div>
                <label className="label">Header Badge</label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="e.g. Customer Support"
                  className="input text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="label">Banner Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Checking in on your shop setup"
                className="input text-xs sm:text-sm font-bold"
              />
            </div>

            <div>
              <label className="label">Message Body</label>
              <textarea
                required
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your message..."
                className="input text-xs sm:text-sm leading-relaxed font-sans"
              />
            </div>

            <div>
              <label className="label">Pre-filled WhatsApp Chat Message</label>
              <input
                type="text"
                value={whatsappText}
                onChange={(e) => setWhatsappText(e.target.value)}
                placeholder="Text pre-typed when the customer taps the WhatsApp button..."
                className="input text-xs text-ink-700"
              />
              <p className="mt-1 text-[11px] text-ink-400">
                When the customer clicks the button, WhatsApp opens directly with your number <strong>+254 741 104 469</strong> and this message pre-filled.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-ink-100">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className="btn-outline !min-h-0 !py-2 !px-3 text-xs font-bold"
              >
                Preview Email Render
              </button>
              <button
                type="submit"
                disabled={sending}
                className="btn-primary !bg-ink-900 flex items-center gap-2"
              >
                <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send Customer Email'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* LIVE EMAIL PREVIEW */
        <div className="card p-4 sm:p-6 bg-[#faf6ef] space-y-4">
          <div className="flex items-center justify-between border-b border-ink-200 pb-3">
            <div>
              <span className="text-xs font-bold text-ink-700 block">Live HTML Email Preview</span>
              <span className="text-[11px] text-ink-500">Subject: <strong className="text-ink-900">{subject || '(No Subject)'}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('compose')}
              className="btn-primary !min-h-0 !py-1.5 !px-3 text-xs font-bold"
            >
              Back to Edit
            </button>
          </div>

          {/* Full-width Responsive Email Simulation */}
          <div className="w-full max-w-2xl mx-auto rounded-xl bg-white shadow-xl overflow-hidden border border-ink-200">
            {/* Header */}
            <div className="bg-[#1a623c] px-5 sm:px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight">FlowBiz</span>
                {badge && (
                  <span className="text-[#c3eed3] text-[11px] font-semibold uppercase tracking-wider">
                    {badge}
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-7 space-y-4 text-ink-800 text-sm leading-relaxed">
              <h2 className="text-base sm:text-lg font-bold text-ink-900 leading-snug">
                {title || subject}
              </h2>
              <div className="whitespace-pre-line text-ink-700 text-xs sm:text-sm">
                {content}
              </div>

              {/* Minimal Clickable WhatsApp Button */}
              <div className="pt-5 pb-2 text-center">
                <a
                  href={`https://wa.me/254741104469?text=${encodeURIComponent(whatsappText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-[#25D366] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-lg shadow-sm hover:bg-[#20ba5a] transition-colors"
                >
                  WhatsApp Us
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#fafbfc] border-t border-ink-100 p-5 sm:p-6 text-xs text-ink-500 space-y-1.5">
              <p className="font-bold text-ink-800">Need help or have questions?</p>
              <p className="leading-relaxed text-[11px] sm:text-xs">
                Reply to this email or chat with our team on WhatsApp: 
                <a href={`https://wa.me/254741104469?text=${encodeURIComponent(whatsappText)}`} className="text-[#1a623c] font-bold ml-1">
                  +254 741 104 469
                </a>.
              </p>
              <p className="text-[10px] sm:text-[11px] text-ink-400 pt-1">
                FlowBiz Business Manager · Nairobi, Kenya · support@flowbiz.co.ke
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}