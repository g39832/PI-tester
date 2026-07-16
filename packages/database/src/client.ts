import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from './schema/index.js';
import fs from 'fs';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlite: SqlJsDatabase | null = null;
let dbPath: string = './disposcan.db';

export interface DatabaseConfig {
  path: string;
}

function loadFromDisk(path: string): Buffer | null {
  try {
    return fs.readFileSync(path);
  } catch {
    return null;
  }
}

export async function getDatabase(config?: DatabaseConfig): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  if (!db) {
    dbPath = config?.path ?? process.env.DATABASE_PATH ?? './disposcan.db';
    const SQL = await initSqlJs();
    if (dbPath === ':memory:') {
      sqlite = new SQL.Database();
    } else {
      const existing = loadFromDisk(dbPath);
      sqlite = existing
        ? new SQL.Database(existing)
        : new SQL.Database();
    }
    sqlite.run('PRAGMA foreign_keys = ON');
    db = drizzle(sqlite, { schema });
  }
  return db;
}

export function getSqlite(): SqlJsDatabase {
  if (!sqlite) {
    throw new Error('Database not initialized. Call getDatabase() first.');
  }
  return sqlite;
}

export function saveDatabase(): void {
  if (!sqlite) return;
  if (dbPath === ':memory:') return;
  const data = sqlite.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function closeDatabase(): void {
  if (sqlite) {
    saveDatabase();
    sqlite.close();
    sqlite = null;
    db = null;
  }
}
