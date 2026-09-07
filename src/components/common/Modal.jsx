import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  title,
  onClose,
  children,
  widthClass = 'max-w-md',
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);

    // Focus only once when the modal opens.
    const firstInput = containerRef.current?.querySelector(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
    );

    firstInput?.focus();

    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        className={`max-h-[92vh] w-full ${widthClass} overflow-y-auto rounded-t-panel bg-surface p-5 shadow-overlay sm:rounded-panel`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-page-title text-ink-900">
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-control p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}