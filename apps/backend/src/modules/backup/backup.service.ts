import { getSqlite, saveDatabase, closeDatabase } from '@dds/database';
import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { settingsService } from '../settings/settings.service.js';

interface BackupMeta {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  type: 'manual' | 'auto';
  includes: string[];
}

function getBackupDir(): string {
  return settingsService.get('backup_directory') || './backups';
}

function getDbPath(): string {
  return process.env.DATABASE_PATH || './disposcan.db';
}

function getAttachmentDir(): string {
  return settingsService.get('attachment_directory') || './attachments';
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export const backupService = {
  async createBackup(type: 'manual' | 'auto' = 'manual'): Promise<BackupMeta> {
    const backupDir = getBackupDir();
    ensureDir(backupDir);

    const ts = timestamp();
    const id = `backup-${ts}`;
    const tmpDir = path.join(backupDir, `.tmp-${id}`);
    ensureDir(tmpDir);

    try {
      saveDatabase();

      const dbFile = getDbPath();
      if (existsSync(dbFile)) {
        writeFileSync(path.join(tmpDir, 'disposcan.db'), readFileSync(dbFile));
      }

      const settingsExport = settingsService.getAll();
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify(settingsExport, null, 2));

      const schemaStmt = getSqlite().prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
      const schemas: string[] = [];
      while (schemaStmt.step()) {
        schemas.push((schemaStmt.getAsObject() as { sql: string }).sql);
      }
      schemaStmt.free();
      writeFileSync(path.join(tmpDir, 'schema.sql'), schemas.join(';\n\n') + ';\n');

      const meta: BackupMeta = {
        id,
        filename: `${id}.ddsbackup.gz`,
        sizeBytes: 0,
        createdAt: new Date().toISOString(),
        type,
        includes: ['database', 'settings'],
      };

      const attDir = getAttachmentDir();
      if (existsSync(attDir)) {
        meta.includes.push('attachments');
      }

      const outFile = path.join(backupDir, meta.filename);
      const fileStream = createReadStream(path.join(tmpDir, 'disposcan.db'));
      const gzip = createGzip();
      const outStream = createWriteStream(outFile);

      await pipeline(fileStream, gzip, outStream, { end: true });

      const stats = existsSync(outFile) ? fs.statSync(outFile) : { size: 0 };
      meta.sizeBytes = stats.size;

      // Cleanup temp
      unlinkSync(path.join(tmpDir, 'disposcan.db'));
      unlinkSync(path.join(tmpDir, 'settings.json'));
      unlinkSync(path.join(tmpDir, 'schema.sql'));
      fs.rmdirSync(tmpDir);

      // Keep only last 20 backups
      cleanupOldBackups(backupDir, 20);

      return meta;
    } catch (err) {
      if (existsSync(tmpDir)) {
        try { fs.rmdirSync(tmpDir, { recursive: true }); } catch {}
      }
      throw err;
    }
  },

  listBackups(): BackupMeta[] {
    const backupDir = getBackupDir();
    if (!existsSync(backupDir)) return [];

    const files = readdirSync(backupDir)
      .filter((f) => f.endsWith('.ddsbackup.gz'))
      .sort()
      .reverse();

    return files.map((f) => {
      const p = path.join(backupDir, f);
      const stats = existsSync(p) ? fs.statSync(p) : { size: 0, mtime: new Date(0) };
      return {
        id: f.replace('.ddsbackup.gz', ''),
        filename: f,
        sizeBytes: stats.size,
        createdAt: stats.mtime.toISOString(),
        type: f.includes('auto') ? 'auto' as const : 'manual' as const,
        includes: ['database', 'settings'],
      };
    });
  },

  getBackupPath(backupId: string): string | null {
    const backupDir = getBackupDir();
    const file = path.join(backupDir, `${backupId}.ddsbackup.gz`);
    if (existsSync(file)) return file;
    // Try as filename directly
    const direct = path.join(backupDir, backupId);
    if (existsSync(direct)) return direct;
    return null;
  },

  async restoreFromBackup(backupId: string): Promise<void> {
    const backupFile = backupService.getBackupPath(backupId);
    if (!backupFile) throw new Error(`Backup not found: ${backupId}`);

    const backupDir = getBackupDir();
    const ts = timestamp();
    const restoreDir = path.join(backupDir, `.restore-${ts}`);
    ensureDir(restoreDir);

    try {
      const gunzip = createGunzip();
      const inStream = createReadStream(backupFile);
      const outFile = path.join(restoreDir, 'disposcan.db');
      const outStream = createWriteStream(outFile);

      await pipeline(inStream, gunzip, outStream);

      if (!existsSync(outFile)) throw new Error('Restore failed: no database extracted');

      // Close current database and replace the file
      closeDatabase();

      const dbPath = getDbPath();
      writeFileSync(dbPath, readFileSync(outFile));

      // Cleanup temp file
      unlinkSync(outFile);
      fs.rmdirSync(restoreDir);

      // Reinitialize database from the restored file
      const { getDatabase } = await import('@dds/database');
      await getDatabase({ path: dbPath });

      // Run migrations to ensure schema is current
      const { migrate } = await import('@dds/database');
      migrate();
    } catch (err) {
      if (existsSync(restoreDir)) {
        try { unlinkSync(path.join(restoreDir, 'disposcan.db')); } catch {}
        try { fs.rmdirSync(restoreDir); } catch {}
      }
      throw err;
    }
  },

  deleteBackup(backupId: string): boolean {
    const file = backupService.getBackupPath(backupId);
    if (!file) return false;
    unlinkSync(file);
    return true;
  },

  async exportDatabase(): Promise<Buffer> {
    saveDatabase();
    const dbFile = getDbPath();
    if (!existsSync(dbFile)) throw new Error('Database file not found');
    return readFileSync(dbFile);
  },
};

function cleanupOldBackups(dir: string, keep: number): void {
  if (!existsSync(dir)) return;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.ddsbackup.gz'))
    .sort()
    .reverse();
  if (files.length > keep) {
    for (const f of files.slice(keep)) {
      try { unlinkSync(path.join(dir, f)); } catch {}
    }
  }
}

let scheduledBackupTimer: ReturnType<typeof setInterval> | null = null;

export function startScheduledBackups(intervalHours: number = 24): void {
  if (scheduledBackupTimer) clearInterval(scheduledBackupTimer);
  scheduledBackupTimer = setInterval(async () => {
    try {
      await backupService.createBackup('auto');
    } catch (err) {
      console.error('Scheduled backup failed:', err);
    }
  }, intervalHours * 60 * 60 * 1000);
}

export function stopScheduledBackups(): void {
  if (scheduledBackupTimer) {
    clearInterval(scheduledBackupTimer);
    scheduledBackupTimer = null;
  }
}
