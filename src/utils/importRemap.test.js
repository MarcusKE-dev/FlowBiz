import test from 'node:test';
import assert from 'node:assert/strict';
import { remapDocumentReferences } from './importRemap.js';

const toId = (collection, id) => `NEW_${id}`;

test('a restored recipe points at the restored ingredients (H17)', () => {
  const product = remapDocumentReferences('products', {
    name: 'Burger',
    recipe: [{ componentId: 'bun', quantity: 1 }, { componentId: 'beef', quantity: 0.15 }],
    modifierGroups: [{ name: 'Extras', options: [{ name: 'Cheese', recipe: [{ componentId: 'cheese', quantity: 1 }] }] }],
  }, toId);
  assert.deepEqual(product.recipe.map((l) => l.componentId), ['NEW_bun', 'NEW_beef']);
  assert.equal(product.modifierGroups[0].options[0].recipe[0].componentId, 'NEW_cheese');
});

test('a restored sale line points at its restored product, batches and ingredients', () => {
  const sale = remapDocumentReferences('sales', {
    customerId: 'c1', orderId: 'o1', lastRefundId: 'r1',
    items: [{
      productId: 'drug',
      batchAllocations: [{ batchId: 'b1', quantity: 2 }],
      componentUsage: [{ productId: 'flour', quantity: 0.5 }],
      modifiers: [{ name: 'Extra', recipe: [{ componentId: 'milk', quantity: 0.05 }] }],
    }],
  }, toId);
  const [line] = sale.items;
  assert.equal(line.productId, 'NEW_drug');
  assert.equal(line.batchAllocations[0].batchId, 'NEW_b1');
  assert.equal(line.componentUsage[0].productId, 'NEW_flour');
  assert.equal(line.modifiers[0].recipe[0].componentId, 'NEW_milk');
  assert.equal(sale.orderId, 'NEW_o1');
  assert.equal(sale.lastRefundId, 'NEW_r1');
});

test('ticket lines, shared documents and stock movements keep their links', () => {
  assert.equal(remapDocumentReferences('orderLines', { orderId: 'o1' }, toId).orderId, 'NEW_o1');
  assert.equal(remapDocumentReferences('sharedDocuments', { documentType: 'invoice', documentId: 'cs1' }, toId).documentId, 'NEW_cs1');
  assert.deepEqual(
    remapDocumentReferences('products', { lastMovement: { kind: 'sales', id: 's1' } }, toId).lastMovement,
    { kind: 'sales', id: 'NEW_s1' }
  );
  assert.equal(
    remapDocumentReferences('productions', { components: [{ componentId: 'flour' }] }, toId).components[0].componentId,
    'NEW_flour'
  );
});
