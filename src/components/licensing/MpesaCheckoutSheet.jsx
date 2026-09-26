// src/components/licensing/MpesaCheckoutSheet.jsx
//
// The M-Pesa payment sheet. It asks for a phone number and nothing else:
// the M-Pesa PIN is typed on the customer's phone, into the STK prompt,
// and there is no field in FlowBiz that could take it.
//
// State and server calls live in CheckoutContext; this renders the phase
// it is given and polls the Worker's status route while a prompt is out.
// It never calls Paystack, and it never decides a payment succeeded —
// `success` here is a status the server returned.

import { useEffect, useState } from 'react';
import { Smartphone, CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';
import Modal from '../common/Modal';
import FormField from '../ui/FormField';
import { usePricing } from '../../hooks/usePricing';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { formatPrice } from '../../licensing';
import {
  normalizeKenyanMsisdn,
  INVALID_PHONE_MESSAGE,
  OFFLINE_MESSAGE,
  failureCopy,
  pollDelayMs,
} from '../../licensing/mpesa';

const PLAN_SUMMARY = {
  pro: { name: 'FlowBiz Pro', period: '30 days', priceKey: 'pro' },
  lifetime: { name: 'FlowBiz Lifetime Licence', period: 'one time', priceKey: 'lifetime' },
  annual_services: { name: 'Cloud services renewal', period: '12 months', priceKey: 'annualServices' },
};

const SUCCESS_COPY = {
  pro: 'Your FlowBiz Pro subscription is now active.',
  lifetime: 'Your FlowBiz Lifetime Licence is now active.',
  annual_services: 'Your cloud services, maintenance, updates and support have been renewed.',
};

function PlanSummary({ plan, amountKes }) {
  const summary = PLAN_SUMMARY[plan];
  if (!summary) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-4">
      <div>
        <p className="text-body font-semibold text-ink-900">{summary.name}</p>
        <p className="text-secondary text-ink-500">{summary.period}</p>
      </div>
      <p className="num text-money font-semibold tabular-nums text-ink-900">
        {amountKes != null ? formatPrice(amountKes) : '…'}
      </p>
    </div>
  );
}

function StatusBlock({ icon: Icon, tone = 'text-ink-500', title, spin = false, children }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center" role="status" aria-live="polite">
      <Icon className={`h-8 w-8 ${tone} ${spin ? 'animate-spin' : ''}`} strokeWidth={1.75} aria-hidden="true" />
      <h4 className="font-display text-body font-bold text-ink-900">{title}</h4>
      <div className="max-w-xs space-y-2 text-body text-ink-600">{children}</div>
    </div>
  );
}

export default function MpesaCheckoutSheet({
  open,
  state,
  onSend,
  onCheckStatus,
  onRetry,
  onClose,
  onOtherMethod,
}) {
  const { pricing } = usePricing();
  const online = useOnlineStatus();
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);

  const { phase, plan, error, payment } = state;
  const amountKes = payment?.amountKes ?? pricing[PLAN_SUMMARY[plan]?.priceKey]?.amountKes;
  const reference = payment?.reference;

  // Poll the Worker — never Paystack — while a prompt is out. A dropped
  // connection pauses polling; it does not end the payment.
  useEffect(() => {
    if (!open || !online || !reference) return undefined;
    if (phase !== 'waiting' && phase !== 'delayed') return undefined;
    // An interval, not a chain of timeouts: a poll that errors dispatches
    // nothing, and must not be able to stop the ones after it.
    const timer = setInterval(() => onCheckStatus(reference), pollDelayMs(phase));
    return () => clearInterval(timer);
  }, [open, online, reference, phase, onCheckStatus]);

  const phoneValid = Boolean(normalizeKenyanMsisdn(phone));
  const phoneError = touched && phone && !phoneValid ? INVALID_PHONE_MESSAGE : null;

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!phoneValid || !online || phase !== 'form') return;
    onSend(phone);
  };

  const otherMethods = (
    <button
      type="button"
      onClick={onOtherMethod}
      className="btn-ghost w-full text-secondary"
    >
      Other payment methods
    </button>
  );

  let body;
  if (phase === 'form' || phase === 'sending') {
    const sending = phase === 'sending';
    body = (
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormField label="M-Pesa phone number" error={phoneError || error} hint="You'll enter your M-Pesa PIN on your phone, never in FlowBiz.">
          {(field) => (
            <input
              {...field}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="input num"
              placeholder="0712 345 678"
              value={phone}
              disabled={sending}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setTouched(true)}
            />
          )}
        </FormField>

        {!online && (
          <p className="text-secondary text-warning-700" role="alert">{OFFLINE_MESSAGE}</p>
        )}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={sending || !online || !phone}
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              Sending M-Pesa prompt…
            </>
          ) : 'Send M-Pesa Prompt'}
        </button>

        {!sending && otherMethods}
      </form>
    );
  } else if (phase === 'waiting') {
    body = (
      <StatusBlock icon={Smartphone} tone="text-primary-700" title="Check your phone">
        <p>
          {payment?.resumed ? 'An M-Pesa payment prompt was already sent to' : 'We sent an M-Pesa payment prompt to'}
          {' '}
          <span className="num font-semibold text-ink-900">{payment?.phoneMasked}</span>.
        </p>
        <p>Enter your M-Pesa PIN on your phone to complete the payment.</p>
        <p className="flex items-center justify-center gap-2 pt-2 text-secondary text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          {online ? 'Waiting for payment confirmation…' : 'You are offline. We will keep checking when you reconnect.'}
        </p>
      </StatusBlock>
    );
  } else if (phase === 'delayed') {
    body = (
      <div className="space-y-4">
        <StatusBlock icon={Clock} tone="text-warning-700" title="Payment confirmation is taking longer than expected">
          <p>If you completed the M-Pesa payment, don&apos;t pay again yet. We&apos;re still checking its status.</p>
          <p className="text-secondary text-ink-500">
            You can close this. Your plan activates automatically as soon as the payment is confirmed.
          </p>
        </StatusBlock>
        <button type="button" className="btn-secondary w-full" onClick={onClose}>Close</button>
      </div>
    );
  } else if (phase === 'success') {
    body = (
      <div className="space-y-4">
        <StatusBlock icon={CheckCircle2} tone="text-primary-700" title="Payment successful">
          <p>{SUCCESS_COPY[plan] || SUCCESS_COPY.pro}</p>
        </StatusBlock>
        <button type="button" className="btn-primary w-full" onClick={onClose}>Continue</button>
      </div>
    );
  } else if (phase === 'failed') {
    body = (
      <div className="space-y-4">
        <StatusBlock icon={AlertCircle} tone="text-danger-700" title="Payment not completed">
          <p>{failureCopy(payment?.reason)}</p>
        </StatusBlock>
        <button type="button" className="btn-primary w-full" onClick={onRetry}>Try again</button>
        {otherMethods}
      </div>
    );
  } else if (phase === 'review') {
    body = (
      <div className="space-y-4">
        <StatusBlock icon={AlertCircle} tone="text-warning-700" title="We couldn't confirm this payment automatically">
          <p>Please don&apos;t pay again. Contact FlowBiz support and quote this reference:</p>
          <p className="break-all font-mono text-label text-ink-700">{reference}</p>
        </StatusBlock>
        <button type="button" className="btn-secondary w-full" onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <Modal open={open} title="Pay with M-Pesa" onClose={onClose}>
      <div className="space-y-4">
        <PlanSummary plan={plan} amountKes={amountKes} />
        {body}
      </div>
    </Modal>
  );
}
