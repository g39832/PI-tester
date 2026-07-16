/**
 * DispoScan Extension Registry
 *
 * Central registry for all hardware extension plugins.
 * Core code should never import extension types directly.
 * Instead, extensions register themselves here, and core code
 * queries the registry when it needs to interact with hardware.
 *
 * Usage (by extension implementations):
 *   import { extensionRegistry } from '../extensions/extensionRegistry.js';
 *   extensionRegistry.registerScanner(myScannerPlugin);
 *
 * Usage (by core code, e.g., kiosk workflow):
 *   const scanner = extensionRegistry.getScanner();
 *   if (scanner) { scanner.start(handleScan); }
 *
 * All methods are optional — if no implementation is registered,
 * the getter returns null and the system continues without that feature.
 */

import type { ScannerPlugin, ThermalPrinterPlugin, LabelPrinterPlugin, StorageMonitorPlugin, UpsMonitorPlugin } from './types.js';

interface RegisteredExtensions {
  scanner: ScannerPlugin | null;
  thermalPrinter: ThermalPrinterPlugin | null;
  labelPrinter: LabelPrinterPlugin | null;
  storageMonitor: StorageMonitorPlugin | null;
  upsMonitor: UpsMonitorPlugin | null;
}

const extensions: RegisteredExtensions = {
  scanner: null,
  thermalPrinter: null,
  labelPrinter: null,
  storageMonitor: null,
  upsMonitor: null,
};

export const extensionRegistry = {
  // ── Scanner ──────────────────────────────────────────────────────
  registerScanner(plugin: ScannerPlugin): void {
    extensions.scanner = plugin;
  },
  getScanner(): ScannerPlugin | null {
    return extensions.scanner;
  },

  // ── Thermal Printer ─────────────────────────────────────────────
  registerThermalPrinter(plugin: ThermalPrinterPlugin): void {
    extensions.thermalPrinter = plugin;
  },
  getThermalPrinter(): ThermalPrinterPlugin | null {
    return extensions.thermalPrinter;
  },

  // ── Label Printer ───────────────────────────────────────────────
  registerLabelPrinter(plugin: LabelPrinterPlugin): void {
    extensions.labelPrinter = plugin;
  },
  getLabelPrinter(): LabelPrinterPlugin | null {
    return extensions.labelPrinter;
  },

  // ── Storage Monitor ─────────────────────────────────────────────
  registerStorageMonitor(plugin: StorageMonitorPlugin): void {
    extensions.storageMonitor = plugin;
  },
  getStorageMonitor(): StorageMonitorPlugin | null {
    return extensions.storageMonitor;
  },

  // ── UPS Monitor ─────────────────────────────────────────────────
  registerUpsMonitor(plugin: UpsMonitorPlugin): void {
    extensions.upsMonitor = plugin;
  },
  getUpsMonitor(): UpsMonitorPlugin | null {
    return extensions.upsMonitor;
  },

  /** List all registered extensions (useful for diagnostics) */
  listRegistered(): string[] {
    const registered: string[] = [];
    if (extensions.scanner) registered.push(`scanner: ${extensions.scanner.name}`);
    if (extensions.thermalPrinter) registered.push(`thermalPrinter: ${extensions.thermalPrinter.name}`);
    if (extensions.labelPrinter) registered.push(`labelPrinter: ${extensions.labelPrinter.name}`);
    if (extensions.storageMonitor) registered.push(`storageMonitor: ${extensions.storageMonitor.name}`);
    if (extensions.upsMonitor) registered.push(`upsMonitor: ${extensions.upsMonitor.name}`);
    return registered;
  },
};
