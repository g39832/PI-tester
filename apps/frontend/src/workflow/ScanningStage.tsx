import { useEffect, useCallback, useRef, useState } from 'react';
import { useKiosk } from '../components/kiosk/KioskProvider';
import { getCollectorStatus } from '../api/sessions';
import { StepIndicator } from '../components/kiosk/StepIndicator';
import { ConfirmDialog } from '../components/kiosk/ConfirmDialog';

const SCAN_TIMEOUT_MS = 120_000;

export function ScanningStage() {
  const { transitionTo } = useKiosk();
  const startTime = useRef(Date.now());
  const [showTimeout, setShowTimeout] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const poll = useCallback(async () => {
    if (timedOut) return;
    if (Date.now() - startTime.current > SCAN_TIMEOUT_MS) {
      setShowTimeout(true);
      setTimedOut(true);
      return;
    }
    try {
      const res = await getCollectorStatus();
      if (res.data.activeSession) {
        const s = res.data.activeSession.status;
        if (s === 'collecting' || s === 'processing') transitionTo('diagnosing');
        else if (s === 'complete') transitionTo('review');
        else if (s === 'cancelled') transitionTo('ready');
      }
    } catch {
      // Connection error — keep polling
    }
  }, [transitionTo, timedOut]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [poll]);

  if (timedOut) {
    return (
      <div className="kiosk-container">
        <StepIndicator current="scanning" />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="text-6xl text-red-400">✗</div>
          <h1 className="kiosk-title text-center">Connection Timed Out</h1>
          <p className="kiosk-subtitle text-center">
            No collector connected within {SCAN_TIMEOUT_MS / 1000} seconds.
            <br />
            Ensure the diagnostic collector is running on the target PC.
          </p>
          <button onClick={() => transitionTo('ready')} className="kiosk-btn-primary">
            Return to Ready
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-container">
      <StepIndicator current="scanning" />
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="relative">
          <div className="text-7xl text-yellow-400 animate-pulse">⟳</div>
        </div>
        <h1 className="kiosk-title text-center">Connecting to Device</h1>
        <p className="kiosk-subtitle text-center">
          Establishing connection with the diagnostic collector...
        </p>
        <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '40%' }} />
        </div>
      </div>

      <ConfirmDialog
        open={showTimeout}
        title="No Connection Detected"
        message="The diagnostic collector did not connect within the expected time. Make sure the collector is running on the target PC and both devices are on the same network."
        confirmLabel="Try Again"
        cancelLabel="Back to Start"
        onConfirm={() => { setTimedOut(false); setShowTimeout(false); startTime.current = Date.now(); }}
        onCancel={() => transitionTo('ready')}
      />
    </div>
  );
}
