// src/domain/fnb/catalog.js
//
// WHAT A CATALOGUE ROW IS FOR — the separation between a thing you SELL
// and a thing you COOK WITH.
//
// This is the correction the rest of this engine was built on top of and
// did not make. FlowBiz has one `products` collection, and every row in
// it was sellable by construction: the counter's grid is the catalogue,
// filtered by nothing. That is correct for a shop, where every row IS
// merchandise, and it is wrong for a kitchen, where most rows are not.
//
// A restaurant that models its food properly ends up with tomatoes,
// onions, cooking oil, flour and chicken breast in the catalogue —
// because they must be purchased, stocked, counted, wasted and costed —
// and every one of them then appeared on the till as something a cashier
// could ring up at its "selling price", which for an ingredient is a
// number nobody ever meant. The failure mode is not theoretical:
//
//   * tomatoes appear on the counter grid between "Chicken burger" and
//     "Coke", and can be sold;
//   * the form that adds them DEMANDS a selling price above zero, so an
//     owner invents one, and the invented number then flows into menu
//     performance, margin and every report that ranks what sells;
//   * "Add product" is the only door, so the mental model the software
//     teaches its user is that a tomato is a product with a markup.
//
// THE MODEL. Not a second collection — a ROLE on the row.
//
//     sellable    the default, and what every existing row is. It can be
//                 rung up. A shop's entire catalogue is this.
//     ingredient  stocked, purchased, counted, wasted, costed, consumed
//                 by recipes — and NEVER offered for sale. Tomatoes.
//     both        explicitly sold AND used in recipes. A bakery selling
//                 loose flour by the kilo and also baking with it; a bar
//                 selling a bottle of wine whole and also pouring it by
//                 the glass.
//
// WHY A ROLE AND NOT A SECOND COLLECTION. The brief asks for the correct
// domain architecture, and the honest answer is that the distinction is
// about SELLABILITY, not about stock-keeping. Everything FlowBiz already
// does to a product — purchase orders, receiving, stock movements, stock
// takes, batches and expiry, waste, valuation, the FEFO allocator, the
// export, the reset — is *identically* correct for a tomato and for a
// bottle of Coke, and every one of those paths is tested. A second
// collection would fork all of it to express one boolean, and would then
// need a rule, an index, a migration and a merge on every screen that
// counts stock. That is duplicating genuinely common infrastructure,
// which the brief warns against in the same breath as the thing it warns
// against harder.
//
// What was actually wrong was that the distinction did not EXIST and was
// therefore not enforceable anywhere. It now exists, has its own form,
// its own list, and is enforced at the till.
//
// `both` is the brief's explicit requirement that an ingredient which can
// legitimately be sold directly is "an explicit business configuration,
// not an accidental consequence of sharing one generic product table".
//
// ABSENT MEANS SELLABLE. Every product written before this module, in
// every industry, resolves to `sellable` and behaves exactly as it always
// did. The field is written only when it says something other than the
// default, so a hardware shop's documents do not change by one byte.

export const CATALOG_ROLES = Object.freeze({
  SELLABLE: 'sellable',
  INGREDIENT: 'ingredient',
  BOTH: 'both',
});

const KNOWN_ROLES = new Set(Object.values(CATALOG_ROLES));

export const CATALOG_ROLE_LABELS = Object.freeze({
  sellable: 'Menu item',
  ingredient: 'Ingredient',
  both: 'Menu item and ingredient',
});

/**
 * The role of a row. Anything absent, unknown or malformed is SELLABLE,
 * which is both the old behaviour and the safe direction: a row whose
 * role could not be read stays on the till rather than silently vanishing
 * from the menu mid-service.
 */
export function catalogRoleOf(product) {
  const role = product?.catalogRole;
  return KNOWN_ROLES.has(role) ? role : CATALOG_ROLES.SELLABLE;
}

