# Session Lifecycle & State Machine

## Version 1

---

## 1. Session State Machine

```
                    ┌─────────────┐
                    │    IDLE     │
                    │             │
                    └──────┬──────┘
                           │ mDNS discovery + WS connect
                           ▼
                    ┌─────────────┐
              ┌────▶│  PAIRING    │────┐
              │     │             │    │ Session code mismatch
              │     └──────┬──────┘    │
              │            │ Code OK   │
              │            ▼           │
              │     ┌─────────────┐    │
              │     │ COLLECTING  │    │
              │     │ Live stream │    │
              │     └──────┬──────┘    │
              │            │ All done  │
              │            ▼           │
              │     ┌─────────────┐    │
              │     │ PROCESSING  │    │
              │     │             │    │
              │     └──────┬──────┘    │
              │            │ Done      │
              │            ▼           │
              │     ┌─────────────┐    │
              │     │   REPORT    │    │
              │     │             │    │
              │     └──────┬──────┘    │
              │            │ Save/Exit │
              │            ▼           │
              │     ┌─────────────┐    │
              └─────│    IDLE     │    │
                    │             │────┘ (re-pair on timeout)
                    └─────────────┘

Failure states (from any active state):
  CONNECTION_LOST ──→ RECONNECTING ──→ (back to COLLECTING or COMPLETE)
  COLLECTOR_ERROR  ──→ PARTIAL_REPORT ──→ REPORT (with warnings)
  TIMEOUT           ──→ INCOMPLETE ──→ IDLE (after 5 min)
  CANCELLED         ──→ IDLE
```

---

## 2. State Definitions

### IDLE
| Property | Value |
|---|---|
| Description | Waiting for a collector to connect |
| Screen | "Ready for Diagnostic" with session code |
| Actions | Start history view, enter settings |
| Timeout | Generate new session code every 15 min |
| Data | None |

### PAIRING
| Property | Value |
|---|---|
| Description | Collector connected, validating session code |
| Screen | "Connecting..." with spinner |
| Actions | Validate code, accept or reject connection |
| Timeout | 30 seconds → reject, return to IDLE |
| Data | WebSocket connection established |

### COLLECTING
| Property | Value |
|---|---|
| Description | Collector streaming test results |
| Screen | Live collection grid with progress bar |
| Actions | Cancel (with confirmation) |
| Incoming | `test_result`, `progress`, `session_meta`, `error` |
| Outgoing | `ack`, `cancel` |
| Data | Accumulating in memory, persisted per-test on ack |

### PROCESSING
| Property | Value |
|---|---|
| Description | All tests received, generating report |
| Screen | Processing spinner with summary |
| Actions | None (transitional, ~2 seconds) |
| Logic | Calculate health score, generate recommendations |
| Data | Full session data in memory |

### REPORT
| Property | Value |
|---|---|
| Description | Full health report displayed |
| Screen | Health overview + hardware cards + recommendations |
| Actions | Save, Export PDF, New Diagnostic, Back |
| Data | Complete session + report |

### Error States

#### CONNECTION_LOST
| Property | Value |
|---|---|
| Trigger | WebSocket close/disconnect during COLLECTING |
| Screen | "Connection Lost — Reconnecting..." with timer |
| Recovery | Collector reconnects within 5 min → resume from last ack |
| Failure | 5 min timeout → save partial data → return to IDLE |

#### PARTIAL_REPORT
| Property | Value |
|---|---|
| Trigger | Collector sends `complete` but some tests are missing/errored |
| Screen | Same as REPORT but with "Incomplete" header and ⚠ markers |
| Actions | Same as REPORT (save, export) |

#### CANCELLED
| Property | Value |
|---|---|
| Trigger | User taps Cancel, confirms |
| Screen | Confirmation dialog → "Session Cancelled" → IDLE |
| Data | Discarded |

---

## 3. Data Model

### Session Object
```typescript
interface DiagnosticSession {
  id: string;          // UUID
  code: string;        // 5-char session code
  status: SessionStatus;
  startedAt: string;   // ISO 8601
  completedAt?: string;
  device?: DeviceInfo;
  tests: TestResult[];
  healthScore?: number;
  overallStatus?: HealthLevel;
  technicianNote?: string;
  savedAt?: string;
}

type SessionStatus = 
  | 'idle'
  | 'pairing'
  | 'collecting'
  | 'processing'
  | 'report'
  | 'complete'
  | 'cancelled'
  | 'incomplete';

interface DeviceInfo {
  deviceName?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  windowsVersion?: string;
}

interface TestResult {
  id: string;
  label: string;
  status: 'pending' | 'collecting' | 'complete' | 'warning' | 'error' | 'skipped';
  health: 'good' | 'warning' | 'critical' | 'unknown';
  data: Record<string, unknown>;
  warnings: string[];
  duration?: number;   // seconds
}

type HealthLevel = 'good' | 'warning' | 'critical';
```

### Storage Schema (SQLite)
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'idle',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  device_name TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  windows_version TEXT,
  health_score INTEGER,
  overall_status TEXT,
  technician_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE test_results (
  id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  test_id TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL,
  health TEXT NOT NULL DEFAULT 'unknown',
  data TEXT NOT NULL,  -- JSON string
  warnings TEXT,       -- JSON array string
  duration REAL,
  PRIMARY KEY (id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_created ON sessions(created_at DESC);
CREATE INDEX idx_tests_session ON test_results(session_id);
```

---

## 4. State Transition Rules

| From | To | Condition |
|---|---|---|
| IDLE | PAIRING | WebSocket connection received |
| PAIRING | COLLECTING | Valid session code + `hello` received |
| PAIRING | IDLE | Invalid session code → close WS |
| COLLECTING | COLLECTING | `test_result` received → respond with `ack` |
| COLLECTING | PROCESSING | `complete` message received + all tests accounted for |
| COLLECTING | PARTIAL_REPORT | `complete` received + missing tests (timeout or error) |
| COLLECTING | IDLE | Cancel button pressed + confirmed |
| COLLECTING | CONNECTION_LOST | WebSocket closed unexpectedly |
| PROCESSING | REPORT | Health score calculated, report generated |
| REPORT | IDLE | "New Diagnostic" pressed |
| CONNECTION_LOST | COLLECTING | Reconnection with valid resume token |
| CONNECTION_LOST | PARTIAL_REPORT | Timeout (5 min) → save partial data |

---

## 5. Concurrency

- Only **one active session** at a time on a single Pi
- History browsing allowed during IDLE state
- New session always starts from IDLE
- If connection comes while another is active → reject with `busy` response
