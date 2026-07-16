# DispoScan v1.0.0 Release Readiness Checklist

## Code Audit
- [x] No TODOs, FIXMEs, or HACKs in application code
- [x] Dead code scan complete (no orphaned exports or files)
- [x] All npm dependencies accounted for and used
- [x] pnpm-lock.yaml committed (required for Pi deployment)

## Build & Test
- [x] Typecheck passes on all 4 workspace packages
- [x] All 51 tests pass (7 test files)
- [x] Build succeeds (`pnpm -r build`)
- [x] Frontend production build optimizations: terser minification, vendor chunking, console drop

## Reliability
- [x] WebSocket heartbeat: 15s ping, 45s timeout, stale connections terminated
- [x] Collector version validation on connect (required >= 3.0.0)
- [x] Protocol validation (`disposcan-v1`)
- [x] Message validation (all required fields checked)
- [x] Duplicate test result rejection
- [x] Session resume on reconnect (resume file on collector, `resumeSessionId` on server)
- [x] Graceful shutdown (SIGTERM/SIGINT closes WS, closes DB)
- [x] Uncaught exception / unhandled rejection handlers

## Data Integrity
- [x] Backup: valid gzip of SQLite database (critical bug fixed: metadata prefix removed)
- [x] Restore: close DB → replace file → reinitialize → run migrations
- [x] Scheduled auto-backup with configurable interval
- [x] Auto-cleanup keeps last 20 backups
- [x] Settings exported alongside database

## Power Loss Recovery
- [x] DB uses WAL mode (better-sqlite3 default) — crash-safe for single writer
- [x] Backup temp directories cleaned on error
- [x] Mid-backup power loss leaves only a partial `.ddsbackup.gz` — no data loss
- [x] Mid-restore power loss: temp `.restore-*` dir cleaned on retry, original DB preserved until successful restore
- [x] Collector resume file allows restart from last completed test

## Logging
- [x] Structured `app_log` table with level, category, message, metadata
- [x] Auto-logging middleware records 4xx/5xx, device scans, collector events
- [x] Error logging never throws (`logService.add()` is fire-and-forget)
- [x] Frontend log viewer with level/category/text filters and pagination

## Deployment
- [x] `scripts/deploy-pi.sh`: one-step, idempotent, 10-point verification
- [x] Node.js 20 + pnpm auto-installed
- [x] Avahi mDNS advertisement (`disposcan.local`)
- [x] Systemd services: `disposcan-backend` + `disposcan-kiosk`
- [x] Kiosk mode: Chromium full-screen, no cursor, no screen blanking
- [x] Auto-login configured via `raspi-config`
- [x] Swap increased to 512MB (SD card longevity)
- [x] Collector run script: `run_collector.cmd` (Windows batch, auto-discovers Pi)

## Extensions
- [x] 5 hardware extension interfaces: Scanner, ThermalPrinter, LabelPrinter, StorageMonitor, UPS
- [x] Registry pattern — core never imports extensions directly
- [x] HID scanner plugin registered at startup (falls back to in-browser hook on non-Linux)

## Documentation
- [x] `docs/ARCHITECTURE.md`: comprehensive maintainer guide
- [x] `scripts/HARDWARE_VALIDATION_PLAN.md`: 12-machine test plan with templates
- [x] Extension types documented with JSDoc
- [x] Collector version module (`_version.ps1`) self-documented

## Remaining Before Ship
- [ ] Set `REPO_URL` in `deploy-pi.sh` to actual GitHub repo
- [ ] Run hardware validation on 12+ machine matrix per plan
- [ ] Remove `CORS_ORIGIN=http://localhost:5173` from backend systemd service (frontend is served by backend in production)
- [ ] Tag `v1.0.0` and push
