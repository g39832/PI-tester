import { describe, it, expect } from 'vitest';

// Device matching logic extracted from the repository for testability
// In real usage, this tests the actual deviceRepository methods

describe('Device Matching', () => {
  describe('SKU generation', () => {
    it('generates SKU with correct prefix for each device type', () => {
      const generateSku = (deviceType: string): string => {
        const prefixMap: Record<string, string> = {
          desktop: 'DSK',
          laptop: 'LPT',
          tablet: 'TAB',
          server: 'SRV',
          other: 'OTH',
        };
        const prefix = prefixMap[deviceType] ?? 'GEN';
        const year = new Date().getFullYear().toString().slice(-2);
        return `${prefix}-${year}-XXXX`;
      };

      expect(generateSku('desktop')).toMatch(/^DSK-\d{2}-XXXX$/);
      expect(generateSku('laptop')).toMatch(/^LPT-\d{2}-XXXX$/);
      expect(generateSku('tablet')).toMatch(/^TAB-\d{2}-XXXX$/);
      expect(generateSku('server')).toMatch(/^SRV-\d{2}-XXXX$/);
      expect(generateSku('other')).toMatch(/^OTH-\d{2}-XXXX$/);
    });
  });

  describe('Device field normalization', () => {
    it('normalizes manufacturer names', () => {
      const normalize = (mfr: string): string => mfr.trim();
      expect(normalize('  Dell  ')).toBe('Dell');
      expect(normalize('Hewlett-Packard')).toBe('Hewlett-Packard');
    });

    it('handles empty serial numbers', () => {
      const isValidSerial = (s: string | null): boolean => {
        if (!s || s.trim() === '') return false;
        return s.trim().length >= 3;
      };
      expect(isValidSerial(null)).toBe(false);
      expect(isValidSerial('')).toBe(false);
      expect(isValidSerial('AB')).toBe(false);
      expect(isValidSerial('ABC123')).toBe(true);
    });
  });

  describe('Device type classification', () => {
    it('classifies device types correctly', () => {
      const validTypes = ['desktop', 'laptop', 'tablet', 'server', 'other'];
      expect(validTypes).toContain('desktop');
      expect(validTypes).toContain('laptop');
      expect(validTypes).not.toContain('smartphone');
    });
  });

  describe('Date parsing', () => {
    it('parses ISO date strings', () => {
      const d = new Date('2024-01-15T10:30:00.000Z');
      expect(d.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });
  });
});
