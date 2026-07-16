import { useState, useEffect, useCallback } from 'react';
import { useKiosk } from '../components/kiosk/KioskProvider';
import { getCollectorStatus, getSessionDetail } from '../api/sessions';
import type { DiagnosticSessionDetail } from '../api/sessions';
import { StepIndicator } from '../components/kiosk/StepIndicator';
import { ConfirmDialog } from '../components/kiosk/ConfirmDialog';

const HEALTH_COLORS: Record<string, string> = {
  good: 'text-green-400',
  warning: 'text-yellow-400',
  critical: 'text-red-400',
  unknown: 'text-gray-400',
};

const HEALTH_BG: Record<string, string> = {
  good: 'bg-green-900/40 border-green-700/40',
  warning: 'bg-yellow-900/40 border-yellow-700/40',
  critical: 'bg-red-900/40 border-red-700/40',
  unknown: 'bg-gray-900 border-gray-800',
};

const CATEGORY_LABELS: Record<string, string> = {
  storage: 'Storage',
  battery: 'Battery',
  windows_health: 'Windows Health',
  hardware: 'Hardware',
  security: 'Security',
  temperature: 'Temperature',
};

function CategoryBar({ name, score }: { name: string; score: number | null }) {
  const color = score == null ? 'bg-gray-600' : score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-400 w-32 flex-shrink-0">{CATEGORY_LABELS[name] ?? name}</span>
      <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${score ?? 0}%` }} />
      </div>
      <span className={`text-sm font-mono w-12 text-right ${score == null ? 'text-gray-500' : score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
        {score ?? '—'}
      </span>
    </div>
  );
}

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function ReviewStage() {
  const { transitionTo } = useKiosk();
  const [report, setReport] = useState<DiagnosticSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompare, setShowCompare] = useState(false);
  const [comparison, setComparison] = useState<Array<{ testId: string; label: string; currentHealth: string; previousHealth: string; change: string }> | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      const res = await getCollectorStatus();
      if (res.data.activeSession?.diagnosticSessionId) {
        const detail = await getSessionDetail(res.data.activeSession.diagnosticSessionId as string);
        setReport(detail.data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReport();
    const interval = setInterval(fetchReport, 2000);
    return () => clearInterval(interval);
  }, [fetchReport]);

  const handleCompare = useCallback(async () => {
    if (!report?.deviceId) return;
    try {
      const { get } = await import('../api/client');
      const res = await get<any[]>(`/sessions/device/${report.deviceId}`);
      const sessions = res.data;
      const prev = sessions.filter((s: any) => s.id !== report.id).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
      if (prev.length > 0) {
        const compRes = await get<any>(`/sessions/compare/${report.id}/${prev[0].id}`);
        setComparison(compRes.data.comparisons);
        setShowCompare(true);
      }
    } catch { /* ignore */ }
  }, [report]);

  if (loading) {
    return (
      <div className="kiosk-container">
        <StepIndicator current="review" />
        <div className="flex-1 flex items-center justify-center text-gray-500 text-lg">Loading results...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="kiosk-container">
        <StepIndicator current="review" />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <p className="text-gray-500 text-lg">No diagnostic data available.</p>
          <button onClick={() => transitionTo('ready')} className="kiosk-btn-primary">Back to Start</button>
        </div>
      </div>
    );
  }

  const overallColor = report.overallStatus === 'good' ? 'text-green-400' : report.overallStatus === 'warning' ? 'text-yellow-400' : 'text-red-400';
  const borderColor = report.overallStatus === 'good' ? 'border-green-800' : report.overallStatus === 'warning' ? 'border-yellow-800' : 'border-red-800';

  const categoryScores = parseJson(report.categoryScores) as Record<string, number | null> | null;
  const recommendations = parseJson(report.recommendations) as Array<{ category: string; severity: string; message: string; detail: string }> | null;

  const hasComparison = comparison && comparison.length > 0;

  return (
    <div className="kiosk-container">
      <StepIndicator current="review" />
      <div className="flex-1 w-full max-w-2xl flex flex-col gap-4 overflow-y-auto py-4">
        {/* Overall Status */}
        <div className={`kiosk-card text-center ${borderColor}`}>
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
            <p className="text-xs text-gray-600 mt-1">Completed in {Math.floor(report.durationSeconds / 60)}m {report.durationSeconds % 60}s</p>
          )}
          {report.scanMode && (
            <p className="text-xs text-gray-600 mt-1 uppercase tracking-wider">{report.scanMode} scan</p>
          )}
        </div>

        {/* Category Scores */}
        {categoryScores && (
          <div className="kiosk-card space-y-3">
            <h3 className="text-white font-semibold mb-3">Health Scores by Category</h3>
            {Object.entries(categoryScores).map(([cat, score]) => (
              <CategoryBar key={cat} name={cat} score={score} />
            ))}
          </div>
        )}

        {/* Test Results */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {report.tests?.map((test) => {
            const warnings = parseJson(test.warnings) as string[] | null;
            return (
              <div key={test.id} className={`rounded-xl p-4 border ${HEALTH_BG[test.health] ?? HEALTH_BG.unknown}`}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-white font-semibold">{test.label}</h3>
                  <span className={`text-xs font-medium capitalize ${HEALTH_COLORS[test.health] ?? 'text-gray-400'}`}>
                    {test.health}
                  </span>
                </div>
                {warnings && warnings.length > 0 && (
                  <div className="mt-1">
                    {warnings.map((w, i) => (
                      <p key={i} className="text-xs text-yellow-400">⚠ {w}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="kiosk-card">
            <h3 className="text-white font-semibold mb-3">Recommendations</h3>
            <div className="space-y-3">
              {recommendations.map((rec, i) => {
                const sevColor = rec.severity === 'critical' ? 'border-red-700 bg-red-900/20' : rec.severity === 'warning' ? 'border-yellow-700 bg-yellow-900/20' : 'border-blue-700 bg-blue-900/20';
                const dotColor = rec.severity === 'critical' ? 'bg-red-500' : rec.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';
                return (
                  <div key={i} className={`rounded-lg border p-3 ${sevColor}`}>
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                      <div>
                        <p className="text-sm text-white font-medium">{rec.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{rec.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Comparison */}
        {hasComparison && (
          <div className="kiosk-card">
            <h3 className="text-white font-semibold mb-3">Comparison with Previous Scan</h3>
            <div className="space-y-2">
              {comparison!.map((c) => {
                const changeColor = c.change === 'improved' ? 'text-green-400' : c.change === 'degraded' ? 'text-red-400' : c.change === 'new' ? 'text-blue-400' : 'text-gray-400';
                const icon = c.change === 'improved' ? '▲' : c.change === 'degraded' ? '▼' : c.change === 'new' ? '+' : '—';
                return (
                  <div key={c.testId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{c.label}</span>
                    <span className={`${changeColor} font-mono text-xs`}>
                      {icon} {c.previousHealth} → {c.currentHealth}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!showCompare && report.deviceId && (
          <button onClick={handleCompare} className="kiosk-btn-secondary">
            Compare with Previous Scan
          </button>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4 mt-2">
          <button onClick={() => transitionTo('assign_sku')} className="kiosk-btn-primary">
            Continue to SKU
          </button>
          <button onClick={() => setShowDiscardConfirm(true)} className="kiosk-btn-secondary">
            Discard
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showDiscardConfirm}
        title="Discard Diagnostic Results?"
        message="This will discard all diagnostic data from this scan and return to the ready screen. This cannot be undone."
        confirmLabel="Discard"
        danger
        onConfirm={() => { setShowDiscardConfirm(false); transitionTo('ready'); }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </div>
  );
}
