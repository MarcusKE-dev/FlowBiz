// src/components/pos/TicketCheckoutModal.jsx
//
// CHARGING A TICKET. The counter's own checkout modal handles a walk-up
// cart and is deliberately left exactly as it is — a duka's payment step
// must not grow a restaurant's controls.
//
// This one adds the two things a check needs and a shopping basket does
// not:
//
//   THE CHECK BREAKDOWN. Items, discount, service charge, total. A
//   customer reading the bill has to be able to see how the number was
//   arrived at, and so does whoever is charging it.
//
//   SPLIT PAYMENT. Four people paying 2,000 cash and 1,500 M-Pesa is one
//   sale with two tenders, not two sales of half the food each. The
//   tenders must settle the bill EXACTLY: overpayment is refused because
//   change handed back is not money the till received, and underpayment
//   is refused because a partly-paid closed sale is a debt, and FlowBiz
//   already has a correct and separate model for a debt.

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import Modal from '../common/Modal';
import Money from '../ui/Money';
import { formatKES } from '../../utils/currency';
import { raceWithTimeout } from '../../utils/offlineWrite';
import { friendlyErrorMessage } from '../../utils/errorMessages';
import { TENDER_METHODS, MAX_TENDERS, normalizeTenders, tendersTotal, tenderProblem } from '../../utils/tenders';

