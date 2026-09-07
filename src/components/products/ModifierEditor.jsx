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

import { Plus, X } from 'lucide-react';
import { MAX_MODIFIER_GROUPS, MAX_OPTIONS_PER_GROUP } from '../../utils/modifiers';

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

export default function ModifierEditor({ groups, onChange, disabled = false }) {
  const update = (index, patch) =>
    onChange(groups.map((group, i) => (i === index ? { ...group, ...patch } : group)));

  const setOptions = (index, text) =>
    update(index, {
      options: text.split(',').map(parseOption).filter(Boolean).slice(0, MAX_OPTIONS_PER_GROUP),
    });

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
