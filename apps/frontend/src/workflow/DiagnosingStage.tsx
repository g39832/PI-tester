import { useEffect, useCallback, useState, useRef } from 'react';
import { useKiosk } from '../components/kiosk/KioskProvider';
import { getCollectorStatus, getSessionDetail } from '../api/sessions';
import { StepIndicator } from '../components/kiosk/StepIndicator';

const TEST_LABELS: Record<string, string> = {
  cpu: 'CPU',
  memory: 'Memory',
  storage: 'Storage',
  gpu: 'GPU',
  battery: 'Battery',
  motherboard: 'Motherboard & BIOS',
  network: 'Network',
  windows: 'Windows OS',
  updates: 'Windows Updates',
  drivers: 'Drivers',
  eventviewer: 'Event Log',
  sfc: 'SFC Scan',
  dism: 'DISM Health',
  fscheck: 'File System Check',
  eventviewer_deep: 'Deep Event Log',
};

const DIAGNOSE_TIMEOUT_MS = 300_000;

export function DiagnosingStage() {
  const { transitionTo } = useKiosk();
  const [completedTests, setCompletedTests] = useState<string[]>([]);
  const [totalTests, setTotalTests] = useState(11);
  const [statusText, setStatusText] = useState('Initializing diagnostics...');
  const [timedOut, setTimedOut] = useState(false);
  const startTime = useRef(Date.now());

  const poll = useCallback(async () => {
    if (Date.now() - startTime.current > DIAGNOSE_TIMEOUT_MS) {
      setTimedOut(true);
      return;
    }
    try {
      const res = await getCollectorStatus();
      if (!res.data.activeSession) {
        transitionTo('ready');
        return;
      }
      const s = res.data.activeSession.status;
      if (s === 'complete' && res.data.activeSession.diagnosticSessionId) {
        transitionTo('review');
        return;
      }
      if (s === 'cancelled') {
        transitionTo('ready');
        return;
      }

      if (res.data.activeSession.diagnosticSessionId) {
        try {
          const detail = await getSessionDetail(res.data.activeSession.diagnosticSessionId as string);
          if (detail.data?.tests) {
            const done = detail.data.tests
              .filter((t: { testId?: string }) => t.testId)
              .map((t: { testId: string }) => t.testId);
            setCompletedTests(done);
            if (detail.data.tests.length > 3) {
              setTotalTests(detail.data.tests.length + 3);
            }
            if (done.length > 0) {
              const last = done[done.length - 1];
              setStatusText(`Completed: ${TEST_LABELS[last] ?? last}`);
            } else {
              setStatusText('Collecting diagnostic data...');
            }
          }
        } catch {
          setStatusText('Receiving diagnostic data...');
        }
      }
    } catch {
      // polling errors — keep trying
    }
  }, [transitionTo]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [poll]);

  const progress = totalTests > 0 ? (completedTests.length / totalTests) * 100 : 0;

  if (timedOut) {
    return (
      <div className="kiosk-container">
        <StepIndicator current="diagnosing" />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="text-6xl text-red-400">✗</div>
          <h1 className="kiosk-title text-center">Diagnostics Timed Out</h1>
          <p className="kiosk-subtitle text-center">
            The scan took longer than expected ({DIAGNOSE_TIMEOUT_MS / 1000}s).
            <br />
            Partial results may still be available.
          </p>
          <div className="flex gap-3">
            <button onClick={() => transitionTo('review')} className="kiosk-btn-primary">
              Review Partial Results
            </button>
            <button onClick={() => transitionTo('ready')} className="kiosk-btn-secondary">
              Discard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-container">
      <StepIndicator current="diagnosing" />
      <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-lg w-full">
        <div className="text-6xl text-green-400 animate-pulse">⟳</div>
        <h1 className="kiosk-title text-center">Running Diagnostics</h1>
        <p className="kiosk-subtitle text-center">{statusText}</p>

        <div className="w-full max-w-sm">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(5, progress)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full max-w-sm mt-2">
          {Object.entries(TEST_LABELS).map(([id, label]) => {
            const done = completedTests.includes(id);
            return (
              <div
                key={id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  done ? 'bg-green-900/30 text-green-400' : 'bg-gray-800/50 text-gray-500'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-green-500' : 'bg-gray-600'}`} />
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
