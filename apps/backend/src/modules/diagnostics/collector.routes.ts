import { Router } from 'express';
import { getSqlite } from '@dds/database';
import { getSessionCode } from '../../ws/sessionCode.js';
import { sendSuccess, sendError } from '../../shared/response.js';
import crypto from 'crypto';

function uid(): string {
  return crypto.randomUUID();
}

export const collectorRouter = Router();

collectorRouter.post('/network-boot', (req, res, next) => {
  try {
    const { lshwJson, dmidecode, smartctl } = req.body;
    if (!lshwJson) {
      sendError(res, { code: 'MISSING_DATA', message: 'Missing lshwJson' }, 400);
      return;
    }

    const hw = typeof lshwJson === 'string' ? JSON.parse(lshwJson) : lshwJson;
    const dmi = typeof dmidecode === 'string' ? dmidecode : '';

    const manufacturer = hw?.product?.vendor || hw?.system?.manufacturer || '';
    const model = hw?.product?.product || hw?.system?.product || '';
    const serial = hw?.product?.serial || hw?.system?.serial || '';
    const cpu = hw?.cpu?.[0]?.product || '';
    const ramMb = hw?.memory?.description === 'System Memory' ? Math.round((hw.memory.size || 0) / 1024 / 1024) : 0;
    const storageGb = hw?.disk?.size ? Math.round(hw.disk.size / 1024 / 1024 / 1024) : 0;
    const gpu = hw?.display?.[0]?.product || hw?.display?.product || '';

    const db = getSqlite();
    const now = new Date().toISOString();
    const deviceId = uid();

    const devStmt = db.prepare(`
      INSERT INTO devices (id, manufacturer, model, serial_number, cpu, ram_gb, storage_gb, storage_type, gpu, status, date_added, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new_intake', ?, ?, ?)
    `);
    devStmt.bind([
      deviceId, manufacturer, model, serial || null,
      cpu, ramMb || null, storageGb || null, null, gpu || null,
      now, now, now,
    ]);
    devStmt.step();
    devStmt.free();

    const sessionId = uid();
    const sessStmt = db.prepare(`
      INSERT INTO diagnostic_sessions (id, device_id, session_code, payload, scan_mode, overall_status, started_at, created_at)
      VALUES (?, ?, ?, ?, 'deep', 'unknown', ?, ?)
    `);
    sessStmt.bind([
      sessionId, deviceId, 'pxe-boot', JSON.stringify(req.body), now, now,
    ]);
    sessStmt.step();
    sessStmt.free();

    sendSuccess(res, { deviceId, sessionId, manufacturer, model, serial });
  } catch (err) {
    next(err);
  }
});

collectorRouter.get('/current', (_req, res, next) => {
  try {
    const code = getSessionCode();

    const db = getSqlite();
    const stmt = db.prepare(
      "SELECT * FROM collector_sessions WHERE code = ? AND status NOT IN ('complete', 'cancelled') ORDER BY created_at DESC LIMIT 1",
    );
    stmt.bind([code.code]);

    let session: Record<string, unknown> | null = null;
    if (stmt.step()) {
      session = stmt.getAsObject() as Record<string, unknown>;
    }
    stmt.free();

    sendSuccess(res, {
      code: code.code,
      expiresAt: code.expiresAt,
      activeSession: session,
    });
  } catch (err) {
    next(err);
  }
});

collectorRouter.get('/history', (_req, res, next) => {
  try {
    const db = getSqlite();
    const stmt = db.prepare(
      "SELECT * FROM collector_sessions WHERE status IN ('complete', 'cancelled') ORDER BY created_at DESC LIMIT 20",
    );
    const sessions: Record<string, unknown>[] = [];
    while (stmt.step()) {
      sessions.push(stmt.getAsObject() as Record<string, unknown>);
    }
    stmt.free();
    sendSuccess(res, sessions);
  } catch (err) {
    next(err);
  }
});
