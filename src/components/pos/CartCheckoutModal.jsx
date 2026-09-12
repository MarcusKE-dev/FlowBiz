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
import PaymentMethodSelect from './PaymentMethodSelect';
import { formatKES, roundMoney } from '../../utils/currency';
import { raceWithTimeout } from '../../utils/offlineWrite';
import { friendlyErrorMessage } from '../../utils/errorMessages';

export default function CartCheckoutModal({ open, cart, total, customers, onClose, onConfirmSale, onConfirmCredit, onCreateCustomer }) {
  const [method, setMethod]         = useState('Cash');
  const [mpesaCode, setMpesaCode]   = useState('');
  const [customerId, setCustomerId] = useState('');
  const [newMode, setNewMode]       = useState(false);
  const [newName, setNewName]       = useState('');
  const [newPhone, setNewPhone]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editedTotal, setEditedTotal] = useState(roundMoney(Number(total) || 0));

  useEffect(() => {
    if (open) {
      setMethod('Cash'); setMpesaCode(''); setCustomerId('');
      setNewMode(false); setNewName(''); setNewPhone('');
      setEditedTotal(roundMoney(Number(total) || 0));
    }
  }, [open, total]);

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

      const finalTotalAmount = roundMoney(Number(editedTotal) || 0);
      const { record, commit } = method === 'Credit'
        ? onConfirmCredit({ customerId: cId, customerName: cName, customerPhone: cPhone, finalTotalAmount })
        : onConfirmSale({ paymentMethod: method, mpesaCode: method === 'M-Pesa' ? mpesaCode.trim() : null, finalTotalAmount });

      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      if (queuedOffline) {
        toast.success('Sale saved offline. It will sync when you reconnect.');
        commit.catch((err) => toast.error(`A sale from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      }
      onClose(record);
    } catch (err) {
      toast.error(friendlyErrorMessage(err, {
        overrides: { 'permission-denied': "That didn't go through. Stock may have changed, or today's session may be closed. Refresh and try again." },
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose(null)} title="Complete Sale">
      <div className="space-y-4">
        <div className="rounded-panel bg-ink-50 px-3 py-2.5">
          <p className="text-secondary text-ink-400 mb-1">{cart.length} product{cart.length !== 1 ? 's' : ''} in cart</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-body font-semibold text-ink-700">Total</span>
            <div className="flex items-center gap-2">
              <input
                className="input min-w-[140px] text-right"
                type="number"
                min="0"
                step="0.01"
                value={editedTotal}
                onChange={(e) => setEditedTotal(roundMoney(Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <span className="num font-display text-money font-bold text-ink-900">{formatKES(editedTotal)}</span>
          </div>
        </div>

        <div>
          <label className="label">Payment method</label>
          <PaymentMethodSelect value={method} onChange={setMethod} idPrefix="cart" />
        </div>

        {method === 'M-Pesa' && (
          <div>
            <label className="label">M-Pesa transaction code <span className="text-danger-500">*</span></label>
            <input className="input uppercase" placeholder="e.g. QWE1234567" value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())} />
            {needsMpesaCode && <p className="mt-1 text-secondary text-danger-600">Transaction code required for M-Pesa sales.</p>}
          </div>
        )}

        {method === 'Credit' && (
          <div className="space-y-2 rounded-panel border border-divider p-3">
            {!newMode ? (
              <>
                <label className="label">Customer (Deni)</label>
                <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">Select a customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
                </select>
                <button type="button" className="text-secondary font-semibold text-primary-700 hover:underline" onClick={() => setNewMode(true)}>+ New customer</button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between"><label className="label">New customer</label><button type="button" className="text-secondary text-ink-400 hover:underline" onClick={() => setNewMode(false)}>Use existing</button></div>
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
