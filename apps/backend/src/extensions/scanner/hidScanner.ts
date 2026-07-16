import type { ScannerPlugin, ScannerEvent } from '../types.js';

interface HidScannerConfig {
  devicePath?: string;
  minScanLength?: number;
  scanThresholdMs?: number;
}

const HID_KEY_MAP: Record<number, string> = {
  0x04: 'a', 0x05: 'b', 0x06: 'c', 0x07: 'd', 0x08: 'e',
  0x09: 'f', 0x0A: 'g', 0x0B: 'h', 0x0C: 'i', 0x0D: 'j',
  0x0E: 'k', 0x0F: 'l', 0x10: 'm', 0x11: 'n', 0x12: 'o',
  0x13: 'p', 0x14: 'q', 0x15: 'r', 0x16: 's', 0x17: 't',
  0x18: 'u', 0x19: 'v', 0x1A: 'w', 0x1B: 'x', 0x1C: 'y',
  0x1D: 'z',
  0x1E: '1', 0x1F: '2', 0x20: '3', 0x21: '4', 0x22: '5',
  0x23: '6', 0x24: '7', 0x25: '8', 0x26: '9', 0x27: '0',
  0x28: '\n',
  0x2C: ' ',
  0x2D: '-', 0x2E: '=', 0x2F: '[', 0x30: ']', 0x31: '\\',
  0x33: ';', 0x34: '\'', 0x35: '`', 0x36: ',', 0x37: '.', 0x38: '/',
};

export function createHidScannerPlugin(config?: HidScannerConfig): ScannerPlugin {
  const cfg = {
    devicePath: config?.devicePath,
    minScanLength: config?.minScanLength ?? 3,
    scanThresholdMs: config?.scanThresholdMs ?? 50,
  };

  let active = false;
  let onScanHandler: ((event: ScannerEvent) => void) | null = null;
  let readStream: any = null;
  let buffer: Array<{ char: string; time: number }> = [];

  function findInputDevice(): string | null {
    return cfg.devicePath || null;
  }

  function decodeHidEvent(data: Buffer): { keyCode: number; pressed: boolean } | null {
    if (data.length < 24) return null;
    const type = data.readUInt16LE(16);
    const code = data.readUInt16LE(18);
    const value = data.readInt32LE(20);
    if (type !== 0x01) return null;
    return { keyCode: code, pressed: value === 1 };
  }

  function handleChar(char: string): void {
    if (char === '\n') {
      if (buffer.length >= cfg.minScanLength) {
        const code = buffer.map((b) => b.char).join('');
        let isScan = true;
        for (let i = 1; i < buffer.length; i++) {
          if (buffer[i].time - buffer[i - 1].time > cfg.scanThresholdMs) {
            isScan = false;
            break;
          }
        }
        buffer = [];
        if (isScan && onScanHandler) {
          onScanHandler({ code, timestamp: Date.now(), source: 'barcode', valid: true });
        }
      } else {
        buffer = [];
      }
    } else {
      buffer.push({ char, time: Date.now() });
    }
  }

  return {
    name: 'hid-scanner',
    active: false,

    async start(onScan: (event: ScannerEvent) => void): Promise<void> {
      onScanHandler = onScan;
      active = true;

      const devicePath = findInputDevice();
      if (!devicePath) {
        return;
      }

      try {
        const fs = await import('fs');
        readStream = fs.createReadStream(devicePath);
        readStream.on('data', (chunk: Buffer) => {
          if (!active) return;
          for (let offset = 0; offset + 24 <= chunk.length; offset += 24) {
            const ev = decodeHidEvent(chunk.subarray(offset, offset + 24));
            if (ev && ev.pressed) {
              const char = HID_KEY_MAP[ev.keyCode];
              if (char) handleChar(char);
            }
          }
        });
        readStream.on('error', () => {});
      } catch {
        // HID device not available — in-browser scanner fallback handles this
      }
    },

    async stop(): Promise<void> {
      active = false;
      onScanHandler = null;
      if (readStream) {
        try { readStream.destroy(); } catch {}
        readStream = null;
      }
      buffer = [];
    },
  };
}

export const hidScannerPlugin = createHidScannerPlugin();
