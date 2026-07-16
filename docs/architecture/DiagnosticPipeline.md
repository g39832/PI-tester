# Diagnostic Pipeline Architecture

## Version 1 — Appliance

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│   WINDOWS PC (Booted from USB)         RASPBERRY PI 4/5 (Receiver)  │
│                                                                     │
│  ┌──────────────────────────┐       ┌──────────────────────────┐    │
│  │ DispoScan Collector      │       │ DispoScan Appliance      │    │
│  │ (WinPE environment)      │       │ (Node.js + React Kiosk)  │    │
│  │                          │       │                          │    │
│  │  ┌──────────────────┐   │       │  ┌──────────────────┐   │    │
│  │  │ Collection Engine│   │───────┼─▶│ WebSocket Server │   │    │
│  │  │ (PowerShell +    │   │       │  │ (ws://)          │   │    │
│  │  │ Native APIs)     │   │◀──────┼─│                    │   │    │
│  │  └──────────────────┘   │       │  └──────────────────┘   │    │
│  │         │               │       │         │               │    │
│  │  ┌──────────────────┐   │       │  ┌──────────────────┐   │    │
│  │  │ Discovery Client │   │       │  │ mDNS Responder   │   │    │
│  │  │ (mDNS query)     │───┼───────┼─▶│ (Avahi)          │   │    │
│  │  └──────────────────┘   │       │  └──────────────────┘   │    │
│  │                         │       │         │               │    │
│  │  USB DRIVE              │       │  ┌──────────────────┐   │    │
│  │  ┌──────────────────┐   │       │  │ Session Manager  │   │    │
│  │  │ collector.exe    │   │       │  │ (state machine)  │   │    │
│  │  │ collector.ps1    │   │       │  └──────────────────┘   │    │
│  │  │ payload.json     │   │       │         │               │    │
│  │  └──────────────────┘   │       │  ┌──────────────────┐   │    │
│  └──────────────────────────┘       │  │ Report Engine    │   │    │
│                                     │  │ (pdf-lib)        │   │    │
│                                     │  └──────────────────┘   │    │
│                                     │         │               │    │
│                                     │  ┌──────────────────┐   │    │
│                                     │  │ SQLite Store     │   │    │
│                                     │  │ (local history)  │   │    │
│                                     │  └──────────────────┘   │    │
│                                     └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                        Shop Wi-Fi (air-gapped LAN)
```

## 2. Bootable USB Environment

### 2.1 Environment Choice: WinPE

WinPE (Windows Preinstallation Environment) is the correct choice for the bootable diagnostic environment:

| Requirement | WinPE | Linux Live USB | Running Windows |
|---|---|---|---|
| WMI/CIM access | ✅ Full | ❌ None | ✅ Full |
| PowerShell | ✅ Full | ❌ | ✅ Full |
| Native API access (kernel) | ✅ Restricted | ✅ Full | ✅ Full |
| Antivirus interference | ✅ None | ✅ None | ❌ Blocked |
| Windows Registry | ✅ Partial | ❌ None | ✅ Full |
| File system access | ✅ Full | ✅ Full | ❌ Locked files |
| Boot on unbootable PC | ✅ Essential | ✅ | ❌ Cannot boot |
| Driver support | ✅ Broad (10+) | ❌ Limited | ✅ Full |

**Recommendation: WinPE 10+** booted from USB. The collector executable and PowerShell scripts are bundled on the USB drive alongside the WinPE image.

### 2.2 WinPE Limitations (Must Document)
- No Win32_Product WMI class (requires MSI installer service)
- Limited .NET Framework (4.x available but restricted)
- Some performance counters unavailable
- No Windows Update API (wuapi.dll not available)
- Event Log access through WMI (not direct API)
- Disk access locked during `chkdsk` or repair operations

### 2.3 USB Build Process
```bash
# On a Windows machine with ADK installed:
copype amd64 C:\WinPE_amd64
# Copy collector files into ISO
xcopy /s collector\* C:\WinPE_amd64\media\
# Build ISO
MakeWinPEMedia /iso C:\WinPE_amd64 C:\DispoScan_USB.iso
# Write to USB (Rufus or dd)
```

### 2.4 Auto-Launch
WinPE boots, executes `startnet.cmd` which:
1. Configures network (DHCP)
2. Launches `collector.exe` (or PowerShell collector script)
3. If collector exits, restarts or shuts down

## 3. Communication Protocol

### 3.1 Discovery — mDNS/DNS-SD
- Pi runs Avahi (Linux mDNS daemon) advertising `_disposcan._tcp` service
- Collector sends mDNS query for `_disposcan._tcp.local`
- Pi responds with hostname, IP address, port (3002)
- Service TXT record includes: `session=ABC123`, `version=1.0`
- **Fallback**: If mDNS fails, collector tries DHCP server address, gateway address, and a configurable static IP

### 3.2 Transport — WebSocket
- After discovery, collector opens WebSocket to `ws://<pi-ip>:3002/collect`
- Bi-directional JSON message protocol
- Binary transfer for large payloads (event logs, SMART data)
- Single connection per session

### 3.3 Message Protocol
```json
// Collector → Pi: Test result
{
  "type": "test_result",
  "testId": "cpu",
  "status": "complete",
  "data": { "model": "Intel Core i7-1365U", "cores": 10, "usage": 15, "temperature": 62 },
  "warnings": [],
  "duration": 1.2
}

// Collector → Pi: Progress update
{
  "type": "progress",
  "percent": 45,
  "currentTest": "RAM modules",
  "estimatedRemaining": 30
}

// Pi → Collector: Acknowledge
{
  "type": "ack",
  "testId": "cpu"
}

// Pi → Collector: Cancel
{
  "type": "cancel",
  "reason": "Connection lost — resuming"
}

// Collector → Pi: Session metadata
{
  "type": "session_meta",
  "deviceName": "DESKTOP-ABC123",
  "manufacturer": "Dell",
  "model": "Latitude 5420",
  "windowsVersion": "Windows 11 Pro"
}
```

### 3.4 Security Model (Air-Gapped)
- No TLS (air-gapped LAN, no internet)
- Session-bound random token prevents cross-connection
- Pi displays the session code, technician must confirm on collector
- Connection dropped if session code mismatches
- Rate limit: 1 concurrent session per Pi
- Physical security: Pi is in a locked shop

## 4. Session State Machine

```
                    ┌─────────────┐
                    │    IDLE     │
                    │ "Ready for  │
                    │ Diagnostic" │
                    └──────┬──────┘
                           │ mDNS query received
                           │ Collector connects
                           ▼
                    ┌─────────────┐
                    │  PAIRING    │──────── Session code mismatch
                    │ Display     │──────── → Close, back to IDLE
                    │ session code │
                    └──────┬──────┘
                           │ Code confirmed
                           ▼
                    ┌─────────────┐
                    │ COLLECTING  │◀──────── Test complete, next test
                    │ Live        │─────────→ Progress: "Testing CPU..."
                    │ streaming   │─────────→ Progress: "Testing RAM..."
                    └──────┬──────┘
                           │ All tests complete
                           ▼
                    ┌─────────────┐
                    │ PROCESSING  │
                    │ Generate    │
                    │ report      │
                    └──────┬──────┘
                           │ Report ready
                           ▼
                    ┌─────────────┐
                    │   REPORT    │
                    │ Full health │──── User taps "Save"
                    │ displayed   │
                    └──────┬──────┘
                           │ Saved / exported
                           ▼
                    ┌─────────────┐
                    │    IDLE     │
                    │ "Ready for  │
                    │ Diagnostic" │
                    └─────────────┘
```

## 5. Failure Recovery

### 5.1 Connection Drops
- Pi keeps session data in memory (last acknowledged test)
- Collector reconnects via WebSocket with `resume` flag
- Pi sends list of acknowledged test IDs
- Collector re-sends unacknowledged tests only
- **Timeout**: 5 minutes of inactivity → session marked `incomplete`, Pi returns to IDLE

### 5.2 Partial Data
- Each test is independently stored
- Incomplete tests shown with "⚠" indicator on report
- Report generated with available data; missing sections marked

### 5.3 Collector Crash
- Pi detects WebSocket close without completion message
- Pi stores partial session data
- Technician can connect another collector to resume (same session code) or start new session

### 5.4 Pi Reboot
- Session data persisted to SQLite on each `test_result` ack
- After reboot: no session recovery (new session started)
- Technician notified via report data loss warning

### 5.5 Network Disruption
- If Wi-Fi drops during collection, collector detects WebSocket failure
- Collector caches results in memory, retries connection every 3 seconds
- If Pi reappears within 5 minutes, resumes session
- After 5 minutes, collector marks session as `offline`, saves to USB for later upload (V2)

## 6. Report Generation

The Pi generates two report formats:

### 6.1 On-Screen Report (React UI)
- Touch-scrollable health overview
- Color-coded hardware cards (Green/Yellow/Red)
- Overall health score (0-100)
- Warnings and issues prominently displayed
- Technician recommendation text input

### 6.2 PDF Report (pdf-lib)
- Generated on demand
- Exported to USB drive or saved to Pi
- Structure: header with shop name → device info → hardware summary → health scores → warnings → recommendations → signature line
- No Chrome/Chromium dependency — pure JavaScript

## 7. Data Model (Simplified for Appliance)

```json
{
  "session": {
    "id": "uuid",
    "code": "ABC123",
    "status": "complete",
    "startedAt": "2026-07-15T10:00:00Z",
    "completedAt": "2026-07-15T10:05:00Z",
    "deviceName": "DESKTOP-ABC123",
    "manufacturer": "Dell",
    "model": "Latitude 5420"
  },
  "tests": [
    {
      "id": "cpu",
      "label": "CPU",
      "status": "complete",
      "health": "good",
      "data": { "model": "Intel Core i7-1365U", "cores": 10, "temperature": 62 },
      "warnings": [],
      "duration": 1.2
    }
  ],
  "healthScore": 85,
  "overall": "good",
  "technicianNote": ""
}
```

## 8. Hardware Requirements

| Component | Specification | Notes |
|---|---|---|
| Raspberry Pi | Pi 4 (2GB+) or Pi 5 | Pi 5 recommended for PDF perf |
| Touchscreen | Official 7" or Waveshare 5"/7" | Resistive or capacitive, 800x480+ |
| Storage | 32GB+ SD card or SSD | SSD via USB 3.0 preferred |
| Wi-Fi | Built-in (Pi 4/5) | 2.4/5 GHz, shop LAN |
| USB Boot Drive | 8GB+ USB 3.0 | WinPE + collector payload |
| Power | 5V 3A USB-C | Official Pi power supply |
| Case | 3D-printed or metal | Bench-mountable or portable |
