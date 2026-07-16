import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { devices } from './devices.js';
import { diagnosticSessions } from './diagnosticSessions.js';

export const technicianNotes = sqliteTable('technician_notes', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => diagnosticSessions.id, { onDelete: 'set null' }),
  note: text('note').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  deviceIdx: index('idx_notes_device').on(table.deviceId),
}));
