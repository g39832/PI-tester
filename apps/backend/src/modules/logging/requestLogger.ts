import type { Request, Response, NextFunction } from 'express';
import { logService } from './log.service.js';

const SCAN_PATTERNS = ['/api/v1/sessions', '/api/v1/devices'];
const COLLECTOR_PATTERNS = ['/api/v1/collector'];

export function autoLogger(req: Request, res: Response, next: NextFunction): void {
  const originalEnd = res.end.bind(res);

  res.end = function (...args: any[]): any {
    const status = res.statusCode;
    const method = req.method;
    const path = req.path;

    if (status >= 500) {
      logService.add('error', 'error', `${method} ${path} returned ${status}`, {
        query: req.query,
        body: req.body && typeof req.body === 'object' ? Object.keys(req.body as object) : undefined,
      });
    } else if (status >= 400) {
      logService.add('warn', 'warning', `${method} ${path} returned ${status}`);
    }

    if (method === 'POST' && SCAN_PATTERNS.some((p) => path.startsWith(p))) {
      logService.add('info', 'device_scan', `Device scan created via ${method} ${path}`);
    }

    if (COLLECTOR_PATTERNS.some((p) => path.startsWith(p))) {
      if (method === 'GET' && path.includes('/current')) {
        const action = status < 300 ? 'connected' : 'failed';
        logService.add('info', 'collector_connect', `Collector ${action}`, { path, status });
      }
    }

    return originalEnd(...args);
  };

  next();
}
