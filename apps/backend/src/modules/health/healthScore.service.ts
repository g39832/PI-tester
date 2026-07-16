export interface HealthScoreInput {
  storage?: { status: string; data?: { drives?: Array<{ smartStatus?: string; wearLevel?: number | null; temperature?: number | null; type?: string }> } };
  battery?: { status: string; data?: { present?: boolean; wearLevel?: number | null; health?: number | null } };
  windows?: { status: string; data?: { activationStatus?: string; secureBoot?: string; tpmPresent?: boolean; tpmEnabled?: boolean; bitlockerEnabled?: boolean | string; enclosureType?: string } };
  eventviewer?: { status: string; data?: { criticalCount?: number; errorCount?: number } };
  updates?: { status: string; data?: { pendingUpdateCount?: number; daysSinceLastUpdate?: number | null } };
  drivers?: { status: string; data?: { problemCount?: number } };
  cpu?: { status: string };
  memory?: { status: string };
  gpu?: { status: string };
  motherboard?: { status: string };
}

export interface CategoryScores {
  storage: number | null;
  battery: number | null;
  windows_health: number | null;
  hardware: number | null;
  security: number | null;
  temperature: number | null;
}

export interface HealthScoreResult {
  overall: number | null;
  categories: CategoryScores;
}

const WEIGHTS: Record<string, number> = {
  storage: 0.30,
  battery: 0.20,
  windows_health: 0.20,
  hardware: 0.15,
  security: 0.10,
  temperature: 0.05,
};

export function calculateHealthScore(results: HealthScoreInput): HealthScoreResult {
  // Storage (30%)
  let storageScore: number | null = null;
  if (results.storage?.status === 'completed' && results.storage.data?.drives) {
    storageScore = 100;
    const drives = results.storage.data.drives;
    const failing = drives.filter((d) => d.smartStatus === 'failing');
    const highWear = drives.filter((d) => d.wearLevel != null && d.wearLevel > 80);
    const warnWear = drives.filter((d) => d.wearLevel != null && d.wearLevel > 60);
    if (failing.length > 0) storageScore = 0;
    else if (highWear.length > 0) storageScore = 30;
    else if (warnWear.length > 0) storageScore = 60;
  } else if (results.storage?.status === 'failed') {
    storageScore = 0;
  }

  // Battery (20%)
  let batteryScore: number | null = null;
  if (results.battery?.status === 'completed' && results.battery.data) {
    batteryScore = 100;
    const bat = results.battery.data;
    if (bat.present === false) {
      batteryScore = 100; // No battery = desktop = fine
    } else {
      const wl = bat.wearLevel;
      if (wl != null) {
        if (wl >= 30) batteryScore = 0;
        else if (wl >= 15) batteryScore = 50;
        else if (wl >= 10) batteryScore = 75;
      }
      if (bat.health != null && bat.health < 30) batteryScore = 0;
      else if (bat.health != null && bat.health < 60 && batteryScore != null) {
        batteryScore = Math.min(batteryScore, 50);
      }
    }
  } else if (results.battery?.status === 'failed') {
    batteryScore = 0;
  }

  // Windows Health (20%)
  let winScore: number | null = null;
  if (results.windows?.status === 'completed' && results.windows.data) {
    winScore = 100;
    const w = results.windows.data;
    if (w.activationStatus === 'not_activated') winScore -= 20;
  }
  if (results.eventviewer?.status === 'completed' && results.eventviewer.data) {
    if (winScore == null) winScore = 100;
    if (results.eventviewer.data.criticalCount! > 0) winScore -= 15;
    if (results.eventviewer.data.errorCount! > 10) winScore -= 10;
  }
  if (results.updates?.status === 'completed' && results.updates.data) {
    if (winScore == null) winScore = 100;
    if (results.updates.data.pendingUpdateCount! > 10) winScore -= 15;
    else if (results.updates.data.pendingUpdateCount! > 0) winScore -= 5;
    if (results.updates.data.daysSinceLastUpdate != null && results.updates.data.daysSinceLastUpdate > 60) winScore -= 10;
  }
  if (results.drivers?.status === 'completed' && results.drivers.data) {
    if (winScore == null) winScore = 100;
    if (results.drivers.data.problemCount! > 0) winScore -= 10;
  }
  if (winScore != null) winScore = Math.max(0, winScore);

  // Hardware (15%)
  let hwScore: number | null = null;
  if (results.cpu?.status || results.memory?.status || results.gpu?.status || results.motherboard?.status) {
    hwScore = 100;
    if (results.cpu?.status === 'failed') hwScore -= 25;
    if (results.memory?.status === 'failed') hwScore -= 25;
    if (results.gpu?.status === 'failed') hwScore -= 25;
    if (results.motherboard?.status === 'failed') hwScore -= 25;
    hwScore = Math.max(0, hwScore);
  }

  // Security (10%)
  let secScore: number | null = null;
  if (results.windows?.status === 'completed' && results.windows.data) {
    secScore = 100;
    const w = results.windows.data;
    if (w.secureBoot === 'disabled') secScore -= 30;
    else if (w.secureBoot === 'unsupported') secScore -= 10;
    if (w.tpmPresent === false) secScore -= 20;
    else if (w.tpmEnabled === false) secScore -= 15;
    if (w.bitlockerEnabled === false && (w.enclosureType?.toLowerCase().includes('laptop') || w.enclosureType?.toLowerCase().includes('notebook') || w.enclosureType?.toLowerCase().includes('portable'))) {
      secScore -= 10;
    }
  }
  if (results.updates?.status === 'completed' && results.updates.data) {
    if (secScore == null) secScore = 100;
    if (results.updates.data.daysSinceLastUpdate != null && results.updates.data.daysSinceLastUpdate > 30) secScore -= 10;
  }
  if (secScore != null) secScore = Math.max(0, secScore);

  // Temperature (5%)
  let tempScore: number | null = null;
  if (results.storage?.status === 'completed' && results.storage.data?.drives) {
    const temps = results.storage.data.drives
      .map((d) => d.temperature)
      .filter((t): t is number => t != null);
    if (temps.length > 0) {
      tempScore = 100;
      const maxTemp = Math.max(...temps);
      if (maxTemp > 70) tempScore = 0;
      else if (maxTemp > 60) tempScore = 50;
      else if (maxTemp > 50) tempScore = 75;
    }
  }

  const categories: CategoryScores = {
    storage: storageScore,
    battery: batteryScore,
    windows_health: winScore,
    hardware: hwScore,
    security: secScore,
    temperature: tempScore,
  };

  // Weighted overall
  let weightedTotal = 0;
  let weightSum = 0;
  for (const [cat, score] of Object.entries(categories)) {
    if (score != null) {
      weightedTotal += score * (WEIGHTS[cat] ?? 0);
      weightSum += WEIGHTS[cat] ?? 0;
    }
  }
  const overall = weightSum > 0 ? Math.round(weightedTotal / weightSum) : null;

  return { overall, categories };
}

export function getOverallStatus(score: number | null): 'good' | 'warning' | 'critical' | 'unknown' {
  if (score == null) return 'unknown';
  if (score >= 80) return 'good';
  if (score >= 50) return 'warning';
  return 'critical';
}
