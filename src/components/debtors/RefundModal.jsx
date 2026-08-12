import { useState } from 'react';
import Modal from '../common/Modal';
import { formatKES } from '../../utils/currency';
import { Banknote, Smartphone } from 'lucide-react';

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
    <Modal open={open} onClose={onClose} title={`Refund — ${creditSale.productName}`}>
      <form onSubmit={handle} className="space-y-3">
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
          Already collected from customer: <span className="font-semibold text-ink-800">{formatKES(amountPaid)}</span>
          <p className="mt-1 text-xs text-ink-400">This amount will be handed back and recorded as money leaving the till. Stock will be restored.</p>
        </div>
        <div>
          <label className="label">Refund via</label>
          <div className="grid grid-cols-2 gap-2">
            {['Cash','M-Pesa'].map(m=>(
              <button key={m} type="button" onClick={()=>setMethod(m)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${method===m?'border-moss-600 bg-moss-50 text-moss-800':'border-ink-200 text-ink-500'}`}>
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