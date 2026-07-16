import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useInactivityTimer } from '../../hooks/useInactivityTimer';

export type WorkflowStage =
  | 'ready'
  | 'scanning'
  | 'diagnosing'
  | 'review'
  | 'assign_sku'
  | 'save_device'
  | 'next_ready';

interface KioskContextValue {
  stage: WorkflowStage;
  setStage: (stage: WorkflowStage) => void;
  transitionTo: (stage: WorkflowStage) => void;
  transitioning: boolean;
  inactivityTimeoutMs: number;
  setInactivityTimeout: (ms: number) => void;
  kioskVersion: string;
}

const KioskContext = createContext<KioskContextValue | null>(null);

const STORAGE_KEY = 'dispo_kiosk_timeout';
const DEFAULT_TIMEOUT = 120_000;

function loadTimeout(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 30_000 && n <= 600_000) return n;
    }
  } catch { /* ignore */ }
  return DEFAULT_TIMEOUT;
}

export function KioskProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<WorkflowStage>('ready');
  const [transitioning, setTransitioning] = useState(false);
  const [inactivityTimeoutMs, setInactivityTimeoutState] = useState(loadTimeout);
  const [idleOverride, setIdleOverride] = useState(false);

  const setInactivityTimeout = useCallback((ms: number) => {
    setInactivityTimeoutState(ms);
    try { localStorage.setItem(STORAGE_KEY, String(ms)); } catch { /* ignore */ }
  }, []);

  const transitionTo = useCallback((next: WorkflowStage) => {
    setTransitioning(true);
    setTimeout(() => {
      setStage(next);
      setTimeout(() => setTransitioning(false), 50);
    }, 200);
  }, []);

  const goHome = useCallback(() => {
    transitionTo('ready');
    setIdleOverride(false);
  }, [transitionTo]);

  const timerEnabled = stage !== 'scanning' && stage !== 'diagnosing' && !idleOverride;

  useInactivityTimer(inactivityTimeoutMs, goHome, timerEnabled);

  return (
    <KioskContext.Provider
      value={{
        stage,
        setStage,
        transitionTo,
        transitioning,
        inactivityTimeoutMs,
        setInactivityTimeout,
        kioskVersion: '1.0.0',
      }}
    >
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col overflow-hidden">
        {children}
      </div>
    </KioskContext.Provider>
  );
}

export function useKiosk(): KioskContextValue {
  const ctx = useContext(KioskContext);
  if (!ctx) throw new Error('useKiosk must be used within KioskProvider');
  return ctx;
}
