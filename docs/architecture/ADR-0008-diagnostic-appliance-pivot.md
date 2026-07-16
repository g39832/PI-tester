# ADR-0008: Pivot from Web Dashboard to Diagnostic Appliance

## Status
Accepted

## Context
DDS was originally designed as a web application with technician accounts, customer CRM, and a browser-based dashboard. This model assumed a technician would interact with a general-purpose web browser on a desktop PC or tablet. However, the deployment environment — a busy computer repair shop — demands a dedicated, appliance-like experience. A technician should not log in, navigate menus, or manage browser tabs. They should press a button on a touchscreen and get results.

Additionally, the original design assumed the diagnostic collector runs inside a running Windows installation (PowerShell script). This is fragile: antivirus may block it, permissions may prevent execution, and the target machine may be unbootable — the very reason it's in for repair.

## Options Considered

| Option | Description |
|---|---|
| Web dashboard (original) | Angular/React SPA, user accounts, browser-based |
| Hybrid (web + kiosk) | Same backend, add a kiosk frontend mode |
| Dedicated appliance | Fullscreen kiosk on Raspberry Pi touchscreen, no browser chrome, no login |

## Chosen Solution
**Dedicated appliance.** The Raspberry Pi boots directly into the DispoScan interface. The display is a touchscreen. There is no login screen, no browser chrome, no URL bar, no multi-user concept. The collector runs from a bootable USB drive (WinPE-based), not from within a running Windows installation.

### Key Changes

| Aspect | Before (Web) | After (Appliance) |
|---|---|---|
| Primary interface | Browser web app | Touchscreen kiosk (fullscreen, no chrome) |
| Authentication | JWT login required | No auth (air-gapped, physical access) |
| Diagnostic collection | PowerShell script inside Windows | Bootable USB WinPE environment |
| Data transport | HTTP POST (upload on complete) | WebSocket (live streaming per-test) |
| Network discovery | Manual IP/URL entry | mDNS/DNS-SD automatic discovery |
| Session concept | Implicit (page load) | Explicit state machine (idle→collecting→report) |
| Multi-user | Technician accounts | Single-user (the technician using the device) |
| Customer data | CRM with addresses/phone | Minimal: device + shop ticket number |
| Offline mode | Optional | Mandatory — fully air-gapped |
| Frontend framework | React SPA with routing | React kiosk with single-screen state machine |

## Reasons
1. **Physical security model** — The Pi sits on a repair bench in a locked shop. Only staff have physical access. No login needed. This eliminates auth complexity and failure points.
2. **Bootable USB reliability** — Running from WinPE guarantees: no antivirus interference, no permission issues, no dependency on a functional Windows install, access to raw hardware (SMART, temperatures, disk info) without driver complications.
3. **Live streaming UX** — Technicians want to see progress as it happens, not wait for a single upload at the end. WebSocket streaming provides immediate feedback.
4. **Zero-config discovery** — mDNS eliminates IP address management. The collector finds the Pi automatically on the shop LAN.
5. **Snap-on/Autel design language** — Automotive diagnostic tools set the UX expectation: turn on, use, get results. No boot time, no login, no configuration.

## Tradeoffs
- **USB dependency** — Technician must have the bootable USB drive. Replacements must be provisioned. Mitigated by writing the USB once and keeping it with the Pi.
- **WinPE constraints** — WinPE is a restricted environment. Some WMI classes, COM objects, and PowerShell modules may not be available. Mitigated by testing the collector against real hardware.
- **No remote access** — Cannot troubleshoot or view reports off-site. Mitigated by local network access and future V2 export-to-USB feature.
- **Single-user** — No audit trail of which technician ran a diagnostic. Mitigated by physical presence in the shop.

## Future Considerations
- If cloud sync is added in V2+, session data can be uploaded from the Pi to a central server when internet is available
- If multi-shop is needed in V3+, each Pi becomes a node in a fleet, managed by a cloud control plane
- The bootable USB can eventually be extended to include repair tools (disk wipe, memory test, stress test)
