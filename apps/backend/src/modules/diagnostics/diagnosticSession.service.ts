import { randomUUID } from 'node:crypto';
import { getSqlite } from '@dds/database';
import type { HealthScoreInput } from '../health/healthScore.service.js';

export interface SessionMeta {
  deviceName?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  windowsVersion?: string;
}

export interface TestResultRow {
  id: string;
  sessionId: string;
  testId: string;
  label: string;
  status: 'completed' | 'warning' | 'error' | 'skipped' | 'running';
  health: 'good' | 'warning' | 'critical' | 'unknown';
  data: string;
  warnings: string | null;
  duration: number | null;
  createdAt: string;
}

export interface DiagnosticSessionRow {
  id: string;
  deviceId: string | null;
  sessionCode: string;
  payload: string;
  healthScore: number | null;
  categoryScores: string | null;
  overallStatus: string | null;
  scanMode: string | null;
  recommendations: string | null;
  collectorVersion: string | null;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  summary: string | null;
  createdAt: string;
}

interface TestResultRecord {
  testId: string;
  label: string;
  status: string;
  health: string;
  data: Record<string, unknown>;
  warnings: string[];
  duration: number | null;
}

export const diagnosticSessionService = {
  create(deviceId: string | null, sessionCode: string, meta: SessionMeta, scanMode: 'quick' | 'deep' = 'quick'): DiagnosticSessionRow {
    const db = getSqlite();
    const now = new Date().toISOString();
    const id = randomUUID();

    const payload = JSON.stringify({
      deviceName: meta.deviceName ?? '',
      manufacturer: meta.manufacturer ?? '',
      model: meta.model ?? '',
      serialNumber: meta.serialNumber ?? '',
      windowsVersion: meta.windowsVersion ?? '',
    });

    db.run(
      `INSERT INTO diagnostic_sessions (id, device_id, session_code, payload, health_score, category_scores,
        overall_status, scan_mode, recommendations, collector_version, started_at, completed_at,
        duration_seconds, summary, created_at)
      VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, NULL, ?, NULL, NULL, NULL, ?)`,
      [id, deviceId, sessionCode, payload, scanMode, now, now],
    );

    return db
      .prepare('SELECT * FROM diagnostic_sessions WHERE id = ?')
      .getAsObject() as unknown as DiagnosticSessionRow;
  },

  update(id: string, data: Partial<DiagnosticSessionRow>): void {
    const db = getSqlite();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key}=?`);
        values.push(value as string | number | null);
      }
    }

    if (fields.length === 0) return;
    values.push(id);

    db.run(`UPDATE diagnostic_sessions SET ${fields.join(', ')} WHERE id=?`, values);
  },

  findById(id: string): DiagnosticSessionRow | undefined {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM diagnostic_sessions WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as DiagnosticSessionRow;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  },

  findByDeviceId(deviceId: string, limit: number = 5): DiagnosticSessionRow[] {
    const db = getSqlite();
    const stmt = db.prepare(
      'SELECT * FROM diagnostic_sessions WHERE device_id = ? ORDER BY created_at DESC LIMIT ?',
    );
    stmt.bind([deviceId, limit]);
    const rows: DiagnosticSessionRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as DiagnosticSessionRow);
    }
    stmt.free();
    return rows;
  },

  list(limit: number = 20, offset: number = 0): DiagnosticSessionRow[] {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM diagnostic_sessions ORDER BY created_at DESC LIMIT ? OFFSET ?');
    stmt.bind([limit, offset]);
    const rows: DiagnosticSessionRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as DiagnosticSessionRow);
    }
    stmt.free();
    return rows;
  },

  addTestResult(
    sessionId: string,
    testId: string,
    label: string,
    status: 'completed' | 'warning' | 'error' | 'skipped' | 'running',
    health: 'good' | 'warning' | 'critical' | 'unknown',
    data: Record<string, unknown>,
    warnings: string[],
    duration: number | null,
  ): void {
    const db = getSqlite();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO test_results (id, session_id, test_id, label, status, health, data, warnings, duration, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(), sessionId, testId, label, status, health,
        JSON.stringify(data), JSON.stringify(warnings), duration, now,
      ],
    );
  },

  getTestResults(sessionId: string): TestResultRow[] {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM test_results WHERE session_id = ? ORDER BY created_at');
    stmt.bind([sessionId]);
    const rows: TestResultRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as TestResultRow);
    }
    stmt.free();
    return rows;
  },

  buildHealthScoreInput(testResults: TestResultRecord[]): HealthScoreInput {
    const find = (testId: string) => testResults.find((r) => r.testId === testId);
    const get = (testId: string) => find(testId)?.data ?? {};

    return {
      storage: (() => {
        const r = find('storage');
        if (!r) return undefined;
        return { status: r.status, data: r.data as any };
      })(),
      battery: (() => {
        const r = find('battery');
        if (!r) return undefined;
        return { status: r.status, data: r.data as any };
      })(),
      windows: (() => {
        const r = find('windows');
        if (!r) return undefined;
        return { status: r.status, data: r.data as any };
      })(),
      eventviewer: (() => {
        const r = find('eventviewer');
        if (!r) return undefined;
        return { status: r.status, data: r.data as any };
      })(),
      updates: (() => {
        const r = find('updates');
        if (!r) return undefined;
        return { status: r.status, data: r.data as any };
      })(),
      drivers: (() => {
        const r = find('drivers');
        if (!r) return undefined;
        return { status: r.status, data: r.data as any };
      })(),
      cpu: find('cpu') ? { status: find('cpu')!.status } : undefined,
      memory: find('memory') ? { status: find('memory')!.status } : undefined,
      gpu: find('gpu') ? { status: find('gpu')!.status } : undefined,
      motherboard: find('motherboard') ? { status: find('motherboard')!.status } : undefined,
    };
  },

  completeSession(sessionId: string): void {
    const now = new Date().toISOString();
    const session = diagnosticSessionService.findById(sessionId);
    if (!session) return;

    const started = new Date(session.startedAt).getTime();
    const durationSeconds = Math.round((Date.now() - started) / 1000);

    // Only update timing if scores weren't already set by the collector
    const updates: Partial<DiagnosticSessionRow> = {
      completedAt: now,
      durationSeconds,
    };

    diagnosticSessionService.update(sessionId, updates as any);
  },

  compareSessions(sessionIds: string[]): Record<string, unknown> {
    const sessions = sessionIds.map((id) => {
      const s = diagnosticSessionService.findById(id);
      const tests = diagnosticSessionService.getTestResults(id);
      return { session: s, tests };
    });

    return {
      sessions,
      comparisons: sessions.length >= 2 ? diagnosticSessionService.buildComparison(sessions[0].tests, sessions[1].tests) : [],
    };
  },

  buildComparison(
    current: TestResultRow[],
    previous: TestResultRow[],
  ): Array<{ testId: string; label: string; currentHealth: string; previousHealth: string; change: 'improved' | 'degraded' | 'unchanged' | 'new' | 'removed' }> {
    const allTestIds = new Set([...current.map((t) => t.testId), ...previous.map((t) => t.testId)]);
    const comparisons: Array<any> = [];

    const healthValue = (h: string): number => {
      const map: Record<string, number> = { good: 4, warning: 2, critical: 0, unknown: 1 };
      return map[h] ?? 1;
    };

    for (const testId of allTestIds) {
      const cur = current.find((t) => t.testId === testId);
      const prev = previous.find((t) => t.testId === testId);

      if (cur && !prev) {
        comparisons.push({ testId, label: cur.label, currentHealth: cur.health, previousHealth: 'unknown', change: 'new' });
      } else if (!cur && prev) {
        comparisons.push({ testId, label: prev.label, currentHealth: 'unknown', previousHealth: prev.health, change: 'removed' });
      } else if (cur && prev) {
        const diff = healthValue(cur.health) - healthValue(prev.health);
        const change = diff > 0 ? 'improved' : diff < 0 ? 'degraded' : 'unchanged';
        comparisons.push({ testId, label: cur.label, currentHealth: cur.health, previousHealth: prev.health, change });
      }
    }

    return comparisons;
  },
};
