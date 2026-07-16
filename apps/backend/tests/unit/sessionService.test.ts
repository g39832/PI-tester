import { describe, it, expect } from 'vitest';
import { getOverallStatus } from '../../src/modules/health/healthScore.service.js';

describe('Diagnostic Session Service', () => {
  describe('Health Score Status', () => {
    it('returns good for score >= 80', () => {
      expect(getOverallStatus(100)).toBe('good');
      expect(getOverallStatus(80)).toBe('good');
      expect(getOverallStatus(85)).toBe('good');
    });

    it('returns warning for score 50-79', () => {
      expect(getOverallStatus(79)).toBe('warning');
      expect(getOverallStatus(50)).toBe('warning');
      expect(getOverallStatus(65)).toBe('warning');
    });

    it('returns critical for score < 50', () => {
      expect(getOverallStatus(49)).toBe('critical');
      expect(getOverallStatus(0)).toBe('critical');
      expect(getOverallStatus(30)).toBe('critical');
    });

    it('returns unknown for null', () => {
      expect(getOverallStatus(null)).toBe('unknown');
    });
  });

  describe('Session Comparison Builder', () => {
    function buildComparison(
      current: Array<{ testId: string; label: string; health: string }>,
      previous: Array<{ testId: string; label: string; health: string }>,
    ) {
      const allIds = new Set([...current.map((t) => t.testId), ...previous.map((t) => t.testId)]);
      const comparisons: Array<any> = [];

      const healthVal = (h: string): number => ({ good: 4, warning: 2, critical: 0, unknown: 1 }[h] ?? 1);

      for (const testId of allIds) {
        const cur = current.find((t) => t.testId === testId);
        const prev = previous.find((t) => t.testId === testId);

        if (cur && !prev) {
          comparisons.push({ testId, label: cur.label, change: 'new' });
        } else if (!cur && prev) {
          comparisons.push({ testId, label: prev.label, change: 'removed' });
        } else if (cur && prev) {
          const diff = healthVal(cur.health) - healthVal(prev.health);
          comparisons.push({ testId, label: cur.label, change: diff > 0 ? 'improved' : diff < 0 ? 'degraded' : 'unchanged' });
        }
      }
      return comparisons;
    }

    it('marks improved when current is better than previous', () => {
      const comparisons = buildComparison(
        [{ testId: 'battery', label: 'Battery', health: 'good' }],
        [{ testId: 'battery', label: 'Battery', health: 'warning' }],
      );
      expect(comparisons[0].change).toBe('improved');
    });

    it('marks degraded when current is worse', () => {
      const comparisons = buildComparison(
        [{ testId: 'storage', label: 'Storage', health: 'critical' }],
        [{ testId: 'storage', label: 'Storage', health: 'good' }],
      );
      expect(comparisons[0].change).toBe('degraded');
    });

    it('marks unchanged when health is the same', () => {
      const comparisons = buildComparison(
        [{ testId: 'cpu', label: 'CPU', health: 'good' }],
        [{ testId: 'cpu', label: 'CPU', health: 'good' }],
      );
      expect(comparisons[0].change).toBe('unchanged');
    });

    it('marks new for tests not in previous scan', () => {
      const comparisons = buildComparison(
        [{ testId: 'updates', label: 'Windows Updates', health: 'good' }],
        [{ testId: 'cpu', label: 'CPU', health: 'good' }],
      );
      const updates = comparisons.find((c) => c.testId === 'updates');
      expect(updates?.change).toBe('new');
    });

    it('marks removed for tests no longer in current scan', () => {
      const comparisons = buildComparison(
        [{ testId: 'cpu', label: 'CPU', health: 'good' }],
        [{ testId: 'battery', label: 'Battery', health: 'good' }],
      );
      const battery = comparisons.find((c) => c.testId === 'battery');
      expect(battery?.change).toBe('removed');
    });

    it('handles empty arrays', () => {
      const comparisons = buildComparison([], []);
      expect(comparisons).toHaveLength(0);
    });
  });
});
