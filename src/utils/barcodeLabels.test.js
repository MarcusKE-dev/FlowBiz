import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLabelSheet, sheetGrid, SHEET, MAX_COPIES_PER_PRODUCT, MAX_LABELS_PER_JOB,
} from './barcodeLabels.js';

const product = (over = {}) => ({
  id: 'p1', name: 'Sukari 1kg', sellingPrice: 150,
  barcode: '4006381333931', internalCode: 'FB-000001', ...over,
});

test('an A4 sheet holds a whole number of labels that fit inside the margins', () => {
  const { columns, rows, perPage } = sheetGrid();
  assert.equal(perPage, columns * rows);
  assert.ok(SHEET.marginX * 2 + columns * SHEET.labelWidth <= SHEET.pageWidth);
  assert.ok(SHEET.marginY * 2 + rows * SHEET.labelHeight <= SHEET.pageHeight);
  assert.ok(columns >= 4 && rows >= 8, 'the sheet must be worth printing');
});

test('one label per copy, laid out left to right and top to bottom', () => {
  const { pages, total, grid } = buildLabelSheet([{ product: product(), copies: 3 }]);
  assert.equal(total, 3);
  assert.equal(pages.length, 1);
  const [a, b, c] = pages[0].labels;
  assert.equal(a.y, b.y, 'the first two labels share a row');
  assert.ok(b.x > a.x);
  assert.equal(c.x - b.x, b.x - a.x, 'columns are evenly spaced');
  assert.equal(a.x, SHEET.marginX);
  assert.equal(a.y, SHEET.marginY);
  assert.equal(grid.columns >= 2, true);
});

test('labels wrap onto the next row and then the next page', () => {
  const { perPage, columns } = sheetGrid();
  const { pages, total } = buildLabelSheet([{ product: product(), copies: perPage + 1 }]);
  assert.equal(total, perPage + 1);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].labels.length, perPage);
  assert.equal(pages[1].labels.length, 1);
  // The label after a full first row starts a new row back at the margin.
  assert.equal(pages[0].labels[columns].x, SHEET.marginX);
  assert.ok(pages[0].labels[columns].y > pages[0].labels[0].y);
});

test('a part-used sticker sheet can be started partway in', () => {
  const { columns } = sheetGrid();
  const { pages } = buildLabelSheet([{ product: product(), copies: 1 }], { startAt: columns });
  // Skipping a whole row lands the first label at the start of row two.
  assert.equal(pages[0].labels[0].x, SHEET.marginX);
  assert.equal(pages[0].labels[0].y, SHEET.marginY + SHEET.labelHeight);
});

test('a product with no printable code is reported, not silently dropped', () => {
  const { total, skipped } = buildLabelSheet([
    { product: product(), copies: 1 },
    { product: product({ id: 'p2', name: 'Loose beans', barcode: null, internalCode: null }), copies: 5 },
  ]);
  assert.equal(total, 1);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].name, 'Loose beans');
});

test('a product with no barcode falls back to its FlowBiz internal code', () => {
  const { total, pages } = buildLabelSheet([
    { product: product({ barcode: null }), copies: 1 },
  ]);
  assert.equal(total, 1);
  assert.equal(pages[0].labels[0].code, 'FB-000001');
  assert.equal(pages[0].labels[0].symbol.symbology, 'code128');
});

test('a real EAN is drawn as an EAN even when an internal code also exists', () => {
  const { pages } = buildLabelSheet([{ product: product(), copies: 1 }]);
  assert.equal(pages[0].labels[0].symbol.symbology, 'ean13');
  assert.equal(pages[0].labels[0].code, '4006381333931');
});

test('copies are bounded so a typo cannot start a thousand-page print job', () => {
  const huge = buildLabelSheet([{ product: product(), copies: 99999 }]);
  assert.equal(huge.total, MAX_COPIES_PER_PRODUCT);

  const manyProducts = Array.from({ length: 40 }, (_, i) => ({
    product: product({ id: `p${i}`, internalCode: `FB-${String(i).padStart(6, '0')}`, barcode: null }),
    copies: MAX_COPIES_PER_PRODUCT,
  }));
  const capped = buildLabelSheet(manyProducts);
  assert.equal(capped.total, MAX_LABELS_PER_JOB);
  assert.equal(capped.truncated, true);
});

test('zero, negative and fractional copy counts print nothing for that product', () => {
  for (const copies of [0, -3, 0.4, NaN, null, undefined, 'two']) {
    assert.equal(buildLabelSheet([{ product: product(), copies }]).total, 0, `copies=${copies}`);
  }
  assert.equal(buildLabelSheet([{ product: product(), copies: 2.9 }]).total, 2, 'fractions floor');
});

test('an empty or malformed selection produces an empty sheet rather than throwing', () => {
  for (const selection of [[], null, undefined, [null], [{}], [{ product: null, copies: 3 }]]) {
    const sheet = buildLabelSheet(selection);
    assert.equal(sheet.total, 0);
    assert.equal(sheet.pages.length, 0);
  }
});
