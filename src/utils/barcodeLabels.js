// src/utils/barcodeLabels.js
//
// Shelf and product labels, as an A4 PDF through the jsPDF pipeline the
// receipts already use — so labels print on whatever printer the shop
// already has, and work offline, with no new dependency and no new
// service.
//
// The layout maths is separated from the drawing on purpose. Working out
// how many labels fit on a page and where each one goes is arithmetic
// that can be wrong in ways nobody notices until 200 sheets are wasted,
// so it lives in a pure function with tests. The jsPDF half only fills in
// rectangles it is told about.

import { encodeBarcode } from './barcode.js';
import { formatKES } from './currency.js';
import { formatQuantityWithUnit } from '../industry/units.js';

// A4, and a label size that fits four across without crowding the code.
export const SHEET = {
  pageWidth: 210,
  pageHeight: 297,
  marginX: 9,
  marginY: 10,
  labelWidth: 48,
  labelHeight: 30,
  gutterX: 0,
  gutterY: 0,
};

export const MAX_COPIES_PER_PRODUCT = 100;
export const MAX_LABELS_PER_JOB = 900; // 25 A4 sheets — a deliberate ceiling.

/**
 * How many labels fit across and down one page.
 */
export function sheetGrid(sheet = SHEET) {
  const usableWidth = sheet.pageWidth - sheet.marginX * 2;
  const usableHeight = sheet.pageHeight - sheet.marginY * 2;
  const columns = Math.max(1, Math.floor((usableWidth + sheet.gutterX) / (sheet.labelWidth + sheet.gutterX)));
  const rows = Math.max(1, Math.floor((usableHeight + sheet.gutterY) / (sheet.labelHeight + sheet.gutterY)));
  return { columns, rows, perPage: columns * rows };
}

/**
 * Expand a selection into the individual labels to print, then lay them
 * out page by page.
 *
 * `selection` is `[{ product, copies }]`. Products with no printable code
 * are skipped and reported in `skipped` rather than silently dropped —
 * a shop that asked for 40 labels and got 30 deserves to be told which
 * ten were missing a barcode.
 */
export function buildLabelSheet(selection, { sheet = SHEET, startAt = 0 } = {}) {
  const grid = sheetGrid(sheet);
  const labels = [];
  const skipped = [];

  for (const entry of selection || []) {
    const product = entry?.product;
    if (!product) continue;
    const copies = Math.min(MAX_COPIES_PER_PRODUCT, Math.max(0, Math.floor(Number(entry.copies) || 0)));
    if (copies === 0) continue;

    const code = product.barcode || product.internalCode || '';
    const symbol = encodeBarcode(code);
    if (!symbol) {
      skipped.push({ id: product.id, name: product.name, reason: 'No printable barcode or internal code.' });
      continue;
    }
    for (let i = 0; i < copies; i += 1) {
      if (labels.length >= MAX_LABELS_PER_JOB) break;
      labels.push({ product, symbol, code });
    }
    if (labels.length >= MAX_LABELS_PER_JOB) break;
  }

  // `startAt` skips label positions on the first page, so a part-used
  // sheet of sticker stock is not thrown away.
  const offset = Math.max(0, Math.min(grid.perPage - 1, Math.floor(Number(startAt) || 0)));

  const pages = [];
  let index = offset;
  let current = null;
  for (const label of labels) {
    const slot = index % grid.perPage;
    if (slot === 0 || current === null) {
      current = { labels: [] };
      pages.push(current);
    }
    const column = slot % grid.columns;
    const row = Math.floor(slot / grid.columns);
    current.labels.push({
      ...label,
      x: sheet.marginX + column * (sheet.labelWidth + sheet.gutterX),
      y: sheet.marginY + row * (sheet.labelHeight + sheet.gutterY),
      width: sheet.labelWidth,
      height: sheet.labelHeight,
    });
    index += 1;
  }

  return { pages, grid, total: labels.length, skipped, truncated: labels.length >= MAX_LABELS_PER_JOB };
}

// ── Drawing ──────────────────────────────────────────────────────────

function drawLabel(doc, label, { showPrice = true, shopName = '' } = {}) {
  const { product, symbol, x, y, width, height } = label;

  const padX = 2.5;
  const innerWidth = width - padX * 2;

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const name = doc.splitTextToSize(String(product.name || ''), innerWidth).slice(0, 2);
  doc.text(name, x + padX, y + 4);

  if (showPrice) {
    doc.setFontSize(9);
    doc.text(formatKES(product.sellingPrice), x + padX, y + 4 + name.length * 3.2 + 3);
    if (product.unit && product.unit !== 'piece') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(110, 110, 110);
      doc.text(`per ${formatQuantityWithUnit(1, product.unit, { showPiece: true }).replace('1 ', '')}`,
        x + padX + 26, y + 4 + name.length * 3.2 + 3);
    }
  }

  // Bars. `symbol.modules` is the total module count, so one module maps
  // to a fixed fraction of the label width whichever symbology this is.
  const barsTop = y + height - 11;
  const barsHeight = 6.5;
  const moduleWidth = innerWidth / symbol.modules;
  let cursor = x + padX;
  let isBar = true;
  doc.setFillColor(0, 0, 0);
  for (const runLength of symbol.widths) {
    const runWidth = runLength * moduleWidth;
    if (isBar) doc.rect(cursor, barsTop, runWidth, barsHeight, 'F');
    cursor += runWidth;
    isBar = !isBar;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(40, 40, 40);
  doc.text(label.code, x + width / 2, barsTop + barsHeight + 3, { align: 'center' });

  if (shopName) {
    doc.setFontSize(5);
    doc.setTextColor(150, 150, 150);
    doc.text(shopName.slice(0, 28), x + width / 2, y + height - 0.8, { align: 'center' });
  }
}

async function buildSheetDocument(selection, options = {}) {
  const { jsPDF } = await import('jspdf');
  const sheet = buildLabelSheet(selection, options);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  sheet.pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) doc.addPage();
    for (const label of page.labels) drawLabel(doc, label, options);
  });

  // jsPDF starts with one page whether or not anything was drawn on it.
  return { doc, sheet };
}

export async function printBarcodeLabels(selection, options = {}) {
  const { doc, sheet } = await buildSheetDocument(selection, options);
  if (sheet.total === 0) return sheet;
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
  return sheet;
}

export async function downloadBarcodeLabels(selection, options = {}) {
  const { doc, sheet } = await buildSheetDocument(selection, options);
  if (sheet.total === 0) return sheet;
  doc.save(`barcode-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
  return sheet;
}
