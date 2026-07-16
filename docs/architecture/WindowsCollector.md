# Windows Diagnostic Collector — Technical Reference

## Version 1 — WinPE Bootable Environment

---

## 1. Overview

This document is the authoritative reference for every diagnostic item the collector measures. Each entry documents: the Windows API or WMI class used, WinPE compatibility, permissions required, reliability, known limitations, and expected execution time.

**Collection environment:** WinPE 10/11 (booted from USB)
**Execution context:** SYSTEM (WinPE runs as SYSTEM by default)

---

## 2. Diagnostic Items

### 2.1 CPU Information

| Field | Method | Source |
|---|---|---|
| Model name | WMI | `Win32_Processor.Name` |
| Cores | WMI | `Win32_Processor.NumberOfCores` |
| Logical processors | WMI | `Win32_Processor.NumberOfLogicalProcessors` |
| Architecture | WMI | `Win32_Processor.Architecture` |
| Max clock speed | WMI | `Win32_Processor.MaxClockSpeed` |
| L2/L3 cache | WMI | `Win32_Processor.L2CacheSize`, `L3CacheSize` |
| Socket | WMI | `Win32_Processor.SocketDesignation` |

**WinPE:** ✅ Fully supported
**Elevation:** None (SYSTEM context)
**Execution time:** < 100ms
**Reliability:** Near 100%. `Win32_Processor` has existed since WMI inception.
**Limitations:** Temperature requires `Win32_PerfFormattedData_Counters_ThermalZoneInformation` which is **unreliable** in WinPE — prefer CPU-specific driver access or skip.

### 2.2 RAM Information

| Field | Method | Source |
|---|---|---|
| Total capacity | WMI | `Win32_PhysicalMemoryArray.MaxCapacity` or sum of `Win32_PhysicalMemory.Capacity` |
| Form factor | WMI | `Win32_PhysicalMemory.FormFactor` |
| Type | WMI | `Win32_PhysicalMemory.SMBIOSMemoryType` |
| Speed (MHz) | WMI | `Win32_PhysicalMemory.Speed` |
| Slots used | WMI | Count of `Win32_PhysicalMemory` instances |
| Slots total | WMI | `Win32_PhysicalMemoryArray.MemoryDevices` |
| Part number | WMI | `Win32_PhysicalMemory.PartNumber` |

**WinPE:** ✅ Fully supported
**Elevation:** None
**Execution time:** < 200ms
**Reliability:** Near 100%. SMBIOS data populated by BIOS/firmware.
**Limitations:** Memory type may show as "Unknown" (0) on some systems; fall back to SPD parsing.

### 2.3 Storage Information

| Field | Method | Source |
|---|---|---|
| Model | WMI | `Win32_DiskDrive.Model` |
| Interface type | WMI | `Win32_DiskDrive.InterfaceType` |
| Media type | WMI | `Win32_DiskDrive.MediaType` |
| Size (bytes) | WMI | `Win32_DiskDrive.Size` |
| Partitions | WMI | `Win32_DiskDrive.Partitions` |
| Firmware revision | WMI | `Win32_DiskDrive.FirmwareRevision` |
| Serial number | WMI | `Win32_DiskDrive.SerialNumber` |

**WinPE:** ✅ Supported (WinPE 10+ includes Storage WMI)
**Elevation:** None
**Execution time:** < 200ms
**Reliability:** High. Serial number may be whitespace-padded on some vendors.
**Limitations:** NVMe drives reported differently in older WinPE builds. WinPE 10+ supports Storage WMI classes. `Win32_DiskDrive.SerialNumber` may return spaces on some BIOS implementations.

### 2.4 SMART Health

| Field | Method | Source |
|---|---|---|
| Overall status | WMI | `Win32_DiskDrive.Status` |
| Predicted failure | WMI | `Win32_DiskDrive.StatusInfo` |
| SMART attributes | Native API | `IOCTL_ATA_PASS_THROUGH` / `IOCTL_STORAGE_QUERY_PROPERTY` |
| Temperature | SMART | Attribute 194 (C2) |
| Reallocated sectors | SMART | Attribute 5 (05) |
| Power-on hours | SMART | Attribute 9 (09) |
| Read error rate | SMART | Attribute 1 (01) |
| Start/stop count | SMART | Attribute 4 (04) |

