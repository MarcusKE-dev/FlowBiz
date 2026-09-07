import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { Banknote, Smartphone } from 'lucide-react';
import StatementBlock, { StatementRow } from '../ui/StatementBlock';
import Money from '../ui/Money';

export default function RepaymentModal({ open, customer, totalOwed, onClose, onSubmit }) {
  const [amount, setAmount]     = useState('');
  const [method, setMethod]     = useState('Cash');
  const [mpesaCode, setMpesa]   = useState('');
  const [busy, setBusy]         = useState(false);
  // Freeze the outstanding balance the moment we start saving, so a
  // background update to totalOwed mid-submission can't make a correct
  // amount suddenly look like it exceeds the balance.
  const [lockedOwed, setLockedOwed] = useState(totalOwed);

  useEffect(() => { if (open) setLockedOwed(totalOwed); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!customer) return null;
  const numeric = Number(amount) || 0;
  const effectiveOwed = busy ? lockedOwed : totalOwed;
  const overRepayment = numeric > effectiveOwed + 0.005;
  const canSubmit = numeric > 0 && !overRepayment && (method !== 'M-Pesa' || mpesaCode.trim()) && !busy;

  const handle = async e => {
    e.preventDefault();
    setLockedOwed(totalOwed);
    setBusy(true);
    try { await onSubmit({ amount: numeric, method, mpesaCode: method==='M-Pesa'?mpesaCode.trim():null }); setAmount(''); setMpesa(''); onClose(); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Repayment: ${customer.name}`}>
      <form onSubmit={handle} className="space-y-3">
        <StatementBlock>
          <StatementRow label="Outstanding" value={<Money value={effectiveOwed} tone="negative" />} />
        </StatementBlock>
        <div>
          <label className="label">Amount received (KES)</label>
          <input type="number" min="0.01" max={effectiveOwed} step="0.01" className="input" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus disabled={busy} />
          {overRepayment && <p className="mt-1 text-secondary text-danger-700">Amount exceeds the outstanding balance of <Money value={effectiveOwed} />.</p>}
        </div>
        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-2 gap-2">
            {['Cash','M-Pesa'].map(m=>(
              <button key={m} type="button" disabled={busy} onClick={()=>setMethod(m)} className={`flex items-center justify-center gap-1.5 rounded-control border px-3 py-2.5 text-button transition-colors ${method===m?'border-primary-600 bg-primary-50 text-primary-800':'border-line text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}>
                {m==='Cash'?<Banknote className="h-4 w-4" strokeWidth={1.75}/>:<Smartphone className="h-4 w-4" strokeWidth={1.75}/>}{m}
              </button>
            ))}
          </div>
        </div>
        {method==='M-Pesa' && <div><label className="label">M-Pesa code <span className="text-danger-500">*</span></label><input className="input uppercase" disabled={busy} value={mpesaCode} onChange={e=>setMpesa(e.target.value.toUpperCase())} placeholder="QWE1234567" /></div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>{busy?'Saving…':'Record repayment'}</button>
        </div>
      </form>
    </Modal>
  );
}