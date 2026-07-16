import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const skuSequences = sqliteTable('sku_sequences', {
  prefix: text('prefix').primaryKey(),
  year: integer('year').notNull(),
  lastSequence: integer('last_sequence').notNull().default(0),
});
