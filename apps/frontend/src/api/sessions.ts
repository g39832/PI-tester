import { get } from './client';

export interface CollectorStatus {
  code: string;
  expiresAt: number;
  activeSession: {
    id: string;
    code: string;
    status: string;
    deviceId: string | null;
    diagnosticSessionId: string | null;
    ipAddress: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
  } | null;
}

export interface DiagnosticSessionDetail {
  id: string;
  deviceId: string | null;
  sessionCode: string;
  payload: string;
  healthScore: number | null;
  categoryScores: string | null;
  overallStatus: string | null;
  scanMode: string | null;
  recommendations: string | null;
  collectorVersion: string | null;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  summary: string | null;
  createdAt: string;
  tests: Array<{
    id: string;
    sessionId: string;
    testId: string;
    label: string;
    status: string;
    health: string;
    data: string;
    warnings: string | null;
    duration: number | null;
  }>;
  device: Record<string, unknown> | null;
}

export async function getCollectorStatus() {
  return get<CollectorStatus>('/collector/current');
}

export async function getSessionDetail(id: string) {
  return get<DiagnosticSessionDetail>(`/sessions/${id}`);
}

export async function getSessionList() {
  return get<DiagnosticSessionDetail[]>('/sessions');
}

export async function getCollectorHistory() {
  return get<Record<string, unknown>[]>('/collector/history');
}
