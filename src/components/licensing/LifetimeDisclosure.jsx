// src/components/licensing/LifetimeDisclosure.jsx
//
// WHAT A CUSTOMER MUST READ BEFORE THEY CAN COMMIT TO A LIFETIME LICENCE.
//
// FlowBiz sells two different things under one price on one card: a
// PERPETUAL SOFTWARE LICENCE, which is bought once and never expires, and
// an ANNUAL CLOUD SERVICES, MAINTENANCE, UPDATES AND SUPPORT entitlement,
// whose first year is included and whose second year is not. That is a
// perfectly honest model and a very easy one to misread as "pay once,
// everything forever" — which is the reading a customer will have in mind
// when the year-two invoice arrives, unless they were told otherwise
// before they paid.
//
// So this component states the terms in the order they apply, and it sits
// ABOVE the purchase button rather than below it. That placement is the
// whole point and is asserted by src/legal/legalLinks.test.js: a
// disclosure a customer scrolls past after committing is not a
// disclosure.
//
// The wording is quoted from licensingCopy.js and the prices from the
// licensing config, so this can never drift from what the billing system
// actually charges or from what the Terms actually say.

import { Link } from 'react-router-dom';
import { SERVICE_PRICE_PER_YEAR } from './licensingCopy';

export default function LifetimeDisclosure() {
  return (
    <div className="rounded-panel border border-line bg-canvas p-4 text-secondary leading-relaxed text-ink-600">
      <p className="font-semibold text-ink-900">Before you buy, what this includes</p>

      <ul className="mt-2 space-y-1.5">
        <li>
          You are buying a <strong className="text-ink-900">permanent FlowBiz software licence</strong>.
          {' '}It does not expire if you choose not to renew.
        </li>
        <li>
          Your first year of cloud services, maintenance, updates and support is
          {' '}<strong className="text-ink-900">included</strong>.
        </li>
        <li>
          From year two, those services cost
          {' '}<strong className="text-ink-900">{SERVICE_PRICE_PER_YEAR}</strong>. Renewal is optional
          {' '}and is not automatic.
        </li>
        <li>
          If you do not renew, you keep the software and you keep your business records.
          {' '}Cloud synchronisation, cloud storage, updates and support pause until you renew.
          {' '}<strong className="text-ink-900">Nothing is deleted.</strong>
        </li>
      </ul>

      <p className="mt-3">
        By continuing you agree to our{' '}
        <Link to="/terms" className="font-semibold text-primary-600 underline underline-offset-2">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="font-semibold text-primary-600 underline underline-offset-2">
          Privacy Policy
        </Link>.
      </p>
    </div>
  );
}
