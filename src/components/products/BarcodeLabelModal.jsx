// src/components/products/BarcodeLabelModal.jsx
//
// Shelf-edge and product labels for a supermarket-sized catalogue.
//
// The whole design goal here is that printing a sheet of labels is a
// thirty-second job, not a project: pick the products, say how many of
// each, print. There is no template designer, no label-stock library and
// no barcode-symbology chooser — the symbology is decided by what the
// product actually has (a real EAN-13 is drawn as one, everything else as
// Code 128), and the sheet is plain A4 so it prints on the printer the
// shop already owns.
//
// Everything numeric here is bounded in utils/barcodeLabels.js rather
// than in this component, so a copy-count typo cannot start a 900-page
// print job however the field is edited.

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Printer, Download } from 'lucide-react';
import Modal from '../common/Modal';
import { searchCatalogue } from '../../utils/catalogueSearch';
import { printBarcodeLabels, downloadBarcodeLabels, MAX_COPIES_PER_PRODUCT } from '../../utils/barcodeLabels';
import { encodeBarcode } from '../../utils/barcode';
import { friendlyErrorMessage } from '../../utils/errorMessages';

export default function BarcodeLabelModal({ open, onClose, products = [], shopName = '' }) {
  const [search, setSearch] = useState('');
  const [copies, setCopies] = useState({});
  const [startAt, setStartAt] = useState(0);
  const [showPrice, setShowPrice] = useState(true);
  const [busy, setBusy] = useState(false);

  const { results, total, truncated } = useMemo(
    () => searchCatalogue(products, { query: search, limit: 60 }),
    [products, search]
  );

  const selection = useMemo(
    () => Object.entries(copies)
      .map(([id, count]) => ({ product: products.find((p) => p.id === id), copies: count }))
      .filter((entry) => entry.product && entry.copies > 0),
    [copies, products]
  );

  const labelCount = selection.reduce((sum, entry) => sum + entry.copies, 0);

  const setCount = (id, raw) => {
    const next = Math.min(MAX_COPIES_PER_PRODUCT, Math.max(0, Math.floor(Number(raw) || 0)));
    setCopies((prev) => {
      if (next !== 0) return { ...prev, [id]: next };
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });
  };

  const run = async (action, verb) => {
    if (selection.length === 0 || busy) return;
    setBusy(true);
    try {
      const sheet = await action(selection, { startAt, showPrice, shopName });
      if (sheet.skipped.length > 0) {
        toast.error(
          `${sheet.skipped.length} product${sheet.skipped.length === 1 ? '' : 's'} skipped: no barcode or internal code.`
        );
      }
      if (sheet.total > 0) toast.success(`${sheet.total} label${sheet.total === 1 ? '' : 's'} ${verb}.`);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setSearch('');
    setCopies({});
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Print barcode labels" widthClass="max-w-2xl">
      <div className="space-y-4">
        <input
          className="input"
          placeholder="Search the catalogue…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products to label"
        />

        <div className="max-h-[38vh] divide-y divide-divider overflow-y-auto rounded-panel border border-line">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-secondary text-ink-500">No products match.</p>
          ) : (
            results.map((product) => {
              const code = product.barcode || product.internalCode || '';
              const printable = Boolean(encodeBarcode(code));
              return (
                <div key={product.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-ink-900">{product.name}</p>
                    <p className="truncate font-mono text-secondary text-ink-500">
                      {printable ? code : 'No barcode, cannot be labelled'}
                    </p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={MAX_COPIES_PER_PRODUCT}
                    className="input num !w-20 text-center"
                    value={copies[product.id] ?? ''}
                    placeholder="0"
                    disabled={!printable || busy}
                    onChange={(e) => setCount(product.id, e.target.value)}
                    aria-label={`Labels to print for ${product.name}`}
                  />
                </div>
              );
            })
          )}
        </div>

        {truncated && (
          <p className="text-secondary text-ink-500">
            Showing <span className="num">{results.length}</span> of <span className="num">{total}</span>.
            Search to narrow it down.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Skip labels on the first sheet</label>
            <input
              type="number"
              min="0"
              className="input num"
              value={startAt}
              onChange={(e) => setStartAt(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              disabled={busy}
            />
            <p className="mt-1 text-secondary text-ink-400">Use up a part-finished sticker sheet.</p>
          </div>
          <label className="flex items-center gap-2.5 self-end pb-2">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              disabled={busy}
            />
            <span className="text-body text-ink-700">Print the selling price on each label</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <p className="text-secondary text-ink-500">
            <span className="num font-semibold text-ink-900">{labelCount}</span> label
            {labelCount === 1 ? '' : 's'} selected
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>
              Close
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => run(downloadBarcodeLabels, 'saved')}
              disabled={busy || labelCount === 0}
            >
              <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Save PDF
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => run(printBarcodeLabels, 'sent to the printer')}
              disabled={busy || labelCount === 0}
            >
              <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> {busy ? 'Working…' : 'Print'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
