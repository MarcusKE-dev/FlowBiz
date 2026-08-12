// src/components/scanner/ScanFab.jsx
import { ScanLine } from 'lucide-react';

export default function ScanFab({ onClick, label = 'Scan barcode' }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-moss-700 text-white shadow-xl hover:bg-moss-800 active:scale-95 lg:bottom-6 lg:right-6"
      aria-label={label}
      title={label}
    >
      <ScanLine className="h-6 w-6" strokeWidth={2} />
    </button>
  );
}