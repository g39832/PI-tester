import { describe, it, expect } from 'vitest';
import { generatePdfReport } from '../../src/modules/reports/reports.service.js';

describe('PDF Report Generation', () => {
  it('generates a non-empty PDF buffer', async () => {
    const pdf = await generatePdfReport({
      manufacturer: 'Dell',
      model: 'Latitude 5480',
      healthScore: 85,
      overallStatus: 'good',
      scanMode: 'quick',
      durationSeconds: 45,
      tests: [
        { label: 'CPU', status: 'completed', health: 'good' },
        { label: 'Storage', status: 'completed', health: 'warning', warnings: ['SSD wear level elevated (65%)'] },
      ],
      recommendations: [
        { severity: 'warning', message: 'SSD wear level elevated', detail: 'Plan replacement within 3-6 months.' },
      ],
      technicianNotes: 'Customer reported slow boot times.',
    });

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(1000);
    // PDF header magic bytes
    expect(pdf[0]).toBe(0x25); // %
    expect(pdf[1]).toBe(0x50); // P
    expect(pdf[2]).toBe(0x44); // D
    expect(pdf[3]).toBe(0x46); // F
  });

  it('generates report with minimal data', async () => {
    const pdf = await generatePdfReport({
      manufacturer: 'Unknown',
      model: 'Custom Build',
    });
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(500);
  });

  it('generates report with critical health', async () => {
    const pdf = await generatePdfReport({
      manufacturer: 'HP',
      model: 'EliteBook',
      healthScore: 15,
      overallStatus: 'critical',
      categoryScores: { storage: 0, battery: 0, windows_health: 50, hardware: 100, security: 60, temperature: 100 },
      tests: [
        { label: 'Storage', status: 'completed', health: 'critical', warnings: ['SMART failure detected'] },
        { label: 'Battery', status: 'completed', health: 'critical', warnings: ['Wear level 35%'] },
      ],
      recommendations: [
        { severity: 'critical', message: 'Replace drive immediately', detail: 'SMART failure imminent data loss.' },
        { severity: 'critical', message: 'Replace battery', detail: 'Wear level exceeds service threshold.' },
      ],
    });
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(500);
  });
});
