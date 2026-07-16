import type { DeviceSearchQuery } from '@dds/shared';
import { get, post, put, del } from './client';

export interface DeviceRow {
  id: string;
  company_sku: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  manufacturer: string;
  model: string;
  device_type: string;
  cpu: string | null;
  ram_gb: number | null;
  storage_gb: number | null;
  storage_type: string | null;
  gpu: string | null;
  battery_health: number | null;
  battery_cycle_count: number | null;
  bios_version: string | null;
  tpm_status: string | null;
  secure_boot: string | null;
  windows_version: string | null;
  os_edition: string | null;
  status: string;
  technician_notes: string | null;
  date_added: string;
  last_scan_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceStats {
  total: number;
  todayCount: number;
  avgHealth: number | null;
  attentionCount: number;
}

export async function listDevices(query: DeviceSearchQuery) {
  return get<DeviceRow[]>('/devices', query as Record<string, unknown>);
}

export async function getDevice(id: string) {
  return get<DeviceRow>(`/devices/${id}`);
}

export async function createDevice(input: Record<string, unknown>) {
  return post<DeviceRow>('/devices', input);
}

export async function updateDevice(id: string, input: Record<string, unknown>) {
  return put<DeviceRow>(`/devices/${id}`, input);
}

export async function deleteDevice(id: string) {
  return del<{ deleted: boolean }>(`/devices/${id}`);
}

export async function getDeviceStats() {
  return get<DeviceStats>('/devices/stats');
}

export async function searchDevices(q: string) {
  return get<{ devices: DeviceRow[] }>('/search', { q });
}
