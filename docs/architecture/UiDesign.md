# Touchscreen Appliance UI Design

## Version 1 — Diagnostic Appliance

---

## 1. Design Language

**Reference:** Snap-on MODIS, Autel MaxiSys, Bosch ADS — premium automotive diagnostic tools.

**Principles:**
- Fullscreen, no chrome — the screen IS the tool
- Glove-friendly — minimum touch target 56px, font minimum 14pt
- Dark background — reduces glare in brightly-lit repair shop
- Color = meaning — Green/Yellow/Red are the only status colors
- Information hierarchy — health score dominates, then warnings, then detail
- Zero learning curve — a technician who has never seen the device can use it

---

## 2. Screen Flow

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  READY   │──▶│ ACTIVE   │──▶│COMPLETE  │──▶│  REPORT  │──▶│  EXPORT  │
│ (idle)   │   │(collect) │   │(process) │   │ (view)   │   │ (save)   │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

---

## 3. Screen Designs

### 3.1 READY — "Ready for Diagnostic" (Idle State)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                         DISPOSCAN                                   │  │
│  │                 Diagnostic Station v1.0                             │  │
│  │                                                                      │  │
│  │                                                                      │  │
│  │               ╔══════════════════════════════════╗                   │  │
│  │               ║       ●●●●●                     ║                   │  │
│  │               ║    READY FOR DIAGNOSTIC          ║                   │  │
│  │               ║                                  ║                   │  │
│  │               ║   Session: A7K3M                 ║                   │  │
│  │               ╚══════════════════════════════════╝                   │  │
│  │                                                                      │  │
│  │         Boot the diagnostic USB in the target PC                     │  │
│  │         and connect to "DispoScan" Wi-Fi network.                    │  │
│  │                                                                      │  │
│  │         ╔════════════════╗       ╔════════════════╗                  │  │
│  │         ║ HISTORY        ║       ║ SETTINGS       ║                  │  │
│  │         ╚════════════════╝       ╚════════════════╝                  │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  [Status: Idle — Awaiting connection]                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Large session code (5 alphanumeric chars) — technician types this into collector
- Minimal instructions
- History button (small, at bottom) — past session list
- Settings button (gear icon, bottom-right) — Wi-Fi config, display brightness
- Screen saver after 5 min: dim brightness, pulse DDS logo

### 3.2 ACTIVE — Live Collection (Streaming State)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  DISPOSCAN                           Session: A7K3M  [ Cancel ]  │  │
│  │                                                                    │  │
│  │  ╔══════════════════════════════════════════════════════════╗      │  │
│  │  ║  ████████████████████████░░░░░░░░░░░░░░  65%             ║      │  │
│  │  ║  Testing RAM modules...   ▼ 45 sec remaining             ║      │  │
│  │  ╚══════════════════════════════════════════════════════════╝      │  │
│  │                                                                    │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│  │
│  │  │  ✓ CPU            │  │  ◌ RAM            │  │  ◌ GRAPHICS      ││  │
│  │  │  Intel i7-1365U   │  │  Testing...       │  │  Pending...      ││  │
│  │  │  10 cores / 12 th │  │                   │  │                  ││  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘│  │
│  │                                                                    │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│  │
│  │  │  ◌ STORAGE        │  │  ◌ BATTERY        │  │  ◌ NETWORK       ││  │
│  │  │  Pending...       │  │  Pending...       │  │  Pending...       ││  │
│  │  │                   │  │                   │  │                  ││  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘│  │
│  │                                                                    │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│  │
│  │  │  ◌ BIOS / TPM     │  │  ◌ EVENT LOGS     │  │  ◌ DRIVERS        ││  │
│  │  │  Pending...       │  │  Pending...       │  │  Pending...       ││  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘│  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  [Network: Connected  |  Target: DESKTOP-ABC123]                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Overall progress bar (animated, smooth)
- Estimated time remaining
- Test grid: 3×3 cards showing status per test
  - ✓ = complete
  - ◌ = in progress (pulsing)
  - □ = pending
  - ⚠ = completed with warnings
  - ✗ = failed
