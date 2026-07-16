# DispoScan Architecture Guide

**Maintainer documentation for the DispoScan diagnostic appliance.**

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Database Schema](#database-schema)
3. [Collector Architecture](#collector-architecture)
4. [Backend API](#backend-api)
5. [Frontend Kiosk](#frontend-kiosk)
6. [WebSocket Protocol](#websocket-protocol)
7. [Health Score Engine](#health-score-engine)
8. [Recommendations Engine](#recommendations-engine)
9. [Settings System](#settings-system)
10. [Backup System](#backup-system)
11. [Logging System](#logging-system)
12. [Extension Architecture](#extension-architecture)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [Troubleshooting](#troubleshooting)

---

## Project Structure

```
disposcan/
├── apps/
│   ├── backend/          # Express + WebSocket server (Pi-side)
│   │   ├── src/
│   │   │   ├── config/       # Environment config (env.ts)
│   │   │   ├── middleware/   # Error handler, logger, rate limiter
│   │   │   ├── modules/
│   │   │   │   ├── attachments/    # File upload/download
│   │   │   │   ├── backup/         # Backup/restore service
│   │   │   │   ├── collector/      # Collector version/validation logic
│   │   │   │   ├── devices/        # Device CRUD + SKU generation
│   │   │   │   ├── diagnostics/    # Sessions, test results, collector sessions
│   │   │   │   ├── health/         # Health score + recommendations engines
│   │   │   │   ├── logging/        # Structured app log
│   │   │   │   ├── reports/        # PDF report generation
│   │   │   │   ├── search/         # Cross-entity search
│   │   │   │   └── settings/       # Persistent settings
│   │   │   ├── routes/         # Top-level route files
│   │   │   ├── shared/         # Shared utilities (errors, response, pagination)
│   │   │   ├── ws/             # WebSocket server (session codes, WS handler)
│   │   │   └── extensions/     # Extension point interfaces + registry
│   │   ├── tests/
│   │   │   ├── unit/           # Unit tests (health, recommendations, sessions, PDF)
│   │   │   └── integration/    # Integration tests (REST API)
│   │   └── dist/              # Compiled JS output
│   └── frontend/          # React kiosk UI (Vite)
│       └── src/
│           ├── api/            # API client functions
│           ├── components/     # Kiosk components (KioskProvider, StepIndicator)
│           ├── hooks/          # Custom hooks (useInactivityTimer)
│           ├── pages/          # Page-level components (Settings, History, Reports)
│           ├── workflow/       # 7-stage kiosk workflow components
│           └── styles/         # CSS
├── collector/             # PowerShell collector (Windows-side)
│   ├── collector.ps1      # Main coordinator script
│   ├── run_collector.cmd  # Double-click launcher
│   └── modules/           # 15 independent diagnostic modules
├── packages/
│   ├── database/          # SQLite schema, migrations, client
│   │   └── src/
│   │       ├── schema/        # Drizzle ORM table definitions
│   │       ├── client.ts      # Database init + access
│   │       └── migrate.ts     # Schema migrations (v1-v4)
│   └── shared/            # Shared TypeScript types (API response, devices)
├── scripts/
│   ├── deploy-pi.sh       # One-shot Raspberry Pi deployment
│   ├── setup-kiosk.sh     # Legacy kiosk setup (use deploy-pi.sh)
│   └── HARDWARE_VALIDATION_PLAN.md
└── docs/                  # This documentation
```

---

## Database Schema

**Database**: SQLite (via `sql.js`), in-memory by default, persisted to file.

### Tables

#### `devices`
The central device registry. One row per physical device.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| company_sku | TEXT UNIQUE | DispoScan internal SKU (e.g., LAP-26-0001) |
| serial_number | TEXT | Manufacturer serial number |
| manufacturer | TEXT NOT NULL | Dell, HP, Lenovo, etc. |
| model | TEXT NOT NULL | Product model name |
| device_type | TEXT | CHECK: desktop/laptop/tablet/server/other |
| status | TEXT NOT NULL | CHECK: new_intake/diagnosed/repairing/waiting_parts/ready_pickup/completed/sold/archived |
| technician_notes | TEXT | Free-text notes |
| date_added | TEXT NOT NULL | ISO 8601 |
| last_scan_date | TEXT | Most recent diagnostic scan |
| created_at / updated_at | TEXT | Timestamps |

#### `diagnostic_sessions`
One row per diagnostic scan. Permanently attached to a device (or orphaned if no device matched).

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| device_id | TEXT FK → devices | Nullable (orphan session) |
| session_code | TEXT NOT NULL | 5-char collector pairing code |
| payload | TEXT | JSON metadata (deviceName, manufacturer, etc.) |
| health_score | INTEGER | 0-100 weighted score |
| category_scores | TEXT | JSON: {storage, battery, windows_health, hardware, security, temperature} |
| overall_status | TEXT | good/warning/critical |
| scan_mode | TEXT | quick/deep |
| recommendations | TEXT | JSON array of recommendation objects |
| started_at / completed_at | TEXT | ISO 8601 |
| duration_seconds | REAL | Wall-clock duration |

#### `test_results`
Individual module results within a session.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| session_id | TEXT FK → diagnostic_sessions | |
| test_id | TEXT | Module identifier (cpu, memory, storage, etc.) |
| label | TEXT | Human-readable name |
| status | TEXT | completed/warning/error/skipped/running |
| health | TEXT | good/warning/critical/unknown |
| data | TEXT | JSON — module-specific diagnostic data |
| warnings | TEXT | JSON array of warning strings |
| duration | REAL | Seconds |

#### `collector_sessions`
Tracks the state of each collector connection.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| code | TEXT | Session pairing code |
| status | TEXT | idle/pairing/collecting/processing/complete/cancelled |
| diagnostic_session_id | TEXT FK | Links to the actual diagnostic data |
| ip_address | TEXT | Optional |
| started_at / completed_at | TEXT | |

#### `settings`
Key-value persistent configuration.

| Column | Type |
|--------|------|
| key | TEXT PK |
| value | TEXT |
| type | TEXT: string/number/boolean/json |
| description | TEXT |
| updated_at | TEXT |

#### `app_log`
Structured application log.

| Column | Type |
|--------|------|
| id | INTEGER PK AUTOINCREMENT |
| level | TEXT: info/warn/error/debug |
| category | TEXT: device_scan/status_change/collector_connect/collector_disconnect/error/warning/backup/restore/settings_change/system |
| message | TEXT |
| details | TEXT (optional JSON) |
| created_at | TEXT |

#### Other tables
- `attachments` — File metadata for uploaded attachments
- `technician_notes` — Free-text notes per device/session
- `sku_sequences` — Auto-increment counters for SKU generation
- `schema_version` — Migration tracking

---

## Collector Architecture

The collector is a **PowerShell 5.1+** script (`collector.ps1`) that runs on the Windows endpoint. It is never installed — it is launched from a USB drive or network share.

### Flow

1. **Auto-discovery**: Attempts mDNS (Resolve-DnsName), TCP port scan (254 hosts on /24 subnet), and gateway probe to find the Pi.
2. **Session pairing**: Calls `GET /api/v1/collector/current` on the Pi to fetch the session code.
3. **WebSocket connection**: Connects to `ws://<pi>:3002/collect` with the session code in the `X-Session-Code` header.
4. **Handshake**: Sends `hello` with version info; receives `hello_ack` with accepted tests list.
5. **Metadata**: Sends `session_meta` with device name, manufacturer, model, Windows version.
6. **Diagnostic modules**: Iterates through the module list. For each module:
   - Dot-sources the `.ps1` file
   - Calls the module's function
   - Sends `test_result` with status, health, data, warnings, duration
   - Waits for `ack`
   - Writes resume state to `$env:TEMP\disposcan_resume.json`
7. **Health score**: Runs `healthscore.ps1` (PowerShell-side calculation) and sends `health_score`.
8. **Completion**: Sends `complete` → receives `complete_ack` → closes WebSocket.
9. **Resume file deleted**.

### 15 Diagnostic Modules

| Module | File | Quick | Deep | Admin? |
|--------|------|-------|------|--------|
| CPU | cpu.ps1 | ✓ | ✓ | No |
| Memory | memory.ps1 | ✓ | ✓ | No |
| Storage | storage.ps1 | ✓ | ✓ | No |
| GPU | gpu.ps1 | ✓ | ✓ | No |
| Motherboard | motherboard.ps1 | ✓ | ✓ | No |
| Battery | battery.ps1 | ✓ | ✓ | No |
| Network | network.ps1 | ✓ | ✓ | No |
| Windows OS | windows.ps1 | ✓ | ✓ | No |
| Updates | updates.ps1 | ✓ | ✓ | No |
| Drivers | drivers.ps1 | ✓ | ✓ | No |
| Event Log | eventviewer.ps1 | ✓ | ✓ | No |
| SFC | sfc.ps1 | ✗ | ✓ | Yes |
| DISM | dism.ps1 | ✗ | ✓ | Yes |
| File System Check | fscheck.ps1 | ✗ | ✓ | Yes |
| Deep Event Log | eventviewer.ps1 (deep) | ✗ | ✓ | No |

All modules return a consistent hashtable: `@{ status='completed'; data=@{}; warnings=@(); duration=<sec> }`.

### Resume / Recovery

The collector writes a resume file after each module completes: `$env:TEMP\disposcan_resume.json`. If the collector is re-launched and detects an existing resume file, it offers the server a resume session. The server can accept (`resumeAccepted: true`) and list already-completed test IDs. The collector then skips those modules.

---

## Backend API

### REST Endpoints

All under `/api/v1/`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | /health | Health check |
| GET/POST/PUT/DELETE | /devices[/:id] | Device CRUD |
| GET | /devices/stats | Device statistics |
| GET | /sessions[/:id] | Session CRUD + detail |
| GET | /sessions/device/:deviceId | Device scan history |
| GET | /sessions/compare/:id1/:id2 | Session comparison |
| GET | /search?q= | Cross-entity search |
| GET | /collector/current | Current session code |
| GET | /collector/history | Past collector sessions |
| GET/PUT | /settings[/:key] | Settings read/update |
| POST | /settings/:key/reset | Reset setting to default |
| POST | /backup/create | Create backup |
| GET | /backup/list | List backups |
| POST | /backup/restore/:id | Restore from backup |
| GET | /backup/export | Download raw DB |
| POST | /backup/schedule[/stop] | Auto-backup |
| GET/DELETE | /logs[/:id] | Log viewer |
| DELETE | /logs/clear | Clear logs |
| POST | /attachments[/:id] | Upload/download/delete |
| GET | /reports/session/:id | PDF report download |

### WebSocket

Port **3002**, path `/collect`. Protocol:

1. Collector sends `hello` with `sessionCode` + `collectorVersion` + `protocol`.
2. Server validates version compatibility. If incompatible, returns error and closes.
3. Server validates session code. If expired/invalid, returns error and closes.
4. Server responds `hello_ack` with `sessionId`, `acceptedTests`, optionally `resumeAccepted`.
5. Collector sends `session_meta`.
6. For each module: collector sends `progress`, then `test_result`, server responds `ack`.
7. Collector sends `health_score`, server responds `ack_hs`.
8. Collector sends `complete`, server responds `complete_ack`, closes.

Server runs a heartbeat (15s interval, 45s timeout). If no pong received, connection is terminated and session marked as `collecting` (allowing resume).

---

## Health Score Engine

Located at `apps/backend/src/modules/health/healthScore.service.ts`.

### Weights

| Category | Weight |
|----------|--------|
| Storage | 30% |
| Battery | 20% |
| Windows Health | 20% |
| Hardware | 15% |
| Security | 10% |
| Temperature | 5% |

### Category Scoring

- **Storage**: Starts at 100. Failing SMART → 0. Wear > 80% → 30. Wear > 60% → 60.
- **Battery**: Starts at 100. No battery (desktop) → 100. Wear ≥ 30% → 0. Wear ≥ 15% → 50.
- **Windows Health**: Starts at 100. Deductions for not activated, critical events, many errors, pending updates, driver problems.
- **Hardware**: Starts at 100. Each failed component (CPU/Memory/GPU/Motherboard) → -25.
- **Security**: Starts at 100. Deductions for disabled Secure Boot, missing TPM, disabled BitLocker on laptop.
- **Temperature**: Starts at 100. Drive temp > 70°C → 0. > 60°C → 50. > 50°C → 75.

Categories default to `null` if the corresponding module hasn't run. Null categories are excluded from the weighted average.

### Overall Score

`round(weightedTotal / weightSum)`. Returns `null` if no categories have scores (no diagnostics run yet).

### Overall Status

- `good`: score ≥ 80
- `warning`: score ≥ 50
- `critical`: score < 50
- `unknown`: score is null

---

## Recommendations Engine

Located at `apps/backend/src/modules/health/recommendations.service.ts`.

Generates deterministic recommendations based on category scores and individual test data. Each recommendation has:
- `category`: Which category triggered it
- `severity`: `critical` | `warning` | `info`
- `message`: Short summary
- `detail`: Longer explanation
- `testIds`: Array of test IDs that triggered this recommendation

Rules are evaluated in order. No AI or machine learning — every recommendation is directly traceable to a specific diagnostic result.

---

## Settings System

Settings are stored in the `settings` SQLite table. The `settingsService` (in `apps/backend/src/modules/settings/`) provides typed getters and bulk setters.

### Default Settings

| Key | Type | Default |
|-----|------|---------|
| company_name | string | Dispo.Tech |
| company_logo | string | *empty* |
| sku_prefix | string | DDS |
| sku_auto_increment | boolean | true |
| health_score_good_threshold | number | 80 |
| health_score_warning_threshold | number | 50 |
| attachment_directory | string | ./attachments |
| backup_directory | string | ./backups |
| scan_timeout_seconds | number | 120 |
| theme | string | dark |
| diagnostic_mode_default | string | quick |

---

## Backup System

Located at `apps/backend/src/modules/backup/backup.service.ts`.

### Backup Format
- File extension: `.ddsbackup.gz`
- Contents: gzip-compressed SQLite database file
- Metadata embedded in the filename and stored in a header

### Operations
- **Manual**: `POST /api/v1/backup/create` — creates a gzipped DB snapshot
- **Restore**: `POST /api/v1/backup/restore/:id` — closes DB, replaces file, reopens, runs migrations
- **Scheduled**: `POST /api/v1/backup/schedule` — starts interval-based auto-backup (default 24h)
- **Export**: `GET /api/v1/backup/export` — raw DB download
- **List**: `GET /api/v1/backup/list` — lists all `.ddsbackup.gz` files
- **Cleanup**: Auto-prunes to keep last 20 backups

### Recovery After Restore
After restore, the application re-initializes the database connection and runs migrations. No reboot required.

---

## Logging System

Located at `apps/backend/src/modules/logging/`.

- Log entries are stored in the `app_log` table.
- `logService.add()` never throws — logging failures are silently swallowed to avoid disrupting the application.
- An auto-logging Express middleware (`requestLogger.ts`) records 4xx/5xx responses, device scans, and collector connections.
- Entries are filterable by level, category, and text search via `GET /api/v1/logs`.
- Log retention is configurable via `logService.pruneOlderThan(days)`.
- No PII (personally identifiable information) should be written to logs. Device serial numbers and model names are acceptable.

---

## Extension Architecture

Extensions follow a **registry pattern** — core code never imports extension implementations directly.

### Registry

`apps/backend/src/extensions/extensionRegistry.ts`

```typescript
import { extensionRegistry } from '../extensions/extensionRegistry.js';

const scanner = extensionRegistry.getScanner();
if (scanner) {
  scanner.start((event) => handleScan(event.code));
}
```

### Available Extension Points

| Interface | File | Purpose |
|-----------|------|---------|
| `ScannerPlugin` | extensions/types.ts | USB barcode/QR scanner (HID keyboard) |
| `ThermalPrinterPlugin` | extensions/types.ts | ESC/POS receipt printer |
| `LabelPrinterPlugin` | extensions/types.ts | ZPL/raster label printer |
| `StorageMonitorPlugin` | extensions/types.ts | USB auto-mount / external storage |
| `UpsMonitorPlugin` | extensions/types.ts | UPS HAT monitoring (I2C/GPIO) |

Each interface file includes detailed contract documentation in JSDoc comments. Implementing an extension requires:
1. Create a new directory: `src/extensions/<name>/`
2. Implement the interface
3. Register it in the extension registry (from the main server startup)

---

## Testing

### Backend Tests

```
pnpm -F @dds/backend test
```

- **Framework**: Vitest
- **Location**: `apps/backend/tests/`
- **7 test files, 51 tests**

| File | Type | Tests | Purpose |
|------|------|-------|---------|
| healthScore.test.ts | Unit | 13 | Score engine edge cases |
| recommendations.test.ts | Unit | 9 | Recommendation rules |
| deviceMatching.test.ts | Unit | 4 | SKU gen, normalization |
| sessionService.test.ts | Unit | 7 | Session CRUD, comparison |
| pdfReport.test.ts | Unit | 3 | PDF generation |
| api.test.ts | Integration | 10 | REST API via supertest |
| sessionRoutes.test.ts | Unit | 5 | Session route handlers |

### Running Specific Tests

```
pnpm -F @dds/backend test -- tests/unit/healthScore.test.ts
```

### CI

Tests are designed to run without external dependencies. The database uses `:memory:` mode for tests.

---

## Deployment

### Raspberry Pi

One-step deployment:

```bash
sudo bash scripts/deploy-pi.sh
```

This script:
1. Installs system packages (Chromium, avahi, sqlite3, etc.)
2. Installs Node.js 20 + pnpm
3. Clones/pulls the repository
4. Builds all packages
5. Configures Avahi mDNS as `_disposcan._tcp`
6. Creates systemd services (`disposcan-backend`, `disposcan-kiosk`)
7. Configures auto-login + screen blanking disable
8. Verifies installation

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | HTTP API port |
| WS_PORT | 3002 | WebSocket collector port |
| DATABASE_PATH | ./data/disposcan.db | SQLite database file |
| CORS_ORIGIN | http://localhost:5173 | CORS allowed origin |
| REPORTS_DIR | ./data/reports | PDF report output |
| ATTACHMENTS_DIR | ./data/attachments | Attachment storage |
| BACKUP_DIR | ./data/backups | Backup storage |
| LOG_LEVEL | info | Log level (debug/info/warn/error) |

### Updating

```bash
cd /opt/disposcan
git pull
pnpm install
pnpm -r build
sudo systemctl restart disposcan-backend
```

---

## Troubleshooting

### Collector won't connect

1. Verify both devices are on the same network.
2. Check the Pi is running: `curl http://<pi-ip>:3001/api/v1/health`
3. Check mDNS: `avahi-browse _disposcan._tcp`
4. On the collector, check `$env:TEMP\disposcan_resume.json` for partial state.
5. Increase PowerShell verbosity: `$VerbosePreference = "Continue"` in collector.ps1.

### WebSocket drops mid-scan

1. Check `journalctl -u disposcan-backend` for error messages.
2. The session is preserved on the Pi (status stays `collecting`).
3. Re-run the collector — it will attempt to resume with the `resumeSessionId`.
4. If the 45s heartbeat timeout killed the connection, check network stability.

### Health score is null

1. No diagnostics have been collected for this session.
2. Check the `diagnostic_sessions` table: `health_score` and `category_scores` columns.
3. Verify the collector reached the `complete` step.
4. The server falls back to its own health score calculation if the collector doesn't send one.

### Backup restore fails

1. Check the backup file exists: `ls /opt/disposcan/data/backups/*.ddsbackup.gz`
2. Verify disk space: `df -h`
3. The restore process closes the current database, replaces it, reopens, and runs migrations.
4. If migration fails during restore, the original database is preserved.
5. Check `journalctl -u disposcan-backend` for error details.

### Logs show no entries

1. Verify the `app_log` table exists in `schema_version` >= 3.
2. Check the log viewer at `GET /api/v1/logs?limit=10`.
3. Logging failures are silently swallowed — if the table doesn't exist, logs are not written.
