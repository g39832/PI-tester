import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { getSessionCode, validateSessionCode } from './sessionCode.js';
import { collectorSessionRepository } from '../modules/diagnostics/collectorSession.repository.js';
import { diagnosticSessionService } from '../modules/diagnostics/diagnosticSession.service.js';
import { calculateHealthScore, getOverallStatus } from '../modules/health/healthScore.service.js';
import { generateRecommendations } from '../modules/health/recommendations.service.js';
import {
  isVersionCompatible,
  validateMessage,
  checkDuplicateSubmission,
  findResumableCollectorSession,
  findIncompleteDiagnosticSession,
  getCompletedTestIds,
} from '../modules/collector/collector.service.js';

const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_TIMEOUT_MS = 45000;
const MIN_COLLECTOR_VERSION = '3.0.0';

interface JsonMessage {
  type: string;
  [key: string]: unknown;
}

interface TestResultRecord {
  id: string;
  testId: string;
  label: string;
  status: 'completed' | 'warning' | 'error' | 'skipped' | 'running';
  health: 'good' | 'warning' | 'critical' | 'unknown';
  data: Record<string, unknown>;
  warnings: string[];
  duration: number | null;
}

interface CollectorState {
  sessionId: string;
  collectorSessionId: string;
  deviceId: string | null;
  resumed: boolean;
  meta: {
    deviceName: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    windowsVersion: string;
    scanMode: 'quick' | 'deep';
  };
  testResults: TestResultRecord[];
  healthScoreReceived: boolean;
  lastPong: number;
}

const activeConnections = new Map<WebSocket, CollectorState>();

