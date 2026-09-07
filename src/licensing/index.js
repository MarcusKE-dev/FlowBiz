// src/licensing/index.js
//
// The licensing layer's public surface. Import from here, not from the
// files inside — the split between `config` (what things cost) and
// `entitlements` (what a business may do) is an internal one.
export * from './config.js';
export * from './entitlements.js';
