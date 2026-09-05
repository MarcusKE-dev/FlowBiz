import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Printer, Download, MessageCircle } from 'lucide-react';
import Modal from '../common/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { formatKES } from '../../utils/currency';
import { openWhatsApp, buildDebtPaymentReceiptMessage, isValidWhatsAppPhone } from '../../utils/whatsapp';
import { printDebtPaymentReceipt, generateDebtPaymentReceiptPDF } from '../../utils/documentService';
import { getOrCreateShareLink } from '../../utils/documentSharing';
import StatementBlock, { StatementRow } from '../ui/StatementBlock';
import StatusPill from '../ui/StatusPill';
import Money from '../ui/Money';

// Shown right after a debt repayment is successfully recorded (never
// before — see CustomerDetail.jsx's handleRepayment).
//
// FIX (Pro-gating correction): View/Print/Download are free on every
// plan — Print and Download used to be gated behind isPro here, which was
// a bug (this app's Pro boundary has never been "can you access your own
// documents", it's specifically the WhatsApp convenience). Only WhatsApp
// sharing stays Pro-gated below.
export default function DebtPaymentReceiptModal({ open, receipt, onClose }) {
  const { isPro, businessId, profile } = useAuth();
  const { settings } = useSettings();
  const [phone, setPhone] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  useEffect(() => { setPhone(receipt?.customerPhone || ''); }, [receipt]);

  if (!receipt) return null;

  const handlePrint = () => printDebtPaymentReceipt(receipt, settings);
  const handleDownload = () => generateDebtPaymentReceiptPDF(receipt, settings);

  const handleWhatsApp = async () => {
    if (!phone.trim() || !isValidWhatsAppPhone(phone)) {
      toast.error('Add a valid phone number for this customer before sending a WhatsApp reminder.');
      return;
    }
    setSendingWhatsApp(true);
    try {
      // receiptDocId is the persisted debtPaymentReceipts/{id} document
      // CustomerDetail.jsx writes in the same batch as the repayment
      // itself (see handleRepayment) — that's what the public link
      // resolves to, so the shared page always reflects the real,
      // already-committed payment, never a value recomputed later.
      const documentUrl = receipt.receiptDocId
        ? await getOrCreateShareLink({
            businessId,
            documentType: 'debtPaymentReceipt',
            documentId: receipt.receiptDocId,
            createdBy: profile?.uid,
          })
        : null;
      const message = buildDebtPaymentReceiptMessage({
        shopName: settings.shopName || 'FlowBiz Store',
        customerName: receipt.customerName,
        amountPaid: receipt.amountPaid,
        previousBalance: receipt.previousBalance,
        remainingBalance: receipt.remainingBalance,
        isCleared: receipt.isCleared,
        documentUrl,
        formatKES,
      });
      const opened = openWhatsApp(phone, message);
      toast[opened ? 'success' : 'error'](opened ? 'WhatsApp opened.' : 'WhatsApp could not be opened.');
    } catch {
      toast.error('Unable to generate the receipt link. Please try again.');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Debt Payment Receipt">
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-2 rounded-panel border border-line bg-surface py-5 text-center">
          <StatusPill tone={receipt.isCleared ? 'positive' : 'caution'}>
            {receipt.isCleared ? 'Debt cleared' : 'Partially paid'}
          </StatusPill>
          <p className="text-body font-semibold text-ink-800">{receipt.customerName}</p>
          <p className="num text-money text-ink-900"><Money value={receipt.amountPaid} /> received</p>
          <p className="text-secondary font-semibold text-ink-500">
            {receipt.method}{receipt.mpesaCode ? ` · ${receipt.mpesaCode}` : ''}
          </p>
        </div>

        <StatementBlock>
          <StatementRow label="Previous balance" value={<Money value={receipt.previousBalance} />} />
          <StatementRow label="Payment received" value={<Money value={receipt.amountPaid} />} />
          <StatementRow label="Remaining balance" value={<Money value={receipt.remainingBalance} tone={receipt.isCleared ? undefined : 'negative'} />} strong />
        </StatementBlock>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print
          </button>
          <button className="btn-outline flex items-center justify-center gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download PDF
          </button>
        </div>

        <div className="rounded-panel border border-line p-3 space-y-2">
          <label className="label">
            Send receipt via WhatsApp {!isPro && <span className="text-warning-700">(Pro)</span>}
          </label>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Customer phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sendingWhatsApp} />
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

        <button className="btn-secondary w-full" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

