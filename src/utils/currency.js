export function formatKES(amount) {
  const v = Number(amount) || 0;
  return `KES ${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function formatKESCompact(amount) {
  return `KES ${Math.round(Number(amount) || 0).toLocaleString('en-KE')}`;
}

// FIX (multi-product cart): quantity × unit price, summed across several
// cart lines, can accumulate binary floating-point noise (e.g.
// 0.1 + 0.2 = 0.30000000000000004). Every money total the cart computes —
// a line total, the cart grand total, aggregated COGS/profit written to
// Firestore — is rounded through this before being displayed or saved.
export function roundMoney(amount) {
  const v = Number(amount);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
