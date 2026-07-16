import { getSqlite } from './client.js';

const SCHEMA_V1_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  description TEXT
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  company_sku TEXT UNIQUE,
  serial_number TEXT,
  asset_tag TEXT,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK(device_type IN ('desktop', 'laptop', 'tablet', 'server', 'other')),
  cpu TEXT,
  ram_gb REAL,
  storage_gb REAL,
  storage_type TEXT,
  gpu TEXT,
  battery_health REAL,
  battery_cycle_count INTEGER,
  bios_version TEXT,
  tpm_status TEXT CHECK(tpm_status IN ('present', 'absent', 'unknown')),
  secure_boot TEXT CHECK(secure_boot IN ('enabled', 'disabled', 'unsupported', 'unknown')),
  windows_version TEXT,
  os_edition TEXT,
  status TEXT NOT NULL DEFAULT 'new_intake' CHECK(status IN ('new_intake', 'diagnosed', 'repairing', 'waiting_parts', 'ready_pickup', 'completed', 'sold', 'archived')),
  technician_notes TEXT,
  date_added TEXT NOT NULL,
  last_scan_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_serial ON devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_devices_manufacturer ON devices(manufacturer);
CREATE INDEX IF NOT EXISTS idx_devices_model ON devices(model);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_last_scan ON devices(last_scan_date);

CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  session_code TEXT NOT NULL,
  payload TEXT NOT NULL,
  health_score INTEGER CHECK(health_score BETWEEN 0 AND 100),
  category_scores TEXT,
  overall_status TEXT CHECK(overall_status IN ('good', 'warning', 'critical')),
  scan_mode TEXT DEFAULT 'quick' CHECK(scan_mode IN ('quick', 'deep')),
  recommendations TEXT,
  collector_version TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_seconds REAL,
  summary TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_device ON diagnostic_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON diagnostic_sessions(created_at DESC);

CREATE TABLE IF NOT EXISTS test_results (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('completed', 'warning', 'error', 'skipped', 'running')),
  health TEXT NOT NULL CHECK(health IN ('good', 'warning', 'critical', 'unknown')),
  data TEXT NOT NULL,
  warnings TEXT,
  duration REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tests_session ON test_results(session_id);

CREATE TABLE IF NOT EXISTS technician_notes (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES diagnostic_sessions(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_device ON technician_notes(device_id);

CREATE TABLE IF NOT EXISTS sku_sequences (
  prefix TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS collector_sessions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'pairing', 'collecting', 'processing', 'complete', 'cancelled')),
  device_id TEXT REFERENCES devices(id),
  diagnostic_session_id TEXT REFERENCES diagnostic_sessions(id),
  ip_address TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collector_code ON collector_sessions(code);
CREATE INDEX IF NOT EXISTS idx_collector_status ON collector_sessions(status);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES diagnostic_sessions(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  description TEXT,
  uploaded_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_device ON attachments(device_id);
`;

const V2_ALTER_SQL = `
ALTER TABLE diagnostic_sessions ADD COLUMN category_scores TEXT;
ALTER TABLE diagnostic_sessions ADD COLUMN scan_mode TEXT DEFAULT 'quick' CHECK(scan_mode IN ('quick', 'deep'));
ALTER TABLE diagnostic_sessions ADD COLUMN recommendations TEXT;
`;

const V3_SETTINGS_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string' CHECK(type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value, type, description, updated_at) VALUES
  ('company_name', 'Dispo.Tech', 'string', 'Company name for reports and branding', datetime('now')),
  ('company_logo', '', 'string', 'URL or base64 encoded company logo', datetime('now')),
  ('sku_prefix', 'DDS', 'string', 'Default prefix for auto-generated SKUs', datetime('now')),
  ('sku_auto_increment', 'true', 'boolean', 'Enable auto-increment for SKUs', datetime('now')),
  ('health_score_good_threshold', '80', 'number', 'Minimum score for "good" health status (0-100)', datetime('now')),
  ('health_score_warning_threshold', '50', 'number', 'Minimum score for "warning" health status (0-100)', datetime('now')),
  ('attachment_directory', './attachments', 'string', 'Directory for storing attachments', datetime('now')),
  ('backup_directory', './backups', 'string', 'Directory for storing backups', datetime('now')),
  ('scan_timeout_seconds', '120', 'number', 'Maximum scan duration before timeout', datetime('now')),
  ('theme', 'dark', 'string', 'UI theme: light or dark', datetime('now')),
  ('diagnostic_mode_default', 'quick', 'string', 'Default diagnostic mode: quick or deep', datetime('now'));

CREATE TABLE IF NOT EXISTS app_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL CHECK(level IN ('info', 'warn', 'error', 'debug')),
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_log_level ON app_log(level);
CREATE INDEX IF NOT EXISTS idx_app_log_category ON app_log(category);
CREATE INDEX IF NOT EXISTS idx_app_log_created ON app_log(created_at DESC);
`;

const V4_OPTIMIZE_SQL = `
CREATE INDEX IF NOT EXISTS idx_devices_company_sku ON devices(company_sku);
CREATE INDEX IF NOT EXISTS idx_devices_date_added ON devices(date_added DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_device_created ON diagnostic_sessions(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_health_score ON diagnostic_sessions(health_score);
CREATE INDEX IF NOT EXISTS idx_sessions_overall_status ON diagnostic_sessions(overall_status);
CREATE INDEX IF NOT EXISTS idx_tests_session_health ON test_results(session_id, health);
CREATE INDEX IF NOT EXISTS idx_notes_session ON technician_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_collector_code_created ON collector_sessions(code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_session ON attachments(session_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded ON attachments(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_level_category ON app_log(level, category);
`;

const SCHEMA_VERSION = 4;

export function migrate(): void {
  const db = getSqlite();

  let currentVersion = 0;
  try {
    const row = db.exec('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1');
    if (row.length > 0 && row[0].values.length > 0) {
      currentVersion = row[0].values[0][0] as number;
    }
  } catch {
    // schema_version doesn't exist yet
  }

  if (currentVersion >= SCHEMA_VERSION) {
    console.log(`Schema already at version ${SCHEMA_VERSION}.`);
    return;
  }

  console.log(`Migrating schema v${currentVersion} → v${SCHEMA_VERSION}...`);

  db.run('BEGIN TRANSACTION');
  try {
    // Always run the base CREATE statements (IF NOT EXISTS)
    db.run(SCHEMA_V1_SQL);

    // Apply v2 changes if coming from v1
    if (currentVersion === 1) {
      db.run(V2_ALTER_SQL);
    }

    // Apply v3 changes if coming from v2
    if (currentVersion === 2) {
      db.run(V3_SETTINGS_SQL);
    }

    // Apply v4 changes if coming from v3
    if (currentVersion === 3) {
      db.run(V4_OPTIMIZE_SQL);
    }

    db.run(
      `INSERT OR REPLACE INTO schema_version (version, description) VALUES (?, ?)`,
      [SCHEMA_VERSION, 'v3: settings, app_log, default settings values']
    );
    db.run('COMMIT');
    console.log('Migration complete.');
  } catch (err) {
    db.run('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  }
}

const isMainModule = process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js');
if (isMainModule) {
  const { getDatabase, closeDatabase } = await import('./client.js');
  await getDatabase();
  migrate();
  closeDatabase();
  console.log('Migration script finished.');
}
