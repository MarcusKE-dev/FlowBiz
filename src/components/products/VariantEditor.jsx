// src/components/products/VariantEditor.jsx
//
// The option editor inside the product form. Two or three option types
// (Size, Colour, …), a handful of values each, and FlowBiz works out the
// combinations — which is the model every boutique POS converged on,
// because nobody wants to type "Black / S", "Black / M", "Black / L"
// eighteen times.
//
// Two things this deliberately does NOT do:
//
//   It does not edit stock. Variant stock moves through the same three
//   doors as every other quantity in FlowBiz — a sale, a purchase, or a
//   stock take — and a form that let an owner type a new number straight
//   over it would be a fourth, untracked one.
//
//   It does not delete stock. Removing a value from the list stops that
//   combination being offered; whatever was counted against it stays in
//   the record. Anything still holding stock is shown, so the shop can
//   see what it has stopped selling rather than losing track of it.

import { useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { generateVariants, orphanedVariantStock, MAX_OPTION_TYPES, MAX_VALUES_PER_OPTION, MAX_VARIANTS } from '../../utils/variants';
import StatusPill from '../ui/StatusPill';

export default function VariantEditor({ options, onChange, product, disabled = false }) {
  const preview = useMemo(
    () => generateVariants(options, product || {}),
    [options, product]
  );
  const orphans = useMemo(
    () => orphanedVariantStock({ ...(product || {}), variants: preview.variants }),
    [product, preview.variants]
  );

  const update = (index, patch) => {
    const next = options.map((option, i) => (i === index ? { ...option, ...patch } : option));
    onChange(next);
  };

  const addOption = () => {
    if (options.length >= MAX_OPTION_TYPES) return;
    onChange([...options, { name: '', values: [] }]);
  };

  const removeOption = (index) => onChange(options.filter((_, i) => i !== index));

  // Values are typed as one comma-separated line. A boutique enters
  // "S, M, L, XL" in one go; a row of chips with an add button would be
  // three times the taps for the same four words.
  const setValues = (index, text) =>
    update(index, { values: text.split(',').map((v) => v.trim()).filter(Boolean).slice(0, MAX_VALUES_PER_OPTION) });

  return (
    <div className="space-y-3 rounded-panel border border-line bg-ink-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label uppercase text-ink-500">Options</span>
        {options.length < MAX_OPTION_TYPES && (
          <button type="button" className="btn-ghost !px-2 text-primary-700" onClick={addOption} disabled={disabled}>
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Add option
          </button>
        )}
      </div>

      {options.length === 0 && (
        <p className="text-secondary text-ink-500">
          Add an option like Size or Colour to stock this product in more than one version.
        </p>
      )}

      {options.map((option, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto]">
          <input
            className="input"
            placeholder="Size"
            value={option.name}
            onChange={(e) => update(index, { name: e.target.value })}
            disabled={disabled}
            aria-label={`Option ${index + 1} name`}
          />
          <input
            className="input"
            placeholder="S, M, L, XL"
            value={(option.values || []).join(', ')}
            onChange={(e) => setValues(index, e.target.value)}
            disabled={disabled}
            aria-label={`Option ${index + 1} values, separated by commas`}
          />
          <button
            type="button"
            className="flex items-center justify-center rounded-control border border-line px-2 text-ink-500 hover:bg-surface hover:text-danger-700"
            onClick={() => removeOption(index)}
            disabled={disabled}
            aria-label={`Remove option ${index + 1}`}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      ))}

      {preview.variants.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-secondary text-ink-600">
            <span className="num font-semibold text-ink-900">{preview.variants.length}</span> version
            {preview.variants.length === 1 ? '' : 's'}
            {preview.variants.length >= MAX_VARIANTS && ' (the maximum)'}. Each keeps its own stock.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {preview.variants.slice(0, 12).map((variant) => (
              <StatusPill key={variant.id} tone="neutral" solid>{variant.label}</StatusPill>
            ))}
            {preview.variants.length > 12 && (
              <StatusPill tone="neutral" solid>+{preview.variants.length - 12} more</StatusPill>
            )}
          </div>
        </div>
      )}

      {orphans.length > 0 && (
        <p className="text-secondary text-warning-800">
          {orphans.length} version{orphans.length === 1 ? '' : 's'} you have removed still hold stock.
          The stock is kept. Count it out with a stock take if it has really gone.
        </p>
      )}
    </div>
  );
}