/** May this be rung up? Everything except a pure ingredient. */
export function isSellable(product) {
  return catalogRoleOf(product) !== CATALOG_ROLES.INGREDIENT;
}

/** Is this something a kitchen cooks with rather than sells? */
export function isIngredient(product) {
  return catalogRoleOf(product) !== CATALOG_ROLES.SELLABLE;
}

/** A pure ingredient: stocked, never sold. The tomato. */
export function isIngredientOnly(product) {
  return catalogRoleOf(product) === CATALOG_ROLES.INGREDIENT;
}

/**
 * A PREP ITEM — an ingredient that is itself made from other ingredients.
 * Tomato sauce, pizza dough, a batch of stock. It falls out of the model
 * rather than needing a fourth entity: an ingredient WITH a recipe is by
 * definition something the kitchen produces and then cooks with.
 */
export function isPrepItem(product) {
  return isIngredient(product)
    && Array.isArray(product?.recipe)
    && product.recipe.length > 0;
}

/** Everything the till, the grid and the barcode scanner may offer. */
export function sellableProducts(products) {
  return (products || []).filter(isSellable);
}

/** The ingredient list — what the kitchen buys, counts and wastes. */
export function ingredientProducts(products) {
  return (products || []).filter(isIngredient);
}

/**
 * The write for a role change.
 *
 * ABSENT WHEN IT SAYS NOTHING, with the one exception that matters: a row
 * being edited BACK to sellable must write the field explicitly, or the
 * old role stays behind because the key was merely omitted. That is the
 * same discipline `unit`, `packUnit` and `recipeYield` already follow on
 * this document, and skipping it is how a "product" that was briefly an
 * ingredient stays off the till forever.
 */
export function catalogRoleField(role, { existing = null } = {}) {
  const clean = KNOWN_ROLES.has(role) ? role : CATALOG_ROLES.SELLABLE;
  if (clean !== CATALOG_ROLES.SELLABLE) return { catalogRole: clean };
  // Turning it back off: write the default rather than dropping the key.
  if (existing && catalogRoleOf(existing) !== CATALOG_ROLES.SELLABLE) {
    return { catalogRole: CATALOG_ROLES.SELLABLE };
  }
  return {};
}

/**
 * The guard the till runs before a row reaches a cart or a ticket.
 *
 * Returns a message or null, in the same shape as validateAgainstStock so
 * the counter can treat it as one more reason a line cannot be added.
 * This is the enforcement that makes the role real: hiding a tile is a
 * presentation choice, and a barcode scan, a saved cart restored from
 * yesterday, a deep link or a stale snapshot all reach the cart without
 * ever passing a tile.
 */
export function validateSellable(rows, products) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  for (const row of rows || []) {
    const product = byId.get(row?.productId);
    if (!product) continue;
    if (!isSellable(product)) {
      return `${product.name} is an ingredient, not something you sell. Use it in a recipe instead.`;
    }
  }
  return null;
}

/**
 * The candidates a recipe's component picker offers, ingredients first.
 *
 * A recipe may be built from anything the kitchen holds — that includes a
 * prep item (tomato sauce), which is how recursive recipes work, and it
 * includes a plain sellable row for the business that has not separated
 * its catalogue yet. What it never includes is the item itself, or a
 * service, which has nothing to consume.
 *
 * Returned grouped rather than flat so the form can say WHICH of these
 * is the ingredient and which is a menu item being reused, instead of
 * presenting one undifferentiated list — the exact conflation this
 * module exists to end.
 */
export function recipeComponentGroups(products, { excludeId = null } = {}) {
  const usable = (products || [])
    .filter((p) => p.id !== excludeId && p.kind !== 'service' && !p.deleted)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return [
    { id: 'ingredients', label: 'Ingredients', items: usable.filter(isIngredient) },
    { id: 'menu', label: 'Menu items', items: usable.filter((p) => !isIngredient(p)) },
  ].filter((group) => group.items.length > 0);
}
