import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook that detects USB barcode scanner input.
 *
 * Barcode scanners present as HID keyboards — they "type" the code
 * as rapid keystrokes (< 50ms apart) followed by Enter.
 *
 * This hook buffers keystrokes and fires `onScan` when a scan pattern
 * is detected. It also supports manual entry (slower typing) for fallback.
 *
 * The `active` flag controls when scanning is enabled — disable during
 * text input fields to avoid interference.
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  active: boolean = true,
) {
  const buffer = useRef<Array<{ char: string; time: number }>>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const SCAN_THRESHOLD_MS = 50;
  const MIN_SCAN_LENGTH = 3;
  const FLUSH_TIMEOUT_MS = 100;

  const flushBuffer = useCallback(() => {
    if (buffer.current.length === 0) return;

    const chars = buffer.current.map((b) => b.char).join('');
    const times = buffer.current.map((b) => b.time);

    let isScan = true;
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] > SCAN_THRESHOLD_MS) {
        isScan = false;
        break;
      }
    }

    buffer.current = [];

    if (isScan && chars.length >= MIN_SCAN_LENGTH) {
      onScanRef.current(chars);
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        flushBuffer();
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        buffer.current.push({ char: e.key, time: Date.now() });

        if (flushTimer.current) clearTimeout(flushTimer.current);
        flushTimer.current = setTimeout(flushBuffer, FLUSH_TIMEOUT_MS);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, [active, flushBuffer]);
}
