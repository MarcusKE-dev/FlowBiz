import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Printer, Download, MessageCircle, CheckCircle2, Clock } from 'lucide-react';
import Modal from '../common/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { formatKES } from '../../utils/currency';
import { openWhatsApp, buildDebtPaymentReceiptMessage, isValidWhatsAppPhone } from '../../utils/whatsapp';
import { printDebtPaymentReceipt, generateDebtPaymentReceiptPDF } from '../../utils/documentService';

// Shown right after a debt repayment is successfully recorded (never
// before — see CustomerDetail.jsx's handleRepayment). Print/Download/
// WhatsApp are Pro-gated here for the same reason they're Pro-gated on a
// normal sale's receipt (SaleCompleteModal.jsx): that's FlowBiz's existing
// established Pro boundary, not something this feature invents new.
export default function DebtPaymentReceiptModal({ open, receipt, onClose }) {
  const { isPro } = useAuth();
  const { settings } = useSettings();
  const [phone, setPhone] = useState('');

  useEffect(() => { setPhone(receipt?.customerPhone || ''); }, [receipt]);

  if (!receipt) return null;

  const handlePrint = () => {
    if (!isPro) { toast.error('WhatsApp sharing is available on FlowBiz Pro.'); return; }
    printDebtPaymentReceipt(receipt, settings);
  };

  const handleDownload = () => {
    if (!isPro) { toast.error('Professional receipts require FlowBiz Pro.'); return; }
    generateDebtPaymentReceiptPDF(receipt, settings);
  };

  const handleWhatsApp = () => {
    if (!isPro) { toast.error('WhatsApp sharing is available on FlowBiz Pro.'); return; }
    if (!phone.trim() || !isValidWhatsAppPhone(phone)) {
      toast.error('Add a valid phone number for this customer before sending a WhatsApp reminder.');
      return;
    }
    const message = buildDebtPaymentReceiptMessage({
      shopName: settings.shopName || 'FlowBiz Store',
      customerName: receipt.customerName,
      amountPaid: receipt.amountPaid,
      previousBalance: receipt.previousBalance,
      remainingBalance: receipt.remainingBalance,
      isCleared: receipt.isCleared,
      formatKES,
    });
    const opened = openWhatsApp(phone, message);
    toast[opened ? 'success' : 'error'](opened ? 'WhatsApp opened.' : 'WhatsApp could not be opened.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Debt Payment Receipt">
      <div className="space-y-4">
        <div className={`flex flex-col items-center justify-center py-4 rounded-2xl border ${receipt.isCleared ? 'bg-moss-50 border-moss-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${receipt.isCleared ? 'bg-moss-100 text-moss-700' : 'bg-amber-100 text-amber-700'}`}>
            {receipt.isCleared ? <CheckCircle2 className="h-5 w-5" strokeWidth={2} /> : <Clock className="h-5 w-5" strokeWidth={2} />}
          </div>
          <h2 className={`font-display font-bold ${receipt.isCleared ? 'text-moss-800' : 'text-amber-800'}`}>
            {receipt.isCleared ? 'Debt cleared' : 'Partially paid'}
          </h2>
          <p className="text-sm font-semibold mt-2 text-ink-800">{receipt.customerName}</p>
          <p className="text-lg font-bold text-ink-900">{formatKES(receipt.amountPaid)} received</p>
          <p className="text-xs mt-1 font-semibold text-ink-500">
            {receipt.method}{receipt.mpesaCode ? ` · ${receipt.mpesaCode}` : ''}
          </p>
        </div>

        <div className="card divide-y divide-ink-100">
          <Row label="Previous balance" value={formatKES(receipt.previousBalance)} />
          <Row label="Payment received" value={formatKES(receipt.amountPaid)} />
          <Row label="Remaining balance" value={formatKES(receipt.remainingBalance)} bold />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print
          </button>
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download PDF
          </button>
        </div>

        <div className="rounded-lg border border-ink-100 p-3 space-y-2">
          <label className="label">
            Send receipt via WhatsApp {!isPro && <span className="text-amber-600">— PRO</span>}
          </label>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Customer phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {isPro ? (
              <button className="btn-primary flex items-center justify-center gap-2 shrink-0" onClick={handleWhatsApp}>
                <MessageCircle className="h-4 w-4" /> Send
              </button>
            ) : (
              <Link to="/pro" className="btn-primary flex items-center justify-center gap-2 shrink-0">
                <MessageCircle className="h-4 w-4" /> Unlock
              </Link>
            )}
          </div>
        </div>

        <button className="btn-secondary w-full" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${bold ? 'bg-ink-50/60' : ''}`}>
      <span className={bold ? 'font-bold text-ink-900' : 'text-ink-500'}>{label}</span>
      <span className={bold ? 'font-bold text-ink-900' : 'text-ink-700'}>{value}</span>
    </div>
  );
}