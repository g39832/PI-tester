import { Router, Request, Response } from 'express';
import { APP_NAME, APP_VERSION } from '@dds/shared';
import { sendSuccess } from '../shared/response.js';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'ok',
    app: APP_NAME,
    version: APP_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
