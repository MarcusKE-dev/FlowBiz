// The M-Pesa checkout screen's pure half, and the wires that connect it.
//
// The state machine's one job is to never tell a customer who may have
// paid that they have not — that is how people pay twice.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeKenyanMsisdn,
  initialMpesaState,
  mpesaReducer,
  phaseForPayment,
  failureCopy,
  OFFLINE_MESSAGE,
} from './mpesa.js';

const REPO = new URL('../..', import.meta.url).pathname;
const read = (path) => readFileSync(`${REPO}${path}`, 'utf8');

const run = (actions, plan = 'pro') => actions.reduce(mpesaReducer, initialMpesaState(plan));

test('the browser accepts the same Kenyan formats the Worker does', () => {
  for (const n of ['0712345678', '0112345678', '254712345678', '+254712345678']) {
    assert.ok(normalizeKenyanMsisdn(n), n);
  }
  for (const n of ['0812345678', '12345', '+255712345678', 'mpesa']) {
    assert.equal(normalizeKenyanMsisdn(n), null, n);
  }
});

test('the Worker uses the browser\'s phone implementation, not a copy', () => {
  assert.match(read('cloudflare-worker/src/lib/mpesa.js'), /from '..\/..\/..\/src\/licensing\/mpesa\.js'/);
});

test('form → sending → waiting → success', () => {
  const s = run([
    { type: 'send' },
    { type: 'payment', payment: { reference: 'fbm-1', status: 'pending', phoneMasked: '0712 *** 678' } },
    { type: 'payment', payment: { reference: 'fbm-1', status: 'success' } },
  ]);
  assert.equal(s.phase, 'success');
  assert.equal(s.payment.phoneMasked, '0712 *** 678', 'later polls do not drop what the first reply said');
});

test('a second send while one is in flight is ignored', () => {
  const sending = run([{ type: 'send' }]);
  assert.equal(mpesaReducer(sending, { type: 'send' }), sending);
  const waiting = run([{ type: 'send' }, { type: 'payment', payment: { reference: 'r', status: 'pending' } }]);
  assert.equal(mpesaReducer(waiting, { type: 'send' }), waiting);
});

test('DELAYED CONFIRMATION is never shown as failure, and offers no retry', () => {
  const s = run([
    { type: 'send' },
    { type: 'payment', payment: { reference: 'r', status: 'pending', delayed: true } },
  ]);
  assert.equal(s.phase, 'delayed');
  assert.equal(mpesaReducer(s, { type: 'retry' }), s, 'retry is only possible after an authoritative failure');
});

test('only a server-reported failure reaches failed, and only failed allows retry', () => {
  const failed = run([
    { type: 'send' },
    { type: 'payment', payment: { reference: 'r', status: 'pending' } },
    { type: 'payment', payment: { reference: 'r', status: 'failed', reason: 'declined' } },
  ]);
  assert.equal(failed.phase, 'failed');
  const retried = mpesaReducer(failed, { type: 'retry' });
  assert.equal(retried.phase, 'form');
  assert.equal(retried.payment, null);
});

test('a stale "pending" poll cannot undo a success', () => {
  const s = run([
    { type: 'send' },
    { type: 'payment', payment: { reference: 'r', status: 'success' } },
    { type: 'payment', payment: { reference: 'r', status: 'pending' } },
  ]);
  assert.equal(s.phase, 'success');
});

test('a refused send returns to the form with the server\'s message', () => {
  const s = run([{ type: 'send' }, { type: 'refused', error: 'Enter a valid Kenyan M-Pesa number.' }]);
  assert.equal(s.phase, 'form');
  assert.equal(s.error, 'Enter a valid Kenyan M-Pesa number.');
});

test('a review verdict tells the customer not to pay again', () => {
  assert.equal(phaseForPayment({ status: 'review' }), 'review');
  assert.equal(phaseForPayment({ status: 'something-new' }), null);
});

test('failure copy says no money was taken', () => {
  for (const reason of ['declined', 'expired', 'not_started', undefined]) {
    assert.match(failureCopy(reason), /No money was taken/);
  }
});

// ── Wiring ────────────────────────────────────────────────────────────

test('the checkout provider is mounted, so every upgrade button reaches the M-Pesa sheet', () => {
  assert.match(read('src/App.jsx'), /<CheckoutProvider>/);
  assert.match(read('src/hooks/useLicensingCheckout.js'), /useCheckout\(\)/);
  assert.match(read('src/contexts/CheckoutContext.jsx'), /<MpesaCheckoutSheet/);
});

test('the Worker routes the M-Pesa endpoints and reconciles on the cron', () => {
  const index = read('cloudflare-worker/src/index.js');
  assert.match(index, /'\/api\/paystack\/mpesa\/charge'/);
  assert.match(index, /'\/api\/paystack\/mpesa\/status'/);
  assert.match(index, /reconcileStaleMpesaPayments\(env\)/);
});

test('FlowBiz NEVER asks for an M-Pesa PIN', () => {
  const sheet = read('src/components/licensing/MpesaCheckoutSheet.jsx');
  // Exactly one input, and it is the phone number.
  assert.equal((sheet.match(/<input/g) || []).length, 1);
  assert.match(sheet, /type="tel"/);
  assert.doesNotMatch(sheet, /type="password"|name="pin"|autoComplete="one-time-code"/i);
});

test('the sheet refuses to send while offline and says why', () => {
  const sheet = read('src/components/licensing/MpesaCheckoutSheet.jsx');
  assert.match(sheet, /!online/);
  assert.match(sheet, /OFFLINE_MESSAGE/);
  assert.match(OFFLINE_MESSAGE, /internet connection is required/);
});

test('the browser never calls Paystack\'s API directly for M-Pesa', () => {
  for (const file of ['src/contexts/CheckoutContext.jsx', 'src/components/licensing/MpesaCheckoutSheet.jsx']) {
    assert.doesNotMatch(read(file), /api\.paystack\.co/);
  }
});
