import { useState } from 'react';
import Modal from '../common/Modal';
import { generateReceiptPDF, printReceipt, generateInvoicePDF, printInvoice, sendWhatsAppDocument } from '../../utils/documentService';
import { useSettings } from '../../hooks/useSettings';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuth } from '../../contexts/AuthContext';
import { formatKES } from '../../utils/currency';
import { Printer, Download, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SaleCompleteModal({ open, sale, onClose }) {
  const { settings } = useSettings();
  const { isPro } = useAuth();
  const online = useOnlineStatus();
  const [phone, setPhone] = useState(sale?.customerPhone || '');
  const [sending, setSending] = useState(false);

  if (!sale) return null;

  const docLabel = sale.isCredit ? 'Invoice' : 'Receipt';

  const handlePrint = () => {
    if (!isPro) { toast.error(`Professional printing requires FlowBiz Pro.`); return; }
    if (sale.isCredit) printInvoice(sale, settings);
    else printReceipt(sale, settings);
  };

  const handleDownload = () => {
    if (!isPro) { toast.error(`Professional ${docLabel.toLowerCase()}s require FlowBiz Pro.`); return; }
    if (sale.isCredit) generateInvoicePDF(sale, settings);
    else generateReceiptPDF(sale, settings);
  };

  const handleWhatsApp = async () => {
    if (!isPro) { toast.error("WhatsApp integration requires FlowBiz Pro."); return; }
    if (!online) {
      toast.error(`You're offline. The ${docLabel.toLowerCase()} was saved. Connect to the internet to send it.`);
      return;
    }
    if (!phone.trim()) {
      toast.error("Please enter a valid customer phone number.");
      return;
    }
    setSending(true);
    try {
      await sendWhatsAppDocument(sale, settings, phone.trim());
      toast.success(`${docLabel} sent successfully via WhatsApp.`);
    } catch (e) {
      toast.error(`Couldn't send ${docLabel.toLowerCase()}. ` + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={sale.isCredit ? 'Credit Sale Recorded' : 'Sale Complete'}>
      <div className="space-y-4">
        <div className={`flex flex-col items-center justify-center py-4 rounded-xl2 border ${sale.isCredit ? 'bg-rust-50 border-rust-200' : 'bg-moss-50 border-moss-200'}`}>
          <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${sale.isCredit ? 'bg-rust-100 text-rust-700' : 'bg-moss-100 text-moss-700'}`}>
            {sale.isCredit ? '⏳' : '✓'}
          </div>
          <h2 className={`font-display font-bold ${sale.isCredit ? 'text-rust-700' : 'text-moss-800'}`}>
            {sale.isCredit ? 'Credit sale recorded' : 'Sale recorded successfully'}
          </h2>
          <p className="text-sm font-semibold mt-2 text-ink-800">{sale.quantity} × {sale.productName}</p>
          {sale.isCredit && sale.customerName && <p className="text-xs text-ink-500">{sale.customerName}</p>}
          <p className="text-lg font-bold text-ink-900">{formatKES(sale.totalAmount)}</p>
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
          <label className="label">WhatsApp {docLabel}</label>
          <div className="flex gap-2">
            <input 
              className="input flex-1" 
              placeholder="Customer Phone" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              disabled={sending}
            />
            <button className="btn-primary flex items-center justify-center gap-2" onClick={handleWhatsApp} disabled={sending}>
              <MessageCircle className="h-4 w-4" /> Send
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-ink-100">
          <button className="btn-secondary w-full" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}