// src/components/pos/TicketPanel.jsx
//
// WHAT IS ALREADY ON THIS TABLE — as opposed to what is in the cart,
// which is what is about to be added to it.
//
// THAT SPLIT IS THE POINT, and it is a change in how the counter thinks
// about an open ticket. It used to LOAD a ticket into the cart, let the
// cart be edited, and write the whole thing back. With one device that is
// fine. With two it is a lost round: both tablets load the same ticket,
// both write the whole array back, and whoever saves second erases the
// other's drinks with no error anywhere.
//
// So a ticket is no longer something you load. It is something you ADD
// TO. The cart holds only the new round; committing it appends new line
// documents, which cannot collide with anything another device is doing.
// It is also, independently, the way a waiter actually works — you walk
// to a table and take the next round, you do not re-take the whole meal —
// and it is what Toast, Square and every other full-service system do.
//
// Each line here can be fired, taken off, or advanced individually,
// because each one is now its own document.

import { useMemo } from 'react';
import { Flame, Trash2, Clock, AlertTriangle } from 'lucide-react';
import Money from '../ui/Money';
import StatusPill from '../ui/StatusPill';
import { formatQuantityWithUnit } from '../../industry/units';
import { describeModifiers } from '../../utils/modifiers';
import { diningModeLabel } from '../../utils/orders';
import { FULFILLMENT, FULFILLMENT_LABELS, fulfillmentOf, isVoided } from '../../domain/fnb/lines';
import { groupByCourse } from '../../domain/fnb/ticket';
import { computeCheck } from '../../domain/fnb/check';

const STAGE_TONE = {
  new: 'neutral',
  sent: 'info',
  ready: 'positive',
  served: 'neutral',
};

