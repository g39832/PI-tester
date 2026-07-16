# Risk Analysis — Diagnostic Appliance V1

## Version 1

---

## 1. Risk Register

### R1 — WinPE WMI Class Availability

| Attribute | Value |
|---|---|
| **Risk** | WMI classes used by the collector may not be available or fully functional in the WinPE boot environment |
| **Likelihood** | HIGH |
| **Impact** | HIGH — missing WMI classes cause test failures or missing data |
| **Affected tests** | GPU (basic display driver only), CPU temperature (ACPI thermal zone), SSD wear (vendor-specific SMART), event logs (offline .evtx parsing) |
| **Mitigation** | Document known limitations per test (see WindowsCollector.md). Implement graceful fallbacks: if WMI returns no data, skip test and mark "unavailable in boot environment." Do NOT fail the entire session. Run tests on 10+ different machines (Dell, HP, Lenovo, custom-built) before shipping. |

### R2 — BitLocker-Encrypted Drives

| Attribute | Value |
|---|---|
| **Risk** | The target drive is BitLocker-encrypted. WinPE cannot mount the partition, cannot read offline registry, event logs, or CBS logs. |
| **Likelihood** | MEDIUM-HIGH |
| **Impact** | HIGH — offline data (registry version, event logs, SFC/DISM history, updates) is inaccessible |
| **Affected tests** | Windows version (offline), Event logs, SFC, DISM, update history, BSoD history |
| **Mitigation** | Detect BitLocker via `manage-bde -status` or raw partition table. If encrypted: report "Drive is BitLocker-encrypted. Run diagnostic from within Windows." Collect all hardware-only tests (CPU, RAM, storage model, SMART, battery, etc.) — approximately 70% of diagnostics are still available. |

### R3 — Collector Discovery Failure

| Attribute | Value |
|---|---|
| **Risk** | The Windows collector cannot discover the Pi on the local network (mDNS blocked, no DHCP, network misconfiguration, wrong subnet) |
| **Likelihood** | MEDIUM |
| **Impact** | MEDIUM — technician must manually configure |
| **Mitigation** | Implement multi-layered discovery: (1) mDNS, (2) gateway scan (common subnets), (3) manual IP entry prompt. Implement Pi Wi-Fi AP fallback mode: Pi creates its own ad-hoc network, collector connects to "DispoScan" SSID directly. Provide instructions on the Pi screen. |

### R4 — WebSocket Connection Drops Mid-Collection

| Attribute | Value |
|---|---|
| **Risk** | Wi-Fi interference, range, or interference causes WebSocket disconnection during active collection |
| **Likelihood** | MEDIUM |
| **Impact** | MEDIUM — partial data, technician frustration |
| **Affected tests** | All in-progress tests |
| **Mitigation** | Implement reconnection protocol (see CommunicationProtocol.md). Collector retries 3 times with exponential backoff. Pi keeps acknowledged data. On reconnect, resume from last ack. If 5 minutes pass, collect partial data and display "Connection Lost — Partial Report" on Pi. |

### R5 — SMART IOCTL Failure on NVMe/USB Drives

| Attribute | Value |
|---|---|
| **Risk** | SMART data cannot be read via `IOCTL_ATA_PASS_THROUGH` on NVMe drives or USB-attached drives |
| **Likelihood** | HIGH |
| **Impact** | MEDIUM — missing SMART data reduces diagnostic depth |
| **Affected tests** | SMART health, SSD remaining life, drive temperatures |
| **Mitigation** | Use `IOCTL_STORAGE_QUERY_PROPERTY` for NVMe standard log pages. For USB drives, try `IOCTL_STORATE_QUERY_PROPERTY` with `StorageDeviceSeekPenaltyProperty` first, fall back to "not available on USB-attached drive." Never display a false "healthy" when data is unavailable — show "SMART: Not Available" instead. |

### R6 — USB Boot Failures

| Attribute | Value |
|---|---|
| **Risk** | The target PC cannot boot from USB (Secure Boot blocking, legacy BIOS configured for HDD only, broken USB port, incompatible WinPE image) |
| **Likelihood** | MEDIUM |
| **Impact** | CRITICAL — the collector cannot start; diagnostic not possible |
| **Mitigation** | Provide clear instructions on the Pi screen for entering BIOS boot menu. Build WinPE image with both UEFI and legacy BIOS boot support. Test on 15+ different PC models. Include recovery instructions for common boot failures. |

