import { Request, Response, NextFunction } from 'express';
import { deviceRepository } from '../devices/devices.repository.js';
import { sendSuccess } from '../../shared/response.js';

export const searchController = {
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = (req.query.q as string) ?? '';
      if (!q.trim()) {
        sendSuccess(res, { devices: [], sessions: [] });
        return;
      }

      const result = deviceRepository.search({ q: q.trim(), page: 1, limit: 50 });
      sendSuccess(res, { devices: result.devices });
    } catch (err) {
      next(err);
    }
  },
};
