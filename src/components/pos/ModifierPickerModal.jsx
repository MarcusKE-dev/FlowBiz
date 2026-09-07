// src/components/pos/ModifierPickerModal.jsx
//
// "Burger — large, extra cheese, no onions." One screen, big targets,
// the running price always visible, and Add enabled the moment every
// required question is answered.
//
// The price updates as choices are made rather than only at the end,
// because the question the customer asks halfway through is "how much is
// that with bacon" and the person at the till should not have to guess.

import { useMemo, useState } from 'react';
import Modal from '../common/Modal';
import Money from '../ui/Money';
import {
  resolveModifierSelection, modifiedUnitPrice, missingRequiredGroups,
} from '../../utils/modifiers';

// A required single-choice group is pre-answered with its first option:
// "choose a size" almost always means "regular unless told otherwise",
// and pre-selecting removes a tap from every single order.
function defaultSelection(product) {
  const initial = {};
  for (const group of product?.modifierGroups || []) {
    if (group.required && !group.multiple) initial[group.id] = group.options[0]?.id;
  }
  return initial;
}

// Mounted only while a product is being configured — the caller renders
// it conditionally — so its state starts fresh for each item rather than
// being reset by an effect on every open.
export default function ModifierPickerModal({ product, variant, onAdd, onClose }) {
  const [selection, setSelection] = useState(() => defaultSelection(product));
  const [note, setNote] = useState('');

  const basePrice = variant ? variant.sellingPrice : product?.sellingPrice;
  const modifiers = useMemo(
    () => (product ? resolveModifierSelection(product, selection) : []),
    [product, selection]
  );
  const unitPrice = modifiedUnitPrice(basePrice, modifiers);
  const missing = useMemo(
    () => (product ? missingRequiredGroups(product, selection) : []),
    [product, selection]
  );

  if (!product) return null;

  const toggle = (group, optionId) => {
    setSelection((prev) => {
      if (!group.multiple) {
        // Tapping the chosen option again clears it, unless the group has
        // to be answered — then there is nothing to clear it to.
        if (prev[group.id] === optionId && !group.required) {
          const next = { ...prev };
          delete next[group.id];
          return next;
        }
        return { ...prev, [group.id]: optionId };
      }
      const current = Array.isArray(prev[group.id]) ? prev[group.id] : [];
      return {
        ...prev,
        [group.id]: current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      };
    });
  };

  const isChosen = (group, optionId) => {
    const picked = selection[group.id];
    return Array.isArray(picked) ? picked.includes(optionId) : picked === optionId;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={variant ? `${product.name} (${variant.label})` : product.name}
      widthClass="max-w-md"
    >
      <div className="space-y-4">
        <div className="max-h-[46vh] space-y-4 overflow-y-auto pr-1">
          {(product.modifierGroups || []).map((group) => (
            <div key={group.id} className="space-y-1.5">
              <p className="text-label uppercase text-ink-400">
                {group.name}
                {group.required && <span className="ml-1 text-danger-600">required</span>}
                {group.multiple && <span className="ml-1 normal-case text-ink-300">choose any</span>}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {group.options.map((option) => {
                  const chosen = isChosen(group, option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => toggle(group, option.id)}
                      className={`flex items-center justify-between gap-2 rounded-panel border px-3 py-2.5 text-left transition-colors ${
                        chosen
                          ? 'border-primary-600 bg-primary-50 text-primary-800'
                          : 'border-line bg-surface text-ink-700 hover:bg-ink-50'
                      }`}
                    >
                      <span className="min-w-0 truncate text-body font-medium">{option.name}</span>
                      {option.priceDelta !== 0 && (
                        <span className="num shrink-0 text-secondary">
                          {option.priceDelta > 0 ? '+' : '−'}
                          {Math.abs(option.priceDelta)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <label className="label">Note for the kitchen <span className="font-normal normal-case text-ink-400">(optional)</span></label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. well done, no salt"
              maxLength={200}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-body font-semibold text-ink-900"><Money value={unitPrice} /></span>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              disabled={missing.length > 0}
              onClick={() => onAdd({ modifiers, unitPrice, basePrice, note: note.trim() })}
            >
              {missing.length > 0 ? `Choose ${missing[0].name}` : 'Add to order'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
