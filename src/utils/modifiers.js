// src/utils/modifiers.js
//
// Item modifiers — "extra cheese", "no onions", "large", "oat milk".
//
// The model is the one both Square and Loyverse converged on, and it is
// the smallest one that works: a product carries MODIFIER GROUPS, each
// group holds options, each option carries a price delta which may be
// negative ("No cheese −20"). A group is either single-choice or
// multi-choice, and either required or optional.
//
//   product.modifierGroups: [
//     { id, name, required, multiple, options: [{ id, name, priceDelta }] }
//   ]
//
// Groups live on the product rather than in a shared library. A shared
// library is the right shape for a chain with a menu team; it is the
// wrong shape for a café whose owner is defining "milk" once, on the one
// drink that needs it, on a phone. Sharing can be added later without
// changing the stored line item, which is what actually has to be stable.
//
// A chosen modifier is stored ON THE LINE ITEM, with its name and its
// price delta copied in. Not a reference — a copy. A receipt from March
// has to still say "extra cheese +50" after the price of extra cheese
// changes in April.

import { roundMoney } from './currency.js';

export const MAX_MODIFIER_GROUPS = 6;
export const MAX_OPTIONS_PER_GROUP = 20;

function slug(value, fallback) {
  const cleaned = String(value ?? '')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return cleaned || fallback;
}

/**
 * Clean an author-entered modifier definition into something storable.
 * Bounded on every axis; anything unusable is dropped rather than stored.
 */
export function normalizeModifierGroups(rawGroups) {
  const groups = [];
  const usedGroupIds = new Set();

  for (const group of Array.isArray(rawGroups) ? rawGroups : []) {
    if (groups.length >= MAX_MODIFIER_GROUPS) break;
    const name = String(group?.name ?? '').trim().slice(0, 32);
    if (!name) continue;

    let id = group?.id ? slug(group.id, '') : slug(name, `g${groups.length + 1}`);
    while (usedGroupIds.has(id)) id = `${id}-${groups.length + 1}`;

    const options = [];
    const usedOptionIds = new Set();
    for (const option of Array.isArray(group?.options) ? group.options : []) {
      if (options.length >= MAX_OPTIONS_PER_GROUP) break;
      const optionName = String(option?.name ?? '').trim().slice(0, 32);
      if (!optionName) continue;
      let optionId = option?.id ? slug(option.id, '') : slug(optionName, `o${options.length + 1}`);
      while (usedOptionIds.has(optionId)) optionId = `${optionId}-${options.length + 1}`;
      usedOptionIds.add(optionId);
      const delta = Number(option?.priceDelta);
      options.push({
        id: optionId,
        name: optionName,
        priceDelta: Number.isFinite(delta) ? roundMoney(delta) : 0,
      });
    }
    if (options.length === 0) continue;

    usedGroupIds.add(id);
    groups.push({
      id,
      name,
      required: group?.required === true,
      // A required group is single-choice by definition here: "choose a
      // size" is one answer. Allowing required-and-multiple would need a
      // minimum count, and no profile in this project needs one.
      multiple: group?.required === true ? false : group?.multiple === true,
      options,
    });
  }
  return groups;
}

export function hasModifiers(product) {
  return Array.isArray(product?.modifierGroups) && product.modifierGroups.length > 0;
}

/** Does this product force a choice before it can be added to an order? */
export function requiresModifierChoice(product) {
  return hasModifiers(product) && product.modifierGroups.some((group) => group.required === true);
}

/**
 * Turn a `{ groupId: optionId | [optionIds] }` selection into the flat,
 * self-describing list stored on the line item.
 */
export function resolveModifierSelection(product, selection) {
  if (!hasModifiers(product)) return [];
  const chosen = [];
  for (const group of product.modifierGroups) {
    const picked = selection?.[group.id];
    const ids = Array.isArray(picked) ? picked : (picked ? [picked] : []);
    for (const optionId of group.multiple ? ids : ids.slice(0, 1)) {
      const option = group.options.find((o) => o.id === optionId);
      if (!option) continue;
      chosen.push({
        groupId: group.id,
        groupName: group.name,
        id: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
      });
    }
  }
  return chosen;
}

/** The unit price of a line once its modifiers are applied. */
export function modifiedUnitPrice(basePrice, modifiers) {
  const base = Number(basePrice) || 0;
  const delta = (modifiers || []).reduce((sum, m) => sum + (Number(m?.priceDelta) || 0), 0);
  // Never below zero: a stack of "remove" modifiers must not turn a sale
  // into a refund.
  return Math.max(0, roundMoney(base + delta));
}

/** Which required groups have not been answered. Empty means good to go. */
export function missingRequiredGroups(product, selection) {
  if (!hasModifiers(product)) return [];
  return product.modifierGroups
    .filter((group) => group.required)
    .filter((group) => {
      const picked = selection?.[group.id];
      const ids = Array.isArray(picked) ? picked.filter(Boolean) : (picked ? [picked] : []);
      return ids.length === 0;
    });
}

/**
 * A stable suffix for the cart row key, so "Burger, extra cheese" and
 * "Burger, no onions" are two lines rather than one line of quantity two.
 * Sorted, so the same choices made in a different order are the same row.
 */
export function modifierRowKey(modifiers) {
  if (!modifiers || modifiers.length === 0) return '';
  return [...modifiers].map((m) => `${m.groupId}:${m.id}`).sort().join(',');
}

/** "Extra cheese, No onions" — for a cart row, a ticket and a receipt. */
export function describeModifiers(modifiers) {
  return (modifiers || []).map((m) => m.name).join(', ');
}
