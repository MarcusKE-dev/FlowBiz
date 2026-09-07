// src/components/pos/PaymentMethodSelect.jsx
//
// The Cash / M-Pesa / Credit selector. It used to be typed out three
// separate times — in SaleModal, CartCheckoutModal and the Counter's
// desktop checkout column — and had already drifted: two of them were
// green, one was blue, and the Counter labelled Credit "Deni" while the
// modals called it "Credit". One component now, so they cannot drift
// again.
//
// Presentation only. The `id` values are exactly the strings the sale
// handlers already switch on ('Cash' | 'M-Pesa' | 'Credit') and are not
// changed here.

import { Banknote, Smartphone, BookOpen } from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'Cash',   label: 'Cash',   Icon: Banknote   },
  { id: 'M-Pesa', label: 'M-Pesa', Icon: Smartphone },
  { id: 'Credit', label: 'Credit', Icon: BookOpen   },
];

export default function PaymentMethodSelect({ value, onChange, idPrefix = 'pay' }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
      {PAYMENT_METHODS.map(({ id, label, Icon }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            id={`${idPrefix}-${id}`}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={`flex flex-col items-center justify-center gap-1 rounded-control border py-2 text-button transition-colors ${
              selected
                ? 'border-primary-600 bg-primary-50 text-primary-800'
                : 'border-line text-ink-600 hover:bg-ink-50 hover:text-ink-900'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
