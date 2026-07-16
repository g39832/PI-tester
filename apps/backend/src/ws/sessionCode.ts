const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const CODE_TTL_MS = 15 * 60 * 1000;

export interface ActiveCode {
  code: string;
  expiresAt: number;
}

let currentCode: ActiveCode | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function generate(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}

export function getSessionCode(): ActiveCode {
  if (currentCode && Date.now() < currentCode.expiresAt) {
    return currentCode;
  }
  currentCode = {
    code: generate(),
    expiresAt: Date.now() + CODE_TTL_MS,
  };
  return currentCode;
}

export function validateSessionCode(code: string): boolean {
  if (!currentCode) return false;
  if (Date.now() >= currentCode.expiresAt) return false;
  return currentCode.code === code;
}

export function onCodeRefresh(callback: (code: string) => void, intervalMs: number = 60_000): () => void {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    currentCode = {
      code: generate(),
      expiresAt: Date.now() + CODE_TTL_MS,
    };
    callback(currentCode.code);
  }, intervalMs);
  return () => {
    if (refreshTimer) clearInterval(refreshTimer);
  };
}
