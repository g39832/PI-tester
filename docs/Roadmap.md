# DDS — Product Roadmap

## Version 1.0

---

## 1. Development Phases

```
Phase 0    Planning & Architecture       ████████░░  Current
Phase 1    Monorepo Scaffolding          ░░░░░░░░░░  Next
Phase 2    Database Schema & Migrations  ░░░░░░░░░░
Phase 3    Backend Core + Auth           ░░░░░░░░░░
Phase 4    Customer Management           ░░░░░░░░░░
Phase 5    Device Management             ░░░░░░░░░░
Phase 6    Diagnostic Upload & View      ░░░░░░░░░░
Phase 7    PDF Reports                   ░░░░░░░░░░
Phase 8    Dashboard & Search            ░░░░░░░░░░
Phase 9    Frontend Polish               ░░░░░░░░░░
Phase 10   Testing & Hardening           ░░░░░░░░░░
Phase 11   Documentation & Deployment    ░░░░░░░░░░
```

## 2. Phase Details

### Phase 0 — Planning & Architecture (Current)
- Product requirements document
- System architecture document
- Database design
- API contract
- Folder structure
- Security plan
- Coding standards
- Testing strategy
- Architecture Decision Records
- **Deliverable:** Complete `/docs/` directory

### Phase 1 — Monorepo Scaffolding
- pnpm workspace initialization
- TypeScript configuration (base, backend, frontend, packages)
- ESLint + Prettier setup
- Docker + Docker Compose (dev)
- Basic backend app (Express, health check)
- Basic frontend app (Vite + React + Tailwind)
- Database package scaffold
- Shared package scaffold
- GitHub Actions CI pipeline
- **Deliverable:** `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm typecheck` all pass. Docker Compose brings up a running stack.

### Phase 2 — Database Schema & Migrations
- Implement all Drizzle schema files
- Run initial migration
- Create seed data script
- **Deliverable:** PostgreSQL with all tables, seeded with demo data

### Phase 3 — Backend Core + Auth
- Error handling middleware
- Response helpers
- Request validation middleware
- Auth module (register, login, JWT)
- Rate limiting
- Request logging
- **Deliverable:** Full middleware stack, auth working with JWT

### Phase 4 — Customer Management
- Customers service
- Customers repository
- Customers controller + routes
- Customers API tests
- Frontend pages (list, detail, create, edit)
- **Deliverable:** Full CRUD for customers

### Phase 5 — Device Management
- Devices service + repository + controller
- Devices API tests
- Frontend pages
- **Deliverable:** Full CRUD for devices

### Phase 6 — Diagnostic Upload & View
- Diagnostics service + repository + controller
- Diagnostic validation schema
- PowerShell JSON payload acceptance
- Diagnostic viewing + search
- Frontend pages
- **Deliverable:** Diagnostic capture and viewing working end-to-end

### Phase 7 — PDF Reports
- Report generation service
- pdf-lib template
- Report CRUD
- PDF download endpoint
- Frontend pages
- **Deliverable:** Professional PDF reports downloadable

### Phase 8 — Dashboard & Search
- Dashboard stats endpoint
- Global search endpoint
- Frontend dashboard page with charts
- **Deliverable:** Functional dashboard with live metrics

### Phase 9 — Frontend Polish
- Dark mode consistency
- Loading states
- Empty states
- Error states
- Responsive layout
- Theme toggle persistence
- **Deliverable:** Polished, production-feel UI

### Phase 10 — Testing & Hardening
- Unit tests for all services
- Integration tests for all repositories
- API tests for all endpoints
- Security audit
- Performance baseline
- **Deliverable:** 80%+ service coverage, all critical paths tested

### Phase 11 — Documentation & Deployment
- README with setup instructions
- API documentation generation
- Deployment guide
- Production Docker Compose
- **Deliverable:** Deployable system with complete documentation

## 3. Version Roadmap

### V1 — MVP (Current)
Diagnostic capture, storage, viewing, PDF reporting, customer/device management.

### V2 — Intelligence
AI-assisted diagnostic analysis, automated recommendations, anomaly detection, health scoring.

### V3 — Multi-Device
Network scanning, batch diagnostics, remote collection over LAN.

### V4 — Cloud & Collaboration
Multi-shop sync, customer portal, cloud backup, team management.

### V5 — Business Intelligence
Analytics dashboard, technician performance tracking, revenue reporting, inventory integration.

## 4. Key Milestones

| Milestone | Date | Deliverable |
|---|---|---|
| M1 | Phase 1 complete | Running stack via Docker Compose |
| M2 | Phase 6 complete | End-to-end diagnostic workflow |
| M3 | Phase 8 complete | Full V1 feature set working |
| M4 | Phase 11 complete | Production-deployable system |

## 5. Risk Mitigation

| Risk | Mitigation |
|---|---|
| Scope creep | Strict V1-only scope. All feature requests deferred to roadmap. |
| Solo dev burnout | Vertical slices ensure shippable progress every phase. |
| Raspberry Pi performance | Load testing in Phase 10; optimize queries; consider VPS if needed. |
| PowerShell script incompatibility | Defensive JSONB storage; validate partial payloads gracefully. |
