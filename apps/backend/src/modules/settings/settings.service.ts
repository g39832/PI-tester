import { getSqlite } from '@dds/database';

export interface SettingEntry {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description: string | null;
  updatedAt: string;
}

const DEFAULT_SETTINGS: Record<string, string> = {
  company_name: 'Dispo.Tech',
  company_logo: '',
  sku_prefix: 'DDS',
  sku_auto_increment: 'true',
  health_score_good_threshold: '80',
  health_score_warning_threshold: '50',
  attachment_directory: './attachments',
  backup_directory: './backups',
  scan_timeout_seconds: '120',
  theme: 'dark',
  diagnostic_mode_default: 'quick',
};

export const settingsService = {
  getAll(): SettingEntry[] {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM settings ORDER BY key');
    const rows: SettingEntry[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SettingEntry);
    }
    stmt.free();
    return rows;
  },

  get(key: string): string | undefined {
    const db = getSqlite();
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    stmt.bind([key]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as { value: string };
      stmt.free();
      return row.value;
    }
    stmt.free();
    return DEFAULT_SETTINGS[key];
  },

  getTyped<T = string>(key: string): T | undefined {
    const db = getSqlite();
    const stmt = db.prepare('SELECT value, type FROM settings WHERE key = ?');
    stmt.bind([key]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as { value: string; type: string };
      stmt.free();
      switch (row.type) {
        case 'number': return Number(row.value) as unknown as T;
        case 'boolean': return (row.value === 'true') as unknown as T;
        case 'json': return JSON.parse(row.value) as T;
        default: return row.value as unknown as T;
      }
    }
    stmt.free();
    return undefined;
  },

  set(key: string, value: string, type: string = 'string'): void {
    const db = getSqlite();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO settings (key, value, type, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, type = excluded.type, updated_at = excluded.updated_at`,
      [key, value, type, now],
    );
  },

  setMultiple(entries: Array<{ key: string; value: string; type: string }>): void {
    const db = getSqlite();
    const now = new Date().toISOString();
    db.run('BEGIN TRANSACTION');
    try {
      for (const entry of entries) {
        db.run(
          `INSERT INTO settings (key, value, type, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, type = excluded.type, updated_at = excluded.updated_at`,
          [entry.key, entry.value, entry.type, now],
        );
      }
      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    }
  },

  reset(key: string): void {
    const db = getSqlite();
    const defaultVal = DEFAULT_SETTINGS[key];
    if (defaultVal !== undefined) {
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO settings (key, value, type, updated_at)
         VALUES (?, ?, 'string', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, defaultVal, now],
      );
    }
  },
};
