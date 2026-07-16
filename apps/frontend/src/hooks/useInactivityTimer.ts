import { useEffect, useRef, useCallback } from 'react';

const EVENTS = ['mousedown', 'touchstart', 'mousemove', 'keydown', 'scroll', 'wheel'] as const;

export function useInactivityTimer(
  timeoutMs: number,
  onInactive: () => void,
  enabled: boolean = true,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onInactiveRef = useRef(onInactive);
  onInactiveRef.current = onInactive;

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (enabled) {
      timerRef.current = setTimeout(() => {
        onInactiveRef.current();
      }, timeoutMs);
    }
  }, [timeoutMs, enabled]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    reset();

    for (const ev of EVENTS) {
      window.addEventListener(ev, reset, { passive: true });
    }

    return () => {
      for (const ev of EVENTS) {
        window.removeEventListener(ev, reset);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [reset, enabled]);

  return { reset };
}