function LineRow({ line, canVoid, onVoid, busy }) {
  const stage = fulfillmentOf(line);
  const voided = isVoided(line);
  // An UNFIRED line has not been made, so removing it is a correction and
  // needs no permission. A FIRED one has cost the kitchen work and may
  // have reached the table, so taking it off the bill is a void — a
  // different act, recorded, and behind its own permission.
  const removable = !voided && !line.readOnlyLine && (stage === FULFILLMENT.NEW || canVoid);

  return (
    <li className={`flex items-start justify-between gap-2 py-1.5 ${voided ? 'opacity-50' : ''}`}>
      <div className="min-w-0">
        <p className={`text-body text-ink-900 ${voided ? 'line-through' : ''}`}>
          <span className="num font-semibold">{formatQuantityWithUnit(line.quantity, line.unit)}</span>
          {' × '}{line.productName}
        </p>
        {(line.variantLabel || line.modifiers?.length > 0 || line.note) && (
          <p className="text-secondary text-ink-500">
            {[line.variantLabel, describeModifiers(line.modifiers), line.note].filter(Boolean).join(' · ')}
          </p>
        )}
        {voided ? (
          <p className="text-label uppercase text-danger-700">
            Removed{line.voidedByName ? ` by ${line.voidedByName}` : ''}
            {line.voidReason ? ` · ${line.voidReason}` : ''}
          </p>
        ) : (
          stage !== FULFILLMENT.NEW && (
            <StatusPill tone={STAGE_TONE[stage]}>{FULFILLMENT_LABELS[stage]}</StatusPill>
          )
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`num text-body ${voided ? 'text-ink-400 line-through' : 'text-ink-900'}`}>
          <Money value={line.lineTotal} />
        </span>
        {removable && (
          <button
            type="button"
            className="btn-icon text-ink-400 hover:text-danger-700"
            onClick={() => onVoid(line)}
            disabled={busy}
            aria-label={stage === FULFILLMENT.NEW ? 'Remove this item' : 'Take this item off the bill'}
            title={stage === FULFILLMENT.NEW ? 'Remove' : 'Take off the bill'}
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

export default function TicketPanel({
  ticket,
  courses = [],
  coursesOn = false,
  kitchenOn = false,
  canVoid = false,
  serviceChargeRate = 0,
  discount = null,
  busy = false,
  onFire,
  onVoidLine,
  onEditDiscount,
  canDiscount = false,
}) {
  const groups = useMemo(
    () => (coursesOn ? groupByCourse(ticket, courses) : [{ id: null, name: null, lines: ticket?.liveLines || [] }]),
    [ticket, courses, coursesOn]
  );

  const check = useMemo(
    () => computeCheck(ticket?.liveLines || [], { discount, serviceChargeRate }),
    [ticket, discount, serviceChargeRate]
  );

  if (!ticket) return null;

  const unfired = ticket.unfired.length;
  const voided = ticket.voidedLines;

  return (
    <div className="space-y-3 rounded-panel border border-line bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-section-title text-ink-900">{ticket.name}</p>
          <p className="text-secondary text-ink-500">
            {/* The label, not the stored id — the panel read "dine-in"
                where the floor screen beside it says "Dine in". */}
            {[
              ticket.tableName,
              ticket.diningMode ? diningModeLabel(ticket.diningMode) : null,
              ticket.openedByName,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        {ticket.lineModel === 'array' && (
          <span className="flex items-center gap-1 text-label uppercase text-warning-700">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Older ticket
          </span>
        )}
      </div>

      {/* A ticket opened before this version stores its items in one field
          rather than as individual lines, so there is nothing to fire,
          void or move item by item. It is charged exactly as it always
          was — no migration, and nothing rewritten behind anyone's back. */}
      {ticket.lineModel === 'array' && (
        <p className="rounded-panel bg-warning-50 px-2.5 py-2 text-secondary text-warning-800">
          This ticket was opened by an older version, so its items can only be changed together.
          Charge it as it is, or cancel it and start a new one.
        </p>
      )}

      {groups.length === 0 ? (
        <p className="py-2 text-secondary text-ink-500">Nothing on this ticket yet.</p>
      ) : (
        groups.map((group) => (
          <div key={group.id ?? '__none'}>
            {group.name && (
              <p className="border-b border-divider pb-1 text-label uppercase text-ink-500">{group.name}</p>
            )}
            <ul className="divide-y divide-divider">
              {group.lines.map((line) => (
                <LineRow key={line.id} line={line} canVoid={canVoid} onVoid={onVoidLine} busy={busy} />
              ))}
            </ul>
          </div>
        ))
      )}

      {voided.length > 0 && (
        <div>
          <p className="border-b border-divider pb-1 text-label uppercase text-ink-500">Taken off</p>
          <ul className="divide-y divide-divider">
            {voided.map((line) => (
              <LineRow key={line.id} line={line} canVoid={false} onVoid={onVoidLine} busy={busy} />
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1 border-t border-line pt-2.5">
        {(check.discountAmount > 0 || check.serviceChargeAmount > 0) && (
          <>
            <div className="flex justify-between text-secondary text-ink-600">
              <span>Items</span><span className="num"><Money value={check.grossAmount} /></span>
            </div>
            {check.discountAmount > 0 && (
              <div className="flex justify-between text-secondary text-danger-700">
                <span>Discount{check.discount?.reason ? ` · ${check.discount.reason}` : ''}</span>
                <span className="num">−<Money value={check.discountAmount} /></span>
              </div>
            )}
            {check.serviceChargeAmount > 0 && (
              <div className="flex justify-between text-secondary text-ink-600">
                <span>Service charge {check.serviceChargeRate}%</span>
                <span className="num"><Money value={check.serviceChargeAmount} /></span>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between text-body font-semibold text-ink-900">
          <span>Total</span><span className="num"><Money value={check.totalAmount} /></span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {kitchenOn && unfired > 0 && (
          <button type="button" className="btn-primary" onClick={onFire} disabled={busy}>
            <Flame className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Send {unfired} to the kitchen
          </button>
        )}
        {kitchenOn && unfired === 0 && ticket.preparing.length > 0 && (
          <span className="flex items-center gap-1.5 text-secondary text-ink-500">
            <Clock className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {ticket.preparing.length} with the kitchen
          </span>
        )}
        {canDiscount && ticket.liveLines.length > 0 && (
          <button type="button" className="btn-ghost" onClick={onEditDiscount} disabled={busy}>
            {check.discountAmount > 0 ? 'Change discount' : 'Give a discount'}
          </button>
        )}
      </div>
    </div>
  );
}
