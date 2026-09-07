// src/domain/fnb/index.js
//
// THE FOOD & BEVERAGE DOMAIN ENGINE — its whole public surface.
//
// WHERE THIS SITS, and why it is a third directory rather than more files
// in the two that already exist:
//
//   src/utils/      THE PLATFORM CORE. Line arithmetic, money, units,
//                   inventory, stock writes, financials. Shared by every
//                   industry FlowBiz serves, retail included.
//
//   src/industry/   CONFIGURATION. Which capabilities a trade has, what
//                   its words are, what its cashiers may do. It decides
//                   what is OFFERED and owns no behaviour.
//
//   src/domain/fnb/ THIS. The business behaviour of food service — a
//                   ticket's life, firing to a station, what a check
//                   costs, what a kitchen wasted, what a batch yielded.
//
// Putting any of this in `utils/` is the failure the whole exercise is
// against: it would put restaurant concepts in the module a duka's
// counter imports, and the next industry would put its concepts there
// too, until the shared core is a pile of everybody's special cases.
//
// THE DEPENDENCY RULE, one direction and asserted by a test:
//
//     domain/fnb  →  utils/, industry/     ALLOWED
//     utils/      →  domain/fnb            NEVER
//
// The platform core does not know this domain exists. That is what keeps
// a retail business's counter, reports and financials provably unaffected
// by everything in here, and it is what would let a second domain engine
// be added later without either one learning about the other.

export * from './catalog.js';
export * from './lines.js';
export * from './ticket.js';
export * from './stations.js';
export * from './check.js';
export * from './waste.js';
export * from './costing.js';
export * from './production.js';
