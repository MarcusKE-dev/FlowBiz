// src/components/pos/VariantPickerModal.jsx
//
// Tap a t-shirt, choose the size. That is the whole interaction, and it
// is deliberately one screen with big targets rather than a cascade of
// dropdowns — the person using it is standing at a till with a customer
// waiting, often on a phone.
//
// Out-of-stock versions are shown and disabled rather than hidden: "we
// don't have that size" is the single most common thing a boutique
// assistant needs to be able to say, and hiding the row makes them scroll
// looking for something that isn't there.

import { useMemo } from 'react';
import Modal from '../common/Modal';
import Money from '../ui/Money';
import { variantsOf } from '../../utils/variants';
import { formatQuantityWithUnit } from '../../industry/units';

export default function VariantPickerModal({ open, product, onSelect, onClose }) {
  const variants = useMemo(() => (product ? variantsOf(product) : []), [product]);
  if (!product) return null;

  return (
    <Modal open={open} onClose={onClose} title={product.name} widthClass="max-w-md">
      <div className="space-y-3">
        <p className="text-secondary text-ink-500">Choose a version to add to the sale.</p>

        <div className="grid gap-1.5 sm:grid-cols-2">
          {variants.map((variant) => {
            const out = variant.stock <= 0;
            return (
              <button
                key={variant.id}
                type="button"
                disabled={out}
                onClick={() => onSelect(variant)}
                className={`flex items-center justify-between gap-2 rounded-panel border px-3 py-2.5 text-left transition-colors ${
                  out
                    ? 'border-line bg-ink-50 opacity-60'
                    : 'border-line bg-surface hover:border-primary-600 hover:bg-primary-50'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-ink-900">{variant.label}</span>
                  <span className="block text-secondary text-ink-500">
                    {out
                      ? 'Out of stock'
                      : `${formatQuantityWithUnit(variant.stock, product.unit, { showPiece: true })} left`}
                  </span>
                </span>
                <span className="shrink-0 text-body font-semibold text-ink-900">
                  <Money value={variant.sellingPrice} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
