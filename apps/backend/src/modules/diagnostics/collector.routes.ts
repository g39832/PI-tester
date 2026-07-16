import { Router } from 'express';
import { getSqlite } from '@dds/database';
import { getSessionCode } from '../../ws/sessionCode.js';
import { sendSuccess } from '../../shared/response.js';

export const collectorRouter = Router();

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
