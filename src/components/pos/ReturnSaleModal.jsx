// src/components/pos/ReturnSaleModal.jsx
//
// Returning a completed cash or M-Pesa sale: which lines, how many of
// each, how the money goes back, and why.
//
// The screen is one table and two fields on purpose. A duka handing back
// a shirt needs to say what came back and what they paid out; anything
// more is a form nobody fills in correctly under a queue.
//
// The arithmetic is all in utils/returns.js, so what this file does is
// collect quantities and show the total. It never computes money of its
// own — that is what kept the second money path from appearing.

import { useEffect, useMemo, useState } from 'react';
import { returnableLines, buildReturn, MAX_RETURN_REASON } from '../../utils/returns';
import { formatQuantityWithUnit, unitStep } from '../../industry/units';
import { lineItemDetail } from '../../utils/lineItems';
import Modal from '../common/Modal';
import Money from '../ui/Money';
import FormField from '../ui/FormField';

export default function ReturnSaleModal({ open, sale, onClose, onSubmit }) {
  const [quantities, setQuantities] = useState({});
  const [method, setMethod] = useState('Cash');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const lines = useMemo(() => (sale ? returnableLines(sale) : []), [sale]);

  useEffect(() => {
    setQuantities({});
    setReason('');
    setBusy(false);
    // The money goes back the way it came in unless the shop says
    // otherwise — that is what keeps the till reconciling.
    setMethod(sale?.paymentMethod === 'M-Pesa' ? 'M-Pesa' : 'Cash');
  }, [sale?.id, sale?.paymentMethod]);

  const preview = useMemo(
    () => (sale ? buildReturn(sale, quantities) : { isEmpty: true, amount: 0, items: [] }),
    [sale, quantities]
  );

  if (!open || !sale) return null;

  const setLine = (index, value) => setQuantities((q) => ({ ...q, [index]: value }));

  const returnAll = () => {
    const all = {};
    for (const line of lines) if (line.returnable > 0) all[line.index] = line.returnable;
    setQuantities(all);
  };

  const handleSubmit = async () => {
    if (preview.isEmpty || busy) return;
    setBusy(true);
    try {
      await onSubmit({ returned: preview, method, reason });
    } finally {
      setBusy(false);
    }
  };

  const nothingLeft = lines.every((line) => line.returnable <= 0);

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Return this sale">
      <div className="space-y-4">
        <p className="text-body text-ink-500">
          Choose how much of each item came back. Stock goes back on the shelf and the money
          you hand over is recorded, so your till and your reports still add up.
        </p>

        {nothingLeft ? (
          <p className="rounded-panel bg-ink-50 px-3 py-2.5 text-body text-ink-600">
            Everything on this sale has already been returned.
          </p>
        ) : (
          <div className="divide-y divide-divider overflow-hidden rounded-panel border border-line bg-surface">
            {lines.map((line) => {
              const detail = lineItemDetail(line.item);
              return (
                <div key={line.index} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-body font-medium text-ink-900">{line.item.productName}</p>
                    {detail && <p className="text-secondary text-ink-500">{detail}</p>}
                    <p className="text-secondary text-ink-500">
                      Sold {formatQuantityWithUnit(line.sold, line.unit, { showPiece: true })}
                      {line.already > 0 && ` · ${formatQuantityWithUnit(line.already, line.unit, { showPiece: true })} already returned`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <label className="label" htmlFor={`return-qty-${line.index}`}>Coming back</label>
                    <input
                      id={`return-qty-${line.index}`}
                      type="number"
                      min="0"
                      max={line.returnable}
                      step={unitStep(line.unit)}
                      inputMode={unitStep(line.unit) === 1 ? 'numeric' : 'decimal'}
                      className="input num !w-24 text-right"
                      value={quantities[line.index] ?? ''}
                      placeholder="0"
                      disabled={busy || line.returnable <= 0}
                      onChange={(e) => setLine(line.index, e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!nothingLeft && (
          <>
            <div className="flex justify-end">
              <button type="button" className="btn-ghost !px-2 text-ink-600" onClick={returnAll} disabled={busy}>
                Return everything
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Money goes back as" htmlFor="return-method">
                <select
                  id="return-method"
                  className="input"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  disabled={busy}
                >
                  <option value="Cash">Cash</option>
                  <option value="M-Pesa">M-Pesa</option>
                </select>
              </FormField>
              <FormField label="Reason" htmlFor="return-reason" hint="For your own records.">
                <input
                  id="return-reason"
                  className="input"
                  maxLength={MAX_RETURN_REASON}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. wrong size, faulty"
                  disabled={busy}
                />
              </FormField>
            </div>

            <div className="flex items-baseline justify-between rounded-control border border-line bg-ink-50 px-3 py-2 text-body text-ink-600">
              <span>Refund</span>
              <span className="font-semibold text-ink-900"><Money value={preview.amount} /></span>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSubmit} disabled={busy || preview.isEmpty}>
                {busy ? 'Saving…' : 'Record return'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
