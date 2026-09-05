import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import PaymentMethodSelect from './PaymentMethodSelect';
import { formatKES, roundMoney } from '../../utils/currency';
import { productUnit, normalizeQuantity } from '../../utils/lineItems';
import { DEFAULT_UNIT, unitStep, roundQuantity, getUnit, formatQuantityWithUnit } from '../../industry/units';
import { raceWithTimeout } from '../../utils/offlineWrite';
import { friendlyErrorMessage } from '../../utils/errorMessages';

export default function SaleModal({ open, product, customers, onClose, onConfirmSale, onConfirmCredit, onCreateCustomer }) {
  const [quantity, setQuantity]               = useState(1);
  const [price, setPrice]                     = useState(product?.sellingPrice ?? 0);
  const [method, setMethod]                   = useState('Cash');
  const [mpesaCode, setMpesaCode]             = useState('');
  const [customerId, setCustomerId]           = useState('');
  const [newMode, setNewMode]                 = useState(false);
  const [newName, setNewName]                 = useState('');
  const [newPhone, setNewPhone]               = useState('');
  const [submitting, setSubmitting]           = useState(false);

  useEffect(() => {
    setQuantity(1); setPrice(product?.sellingPrice ?? 0); setMethod('Cash');
    setMpesaCode(''); setCustomerId(''); setNewMode(false); setNewName(''); setNewPhone('');
  }, [product?.id, product?.sellingPrice]);

  if (!product) return null;

  // Unit-aware from here down. With `units` off every product is a piece
  // and normalizeQuantity floors, which is exactly the old behaviour.
  const saleUnit     = productUnit(product);
  const saleQty      = normalizeQuantity(quantity, saleUnit);
  const total        = roundMoney(saleQty * (Number(price) || 0));
  const exceedsStock = product.kind !== 'service' && saleQty > roundQuantity(Number(product.stock) || 0, saleUnit);
  const needsMpesaCode = method === 'M-Pesa' && !mpesaCode.trim();
  const needsCustomer  = method === 'Credit' && !customerId && !(newMode && newName.trim());
  const canSubmit = saleQty > 0 && !exceedsStock && Number(price) >= 0 && !needsMpesaCode && !needsCustomer && !submitting;

const handleConfirm = async () => {
    setSubmitting(true);
    try {
      let cId = customerId, cName = customers.find(c=>c.id===customerId)?.name, cPhone = customers.find(c=>c.id===customerId)?.phone;
      if (method === 'Credit' && newMode) {
        const cr = await onCreateCustomer({ name: newName.trim(), phone: newPhone.trim() });
        cId = cr.id; cName = cr.name; cPhone = cr.phone;
      }

      const { record, commit } = method === 'Credit'
        ? onConfirmCredit({ product, quantity: saleQty, soldPricePerUnit: Number(price), customerId: cId, customerName: cName, customerPhone: cPhone })
        : onConfirmSale({ product, quantity: saleQty, soldPricePerUnit: Number(price), paymentMethod: method, mpesaCode: method === 'M-Pesa' ? mpesaCode.trim() : null });

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
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={() => onClose(null)} title="Record Sale">
      <div className="space-y-4">
        <div className="rounded-panel bg-ink-50 px-3 py-2.5">
          <p className="font-semibold text-ink-800">{product.name}</p>
          <p className="text-secondary text-ink-400">
            In stock: <span className="font-semibold">{formatQuantityWithUnit(product.stock, product.unit, { showPiece: true })}</span>
            {' · '}Default {formatKES(product.sellingPrice)}{saleUnit !== DEFAULT_UNIT ? `/${getUnit(saleUnit).short}` : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">
              Quantity
              {saleUnit !== DEFAULT_UNIT && <span className="ml-1 font-normal normal-case text-ink-400">({getUnit(saleUnit).short})</span>}
            </label>
            <input
              type="number"
              min={unitStep(saleUnit)}
              max={product.stock}
              step={unitStep(saleUnit)}
              inputMode={saleUnit === DEFAULT_UNIT ? 'numeric' : 'decimal'}
              className="input"
              value={quantity}
              onChange={e=>setQuantity(e.target.value)}
            />
            {exceedsStock && <p className="mt-1 text-secondary font-medium text-danger-600">Only {formatQuantityWithUnit(product.stock, product.unit, { showPiece: true })} left.</p>}
          </div>
          <div>
            <label className="label">Price / {saleUnit !== DEFAULT_UNIT ? getUnit(saleUnit).short : 'unit'} (KES)</label>
            <input type="number" min="0" step="0.01" className="input" value={price} onChange={e=>setPrice(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-panel border border-divider px-3 py-2.5">
          <span className="text-body font-medium text-ink-500">Total</span>
          <span className="num font-display text-money font-bold text-ink-900">{formatKES(total)}</span>
        </div>
        <div>
          <label className="label">Payment method</label>
          <PaymentMethodSelect value={method} onChange={setMethod} idPrefix="sale" />
        </div>
        {method === 'M-Pesa' && (
          <div>
            <label className="label">M-Pesa transaction code <span className="text-danger-500">*</span></label>
            <input className="input uppercase" placeholder="e.g. QWE1234567" value={mpesaCode} onChange={e=>setMpesaCode(e.target.value.toUpperCase())} />
            {needsMpesaCode && <p className="mt-1 text-secondary text-danger-600">Transaction code required for M-Pesa sales.</p>}
          </div>
        )}
        {method === 'Credit' && (
          <div className="space-y-2 rounded-panel border border-divider p-3">
            {!newMode ? (
              <>
                <label className="label">Customer (Deni)</label>
                <select className="input" value={customerId} onChange={e=>setCustomerId(e.target.value)}>
                  <option value="">Select a customer</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}</option>)}
                </select>
                <button type="button" className="text-secondary font-medium text-primary-700 hover:underline" onClick={()=>setNewMode(true)}>+ New customer</button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between"><label className="label">New customer</label><button type="button" className="text-secondary text-ink-400 hover:underline" onClick={()=>setNewMode(false)}>Use existing</button></div>
                <input className="input" placeholder="Customer name" value={newName} onChange={e=>setNewName(e.target.value)} />
                <input className="input" placeholder="Phone (07xx...)" value={newPhone} onChange={e=>setNewPhone(e.target.value)} />
              </>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={() => onClose(null)}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!canSubmit} onClick={handleConfirm}>
            {submitting ? 'Recording…' : method==='Credit' ? 'Record credit' : 'Confirm sale'}
          </button>
        </div>
      </div>
    </Modal>
  );
}