# Dispo Diagnostic Station (DDS) — Product Requirements Document

## Version 1.0

---

## 1. Executive Summary

Dispo Diagnostic Station (DDS) is a Raspberry Pi-powered diagnostic station for computer repair shops. Technicians connect a Windows PC to the station via USB/Ethernet, run a PowerShell script that collects hardware and system diagnostics, and the station processes, stores, and presents the data through a web dashboard. DDS replaces the sticky-note-and-spreadsheet workflow with a professional, searchable, report-generating system.

## 2. Problem Statement

Computer repair shops operate on thin margins. Technicians waste time:
- Manually recording serial numbers, specs, and diagnostics on paper
- Searching through sticky notes for customer device history
- Generating handwritten estimates and reports
- Managing customer data across spreadsheets and notebooks

DDS eliminates these inefficiencies by providing a centralized diagnostic capture and management platform running on inexpensive commodity hardware.

## 3. Target Audience

| Persona | Role | Needs |
|---|---|---|
| Technician | Diagnoses and repairs computers | Quickly capture diagnostics, view history, generate reports |
| Shop Owner | Manages repair business | Track metrics, billing data, technician performance |
| Customer | Brings in devices for repair | Receive professional diagnostic reports |

## 4. Version 1 Scope — MVP

### 4.1 In Scope (V1)

- Technician authentication (JWT + bcrypt)
- Customer management (CRUD)
- Device management (CRUD)
- Diagnostic JSON upload from PowerShell script
- Diagnostic viewing and search
- PDF report generation (printable diagnostic summary)
- Dashboard with key metrics
- Audit logging for sensitive operations
- Dark-mode responsive web UI

### 4.2 Out of Scope (V1) — Deferred to V2+

- AI-assisted diagnostics
- Customer portal / self-service
- QR code check-in
- Cloud sync / multi-shop
- Email/SMS notifications
- Inventory management
- Appointment scheduling
- Mobile app
- Billing / POS integration
- Remote diagnostic collection

## 5. Functional Requirements

### FR-01: Technician Authentication
- Technicians register with email + password
- Login returns a JWT token
- Tokens expire and require refresh
- Passwords are bcrypt-hashed

### FR-02: Customer Management
- Create, read, update, search customers
- Fields: name, email, phone, address, notes
- Search by name, email, phone

### FR-03: Device Management
- Create, read, update, search devices
- Fields: serial number, manufacturer, model, type, customer association
- Each device belongs to one customer

### FR-04: Diagnostic Upload
- Accept JSON payload from PowerShell script via authenticated POST
- Validate payload structure with Zod
- Store structured data in JSONB column
- Normalize device-level fields (CPU, RAM, storage) to relational columns where practical
- Handle partial/malformed payloads gracefully

### FR-05: Diagnostic Viewing
- View individual diagnostic with full detail
- List diagnostics with pagination, filtering, sorting
- Search across diagnostic data

### FR-06: PDF Report Generation
- Generate a professional PDF from diagnostic data
- Include: company branding, customer info, device info, hardware summary, warnings, recommendations, technician signature line
- Download via browser

### FR-07: Dashboard
- Total diagnostics today/this week
- Devices by manufacturer (chart)
- Recent diagnostics (list)
- Quick actions (new customer, new diagnostic)

### FR-08: Audit Logging
- Log all creates, updates, deletes on customers, devices, diagnostics
- Record: actor, action, entity type, entity ID, timestamp, IP address

## 6. Non-Functional Requirements

### NFR-01: Performance
- API response time < 200ms (p95) for standard CRUD
- PDF generation < 3 seconds
- Support 10+ concurrent technicians per Raspberry Pi 4

### NFR-02: Security
- All API endpoints (except auth) require JWT authentication
- Rate limiting: 100 req/min per token
- Input validation at every API boundary
- XSS prevention via proper response headers

### NFR-03: Reliability
- Graceful degradation on database connection loss
- Winston logging with configurable levels
- Uncaught exception handler

### NFR-04: Scalability
- Stateless API (horizontal scaling ready)
- PostgreSQL connection pooling
- Docker containerization

### NFR-05: Maintainability
- Monorepo with clear package boundaries
- Full TypeScript strict mode
- 80%+ test coverage on services
- Inline documentation for all modules

## 7. Constraints

- Raspberry Pi 4 (4GB+) as deployment target
- PostgreSQL as sole data store
- Local-first architecture (cloud sync is V2+)
- Solo developer with hard deadline

## 8. Success Metrics

- Time from device connection to diagnostic captured: < 30 seconds
- PDF report generation: < 3 seconds
- Dashboard page load: < 1 second
- Zero P1 security incidents in production
- 100% of V1 API endpoints have integration tests

---

## 9. Glossary

| Term | Definition |
|---|---|
| Diagnostic | A snapshot of a device's hardware and software state at a point in time |
| Device | A physical computer being diagnosed |
| Technician | A shop employee using the system |
| Customer | The person who owns the device being repaired |
| Report | A printable PDF summarizing a diagnostic |
| JSONB | PostgreSQL binary JSON column type |
