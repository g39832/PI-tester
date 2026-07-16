import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { devices } from './devices.js';
import { diagnosticSessions } from './diagnosticSessions.js';

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => diagnosticSessions.id, { onDelete: 'set null' }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storagePath: text('storage_path').notNull(),
  description: text('description'),
  uploadedAt: text('uploaded_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  deviceIdx: index('idx_attachments_device').on(table.deviceId),
}));
