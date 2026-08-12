// src/hooks/useHardwareScanner.js
import { useEffect, useRef } from 'react';

// USB/Bluetooth barcode scanners behave like a keyboard: they "type" the
// barcode's characters very fast (each keystroke well under 40ms apart)
// and then send Enter. Human typing is much slower per keystroke — that
// timing gap is what tells a scan apart from someone typing in a text
// field, without needing any special driver or pairing step, since the
// OS just sees a generic keyboard either way.
//
// Known limitation: a person typing a short word very fast right before
// hitting Enter could theoretically be misread as a scan. In practice
// this is rare enough not to matter for a POS used by real staff — but
// worth knowing about if you ever see an unexpected scan trigger.
export function useHardwareScanner(onScan, { enabled = true, maxIntervalMs = 40, minLength = 4 } = {}) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= minLength) {
          onScan(code);
        }
        return;
      }

      if (e.key.length !== 1) return; // ignore Shift, Tab, arrow keys, etc.

      // A gap longer than maxIntervalMs means this keystroke isn't part
      // of a fast scanner burst — start the buffer over.
      if (elapsed > maxIntervalMs) {
        bufferRef.current = '';
      }
      bufferRef.current += e.key;
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onScan, maxIntervalMs, minLength]);
}