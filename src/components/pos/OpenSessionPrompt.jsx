import { useState } from 'react';
import toast from 'react-hot-toast';

export default function OpenSessionPrompt({ onOpen }) {
  const [cash, setCash]     = useState('');
  const [mpesa, setMpesa]   = useState('');
  const [busy, setBusy]     = useState(false);
  const handle = async e => {
    e.preventDefault(); setBusy(true);
    try {
      await onOpen({ openingCashFloat: Number(cash)||0, openingMpesaFloat: Number(mpesa)||0 });
    } catch (err) {
      // FIX: previously any failure here was silently swallowed — the
      // button would just stop spinning with no explanation.
      toast.error(err.message || "Couldn't open the counter. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-sm pt-8">
      <div className="card p-6 space-y-4">
        <div className="text-center"><div className="text-3xl mb-2">🏪</div>
          <h2 className="font-display text-lg font-bold text-ink-900">Open today's counter</h2>
          <p className="text-sm text-ink-400 mt-1">Enter starting balances for accurate end-of-day reconciliation.</p>
        </div>
        <form onSubmit={handle} className="space-y-3">
          <div><label className="label">Opening cash float (KES)</label><input type="number" min="0" className="input" value={cash} onChange={e=>setCash(e.target.value)} placeholder="0" autoFocus /></div>
          <div><label className="label">Opening M-Pesa balance (KES)</label><input type="number" min="0" className="input" value={mpesa} onChange={e=>setMpesa(e.target.value)} placeholder="0" /></div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Opening…' : 'Open counter'}</button>
        </form>
      </div>
    </div>
  );
}