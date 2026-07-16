import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCollectorStatus, getSessionDetail } from '../api/sessions';
import type { DiagnosticSessionDetail } from '../api/sessions';

type ScanState = 'idle' | 'pairing' | 'collecting' | 'complete';

const HEALTH_COLORS: Record<string, string> = {
  good: 'text-green-400',
  warning: 'text-yellow-400',
  critical: 'text-red-400',
  unknown: 'text-gray-400',
};

const HEALTH_BG: Record<string, string> = {
  good: 'bg-green-900/50 border-green-700/50',
  warning: 'bg-yellow-900/50 border-yellow-700/50',
  critical: 'bg-red-900/50 border-red-700/50',
  unknown: 'bg-gray-900 border-gray-800',
};

export default function ScanView() {
  const navigate = useNavigate();
  const [state, setState] = useState<ScanState>('idle');
  const [sessionCode, setSessionCode] = useState<string>('');
  const [report, setReport] = useState<DiagnosticSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await getCollectorStatus();
      const data = res.data;

      setSessionCode(data.code);

      if (data.activeSession) {
        const status = data.activeSession.status as string;
        if (status === 'pairing') setState('pairing');
        else if (status === 'collecting' || status === 'processing') setState('collecting');
        else if (status === 'complete') {
          if (data.activeSession.diagnosticSessionId) {
            const detail = await getSessionDetail(data.activeSession.diagnosticSessionId as string);
            setReport(detail.data);
          }
          setState('complete');
        } else if (status === 'cancelled') {
          setState('idle');
        }
      } else {
        if (state === 'complete') {
          // stay on report
        } else {
          setState('idle');
        }
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [state]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [poll]);

  function handleNewScan() {
    setReport(null);
    setState('idle');
  }

  const overallColor = report?.overallStatus === 'good'
    ? 'text-green-400'
    : report?.overallStatus === 'warning'
      ? 'text-yellow-400'
      : 'text-red-400';

  if (error) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold text-white">New Scan</h1>
          <p className="text-gray-400 text-sm">Diagnostic Collection</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center">
          <p className="text-red-400">Connection error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">New Scan</h1>
        <p className="text-gray-400 text-sm">Diagnostic Collection</p>
      </div>

      {state === 'idle' && (
        <div className="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
          <div className="text-6xl mb-4 text-blue-400">⟳</div>
          <h2 className="text-xl font-semibold text-white mb-2">Ready for Diagnostic</h2>
          <p className="text-gray-400 mb-6">
            Boot the target PC from the DispoScan USB drive.
            <br />
            It will connect automatically.
          </p>
          <div className="inline-block bg-gray-800 rounded-xl px-8 py-4 border border-gray-700">
            <p className="text-sm text-gray-500 mb-1">Session Code</p>
            <p className="text-4xl font-mono font-bold text-blue-400 tracking-[0.3em]">
              {sessionCode}
            </p>
          </div>
          <p className="text-xs text-gray-600 mt-4">Code refreshes every 15 minutes</p>
        </div>
      )}

      {state === 'pairing' && (
        <div className="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
          <div className="animate-spin text-5xl mb-4 text-yellow-400 inline-block">⟳</div>
          <h2 className="text-xl font-semibold text-white mb-2">Connecting...</h2>
          <p className="text-gray-400">Pairing with diagnostic collector</p>
        </div>
      )}

      {state === 'collecting' && (
        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center">
          <div className="animate-pulse text-5xl mb-4 text-green-400 inline-block">⟳</div>
          <h2 className="text-xl font-semibold text-white mb-2">Collecting Data</h2>
          <p className="text-gray-400">Receiving diagnostic information from target PC</p>
          <div className="mt-4 flex justify-center">
            <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      )}

      {state === 'complete' && report && (
        <div className="space-y-6">
          <div className={`bg-gray-900 rounded-xl p-8 border ${overallColor === 'text-green-400' ? 'border-green-800' : overallColor === 'text-yellow-400' ? 'border-yellow-800' : 'border-red-800'} text-center`}>
            <div className="text-5xl mb-2">
              {report.overallStatus === 'good' ? '✓' : report.overallStatus === 'warning' ? '⚠' : '✗'}
            </div>
            <h2 className={`text-2xl font-bold ${overallColor} mb-1`}>
              {report.overallStatus === 'good' ? 'All Systems Good' : report.overallStatus === 'warning' ? 'Minor Issues Found' : 'Critical Issues Detected'}
            </h2>
            <p className="text-gray-400">
              Health Score: <span className={`text-xl font-bold ${overallColor}`}>{report.healthScore ?? '—'}/100</span>
            </p>
            {report.durationSeconds != null && (
              <p className="text-xs text-gray-600 mt-1">
                Completed in {Math.round(report.durationSeconds / 60)}m {report.durationSeconds % 60}s
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.tests.map((test) => (
              <div key={test.id} className={`rounded-xl p-5 border ${HEALTH_BG[test.health] ?? HEALTH_BG.unknown}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-semibold">{test.label}</h3>
                  <span className={`text-xs font-medium capitalize ${HEALTH_COLORS[test.health] ?? 'text-gray-400'}`}>
                    {test.health}
                  </span>
                </div>
                {test.data && test.data !== '{}' && (
                  <pre className="text-xs text-gray-400 overflow-x-auto max-h-24">
                    {JSON.stringify(JSON.parse(test.data), null, 1)}
                  </pre>
                )}
                {test.warnings && JSON.parse(test.warnings).length > 0 && (
                  <div className="mt-2 text-xs text-yellow-400">
                    {JSON.parse(test.warnings).map((w: string, i: number) => (
                      <p key={i}>⚠ {w}</p>
                    ))}
                  </div>
                )}
                {test.duration != null && (
                  <p className="text-xs text-gray-600 mt-2">{test.duration}s</p>
                )}
              </div>
            ))}
          </div>

          {report.payload && (
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h3 className="text-white font-semibold mb-3">Device Info</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {(() => {
                  const payload = JSON.parse(report.payload);
                  return Object.entries(payload).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-gray-500 text-xs uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <p className="text-white">{String(value) || '—'}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4 pt-2">
            <button
              onClick={handleNewScan}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-medium transition-colors touch-manipulation"
            >
              New Diagnostic
            </button>
            <button
              onClick={() => navigate(`/sessions/${report.id}`)}
              className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-xl text-lg font-medium transition-colors touch-manipulation"
            >
              View Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