function sendJson(ws: WebSocket, msg: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function handleHello(ws: WebSocket, data: JsonMessage): boolean {
  const errors = validateMessage(data, {
    sessionCode: 'string',
  });
  if (errors.length > 0) {
    sendJson(ws, { type: 'error', code: 'VALIDATION_ERROR', message: errors.join('; ') });
    ws.close(4001, 'Validation failed');
    return false;
  }

  const { sessionCode, collectorVersion, protocol, features, resumeSessionId } = data as JsonMessage & {
    sessionCode: string;
    collectorVersion?: string;
    protocol?: string;
    features?: string[];
    resumeSessionId?: string | null;
  };

  if (!validateSessionCode(sessionCode)) {
    sendJson(ws, { type: 'error', code: 'INVALID_CODE', message: 'Invalid or expired session code' });
    ws.close(4001, 'Invalid session code');
    return false;
  }

  const versionInfo: Record<string, unknown> = {};
  if (collectorVersion) {
    const check = isVersionCompatible(collectorVersion, MIN_COLLECTOR_VERSION);
    if (!check.ok) {
      sendJson(ws, { type: 'error', code: 'VERSION_MISMATCH', message: check.reason });
      ws.close(4002, 'Version incompatible');
      return false;
    }
    if (parseVersion(collectorVersion) < parseVersion(MIN_COLLECTOR_VERSION)) {
      versionInfo.versionWarning = `Collector v${collectorVersion} is older than recommended v${MIN_COLLECTOR_VERSION}. Some features may not be available.`;
    }
  }

  if (protocol && protocol !== 'disposcan-v1') {
    sendJson(ws, { type: 'error', code: 'PROTOCOL_MISMATCH', message: `Unsupported protocol: ${protocol}. Expected disposcan-v1.` });
    ws.close(4003, 'Protocol mismatch');
    return false;
  }

  let resumed = false;
  let collectorSessionId: string;

  if (resumeSessionId) {
    const existingDiagSessionId = findIncompleteDiagnosticSession(resumeSessionId);
    if (existingDiagSessionId) {
      resumed = true;
      collectorSessionId = resumeSessionId;
      collectorSessionRepository.update(collectorSessionId, {
        status: 'pairing',
        startedAt: new Date().toISOString(),
      });
    } else {
      const resumableId = findResumableCollectorSession(sessionCode);
      if (resumableId) {
        resumed = true;
        collectorSessionId = resumableId;
        collectorSessionRepository.update(collectorSessionId, {
          status: 'pairing',
          startedAt: new Date().toISOString(),
        });
      } else {
        collectorSessionId = collectorSessionRepository.create(sessionCode).id;
      }
    }
  } else {
    const resumableId = findResumableCollectorSession(sessionCode);
    if (resumableId) {
      resumed = true;
      collectorSessionId = resumableId;
      collectorSessionRepository.update(collectorSessionId, {
        status: 'pairing',
        startedAt: new Date().toISOString(),
      });
    } else {
      collectorSessionId = collectorSessionRepository.create(sessionCode).id;
    }
  }

  const state: CollectorState = {
    sessionId: '',
    collectorSessionId,
    deviceId: null,
    resumed,
    meta: { deviceName: '', manufacturer: '', model: '', serialNumber: '', windowsVersion: '', scanMode: 'quick' },
    testResults: [],
    healthScoreReceived: false,
    lastPong: Date.now(),
  };
  activeConnections.set(ws, state);

  const acceptedTests = [
    'cpu', 'memory', 'storage', 'gpu', 'battery', 'motherboard', 'network',
    'windows', 'updates', 'drivers', 'eventviewer',
    'sfc', 'dism', 'fscheck', 'eventviewer_deep',
  ];

  const response: Record<string, unknown> = {
    type: 'hello_ack',
    sessionId: collectorSessionId,
    acceptedTests,
    serverVersion: '3.0.0',
  };

  if (versionInfo.versionWarning) {
    response.versionWarning = versionInfo.versionWarning;
  }

  if (resumed) {
    response.resumeAccepted = true;
    const existingDiagSessionId = findIncompleteDiagnosticSession(collectorSessionId);
    if (existingDiagSessionId) {
      response.restoredTestIds = getCompletedTestIds(existingDiagSessionId);
    }
  }

  sendJson(ws, response);
  return true;
}

function handleSessionMeta(ws: WebSocket, data: JsonMessage): void {
  const state = activeConnections.get(ws);
  if (!state) return;

  const meta = data as JsonMessage & {
    deviceName?: string;
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    windowsVersion?: string;
    scanMode?: string;
  };

  state.meta = {
    deviceName: meta.deviceName ?? '',
    manufacturer: meta.manufacturer ?? '',
    model: meta.model ?? '',
    serialNumber: meta.serialNumber ?? '',
    windowsVersion: meta.windowsVersion ?? '',
    scanMode: (meta.scanMode as 'quick' | 'deep') ?? 'quick',
  };

  collectorSessionRepository.update(state.collectorSessionId, { status: 'collecting' });
}

function parseVersion(v: string): number[] {
  return v.split('.').map((p) => parseInt(p, 10) || 0);
}

function handleTestResult(ws: WebSocket, data: JsonMessage): void {
  const state = activeConnections.get(ws);
  if (!state) return;

  const errors = validateMessage(data, {
    testId: 'string',
    status: 'string',
    health: 'string',
  });
  if (errors.length > 0) {
    sendJson(ws, { type: 'error', code: 'VALIDATION_ERROR', message: errors.join('; ') });
    return;
  }

  const msg = data as JsonMessage & {
    testId: string;
    status?: string;
    health?: string;
    data?: Record<string, unknown>;
    warnings?: unknown[];
    duration?: number;
    label?: string;
    restored?: boolean;
  };

  if (!state.sessionId) {
    state.sessionId = diagnosticSessionService.create(
      state.deviceId,
      getSessionCode().code,
      {
        deviceName: state.meta.deviceName,
        manufacturer: state.meta.manufacturer,
        model: state.meta.model,
        serialNumber: state.meta.serialNumber,
        windowsVersion: state.meta.windowsVersion,
      },
      state.meta.scanMode,
    ).id;

    collectorSessionRepository.update(state.collectorSessionId, {
      diagnosticSessionId: state.sessionId,
    });
  }

  if (checkDuplicateSubmission(state.sessionId, msg.testId ?? '')) {
    sendJson(ws, { type: 'ack', testId: msg.testId, duplicate: true });
    return;
  }

  const record: TestResultRecord = {
    id: msg.testId ?? '',
    testId: msg.testId ?? '',
    label: msg.label ?? msg.testId ?? '',
    status: (msg.status as TestResultRecord['status']) ?? 'completed',
    health: (msg.health as TestResultRecord['health']) ?? 'unknown',
    data: (msg.data as Record<string, unknown>) ?? {},
    warnings: (msg.warnings as string[]) ?? [],
    duration: (msg.duration as number) ?? null,
  };

  const idx = state.testResults.findIndex((r) => r.testId === record.testId);
  if (idx >= 0) {
    state.testResults[idx] = record;
  } else {
    state.testResults.push(record);
  }

  diagnosticSessionService.addTestResult(
    state.sessionId,
    record.testId,
    record.label,
    record.status,
    record.health,
    record.data,
    record.warnings,
    record.duration,
  );

  sendJson(ws, { type: 'ack', testId: record.testId });
}

function handleHealthScore(ws: WebSocket, data: JsonMessage): void {
  const state = activeConnections.get(ws);
  if (!state) return;

  const msg = data as JsonMessage & {
    categoryScores?: Record<string, number | null>;
    overall?: number | null;
  };

  state.healthScoreReceived = true;

  if (state.sessionId && msg.categoryScores) {
    diagnosticSessionService.update(state.sessionId, {
      categoryScores: JSON.stringify(msg.categoryScores),
      healthScore: msg.overall ?? null,
      overallStatus: getOverallStatus(msg.overall ?? null),
    } as any);
  }

  sendJson(ws, { type: 'ack_hs' });
}

function handleComplete(ws: WebSocket): void {
  const state = activeConnections.get(ws);
  if (!state) return;

  if (state.sessionId) {
    const { overall, categories } = calculateHealthScore(
      diagnosticSessionService.buildHealthScoreInput(state.testResults)
    );
    const recommendations = generateRecommendations(categories, state.testResults);

    if (!state.healthScoreReceived) {
      diagnosticSessionService.update(state.sessionId, {
        healthScore: overall,
        categoryScores: JSON.stringify(categories),
        overallStatus: getOverallStatus(overall),
        recommendations: JSON.stringify(recommendations),
      } as any);
    } else {
      diagnosticSessionService.update(state.sessionId, {
        recommendations: JSON.stringify(recommendations),
      } as any);
    }

    diagnosticSessionService.completeSession(state.sessionId);

    collectorSessionRepository.update(state.collectorSessionId, {
      status: 'complete',
      completedAt: new Date().toISOString(),
    });
  } else {
    collectorSessionRepository.update(state.collectorSessionId, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    });
  }

  sendJson(ws, { type: 'complete_ack' });
  ws.close(1000, 'Session complete');
}

