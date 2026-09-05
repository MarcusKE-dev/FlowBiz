import { useEffect } from 'react';
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, confirmDisabled = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = e => { if (e.key === 'Escape' && !confirmDisabled) onCancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel, confirmDisabled]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-4 sm:items-center" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-panel bg-surface p-5 shadow-overlay">
        <h3 className="font-display text-page-title text-ink-900">{title}</h3>
        {/* `whitespace-pre-line` so a caller can add a second paragraph —
            a consequence worth separating from the sentence above it —
            without this becoming a rich-text component. Single-line
            messages, which is nearly all of them, are unaffected. */}
        {message && <p className="mt-2 whitespace-pre-line text-body text-ink-600">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} disabled={confirmDisabled}>{cancelLabel}</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
