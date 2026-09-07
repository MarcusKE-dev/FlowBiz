// src/utils/scannerService.test.js
//
// The barcode-uniqueness advisory. The bug these cover: scanning a
// genuinely new barcode, filling in the product, pressing Add, and being
// told the product already exists with that barcode — while the save
// went through perfectly. Nothing was ever wrong with the data; the form
// was checking against a live catalogue listener that had already been
// handed the product it was in the middle of creating.

import test from 'node:test';
import assert from 'node:assert/strict';
import { findBarcodeClash, findProductByCode } from './scannerService.js';

const catalogue = [
  { id: 'p1', name: 'Wireless Mouse', barcode: '1111111111111', internalCode: 'FB-000001' },
  { id: 'p2', name: 'HDMI Cable', barcode: '2222222222222', internalCode: 'FB-000002' },
  { id: 'p3', name: 'Archived Thing', barcode: '3333333333333', deleted: true },
];

test('a barcode nothing owns is not a clash', () => {
  assert.equal(findBarcodeClash(catalogue, '9780241988268'), null);
});

test('a barcode another product owns IS a clash', () => {
  assert.equal(findBarcodeClash(catalogue, '2222222222222')?.id, 'p2');
});

test('THE BUG: the product being created is not a clash with itself', () => {
  // Firestore applies a write to the local cache the instant commit() is
  // called, so the catalogue listener hands the form the new product
  // seconds before the server acknowledges the save. Without the
  // exclusion the form warns about its own work.
  const code = '9780241988268';
  const afterLocalWrite = [
    ...catalogue,
    { id: 'new1', name: 'Atomic Habits', barcode: code, internalCode: 'FB-000018' },
  ];

  assert.equal(
    findBarcodeClash(afterLocalWrite, code)?.id,
    'new1',
    'without an exclusion the just-written product does look like a clash — this is the trap'
  );
  assert.equal(
    findBarcodeClash(afterLocalWrite, code, { excludeIds: ['new1'] }),
    null,
    'excluding the product this form created removes the false warning'
  );
});

test('editing a product does not clash with its own barcode', () => {
  assert.equal(findBarcodeClash(catalogue, '1111111111111', { excludeIds: ['p1'] }), null);
});

test('editing one product still sees a real clash with another', () => {
  assert.equal(findBarcodeClash(catalogue, '2222222222222', { excludeIds: ['p1'] })?.id, 'p2');
});

test('an archived product does not reserve a barcode', () => {
  assert.equal(findBarcodeClash(catalogue, '3333333333333'), null);
});

test('a blank or whitespace barcode is never a clash', () => {
  for (const value of ['', '   ', null, undefined]) {
    assert.equal(findBarcodeClash(catalogue, value), null);
  }
});

test('surrounding whitespace does not hide a real clash', () => {
  assert.equal(findBarcodeClash(catalogue, '  2222222222222  ')?.id, 'p2');
});

test('undefined ids in the exclusion list are ignored, not matched', () => {
  // `[initialProduct?.id, createdId]` is full of undefined/null on a new
  // form, and a product with no id must not be excluded by accident.
  const withUnidentified = [{ name: 'No id', barcode: '4444444444444' }];
  assert.equal(
    findBarcodeClash(withUnidentified, '4444444444444', { excludeIds: [undefined, null] })?.name,
    'No id'
  );
});

test('an empty or missing catalogue is not a clash', () => {
  assert.equal(findBarcodeClash([], '1111111111111'), null);
  assert.equal(findBarcodeClash(undefined, '1111111111111'), null);
});

// The neighbouring resolver is a DIFFERENT question and keeps its own
// behaviour: it answers "which product is this code?", matching the
// internal code as well, and knows nothing about clashes.
test('findProductByCode still matches barcode and internal code', () => {
  assert.equal(findProductByCode(catalogue, '1111111111111')?.id, 'p1');
  assert.equal(findProductByCode(catalogue, 'fb-000002')?.id, 'p2');
  assert.equal(findProductByCode(catalogue, 'nothing')?.id, undefined);
});