**WinPE:** ⚠️ Partial
**Elevation:** Requires admin/SYSTEM (available in WinPE)
**Execution time:** 500-2000ms per drive (SMART commands are slow)
**Reliability:** SMART via WMI `Win32_DiskDrive.Status` is available but limited. Full SMART attribute reading requires `IOCTL_ATA_PASS_THROUGH` which works in WinPE but may fail on NVMe and USB-attached drives.
**Limitations:**
- NVMe drives use a different command set (`NVMe_*` SMART log pages)
- USB-to-SATA bridges frequently block or mangle SMART commands
- SSDs and HDDs use different SMART attribute sets — interpret accordingly
- Some OEM SSDs (Intel, Samsung) return proprietary attributes

**Recommendation:** Use `MSStorageDriver_FailurePredictStatus` WMI class for basic SSD health, and fall back to `IOCTL_STORAGE_QUERY_PROPERTY` for detailed SMART on NVMe.

### 2.5 SSD Remaining Life

| Field | Method | Source |
|---|---|---|
| Wear level | WMI | `MSStorageDriver_FailurePredictThreshold` / `FailurePredictStatus` |
| Remaining life | Native API | `IOCTL_STORAGE_QUERY_PROPERTY` → `STORAGE_PROPERTY_ID = StorageDeviceSeekPenaltyProperty` |
| Total bytes written | Native API | `IOCTL_STORAGE_PROTOCOL_COMMAND` for NVMe |
| Total bytes read | Native API | Same as above |

**WinPE:** ⚠️ Partial
**Elevation:** SYSTEM
**Execution time:** 300-1000ms
**Reliability:** Poor to moderate. Not all SSDs report wear level. NVMe drives have a standard log page for percentage used; SATA drives vary by vendor.
**Limitations:**
- NVMe: Standard log page (Percentage Used) is reliable in WinPE
- SATA SSD: Vendor-dependent. Intel, Samsung, Crucial report wear level via SMART attribute 177 (E7) or vendor-specific
- `MSStorageDriver` WMI class may not exist in WinPE

**Recommendation:** Collect what's available, mark as "N/A" if the drive doesn't report, and never show a false "healthy" for unreadable SMART data.

### 2.6 Battery Information

| Field | Method | Source |
|---|---|---|
| Battery present | WMI | `Win32_Battery` (check if instances exist) |
| Chemistry | WMI | `Win32_Battery.Chemistry` |
| Design capacity | WMI | `Win32_Battery.DesignCapacity` |
| Full charge capacity | WMI | `Win32_Battery.FullChargeCapacity` |
| Health percent | Calculated | `FullChargeCapacity / DesignCapacity * 100` |
| Cycle count | WMI | `Win32_Battery.CycleCount` (Win10+) |
| Manufacturer | WMI | `Win32_Battery.Manufacturer` |
| Serial number | WMI | `Win32_Battery.SerialNumber` |
| Current voltage | WMI | `Win32_Battery.Chemistry` → Status (less useful) |

**WinPE:** ✅ Supported (if battery present and driver loaded)
**Elevation:** None
**Execution time:** < 100ms
**Reliability:** High for desktop/laptop with battery present. `Win32_Battery` is reliable in WinPE 10+ using standard ACPI drivers.
**Limitations:**
- Desktop PCs without battery → no instances returned (not an error)
- Cycle count only available on Windows 10+ with updated ACPI driver
- Design vs. full charge may be equal on new batteries → 100% health
- Some Lenovo and Dell batteries report through proprietary ACPI methods not exposed to WMI

### 2.7 BIOS Information

| Field | Method | Source |
|---|---|---|
| Manufacturer | WMI | `Win32_BIOS.Manufacturer` |
| Version | WMI | `Win32_BIOS.SMBIOSBIOSVersion` |
| Date | WMI | `Win32_BIOS.ReleaseDate` |
| SMBIOS version | WMI | `Win32_BIOS.SMBIOSMajorVersion` + `MinorVersion` |
| Serial number | WMI | `Win32_BIOS.SerialNumber` |
| BIOS mode | WMI | `Win32_ComputerSystem.BootupState` |

