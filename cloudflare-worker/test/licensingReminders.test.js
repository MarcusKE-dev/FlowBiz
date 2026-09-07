// Renewal reminders: the right message, once, to the right people.
//
// The failure mode this file guards against is not "no email went out".
// It is the opposite: a job that re-sends the same warning every time it
// runs, which trains merchants to ignore the one message that actually
// matters. Every test here is about restraint.

import test from 'node:test';
import assert from 'node:assert/strict';
import { installStub, env as baseEnv, mintIdToken, adminRequest } from './helpers/adminHarness.js';
import { dueReminder, runRenewalReminders, handleAdminRunReminders } from '../src/routes/licensingReminders.js';
import { GRACE_PERIOD_DAYS, RENEWAL_REMINDER_DAYS } from '../src/lib/licensing.js';
import {
  serviceRenewalReminderEmail, serviceExpiredEmail, cloudServicesSuspendedEmail,
} from '../src/lib/emailTemplates.js';

const DAY = 86400000;
const env = { ...baseEnv, RESEND_API_KEY: 'test-key' };

/** Installs the store and captures anything sent to Resend. */
function setup() {
  const state = installStub();
  state.emails = [];
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.resend.com')) {
      state.emails.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 });
    }
    return inner(url, init);
  };
  return state;
}

function business(state, { id = 'BIZ', expiryOffsetDays = 10, extra = {} } = {}) {
  state.store[`businesses/${id}`] = {
    name: 'Duka Bora',
    createdBy: `owner-${id}`,
    subscription: { plan: 'lifetime', status: 'active', expiresAt: null },
    licensing: {
      licenseType: 'lifetime',
      licenseStatus: 'active',
      serviceStartDate: new Date(Date.now() - 355 * DAY),
      serviceExpiryDate: new Date(Date.now() + expiryOffsetDays * DAY),
      graceDays: GRACE_PERIOD_DAYS,
      cloudSuspended: false,
      ...extra,
    },
  };
  state.store[`users/owner-${id}`] = { email: `owner-${id}@shop.co.ke`, displayName: 'Owner', businessId: id };
  state.store[`businessSettings/${id}`] = { businessId: id, shopName: 'Duka Bora' };
}

// ── What is due, and what is not ──────────────────────────────────────

test('nothing is due a long way out', () => {
  const state = setup();
  business(state, { expiryOffsetDays: 200 });
  assert.equal(dueReminder(state.store['businesses/BIZ']), null);
});

test('each configured stage becomes due exactly once', () => {
  for (const stage of RENEWAL_REMINDER_DAYS) {
    const state = setup();
    business(state, { expiryOffsetDays: stage });
    const due = dueReminder(state.store['businesses/BIZ']);
    assert.equal(due?.stage, String(stage), `${stage} days out must be the ${stage}-day stage`);
  }
});

test('a business already told about this stage is not told again', () => {
  const state = setup();
  business(state, { expiryOffsetDays: 7 });
  const first = dueReminder(state.store['businesses/BIZ']);
  assert.equal(first.stage, '7');

  state.store['businesses/BIZ'].licensing.reminderStageSent = '7';
  state.store['businesses/BIZ'].licensing.reminderPeriodKey = first.periodKey;
  assert.equal(dueReminder(state.store['businesses/BIZ']), null);
});

test('a stage never goes backwards inside one service period', () => {
  const state = setup();
  business(state, { expiryOffsetDays: 25 });
  const due = dueReminder(state.store['businesses/BIZ']);
  // Already sent the 7-day warning; a clock skew must not resend the 30.
  state.store['businesses/BIZ'].licensing.reminderStageSent = '7';
  state.store['businesses/BIZ'].licensing.reminderPeriodKey = due.periodKey;
  assert.equal(dueReminder(state.store['businesses/BIZ']), null);
});

test('a renewal re-arms the reminders for the NEW period', () => {
  const state = setup();
  business(state, { expiryOffsetDays: 7, extra: { reminderStageSent: '7' } });
  // The reminder was recorded against the old period key, so the new
  // period's own 7-day stage is due again.
  state.store['businesses/BIZ'].licensing.reminderPeriodKey = '1999-01-01';
  assert.equal(dueReminder(state.store['businesses/BIZ'])?.stage, '7');
});

test('the expiry and suspension notices are their own single messages', () => {
  const state = setup();
  business(state, { expiryOffsetDays: -3 }); // inside the grace period
  assert.equal(dueReminder(state.store['businesses/BIZ'])?.stage, 'expired');

  const past = setup();
  business(past, { expiryOffsetDays: -(GRACE_PERIOD_DAYS + 5) });
  assert.equal(dueReminder(past.store['businesses/BIZ'])?.stage, 'suspended');
});

test('a business with no perpetual licence is never sent a renewal reminder', () => {
  const state = setup();
  state.store['businesses/PRO'] = {
    createdBy: 'owner-PRO',
    subscription: { plan: 'pro', status: 'active', expiresAt: new Date(Date.now() + 3 * DAY) },
  };
  assert.equal(dueReminder(state.store['businesses/PRO']), null);

  state.store['businesses/FREE'] = { subscription: { plan: 'free', status: 'active' } };
  assert.equal(dueReminder(state.store['businesses/FREE']), null);
});

test('a pre-model lifetime licence is never nagged, because nothing is running out', () => {
  const state = setup();
  state.store['businesses/OLD'] = {
    createdBy: 'owner-OLD',
    subscription: { plan: 'lifetime', status: 'active', expiresAt: null },
  };
  assert.equal(dueReminder(state.store['businesses/OLD']), null);
});