- Cancel button (top-right) — confirms before cancelling
- Status bar at bottom: network status + device name

### 3.3 PROCESSING — Generating Report (Transition State)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │                         DISPOSCAN                                   │  │
│  │                                                                      │  │
│  │                                                                      │  │
│  │                    ╔══════════════════════╗                          │  │
│  │                    ║   ◌ ◌ ◌ ◌ ◌ ◌      ║                          │  │
│  │                    ║  Processing...       ║                          │  │
│  │                    ║  Generating report   ║                          │  │
│  │                    ╚══════════════════════╝                          │  │
│  │                                                                      │  │
│  │                                                                      │  │
│  │  12 tests complete, 0 warnings                                       │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Simple animated spinner
- "Processing..." text
- Summary: N tests complete, M warnings, E errors
- Transitions automatically to REPORT (~2 seconds)

### 3.4 REPORT — Health Report (Display State)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  DISPOSCAN                                    Date: 2026-07-15          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  ╔══════════════════════════════════════════╗                      │  │
│  │  ║         ●●●●●           OVERALL           ║                      │  │
│  │  ║         HEALTH          GOOD              ║                      │  │
│  │  ║         85/100                            ║                      │  │
│  │  ╚══════════════════════════════════════════╝                      │  │
│  │                                                                    │  │
│  │  ┌──────────────────────┐  ┌──────────────────────┐               │  │
│  │  │ ● CPU                │  │ ● RAM                │               │  │
│  │  │ Intel i7-1365U       │  │ 32 GB DDR5           │               │  │
│  │  │ 10 cores, 62°C       │  │ 2 of 2 slots filled  │               │  │
│  │  │ HEALTH: GOOD         │  │ HEALTH: GOOD         │               │  │
│  │  └──────────────────────┘  └──────────────────────┘               │  │
│  │                                                                    │  │
│  │  ┌──────────────────────┐  ┌──────────────────────┐               │  │
│  │  │ ● STORAGE            │  │ ● BATTERY            │               │  │
│  │  │ Samsung SSD 980      │  │ LGC-L19L3PD6         │               │  │
│  │  │ 512 GB, 88% health   │  │ 72% health, 120 cyc  │               │  │
│  │  │ ⚠ 5 reallocated sec  │  │ HEALTH: WARNING      │               │  │
│  │  │ HEALTH: WARNING      │  │                      │               │  │
│  │  └──────────────────────┘  └──────────────────────┘               │  │
│  │                                                                    │  │
│  │  ┌──────────────────────┐  ┌──────────────────────┐               │  │
│  │  │ ● SYSTEM             │  │ ● EVENT LOGS         │               │  │
│  │  │ Windows 11 Pro       │  │ 2 critical, 14 error │               │  │
│  │  │ Secure Boot: ON      │  │ Last BSoD: 3d ago    │               │  │
│  │  │ TPM 2.0: Ready       │  │ HEALTH: WARNING      │               │  │
│  │  └──────────────────────┘  └──────────────────────┘               │  │
│  │                                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────┐      │  │
│  │  │ ⚠ RECOMMENDATIONS                                       │      │  │
│  │  │ • Battery is at 72% — consider replacement               │      │  │
│  │  │ • SSD has 5 reallocated sectors — monitor                │      │  │
│  │  │ • 2 critical events in system log — review               │      │  │
│  │  └─────────────────────────────────────────────────────────┘      │  │
│  │                                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────┐      │  │
│  │  │ Technician Note: [______________________________]       │      │  │
│  │  └─────────────────────────────────────────────────────────┘      │  │
│  │                                                                    │  │
│  │  [◄ BACK]  [⚡ SAVE REPORT]  [📄 EXPORT PDF]  [🗑 NEW DIAGNOSTIC]  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Overall health score: large, centered, color-coded ring gauge
  - 80-100: Green ring + "GOOD"
  - 50-79: Yellow ring + "WARNING"  
  - 0-49: Red ring + "CRITICAL"
