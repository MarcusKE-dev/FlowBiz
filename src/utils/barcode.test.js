import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeCode128B, isCode128BEncodable, encodeEan13, isValidEan13,
  ean13CheckDigit, encodeBarcode,
} from './barcode.js';

// ── EAN-13 ───────────────────────────────────────────────────────────

test('the EAN-13 check digit matches the published examples', () => {
  // 4006381333931 is the canonical worked example in the EAN-13 spec.
  assert.equal(ean13CheckDigit('400638133393'), 1);
  // A Kenyan GS1 prefix (616) example, and a UPC-A promoted to EAN-13.
  assert.equal(ean13CheckDigit('978014300723'), 4);
  assert.equal(ean13CheckDigit('590123412345'), 7);
});

test('a barcode with the wrong check digit is rejected, not silently drawn', () => {
  assert.equal(isValidEan13('4006381333931'), true);
  assert.equal(isValidEan13('4006381333930'), false);
  assert.equal(isValidEan13('400638133393'), false, '12 digits is not an EAN-13');
  assert.equal(isValidEan13('40063813339311'), false);
  assert.equal(isValidEan13('400638133393X'), false);
  assert.equal(isValidEan13(''), false);
  assert.equal(isValidEan13(null), false);
});

test('an EAN-13 symbol is exactly 95 modules with the standard guards', () => {
  const { widths, modules, groups, symbology } = encodeEan13('4006381333931');
  assert.equal(symbology, 'ean13');
  assert.equal(modules, 95, 'EAN-13 is always 95 modules wide');
  // Start guard: bar 1, space 1, bar 1.
  assert.deepEqual(widths.slice(0, 3), [1, 1, 1]);
  // End guard: the symbol closes on a bar, and the last three runs are 1,1,1.
  assert.deepEqual(widths.slice(-3), [1, 1, 1]);
  assert.equal(widths.length % 2, 1, 'a symbol that opens and closes on a bar has an odd run count');
  assert.deepEqual(groups, ['4', '006381', '333931']);
});

test('two different EANs produce two different symbols', () => {
  const a = encodeEan13('4006381333931');
  const b = encodeEan13('9780143007234');
  assert.notDeepEqual(a.widths, b.widths);
  assert.equal(a.modules, b.modules);
});

test('encoding an invalid EAN throws rather than producing an unscannable label', () => {
  assert.throws(() => encodeEan13('4006381333930'), /valid EAN-13/);
  assert.throws(() => encodeEan13('hello'), /valid EAN-13/);
});

// ── Code 128 ─────────────────────────────────────────────────────────

test('Code 128 subset B accepts printable ASCII and refuses anything else', () => {
  assert.equal(isCode128BEncodable('FB-000123'), true);
  assert.equal(isCode128BEncodable('Sukari 1kg'), true);
  assert.equal(isCode128BEncodable(''), false);
  assert.equal(isCode128BEncodable('café'), false, 'é is outside subset B');
  assert.equal(isCode128BEncodable('a\nb'), false);
});

test('a Code 128 symbol is 11 modules per symbol plus the 13-module stop', () => {
  const text = 'FB-000123';
  const { widths, modules } = encodeCode128B(text);
  // start + data + checksum, each 11 modules, then the 13-module stop.
  const symbolCount = 1 + text.length + 1;
  assert.equal(modules, symbolCount * 11 + 13);
  assert.equal(widths.length, symbolCount * 6 + 7);
});

test('the Code 128 checksum is position-weighted, so transposition changes the symbol', () => {
  const ab = encodeCode128B('AB');
  const ba = encodeCode128B('BA');
  assert.equal(ab.modules, ba.modules);
  assert.notDeepEqual(ab.widths, ba.widths, 'a positional checksum must distinguish AB from BA');
});

test('a single-character Code 128 encodes cleanly', () => {
  const { modules } = encodeCode128B('A');
  assert.equal(modules, 3 * 11 + 13);
});

test('encoding a non-encodable string throws', () => {
  assert.throws(() => encodeCode128B('café'), /printable ASCII/);
  assert.throws(() => encodeCode128B(''), /printable ASCII/);
});

// ── Automatic choice ─────────────────────────────────────────────────

test('a valid EAN is drawn as an EAN, and everything else as Code 128', () => {
  assert.equal(encodeBarcode('4006381333931').symbology, 'ean13');
  assert.equal(encodeBarcode('FB-000123').symbology, 'code128');
  // A 13-digit string with a bad check digit is not an EAN — but it is
  // still printable ASCII, so it is carried as Code 128 rather than lost.
  assert.equal(encodeBarcode('4006381333930').symbology, 'code128');
});

test('an unprintable or empty code yields null instead of breaking a whole label sheet', () => {
  assert.equal(encodeBarcode(''), null);
  assert.equal(encodeBarcode('   '), null);
  assert.equal(encodeBarcode(null), null);
  assert.equal(encodeBarcode(undefined), null);
  assert.equal(encodeBarcode('café'), null);
});

test('surrounding whitespace on a stored barcode does not change the symbol', () => {
  assert.deepEqual(encodeBarcode('  4006381333931 ').widths, encodeBarcode('4006381333931').widths);
});
