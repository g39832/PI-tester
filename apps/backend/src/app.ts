import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { healthRouter } from './routes/health.routes.js';
import { deviceRouter } from './modules/devices/devices.routes.js';
import { searchRouter } from './modules/search/search.routes.js';
import { collectorRouter } from './modules/diagnostics/collector.routes.js';
import { sessionRouter } from './modules/diagnostics/session.routes.js';
import { attachmentRouter } from './modules/attachments/attachments.routes.js';
import { reportRouter } from './modules/reports/reports.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { backupRouter } from './modules/backup/backup.routes.js';
import { logRouter } from './modules/logging/log.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);
app.use(generalLimiter);

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/devices', deviceRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/v1/collector', collectorRouter);
app.use('/api/v1/sessions', sessionRouter);
app.use('/api/v1/attachments', attachmentRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/backup', backupRouter);
app.use('/api/v1/logs', logRouter);

app.use(express.static(FRONTEND_DIST));
app.get('*', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

app.use(errorHandler);

export { app };
