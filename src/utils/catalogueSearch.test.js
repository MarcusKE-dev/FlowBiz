import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalogue, activeCategories, DEFAULT_RESULT_LIMIT } from './catalogueSearch.js';

const CATALOGUE = [
  { id: '1', name: 'Sukari 1kg',     category: 'Groceries', barcode: '6001234567890', internalCode: 'FB-000001', stock: 10 },
  { id: '2', name: 'Sukari 2kg',     category: 'Groceries', barcode: '6001234567891', internalCode: 'FB-000002', stock: 0 },
  { id: '3', name: 'Unga Pembe 2kg', category: 'Groceries', barcode: '6009876543210', internalCode: 'FB-000003', stock: 4 },
  { id: '4', name: 'Blue Band 500g', category: 'Dairy',     barcode: null,            internalCode: 'FB-000004', stock: 7 },
];

test('an empty search returns the whole catalogue in its original order', () => {
  const { results, total, truncated } = searchCatalogue(CATALOGUE, { query: '' });
  assert.equal(total, 4);
  assert.equal(truncated, false);
  assert.deepEqual(results.map((p) => p.id), ['1', '2', '3', '4']);
});

test('an exact barcode match is ranked above every partial name match', () => {
  const { results } = searchCatalogue(CATALOGUE, { query: '6001234567891' });
  assert.equal(results[0].id, '2');
});

test('an internal code matches case-insensitively, the way it is typed', () => {
  assert.equal(searchCatalogue(CATALOGUE, { query: 'fb-000003' }).results[0].id, '3');
  assert.equal(searchCatalogue(CATALOGUE, { query: 'FB-000003' }).results[0].id, '3');
});

test('a name prefix outranks a name that merely contains the term', () => {
  const catalogue = [
    { id: 'a', name: 'Kubwa Sukari', stock: 1 },
    { id: 'b', name: 'Sukari Ndogo', stock: 1 },
  ];
  assert.equal(searchCatalogue(catalogue, { query: 'sukari' }).results[0].id, 'b');
});

test('search is whitespace and case tolerant', () => {
  for (const query of ['  SUKARI ', 'sukari', 'Sukari']) {
    assert.equal(searchCatalogue(CATALOGUE, { query }).total, 2);
  }
});

test('a category filter narrows without needing a search term', () => {
  const { results, total } = searchCatalogue(CATALOGUE, { category: 'Dairy' });
  assert.equal(total, 1);
  assert.equal(results[0].id, '4');
  assert.equal(searchCatalogue(CATALOGUE, { category: 'Groceries' }).total, 3);
});

test('category and query combine rather than replace each other', () => {
  const { total } = searchCatalogue(CATALOGUE, { category: 'Groceries', query: 'sukari' });
  assert.equal(total, 2);
  assert.equal(searchCatalogue(CATALOGUE, { category: 'Dairy', query: 'sukari' }).total, 0);
});

test('out-of-stock items are shown by default and can be excluded', () => {
  assert.equal(searchCatalogue(CATALOGUE, { query: 'sukari' }).total, 2);
  assert.equal(searchCatalogue(CATALOGUE, { query: 'sukari', includeOutOfStock: false }).total, 1);
});

test('a supermarket-sized catalogue is capped, and says so', () => {
  const big = Array.from({ length: 4000 }, (_, i) => ({
    id: String(i), name: `Item ${i}`, category: 'Groceries', stock: 1,
  }));
  const { results, total, truncated } = searchCatalogue(big, { query: 'item' });
  assert.equal(total, 4000, 'the true match count must still be reported');
  assert.equal(results.length, DEFAULT_RESULT_LIMIT, 'only a page of tiles is ever rendered');
  assert.equal(truncated, true);
});

test('a cap is not applied when the results already fit', () => {
  const { truncated, results } = searchCatalogue(CATALOGUE, { query: 'sukari' });
  assert.equal(truncated, false);
  assert.equal(results.length, 2);
});

test('the search never throws on a malformed catalogue', () => {
  const messy = [null, undefined, {}, { id: 'x' }, { id: 'y', name: null, barcode: 12345 }];
  assert.doesNotThrow(() => searchCatalogue(messy, { query: 'a' }));
  assert.doesNotThrow(() => searchCatalogue(null, { query: 'a' }));
  assert.doesNotThrow(() => searchCatalogue(undefined, {}));
  assert.equal(searchCatalogue(messy, { query: '12345' }).total, 1, 'a numeric barcode still matches');
});

test('active categories follow the business order, then anything unlisted', () => {
  const cats = activeCategories(CATALOGUE, ['Dairy', 'Groceries', 'Stationery']);
  assert.deepEqual(cats, [
    { name: 'Dairy', count: 1 },
    { name: 'Groceries', count: 3 },
  ]);
});

test('a category with no products is never offered as a filter', () => {
  const cats = activeCategories(CATALOGUE, ['Stationery', 'Frozen']);
  assert.deepEqual(cats, [
    { name: 'Groceries', count: 3 },
    { name: 'Dairy', count: 1 },
  ]);
});
