import { useState } from 'react';
import Modal from '../common/Modal';
import { Banknote, Smartphone } from 'lucide-react';
import StatementBlock, { StatementRow } from '../ui/StatementBlock';
import Money from '../ui/Money';

export default function RefundModal({ open, creditSale, onClose, onSubmit }) {
  const [method, setMethod] = useState('Cash');
  const [busy, setBusy]     = useState(false);
  if (!creditSale) return null;
  const amountPaid = Number(creditSale.amountPaid) || 0;
  const handle = async e => {
    e.preventDefault(); setBusy(true);
    try { await onSubmit({ method }); setMethod('Cash'); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Refund: ${creditSale.productName}`}>
      <form onSubmit={handle} className="space-y-3">
        <StatementBlock>
          <StatementRow label="Already collected from customer" value={<Money value={amountPaid} />} />
        </StatementBlock>
        <p className="text-secondary text-ink-500">
          This amount will be handed back and recorded as money leaving the till. Stock will be restored.
        </p>
        <div>
          <label className="label">Refund via</label>
          <div className="grid grid-cols-2 gap-2">
            {['Cash','M-Pesa'].map(m=>(
              <button key={m} type="button" onClick={()=>setMethod(m)} className={`flex items-center justify-center gap-1.5 rounded-control border px-3 py-2.5 text-button transition-colors ${method===m?'border-primary-600 bg-primary-50 text-primary-800':'border-line text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}>
                {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-danger" disabled={busy}>{busy?'Refunding…':'Confirm refund'}</button>
        </div>
      </form>
    </Modal>
  );
}