### R7 — WinPE Lacks Required Network Drivers

| Attribute | Value |
|---|---|
| **Risk** | The target PC's Wi-Fi or Ethernet adapter is not supported by built-in WinPE drivers, making it unable to connect to the Pi |
| **Likelihood** | MEDIUM-HIGH (especially for Wi-Fi) |
| **Impact** | CRITICAL — no network = no communication |
| **Mitigation** | Inject common network drivers into the WinPE image (Realtek, Intel, Broadcom, Qualcomm Atheros — top 10 vendors cover ~90% of devices). For Wi-Fi, include a USB-to-Ethernet adapter as fallback in the kit. Detect network failure and prompt: "Connect Ethernet cable or use provided USB adapter." |

### R8 — Raspberry Pi 4 Performance

| Attribute | Value |
|---|---|
| **Risk** | The Raspberry Pi 4 (2GB) cannot handle concurrent WebSocket data, PDF generation, and SQLite writes without noticeable delay |
| **Likelihood** | LOW-MEDIUM |
| **Impact** | MEDIUM — slow PDF generation, UI lag |
| **Affected modules** | Backend + Report Engine |
| **Mitigation** | Profile during Phase H (integration). If PDF generation takes >5 seconds, move it to an async queue with progress indicator. Use Pi 5 if Pi 4 is too slow. Use SSD instead of SD card for better I/O. |

### R9 — Report Data Too Large for PDF

| Attribute | Value |
|---|---|
| **Risk** | Event log parsing yields gigabytes of data, making the PDF report enormous |
| **Likelihood** | MEDIUM |
| **Impact** | LOW — truncated report is still useful |
| **Mitigation** | Limit event log extraction to last 30 days and top 100 critical/error events. Truncate CBS log to last 1MB. Never embed full raw data in PDF — use summaries with "view full log on Pi" notes. |

### R10 — Touchscreen Calibration/Responsiveness

| Attribute | Value |
|---|---|
| **Risk** | The Pi touchscreen (resistive or capacitive) is unresponsive, inaccurate, or the UI targets are too small for gloved use |
| **Likelihood** | MEDIUM |
| **Impact** | MEDIUM — technician frustration, UI unusability |
| **Affected modules** | Frontend UI |
| **Mitigation** | All touch targets ≥56px (prefer 64px). Test with gloves (latex, nitrile, mechanic's gloves). Provide calibration tool. Consider larger screen (10" HDMI) as alternative. Support hardware buttons if available. |

---

## 2. Risk Summary

| Risk | Likelihood | Impact | Priority |
|---|---|---|---|
| R1 — WinPE WMI limitations | HIGH | HIGH | CRITICAL |
| R2 — BitLocker encryption | MED-HIGH | HIGH | HIGH |
| R5 — SMART NVMe failures | HIGH | MED | HIGH |
| R7 — Network driver gaps | MED-HIGH | CRITICAL | CRITICAL |
| R3 — Discovery failure | MED | MED | MEDIUM |
| R4 — Connection drops | MED | MED | MEDIUM |
| R6 — USB boot failure | MED | CRITICAL | HIGH |
| R8 — Pi performance | LOW-MED | MED | LOW |
| R9 — Large PDF data | MED | LOW | LOW |
| R10 — Touchscreen issues | MED | MED | MEDIUM |

### Top 3 Risks to Address Before Shipping

1. **R7 (Network drivers)** — Build and test the WinPE image with the broadest possible network driver set. Test on 15+ machines.
2. **R1 (WinPE WMI)** — Run the collector against 10+ machines in WinPE. Document every WMI class that fails. Build fallbacks now.
3. **R2 (BitLocker)** — Implement BitLocker detection and graceful degradation. Handle the "70% diagnostic" case.

---

## 3. Contingency Plans

| Failure Mode | Contingency |
|---|---|
| WinPE cannot collect at all | Ship Pi with pre-written instructions for running collector inside Windows (PowerShell script fallback) |
| Pi 4 is too slow | Upgrade target to Pi 5 ($80 → $80, no architecture change) |
| mDNS not working | Ship with pre-configured static IP + USB serial console for Pi setup |
| PDF library limitations | Replace pdf-lib with a headless Chromium approach (only if pdf-lib proves insufficient — see ADR-0009) |
| USB cannot boot | Provide alternative: technician types results manually into Pi touchscreen form (basic mode) |