// ── Running the job ───────────────────────────────────────────────────

test('the job sends one email and records what it sent', async () => {
  const state = setup();
  business(state, { expiryOffsetDays: 14 });

  const result = await runRenewalReminders(env);

  assert.equal(result.sent.length, 1);
  assert.equal(result.sent[0].stage, '14');
  assert.equal(state.emails.length, 1);
  assert.equal(state.emails[0].to[0], 'owner-BIZ@shop.co.ke');

  const lic = state.store['businesses/BIZ'].licensing;
  assert.equal(lic.reminderStageSent, '14');
  assert.ok(lic.reminderPeriodKey);
  // AND THE SERVICE DATES SURVIVED THE PATCH. `licensing` is masked as a
  // whole, so a partial write here would erase the expiry it just warned
  // about.
  assert.ok(lic.serviceExpiryDate, 'the service period must survive the reminder write');
  assert.equal(lic.licenseType, 'lifetime');
});

test('RUNNING THE JOB TWICE SENDS ONE EMAIL, NOT TWO', async () => {
  const state = setup();
  business(state, { expiryOffsetDays: 3 });

  await runRenewalReminders(env);
  await runRenewalReminders(env);
  await runRenewalReminders(env);

  assert.equal(state.emails.length, 1, 'a repeated run must send nothing');
});

test('a dry run reports what would go out and writes nothing', async () => {
  const state = setup();
  business(state, { expiryOffsetDays: 1 });

  const result = await runRenewalReminders(env, { dryRun: true });

  assert.equal(result.sent.length, 1);
  assert.equal(result.sent[0].dryRun, true);
  assert.equal(state.emails.length, 0, 'nothing is sent');
  assert.equal(state.store['businesses/BIZ'].licensing.reminderStageSent, undefined,
    'nothing is recorded, so the real run still fires');
});

test('a failed delivery is not recorded as sent, so the next run retries', async () => {
  const state = setup();
  business(state, { expiryOffsetDays: 7 });
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.resend.com')) return new Response('nope', { status: 500 });
    return inner(url, init);
  };

  const result = await runRenewalReminders(env);

  assert.equal(result.sent.length, 0);
  assert.equal(result.skipped.failed, 1);
  assert.equal(state.store['businesses/BIZ'].licensing.reminderStageSent, undefined);
});

test('one business with no owner email does not stop the others', async () => {
  const state = setup();
  business(state, { id: 'A', expiryOffsetDays: 7 });
  business(state, { id: 'B', expiryOffsetDays: 7 });
  delete state.store['users/owner-A'];

  const result = await runRenewalReminders(env);

  assert.equal(result.skipped.noEmail, 1);
  assert.equal(result.sent.length, 1);
  assert.equal(result.sent[0].businessId, 'B');
});

test('the reminder endpoint is closed to administrators who cannot touch services', async () => {
  const state = setup();
  business(state, { expiryOffsetDays: 7 });
  state.store['systemAdmins/sup'] = { uid: 'sup', email: 'sup@flowbiz.co.ke', role: 'SUPPORT', active: true };

  const res = await handleAdminRunReminders(
    adminRequest('/api/admin/licensing/reminders', {
      token: mintIdToken({ uid: 'sup', email: 'sup@flowbiz.co.ke' }),
      method: 'POST',
      body: { dryRun: false },
    }),
    env,
  );

  assert.equal(res.status, 403);
  assert.equal(state.emails.length, 0);
});

// ── What the emails actually say ──────────────────────────────────────

test('EVERY REMINDER SAYS THE LICENCE IS PERMANENT', () => {
  const messages = [
    serviceRenewalReminderEmail({ daysRemaining: 7, lastCoveredDayLabel: '6 September 2027', priceKes: 3000, renewUrl: 'https://x/pro' }),
    serviceExpiredEmail({ lastCoveredDayLabel: '6 September 2027', graceDays: 30, priceKes: 3000, renewUrl: 'https://x/pro' }),
    cloudServicesSuspendedEmail({ priceKes: 3000, renewUrl: 'https://x/pro' }),
  ];

  for (const message of messages) {
    const body = `${message.html} ${message.text}`.toLowerCase();
    assert.ok(body.includes('lifetime licence'), 'the licence must be named');
    assert.ok(
      body.includes('does not expire') || body.includes('remains active') || body.includes('still active'),
      'every message must say the licence survives',
    );
    assert.ok(!body.includes('your licence expires'), 'nothing may imply the licence expires');
    assert.ok(message.subject.length > 0 && message.subject.length < 120);
  }
});

test('the expiry and suspension notices promise the data is not deleted', () => {
  const expired = serviceExpiredEmail({ lastCoveredDayLabel: '6 Sep 2027', graceDays: 30, priceKes: 3000, renewUrl: 'u' });
  const suspended = cloudServicesSuspendedEmail({ priceKes: 3000, renewUrl: 'u' });
  assert.match(expired.text.toLowerCase(), /nothing is deleted|not be deleted/);
  assert.match(suspended.text.toLowerCase(), /have not been deleted|will not be deleted/);
});

test('a reminder quotes the renewal price it was given, and nothing else', () => {
  const message = serviceRenewalReminderEmail({ daysRemaining: 30, lastCoveredDayLabel: '6 Sep 2027', priceKes: 3000, renewUrl: 'u' });
  assert.match(message.text, /KES 3,000 per year/);
  assert.match(message.subject, /30 days/);
});
