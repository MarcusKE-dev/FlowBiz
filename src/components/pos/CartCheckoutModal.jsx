// src/components/pos/CartCheckoutModal.jsx
//
// The payment step for a multi-product cart checkout — conceptually the
// same payment portion SaleModal already had, just applied once to the
// whole cart total instead of one product. Cash/M-Pesa/Credit logic is
// untouched; onConfirmSale/onConfirmCredit are provided by Counter.jsx
// and build the actual Firestore batch (one sale/creditSale doc with all
// cart lines as `items`, one stock decrement per line item).

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { formatKES } from '../../utils/currency';
import { Banknote, Smartphone, BookOpen } from 'lucide-react';
import { raceWithTimeout } from '../../utils/offlineWrite';
import { friendlyErrorMessage } from '../../utils/errorMessages';

const METHODS = [
  { id: 'Cash',   label: 'Cash',   Icon: Banknote   },
  { id: 'M-Pesa', label: 'M-Pesa', Icon: Smartphone },
  { id: 'Credit', label: 'Credit', Icon: BookOpen   },
];

export default function CartCheckoutModal({ open, cart, total, customers, onClose, onConfirmSale, onConfirmCredit, onCreateCustomer }) {
  const [method, setMethod]         = useState('Cash');
  const [mpesaCode, setMpesaCode]   = useState('');
  const [customerId, setCustomerId] = useState('');
  const [newMode, setNewMode]       = useState(false);
  const [newName, setNewName]       = useState('');
  const [newPhone, setNewPhone]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMethod('Cash'); setMpesaCode(''); setCustomerId('');
      setNewMode(false); setNewName(''); setNewPhone('');
    }
  }, [open]);

  if (!open || !cart || cart.length === 0) return null;

  const needsMpesaCode = method === 'M-Pesa' && !mpesaCode.trim();
  const needsCustomer  = method === 'Credit' && !customerId && !(newMode && newName.trim());
  const canSubmit = !needsMpesaCode && !needsCustomer && !submitting;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      let cId = customerId, cName = customers.find(c => c.id === customerId)?.name, cPhone = customers.find(c => c.id === customerId)?.phone;
      if (method === 'Credit' && newMode) {
        const cr = await onCreateCustomer({ name: newName.trim(), phone: newPhone.trim() });
        cId = cr.id; cName = cr.name; cPhone = cr.phone;
      }

      const { record, commit } = method === 'Credit'
        ? onConfirmCredit({ customerId: cId, customerName: cName, customerPhone: cPhone })
        : onConfirmSale({ paymentMethod: method, mpesaCode: method === 'M-Pesa' ? mpesaCode.trim() : null });

      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      if (queuedOffline) {
        toast.success("Sale saved — it'll sync once you're back online.");
        commit.catch((err) => toast.error(`A sale from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      }
      onClose(record);
    } catch (err) {
      toast.error(friendlyErrorMessage(err, {
        overrides: { 'permission-denied': "That didn't go through — stock may have just changed, or today's session may have been closed. Please refresh and try again." },
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose(null)} title="Complete Sale">
      <div className="space-y-4">
        <div className="rounded-lg bg-ink-50 px-3 py-2.5">
          <p className="text-xs text-ink-400 mb-1">{cart.length} product{cart.length !== 1 ? 's' : ''} in cart</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-700">Total</span>
            <span className="font-display text-lg font-bold text-ink-900">{formatKES(total)}</span>
          </div>
        </div>

        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => setMethod(id)} className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-semibold ${method === id ? 'border-moss-600 bg-moss-50 text-moss-800' : 'border-ink-200 text-ink-500'}`}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />{label}
              </button>
            ))}
          </div>
        </div>

        {method === 'M-Pesa' && (
          <div>
            <label className="label">M-Pesa transaction code <span className="text-rust-500">*</span></label>
            <input className="input uppercase" placeholder="e.g. QWE1234567" value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())} />
            {needsMpesaCode && <p className="mt-1 text-xs text-rust-600">Transaction code required for M-Pesa sales.</p>}
          </div>
        )}

        {method === 'Credit' && (
          <div className="space-y-2 rounded-lg border border-ink-100 p-3">
            {!newMode ? (
              <>
                <label className="label">Customer (Deni)</label>
                <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">— Select customer —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
                </select>
                <button type="button" className="text-xs font-semibold text-moss-700 hover:underline" onClick={() => setNewMode(true)}>+ New customer</button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between"><label className="label">New customer</label><button type="button" className="text-xs text-ink-400 hover:underline" onClick={() => setNewMode(false)}>Use existing</button></div>
                <input className="input" placeholder="Customer name" value={newName} onChange={e => setNewName(e.target.value)} />
                <input className="input" placeholder="Phone (07xx...)" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={() => onClose(null)} disabled={submitting}>Back to cart</button>
          <button type="button" className="btn-primary" disabled={!canSubmit} onClick={handleConfirm}>
            {submitting ? 'Recording…' : method === 'Credit' ? 'Record credit' : 'Complete sale'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
