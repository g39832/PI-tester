import type { CategoryScores } from './healthScore.service.js';
import { getSqlite } from '@dds/database';

export interface TestResultData {
  testId: string;
  label: string;
  status: string;
  health: string;
  data: Record<string, unknown>;
  warnings: string[];
  duration: number | null;
}

export interface Recommendation {
  category: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detail: string;
  source: string;
}

export function generateRecommendations(
  scores: CategoryScores,
  testResults: TestResultData[],
): Recommendation[] {
  const recs: Recommendation[] = [];

  const findResult = (testId: string) => testResults.find((r) => r.testId === testId);

  // Storage recommendations
  const storageResult = findResult('storage');
  if (storageResult?.status === 'completed') {
    const drives = (storageResult.data as any)?.drives as Array<any> | undefined;
    if (drives) {
      for (const drive of drives) {
        if (drive.smartStatus === 'failing') {
          recs.push({
            category: 'storage',
            severity: 'critical',
            message: `Replace ${drive.model} immediately — SMART failure detected`,
            detail: `Drive ${drive.model} (S/N: ${drive.serial}) reports a failing SMART status. Data loss is imminent.`,
            source: 'storage',
          });
        }
        if (drive.type === 'SSD' && drive.wearLevel != null) {
          if (drive.wearLevel > 80) {
            recs.push({
              category: 'storage',
              severity: 'critical',
              message: `Replace ${drive.model} — SSD wear level critically high (${drive.wearLevel}%)`,
              detail: `SSD wear level exceeds the recommended maximum. Expected remaining life is minimal.`,
              source: 'storage',
            });
          } else if (drive.wearLevel > 60) {
            recs.push({
              category: 'storage',
              severity: 'warning',
              message: `Plan replacement for ${drive.model} — SSD wear level elevated (${drive.wearLevel}%)`,
              detail: `SSD wear level is above the normal range. Schedule replacement within 3-6 months.`,
              source: 'storage',
            });
          }
        }
        if (drive.temperature != null && drive.temperature > 60) {
          recs.push({
            category: 'temperature',
            severity: drive.temperature > 70 ? 'critical' : 'warning',
            message: `${drive.model} temperature is high (${drive.temperature}°C)`,
            detail: `Drive temperature exceeds normal operating range. Check system cooling and airflow.`,
            source: 'storage',
          });
        }
      }
    }
  }

  // Battery recommendations
  const batResult = findResult('battery');
  if (batResult?.status === 'completed') {
    const bat = batResult.data as any;
    if (bat?.present) {
      if (bat.wearLevel != null && bat.wearLevel >= 30) {
        recs.push({
          category: 'battery',
          severity: 'critical',
          message: `Replace battery immediately — wear level ${bat.wearLevel}%`,
          detail: `Battery wear level exceeds the recommended service threshold. The battery may not hold a charge and could swell.`,
          source: 'battery',
        });
      } else if (bat.wearLevel != null && bat.wearLevel >= 15) {
        recs.push({
          category: 'battery',
          severity: 'warning',
          message: `Battery wear level elevated (${bat.wearLevel}%) — consider replacement`,
          detail: `Battery is below the recommended service threshold. Consider replacement within the next maintenance cycle.`,
          source: 'battery',
        });
      }
      if (bat.health != null && bat.health < 30) {
        recs.push({
          category: 'battery',
          severity: 'critical',
          message: `Battery charge capacity critically low (${bat.health}%)`,
          detail: `The battery can only hold ${bat.health}% of its original charge. Replacement is recommended.`,
          source: 'battery',
        });
      }
      if (bat.cycleCount != null && bat.cycleCount > 500) {
        recs.push({
          category: 'battery',
          severity: 'warning',
          message: `Battery cycle count high (${bat.cycleCount} cycles)`,
          detail: `Lithium-ion batteries are typically rated for 300-500 cycles. This battery has exceeded that range.`,
          source: 'battery',
        });
      }
    }
  }

  // Windows activation
  const winResult = findResult('windows');
  if (winResult?.status === 'completed') {
    const win = winResult.data as any;
    if (win?.activationStatus === 'not_activated') {
      recs.push({
        category: 'windows_health',
        severity: 'warning',
        message: 'Windows is not activated',
        detail: 'The Windows installation is not activated. This may limit features and display a watermark.',
        source: 'windows',
      });
    }
    if (win?.secureBoot === 'disabled') {
      recs.push({
        category: 'security',
        severity: 'warning',
        message: 'Secure Boot is disabled',
        detail: 'Secure Boot helps prevent unauthorized firmware and bootloaders from running during system startup.',
        source: 'windows',
      });
    }
    if (win?.tpmPresent === false) {
      recs.push({
        category: 'security',
        severity: 'warning',
        message: 'No TPM module detected',
        detail: 'A Trusted Platform Module is required for BitLocker encryption and Windows 11 compatibility.',
        source: 'windows',
      });
    }
  }

  // Pending updates
  const upResult = findResult('updates');
  if (upResult?.status === 'completed') {
    const up = upResult.data as any;
    if (up?.pendingUpdateCount > 0) {
      recs.push({
        category: 'windows_health',
        severity: up.pendingUpdateCount > 10 ? 'warning' : 'info',
        message: `${up.pendingUpdateCount} Windows updates pending`,
        detail: `Installing pending updates is critical for security and system stability.`,
        source: 'updates',
      });
    }
    if (up?.daysSinceLastUpdate != null && up.daysSinceLastUpdate > 30) {
      recs.push({
        category: 'windows_health',
        severity: up.daysSinceLastUpdate > 60 ? 'warning' : 'info',
        message: `Last Windows Update was ${up.daysSinceLastUpdate} days ago`,
        detail: `Systems should be updated regularly to receive security patches and bug fixes.`,
        source: 'updates',
      });
    }
  }

  // Drivers
  const drResult = findResult('drivers');
  if (drResult?.status === 'completed') {
    const dr = drResult.data as any;
    if (dr?.problemCount > 0) {
      recs.push({
        category: 'windows_health',
        severity: 'warning',
        message: `${dr.problemCount} problematic driver(s) detected`,
        detail: `Faulty or missing drivers can cause hardware instability and performance issues.`,
        source: 'drivers',
      });
    }
  }

  // Event log
  const evResult = findResult('eventviewer');
  if (evResult?.status === 'completed') {
    const ev = evResult.data as any;
    if (ev?.criticalCount > 0) {
      recs.push({
        category: 'windows_health',
        severity: 'warning',
        message: `${ev.criticalCount} critical system events in the last ${ev.scanRangeDays ?? 7} days`,
        detail: `Critical system events may indicate hardware faults or software corruption. Review the event log for details.`,
        source: 'eventviewer',
      });
    }
  }

  return recs;
}
