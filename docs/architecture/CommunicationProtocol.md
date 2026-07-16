# Communication Protocol — Diagnostic Collector ↔ Appliance

## Version 1

---

## 1. Discovery — mDNS/DNS-SD

### 1.1 Service Advertisement (Raspberry Pi)

The Pi advertises the `_disposcan._tcp` service via Avahi:

```xml
<!-- avahi.service file on Pi -->
<service-group>
  <name>DispoScan-Diagnostics</name>
  <service>
    <type>_disposcan._tcp</type>
    <port>3002</port>
    <txt-record>version=1.0.0</txt-record>
    <txt-record>session=A7K3M</txt-record>
    <txt-record>status=idle</txt-record>
  </service>
</service-group>
```

### 1.2 Service Discovery (Windows Collector)

The collector sends an mDNS query via:
- .NET `System.Net.NetworkInformation` (limited multicast support)
- Native `DnsQuery` API with `DNS_TYPE_PTR` for `_disposcan._tcp.local`
- Fallback: `nslookup -type=ptr _disposcan._tcp.local`

If mDNS fails:
- Collector tries DHCP-assigned gateway IP (port 3002)
- Collector tries IP 10.0.0.1, 192.168.1.1, 192.168.0.1 (common gateways)
- Collector prompts technician: "Enter Pi IP address"

### 1.3 Session Code
- Pi generates a 5-character alphanumeric code (excluding 0, O, I, L for readability)
- Displayed on Pi screen
- Collector connects and sends code → Pi validates → session established
- Prevents cross-connection on multi-Pi networks
- Code expires after 15 minutes (new one generated)

---

## 2. Transport — WebSocket

### 2.1 Connection

```
ws://<pi-ip>:3002/collect
```

Upgrade headers:
```
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Protocol: disposcan-v1
X-Session-Code: A7K3M
```

### 2.2 Connection Lifecycle

```
[Collector]                     [Pi Server]
    │                               │
    │── TCP SYN ──────────────────▶│
    │◀─ TCP SYN-ACK ───────────────│
    │── WS Upgrade Request ──────▶│
    │◀─ 101 Switching Protocols ──│
    │── {type: "hello"} ─────────▶│
    │   {sessionCode: "A7K3M"}    │
    │◀─ {type: "hello_ack"} ──────│
    │   {sessionId: "uuid"}       │
    │   {acceptedTests: [...]}    │
    │── {type: "session_meta"} ──▶│
    │── {type: "test_result"} ───▶│
    │   testId: "cpu"             │
    │   status: "complete"        │
    │   data: {...}               │
    │◀─ {type: "ack"} ────────────│
    │   testId: "cpu"             │
    │   ... (repeat for each test)│
    │── {type: "complete"} ──────▶│
    │◀─ {type: "complete_ack"} ───│
    │── WS Close ────────────────▶│
```

### 2.3 Message Types

#### Collector → Pi

| Type | Description | Payload |
|---|---|---|
| `hello` | Session initiation | `{ sessionCode: string }` |
| `session_meta` | Device metadata | `{ deviceName, manufacturer, model, windowsVersion }` |
| `test_result` | Single test result | `{ testId, status, data, warnings, duration }` |
| `progress` | Progress update | `{ percent, currentTest, estimatedRemaining }` |
| `complete` | All tests done | `{}` |
| `error` | Collector-side error | `{ code, message, testId? }` |

#### Pi → Collector

| Type | Description | Payload |
|---|---|---|
| `hello_ack` | Session accepted | `{ sessionId, acceptedTests: string[] }` |
| `ack` | Test acknowledged | `{ testId }` |
| `cancel` | User cancelled on Pi | `{ reason: string }` |
| `error` | Server-side error | `{ code, message }` |

### 2.4 Error Handling

- **Connection timeout**: 30 seconds to establish WebSocket after TCP
- **Ping/pong**: Server pings every 15 seconds; collector responds
- **Reconnection**: Collector retries 3 times with exponential backoff (2s, 4s, 8s)
- **Message ordering**: Collector waits for `ack` before sending next test result
- **Maximum message size**: 1MB (large event logs are chunked)

---

## 3. Security Model (Air-Gapped)

| Threat | Mitigation |
|---|---|
| Unauthorized connection (same LAN) | Session code on screen, must be entered in collector |
| Packet sniffing | Air-gapped LAN — no external network path. Data is hardware diagnostics, not PII. |
| Replay attack | Single-use session codes, expire in 15 min |
| DoS / connection flood | Rate limit: 1 concurrent session per Pi, max 10 connections/minute |
| Malicious collector | Physical access to Pi required. Pi in locked shop. |
| Data integrity | Each message has sequence number. Missing sequences detected on complete. |

### Offline Constraint Summary
- No TLS (LAN-only, no internet path, no CA management)
- No external DNS
- No authentication server
- No IP address management — DHCP only
- No certificate management

---

## 4. Network Requirements

| Requirement | Specification |
|---|---|
| Protocol | 802.11 b/g/n (2.4 GHz) |
| DHCP | Required (both Pi and Windows collector) |
| DNS | Not required (mDNS handles service discovery) |
| Firewall | Windows: allow outbound TCP 3002. Pi: allow inbound TCP 3002 |
| Internet | NOT required — system is fully air-gapped |
| Router | Any consumer-grade Wi-Fi router |
| Typical latency | < 5ms on same LAN (including 2.4 GHz Wi-Fi) |
| Bandwidth | < 1MB per session (payload is text-based JSON) |

### Fallback: No Wi-Fi
If Wi-Fi is unavailable:
- Pi can create its own ad-hoc Wi-Fi network (hostapd)
- Collector connects to "DispoScan" SSID directly
- No router needed — Pi acts as DHCP server
- Fallback mode displayed on Pi screen: "Wi-Fi AP Mode"
