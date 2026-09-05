// src/utils/barcode.js
//
// Barcode SYMBOL ENCODING — turning a code string into a list of bar
// widths. No drawing, no DOM, no PDF: this file answers "which bars?" and
// nothing else, which is what makes it testable against the published
// symbologies rather than by eye.
//
// Two symbologies, because between them they cover what a Kenyan shop
// actually puts on a shelf label:
//
//   EAN-13 — the manufacturer barcode on almost everything that arrives
//   in a carton. Rendering it correctly matters: a scanner will simply
//   refuse a malformed one, and the shop will blame FlowBiz.
//
//   Code 128 (subset B) — everything else, including FlowBiz's own
//   internal FB-000123 codes, which are alphanumeric and therefore cannot
//   be EAN at all.
//
// Nothing here is guessed. The Code 128 width table and the EAN-13
// L/G/R digit patterns are the published ones, and the tests check the
// check-digit arithmetic and the guard patterns against the standard.

// ── Code 128 ─────────────────────────────────────────────────────────
//
// 107 symbols. Each entry is six module counts: bar, space, bar, space,
// bar, space — except the stop pattern, which carries a seventh module
// (the final bar) and so is 13 modules wide rather than 11.
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const CODE128_START_B = 104;
const CODE128_STOP = 106;

/** Code 128 subset B covers ASCII 32..126 — printable, no control codes. */
export function isCode128BEncodable(value) {
  const text = String(value ?? '');
  if (text.length === 0) return false;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 32 || code > 126) return false;
  }
  return true;
}

/**
 * Encode as Code 128 subset B. Returns `{ modules, widths }` where
 * `widths` alternates bar, space, bar, space… starting with a bar, and
 * `modules` is their total — which is what a renderer divides the label
 * width by.
 */
export function encodeCode128B(value) {
  const text = String(value ?? '');
  if (!isCode128BEncodable(text)) {
    throw new Error('Code 128 subset B can only encode printable ASCII characters.');
  }

  const symbols = [CODE128_START_B];
  for (let i = 0; i < text.length; i += 1) {
    // Subset B maps ASCII 32..126 onto symbol values 0..94.
    symbols.push(text.charCodeAt(i) - 32);
  }

  // Checksum: the start value, plus each data value weighted by its
  // 1-based position, modulo 103.
  let checksum = CODE128_START_B;
  for (let i = 1; i < symbols.length; i += 1) checksum += symbols[i] * i;
  symbols.push(checksum % 103);
  symbols.push(CODE128_STOP);

  const widths = [];
  for (const symbol of symbols) {
    for (const digit of CODE128_PATTERNS[symbol]) widths.push(Number(digit));
  }
  return { widths, modules: widths.reduce((a, b) => a + b, 0), symbology: 'code128' };
}

// ── EAN-13 ───────────────────────────────────────────────────────────

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];

// Which of the six left-hand digits use G instead of L. The first digit
// of the code is not drawn as bars at all — it IS this parity pattern.
const EAN_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

/**
 * The EAN-13 check digit for the first twelve digits: alternate weights
 * of 1 and 3 from the left, then whatever brings the total to a multiple
 * of ten.
 */
export function ean13CheckDigit(first12) {
  const digits = String(first12 ?? '').replace(/\D/g, '');
  if (digits.length < 12) throw new Error('EAN-13 needs at least 12 digits to compute a check digit.');
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(value) {
  const digits = String(value ?? '').trim();
  if (!/^\d{13}$/.test(digits)) return false;
  return ean13CheckDigit(digits.slice(0, 12)) === Number(digits[12]);
}

/**
 * Encode a 13-digit EAN. Returns bar/space widths in the same shape as
 * Code 128 so a renderer does not care which symbology it was handed,
 * plus the digit groups a proper EAN label prints under the bars.
 */
export function encodeEan13(value) {
  const digits = String(value ?? '').trim();
  if (!isValidEan13(digits)) {
    throw new Error('Not a valid EAN-13 barcode (13 digits with a correct check digit).');
  }

  const parity = EAN_PARITY[Number(digits[0])];
  let bits = '101'; // start guard
  for (let i = 0; i < 6; i += 1) {
    const digit = Number(digits[i + 1]);
    bits += parity[i] === 'L' ? EAN_L[digit] : EAN_G[digit];
  }
  bits += '01010'; // centre guard
  for (let i = 0; i < 6; i += 1) bits += EAN_R[Number(digits[i + 7])];
  bits += '101'; // end guard

  // Bits to alternating widths. EAN always opens with a bar, so the run
  // lengths line up with the bar/space alternation with no leading zero
  // run to skip.
  const widths = [];
  let run = 0;
  let current = '1';
  for (const bit of bits) {
    if (bit === current) { run += 1; continue; }
    widths.push(run);
    current = bit;
    run = 1;
  }
  widths.push(run);

  return {
    widths,
    modules: widths.reduce((a, b) => a + b, 0),
    symbology: 'ean13',
    text: digits,
    groups: [digits.slice(0, 1), digits.slice(1, 7), digits.slice(7)],
  };
}

/**
 * Encode whatever the product actually has. A valid EAN-13 is drawn as
 * one, because that is what scanners and shelf-edge conventions expect;
 * everything else falls back to Code 128, which can carry it. Returns
 * null rather than throwing when a code cannot be represented at all, so
 * a label sheet can skip one bad product instead of failing entirely.
 */
export function encodeBarcode(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (isValidEan13(text)) return encodeEan13(text);
  if (isCode128BEncodable(text)) return { ...encodeCode128B(text), text };
  return null;
}
