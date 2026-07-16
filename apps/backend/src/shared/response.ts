import { Response } from 'express';
import type { ApiResponse, ApiError, PaginationMeta } from '@dds/shared';

export function sendSuccess<T>(res: Response, data: T, meta?: PaginationMeta, statusCode: number = 200): void {
  const body: ApiResponse<T> = { success: true, data };
  if (meta) {
    body.meta = meta;
  }
  res.status(statusCode).json(body);
}

export function sendError(res: Response, error: ApiError['error'], statusCode: number = 500): void {
  const body: ApiError = { success: false, error };
  res.status(statusCode).json(body);
}
