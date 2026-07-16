import { getSqlite } from '@dds/database';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogCategory =
  | 'device_scan'
  | 'status_change'
  | 'collector_connect'
  | 'collector_disconnect'
  | 'error'
  | 'warning'
  | 'backup'
  | 'restore'
  | 'settings_change'
  | 'system';

export interface LogEntry {
  id: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details: string | null;
  createdAt: string;
}

export const logService = {
  add(level: LogLevel, category: LogCategory, message: string, details?: unknown): void {
    try {
      const db = getSqlite();
      const now = new Date().toISOString();
      const detailsStr = details !== undefined ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;
      db.run(
        'INSERT INTO app_log (level, category, message, details, created_at) VALUES (?, ?, ?, ?, ?)',
        [level, category, message, detailsStr, now],
      );
    } catch {
      // Logging must never crash the app
    }
  },

  list(limit: number = 50, offset: number = 0, filters?: {
    level?: LogLevel;
    category?: LogCategory;
    search?: string;
  }): { entries: LogEntry[]; total: number } {
    const db = getSqlite();

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.level) {
      conditions.push('level = ?');
      params.push(filters.level);
    }
    if (filters?.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }
    if (filters?.search) {
      conditions.push('(message LIKE ? OR details LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as cnt FROM app_log ${where}`);
    countStmt.bind(params);
    const total = countStmt.step() ? (countStmt.getAsObject() as { cnt: number }).cnt : 0;
    countStmt.free();

    const stmt = db.prepare(`SELECT * FROM app_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`);
    stmt.bind([...params, limit, offset]);
    const rows: LogEntry[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as LogEntry);
    }
    stmt.free();

    return { entries: rows, total };
  },

  clear(): void {
    try {
      const db = getSqlite();
      db.run('DELETE FROM app_log');
      db.run('VACUUM');
    } catch {}
  },

  pruneOlderThan(days: number): number {
    try {
      const db = getSqlite();
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const stmt = db.prepare('DELETE FROM app_log WHERE created_at < ?');
      stmt.bind([cutoff]);
      stmt.step();
      stmt.free();
      db.run('VACUUM');
      return db.getRowsModified();
    } catch { return 0; }
  },
};