export default function TicketCheckoutModal({
  open, check, customers = [], onClose, onConfirmSale, onConfirmCredit, onCreateCustomer,
}) {
  const [split, setSplit] = useState(false);
  const [method, setMethod] = useState('Cash');
  const [mpesaCode, setMpesaCode] = useState('');
  const [rows, setRows] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [newMode, setNewMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const total = check?.totalAmount ?? 0;

  useEffect(() => {
    if (!open) return;
    setSplit(false); setMethod('Cash'); setMpesaCode('');
    setCustomerId(''); setNewMode(false); setNewName(''); setNewPhone('');
    // The first split row is pre-filled with the whole bill, so splitting
    // is "take some off this one and add another" rather than typing the
    // total twice.
    setRows([{ method: 'Cash', amount: String(total), reference: '' }]);
  }, [open, total]);

  const tenders = useMemo(
    () => normalizeTenders(rows.map((r) => ({ ...r, amount: Number(r.amount) }))),
    [rows]
  );
  const paid = tendersTotal(tenders);
  const splitProblem = split ? tenderProblem(tenders, total) : null;

  if (!open || !check) return null;

  const needsMpesaCode = !split && method === 'M-Pesa' && !mpesaCode.trim();
  const needsCustomer = !split && method === 'Credit' && !customerId && !(newMode && newName.trim());
  const canSubmit = !submitting && !needsMpesaCode && !needsCustomer && !splitProblem;

  const setRow = (index, patch) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const addRow = () =>
    setRows((current) => {
      if (current.length >= MAX_TENDERS) return current;
      const outstanding = Math.max(0, total - tendersTotal(normalizeTenders(
        current.map((r) => ({ ...r, amount: Number(r.amount) }))
      )));
      return [...current, { method: 'M-Pesa', amount: outstanding > 0 ? String(outstanding) : '', reference: '' }];
    });

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      let result;
      if (!split && method === 'Credit') {
        let id = customerId;
        let name = customers.find((c) => c.id === customerId)?.name;
        let phone = customers.find((c) => c.id === customerId)?.phone;
        if (newMode) {
          const created = await onCreateCustomer({ name: newName.trim(), phone: newPhone.trim() });
          id = created.id; name = created.name; phone = created.phone;
        }
        result = onConfirmCredit({ customerId: id, customerName: name, customerPhone: phone });
      } else {
        result = onConfirmSale({
          tenders: split
            ? tenders
            : [{ method, amount: total, ...(method === 'M-Pesa' ? { reference: mpesaCode.trim() } : {}) }],
          mpesaCode: !split && method === 'M-Pesa' ? mpesaCode.trim() : null,
        });
      }
      const { queuedOffline, error } = await raceWithTimeout(result.commit, 4000);
      if (error) throw error;
      if (queuedOffline) {
        toast.success('Charged offline. It will sync when you reconnect.');
        result.commit.catch((err) => toast.error(`A sale couldn't be saved: ${friendlyErrorMessage(err)}`));
      }
      onClose(result.record);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose(null)} title="Charge this bill">
      <div className="space-y-4">
        <div className="space-y-1 rounded-panel border border-line bg-ink-50 p-3">
          {(check.discountAmount > 0 || check.serviceChargeAmount > 0) && (
            <>
              <div className="flex justify-between text-secondary text-ink-600">
                <span>Items</span><span className="num"><Money value={check.grossAmount} /></span>
              </div>
              {check.discountAmount > 0 && (
                <div className="flex justify-between text-secondary text-danger-700">
                  <span>Discount{check.discount?.reason ? ` · ${check.discount.reason}` : ''}</span>
                  <span className="num">−<Money value={check.discountAmount} /></span>
                </div>
              )}
              {check.serviceChargeAmount > 0 && (
                <div className="flex justify-between text-secondary text-ink-600">
                  <span>Service charge {check.serviceChargeRate}%</span>
                  <span className="num"><Money value={check.serviceChargeAmount} /></span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between border-t border-line pt-1 text-page-title text-ink-900">
            <span className="text-body font-semibold">Total</span>
            <span className="num font-semibold">{formatKES(total)}</span>
          </div>
        </div>

        {!split ? (
          <>
            <div>
              <label className="label">How are they paying?</label>
              <div className="grid grid-cols-3 gap-2">
                {['Cash', 'M-Pesa', 'Credit'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMethod(option)}
                    className={`rounded-control border px-3 py-2 text-button transition-colors ${
                      method === option
                        ? 'border-primary-400 bg-primary-50 text-primary-800'
                        : 'border-line bg-surface text-ink-600 hover:border-ink-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {method === 'M-Pesa' && (
              <div>
                <label className="label">M-Pesa code</label>
                <input className="input" value={mpesaCode} onChange={(e) => setMpesaCode(e.target.value)} />
              </div>
            )}

            {method === 'Credit' && (
              <div className="space-y-2">
                {!newMode ? (
                  <>
                    <label className="label">Which customer?</label>
                    <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                      <option value="">Choose a customer</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button type="button" className="btn-ghost" onClick={() => setNewMode(true)}>
                      <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> New customer
                    </button>
                  </>
                ) : (
                  <>
                    <input className="input" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    <input className="input" placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                    <button type="button" className="btn-ghost" onClick={() => setNewMode(false)}>Choose an existing customer</button>
                  </>
                )}
              </div>
            )}

            <button type="button" className="btn-ghost" onClick={() => setSplit(true)}>
              Split this bill between payments
            </button>
          </>
        ) : (
          <div className="space-y-2">
            <p className="label">Payments</p>
            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  className="input w-32"
                  value={row.method}
                  onChange={(e) => setRow(index, { method: e.target.value })}
                >
                  {TENDER_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  className="input flex-1"
                  value={row.amount}
                  onChange={(e) => setRow(index, { amount: e.target.value })}
                />
                {row.method === 'M-Pesa' && (
                  <input
                    className="input w-32"
                    placeholder="Code"
                    value={row.reference}
                    onChange={(e) => setRow(index, { reference: e.target.value })}
                  />
                )}
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="btn-icon text-ink-400 hover:text-danger-700"
                    aria-label="Remove this payment"
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}

            {rows.length < MAX_TENDERS && (
              <button type="button" className="btn-ghost" onClick={addRow}>
                <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Another payment
              </button>
            )}

            <div className="flex justify-between border-t border-line pt-2 text-secondary">
              <span className="text-ink-600">Paid</span>
              <span className={`num ${Math.abs(paid - total) < 0.005 ? 'text-ink-900' : 'text-danger-700'}`}>
                {formatKES(paid)} of {formatKES(total)}
              </span>
            </div>
            {splitProblem && <p className="text-secondary text-danger-700">{splitProblem}</p>}

            <button type="button" className="btn-ghost" onClick={() => setSplit(false)}>
              One payment instead
            </button>
          </div>
        )}

        <button type="button" className="btn-primary w-full" disabled={!canSubmit} onClick={handleConfirm}>
          {submitting ? 'Charging…' : `Charge ${formatKES(total)}`}
        </button>
      </div>
    </Modal>
  );
}
