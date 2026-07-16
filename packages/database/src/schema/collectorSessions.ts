import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export type CollectorSessionStatus = 'idle' | 'pairing' | 'collecting' | 'processing' | 'complete' | 'cancelled';
import { devices } from './devices.js';
import { diagnosticSessions } from './diagnosticSessions.js';

export const collectorSessions = sqliteTable('collector_sessions', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  status: text('status', {
    enum: ['idle', 'pairing', 'collecting', 'processing', 'complete', 'cancelled'],
  }).notNull().default('idle'),
  deviceId: text('device_id').references(() => devices.id),
  diagnosticSessionId: text('diagnostic_session_id').references(() => diagnosticSessions.id),
  ipAddress: text('ip_address'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  codeIdx: index('idx_collector_code').on(table.code),
  statusIdx: index('idx_collector_status').on(table.status),
}));