- Hardware cards: 2×2 grid, each showing key data + health indicator
  - Green dot + subtle green border = healthy
  - Yellow dot + border = warning
  - Red dot + border = critical
- Recommendations panel: auto-generated from test results
- Technician note: text input for technician's notes
- Action buttons:
  - `SAVE REPORT` — persists to local SQLite
  - `EXPORT PDF` — generates and saves PDF to Pi storage
  - `NEW DIAGNOSTIC` — clears, returns to READY

### 3.5 EXPORT / SAVE FLOW

Overlay dialog on the REPORT screen:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    ╔══════════════════════╗                        │  │
│  │                    ║  ✓ REPORT SAVED      ║                        │  │
│  │                    ║                      ║                        │  │
│  │                    ║  Session: A7K3M      ║                        │  │
│  │                    ║  Saved to:           ║                        │  │
│  │                    ║  /reports/A7K3M.pdf  ║                        │  │
│  │                    ║                      ║                        │  │
│  │                    ║  [OPEN]  [DISMISS]   ║                        │  │
│  │                    ╚══════════════════════╝                        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Healt Score Algorithm

```
healthScore = 100

For each test:
  if test.status == "warning" → score -= 15
  if test.status == "critical" → score -= 35

For each warning:
  score -= 5

Cap at 0-100 range.

Health Level:
  >= 80  → Green "GOOD"
  >= 50  → Yellow "WARNING"  
  <  50  → Red "CRITICAL"
```

---

## 5. Color Palette

```
Background:       #0F1117 (almost black)
Card surface:     #1A1D24 (dark gray)
Card surface 2:   #242731 (slightly lighter)
Border:           #2E3138
Text primary:     #E8EAED (near white)
Text secondary:   #9AA0A6 (gray)

Green (good):     #34A853
Green surface:    #1A3328
Yellow (warn):    #FBBC04
Yellow surface:   #332B17
Red (critical):   #EA4335
Red surface:      #331A17

Accent blue:      #4285F4
Accent surface:   #1A2332

Health ring good:   #34A853 → #1B6B34 (gradient)
Health ring warn:   #FBBC04 → #B38600
Health ring crit:   #EA4335 → #B3261E
```

---

## 6. Touch Targets

| Element | Minimum Size | Notes |
|---|---|---|
| Primary buttons | 64px × 48px | "SAVE REPORT", "EXPORT PDF" |
| Secondary buttons | 56px × 40px | "BACK", "CANCEL" |
| Test cards (grid) | fill available | 3-column grid, touch scroll |
| Text input | 56px height | Technician note field |
| Session code | 64pt text | Display only, no touch |
| History items | 56px height | Scrollable list |

---

## 7. Responsive Behavior

The design targets the official Raspberry Pi 7" touchscreen (800×480). It should also scale to:

| Display | Resolution | Adaptation |
|---|---|---|
| Pi 7" official | 800×480 | Primary target |
| Pi 7" (DSI) | 800×480 | Same |
| Waveshare 5" | 800×480 | Same |
| Waveshare 3.5" | 480×320 | Compact mode, stack cards |
| HDMI monitor | 1920×1080 | Centered max-width 900px |

---

## 8. Frontend Implementation

The frontend remains React + Vite + TailwindCSS, but adapted for kiosk mode:

- No React Router (single-screen state machine)
- No auth context
- No axios (WebSocket + fetch for history)
- State machine drives UI mode: `idle | collecting | processing | report`
- Touch events native (no hover-dependent UI)
- Fullscreen via `Fullscreen API` (use `element.requestFullscreen()`)
- Screen blanking via `Wake Lock API` (prevent screen sleep during collection)
