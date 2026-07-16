import { Router } from 'express';
import { sendSuccess } from '../../shared/response.js';
import { getSqlite } from '@dds/database';
import { diagnosticSessionService } from './diagnosticSession.service.js';

export const sessionRouter = Router();

sessionRouter.get('/:id', (req, res, next) => {
  try {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM diagnostic_sessions WHERE id = ?');
    stmt.bind([req.params.id]);
    let session: Record<string, unknown> | null = null;
    if (stmt.step()) {
      session = stmt.getAsObject() as Record<string, unknown>;
    }
    stmt.free();

    if (!session) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
      return;
    }

    const testStmt = db.prepare('SELECT * FROM test_results WHERE session_id = ? ORDER BY created_at');
    testStmt.bind([req.params.id]);
    const tests: Record<string, unknown>[] = [];
    while (testStmt.step()) {
      tests.push(testStmt.getAsObject() as Record<string, unknown>);
    }
    testStmt.free();

    let device: Record<string, unknown> | null = null;
    if (session?.device_id) {
      const deviceStmt = db.prepare('SELECT * FROM devices WHERE id = ?');
      deviceStmt.bind([session.device_id as string]);
      if (deviceStmt.step()) {
        device = deviceStmt.getAsObject() as Record<string, unknown>;
      }
      deviceStmt.free();
    }

    sendSuccess(res, { ...session, tests, device });
  } catch (err) {
    next(err);
  }
});

sessionRouter.get('/', (_req, res, next) => {
  try {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM diagnostic_sessions ORDER BY created_at DESC LIMIT 50');
    const sessions: Record<string, unknown>[] = [];
    while (stmt.step()) {
      sessions.push(stmt.getAsObject() as Record<string, unknown>);
    }
    stmt.free();

    // Attach test results to each session
    const result = sessions.map((s) => {
      const testStmt = db.prepare('SELECT * FROM test_results WHERE session_id = ? ORDER BY created_at');
      testStmt.bind([s.id as string]);
      const tests: Record<string, unknown>[] = [];
      while (testStmt.step()) {
        tests.push(testStmt.getAsObject() as Record<string, unknown>);
      }
      testStmt.free();
      return { ...s, tests };
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// Compare two sessions
sessionRouter.get('/compare/:id1/:id2', (req, res, next) => {
  try {
    const { id1, id2 } = req.params;
    const comparison = diagnosticSessionService.compareSessions([id1, id2]);
    sendSuccess(res, comparison);
  } catch (err) {
    next(err);
  }
});

// Get sessions for a device
sessionRouter.get('/device/:deviceId', (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const sessions = diagnosticSessionService.findByDeviceId(deviceId, 10);

    const result = sessions.map((s) => {
      const tests = diagnosticSessionService.getTestResults(s.id);
      return { ...s, tests };
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});
