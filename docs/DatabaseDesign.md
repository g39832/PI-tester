# DDS — Database Design

## Version 1.0

---

## 1. Design Philosophy

- **Normalize entities** (customers, devices, technicians, reports) into relational tables.
- **Store diagnostic payloads as JSONB** to accommodate the variable-shape data from PowerShell scripts while keeping queryable columns for common fields.
- **Design for V1, plan for V2.** Every table includes `created_at`/`updated_at`. Future columns are documented but not implemented.
- **UUIDs as primary keys** — no sequential IDs exposed to clients, safe for eventual multi-shop sync.

## 2. Entity Relationship Summary

```
technicians ────< diagnostics
customers  ────< devices
devices    ────< diagnostics
devices    ────< device_images
diagnostics ────< reports
technicians ────< audit_logs
sessions   (standalone, JWT refresh)
```

## 3. Tables

### 3.1 `technicians`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, default gen_random_uuid() | |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login identifier |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt, cost 12 |
| name | VARCHAR(255) | NOT NULL | Display name |
| role | VARCHAR(50) | NOT NULL, DEFAULT 'technician' | 'admin' or 'technician' |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Soft deactivation |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### 3.2 `customers`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| name | VARCHAR(255) | NOT NULL | |
| email | VARCHAR(255) | NULLABLE | |
| phone | VARCHAR(50) | NULLABLE | |
| address | TEXT | NULLABLE | |
| notes | TEXT | NULLABLE | Internal technician notes |
| created_by | UUID | FK → technicians.id | Who registered this customer |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### 3.3 `devices`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| customer_id | UUID | FK → customers.id, NOT NULL | |
| serial_number | VARCHAR(255) | NULLABLE | May not be readable |
| manufacturer | VARCHAR(255) | NULLABLE | Dell, HP, Lenovo, etc. |
| model | VARCHAR(255) | NULLABLE | Latitude 5420, etc. |
| device_type | VARCHAR(50) | NULLABLE | 'laptop', 'desktop', 'tablet', 'server' |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### 3.4 `diagnostics`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| device_id | UUID | FK → devices.id, NOT NULL | |
| technician_id | UUID | FK → technicians.id, NOT NULL | Who ran the diagnostic |
| payload | JSONB | NOT NULL | Full raw diagnostic payload |
| cpu_model | VARCHAR(255) | NULLABLE | Denormalized for querying |
| ram_gb | NUMERIC(5,1) | NULLABLE | Total RAM in GB |
| storage_gb | NUMERIC(8,1) | NULLABLE | Total storage in GB |
| os_version | VARCHAR(255) | NULLABLE | Windows version string |
| serial_number | VARCHAR(255) | NULLABLE | Device serial in payload |
| summary | TEXT | NULLABLE | Auto-generated or manual summary |
| warnings | JSONB | NULLABLE | Array of warning objects |
| is_healthy | BOOLEAN | NULLABLE | Overall health flag |
| collected_at | TIMESTAMPTZ | NOT NULL | When the script ran |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When uploaded |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Design Rationale for denormalized columns:**
- Common query patterns (search by CPU, filter by OS, sort by RAM) would require JSONB path queries which are slower and don't benefit from standard B-tree indexes.
- Indexes on `cpu_model`, `ram_gb`, `os_version` enable efficient filtering/sorting on the dashboard.
- The full `payload` JSONB preserves every detail the PowerShell script sends.

### 3.5 `reports`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| diagnostic_id | UUID | FK → diagnostics.id, UNIQUE, NOT NULL | |
| technician_id | UUID | FK → technicians.id, NOT NULL | |
| notes | TEXT | NULLABLE | Technician's repair notes |
| recommendations | TEXT | NULLABLE | Recommended actions |
| pdf_path | VARCHAR(500) | NULLABLE | Path to generated PDF file |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### 3.6 `device_images`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| device_id | UUID | FK → devices.id, NOT NULL | |
| filename | VARCHAR(255) | NOT NULL | Original filename |
| filepath | VARCHAR(500) | NOT NULL | Storage path |
| mime_type | VARCHAR(50) | NOT NULL | |
| file_size | INTEGER | NOT NULL | Bytes |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### 3.7 `sessions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| technician_id | UUID | FK → technicians.id, NOT NULL | |
| token_hash | VARCHAR(255) | NOT NULL | SHA-256 of JWT for lookup/revocation |
| expires_at | TIMESTAMPTZ | NOT NULL | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### 3.8 `audit_logs`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGSERIAL | PK | Sequential for ordering |
| actor_id | UUID | FK → technicians.id, NULLABLE | NULL for system actions |
| action | VARCHAR(50) | NOT NULL | 'create', 'update', 'delete', 'view' |
| entity_type | VARCHAR(50) | NOT NULL | 'customer', 'device', 'diagnostic', 'report' |
| entity_id | UUID | NOT NULL | ID of affected entity |
| changes | JSONB | NULLABLE | Previous/new values for updates |
| ip_address | INET | NULLABLE | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

## 4. Indexes

| Table | Index | Type | Purpose |
|---|---|---|---|
| customers | idx_customers_name | GIN (trigram) | Fuzzy name search |
| customers | idx_customers_email | BTREE | Exact email lookup |
| customers | idx_customers_phone | BTREE | Phone lookup |
| devices | idx_devices_serial | BTREE | Serial number lookup |
| devices | idx_devices_customer | BTREE | Find devices by customer |
| diagnostics | idx_diagnostics_device | BTREE | Find diagnostics for device |
| diagnostics | idx_diagnostics_technician | BTREE | Diagnostics by technician |
| diagnostics | idx_diagnostics_collected | BTREE | Sort by collection date |
| diagnostics | idx_diagnostics_os | BTREE | Filter by OS |
| audit_logs | idx_audit_entity | BTREE | Find logs for an entity |
| audit_logs | idx_audit_created | BTREE | Time-ordered log viewing |

## 5. Migration Strategy

- Drizzle Kit generates SQL migration files
- Each migration is timestamped and sequential
- Migrations run via `docker-entrypoint-initdb.d` or startup script
- Rollback via Drizzle Kit `drop` command

## 6. Future Tables (V2+ — Documented, Not Created)

| Table | Purpose |
|---|---|
| `shops` | Multi-shop tenant isolation |
| `inventory` | Parts and stock management |
| `appointments` | Scheduling |
| `invoices` | Billing integration |
| `ai_diagnostics` | AI analysis results |
| `notifications` | Email/SMS queue |
| `cloud_sync` | Sync state for multi-shop |
