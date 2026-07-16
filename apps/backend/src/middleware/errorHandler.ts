import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors.js';
import { sendError } from '../shared/response.js';
import { logger } from './requestLogger.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn('Application error', {
      code: err.code,
      message: err.message,
      path: req.path,
      method: req.method,
    });
    sendError(res, { code: err.code, message: err.message, details: err.details }, err.statusCode);
    return;
  }

  if ((err as any).name === 'ZodError' || (err as any).issues) {
    logger.warn('Validation error', {
      message: err.message,
      path: req.path,
      method: req.method,
    });
    sendError(res, { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: (err as any).issues ?? err.message }, 400);
    return;
  }

  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  sendError(res, { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, 500);
}
