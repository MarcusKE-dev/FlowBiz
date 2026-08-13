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

  const total        = (Number(price) || 0) * (Number(quantity) || 0);
  const exceedsStock = Number(quantity) > product.stock;
  const needsMpesaCode = method === 'M-Pesa' && !mpesaCode.trim();
  const needsCustomer  = method === 'Credit' && !customerId && !(newMode && newName.trim());
  const canSubmit = Number(quantity) > 0 && !exceedsStock && Number(price) >= 0 && !needsMpesaCode && !needsCustomer && !submitting;

const handleConfirm = async () => {
    setSubmitting(true);
    try {
      let cId = customerId, cName = customers.find(c=>c.id===customerId)?.name, cPhone = customers.find(c=>c.id===customerId)?.phone;
      if (method === 'Credit' && newMode) {
        const cr = await onCreateCustomer({ name: newName.trim(), phone: newPhone.trim() });
        cId = cr.id; cName = cr.name; cPhone = cr.phone;
      }

      const { record, commit } = method === 'Credit'
        ? onConfirmCredit({ product, quantity: Number(quantity), soldPricePerUnit: Number(price), customerId: cId, customerName: cName, customerPhone: cPhone })
        : onConfirmSale({ product, quantity: Number(quantity), soldPricePerUnit: Number(price), paymentMethod: method, mpesaCode: method === 'M-Pesa' ? mpesaCode.trim() : null });

      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;
      if (queuedOffline) {
        toast.success("Sale saved — it'll sync once you're back online.");
        commit.catch((err) => toast.error(`A sale from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));
      }
      onClose(record);
    } catch (err) {
      toast.error(friendlyErrorMessage(err, {
        overrides: { 'permission-denied': "That didn't go through — the stock may have just changed, or today's session may have been closed. Please refresh and try again." },
      }));
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={() => onClose(null)} title="Record Sale">
      <div className="space-y-4">
        <div className="rounded-lg bg-ink-50 px-3 py-2.5">
          <p className="font-semibold text-ink-800">{product.name}</p>
          <p className="text-xs text-ink-400">In stock: <span className="font-semibold">{product.stock}</span> · Default {formatKES(product.sellingPrice)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity</label>
            <input type="number" min="1" max={product.stock} className="input" value={quantity} onChange={e=>setQuantity(e.target.value)} />
            {exceedsStock && <p className="mt-1 text-xs font-medium text-rust-600">Only {product.stock} left.</p>}
          </div>
          <div>
            <label className="label">Price / unit (KES)</label>
            <input type="number" min="0" step="0.01" className="input" value={price} onChange={e=>setPrice(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5">
          <span className="text-sm font-medium text-ink-500">Total</span>
          <span className="font-display text-lg font-bold text-ink-900">{formatKES(total)}</span>
        </div>
        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(({id,label,Icon}) => (
              <button key={id} type="button" onClick={()=>setMethod(id)} className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-semibold ${method===id ? 'border-moss-600 bg-moss-50 text-moss-800' : 'border-ink-200 text-ink-500'}`}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />{label}
              </button>
            ))}
          </div>
        </div>
        {method === 'M-Pesa' && (
          <div>
            <label className="label">M-Pesa transaction code <span className="text-rust-500">*</span></label>
            <input className="input uppercase" placeholder="e.g. QWE1234567" value={mpesaCode} onChange={e=>setMpesaCode(e.target.value.toUpperCase())} />
            {needsMpesaCode && <p className="mt-1 text-xs text-rust-600">Transaction code required for M-Pesa sales.</p>}
          </div>
        )}
        {method === 'Credit' && (
          <div className="space-y-2 rounded-lg border border-ink-100 p-3">
            {!newMode ? (
              <>
                <label className="label">Customer (Deni)</label>
                <select className="input" value={customerId} onChange={e=>setCustomerId(e.target.value)}>
                  <option value="">— Select customer —</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}</option>)}
                </select>
                <button type="button" className="text-xs font-semibold text-moss-700 hover:underline" onClick={()=>setNewMode(true)}>+ New customer</button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between"><label className="label">New customer</label><button type="button" className="text-xs text-ink-400 hover:underline" onClick={()=>setNewMode(false)}>Use existing</button></div>
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