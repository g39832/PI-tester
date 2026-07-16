import { randomUUID } from 'node:crypto';
import { getSqlite } from '@dds/database';

const STATES = ['idle', 'pairing', 'collecting', 'processing', 'complete', 'cancelled'] as const;
export type SessionStatus = (typeof STATES)[number];

export interface CollectorSessionRow {
  id: string;
  code: string;
  status: SessionStatus;
  deviceId: string | null;
  diagnosticSessionId: string | null;
  ipAddress: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export const collectorSessionRepository = {
  create(code: string): CollectorSessionRow {
    const db = getSqlite();
    const now = new Date().toISOString();
    const id = randomUUID();

    db.run(
      `INSERT INTO collector_sessions (id, code, status, device_id, diagnostic_session_id, ip_address, started_at, completed_at, created_at)
      VALUES (?, ?, 'idle', NULL, NULL, NULL, NULL, NULL, ?)`,
      [id, code, now],
    );

    const stmt = db.prepare('SELECT * FROM collector_sessions WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const row = stmt.getAsObject() as unknown as CollectorSessionRow;
    stmt.free();
    return row;
  },

  findActiveByCode(code: string): CollectorSessionRow | undefined {
    const db = getSqlite();
    const stmt = db.prepare(
      "SELECT * FROM collector_sessions WHERE code = ? AND status NOT IN ('complete', 'cancelled') ORDER BY created_at DESC LIMIT 1",
    );
    stmt.bind([code]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as CollectorSessionRow;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  },

  findById(id: string): CollectorSessionRow | undefined {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM collector_sessions WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as CollectorSessionRow;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  },

  update(id: string, data: Partial<CollectorSessionRow>): void {
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

    db.run(`UPDATE collector_sessions SET ${fields.join(', ')} WHERE id=?`, values);
  },

  getActiveSession(): CollectorSessionRow | undefined {
    const db = getSqlite();
    const stmt = db.prepare(
      "SELECT * FROM collector_sessions WHERE status NOT IN ('complete', 'cancelled') ORDER BY created_at DESC LIMIT 1",
    );
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as CollectorSessionRow;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  },

  listRecent(limit: number = 20): CollectorSessionRow[] {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM collector_sessions ORDER BY created_at DESC LIMIT ?');
    stmt.bind([limit]);
    const rows: CollectorSessionRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as CollectorSessionRow);
    }
    stmt.free();
    return rows;
  },
};
