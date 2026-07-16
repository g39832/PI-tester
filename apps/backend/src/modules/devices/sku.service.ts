import { getSqlite } from '@dds/database';

const DEVICE_TYPE_PREFIXES: Record<string, string> = {
  desktop: 'DT',
  laptop: 'LT',
  tablet: 'TB',
  server: 'SR',
  other: 'OT',
};

export function generateCompanySku(deviceType: string): string {
  const db = getSqlite();
  const prefix = DEVICE_TYPE_PREFIXES[deviceType] ?? 'OT';
  const year = new Date().getFullYear();

  const selectStmt = db.prepare('SELECT last_sequence FROM sku_sequences WHERE prefix = ?');
  selectStmt.bind([prefix]);

  let nextSeq: number;
  if (selectStmt.step()) {
    const currentSeq = Number((selectStmt.getAsObject() as Record<string, unknown>).last_sequence);
    nextSeq = currentSeq + 1;
    const updateStmt = db.prepare('UPDATE sku_sequences SET last_sequence = ?, year = ? WHERE prefix = ?');
    updateStmt.bind([nextSeq, year, prefix]);
    updateStmt.step();
    updateStmt.free();
  } else {
    nextSeq = 1;
    const insertStmt = db.prepare('INSERT INTO sku_sequences (prefix, year, last_sequence) VALUES (?, ?, ?)');
    insertStmt.bind([prefix, year, nextSeq]);
    insertStmt.step();
    insertStmt.free();
  }
  selectStmt.free();

  return `${prefix}-${year}-${String(nextSeq).padStart(6, '0')}`;
}
