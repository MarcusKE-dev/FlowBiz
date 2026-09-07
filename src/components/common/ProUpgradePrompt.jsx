// src/components/common/ProUpgradePrompt.jsx
//
// The inline "this is a Pro feature" prompt, for a control that STAYS
// VISIBLE to a Starter business rather than disappearing.
//
// FlowBiz already has the full-page version of this — AdvancedAnalytics
// and InventoryIntelligence replace their whole body with a lock, a
// sentence and a link to /pro. That shape works when the entire page is
// the feature. It does not work for one field inside a form the merchant
// is in the middle of filling in, which is what this is for: the photo
// picker in the product form is shown to everybody, so a Starter user
// discovers the feature exists, and asking for it explains what it costs
// them nothing to see.
//
// NO PRICE IS WRITTEN HERE. Prices live in src/licensing/config.js and
// are quoted on the /pro page, which is where this sends the merchant.
// A price inline in a form is a price that goes stale silently.

import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

/**
 * @param {object} props
 * @param {string} props.message what the merchant does not have, in a sentence.
 * @param {string} [props.cta] the link's wording.
 */
export default function ProUpgradePrompt({ message, cta = 'See FlowBiz Pro' }) {
  return (
    <div className="flex items-start gap-2 rounded-control border border-line bg-ink-50 px-3 py-2">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
      <p className="text-secondary leading-relaxed text-ink-600">
        {message}{' '}
        <Link to="/pro" className="font-semibold text-primary-700 underline underline-offset-2">
          {cta}
        </Link>
      </p>
    </div>
  );
}
