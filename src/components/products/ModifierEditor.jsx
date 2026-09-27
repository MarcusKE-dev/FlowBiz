// src/components/products/ModifierEditor.jsx
//
// Modifier groups on a menu item. A group is a question ("Size", "Milk",
// "Extras") and its options are the answers, each of which may add to or
// take off the price.
//
// The options line is comma-separated with an optional "+50" or "-20"
// suffix — "Regular, Large +100, Extra large +200". That is one line of
// typing for what would otherwise be six fields and four taps per option,
// and the person entering it is a café owner on a phone, not a menu
// engineer at a desk.

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { MAX_MODIFIER_GROUPS, MAX_OPTIONS_PER_GROUP } from '../../utils/modifiers';
import { getUnit, DEFAULT_UNIT } from '../../industry/units';

// "Large +100" -> { name: 'Large', priceDelta: 100 }
function parseOption(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(.*?)\s*([+-]\s*\d+(?:\.\d+)?)$/);
  if (!match) return { name: raw.slice(0, 32), priceDelta: 0 };
  const name = match[1].trim();
  if (!name) return { name: raw.slice(0, 32), priceDelta: 0 };
  return { name: name.slice(0, 32), priceDelta: Number(match[2].replace(/\s+/g, '')) || 0 };
}

function formatOption(option) {
  const delta = Number(option?.priceDelta) || 0;
  if (delta === 0) return option?.name || '';
  return `${option.name} ${delta > 0 ? '+' : '-'}${Math.abs(delta)}`;
}

