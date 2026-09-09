// src/industry/units.js
//
// The unit-of-measure catalogue, kept deliberately short. Every unit here
// is one a Kenyan shop actually prices against — cable by the metre,
// nails by the kilo, paint by the litre, timber by the foot. Nothing was
// added because a competitor's dropdown had it.
//
// `decimals` is the ONLY thing that changes behaviour: it is the number of
// decimal places a quantity in this unit may carry, and 0 means the
// existing whole-number workflow, unchanged. `piece` is the default for
// every product that has never been given a unit, so a business that
// never turns `units` on behaves exactly as FlowBiz always has.
//
// Three decimals, not two, and not floating point tolerance by luck:
// 2.5 m of cable and 3.125 kg of nails are both real, 1/1000 of a metre is
// a millimetre, and quantities are rounded through roundQuantity() at
// every boundary the same way money is rounded through roundMoney().

export const UNIT_GROUPS = [
  { id: 'count',  label: 'Count'  },
  { id: 'length', label: 'Length' },
  { id: 'mass',   label: 'Mass'   },
  { id: 'volume', label: 'Volume' },
];

export const UNITS = {
  piece:      { id: 'piece',      label: 'Piece',      short: 'pc',  group: 'count',  decimals: 0 },
  pair:       { id: 'pair',       label: 'Pair',       short: 'pr',  group: 'count',  decimals: 0 },
  box:        { id: 'box',        label: 'Box',        short: 'box', group: 'count',  decimals: 0 },
  carton:     { id: 'carton',     label: 'Carton',     short: 'ctn', group: 'count',  decimals: 0 },

  // Drinks trade. Three units, each one a thing a Kenyan bar or liquor
  // shop actually counts, and no more than that.
  //
  //   bottle — what a wines-and-spirits shop sells one of, and what a bar
  //     receives its spirits in. A standard Kenyan spirit bottle is 750ml.
  //   crate  — the returnable beer crate. Tusker 500ml ships 25 to the
  //     crate, which is why a crate is a COUNT of bottles and not a
  //     volume: a shop receives "three crates" and sells single bottles.
  //   tot    — the measured spirit pour. Kenyan bars pour a 25ml or 30ml
  //     tot from a 750ml bottle, so a bottle is 30 or 25 tots. The tot is
  //     the unit stock is held in when a bar sells by the shot; how many
  //     of them come out of a bottle is the product's pack size, not a
  //     constant here, because 25ml and 30ml houses both exist.
  //
  //     THE TOT IS THE ONE COUNT UNIT THAT DIVIDES, and it carries three
  //     decimals for that reason. Its two siblings do not: half a bottle
  //     of Tusker and half a crate are not things a bar can hold, so
  //     receiving half a crate of 25 lands on 12 whole bottles. But a tot
  //     is a measure of LIQUID, and half of it is 12.5ml sitting in the
  //     same bottle it was always in. Two cases make this load-bearing:
  //     a cocktail recipe calling for 1.5 tots of gin, which at zero
  //     decimals truncated to 1 and under-deducted the bottle on every
  //     round; and half a bottle received, which is 12.5 tots of gin and
  //     not 12. Rounding a pour to a whole shot is not conservatism, it
  //     is a stock count that walks away from the bar a little further
  //     every night.
  bottle:     { id: 'bottle',     label: 'Bottle',     short: 'btl', group: 'count',  decimals: 0 },
  crate:      { id: 'crate',      label: 'Crate',      short: 'crt', group: 'count',  decimals: 0 },
  tot:        { id: 'tot',        label: 'Tot / shot', short: 'tot', group: 'count',  decimals: 3 },

  metre:      { id: 'metre',      label: 'Metre',      short: 'm',   group: 'length', decimals: 3 },
  centimetre: { id: 'centimetre', label: 'Centimetre', short: 'cm',  group: 'length', decimals: 1 },
  foot:       { id: 'foot',       label: 'Foot',       short: 'ft',  group: 'length', decimals: 2 },
  inch:       { id: 'inch',       label: 'Inch',       short: 'in',  group: 'length', decimals: 2 },

  kilogram:   { id: 'kilogram',   label: 'Kilogram',   short: 'kg',  group: 'mass',   decimals: 3 },
  gram:       { id: 'gram',       label: 'Gram',       short: 'g',   group: 'mass',   decimals: 1 },

  litre:      { id: 'litre',      label: 'Litre',      short: 'L',   group: 'volume', decimals: 3 },
  millilitre: { id: 'millilitre', label: 'Millilitre', short: 'ml',  group: 'volume', decimals: 1 },
};

export const DEFAULT_UNIT = 'piece';
export const UNIT_IDS = Object.keys(UNITS);

/**
 * The unit record for a product. Anything unknown, missing or malformed
 * resolves to `piece` — a product written before units existed, or by an
 * older client, must never render as broken.
 */
export function getUnit(unitId) {
  return UNITS[unitId] || UNITS[DEFAULT_UNIT];
}

export function unitOf(product) {
  return getUnit(product?.unit);
}

/** How many decimal places quantities in this unit may carry. */
export function unitDecimals(unitId) {
  return getUnit(unitId).decimals;
}

export function allowsDecimalQuantity(unitId) {
  return unitDecimals(unitId) > 0;
}

/** The step a quantity input should use for this unit. */
export function unitStep(unitId) {
  const decimals = unitDecimals(unitId);
  return decimals === 0 ? 1 : Number((10 ** -decimals).toFixed(decimals));
}

/**
 * Quantity rounding — the exact counterpart of currency.js roundMoney(),
 * and for the same reason. 0.1 + 0.2 is 0.30000000000000004 in every
 * IEEE-754 language, and a stock level that drifts by 1e-17 per sale
 * eventually shows "0.0000000000000004 m remaining" and never compares
 * equal to zero. Every quantity is pushed through this before it is
 * displayed, summed, or written to Firestore.
 */
export function roundQuantity(quantity, unitId = DEFAULT_UNIT) {
  const value = Number(quantity);
  if (!Number.isFinite(value)) return 0;
  const decimals = unitDecimals(unitId);
  if (decimals === 0) return Math.trunc(value + (value >= 0 ? 1e-9 : -1e-9));
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON * Math.sign(value || 1)) * factor) / factor;
}

/**
 * Display form. Trailing zeros are dropped — "2.5 m", not "2.500 m" —
 * because a shop reads a receipt, not a spreadsheet.
 */
export function formatQuantity(quantity, unitId = DEFAULT_UNIT) {
  const rounded = roundQuantity(quantity, unitId);
  const decimals = unitDecimals(unitId);
  if (decimals === 0) return String(rounded);
  return String(Number(rounded.toFixed(decimals)));
}

/** "2.5 m" / "3 pc" — quantity with its short unit, for lines and receipts. */
export function formatQuantityWithUnit(quantity, unitId = DEFAULT_UNIT, { showPiece = false } = {}) {
  const text = formatQuantity(quantity, unitId);
  const unit = getUnit(unitId);
  if (unit.id === DEFAULT_UNIT && !showPiece) return text;
  return `${text} ${unit.short}`;
}

/** Units grouped for a <select>, in catalogue order. */
export function unitOptionGroups() {
  return UNIT_GROUPS.map((group) => ({
    ...group,
    units: UNIT_IDS.map((id) => UNITS[id]).filter((u) => u.group === group.id),
  })).filter((group) => group.units.length > 0);
}
