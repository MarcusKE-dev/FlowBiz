import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../common/Modal';
import { generateReceiptPDF, printReceipt, generateInvoicePDF, printInvoice, sendWhatsAppDocument } from '../../utils/documentService';
import { getOrCreateShareLink } from '../../utils/documentSharing';
import { useSettings } from '../../hooks/useSettings';
import { useAuth } from '../../contexts/AuthContext';
import { formatKES } from '../../utils/currency';
import { Printer, Download, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock } from 'lucide-react';

export default function SaleCompleteModal({ open, sale, onClose }) {
  const { settings } = useSettings();
  const { isPro, businessId, profile } = useAuth();
  const [phone, setPhone] = useState(sale?.customerPhone || '');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  // Keep phone input synced when a new sale is opened
  useEffect(() => {
    if (sale?.customerPhone) {
      setPhone(sale.customerPhone);
    } else {
      setPhone('');
    }
  }, [sale]);

  if (!sale) return null;

  const docLabel = sale.isCredit ? 'Invoice' : 'Receipt';
  // FIX (multi-product cart): a sale built from Counter.jsx's cart carries
  // an `items` array when it has more than one line. Single-product sales
  // (Dashboard's own quick-scan sale, or a one-item cart checkout) never
  // set this, so the original single-line summary below still renders
  // exactly as before.
  const cartItems = Array.isArray(sale.items) && sale.items.length > 1 ? sale.items : null;

  // FIX (Pro-gating correction): View, Download, and Print are FlowBiz's
  // basic document access and stay free on every plan. Only WhatsApp
  // sharing — the convenience of pushing the document straight to the
  // customer's phone — is the Pro feature. Print/Download used to be
  // gated behind isPro here; that was a bug, not an intentional product
  // rule (nothing else in the app treats PDF access as paid), so it's
  // removed rather than preserved.
  const handlePrint = () => {
    if (sale.isCredit) printInvoice(sale, settings);
    else printReceipt(sale, settings);
  };

  const handleDownload = () => {
    if (sale.isCredit) generateInvoicePDF(sale, settings);
    else generateReceiptPDF(sale, settings);
  };

  const handleWhatsApp = async () => {
    if (!phone.trim()) {
      toast.error('Please enter a valid customer phone number.');
      return;
    }
    setSendingWhatsApp(true);
    try {
      const documentUrl = await getOrCreateShareLink({
        businessId,
        documentType: sale.isCredit ? 'invoice' : 'receipt',
        documentId: sale.id,
        createdBy: profile?.uid,
      });
      sendWhatsAppDocument(sale, settings, phone.trim(), documentUrl);
    } catch (e) {
      toast.error(e.message || 'Unable to generate the receipt link. Please try again.');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={sale.isCredit ? 'Credit Sale Recorded' : 'Sale Complete'}>
      <div className="space-y-4">
        {/* Fixed rounded-xl2 to rounded-2xl */}
        <div className={`flex flex-col items-center justify-center py-4 rounded-2xl border ${sale.isCredit ? 'bg-rust-50 border-rust-200' : 'bg-moss-50 border-moss-200'}`}>
          <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${sale.isCredit ? 'bg-rust-100 text-rust-700' : 'bg-moss-100 text-moss-700'}`}>
            {sale.isCredit ? <Clock className="h-5 w-5 text-rust-600" strokeWidth={2} /> : <CheckCircle2 className="h-5 w-5 text-moss-600" strokeWidth={2} />}
          </div>
          <h2 className={`font-display font-bold ${sale.isCredit ? 'text-rust-700' : 'text-moss-800'}`}>
            {sale.isCredit ? 'Credit sale recorded' : 'Sale recorded successfully'}
          </h2>

          {cartItems ? (
            <div className="w-full px-5 mt-2 space-y-1">
              {cartItems.map((item, idx) => (
                <div key={item.productId || idx} className="flex items-center justify-between text-xs text-ink-700">
                  <span>{item.quantity} × {item.productName}</span>
                  <span className="font-semibold">{formatKES(item.lineTotal ?? (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold mt-2 text-ink-800">{sale.quantity} × {sale.productName}</p>
          )}

          {sale.isCredit && sale.customerName && <p className="text-xs text-ink-500 mt-1">{sale.customerName}</p>}
          <p className="text-lg font-bold text-ink-900 mt-1">{formatKES(sale.totalAmount)}</p>
          <p className={`text-xs mt-1 font-semibold ${sale.isCredit ? 'text-rust-600' : 'text-ink-500'}`}>
            {sale.isCredit ? 'Payment Status: Unpaid' : sale.paymentMethod}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print {docLabel}
          </button>
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download {docLabel}
          </button>
        </div>

        <div className="rounded-lg border border-ink-100 p-3 space-y-2">
          <label className="label">
            WhatsApp {docLabel} {!isPro && <span className="text-amber-600">— PRO</span>}
          </label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Customer Phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              disabled={sendingWhatsApp}
            />
            {isPro ? (
              <button className="btn-primary flex items-center justify-center gap-2 shrink-0" onClick={handleWhatsApp} disabled={sendingWhatsApp}>
                <MessageCircle className="h-4 w-4" /> {sendingWhatsApp ? 'Preparing…' : 'Send'}
              </button>
            ) : (
              <Link to="/pro" className="btn-primary flex items-center justify-center gap-2 shrink-0">
                <MessageCircle className="h-4 w-4" /> Unlock
              </Link>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-ink-100">
          <button className="btn-secondary w-full" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
