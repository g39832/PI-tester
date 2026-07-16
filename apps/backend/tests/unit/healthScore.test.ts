import { describe, it, expect } from 'vitest';
import { calculateHealthScore, getOverallStatus } from '../../src/modules/health/healthScore.service.js';

describe('Health Score Engine', () => {
  it('returns 100 for perfect health', () => {
    const result = calculateHealthScore({
      storage: { status: 'completed', data: { drives: [{ smartStatus: 'ok', wearLevel: 10, temperature: 35 }] } },
      battery: { status: 'completed', data: { present: false } },
      windows: { status: 'completed', data: { activationStatus: 'activated', secureBoot: 'enabled', tpmPresent: true, tpmEnabled: true } },
      eventviewer: { status: 'completed', data: { criticalCount: 0, errorCount: 1 } },
      updates: { status: 'completed', data: { pendingUpdateCount: 0, daysSinceLastUpdate: 5 } },
      drivers: { status: 'completed', data: { problemCount: 0 } },
      cpu: { status: 'completed' },
      memory: { status: 'completed' },
      gpu: { status: 'completed' },
      motherboard: { status: 'completed' },
    });
    expect(result.overall).toBe(100);
    expect(result.categories.storage).toBe(100);
    expect(result.categories.battery).toBe(100);
    expect(result.categories.windows_health).toBe(100);
    expect(result.categories.hardware).toBe(100);
    expect(result.categories.security).toBe(100);
    expect(result.categories.temperature).toBe(100);
  });

  it('drops storage to 0 for failing SMART', () => {
    const result = calculateHealthScore({
      storage: { status: 'completed', data: { drives: [{ smartStatus: 'failing', wearLevel: 90, temperature: 45 }] } },
      battery: { status: 'completed', data: { present: false } },
      windows: { status: 'completed', data: { activationStatus: 'activated', secureBoot: 'enabled', tpmPresent: true, tpmEnabled: true } },
      eventviewer: { status: 'completed', data: { criticalCount: 0, errorCount: 0 } },
      updates: { status: 'completed', data: { pendingUpdateCount: 0, daysSinceLastUpdate: 3 } },
      drivers: { status: 'completed', data: { problemCount: 0 } },
      cpu: { status: 'completed' },
      memory: { status: 'completed' },
      gpu: { status: 'completed' },
      motherboard: { status: 'completed' },
    });
    expect(result.categories.storage).toBe(0);
    expect(result.overall).toBeLessThan(100);
  });

  it('drops battery score for high wear level', () => {
    const result = calculateHealthScore({
      storage: { status: 'completed', data: { drives: [{ smartStatus: 'ok', wearLevel: 5, temperature: 30 }] } },
      battery: { status: 'completed', data: { present: true, wearLevel: 35, health: 65 } },
      windows: { status: 'completed', data: { activationStatus: 'activated', secureBoot: 'enabled', tpmPresent: true, tpmEnabled: true } },
      eventviewer: { status: 'completed', data: { criticalCount: 0, errorCount: 0 } },
      updates: { status: 'completed', data: { pendingUpdateCount: 0, daysSinceLastUpdate: 3 } },
      drivers: { status: 'completed', data: { problemCount: 0 } },
      cpu: { status: 'completed' },
      memory: { status: 'completed' },
      gpu: { status: 'completed' },
      motherboard: { status: 'completed' },
    });
    expect(result.categories.battery).toBe(0);
  });

  it('penalizes windows health for not activated', () => {
    const result = calculateHealthScore({
      storage: { status: 'completed', data: { drives: [{ smartStatus: 'ok', wearLevel: 5, temperature: 30 }] } },
      battery: { status: 'completed', data: { present: false } },
      windows: { status: 'completed', data: { activationStatus: 'not_activated', secureBoot: 'enabled', tpmPresent: true, tpmEnabled: true } },
      eventviewer: { status: 'completed', data: { criticalCount: 0, errorCount: 0 } },
      updates: { status: 'completed', data: { pendingUpdateCount: 0, daysSinceLastUpdate: 3 } },
      drivers: { status: 'completed', data: { problemCount: 0 } },
      cpu: { status: 'completed' },
      memory: { status: 'completed' },
      gpu: { status: 'completed' },
      motherboard: { status: 'completed' },
    });
    expect(result.categories.windows_health).toBe(80);
  });

  it('penalizes security score for disabled secure boot', () => {
    const result = calculateHealthScore({
      storage: { status: 'completed', data: { drives: [{ smartStatus: 'ok', wearLevel: 5, temperature: 30 }] } },
      battery: { status: 'completed', data: { present: false } },
      windows: { status: 'completed', data: { activationStatus: 'activated', secureBoot: 'disabled', tpmPresent: true, tpmEnabled: true } },
      eventviewer: { status: 'completed', data: { criticalCount: 0, errorCount: 0 } },
      updates: { status: 'completed', data: { pendingUpdateCount: 0, daysSinceLastUpdate: 3 } },
      drivers: { status: 'completed', data: { problemCount: 0 } },
      cpu: { status: 'completed' },
      memory: { status: 'completed' },
      gpu: { status: 'completed' },
      motherboard: { status: 'completed' },
    });
    expect(result.categories.security).toBe(70);
  });

  it('penalizes security for missing TPM', () => {
    const result = calculateHealthScore({
      storage: { status: 'completed', data: { drives: [{ smartStatus: 'ok', wearLevel: 5, temperature: 30 }] } },
      battery: { status: 'completed', data: { present: false } },
      windows: { status: 'completed', data: { activationStatus: 'activated', secureBoot: 'enabled', tpmPresent: false, tpmEnabled: false } },
      eventviewer: { status: 'completed', data: { criticalCount: 0, errorCount: 0 } },
      updates: { status: 'completed', data: { pendingUpdateCount: 0, daysSinceLastUpdate: 3 } },
      drivers: { status: 'completed', data: { problemCount: 0 } },
      cpu: { status: 'completed' },
      memory: { status: 'completed' },
      gpu: { status: 'completed' },
      motherboard: { status: 'completed' },
    });
    expect(result.categories.security).toBe(80);
  });

  it('handles critical event log entries', () => {
    const result = calculateHealthScore({
      storage: { status: 'completed', data: { drives: [{ smartStatus: 'ok', wearLevel: 5, temperature: 30 }] } },
      battery: { status: 'completed', data: { present: false } },
      windows: { status: 'completed', data: { activationStatus: 'activated', secureBoot: 'enabled', tpmPresent: true, tpmEnabled: true } },
      eventviewer: { status: 'completed', data: { criticalCount: 3, errorCount: 15 } },
      updates: { status: 'completed', data: { pendingUpdateCount: 0, daysSinceLastUpdate: 3 } },
      drivers: { status: 'completed', data: { problemCount: 0 } },
      cpu: { status: 'completed' },
      memory: { status: 'completed' },
      gpu: { status: 'completed' },
      motherboard: { status: 'completed' },
    });
    expect(result.categories.windows_health).toBeLessThan(100);
  });

  it('handles pending updates', () => {
    const result = calculateHealthScore({
      storage: { status: 'completed', data: { drives: [{ smartStatus: 'ok', wearLevel: 5, temperature: 30 }] } },
      battery: { status: 'completed', data: { present: false } },
      windows: { status: 'completed', data: { activationStatus: 'activated', secureBoot: 'enabled', tpmPresent: true, tpmEnabled: true } },
      eventviewer: { status: 'completed', data: { criticalCount: 0, errorCount: 0 } },
      updates: { status: 'completed', data: { pendingUpdateCount: 15, daysSinceLastUpdate: 70 } },
      drivers: { status: 'completed', data: { problemCount: 0 } },
      cpu: { status: 'completed' },
      memory: { status: 'completed' },
      gpu: { status: 'completed' },
      motherboard: { status: 'completed' },
    });
    expect(result.categories.windows_health).toBeLessThanOrEqual(75);
  });

  it('handles hardware failures', () => {
    const result = calculateHealthScore({
      storage: { status: 'completed', data: { drives: [{ smartStatus: 'ok', wearLevel: 5, temperature: 30 }] } },
      battery: { status: 'completed', data: { present: false } },
      windows: { status: 'completed', data: { activationStatus: 'activated', secureBoot: 'enabled', tpmPresent: true, tpmEnabled: true } },
      eventviewer: { status: 'completed', data: { criticalCount: 0, errorCount: 0 } },
      updates: { status: 'completed', data: { pendingUpdateCount: 0, daysSinceLastUpdate: 3 } },
      drivers: { status: 'completed', data: { problemCount: 0 } },
      cpu: { status: 'failed' },
      memory: { status: 'failed' },
      gpu: { status: 'completed' },
      motherboard: { status: 'completed' },
    });
    expect(result.categories.hardware).toBe(50);
  });

  it('returns unknown overall status for null score', () => {
    expect(getOverallStatus(null)).toBe('unknown');
    expect(getOverallStatus(100)).toBe('good');
    expect(getOverallStatus(65)).toBe('warning');
    expect(getOverallStatus(30)).toBe('critical');
  });

  it('handles empty results gracefully', () => {
    const result = calculateHealthScore({});
    expect(result.overall).toBeNull();
    expect(result.categories.storage).toBeNull();
    expect(result.categories.battery).toBeNull();
  });

  it('penalizes temperature for hot drives', () => {
    const result = calculateHealthScore({
      storage: { status: 'completed', data: { drives: [
        { smartStatus: 'ok', wearLevel: 5, temperature: 72 },
      ] } },
      battery: { status: 'completed', data: { present: false } },
      windows: { status: 'completed', data: { activationStatus: 'activated', secureBoot: 'enabled', tpmPresent: true, tpmEnabled: true } },
      eventviewer: { status: 'completed', data: { criticalCount: 0, errorCount: 0 } },
      updates: { status: 'completed', data: { pendingUpdateCount: 0, daysSinceLastUpdate: 3 } },
      drivers: { status: 'completed', data: { problemCount: 0 } },
      cpu: { status: 'completed' },
      memory: { status: 'completed' },
      gpu: { status: 'completed' },
      motherboard: { status: 'completed' },
    });
    expect(result.categories.temperature).toBe(0);
  });

  it('battery score is 100 for desktop (no battery)', () => {
    const result = calculateHealthScore({
      storage: { status: 'completed', data: { drives: [{ smartStatus: 'ok', wearLevel: 5, temperature: 30 }] } },
      battery: { status: 'completed', data: { present: false } },
      windows: { status: 'completed', data: { activationStatus: 'activated', secureBoot: 'enabled', tpmPresent: true, tpmEnabled: true } },
      eventviewer: { status: 'completed', data: { criticalCount: 0, errorCount: 0 } },
      updates: { status: 'completed', data: { pendingUpdateCount: 0, daysSinceLastUpdate: 3 } },
      drivers: { status: 'completed', data: { problemCount: 0 } },
      cpu: { status: 'completed' },
      memory: { status: 'completed' },
      gpu: { status: 'completed' },
      motherboard: { status: 'completed' },
    });
    expect(result.categories.battery).toBe(100);
  });
});
