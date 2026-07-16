import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { getSqlite } from '@dds/database';

const ATTACHMENTS_DIR = process.env.ATTACHMENTS_DIR ?? join(process.cwd(), 'attachments');

export interface AttachmentRow {
  id: string;
  deviceId: string;
  sessionId: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  description: string | null;
  uploadedAt: string;
  createdAt: string;
}

function ensureDir(): void {
  if (!existsSync(ATTACHMENTS_DIR)) {
    mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
}

export const attachmentService = {
  async upload(
    deviceId: string,
    sessionId: string | null,
    originalName: string,
    mimeType: string,
    buffer: Buffer,
    description: string | null,
  ): Promise<AttachmentRow> {
    ensureDir();
    const db = getSqlite();
    const now = new Date().toISOString();
    const id = randomUUID();
    const ext = originalName.includes('.') ? originalName.split('.').pop() : '';
    const storedName = `${id}${ext ? '.' + ext : ''}`;
    const storagePath = join(ATTACHMENTS_DIR, storedName);

    writeFileSync(storagePath, buffer);

    db.run(
      `INSERT INTO attachments (id, device_id, session_id, filename, original_name, mime_type, size_bytes, storage_path, description, uploaded_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, deviceId, sessionId, storedName, originalName, mimeType, buffer.length, storagePath, description, now, now],
    );

    return db
      .prepare('SELECT * FROM attachments WHERE id = ?')
      .getAsObject() as unknown as AttachmentRow;
  },

  listByDevice(deviceId: string): AttachmentRow[] {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM attachments WHERE device_id = ? ORDER BY created_at DESC');
    stmt.bind([deviceId]);
    const rows: AttachmentRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as AttachmentRow);
    }
    stmt.free();
    return rows;
  },

  listBySession(sessionId: string): AttachmentRow[] {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM attachments WHERE session_id = ? ORDER BY created_at DESC');
    stmt.bind([sessionId]);
    const rows: AttachmentRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as AttachmentRow);
    }
    stmt.free();
    return rows;
  },

  findById(id: string): AttachmentRow | undefined {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM attachments WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as AttachmentRow;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  },

  getFilePath(attachment: AttachmentRow): string {
    return attachment.storagePath;
  },

  getFileBuffer(attachment: AttachmentRow): Buffer {
    return readFileSync(attachment.storagePath);
  },

  delete(id: string): boolean {
    const attachment = attachmentService.findById(id);
    if (!attachment) return false;

    try {
      if (existsSync(attachment.storagePath)) {
        unlinkSync(attachment.storagePath);
      }
    } catch { /* ignore file deletion errors */ }

    const db = getSqlite();
    const stmt = db.prepare('DELETE FROM attachments WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const changes = db.getRowsModified();
    stmt.free();
    return changes > 0;
  },
};