function handleCancel(ws: WebSocket, data: JsonMessage): void {
  const msg = data as JsonMessage & { reason?: string };
  const state = activeConnections.get(ws);
  if (state) {
    collectorSessionRepository.update(state.collectorSessionId, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    });
  }
  sendJson(ws, { type: 'ack' });
  ws.close(1000, msg.reason ?? 'Cancelled');
}

function handleError(ws: WebSocket, data: JsonMessage): void {
  const state = activeConnections.get(ws);
  if (!state) return;

  const msg = data as JsonMessage & { testId?: string; message?: string };
  if (msg.testId && typeof msg.testId === 'string') {
    if (checkDuplicateSubmission(state.sessionId, msg.testId)) return;

    const record: TestResultRecord = {
      id: msg.testId,
      testId: msg.testId,
      label: msg.testId,
      status: 'error',
      health: 'unknown',
      data: { error: msg.message ?? 'Unknown error' },
      warnings: [String(msg.message ?? 'Unknown error')],
      duration: null,
    };

    const idx = state.testResults.findIndex((r) => r.testId === record.testId);
    if (idx >= 0) state.testResults[idx] = record;
    else state.testResults.push(record);

    diagnosticSessionService.addTestResult(
      state.sessionId,
      record.testId,
      record.label,
      record.status,
      record.health,
      record.data,
      record.warnings,
      record.duration,
    );
    sendJson(ws, { type: 'ack', testId: msg.testId });
  }
}

