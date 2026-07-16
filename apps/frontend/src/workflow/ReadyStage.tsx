import { useState, useEffect, useCallback } from 'react';
import { useKiosk } from '../components/kiosk/KioskProvider';
import { getCollectorStatus } from '../api/sessions';
import { StepIndicator } from '../components/kiosk/StepIndicator';

export function ReadyStage() {
  const { transitionTo } = useKiosk();
  const [sessionCode, setSessionCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkConnection = useCallback(async () => {
    try {
      const res = await getCollectorStatus();
      setSessionCode(res.data.code);
      setError(null);
      if (res.data.activeSession) {
        const s = res.data.activeSession.status;
        if (s === 'pairing') transitionTo('scanning');
        else if (s === 'collecting' || s === 'processing') transitionTo('diagnosing');
      }
    } catch (err) {
      setError('Cannot connect to server. Ensure the DispoScan appliance is running.');
    } finally {
      setLoading(false);
    }
  }, [transitionTo]);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 2000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return (
    <div className="kiosk-container">
      <StepIndicator current="ready" />
      <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-xl w-full">
        <div className="text-8xl text-blue-400">⟳</div>
        <h1 className="kiosk-title text-center">Ready to Scan</h1>
        <p className="kiosk-subtitle text-center">
          Boot the target PC and connect to the diagnostic network.
          <br />
          The collector will connect automatically.
        </p>

        {loading ? (
          <div className="flex items-center gap-3 text-gray-500 text-sm">
            <span className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
            Connecting to server...
          </div>
        ) : (
          <>
            <div className="kiosk-card text-center mt-4 w-full">
              <p className="text-sm text-gray-500 mb-2">Session Code</p>
              <p className="kiosk-code">{sessionCode || '------'}</p>
              <p className="text-xs text-gray-600 mt-3">Code refreshes every 15 minutes</p>
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-800/50 rounded-xl px-6 py-4 text-red-400 text-sm text-center max-w-md">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 text-gray-500 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Waiting for connection...
            </div>
          </>
        )}
      </div>
    </div>
  );
}
