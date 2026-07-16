import { randomUUID } from 'node:crypto';
import type { CreateDeviceInput, UpdateDeviceInput, DeviceSearchQuery } from '@dds/shared';
import { deviceRepository } from './devices.repository.js';
import type { DeviceRow } from './devices.repository.js';
import { generateCompanySku } from './sku.service.js';
import { NotFoundError } from '../../shared/errors.js';

export const deviceService = {
  async list(query: DeviceSearchQuery) {
    return deviceRepository.search({
      q: query.q,
      status: query.status,
      manufacturer: query.manufacturer,
      deviceType: query.deviceType,
      page: query.page,
      limit: query.limit,
    });
  },

  async getById(id: string): Promise<DeviceRow> {
    const device = deviceRepository.findById(id);
    if (!device) throw new NotFoundError('Device', id);
    return device;
  },

  async create(input: CreateDeviceInput): Promise<DeviceRow> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const companySku = generateCompanySku(input.deviceType);

    return deviceRepository.create({
      id,
      company_sku: companySku,
      serial_number: input.serialNumber ?? null,
      asset_tag: input.assetTag ?? null,
      manufacturer: input.manufacturer,
      model: input.model,
      device_type: input.deviceType,
      cpu: input.cpu ?? null,
      ram_gb: input.ramGb ?? null,
      storage_gb: input.storageGb ?? null,
      storage_type: input.storageType ?? null,
      gpu: input.gpu ?? null,
      battery_health: input.batteryHealth ?? null,
      battery_cycle_count: input.batteryCycleCount ?? null,
      bios_version: input.biosVersion ?? null,
      tpm_status: input.tpmStatus ?? null,
      secure_boot: input.secureBoot ?? null,
      windows_version: input.windowsVersion ?? null,
      os_edition: input.osEdition ?? null,
      status: input.status ?? 'new_intake',
      technician_notes: input.technicianNotes ?? null,
      date_added: now,
      last_scan_date: null,
      created_at: now,
      updated_at: now,
    });
  },

  async update(id: string, input: UpdateDeviceInput): Promise<DeviceRow> {
    const existing = deviceRepository.findById(id);
    if (!existing) throw new NotFoundError('Device', id);

    return deviceRepository.update(id, {
      serial_number: input.serialNumber ?? existing.serial_number,
      asset_tag: input.assetTag ?? existing.asset_tag,
      manufacturer: input.manufacturer ?? existing.manufacturer,
      model: input.model ?? existing.model,
      device_type: input.deviceType ?? existing.device_type,
      cpu: input.cpu ?? existing.cpu,
      ram_gb: input.ramGb ?? existing.ram_gb,
      storage_gb: input.storageGb ?? existing.storage_gb,
      storage_type: input.storageType ?? existing.storage_type,
      gpu: input.gpu ?? existing.gpu,
      battery_health: input.batteryHealth ?? existing.battery_health,
      battery_cycle_count: input.batteryCycleCount ?? existing.battery_cycle_count,
      bios_version: input.biosVersion ?? existing.bios_version,
      tpm_status: input.tpmStatus ?? existing.tpm_status,
      secure_boot: input.secureBoot ?? existing.secure_boot,
      windows_version: input.windowsVersion ?? existing.windows_version,
      os_edition: input.osEdition ?? existing.os_edition,
      status: input.status ?? existing.status,
      technician_notes: input.technicianNotes ?? existing.technician_notes,
    })!;
  },

  async delete(id: string): Promise<void> {
    const existing = deviceRepository.findById(id);
    if (!existing) throw new NotFoundError('Device', id);
    deviceRepository.delete(id);
  },

  async generateSku(deviceId: string): Promise<string> {
    const device = deviceRepository.findById(deviceId);
    if (!device) throw new NotFoundError('Device', deviceId);

    const sku = generateCompanySku(device.device_type);
    deviceRepository.update(deviceId, { company_sku: sku });
    return sku;
  },

  async getStats() {
    return deviceRepository.getStats();
  },
};
