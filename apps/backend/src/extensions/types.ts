/**
 * DispoScan Extension Point Interfaces
 *
 * This file defines contracts for future hardware integrations.
 * None of these interfaces are implemented yet — they exist as
 * documentation and type contracts so that a future developer can
 * add hardware support without reverse-engineering the system.
 *
 * Each integration should be implemented in its own directory under
 * src/extensions/<name>/ and registered via the extension registry.
 * Do NOT import these interfaces into core business logic files.
 * Use the registry pattern instead (see extensionRegistry.ts).
 */

// ──────────────────────────────────────────────────────────────────────
// Barcode / QR Scanner
// ──────────────────────────────────────────────────────────────────────

/**
 * A scanned code event emitted when a USB barcode or QR scanner
 * "types" a code into the system as a keyboard HID device.
 *
 * Implementation notes:
 * - Most USB barcode scanners present as HID keyboards.
 * - Listen for rapid keypress sequences terminated by Enter/Return.
 * - The scanner typically sends characters faster than human typing
 *   (< 50ms between keystrokes vs > 100ms for humans).
 * - Debounce input: accumulate keystrokes until Enter (0x0A) received
 *   OR a 100ms gap between keystrokes (human typing fallback).
 * - For QR code scanners that return larger payloads, the code field
 *   may contain a URL, JSON, or plain text.
 */
export interface ScannerEvent {
  /** The raw scanned code (alphanumeric, URL, or JSON payload) */
  code: string;
  /** Unix timestamp in milliseconds when the scan completed */
  timestamp: number;
  /** Detected scanner type */
  source: 'barcode' | 'qr' | 'unknown';
  /** Whether the code was successfully parsed */
  valid: boolean;
}

/**
 * Contract for a scanner hardware integration.
 *
 * Implementations:
 * - createScannerPlugin(): ScannerPlugin
 *
 * The plugin must:
 * 1. Open the HID input device (/dev/input/event* on Linux)
 * 2. Listen for key events, buffer them, and emit ScannerEvents
 * 3. Handle multiple scanner models by detecting vendor/product IDs
 * 4. Clean up resources on destroy()
 */
export interface ScannerPlugin {
  readonly name: string;
  readonly vendorId?: number;
  readonly productId?: number;
  /** Start listening. Calls onScan for each decoded scan event. */
  start(onScan: (event: ScannerEvent) => void): Promise<void>;
  /** Stop listening and release device handles */
  stop(): Promise<void>;
  /** Whether the scanner is currently active */
  readonly active: boolean;
}

// ──────────────────────────────────────────────────────────────────────
// Thermal Printer (receipt-style)
// ──────────────────────────────────────────────────────────────────────

/**
 * A print job for the thermal receipt printer.
 *
 * Implementation notes:
 * - Common thermal printers: Epson TM-T88, Star SP700, Bixolon SRP-275.
 * - Typically use ESC/POS protocol over USB serial or TCP/IP.
 * - Paper width is usually 58mm or 80mm.
 * - For USB printers on Linux, use /dev/usb/lp* or /dev/ttyUSB*.
 * - For network printers, use raw TCP socket on port 9100.
 */
export interface ThermalPrintJob {
  /** Lines of text to print. Each entry is one line. */
  lines: string[];
  /** Optional: cut paper after print (default: true) */
  cutPaper?: boolean;
  /** Optional: open cash drawer (default: false) */
  openDrawer?: boolean;
  /** Number of blank lines before the content (default: 1) */
  feedBefore?: number;
  /** Number of blank lines after the content (default: 2) */
  feedAfter?: number;
  /** Character encoding to use (default: 'cp437' for ESC/POS) */
  encoding?: string;
}

/**
 * A receipt or ticket that can be printed.
 *
 * Use cases:
 * - Print a diagnostic summary ticket to hand to the customer
 * - Print a device intake label/receipt
 * - Print a repair completion ticket
 */
export interface ReceiptData {
  /** Header text (e.g., shop name, address) */
  header?: string[];
  /** Body lines (diagnostic results, recommendations) */
  body: string[];
  /** Footer text (e.g., thank-you message) */
  footer?: string[];
  /** Barcode to print at the bottom of the receipt */
  barcode?: {
    type: 'CODE128' | 'EAN13' | 'UPCA' | 'CODE39';
    data: string;
    height?: number;
  };
}

/**
 * Contract for a thermal printer integration.
 */
export interface ThermalPrinterPlugin {
  readonly name: string;
  /** Connection type */
  readonly connectionType: 'usb' | 'ethernet' | 'bluetooth';
  /** Connection address (e.g., /dev/usb/lp0, 192.168.1.100:9100) */
  readonly address: string;
  /** Print a receipt/ticket */
  printReceipt(data: ReceiptData): Promise<void>;
  /** Print raw ESC/POS commands */
  printRaw(data: Uint8Array): Promise<void>;
  /** Get printer status (paper out, cover open, etc.) */
  getStatus(): Promise<{ ok: boolean; paperOut: boolean; coverOpen: boolean; error?: string }>;
  /** Test the printer by printing a small test page */
  test(): Promise<boolean>;
}

// ──────────────────────────────────────────────────────────────────────
// Label Printer
// ──────────────────────────────────────────────────────────────────────

