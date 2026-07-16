import { Router } from 'express';
import { logService, type LogLevel, type LogCategory } from './log.service.js';
import { sendSuccess, sendError } from '../../shared/response.js';

export const logRouter = Router();

logRouter.get('/', (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const level = req.query.level as LogLevel | undefined;
    const category = req.query.category as LogCategory | undefined;
    const search = req.query.search as string | undefined;

    const result = logService.list(limit, offset, {
      ...(level && { level }),
      ...(category && { category }),
      ...(search && { search }),
    });
    sendSuccess(res, result.entries, { page: Math.floor(offset / limit) + 1, limit, total: result.total, totalPages: Math.ceil(result.total / limit) });
  } catch (err) { next(err); }
});

logRouter.get('/categories', (_req, res, next) => {
  try {
    const categories: LogCategory[] = [
      'device_scan', 'status_change', 'collector_connect', 'collector_disconnect',
      'error', 'warning', 'backup', 'restore', 'settings_change', 'system',
    ];
    const levels: LogLevel[] = ['info', 'warn', 'error', 'debug'];
    sendSuccess(res, { categories, levels });
  } catch (err) { next(err); }
});

logRouter.delete('/clear', (_req, res, next) => {
  try {
    logService.clear();
    sendSuccess(res, { message: 'Log cleared' });
  } catch (err) { next(err); }
});

logRouter.post('/add', (req, res, next) => {
  try {
    const { level, category, message, details } = req.body;
    if (!level || !category || !message) {
      sendError(res, { code: 'INVALID_INPUT', message: 'level, category, and message are required' }, 400);
      return;
    }
    logService.add(level, category, message, details);
    sendSuccess(res, { message: 'Log entry added' }, undefined, 201);
  } catch (err) { next(err); }
});
