// src/utils/stockWrites.js
//
// The Firestore adapter for the one inventory foundation, and nothing
// else. It is four lines of real logic on purpose.
//
// utils/inventory.js decides WHAT moves — which product, which version,
// which batch, and by how much — and stays pure so every stock path in
// the application can be tested without a database. This file is the only
// place that turns one of those numbers into a Firestore `increment()`,
// so there is exactly one answer to "how does stock get written".
//
// Everything routes through here: the counter's sale, void and order
// charge; a purchase; a stock take; a cancelled or refunded credit sale;
// a returned cash sale; and the dashboard's quick sale. Before this
// existed there were four separate raw-increment call sites, and three of
// them silently skipped variants, batches and recipes.
//
// The caller always passes its OWN `writeBatch`, so the stock movement
// lands in the same atomic commit as the document that caused it. That
// matters twice over: the two can never diverge, and offline the whole
// thing queues as a single mutation.

import { doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { stockWriteOps } from './inventory';

/**
 * Apply a resolved delta map to a Firestore write batch.
 *
 * `only` optionally restricts the write to a set of product ids — used by
 * the void and return paths, where a product that has since been deleted
 * must be skipped rather than resurrected by an update to a missing
 * document.
 */
export function applyStockDeltas(batch, deltas, { only = null, productFields = null } = {}) {
  const allowed = only ? new Set(only) : null;
  const written = new Set();

  for (const op of stockWriteOps(deltas)) {
    // `productId` rides on a batch op precisely so a skipped product
    // takes its batch rows with it, rather than leaving the batch ledger
    // credited for stock the product document never got back.
    if (allowed && !allowed.has(op.productId ?? op.id)) continue;
    const update = { updatedAt: serverTimestamp() };
    for (const [field, value] of Object.entries(op.fields)) {
      // A dotted path updates one key inside a map without rewriting the
      // rest of it, which is what makes two tills selling two different
      // sizes at the same moment safe.
      update[field] = increment(value);
    }
    // Plain fields the caller wants set on the same product — a purchase's
    // new cost price, a production run's recomputed one. Folded into THIS
    // update rather than added as a second write to the same document, so
    // the batch never contains two operations on one document and the
    // order they apply in can never matter.
    if (productFields && op.collection === 'products' && productFields[op.id]) {
      Object.assign(update, productFields[op.id]);
    }
    if (op.collection === 'products') written.add(op.id);
    batch.update(doc(db, op.collection, op.id), update);
  }

  // A product the caller wants updated that had no movement at all — a
  // purchase of zero, or a repriced item — still gets its fields written.
  for (const [productId, fields] of Object.entries(productFields || {})) {
    if (written.has(productId)) continue;
    if (allowed && !allowed.has(productId)) continue;
    batch.update(doc(db, 'products', productId), { ...fields, updatedAt: serverTimestamp() });
  }
}
