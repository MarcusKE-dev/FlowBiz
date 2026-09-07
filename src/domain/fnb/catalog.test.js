// src/domain/fnb/catalog.test.js
//
// The ingredient/menu separation, and above all the promise that it costs
// every existing business nothing.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG_ROLES, catalogRoleOf, isSellable, isIngredient, isIngredientOnly,
  isPrepItem, sellableProducts, ingredientProducts, catalogRoleField,
  validateSellable, recipeComponentGroups,
} from './catalog.js';

test('A PRODUCT WITH NO ROLE IS SELLABLE — every row that predates this module', () => {
  // The whole non-F&B estate depends on this line and nothing else.
  assert.equal(catalogRoleOf({ name: 'Hammer' }), CATALOG_ROLES.SELLABLE);
  assert.equal(catalogRoleOf(null), CATALOG_ROLES.SELLABLE);
  assert.equal(catalogRoleOf({ catalogRole: 'nonsense' }), CATALOG_ROLES.SELLABLE);
  assert.equal(isSellable({ name: 'Hammer' }), true);
  assert.equal(isIngredient({ name: 'Hammer' }), false);
});

test('an ingredient is never sellable, and a both is', () => {
  const tomato = { name: 'Tomato', catalogRole: 'ingredient' };
  const flour = { name: 'Flour', catalogRole: 'both' };
  assert.equal(isSellable(tomato), false);
  assert.equal(isIngredientOnly(tomato), true);
  assert.equal(isSellable(flour), true);
  assert.equal(isIngredient(flour), true);
  assert.equal(isIngredientOnly(flour), false);
});

test('a prep item is an ingredient that is itself made — no fourth entity', () => {
  const sauce = { name: 'Tomato sauce', catalogRole: 'ingredient', recipe: [{ componentId: 't', quantity: 5 }] };
  const tomato = { name: 'Tomato', catalogRole: 'ingredient' };
  const burger = { name: 'Burger', recipe: [{ componentId: 'b', quantity: 1 }] };
  assert.equal(isPrepItem(sauce), true);
  assert.equal(isPrepItem(tomato), false);
  // A MENU item with a recipe is a dish, not a prep item.
  assert.equal(isPrepItem(burger), false);
});

test('the till list and the ingredient list partition the catalogue', () => {
  const products = [
    { id: '1', name: 'Burger' },
    { id: '2', name: 'Tomato', catalogRole: 'ingredient' },
    { id: '3', name: 'Flour', catalogRole: 'both' },
  ];
  assert.deepEqual(sellableProducts(products).map((p) => p.id), ['1', '3']);
  assert.deepEqual(ingredientProducts(products).map((p) => p.id), ['2', '3']);
});

test('the role field is ABSENT for a sellable row and written when it is cleared', () => {
  // A shop's product documents must not gain a field.
  assert.deepEqual(catalogRoleField('sellable'), {});
  assert.deepEqual(catalogRoleField(undefined), {});
  assert.deepEqual(catalogRoleField('ingredient'), { catalogRole: 'ingredient' });
  assert.deepEqual(catalogRoleField('both'), { catalogRole: 'both' });
  // …but turning one back must clear it, or the row stays off the till.
  assert.deepEqual(
    catalogRoleField('sellable', { existing: { catalogRole: 'ingredient' } }),
    { catalogRole: 'sellable' },
  );
  assert.deepEqual(catalogRoleField('sellable', { existing: { name: 'Hammer' } }), {});
});

test('THE TILL REFUSES AN INGREDIENT however it reached the cart', () => {
  const products = [
    { id: '1', name: 'Burger' },
    { id: '2', name: 'Tomato', catalogRole: 'ingredient' },
    { id: '3', name: 'Flour', catalogRole: 'both' },
  ];
  assert.equal(validateSellable([{ productId: '1', quantity: 1 }], products), null);
  assert.equal(validateSellable([{ productId: '3', quantity: 1 }], products), null);
  const message = validateSellable([{ productId: '1' }, { productId: '2' }], products);
  assert.match(message, /Tomato is an ingredient/);
  // A row whose product has vanished is validateAgainstStock's problem,
  // not this one's — two guards must not both claim the same failure.
  assert.equal(validateSellable([{ productId: 'gone' }], products), null);
});

test('the component picker separates ingredients from menu items and excludes the item itself', () => {
  const products = [
    { id: '1', name: 'Burger' },
    { id: '2', name: 'Tomato', catalogRole: 'ingredient' },
    { id: '3', name: 'Haircut', kind: 'service' },
    { id: '4', name: 'Old', deleted: true, catalogRole: 'ingredient' },
  ];
  const groups = recipeComponentGroups(products, { excludeId: '1' });
  assert.deepEqual(groups.map((g) => g.id), ['ingredients']);
  assert.deepEqual(groups[0].items.map((p) => p.id), ['2']);
  // With nothing excluded the burger shows up under menu items.
  const all = recipeComponentGroups(products);
  assert.deepEqual(all.map((g) => g.id), ['ingredients', 'menu']);
  assert.deepEqual(all[1].items.map((p) => p.id), ['1']);
});
