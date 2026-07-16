import { getSqlite } from '@dds/database';

type SqlValue = string | number | null;

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

export interface DeviceSearchParams {
  q?: string;
  status?: string;
  manufacturer?: string;
  deviceType?: string;
  page: number;
  limit: number;
}

export interface DeviceListResult {
  devices: DeviceRow[];
  total: number;
}

function buildWhere(params: DeviceSearchParams): { clause: string; values: SqlValue[] } {
  const conditions: string[] = [];
  const values: SqlValue[] = [];

  if (params.q) {
    conditions.push(
      '(company_sku LIKE ? OR serial_number LIKE ? OR manufacturer LIKE ? OR model LIKE ? OR cpu LIKE ?)'
    );
    const term = `%${params.q}%`;
    values.push(term, term, term, term, term);
  }
  if (params.status) {
    conditions.push('status = ?');
    values.push(params.status);
  }
  if (params.manufacturer) {
    conditions.push('manufacturer = ?');
    values.push(params.manufacturer);
  }
  if (params.deviceType) {
    conditions.push('device_type = ?');
    values.push(params.deviceType);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

function rowToDevice(row: Record<string, unknown>): DeviceRow {
  return {
    id: row.id as string,
    company_sku: row.company_sku as string | null,
    serial_number: row.serial_number as string | null,
    asset_tag: row.asset_tag as string | null,
    manufacturer: row.manufacturer as string,
    model: row.model as string,
    device_type: row.device_type as string,
    cpu: row.cpu as string | null,
    ram_gb: row.ram_gb as number | null,
    storage_gb: row.storage_gb as number | null,
    storage_type: row.storage_type as string | null,
    gpu: row.gpu as string | null,
    battery_health: row.battery_health as number | null,
    battery_cycle_count: row.battery_cycle_count as number | null,
    bios_version: row.bios_version as string | null,
    tpm_status: row.tpm_status as string | null,
    secure_boot: row.secure_boot as string | null,
    windows_version: row.windows_version as string | null,
    os_edition: row.os_edition as string | null,
    status: row.status as string,
    technician_notes: row.technician_notes as string | null,
    date_added: row.date_added as string,
    last_scan_date: row.last_scan_date as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export const deviceRepository = {
  findById(id: string): DeviceRow | undefined {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM devices WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = rowToDevice(stmt.getAsObject());
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  },

  findBySerial(serialNumber: string): DeviceRow | undefined {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM devices WHERE serial_number = ?');
    stmt.bind([serialNumber]);
    if (stmt.step()) {
      const row = rowToDevice(stmt.getAsObject());
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  },

  findBySku(sku: string): DeviceRow | undefined {
    const db = getSqlite();
    const stmt = db.prepare('SELECT * FROM devices WHERE company_sku = ?');
    stmt.bind([sku]);
    if (stmt.step()) {
      const row = rowToDevice(stmt.getAsObject());
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  },

  search(params: DeviceSearchParams): DeviceListResult {
    const db = getSqlite();
    const { clause, values } = buildWhere(params);

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM devices ${clause}`);
    countStmt.bind(values);
    const total = countStmt.step() ? Number((countStmt.getAsObject() as Record<string, unknown>).count) : 0;
    countStmt.free();

    const offset = (params.page - 1) * params.limit;
    const dataValues: SqlValue[] = [...values, params.limit, offset];
    const dataStmt = db.prepare(`SELECT * FROM devices ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`);
    dataStmt.bind(dataValues);

    const devices: DeviceRow[] = [];
    while (dataStmt.step()) {
      devices.push(rowToDevice(dataStmt.getAsObject()));
    }
    dataStmt.free();

    return { devices, total };
  },

  create(data: DeviceRow): DeviceRow {
    const db = getSqlite();
    const stmt = db.prepare(
      `INSERT INTO devices (id, company_sku, serial_number, asset_tag, manufacturer, model,
        device_type, cpu, ram_gb, storage_gb, storage_type, gpu, battery_health,
        battery_cycle_count, bios_version, tpm_status, secure_boot, windows_version,
        os_edition, status, technician_notes, date_added, last_scan_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.bind([
      data.id, data.company_sku, data.serial_number, data.asset_tag,
      data.manufacturer, data.model, data.device_type, data.cpu, data.ram_gb,
      data.storage_gb, data.storage_type, data.gpu, data.battery_health,
      data.battery_cycle_count, data.bios_version, data.tpm_status, data.secure_boot,
      data.windows_version, data.os_edition, data.status, data.technician_notes,
      data.date_added, data.last_scan_date, data.created_at, data.updated_at,
    ]);
    stmt.step();
    stmt.free();
    return deviceRepository.findById(data.id)!;
  },

  update(id: string, data: Partial<DeviceRow>): DeviceRow | undefined {
    const existing = deviceRepository.findById(id);
    if (!existing) return undefined;

    const merged = { ...existing, ...data, updated_at: new Date().toISOString() };
    const db = getSqlite();
    const stmt = db.prepare(
      `UPDATE devices SET company_sku=?, serial_number=?, asset_tag=?, manufacturer=?, model=?,
        device_type=?, cpu=?, ram_gb=?, storage_gb=?, storage_type=?, gpu=?, battery_health=?,
        battery_cycle_count=?, bios_version=?, tpm_status=?, secure_boot=?, windows_version=?,
        os_edition=?, status=?, technician_notes=?, last_scan_date=?, updated_at=?
      WHERE id=?`
    );
    stmt.bind([
      merged.company_sku, merged.serial_number, merged.asset_tag, merged.manufacturer,
      merged.model, merged.device_type, merged.cpu, merged.ram_gb, merged.storage_gb,
      merged.storage_type, merged.gpu, merged.battery_health, merged.battery_cycle_count,
      merged.bios_version, merged.tpm_status, merged.secure_boot, merged.windows_version,
      merged.os_edition, merged.status, merged.technician_notes, merged.last_scan_date,
      merged.updated_at, id,
    ]);
    stmt.step();
    stmt.free();
    return deviceRepository.findById(id);
  },

  delete(id: string): boolean {
    const db = getSqlite();
    const stmt = db.prepare('DELETE FROM devices WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const changes = db.getRowsModified();
    stmt.free();
    return changes > 0;
  },

  getDistinctManufacturers(): string[] {
    const db = getSqlite();
    const stmt = db.prepare('SELECT DISTINCT manufacturer FROM devices ORDER BY manufacturer');
    const results: string[] = [];
    while (stmt.step()) {
      results.push((stmt.getAsObject() as Record<string, unknown>).manufacturer as string);
    }
    stmt.free();
    return results;
  },

  getStats(): { total: number; todayCount: number; avgHealth: number | null; attentionCount: number } {
    const db = getSqlite();
    const today = new Date().toISOString().slice(0, 10);

    const total = (() => {
      const stmt = db.prepare('SELECT COUNT(*) as c FROM devices');
      const result = stmt.step() ? Number((stmt.getAsObject() as Record<string, unknown>).c) : 0;
      stmt.free();
      return result;
    })();

    const todayCount = (() => {
      const stmt = db.prepare('SELECT COUNT(*) as c FROM devices WHERE date_added >= ?');
      stmt.bind([today]);
      const result = stmt.step() ? Number((stmt.getAsObject() as Record<string, unknown>).c) : 0;
      stmt.free();
      return result;
    })();

    const avgHealth = (() => {
      const stmt = db.prepare('SELECT AVG(battery_health) as avg FROM devices WHERE battery_health IS NOT NULL');
      const result = stmt.step() ? Number((stmt.getAsObject() as Record<string, unknown>).avg) : null;
      stmt.free();
      return result ?? null;
    })();

    const attentionCount = (() => {
      const stmt = db.prepare("SELECT COUNT(*) as c FROM devices WHERE status = 'diagnosed'");
      const result = stmt.step() ? Number((stmt.getAsObject() as Record<string, unknown>).c) : 0;
      stmt.free();
      return result;
    })();

    return { total, todayCount, avgHealth, attentionCount };
  },
};
