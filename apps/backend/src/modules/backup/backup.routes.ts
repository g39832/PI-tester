import { Router } from 'express';
import { backupService, startScheduledBackups, stopScheduledBackups } from './backup.service.js';
import { sendSuccess, sendError } from '../../shared/response.js';

export const backupRouter = Router();

backupRouter.post('/create', async (req, res, next) => {
  try {
    const type = req.body?.type === 'auto' ? 'auto' : 'manual';
    const meta = await backupService.createBackup(type);
    sendSuccess(res, meta, undefined, 201);
  } catch (err) { next(err); }
});

backupRouter.get('/list', (_req, res, next) => {
  try {
    const backups = backupService.listBackups();
    sendSuccess(res, backups);
  } catch (err) { next(err); }
});

backupRouter.post('/restore/:backupId', async (req, res, next) => {
  try {
    await backupService.restoreFromBackup(req.params.backupId);
    sendSuccess(res, { message: 'Restore complete. The application will reload.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Restore failed';
    sendError(res, { code: 'RESTORE_FAILED', message: msg }, 500);
  }
});

backupRouter.delete('/:backupId', (req, res, next) => {
  try {
    const deleted = backupService.deleteBackup(req.params.backupId);
    if (!deleted) {
      sendError(res, { code: 'NOT_FOUND', message: 'Backup not found' }, 404);
      return;
    }
    sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
});

backupRouter.get('/export', async (req, res, next) => {
  try {
    const buf = await backupService.exportDatabase();
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="disposcan-export-${Date.now()}.db"`);
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
});

backupRouter.post('/schedule', (req, res, next) => {
  try {
    const hours = req.body?.intervalHours ?? 24;
    startScheduledBackups(hours);
    sendSuccess(res, { message: `Scheduled backups every ${hours} hours` });
  } catch (err) { next(err); }
});

backupRouter.post('/schedule/stop', (_req, res, next) => {
  try {
    stopScheduledBackups();
    sendSuccess(res, { message: 'Scheduled backups stopped' });
  } catch (err) { next(err); }
});