function handleMessage(ws: WebSocket, raw: string): void {
  let data: JsonMessage;
  try {
    data = JSON.parse(raw) as JsonMessage;
  } catch {
    sendJson(ws, { type: 'error', code: 'INVALID_JSON', message: 'Invalid JSON payload' });
    return;
  }

  if (!data.type || typeof data.type !== 'string') {
    sendJson(ws, { type: 'error', code: 'MISSING_TYPE', message: 'Message must have a type field' });
    return;
  }

  switch (data.type) {
    case 'hello':
      handleHello(ws, data);
      break;
    case 'session_meta':
      handleSessionMeta(ws, data);
      break;
    case 'test_result':
      handleTestResult(ws, data);
      break;
    case 'health_score':
      handleHealthScore(ws, data);
      break;
    case 'complete':
      handleComplete(ws);
      break;
    case 'cancel':
      handleCancel(ws, data);
      break;
    case 'error':
      handleError(ws, data);
      break;
    default:
      sendJson(ws, { type: 'error', code: 'UNKNOWN_TYPE', message: `Unknown message type: ${data.type}` });
  }
}

function handleDisconnect(ws: WebSocket): void {
  const state = activeConnections.get(ws);
  if (state) {
    const hasPartialResults = state.testResults.length > 0 && !state.healthScoreReceived;
    if (hasPartialResults) {
      collectorSessionRepository.update(state.collectorSessionId, {
        status: 'collecting',
      });
    } else {
      collectorSessionRepository.update(state.collectorSessionId, {
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      });
    }
    activeConnections.delete(ws);
  }
}

export function createWsServer(port: number): WebSocketServer {
  const httpServer = createServer();
  const wss = new WebSocketServer({ server: httpServer, path: '/collect' });
  httpServer.listen(port, () => {
    console.log(`WebSocket collector server listening on port ${port}`);
  });

  wss.on('connection', (ws) => {
    let alive = true;

    ws.on('message', (raw) => {
      handleMessage(ws, raw.toString());
      const state = activeConnections.get(ws);
      if (state) state.lastPong = Date.now();
    });

    ws.on('close', () => {
      alive = false;
      handleDisconnect(ws);
    });

    ws.on('error', () => {
      alive = false;
      handleDisconnect(ws);
    });

    ws.on('pong', () => {
      const state = activeConnections.get(ws);
      if (state) state.lastPong = Date.now();
    });
  });

  const pingInterval = setInterval(() => {
    const now = Date.now();
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const state = activeConnections.get(ws);
        if (state && now - state.lastPong > HEARTBEAT_TIMEOUT_MS) {
          ws.terminate();
          handleDisconnect(ws);
          return;
        }
        ws.ping();
      }
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(pingInterval));

  process.on('SIGTERM', () => {
    clearInterval(pingInterval);
    wss.clients.forEach((ws) => {
      ws.close(1001, 'Server shutting down');
    });
    wss.close();
  });

  process.on('SIGINT', () => {
    clearInterval(pingInterval);
    wss.clients.forEach((ws) => {
      ws.close(1001, 'Server shutting down');
    });
    wss.close();
  });

  return wss;
}
