import { Router } from 'express';
import { settingsService } from './settings.service.js';
import { sendSuccess, sendError } from '../../shared/response.js';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res, next) => {
  try {
    const all = settingsService.getAll();
    const map: Record<string, { value: string; type: string; description: string | null; updatedAt: string }> = {};
    for (const s of all) {
      map[s.key] = { value: s.value, type: s.type, description: s.description, updatedAt: s.updatedAt };
    }
    sendSuccess(res, map);
  } catch (err) { next(err); }
});

settingsRouter.put('/', (req, res, next) => {
  try {
    const entries = req.body;
    if (!entries || typeof entries !== 'object') {
      sendError(res, { code: 'INVALID_INPUT', message: 'Request body must be an object of key-value pairs' }, 400);
      return;
    }
    const upserts: Array<{ key: string; value: string; type: string }> = [];
    for (const [key, val] of Object.entries(entries)) {
      const entry = val as { value?: string; type?: string } | string;
      if (typeof entry === 'string') {
        upserts.push({ key, value: entry, type: 'string' });
      } else if (typeof entry === 'object' && entry !== null) {
        upserts.push({ key, value: String(entry.value ?? ''), type: entry.type ?? 'string' });
      }
    }
    settingsService.setMultiple(upserts);
    sendSuccess(res, { updated: upserts.length });
  } catch (err) { next(err); }
});

settingsRouter.get('/:key', (req, res, next) => {
  try {
    const val = settingsService.get(req.params.key);
    if (val === undefined) {
      sendError(res, { code: 'NOT_FOUND', message: `Setting '${req.params.key}' not found` }, 404);
      return;
    }
    sendSuccess(res, { key: req.params.key, value: val });
  } catch (err) { next(err); }
});

settingsRouter.put('/:key', (req, res, next) => {
  try {
    const { value, type } = req.body;
    if (value === undefined) {
      sendError(res, { code: 'INVALID_INPUT', message: 'Body must include a value field' }, 400);
      return;
    }
    settingsService.set(req.params.key, String(value), type ?? 'string');
    sendSuccess(res, { key: req.params.key, value: String(value) });
  } catch (err) { next(err); }
});

settingsRouter.post('/:key/reset', (req, res, next) => {
  try {
    settingsService.reset(req.params.key);
    sendSuccess(res, { key: req.params.key, message: 'Reset to default' });
  } catch (err) { next(err); }
});
