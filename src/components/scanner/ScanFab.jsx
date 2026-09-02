// src/components/scanner/ScanFab.jsx
import { ScanLine } from 'lucide-react';

export default function ScanFab({ onClick, label = 'Scan barcode' }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-pop transition-colors hover:bg-primary-700 active:bg-primary-800 lg:bottom-6 lg:right-6"
      aria-label={label}
      title={label}
    >
      <ScanLine className="h-5 w-5" strokeWidth={1.75} />
    </button>
  );
}
