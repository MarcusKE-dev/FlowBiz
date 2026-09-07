// src/components/team/CashierPermissions.jsx
//
// What cashiers in this business may do, on the page that already answers
// "who works here" — because the two questions are one question, and the
// old answer (a single "let cashiers record expenses" switch buried in
// Settings) could not describe any real job.
//
// WHAT IS OFFERED HERE IS INDUSTRY-AWARE, and it comes out of the same
// industry layer as everything else: a restaurant is asked about orders
// and its menu, an electronics shop is not asked about either, and a
// services business with no stock room is not asked about receiving
// stock. Nothing in this file names a trade — see industry/permissions.js.
//
// WHAT IS NOT HERE, and cannot be added by anyone: the settings, the
// team, the plan, the business type, the data. Those are the owner's
// alone and are refused server-side on `role`, so there is no switch here
// that could reach them. The panel says so in plain words rather than
// leaving an owner to wonder.
//
// It costs no extra read: the permission map rides on the businessSettings
// document SettingsContext already listens to.

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useIndustry } from '../../hooks/useIndustry';
import { useSettings } from '../../contexts/SettingsContext';
import { useCustomizeWrites } from '../customize/useCustomizeWrites';
import {
  resolveCashierPermissions, permissionGroups, sanitizeCashierPermissions, OWNER_ONLY_AREAS,
} from '../../industry/permissions';
import Toggle from '../customize/Toggle';
import Section from '../ui/Section';
import StatusPill from '../ui/StatusPill';
import ConfirmDialog from '../common/ConfirmDialog';

export default function CashierPermissions() {
  const { settings } = useSettings();
  const industry = useIndustry();
  const { write, busy } = useCustomizeWrites();
  const [resetOpen, setResetOpen] = useState(false);

  const resolved = useMemo(
    () => resolveCashierPermissions(industry, settings),
    [industry, settings]
  );
  const groups = useMemo(() => permissionGroups(industry), [industry]);

  const handleToggle = (key, next) => {
    // The stored value is the OWNER'S ANSWER, not the effective one: a
    // permission left alone stays on the trade's recommendation, so a
    // business type correction later moves it with the trade instead of
    // freezing today's answer forever.
    const stored = sanitizeCashierPermissions(settings?.cashierPermissions);
    return write(
      { cashierPermissions: { ...stored, [key]: next } },
      next ? 'Cashiers can now do this' : 'Cashiers can no longer do this'
    );
  };

  const handleReset = async () => {
    const ok = await write(
      { cashierPermissions: {} },
      `Back to what FlowBiz suggests for ${industry.label}`
    );
    if (ok) setResetOpen(false);
  };

  return (
    <Section
      title="What cashiers can do"
      hint="Applies to every cashier in this business."
      action={
        !resolved.usesDefaults && (
          <button type="button" className="btn-secondary" onClick={() => setResetOpen(true)} disabled={busy}>
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Reset
          </button>
        )
      }
    >
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.id} className="space-y-2">
            <p className="text-label uppercase text-ink-400">{group.label}</p>
            {group.permissions.map((permission) => {
              const granted = resolved.granted[permission.key] === true;
              const blockedBy = (permission.requires || []).find((dep) => !resolved.granted[dep]);
              return (
                <div
                  key={permission.key}
                  className="flex items-start justify-between gap-4 rounded-panel border border-line bg-surface px-3 py-3"
                >
                  <div className="min-w-0">
                    <p id={`perm-${permission.key}`} className="text-body font-medium text-ink-900">
                      {permission.label}
                      {granted !== (resolved.defaults[permission.key] === true) && (
                        <span className="ml-2 text-label uppercase text-ink-400">changed</span>
                      )}
                    </p>
                    {permission.description && (
                      <p className="text-secondary text-ink-500">{permission.description}</p>
                    )}
                    {blockedBy && (
                      <p className="text-secondary text-ink-400">
                        Needs “{labelOf(groups, blockedBy)}” first.
                      </p>
                    )}
                  </div>
                  <Toggle
                    checked={granted}
                    onChange={(next) => handleToggle(permission.key, next)}
                    disabled={busy}
                    labelledBy={`perm-${permission.key}`}
                  />
                </div>
              );
            })}
          </div>
        ))}

        <div className="rounded-panel border border-line bg-surface px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body font-medium text-ink-900">Only you can do these</p>
            <StatusPill tone="neutral">Owner only</StatusPill>
          </div>
          <p className="text-secondary text-ink-500">
            No switch can grant these. FlowBiz refuses them on the server, not just on this screen.
          </p>
          <ul className="mt-2 space-y-1">
            {OWNER_ONLY_AREAS.map((area) => (
              <li key={area} className="text-secondary text-ink-500">• {area}</li>
            ))}
          </ul>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Back to the suggested permissions?"
        message={`Every switch goes back to what FlowBiz suggests for ${industry.label}. Nobody is signed out.`}
        confirmLabel={busy ? 'Resetting…' : 'Reset'}
        confirmDisabled={busy}
        onConfirm={handleReset}
        onCancel={() => setResetOpen(false)}
      />
    </Section>
  );
}

/** The owner-facing label of a permission this business is offered. */
function labelOf(groups, key) {
  for (const group of groups) {
    const found = group.permissions.find((p) => p.key === key);
    if (found) return found.label;
  }
  return key;
}
