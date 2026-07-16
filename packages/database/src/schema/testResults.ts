import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

export type TestStatus = 'complete' | 'warning' | 'error' | 'skipped';
export type TestHealth = 'good' | 'warning' | 'critical' | 'unknown';
import { diagnosticSessions } from './diagnosticSessions.js';

export const testResults = sqliteTable('test_results', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => diagnosticSessions.id, { onDelete: 'cascade' }),
  testId: text('test_id').notNull(),
  label: text('label').notNull(),
  status: text('status', { enum: ['complete', 'warning', 'error', 'skipped'] }).notNull(),
  health: text('health', { enum: ['good', 'warning', 'critical', 'unknown'] }).notNull(),
  data: text('data').notNull(),
  warnings: text('warnings'),
  duration: real('duration'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  sessionIdx: index('idx_tests_session').on(table.sessionId),
}));
