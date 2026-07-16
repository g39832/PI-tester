# Module Breakdown & Implementation Order

## Version 1

---

## 1. Module Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DISPOSCAN APPLIANCE                               │
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │  KIOSK UI  │  │  WS CLIENT │  │  BACKEND   │  │  COLLECTOR │        │
│  │  (React)   │◀─▶│ (browser)  │◀─▶│ (Node.js)  │◀─▶│ (WinPE)    │        │
│  │           │  │            │  │           │  │           │        │
│  │ Frontend  │  │ WebSocket  │  │ Express    │  │ PowerShell│        │
│  │ State     │  │ Bridge     │  │ + WS       │  │ + Native  │        │
│  │ Machine   │  │            │  │ Server     │  │ APIs      │        │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘        │
│                                                               │
│                       ┌────────────┐  ┌────────────┐                   │
│                       │  REPORT    │  │  STORE     │                   │
│                       │  ENGINE    │  │  (SQLite)  │                   │
│                       │  (pdf-lib) │  │            │                   │
│                       └────────────┘  └────────────┘                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Definitions

### M1 — Backend Core (Node.js + Express)

**Boundary:** The main server process running on the Pi.

**Inputs:**
- WebSocket connections from collector
- HTTP requests from frontend (history, export)

**Outputs:**
- WebSocket messages to collector
- Session data to Store module

**Dependencies:** None

**Contains:**
- Express HTTP server (history, export endpoints)
- WebSocket server (`ws` library on port 3002)
- Session management (state machine)
- Message routing (dispatch test results to processing)
- mDNS advertisement via Avahi (separate process, configured via D-Bus or config file)

**Testable in isolation:** ✅ Yes. Mock WebSocket client sends test messages, verify state transitions.

---

### M2 — Diagnostic Collector (WinPE PowerShell/EXE)

**Boundary:** Runs on the target Windows PC booted from USB.

**Inputs:**
- Hardware (via WMI, native APIs, SMART IOCTL)
- Offline Windows partition (registry, event logs, CBS logs)

**Outputs:**
- WebSocket JSON messages to Pi

**Dependencies:** M1 (must have a Pi to connect to)

**Contains:**
- mDNS discovery client
- WebSocket client
- Test execution engine (serializes/parallelizes tests)
- Offline registry reader
- Event log parser
- SMART data reader

**Testable in isolation:** ✅ Yes. Can run tests against local Windows machine. Can mock WebSocket to verify message format.

---

### M3 — Frontend Kiosk UI (React + Vite + TailwindCSS)

**Boundary:** Browser running in fullscreen kiosk mode on the Pi touchscreen.

**Inputs:**
- Touch events
- WebSocket messages from backend (session state changes)
- HTTP responses from backend (history, PDF export)

**Outputs:**
- WebSocket messages to backend (cancel)
- HTTP requests to backend

**Dependencies:** M1 (must have backend to proxy WebSocket)

**Contains:**
- State machine-driven screens (IDLE, COLLECTING, PROCESSING, REPORT)
- Animated progress display
- Health gauge components
- Report card components
- Technician note input
- History list

**Testable in isolation:** ✅ Yes. Mock backend with fake WebSocket. All UI can be developed against simulated data.

---

### M4 — Report Engine (pdf-lib)

**Boundary:** Pure library, no I/O.

**Inputs:** Session data object
**Outputs:** PDF buffer

**Dependencies:** None

**Contains:**
- PDF template (header, device info, hardware cards, health gauge, signature line)
- Health score visualization in PDF
- Recommendation section
- Company branding (logo on USB drive or Pi storage)

**Testable in isolation:** ✅ Yes. Pure function: session data → PDF buffer. Unit test with snapshots.

---

### M5 — Local Store (SQLite)

**Boundary:** SQLite database on Pi's SD card/SSD.

**Inputs:** Session data to persist
**Outputs:** Saved session records

**Dependencies:** None (separate library)

**Contains:**
- Schema initialization
- Session CRUD
- Test result storage
- History queries (paginated)

**Testable in isolation:** ✅ Yes. In-memory SQLite for unit tests.

---

### M6 — Discovery Service (Avahi)

**Boundary:** Linux system service on Pi.

**Inputs:** Config file (`disposcan.service`)
**Outputs:** mDNS advertisements on LAN

**Dependencies:** Raspberry Pi OS (Raspbian)

**Contains:**
- Avahi service definition file
- Session code auto-update script (regenerates code, updates TXT record)

**Testable in isolation:** ✅ Yes. Config file can be deployed to any Linux with Avahi.

---

## 3. Dependencies Graph

```
M6 (Discovery) ── (required by) ──▶ M2 (Collector)
                                        │
M1 (Backend) ◀─────────────────────────┘
    │
    ├──▶ M3 (Frontend)
    │
    ├──▶ M4 (Report Engine)
    │
    └──▶ M5 (Local Store)
```

---

## 4. Implementation Order

```
Phase A:  M1 (Backend Core) — state machine, WS protocol, health endpoint
Phase B:  M5 (Local Store) — SQLite schema, persistence
Phase C:  M3 (Frontend) — all 4 screens, simulated data mode
Phase D:  M4 (Report Engine) — PDF generation
Phase E:  M1 + M3 + M5 integration — backend serves frontend, persists sessions
Phase F:  M6 (Discovery Service) — mDNS, Avahi config, session code generation
Phase G:  M2 (Collector) — WinPE environment, all tests
Phase H:  Full integration testing — collector → backend → UI → report
Phase I:  Hardening — error handling, reconnection, timeout, partial data
Phase J:  Raspberry Pi image + bootable USB build
```

### Rationale for order:
1. **Backend first** because everything depends on it (WS protocol, state machine)
2. **Store early** because persistence is needed for history
3. **Frontend in Phase C** because it can be developed entirely in browser against simulated data (fast iteration)
4. **Collector last** because it requires WinPE build environment, Windows hardware testing, and the most debugging effort
5. **Integration in Phase H** — bringing everything together once individual modules are proven

---

## 5. Module Sizing

| Module | Files | Est. LOC | Risk |
|---|---|---|---|
| M1 Backend Core | 10-15 | 800-1200 | Medium — WS state machine complexity |
| M2 Collector | 3-5 scripts | 500-800 | High — WinPE compatibility, many edge cases |
| M3 Frontend | 15-20 | 1200-1800 | Low — standard React dev, simulated data |
| M4 Report Engine | 1-2 | 300-500 | Low — pure function, pdf-lib is straightforward |
| M5 Local Store | 3-5 | 200-400 | Low — simple SQLite CRUD |
| M6 Discovery | 2-3 files | 50-100 | Low — standard Avahi config |

**Total estimated:** 3,000-5,000 lines of code for V1 appliance.
