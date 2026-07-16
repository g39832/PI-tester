import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

export type DeviceType = 'desktop' | 'laptop' | 'tablet' | 'server' | 'other';
export type DeviceStatus = 'new_intake' | 'diagnosed' | 'repairing' | 'waiting_parts' | 'ready_pickup' | 'completed' | 'sold' | 'archived';
export type TpmStatus = 'present' | 'absent' | 'unknown';
export type SecureBootStatus = 'enabled' | 'disabled' | 'unsupported' | 'unknown';

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  companySku: text('company_sku').unique(),
  serialNumber: text('serial_number'),
  assetTag: text('asset_tag'),
  manufacturer: text('manufacturer').notNull(),
  model: text('model').notNull(),
  deviceType: text('device_type', {
    enum: ['desktop', 'laptop', 'tablet', 'server', 'other'],
  }).notNull(),
  cpu: text('cpu'),
  ramGb: real('ram_gb'),
  storageGb: real('storage_gb'),
  storageType: text('storage_type'),
  gpu: text('gpu'),
  batteryHealth: real('battery_health'),
  batteryCycleCount: integer('battery_cycle_count'),
  biosVersion: text('bios_version'),
  tpmStatus: text('tpm_status', { enum: ['present', 'absent', 'unknown'] }),
  secureBoot: text('secure_boot', { enum: ['enabled', 'disabled', 'unsupported', 'unknown'] }),
  windowsVersion: text('windows_version'),
  osEdition: text('os_edition'),
  status: text('status', {
    enum: ['new_intake', 'diagnosed', 'repairing', 'waiting_parts', 'ready_pickup', 'completed', 'sold', 'archived'],
  }).notNull().default('new_intake'),
  technicianNotes: text('technician_notes'),
  dateAdded: text('date_added').notNull(),
  lastScanDate: text('last_scan_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  serialIdx: index('idx_devices_serial').on(table.serialNumber),
  manufacturerIdx: index('idx_devices_manufacturer').on(table.manufacturer),
  modelIdx: index('idx_devices_model').on(table.model),
  statusIdx: index('idx_devices_status').on(table.status),
  lastScanIdx: index('idx_devices_last_scan').on(table.lastScanDate),
}));
