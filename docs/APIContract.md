# DDS — API Contract

## Version 1.0

---

## 1. Base URL

```
http://<host>:3001/api/v1
```

## 2. Authentication

All endpoints except `POST /auth/login` and `GET /health` require an `Authorization: Bearer <token>` header.

## 3. Standard Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

## 4. Endpoints

### 4.1 Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | No | Health check |

**Response:** `{ "status": "ok", "timestamp": "...", "version": "1.0.0", "uptime": 1234 }`

---

### 4.2 Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/login | No | Login |
| POST | /auth/register | No | Register (V1: open; V2: admin-only) |

**POST /auth/login**
```json
{
  "email": "tech@dispo.tech",
  "password": "securePassword123"
}
```
→ `{ "token": "jwt...", "technician": { ... } }`

**POST /auth/register**
```json
{
  "email": "tech@dispo.tech",
  "password": "securePassword123",
  "name": "Jane Technician"
}
```
→ `{ "token": "jwt...", "technician": { ... } }`

---

### 4.3 Customers

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /customers | Yes | List (paginated, searchable) |
| GET | /customers/:id | Yes | Get by ID |
| POST | /customers | Yes | Create |
| PUT | /customers/:id | Yes | Update |
| DELETE | /customers/:id | Yes | Delete |

**GET /customers?search=john&page=1&limit=20**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "555-0100",
      "address": "123 Main St",
      "notes": null,
      "deviceCount": 2,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

**POST /customers**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "555-0100",
  "address": "123 Main St",
  "notes": null
}
```

---

### 4.4 Devices

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /devices | Yes | List (paginated, filterable by customer) |
| GET | /devices/:id | Yes | Get by ID (includes customer info) |
| POST | /devices | Yes | Create |
| PUT | /devices/:id | Yes | Update |
| DELETE | /devices/:id | Yes | Delete |

**POST /devices**
```json
{
  "customerId": "uuid",
  "serialNumber": "ABC123",
  "manufacturer": "Dell",
  "model": "Latitude 5420",
  "deviceType": "laptop"
}
```

---

### 4.5 Diagnostics

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /diagnostics | Yes | List (paginated, filterable) |
| GET | /diagnostics/:id | Yes | Get by ID (full payload included) |
| POST | /diagnostics | Yes | Upload from PowerShell script |
| DELETE | /diagnostics/:id | Yes | Delete |

**POST /diagnostics**
```json
{
  "device": {
    "serialNumber": "ABC123",
    "manufacturer": "Dell",
    "model": "Latitude 5420",
    "deviceType": "laptop"
  },
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-0100"
  },
  "diagnostic": {
    "cpu": {
      "model": "Intel Core i7-1365U",
      "cores": 10,
      "threads": 12,
      "usage": 15,
      "temperature": 62
    },
    "ram": {
      "totalGB": 32,
      "usedGB": 12,
      "slots": 2
    },
    "storage": [
      {
        "model": "Samsung SSD 980",
        "type": "NVMe",
        "totalGB": 512,
        "usedGB": 200,
        "health": 95,
        "smartStatus": "Good"
      }
    ],
    "battery": {
      "present": true,
      "healthPercent": 88,
      "cycles": 120
    },
    "motherboard": {
      "manufacturer": "Dell Inc.",
      "model": "0XF2KM",
      "biosVersion": "1.14.0",
      "biosDate": "2025-03-15"
    },
    "os": {
      "version": "Windows 11 Pro",
      "build": "22631.3527",
      "installDate": "2025-01-10"
    },
    "tpm": {
      "present": true,
      "version": "2.0",
      "isReady": true
    },
    "secureBoot": {
      "enabled": true
    },
    "network": [
      {
        "interface": "Ethernet",
        "mac": "AA:BB:CC:DD:EE:FF",
        "ip": "192.168.1.100",
        "dhcpEnabled": true
      }
    ],
    "temperatures": {
      "cpu": 62,
      "gpu": 48,
      "storage": 35
    },
    "eventLogs": {
      "critical": 0,
      "error": 3,
      "warning": 12
    },
    "windowsUpdates": {
      "installed": 15,
      "pending": 3,
      "lastCheck": "2026-07-14T10:00:00Z"
    },
    "drivers": [
      { "name": "Intel Display Driver", "version": "31.0.101.4255", "provider": "Intel" }
    ],
    "collectedAt": "2026-07-14T14:30:00Z"
  }
}
```
→ `{ "id": "uuid", "summary": "...", "deviceId": "uuid" }`

---

### 4.6 Reports

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /reports | Yes | List reports |
| GET | /reports/:id | Yes | Get report metadata |
| POST | /reports | Yes | Generate report from diagnostic |
| GET | /reports/:id/pdf | Yes | Download PDF |

**POST /reports**
```json
{
  "diagnosticId": "uuid",
  "notes": "Replaced thermal paste, updated drivers",
  "recommendations": "Monitor SSD health, consider upgrade to 1TB"
}
```
→ `{ "id": "uuid", "pdfUrl": "/api/v1/reports/uuid/pdf" }`

---

### 4.7 Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /dashboard/stats | Yes | Dashboard metrics |

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCustomers": 150,
    "totalDevices": 200,
    "totalDiagnostics": 450,
    "diagnosticsToday": 5,
    "diagnosticsThisWeek": 28,
    "devicesByManufacturer": [
      { "manufacturer": "Dell", "count": 80 },
      { "manufacturer": "HP", "count": 60 }
    ],
    "recentDiagnostics": [ ... ]
  }
}
```

### 4.8 Search

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /search | Yes | Global search |

**GET /search?q=ABC123&type=all**
Returns matching customers, devices, diagnostics.

---

## 5. Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| VALIDATION_ERROR | 400 | Request body failed Zod validation |
| UNAUTHORIZED | 401 | Missing/invalid JWT |
| FORBIDDEN | 403 | Valid token but insufficient role |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Duplicate resource (e.g., email) |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Unexpected server error |

## 6. Pagination

All list endpoints accept:
- `page` (integer, default 1)
- `limit` (integer, default 20, max 100)

Response includes `meta` with `page`, `limit`, `total`, `totalPages`.

## 7. Rate Limits

- Anonymous: 20 req/min
- Authenticated: 100 req/min
- Diagnostic upload: 30 req/min

## 8. Content Types

- All requests: `application/json`
- All responses: `application/json`
- PDF download: `application/pdf`
