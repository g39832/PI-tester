import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

export type OverallStatus = 'good' | 'warning' | 'critical';
import { devices } from './devices.js';

export const diagnosticSessions = sqliteTable('diagnostic_sessions', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  sessionCode: text('session_code').notNull(),
  payload: text('payload').notNull(),
  healthScore: integer('health_score'),
  categoryScores: text('category_scores'),
  overallStatus: text('overall_status', { enum: ['good', 'warning', 'critical'] }),
  scanMode: text('scan_mode', { enum: ['quick', 'deep'] }).default('quick'),
  recommendations: text('recommendations'),
  collectorVersion: text('collector_version'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  durationSeconds: real('duration_seconds'),
  summary: text('summary'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  deviceIdx: index('idx_sessions_device').on(table.deviceId),
  createdIdx: index('idx_sessions_created').on(table.createdAt),
  statusIdx: index('idx_sessions_status').on(table.overallStatus),
}));
