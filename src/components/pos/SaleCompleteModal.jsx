import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../common/Modal';
import { generateReceiptPDF, printReceipt, generateInvoicePDF, printInvoice, sendWhatsAppDocument } from '../../utils/documentService';
import { getOrCreateShareLink } from '../../utils/documentSharing';
import { useCloudDocuments } from '../../hooks/useCloudDocuments';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Download, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import StatusPill from '../ui/StatusPill';
import Money from '../ui/Money';
import { formatQuantityWithUnit } from '../../industry/units';
import { saleQuantityLabel, lineItemDetail } from '../../utils/lineItems';

export default function SaleCompleteModal({ open, sale, onClose }) {
  const { settings } = useSettings();
  const { isPro, businessId, profile } = useAuth();
  const { canPublish: canShareLink, blockedMessage } = useCloudDocuments();
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
    // Publishing a public link is a cloud service. Print and Download
    // above are not, and stay available either way.
    if (!canShareLink) {
      toast.error(blockedMessage);
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
        <div className="flex flex-col items-center justify-center gap-2 rounded-panel border border-line bg-surface py-5 text-center">
          <StatusPill tone={sale.isCredit ? 'negative' : 'positive'}>
            {sale.isCredit ? 'Credit sale recorded' : 'Sale recorded'}
          </StatusPill>

          {cartItems ? (
            <div className="mt-1 w-full space-y-1 px-5">
              {cartItems.map((item, idx) => (
                <div key={item.productId || idx} className="flex items-start justify-between gap-3 text-secondary text-ink-700">
                  <span className="min-w-0">
                    {formatQuantityWithUnit(item.quantity, item.unit)} × {item.productName}
                    {/* The version, the choices and any note — absent on
                        every line that has none, so a plain shop's
                        confirmation reads exactly as it always did. */}
                    {lineItemDetail(item) && (
                      <span className="block text-ink-500">{lineItemDetail(item)}</span>
                    )}
                  </span>
                  <Money value={item.lineTotal ?? (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)} className="font-semibold" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-body font-semibold text-ink-800">{saleQuantityLabel(sale)} × {sale.productName}</p>
          )}

          {sale.isCredit && sale.customerName && <p className="text-secondary text-ink-500">{sale.customerName}</p>}
          <p className="num text-money text-ink-900"><Money value={sale.totalAmount} /></p>
          <p className={`text-secondary font-semibold ${sale.isCredit ? 'text-danger-700' : 'text-ink-500'}`}>
            {sale.isCredit ? 'Payment status: unpaid' : sale.paymentMethod}
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

        <div className="rounded-panel border border-line p-3 space-y-2">
          <label className="label">
            WhatsApp {docLabel} {!isPro && <span className="text-warning-700">(Pro)</span>}
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
              <button className="btn-primary flex items-center justify-center gap-2 shrink-0" onClick={handleWhatsApp} disabled={sendingWhatsApp || !canShareLink}>
                <MessageCircle className="h-4 w-4" /> {sendingWhatsApp ? 'Preparing…' : 'Send'}
              </button>
            ) : (
              <Link to="/pro" className="btn-primary flex items-center justify-center gap-2 shrink-0">
                <MessageCircle className="h-4 w-4" /> Unlock
              </Link>
            )}
          </div>
          {!canShareLink && (
            <p className="text-secondary leading-relaxed text-ink-500">{blockedMessage}</p>
          )}
        </div>

        <div className="border-t border-line pt-2">
          <button className="btn-secondary w-full" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
