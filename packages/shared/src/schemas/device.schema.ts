import { z } from 'zod';

export const DeviceTypeEnum = z.enum(['desktop', 'laptop', 'tablet', 'server', 'other']);
export const DeviceStatusEnum = z.enum([
  'new_intake', 'diagnosed', 'repairing', 'waiting_parts',
  'ready_pickup', 'completed', 'sold', 'archived',
]);
export const TpmStatusEnum = z.enum(['present', 'absent', 'unknown']);
export const SecureBootEnum = z.enum(['enabled', 'disabled', 'unsupported', 'unknown']);

export const CreateDeviceSchema = z.object({
  serialNumber: z.string().max(255).optional().nullable(),
  assetTag: z.string().max(255).optional().nullable(),
  manufacturer: z.string().min(1).max(255),
  model: z.string().min(1).max(255),
  deviceType: DeviceTypeEnum,
  cpu: z.string().max(500).optional().nullable(),
  ramGb: z.number().positive().optional().nullable(),
  storageGb: z.number().positive().optional().nullable(),
  storageType: z.string().max(50).optional().nullable(),
  gpu: z.string().max(500).optional().nullable(),
  batteryHealth: z.number().min(0).max(100).optional().nullable(),
  batteryCycleCount: z.number().int().min(0).optional().nullable(),
  biosVersion: z.string().max(255).optional().nullable(),
  tpmStatus: TpmStatusEnum.optional().nullable(),
  secureBoot: SecureBootEnum.optional().nullable(),
  windowsVersion: z.string().max(255).optional().nullable(),
  osEdition: z.string().max(255).optional().nullable(),
  status: DeviceStatusEnum.optional().default('new_intake'),
  technicianNotes: z.string().optional().nullable(),
});

export const UpdateDeviceSchema = CreateDeviceSchema.partial();

export type CreateDeviceInput = z.infer<typeof CreateDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof UpdateDeviceSchema>;

export const DeviceSearchSchema = z.object({
  q: z.string().max(500).optional().default(''),
  status: DeviceStatusEnum.optional(),
  manufacturer: z.string().max(255).optional(),
  deviceType: DeviceTypeEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type DeviceSearchQuery = z.infer<typeof DeviceSearchSchema>;
