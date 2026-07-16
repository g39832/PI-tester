import { randomUUID } from 'node:crypto';
import { getSqlite } from '@dds/database';
import type { WebSocket } from 'ws';
import { collectorSessionRepository } from '../diagnostics/collectorSession.repository.js';
import { diagnosticSessionService } from '../diagnostics/diagnosticSession.service.js';
import { AppError } from '../../shared/errors.js';

const MIN_COLLECTOR_VERSION = '3.0.0';
const MAX_SESSION_RECOVERY_AGE_MS = 30 * 60 * 1000;

export function parseVersion(v: string): number[] {
  return v.split('.').map((p) => parseInt(p, 10) || 0);
}

export function isVersionCompatible(collectorVer: string, serverMin: string): { ok: boolean; reason?: string } {
  const cv = parseVersion(collectorVer);
  const sm = parseVersion(serverMin);
  for (let i = 0; i < Math.max(cv.length, sm.length); i++) {
    const a = cv[i] ?? 0;
    const b = sm[i] ?? 0;
    if (a < b) return { ok: false, reason: `Collector v${collectorVer} is below minimum v${serverMin}. Please update the collector.` };
    if (a > b) return { ok: true };
  }
  return { ok: true };
}

export function validateMessage(msg: unknown, schema: Record<string, string>): string[] {
  const errors: string[] = [];
  if (typeof msg !== 'object' || msg === null) {
    errors.push('Message must be a JSON object');
    return errors;
  }
  const obj = msg as Record<string, unknown>;
  for (const [field, type] of Object.entries(schema)) {
    const val = obj[field];
    if (val === undefined || val === null) {
      errors.push(`Missing required field: ${field}`);
      continue;
    }
    switch (type) {
      case 'string':
        if (typeof val !== 'string') errors.push(`Field ${field} must be a string`);
        break;
      case 'number':
        if (typeof val !== 'number') errors.push(`Field ${field} must be a number`);
        break;
      case 'boolean':
        if (typeof val !== 'boolean') errors.push(`Field ${field} must be a boolean`);
        break;
      case 'object':
        if (typeof val !== 'object' || Array.isArray(val)) errors.push(`Field ${field} must be an object`);
        break;
      case 'array':
        if (!Array.isArray(val)) errors.push(`Field ${field} must be an array`);
        break;
    }
  }
  return errors;
}

export function checkDuplicateSubmission(sessionId: string, testId: string): boolean {
  const db = getSqlite();
  const stmt = db.prepare('SELECT id FROM test_results WHERE session_id = ? AND test_id = ?');
  stmt.bind([sessionId, testId]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

export function findResumableCollectorSession(code: string): string | null {
  const db = getSqlite();
  const cutoff = new Date(Date.now() - MAX_SESSION_RECOVERY_AGE_MS).toISOString();
  const stmt = db.prepare(
    `SELECT id FROM collector_sessions
     WHERE code = ? AND status IN ('idle', 'pairing', 'collecting')
     AND created_at > ? ORDER BY created_at DESC LIMIT 1`,
  );
  stmt.bind([code, cutoff]);
  if (stmt.step()) {
    const id = stmt.getAsObject() as { id: string };
    stmt.free();
    return id.id;
  }
  stmt.free();
  return null;
}

export function findIncompleteDiagnosticSession(collectorSessionId: string): string | null {
  const db = getSqlite();
  const stmt = db.prepare(
    'SELECT id, diagnostic_session_id FROM collector_sessions WHERE id = ?',
  );
  stmt.bind([collectorSessionId]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as { id: string; diagnostic_session_id: string | null };
    stmt.free();
    return row.diagnostic_session_id;
  }
  stmt.free();
  return null;
}

export function getCompletedTestIds(sessionId: string): string[] {
  const db = getSqlite();
  const stmt = db.prepare(
    "SELECT test_id FROM test_results WHERE session_id = ? AND status != 'running'",
  );
  stmt.bind([sessionId]);
  const ids: string[] = [];
  while (stmt.step()) {
    ids.push((stmt.getAsObject() as { test_id: string }).test_id);
  }
  stmt.free();
  return ids;
}
