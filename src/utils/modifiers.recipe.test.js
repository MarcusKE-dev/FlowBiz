import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeModifierGroups } from './modifiers.js';

test('an option keeps its ingredient adjustment through normalisation (H08)', () => {
  const [group] = normalizeModifierGroups([{
    name: 'Milk',
    options: [{ id: 'extra', name: 'Extra milk', priceDelta: 30, recipe: [{ componentId: 'milk', componentName: 'Milk', quantity: '0.05', unit: 'litre' }] }],
  }]);
  assert.deepEqual(group.options[0].recipe, [{ componentId: 'milk', componentName: 'Milk', quantity: 0.05, unit: 'litre' }]);
});

test('a half-filled or zero ingredient line is dropped, a negative one is kept', () => {
  const [group] = normalizeModifierGroups([{
    name: 'Extras',
    options: [{ name: 'No cheese', recipe: [
      { componentId: '', quantity: 1 },
      { componentId: 'cheese', quantity: 0 },
      { componentId: 'cheese', quantity: -1 },
    ] }],
  }]);
  assert.deepEqual(group.options[0].recipe.map((l) => l.quantity), [-1]);
});
