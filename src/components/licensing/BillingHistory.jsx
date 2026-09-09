// src/components/licensing/BillingHistory.jsx
//
// What this business has actually paid FlowBiz.
//
// Read straight from the `payments` collection, which is written ONLY by
// the Cloudflare Worker — /api/paystack/initialize records the pending
// payment and the webhook confirms it. firestore.rules gives an owner
// read access to their own business's rows and no write access at all, so
// this is a record the merchant can inspect and nobody, including them,
// can edit.

import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import Section from '../ui/Section';
import StatusPill from '../ui/StatusPill';
import { formatPrice } from '../../licensing';
import { formatServiceDate } from './licensingCopy';

const PLAN_LABELS = {
  lifetime: 'Lifetime Licence, including the first 12 months of cloud services',
  annual_services: 'Cloud Services, Maintenance, Updates and Support, 12 months',
  pro: 'FlowBiz Pro, 30 days',
};

export default function BillingHistory() {
  const { businessId, isOwner } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!businessId || !isOwner) return;
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'payments'),
          where('businessId', '==', businessId),
          orderBy('createdAt', 'desc'),
          limit(50),
        ));
        if (alive) setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        // A missing composite index or an offline device must not take
        // the billing page down; the entitlement panel above it is the
        // part that matters and is already rendered.
        if (alive) { setError(err); setRows([]); }
      }
    })();
    return () => { alive = false; };
  }, [businessId, isOwner]);

  if (!isOwner) return null;

  return (
    <Section title="Payment history" hint="Every FlowBiz payment recorded against this business.">
      {rows === null ? (
        <p className="text-body text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-body text-ink-400">
          {error
            ? 'Your payment history could not be loaded right now. It is safe; try again when you are back online.'
            : 'No payments recorded yet.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-panel border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-cell">
              <thead className="border-b border-line text-left text-label uppercase text-ink-500">
                <tr>
                  <th scope="col" className="px-3 py-2">Date</th>
                  <th scope="col" className="px-3 py-2">What it paid for</th>
                  <th scope="col" className="px-3 py-2 text-right">Amount</th>
                  <th scope="col" className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 text-ink-700">
                      {formatServiceDate(row.confirmedAt?.toMillis?.() ?? row.createdAt?.toMillis?.() ?? row.createdAt) || 'Not recorded'}
                    </td>
                    <td className="px-3 py-2 text-ink-900">
                      {row.description || PLAN_LABELS[row.plan] || row.plan || 'FlowBiz payment'}
                      <span className="block font-mono text-label text-ink-400">{row.id}</span>
                    </td>
                    <td className="num px-3 py-2 text-right font-semibold tabular-nums text-ink-900">
                      {formatPrice(row.amountKes)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <StatusPill tone={row.status === 'success' ? 'positive' : row.status === 'pending' ? 'caution' : 'neutral'}>
                        {row.status === 'success' ? 'Paid' : row.status === 'pending' ? 'Pending' : row.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}