export default function ModifierEditor({ groups, onChange, disabled = false, products = [], showRecipes = false }) {
  const [openOption, setOpenOption] = useState(null);
  const update = (index, patch) =>
    onChange(groups.map((group, i) => (i === index ? { ...group, ...patch } : group)));

  // RETYPING THE LINE MUST NOT FORGET WHAT A CHOICE USES. The options were
  // rebuilt from the text on every keystroke, so an option's id and its
  // ingredient adjustment ("Extra milk" uses 0.05 L of milk) vanished the
  // moment anyone corrected a price. A choice that keeps its name keeps
  // everything the text does not show.
  const setOptions = (index, text) => {
    const previous = new Map((groups[index]?.options || []).map((o) => [String(o?.name || '').trim().toLowerCase(), o]));
    update(index, {
      options: text.split(',').map(parseOption).filter(Boolean).slice(0, MAX_OPTIONS_PER_GROUP).map((option) => {
        const kept = previous.get(option.name.trim().toLowerCase());
        return kept
          ? { ...option, ...(kept.id ? { id: kept.id } : {}), ...(Array.isArray(kept.recipe) ? { recipe: kept.recipe } : {}) }
          : option;
      }),
    });
  };

  const setOptionRecipe = (groupIndex, optionIndex, recipe) => {
    const options = (groups[groupIndex]?.options || []).map((option, i) => {
      if (i !== optionIndex) return option;
      const cleaned = recipe.filter((line) => line.componentId || line.quantity !== '');
      const next = { ...option };
      if (cleaned.length > 0) next.recipe = cleaned;
      else delete next.recipe;
      return next;
    });
    update(groupIndex, { options });
  };

  const ingredients = (products || []).filter((p) => p && !p.deleted && p.kind !== 'service');

  return (
    <div className="space-y-3 rounded-panel border border-line bg-ink-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label uppercase text-ink-500">Options</span>
        {groups.length < MAX_MODIFIER_GROUPS && (
          <button
            type="button"
            className="btn-ghost !px-2 text-primary-700"
            onClick={() => onChange([...groups, { name: '', required: false, multiple: true, options: [] }])}
            disabled={disabled}
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Add group
          </button>
        )}
      </div>

      {groups.length === 0 && (
        <p className="text-secondary text-ink-500">
          Add a group like Size or Extras. Separate the choices with commas, and put a price
          change after any that costs more:
          {' '}<span className="font-mono text-ink-700">Regular, Large +100</span>.
        </p>
      )}

      {groups.map((group, index) => (
        <div key={index} className="space-y-2 rounded-control border border-line bg-surface p-2.5">
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Size"
              value={group.name}
              onChange={(e) => update(index, { name: e.target.value })}
              disabled={disabled}
              aria-label={`Group ${index + 1} name`}
            />
            <button
              type="button"
              className="flex items-center justify-center rounded-control border border-line px-2 text-ink-500 hover:bg-ink-50 hover:text-danger-700"
              onClick={() => onChange(groups.filter((_, i) => i !== index))}
              disabled={disabled}
              aria-label={`Remove group ${index + 1}`}
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <input
            className="input"
            placeholder="Regular, Large +100"
            value={(group.options || []).map(formatOption).join(', ')}
            onChange={(e) => setOptions(index, e.target.value)}
            disabled={disabled}
            aria-label={`Group ${index + 1} choices`}
          />

          {/* WHAT EACH CHOICE USES. "Extra cheese" should take a slice of
              cheese and cost one; "Oat milk" should use oat milk and put the
              dairy back. A negative quantity takes an ingredient OFF the
              recipe. Offered only when the business tracks recipes. */}
          {showRecipes && (group.options || []).length > 0 && (
            <div className="space-y-1.5">
              {(group.options || []).map((option, optionIndex) => {
                const key = `${index}:${optionIndex}`;
                const recipe = Array.isArray(option.recipe) ? option.recipe : [];
                const expanded = openOption === key;
                return (
                  <div key={key} className="rounded-control border border-divider px-2 py-1.5">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-secondary text-ink-700"
                      onClick={() => setOpenOption(expanded ? null : key)}
                      disabled={disabled}
                    >
                      <span>{option.name}</span>
                      <span className="text-ink-500">
                        {recipe.length > 0 ? `uses ${recipe.length} ingredient${recipe.length === 1 ? '' : 's'}` : 'no ingredients'}
                      </span>
                    </button>
                    {expanded && (
                      <div className="mt-2 space-y-1.5">
                        {recipe.map((line, lineIndex) => {
                          const component = ingredients.find((p) => p.id === line.componentId);
                          const unit = component?.unit || DEFAULT_UNIT;
                          return (
                            <div key={lineIndex} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] gap-1.5">
                              <select
                                className="input"
                                value={line.componentId || ''}
                                onChange={(e) => {
                                  const picked = ingredients.find((p) => p.id === e.target.value);
                                  setOptionRecipe(index, optionIndex, recipe.map((l, i) => (i === lineIndex
                                    ? { ...l, componentId: e.target.value, componentName: picked?.name || '', ...(picked?.unit && picked.unit !== DEFAULT_UNIT ? { unit: picked.unit } : {}) }
                                    : l)));
                                }}
                                disabled={disabled}
                                aria-label={`Ingredient for ${option.name}`}
                              >
                                <option value="" disabled>Choose an ingredient</option>
                                {ingredients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="any"
                                  className="input num text-right"
                                  value={line.quantity ?? ''}
                                  onChange={(e) => setOptionRecipe(index, optionIndex, recipe.map((l, i) => (i === lineIndex
                                    ? { ...l, quantity: e.target.value === '' ? '' : Number(e.target.value) }
                                    : l)))}
                                  disabled={disabled}
                                  aria-label={`Quantity for ${option.name}`}
                                />
                                <span className="text-label uppercase text-ink-400">{getUnit(unit).short}</span>
                              </div>
                              <button
                                type="button"
                                className="rounded-control border border-line px-2 text-ink-500 hover:text-danger-700"
                                onClick={() => setOptionRecipe(index, optionIndex, recipe.filter((_, i) => i !== lineIndex))}
                                disabled={disabled}
                                aria-label={`Remove ingredient from ${option.name}`}
                              >
                                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          className="btn-ghost !px-1 text-primary-700"
                          onClick={() => setOptionRecipe(index, optionIndex, [...recipe, { componentId: '', componentName: '', quantity: 1 }])}
                          disabled={disabled || ingredients.length === 0}
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Add ingredient
                        </button>
                        <p className="text-label text-ink-400">Per item. A negative amount takes that ingredient off.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-secondary text-ink-600">
              <input
                type="checkbox"
                checked={group.required === true}
                onChange={(e) => update(index, { required: e.target.checked })}
                disabled={disabled}
              />
              Must be chosen
            </label>
            {!group.required && (
              <label className="flex items-center gap-2 text-secondary text-ink-600">
                <input
                  type="checkbox"
                  checked={group.multiple === true}
                  onChange={(e) => update(index, { multiple: e.target.checked })}
                  disabled={disabled}
                />
                More than one allowed
              </label>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
