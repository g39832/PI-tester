import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './middleware/requestLogger.js';
import { getDatabase, closeDatabase, migrate } from '@dds/database';
import { createWsServer } from './ws/wsServer.js';
import { extensionRegistry } from './extensions/extensionRegistry.js';
import { hidScannerPlugin } from './extensions/scanner/hidScanner.js';

async function main(): Promise<void> {
  await getDatabase({ path: env.DATABASE_PATH });
  migrate();

  // Register hardware extensions
  extensionRegistry.registerScanner(hidScannerPlugin);
  logger.info(`Extensions registered: ${extensionRegistry.listRegistered().join(', ') || 'none'}`);

  const server = app.listen(env.PORT, () => {
    logger.info(`DispoScan API started on port ${env.PORT}`);
  });

  const wsPort = 3002;
  const wss = createWsServer(wsPort);
  logger.info(`WebSocket collector server started on port ${wsPort}`);

  function shutdown(): void {
    logger.info('Shutting down...');
    wss.close();
    closeDatabase();
    server.close(() => process.exit(0));
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { message: err.message, stack: err.stack });
    shutdown();
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    shutdown();
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