/**
 * A label to be printed on a label printer (e.g., Brother QL, DYMO, Zebra).
 *
 * Implementation notes:
 * - Brother QL-series: uses Raster Command Set over USB.
 * - DYMO LabelWriter: uses DYMO SDK or raw USB.
 * - Zebra: uses ZPL over USB, serial, or network.
 * - Label printers are used for: SKU labels, asset tags, shelf labels.
 */
export interface LabelData {
  /** Text to print on the label (1-4 lines typically) */
  lines: string[];
  /** Optional: barcode to include (common on asset tags) */
  barcode?: string;
  /** Barcode format (default: 'CODE128') */
  barcodeType?: 'CODE128' | 'CODE39' | 'QR';
  /** Label width in mm (check printer specs) */
  widthMm: number;
  /** Label height in mm */
  heightMm: number;
  /** Orientation: 'landscape' or 'portrait' */
  orientation?: 'landscape' | 'portrait';
  /** Copies to print */
  copies?: number;
}

/**
 * Contract for a label printer integration.
 */
export interface LabelPrinterPlugin {
  readonly name: string;
  readonly connectionType: 'usb' | 'ethernet';
  /** Print one or more labels */
  printLabel(data: LabelData): Promise<void>;
  /** Print multiple labels (batch job) */
  printBatch(labels: LabelData[]): Promise<void>;
  /** Get printer status */
  getStatus(): Promise<{ ok: boolean; error?: string }>;
}

// ──────────────────────────────────────────────────────────────────────
// External Storage
// ──────────────────────────────────────────────────────────────────────

/**
 * An external storage device (USB drive, SD card) that can be used for
 * exporting/importing backups, reports, or diagnostic data.
 *
 * Implementation notes:
 * - USB drives appear as /dev/sda1, /dev/sdb1, etc. on Linux.
 * - Automount via udev rules or udisks.
 * - Detect mount events and offer the technician options to export.
 * - Must handle: device removal mid-operation, filesystem errors,
 *   insufficient space, and permission issues.
 */
export interface ExternalStorageDevice {
  /** Device identifier (e.g., /dev/sda1) */
  device: string;
  /** Mount point (e.g., /media/usb0) */
  mountPoint: string;
  /** Human-readable label (e.g., "USB Drive (64GB)") */
  label: string;
  /** Total capacity in bytes */
  totalBytes: number;
  /** Free space in bytes */
  freeBytes: number;
  /** Filesystem type (e.g., vfat, ext4, ntfs) */
  filesystem: string;
  /** Whether the device is writable */
  writable: boolean;
}

/**
 * Events emitted by the storage monitor for USB insert/remove.
 */
export interface StorageEvent {
  type: 'mounted' | 'unmounted';
  device: ExternalStorageDevice;
}

/**
 * Contract for external storage monitoring.
 */
export interface StorageMonitorPlugin {
  readonly name: string;
  /** Start monitoring for external storage events */
  start(onEvent: (event: StorageEvent) => void): Promise<void>;
  /** Stop monitoring */
  stop(): Promise<void>;
  /** List currently connected external storage devices */
  listDevices(): Promise<ExternalStorageDevice[]>;
  /** Write data to an external device */
  writeFile(device: ExternalStorageDevice, path: string, data: Buffer): Promise<void>;
  /** Read data from an external device */
  readFile(device: ExternalStorageDevice, path: string): Promise<Buffer>;
  /** Safely unmount a device */
  eject(device: ExternalStorageDevice): Promise<void>;
}

// ──────────────────────────────────────────────────────────────────────
// UPS Monitoring
// ──────────────────────────────────────────────────────────────────────

/**
 * UPS (Uninterruptible Power Supply) status for the Raspberry Pi.
 *
 * Implementation notes:
 * - Common Pi UPS HATs: UPS Pico, PiJuice, Mausberry, Waveshare UPS.
 * - Most provide I2C or GPIO-based status monitoring.
 * - Some use a serial protocol over UART.
 * - At minimum, detect: AC power status, battery level, low battery.
 * - The appliance should gracefully shut down on low battery to prevent
 *   filesystem corruption.
 */
export interface UpsStatus {
  /** Whether AC power is connected */
  onAcPower: boolean;
  /** Battery charge percentage (0-100), null if not available */
  batteryPercent: number | null;
  /** Battery voltage in volts, null if not available */
  batteryVoltage: number | null;
  /** Estimated minutes remaining on battery, null if unknown */
  minutesRemaining: number | null;
  /** Whether the battery is charging */
  charging: boolean;
  /** Raw sensor data from the UPS HAT */
  raw?: Record<string, unknown>;
}

/**
 * Severity levels for UPS alerts.
 */
export type UpsAlertSeverity = 'info' | 'warning' | 'critical';

/**
 * An alert event from the UPS monitor.
 */
export interface UpsAlert {
  severity: UpsAlertSeverity;
  message: string;
  status: UpsStatus;
}

/**
 * Contract for UPS monitoring integration.
 */
export interface UpsMonitorPlugin {
  readonly name: string;
  /** Compatible UPS HAT model names */
  readonly supportedModels: string[];
  /** Start monitoring. Periodically calls onStatusChange. */
  start(onStatusChange: (status: UpsStatus) => void, onAlert?: (alert: UpsAlert) => void): Promise<void>;
  /** Stop monitoring and release hardware resources */
  stop(): Promise<void>;
  /** Get current status immediately */
  getStatus(): Promise<UpsStatus>;
  /** Register a handler for graceful shutdown (e.g., when battery < 5%) */
  onShutdownRequest(handler: () => Promise<void>): void;
}