**WinPE:** ✅ Fully supported
**Elevation:** None
**Execution time:** < 50ms
**Reliability:** Near 100%. `Win32_BIOS.SerialNumber` is populated from SMBIOS — this is the device's serial number.
**Limitations:** None significant. Virtual machines may report virtual BIOS manufacturer/version.

### 2.8 TPM Status

| Field | Method | Source |
|---|---|---|
| TPM present | WMI | `Win32_Tpm.IsEnabled_InitialValue` |
| TPM version | WMI | `Win32_Tpm.SpecVersion` |
| Is activated | WMI | `Win32_Tpm.IsActivated_InitialValue` |
| Is enabled | WMI | `Win32_Tpm.IsEnabled_InitialValue` |
| Is owned | WMI | `Win32_Tpm.IsOwned_InitialValue` |
| Manufacturer ID | WMI | `Win32_Tpm.ManufacturerId` |
| Physical presence | WMI | `Win32_Tpm.ManufacturerVersion` |

**WinPE:** ✅ Supported (WinPE 10+ includes TPM WMI provider)
**Elevation:** SYSTEM
**Execution time:** < 200ms
**Reliability:** Good. TPM 2.0 devices report reliably. `Win32_Tpm` class is available in WinPE 10 build 10240+.
**Limitations:**
- TPM 1.2 devices may not populate all fields
- BitLocker-related TPM ownership information not reliable in WinPE
- Virtual TPM (Hyper-V) may report differently

### 2.9 Secure Boot Status

| Field | Method | Source |
|---|---|---|
| Secure Boot state | WMI | `Win32_ComputerSystem.SecureBootState` or `Win32_BSDRelated` |
| Secure Boot supported | WMI | `Win32_ComputerSystem.SecureBootSupported` |

**WinPE:** ⚠️ Partial
**Elevation:** SYSTEM
**Execution time:** < 100ms
**Reliability:** Moderate. `Win32_ComputerSystem.SecureBootState` was unreliable in early WinPE 10 builds. UEFI firmware reports this via standard UEFI variable `SecureBoot` which can be read natively.
**Limitations:**
- Legacy BIOS boot → Secure Boot not applicable
- `SecureBootState` may be NULL even on modern hardware
- Read `SecureBoot` UEFI variable directly for most reliable result

**Recommendation:** Read UEFI variable directly via `GetFirmwareEnvironmentVariableA` API with `{8BE4DF61-93CA-11D2-AA0D-00E098032B8C}` GUID. Falls back to WMI if API fails.

### 2.10 Motherboard Information

| Field | Method | Source |
|---|---|---|
| Manufacturer | WMI | `Win32_BaseBoard.Manufacturer` |
| Product | WMI | `Win32_BaseBoard.Product` |
| Version | WMI | `Win32_BaseBoard.Version` |
| Serial number | WMI | `Win32_BaseBoard.SerialNumber` |

**WinPE:** ✅ Fully supported
**Elevation:** None
**Execution time:** < 50ms
**Reliability:** High. SMBIOS data from BIOS.
**Limitations:** Serial number may be "To be filled by O.E.M." on white-box systems, or "0" on some OEM boards.

### 2.11 GPU Information

| Field | Method | Source |
|---|---|---|
| Adapter name | WMI | `Win32_VideoController.Name` |
| RAM (MB) | WMI | `Win32_VideoController.AdapterRAM` |
| Driver version | WMI | `Win32_VideoController.DriverVersion` |
| Driver date | WMI | `Win32_VideoController.DriverDate` |
| Resolution | WMI | `Win32_VideoController.CurrentHorizontalResolution` x `CurrentVerticalResolution` |
| Chip type | WMI | `Win32_VideoController.VideoProcessor` |

