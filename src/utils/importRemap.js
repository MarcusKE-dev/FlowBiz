// src/utils/importRemap.js
//
// RESTORING INTO A DIFFERENT BUSINESS gives every document a new id, so
// every REFERENCE to a document has to be given the same new id — or the
// restored business is full of pointers into a business it cannot read.
//
// The importer used to remap a handful of top-level fields and the
// product id on sale lines. Everything nested was left behind: a recipe's
// ingredients, a modifier's ingredient adjustment, the batches a line
// was dispensed from, the ingredients it recorded using, a ticket line's
// ticket, a shared document's source. A restored bakery then sold loaves
// whose recipe named flour that did not exist, and consumed nothing.
//
// Pure: `toId(collection, oldId)` is the importer's id rule, passed in.

/** Which collection a shared document's `documentId` lives in. */
const SHARED_DOCUMENT_SOURCE = {
  receipt: 'sales',
  invoice: 'creditSales',
  debtPaymentReceipt: 'debtPaymentReceipts',
};

// Top-level fields that hold the id of a document in another collection.
const TOP_LEVEL = {
  productId: 'products',
  supplierId: 'suppliers',
  customerId: 'customers',
  creditSaleId: 'creditSales',
  saleId: 'sales',
  orderId: 'orders',
  batchId: 'productBatches',
  productionId: 'productions',
  lastRefundId: 'refunds',
  lastRepaymentId: 'repayments',
  lastPaymentId: 'supplierPayments',
  supplierPaymentId: 'supplierPayments',
};

function remapRecipe(recipe, toId) {
  if (!Array.isArray(recipe)) return recipe;
  return recipe.map((line) => (line?.componentId
    ? { ...line, componentId: toId('products', line.componentId) }
    : line));
}

function remapModifiers(modifiers, toId) {
  if (!Array.isArray(modifiers)) return modifiers;
  return modifiers.map((modifier) => (Array.isArray(modifier?.recipe)
    ? { ...modifier, recipe: remapRecipe(modifier.recipe, toId) }
    : modifier));
}

function remapLine(item, toId) {
  if (!item || typeof item !== 'object') return item;
  const out = { ...item };
  if (out.productId) out.productId = toId('products', out.productId);
  if (Array.isArray(out.batchAllocations)) {
    out.batchAllocations = out.batchAllocations.map((a) => (a?.batchId ? { ...a, batchId: toId('productBatches', a.batchId) } : a));
  }
  if (Array.isArray(out.componentUsage)) {
    out.componentUsage = out.componentUsage.map((u) => (u?.productId ? { ...u, productId: toId('products', u.productId) } : u));
  }
  if (Array.isArray(out.modifiers)) out.modifiers = remapModifiers(out.modifiers, toId);
  return out;
}

export function remapDocumentReferences(name, data, toId) {
  const out = { ...data };

  for (const [field, target] of Object.entries(TOP_LEVEL)) {
    if (typeof out[field] === 'string' && out[field]) out[field] = toId(target, out[field]);
  }

  if (out.documentId && SHARED_DOCUMENT_SOURCE[out.documentType]) {
    out.documentId = toId(SHARED_DOCUMENT_SOURCE[out.documentType], out.documentId);
  }

  if (out.lastMovement && typeof out.lastMovement === 'object' && out.lastMovement.kind && out.lastMovement.id) {
    out.lastMovement = { ...out.lastMovement, id: toId(out.lastMovement.kind, out.lastMovement.id) };
  }

  if (Array.isArray(out.items)) out.items = out.items.map((item) => remapLine(item, toId));
  if (Array.isArray(out.batchAllocations)) out.batchAllocations = remapLine({ batchAllocations: out.batchAllocations }, toId).batchAllocations;
  if (Array.isArray(out.componentUsage)) out.componentUsage = remapLine({ componentUsage: out.componentUsage }, toId).componentUsage;
  if (Array.isArray(out.modifiers)) out.modifiers = remapModifiers(out.modifiers, toId);

  // A product's own recipe and the ingredient adjustments on its choices.
  if (Array.isArray(out.recipe)) out.recipe = remapRecipe(out.recipe, toId);
  if (Array.isArray(out.modifierGroups)) {
    out.modifierGroups = out.modifierGroups.map((group) => ({
      ...group,
      options: Array.isArray(group?.options)
        ? group.options.map((option) => (Array.isArray(option?.recipe) ? { ...option, recipe: remapRecipe(option.recipe, toId) } : option))
        : group?.options,
    }));
  }

  // A production run's list of what it consumed.
  if (name === 'productions' && Array.isArray(out.components)) {
    out.components = out.components.map((c) => (c?.componentId ? { ...c, componentId: toId('products', c.componentId) } : c));
  }

  return out;
}
