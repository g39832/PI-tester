import { describe, it, expect } from 'vitest';
import { generateRecommendations } from '../../src/modules/health/recommendations.service.js';

describe('Recommendations Engine', () => {
  it('generates SMART failure recommendation', () => {
    const recs = generateRecommendations(
      { storage: 0, battery: 100, windows_health: 100, hardware: 100, security: 100, temperature: 100 },
      [{
        testId: 'storage',
        label: 'Storage',
        status: 'completed',
        health: 'critical',
        data: { drives: [{ model: 'Samsung SSD 980', serial: 'S123', smartStatus: 'failing', wearLevel: 95, type: 'SSD', temperature: 40 }] },
        warnings: ['SMART failure detected on Samsung SSD 980'],
        duration: 0.5,
      }],
    );

    expect(recs.length).toBeGreaterThan(0);
    const smartRec = recs.find((r) => r.message.includes('SMART failure'));
    expect(smartRec).toBeDefined();
    expect(smartRec!.severity).toBe('critical');
    expect(smartRec!.category).toBe('storage');
  });

  it('generates battery wear recommendation', () => {
    const recs = generateRecommendations(
      { storage: 100, battery: 50, windows_health: 100, hardware: 100, security: 100, temperature: 100 },
      [{
        testId: 'battery',
        label: 'Battery',
        status: 'completed',
        health: 'warning',
        data: { present: true, wearLevel: 25, health: 70, cycleCount: 600 },
        warnings: ['Battery wear level elevated (25%)'],
        duration: 0.3,
      }],
    );

    const batRec = recs.find((r) => r.category === 'battery');
    expect(batRec).toBeDefined();
    expect(batRec!.severity).toBe('warning');
    expect(batRec!.message).toContain('wear');
  });

  it('generates Windows activation recommendation', () => {
    const recs = generateRecommendations(
      { storage: 100, battery: 100, windows_health: 80, hardware: 100, security: 100, temperature: 100 },
      [{
        testId: 'windows',
        label: 'Windows OS',
        status: 'completed',
        health: 'warning',
        data: { activationStatus: 'not_activated' },
        warnings: ['Windows is not activated'],
        duration: 0.2,
      }],
    );

    const actRec = recs.find((r) => r.message.includes('not activated'));
    expect(actRec).toBeDefined();
    expect(actRec!.severity).toBe('warning');
  });

  it('generates pending updates recommendation', () => {
    const recs = generateRecommendations(
      { storage: 100, battery: 100, windows_health: 85, hardware: 100, security: 100, temperature: 100 },
      [{
        testId: 'updates',
        label: 'Windows Updates',
        status: 'completed',
        health: 'warning',
        data: { pendingUpdateCount: 12, daysSinceLastUpdate: 45 },
        warnings: ['12 pending Windows updates detected'],
        duration: 0.4,
      }],
    );

    const upRec = recs.find((r) => r.message.includes('pending'));
    expect(upRec).toBeDefined();
    expect(upRec!.severity).toBe('warning');
  });

  it('generates driver problem recommendation', () => {
    const recs = generateRecommendations(
      { storage: 100, battery: 100, windows_health: 90, hardware: 100, security: 100, temperature: 100 },
      [{
        testId: 'drivers',
        label: 'Drivers',
        status: 'completed',
        health: 'warning',
        data: { problemCount: 2 },
        warnings: ['2 problematic driver(s) detected'],
        duration: 0.3,
      }],
    );

    const drvRec = recs.find((r) => r.message.includes('driver'));
    expect(drvRec).toBeDefined();
  });

  it('returns empty array for perfect health', () => {
    const recs = generateRecommendations(
      { storage: 100, battery: 100, windows_health: 100, hardware: 100, security: 100, temperature: 100 },
      [],
    );
    expect(recs).toHaveLength(0);
  });

  it('generates Secure Boot recommendation', () => {
    const recs = generateRecommendations(
      { storage: 100, battery: 100, windows_health: 100, hardware: 100, security: 70, temperature: 100 },
      [{
        testId: 'windows',
        label: 'Windows OS',
        status: 'completed',
        health: 'warning',
        data: { secureBoot: 'disabled' },
        warnings: [],
        duration: 0.2,
      }],
    );

    const sbRec = recs.find((r) => r.message.includes('Secure Boot'));
    expect(sbRec).toBeDefined();
  });

  it('generates missing TPM recommendation', () => {
    const recs = generateRecommendations(
      { storage: 100, battery: 100, windows_health: 100, hardware: 100, security: 80, temperature: 100 },
      [{
        testId: 'windows',
        label: 'Windows OS',
        status: 'completed',
        health: 'warning',
        data: { tpmPresent: false, secureBoot: 'enabled' },
        warnings: [],
        duration: 0.2,
      }],
    );

    const tpmRec = recs.find((r) => r.message.includes('TPM'));
    expect(tpmRec).toBeDefined();
  });

  it('generates critical event log recommendation', () => {
    const recs = generateRecommendations(
      { storage: 100, battery: 100, windows_health: 85, hardware: 100, security: 100, temperature: 100 },
      [{
        testId: 'eventviewer',
        label: 'Event Log',
        status: 'completed',
        health: 'warning',
        data: { criticalCount: 5, errorCount: 20, scanRangeDays: 7 },
        warnings: ['5 critical system events detected'],
        duration: 0.5,
      }],
    );

    const evRec = recs.find((r) => r.message.includes('critical system events'));
    expect(evRec).toBeDefined();
    expect(evRec!.severity).toBe('warning');
  });
});