**WinPE:** ⚠️ Partial
**Elevation:** None
**Execution time:** < 100ms
**Reliability:** Moderate. WinPE includes basic display drivers. `Win32_VideoController` is available but may only list the basic Microsoft Basic Display Adapter, not the actual GPU.
**Limitations:**
- In WinPE, only the basic display driver is loaded. GPU name will be "Microsoft Basic Display Adapter" on most systems
- Actual GPU detection requires the full GPU driver, which is not loaded in WinPE
- `AdapterRAM` may report 0 in WinPE

**Recommendation:** Accept this limitation. GPU detection in WinPE is inherently limited. The device's actual GPU can be identified by reading PCI configuration space hardware IDs (`PCI\VEN_...`) and looking them up against a local database.

### 2.12 Windows Version (Bootable Environment Context)

| Field | Method | Source |
|---|---|---|
| WinPE version | Registry | `HKLM\Software\Microsoft\Windows NT\CurrentVersion` |
| Build number | Registry | `CurrentBuild` |
| UBR | Registry | `UBR` (Update Build Revision) |
| WinPE flavor | Registry | `InstallationType` → "WinPE" |

**WinPE:** ✅ Fully supported (we're reading the WinPE environment)
**Execution time:** < 50ms
**Note:** This reports the WinPE build version, NOT the installed Windows version on the hard drive. The installed Windows version must be read from the offline SYSTEM registry hive on disk.

**Offline Windows version detection (from WinPE):**
```registry
Load HKEY_LOCAL_MACHINE\OfflineWindows ..\Windows\System32\config\SOFTWARE
Read: OfflineWindows\Microsoft\Windows NT\CurrentVersion\{CurrentBuild, DisplayVersion, EditionID, ProductName}
Unload hive
```

**Limitations:** Reading the offline registry requires mounting the SYSTEM hive. The target drive may be encrypted (BitLocker) or unbootable. If BitLocker is active, the drive is inaccessible without the recovery key.

### 2.13 Event Viewer — Critical Events

| Field | Method | Source |
|---|---|---|
| Critical events (System) | WMI | `Win32_NTLogEvent WHERE LogFile='System' AND Type='Error' OR Type='Critical'` |
| Critical events (Application) | WMI | Same query on Application log |
| Critical events (HardwareEvents) | WMI | Same query on HardwareEvents log |
| BugCheck events | WMI | `Win32_NTLogEvent WHERE LogFile='System' AND EventCode=1001` |
| Filter by timeframe | WMI | `TimeGenerated > (Now - 30 days)` |

**WinPE:** ⚠️ Partial
**Elevation:** SYSTEM
**Execution time:** 1000-5000ms (event log queries are slow over WMI)
**Reliability:** Good when the event log files are accessible. In WinPE, the **current** machine's event log belongs to WinPE (not the installed OS). To read the installed OS's event log, we must read the offline hive files.

**Offline event log access (from WinPE):**
```powershell
# Event logs stored at:
# C:\Windows\System32\winevt\Logs\*.evtx (on the installed Windows partition)
# WinPE maps a drive letter to the Windows partition
# Use wevtutil.exe to query offline logs:
wevtutil.exe qe System /lf:C:\Windows\System32\winevt\Logs\System.evtx /c:100 /q:"*[System[(Level=1 or Level=2) and TimeCreated[timediff(@SystemTime) <= 2592000000]]]"
```

**Limitations:**
- Requires BitLocker-off (or recovery key) to access the System partition
- `.evtx` files may be locked if the OS was improperly shut down
- Large event logs will slow down parsing — limit to last 30 days
- Event log query syntax (`XPath 1.0`) is non-intuitive and error-prone

### 2.14 Blue Screen History

| Field | Method | Source |
|---|---|---|
| BugCheck codes | Registry | `HKLM\SYSTEM\CurrentControlSet\Control\CrashControl\Minidump` (offline) |
| Most recent BSoD | Reg/WMI | `HKLM\SYSTEM\CurrentControlSet\Control\CrashControl` or WMI event 1001 |
| Minidump files | File | `C:\Windows\Minidump\*.dmp` |

**WinPE:** ✅ Supported (file-based, read offline registry)
**Elevation:** SYSTEM
**Execution time:** 200-500ms (checking minidump file listing + registry)
**Reliability:** Good when minidumps are enabled (default on Windows). BugCheck history via registry is reliable.
**Limitations:**
- If minidumps are disabled (some IT-managed systems), no crash dump available
- BugCheck codes stored in registry don't include the full error parameters (for that, parse the .dmp file — impractical in V1)
- Only the last crash is recorded in `LastCrashTime` — for history, enumerate minidump filenames

### 2.15 Pending Windows Updates

| Field | Method | Source |
|---|---|---|
| Pending updates | Offline registry | `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate` |
| Update status | Offline registry | `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\PackagesPending` |
| Last check time | Offline registry | `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\LastWaitTimeout` |

**WinPE:** ⚠️ Partial
**Elevation:** SYSTEM
**Execution time:** 100-300ms
**Reliability:** Poor. The Windows Update API (`wuapi.dll`) is not available in WinPE. Offline registry reading is the only option, and it only reveals partial state.
**Limitations:**
- Cannot query the WU server (no network to MS, no API available)
- `Component Based Servicing` keys indicate pending CBS operations (component installs/removals)
- Cannot distinguish "updates available but not downloaded" from "no updates needed"
- Best effort: report "Unable to check" with the pending CBS info

### 2.16 Driver Issues

| Field | Method | Source |
|---|---|---|
| Problem devices | Win32 API | `SetupDiGetClassDevs` + `CM_Get_DevNode_Status` |
| Device status code | Win32 API | `CR_GET_STATUS` → problem code |
| Device description | Win32 API | `SPDRP_DEVICEDESC` |
| Hardware IDs | Win32 API | `SPDRP_HARDWAREID` |

**WinPE:** ✅ Supported (Windows Setup API is available in WinPE)
**Elevation:** SYSTEM
**Execution time:** 500-2000ms (enumerating all devices)
**Reliability:** Good. The Setup API is available and reliable in WinPE. Problem codes (CM_PROB_*) are well-documented.
**Limitations:**
- WinPE only loads basic drivers + network. Missing drivers for GPU, audio, wireless, etc. will show as problem devices even though they are NOT issues on the installed Windows OS.
- **Critical distinction**: We are seeing the WinPE driver state, not the installed Windows driver state. These are different driver stores.

**Recommendation:** Only report devices with problem codes that WinPE's drivers should cover (storage, basic display, network). Mark all other "missing driver" warnings as "WinPE environment — may differ from installed OS."

### 2.17 SFC (System File Checker) Results

| Field | Method | Source |
|---|---|---|
| SFC result | CBS log | `C:\Windows\Logs\CBS\CBS.log` (offline) |
| Corrupt files | CBS log | Parse for `[SR]` entries with `Repair` or `Cannot repair` |
| Last SFC scan | Registry | Check `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing` |

**WinPE:** ⚠️ Partial
**Elevation:** SYSTEM
**Execution time:** 200-500ms (parsing CBS log)
**Reliability:** Poor. `sfc /scannow` cannot be run from WinPE against the offline OS (it scans the running OS). The CBS log provides history of past SFC scans.
**Limitations:**
- Cannot run SFC from WinPE (it operates on the active Windows installation)
- CBS log may be gigabytes — must limit to last N KB and parse only the tail
- Cannot distinguish "no corruption found" from "no SFC scan ever run"

**Recommendation:** Parse the last 1MB of `CBS.log` for `[SR]` entries. Report: "Last SFC scan: [date]. Corrupt files found: [N]. Repaired: [N]. Unrepairable: [N]." If no CBS entries found, report as "No SFC scan history found."

### 2.18 DISM (Deployment Imaging) Results

| Field | Method | Source |
|---|---|---|
| Image health state | DISM log | `C:\Windows\Logs\DISM\dism.log` (offline) |
| Last DISM operation | DISM log | Parse for restore health / check health operations |

**WinPE:** ⚠️ Partial (same constraints as SFC)
**Execution time:** 200-500ms
**Reliability:** Poor. Same fundamental issue: DISM cannot be run against an offline image from WinPE (well, it can with `/Image:` flag, but requires lengthy operation).
**Limitations:**
- Cannot run `DISM /Online /Cleanup-Image /RestoreHealth` from WinPE
- DISM log from the installed OS shows past operations only
- Source (`/Source:`) may be unavailable without Windows installation media

**Recommendation:** Same as SFC — parse log, report history. Offer "Run DISM from booted Windows" recommendation.

### 2.19 Storage Errors (Disk Issues)

| Field | Method | Source |
|---|---|---|
| Disk errors (System log) | Event log | Event ID 7, 50, 51, 55, 153, 157 (disk, ntfs, storahci) |
| CHKDSK results | Event log | Event ID 1001 (Winlogon) or 26226 (chkdsk) |
| Pending disk repairs | Registry | PendingFileRenameOperations (for chkdsk pending) |

**WinPE:** ⚠️ Partial (offline event log)
**Execution time:** 500-2000ms
**Reliability:** Moderate. Disk error events in the System log are reliable indicators of storage subsystem issues.
**Limitations:**
- Offline event log reading required (same as section 2.13)
- Event ID interpretation is version-specific
- Some SSD/NVMe errors go to a different channel (StorNVMe event source)

### 2.20 CPU Temperatures

| Field | Method | Source |
|---|---|---|
| CPU temperature | WMI | `Win32_PerfFormattedData_Counters_ThermalZoneInformation` |
| CPU temperature | Native | `IA32_THERM_STATUS_MSR` (MSR 0x19C) via `__readmsr` or `WmiThermalZone` |

**WinPE:** ❌ Unreliable
**Execution time:** 100-500ms
**Reliability:** Poor. WMI thermal zone information is frequently not populated in WinPE because the ACPI thermal zone driver may not be loaded.
**Limitations:**
- Not all CPUs expose MSR temperature registers to ring-3 applications
- Reading MSRs requires kernel-mode driver or `Rdmsr` instruction (privileged)
- Different CPU vendors (Intel vs. AMD) have different MSR layouts
- Core distance (package temp vs. individual core temps) requires per-core MSR reading

**Recommendation:** Accept that temperature reading from WinPE is unreliable. Defer to a booted Windows diagnostic. If available, use `WmiThermalZone` and mark as "may not be available in bootable environment."

### 2.21 SSD Temperatures

| Field | Method | Source |
|---|---|---|
| Drive temperature | SMART | SMART attribute 194 (C2) or 190 (BE) |
| NVMe temperature | NVMe | NVMe SMART log page, temperature field |

**WinPE:** ✅ Supported (via SMART)
**Execution time:** 300-1000ms
**Reliability:** Good for SATA/NVMe drives that support SMART. Same constraints as section 2.4 — full SMART requires `IOCTL_ATA_PASS_THROUGH`.
**Limitations:**
- USB-attached drives usually don't report SMART
- Some drives report temperature in Kelvin, others in Celsius — check attribute range

### 2.22 Network Adapters

| Field | Method | Source |
|---|---|---|
| Name | WMI | `Win32_NetworkAdapter.Name WHERE PhysicalAdapter=True` |
| MAC address | WMI | `Win32_NetworkAdapter.MACAddress` |
| Speed | WMI | `Win32_NetworkAdapter.Speed` |
| DHCP enabled | WMI | `Win32_NetworkAdapterConfiguration.DHCPEnabled` |
| IP address | WMI | `Win32_NetworkAdapterConfiguration.IPAddress` |
| DNS servers | WMI | `Win32_NetworkAdapterConfiguration.DNSServerSearchOrder` |

**WinPE:** ✅ Supported (network stack loaded in WinPE)
**Elevation:** None
**Execution time:** 200-500ms
**Reliability:** Good. Network adapters are enumerated correctly. WinPE network stack includes standard NDIS drivers.
**Limitations:**
- Wireless adapters may need drivers injected into WinPE
- Some USB-to-Ethernet adapters may not have built-in WinPE drivers
- Speed may report as -1 for wireless adapters

### 2.23 Installed Drives (File System)

| Field | Method | Source |
|---|---|---|
| Drive letter | WMI | `Win32_LogicalDisk.DeviceID` |
| Volume label | WMI | `Win32_LogicalDisk.VolumeName` |
| File system | WMI | `Win32_LogicalDisk.FileSystem` |
| Total space | WMI | `Win32_LogicalDisk.Size` |
| Free space | WMI | `Win32_LogicalDisk.FreeSpace` |
| Drive type | WMI | `Win32_LogicalDisk.DriveType` (3=local, 4=network, 5=CD) |
| BitLocker status | WMI | `Win32_EncryptableVolume.ProtectionStatus` |

**WinPE:** ✅ Supported (basic disk access available)
**Elevation:** SYSTEM
**Execution time:** 200-500ms
**Reliability:** Good. WinPE assigns drive letters to accessible partitions. Boot and system partitions are visible.
**Limitations:**
- BitLocker-encrypted drives appear as raw partitions without a drive letter
- Dynamic disks may not show logical drives correctly
- Storage Spaces and ReFS volumes may not be fully enumerated

---

## 3. Collection Time Budget

| Test | Max Time | Parallel? | Cumulative |
|---|---|---|---|
| CPU | 0.5s | ✅ | 0.5s |
| RAM | 0.5s | with CPU | 1s |
| Storage (enum) | 0.5s | with CPU | 1s |
| SMART + SSD life | 3s per drive | Sequential (IOCTL) | 4s (1 drive) |
| Battery | 0.3s | ✅ | 4.3s |
| BIOS + Motherboard | 0.2s | with CPU | 4.5s |
| TPM + Secure Boot | 0.5s | with CPU | 5s |
| GPU | 0.3s | with CPU | 5.3s |
| Event logs | 5s | Sequential (file I/O) | 10.3s |
| BSoD history | 0.5s | with logs | 10.8s |
| Pending updates | 0.5s | with logs | 11.3s |
| Driver issues | 2s | with logs | 13.3s |
| SFC + DISM | 1s | with logs | 14.3s |
| Storage errors | 1s | with logs | 15.3s |
| Temperatures | 1s | with SMART | 16.3s |
| Network adapters | 0.5s | with CPU | 16.8s |
| Installed drives | 0.5s | with CPU | 17.3s |

**Total estimated: 15-20 seconds** for a typical system with 1-2 drives, streaming results live as each test completes.

---

## 4. Collector Architecture

```
collector.exe or collector.ps1
├── 1. Network Discovery
│   └── mDNS query for _disposcan._tcp.local
├── 2. Session Handshake
│   ├── Display session code from Pi
│   └── Wait for technician confirmation
├── 3. Start Diagnostic Collection
│   ├── Send session_meta (device info)
│   ├── Test 1: CPU (parallel group)
│   ├── Test 2: RAM (parallel group)
│   ├── Test 3: GPU (parallel group)
│   ├── Test 4: Network (parallel group)
│   ├── Test 5: Mainboard (parallel group)
│   ├── Test 6: Drives (parallel group)
│   ├── Test 7: Storage + SMART (sequential, per drive)
│   ├── Test 8: Battery (single)
│   ├── Test 9: BIOS + TPM + Secure Boot (parallel group)
│   ├── Test 10: Offline Registry Mount
│   ├── Test 11: Event Logs (offline parse)
│   ├── Test 12: Driver Status
│   ├── Test 13: SFC + DISM Log Parse
│   ├── Test 14: BSoD + Storage Errors
│   └── Send completion signal
├── 4. Await Acknowledgment
├── 5. Display "Remove USB, shutdown" prompt
└── 6. Exit (WinPE reboots)
```

## 5. Known Unreliable Items (From WinPE)

| Item | Reason | Fallback |
|---|---|---|
| GPU details | Basic display driver only | Read PCI hardware IDs |
| CPU temperature | ACPI thermal zone often missing | Report "N/A in bootable environment" |
| SSD wear level | Vendor-specific SMART | Report only when available |
| Update status | No WU API | Report offline parsable data only |
| Driver health | WinPE != installed OS | Mark "WinPE environment" caveat |
| SFC results | Cannot run offline | Parse history only |
| DISM results | Cannot run offline | Parse history only |
| BitLocker status | Encrypted drive inaccessible | Report "Likely encrypted" when drive is raw |
