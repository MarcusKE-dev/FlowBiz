// src/components/products/RecipeEditor.jsx
//
// What an item is made from. Two shapes, one editor, because they are the
// same data with a different consumption moment:
//
//   MADE TO ORDER (a burger). Selling it takes its ingredients.
//   MADE IN ADVANCE (a loaf). A production run takes the ingredients and
//   adds finished loaves; selling a loaf then takes only the loaf.
//
// Getting that distinction wrong is how a bakery ends up deducting its
// flour twice, so the choice is a plain question on this form rather than
// something inferred. See utils/inventory.js.

import { useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import Money from '../ui/Money';
import { getUnit, unitStep, unitDecimals, DEFAULT_UNIT } from '../../industry/units';
import { recipeProblem } from '../../utils/inventory';
import { recipeComponentGroups } from '../../domain/fnb/catalog';
import { recipeUnitCost } from '../../domain/fnb/costing';

export default function RecipeEditor({
  recipe, onChange, products = [], productId = null,
  producedInAdvance = false, onProducedInAdvanceChange, showProduction = false,
  recipeYield = '', onRecipeYieldChange, shelfLifeDays = '', onShelfLifeDaysChange,
  disabled = false,
}) {
  // A product can never be an ingredient of itself, and a component list
  // should not offer things that are themselves assembled to order.
  //
  // GROUPED, ingredients first. Presenting one flat list of everything is
  // the exact conflation `catalogRole` exists to end: a cook looking for
  // "Tomatoes" had to scroll past "Tomato soup". Both are still offered —
  // a menu item CAN legitimately be a component of another, which is how
  // a sauce made in advance is reused — but the list now says which is
  // which. A business that has marked nothing as an ingredient gets one
  // group called "Menu items" holding exactly what the flat list held.
  const groups = useMemo(
    () => recipeComponentGroups(products, { excludeId: productId }),
    [products, productId]
  );
  const candidates = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Followed down through sub-recipes: a loaf made from a dough made from
  // flour costs the flour, not whatever number sits on the dough.
  const unitCost = useMemo(
    () => recipeUnitCost({ recipe: recipe.map((l) => ({ ...l, quantity: Number(l.quantity) || 0 })) }, products).cost,
    [recipe, products]
  );

  // A recipe that points at itself through another item, or at something
  // since deleted, cannot be sold or made — say so while it is being built.
  const problem = useMemo(() => recipeProblem(
    {
      id: productId || '__new__', name: 'This item',
      recipe: recipe.filter((l) => l.componentId).map((l) => ({ ...l, quantity: Number(l.quantity) || 0 })),
    },
    products,
  ), [recipe, products, productId]);

  const update = (index, patch) =>
    onChange(recipe.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const setComponent = (index, componentId) => {
    const component = products.find((p) => p.id === componentId);
    update(index, { componentId, componentName: component?.name || '', unit: component?.unit || DEFAULT_UNIT });
  };

  return (
    <div className="space-y-3 rounded-panel border border-line bg-ink-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label uppercase text-ink-500">Made from</span>
        <button
          type="button"
          className="btn-ghost !px-2 text-primary-700"
          onClick={() => onChange([...recipe, { componentId: '', componentName: '', quantity: 1 }])}
          disabled={disabled || candidates.length === 0}
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Add ingredient
        </button>
      </div>

      {candidates.length === 0 && (
        <p className="text-secondary text-ink-500">Add the ingredients as products first, then list them here.</p>
      )}

      {recipe.length === 0 && candidates.length > 0 && (
        <p className="text-secondary text-ink-500">
          Leave this empty for an item you buy in and resell. Fill it in for something you make.
        </p>
      )}

      {recipe.map((line, index) => {
        const component = products.find((p) => p.id === line.componentId);
        const unit = component?.unit || DEFAULT_UNIT;
        const quantity = Number(line.quantity) || 0;
        // Half an egg per muffin is a real recipe. Stock of a whole-unit
        // ingredient is then tracked in fractions, which is right — but
        // worth saying, so a count of "11.5 eggs" is not a surprise.
        const fractional = component && unitDecimals(unit) === 0 && quantity > 0 && !Number.isInteger(quantity);
        return (
          <div key={index} className="space-y-1">
          <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,8rem)_auto]">
            <select
              className="input"
              value={line.componentId || ''}
              onChange={(e) => setComponent(index, e.target.value)}
              disabled={disabled}
              aria-label={`Ingredient ${index + 1}`}
            >
              <option value="" disabled>Choose an ingredient</option>
              {groups.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.items.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={unitStep(unit)}
                step={unitStep(unit)}
                className="input num text-right"
                value={line.quantity ?? ''}
                onChange={(e) => update(index, { quantity: e.target.value })}
                disabled={disabled}
                aria-label={`Quantity of ingredient ${index + 1}`}
              />
              <span className="shrink-0 text-label uppercase text-ink-400">{getUnit(unit).short}</span>
            </div>
            <button
              type="button"
              className="flex items-center justify-center rounded-control border border-line px-2 text-ink-500 hover:bg-surface hover:text-danger-700"
              onClick={() => onChange(recipe.filter((_, i) => i !== index))}
              disabled={disabled}
              aria-label={`Remove ingredient ${index + 1}`}
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
          {fractional && (
            <p className="text-secondary text-ink-500">
              {component.name} is counted in whole {getUnit(unit).label.toLowerCase()}s; its stock will go down in fractions.
            </p>
          )}
          </div>
        );
      })}

      {problem && <p className="text-secondary font-medium text-danger-700">{problem}</p>}

      {recipe.length > 0 && (
        <>
          <p className="text-secondary text-ink-600">
            Ingredient cost per item: <span className="font-semibold text-ink-900"><Money value={unitCost} /></span>
          </p>

          {showProduction && (
            <label className="flex items-start gap-2.5 rounded-control bg-surface px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={producedInAdvance}
                onChange={(e) => onProducedInAdvanceChange?.(e.target.checked)}
                disabled={disabled}
              />
              <span className="text-secondary text-ink-600">
                <span className="font-medium text-ink-900">Made in advance.</span> Ingredients come out when
                you record production, and a sale takes from the finished stock. Leave it unticked for
                something assembled to order, where the ingredients come out at the sale.
              </span>
            </label>
          )}

          {showProduction && producedInAdvance && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="label">One batch makes</label>
                <input
                  type="number" min="1" step="1" inputMode="numeric"
                  className="input num"
                  value={recipeYield}
                  onChange={(e) => onRecipeYieldChange?.(e.target.value)}
                  placeholder="1"
                  disabled={disabled}
                />
                <p className="mt-1 text-secondary text-ink-500">The quantities above are per single item.</p>
              </div>
              <div>
                <label className="label">Sellable for (days)</label>
                <input
                  type="number" min="1" step="1" inputMode="numeric"
                  className="input num"
                  value={shelfLifeDays}
                  onChange={(e) => onShelfLifeDaysChange?.(e.target.value)}
                  placeholder="No limit"
                  disabled={disabled}
                />
                <p className="mt-1 text-secondary text-ink-500">Each run is dated, and the oldest sells first.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
