// src/components/pos/DiscountModal.jsx
//
// Money off a bill, with the reason recorded.
//
// WHY THIS EXISTS AS ITS OWN THING rather than letting somebody edit the
// price of the steak: editing the price destroys the record. The sale
// then says the steak cost 1,300, the menu says 1,800, and there is
// nothing anywhere saying a discount was given, by whom, or why. A
// manager cannot answer "how much did we comp last month" from data like
// that, and neither can anyone auditing it.

import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import Money from '../ui/Money';
import SegmentedControl from '../ui/SegmentedControl';
import { DISCOUNT_TYPES, MAX_DISCOUNT_PERCENT, MAX_REASON_LENGTH, discountAmountOn } from '../../domain/fnb/check';

export default function DiscountModal({ open, gross, discount, onClose, onApply }) {
  const [type, setType] = useState(DISCOUNT_TYPES.AMOUNT);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setType(discount?.type || DISCOUNT_TYPES.AMOUNT);
    setValue(discount?.value ? String(discount.value) : '');
    setReason(discount?.reason || '');
  }, [open, discount]);

  if (!open) return null;

  const proposed = { type, value: Number(value) || 0, reason: reason.trim() };
  const amount = discountAmountOn(gross, proposed);
  // A discount with no reason is a discount nobody can review later, so
  // the reason is required rather than optional.
  const ready = amount > 0 && reason.trim().length > 0;

  return (
    <Modal open={open} onClose={() => onClose(false)} title="Give a discount">
      <div className="space-y-4">
        <SegmentedControl
          ariaLabel="Discount type"
          value={type}
          onChange={setType}
          options={[
            { value: DISCOUNT_TYPES.AMOUNT, label: 'Amount' },
            { value: DISCOUNT_TYPES.PERCENT, label: 'Percent' },
          ]}
        />

        <div>
          <label className="label">
            {type === DISCOUNT_TYPES.PERCENT ? 'Percentage off' : 'Amount off'}
          </label>
          <input
            type="number"
            min="0"
            max={type === DISCOUNT_TYPES.PERCENT ? MAX_DISCOUNT_PERCENT : undefined}
            step={type === DISCOUNT_TYPES.PERCENT ? 1 : 0.01}
            inputMode="decimal"
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="label">Why</label>
          <input
            className="input"
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. main came out cold"
          />
          <p className="mt-1 text-secondary text-ink-500">
            Recorded on the sale, with your name.
          </p>
        </div>

        <div className="space-y-1 rounded-panel border border-line bg-ink-50 p-3">
          <div className="flex justify-between text-secondary text-ink-600">
            <span>Bill</span><span className="num"><Money value={gross} /></span>
          </div>
          <div className="flex justify-between text-secondary text-danger-700">
            <span>Discount</span><span className="num">−<Money value={amount} /></span>
          </div>
          <div className="flex justify-between border-t border-line pt-1 text-body font-semibold text-ink-900">
            <span>After discount</span>
            <span className="num"><Money value={Math.max(0, gross - amount)} /></span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary flex-1" disabled={!ready} onClick={() => onApply(proposed)}>
            Apply discount
          </button>
          {discount && (
            <button type="button" className="btn-ghost" onClick={() => onApply(null)}>
              Remove discount
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
