# DDS — Folder Structure

## Version 1.0

---

## 1. Root Layout

```
dispo-diagnostic-station/
├── apps/
│   ├── backend/          # Express REST API
│   └── frontend/         # React + Vite dashboard
├── packages/
│   ├── shared/           # Zod schemas, DTOs, constants, types
│   └── database/         # Drizzle schema, migrations, seed, client
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
├── scripts/
│   ├── migrate.sh        # Run database migrations
│   ├── seed.sh           # Seed demo data
│   └── backup.sh         # Database backup
├── docs/
│   ├── architecture/     # ADRs
│   ├── api/              # API documentation
│   ├── database/         # DB schema docs
│   ├── ProductRequirements.md
│   ├── Architecture.md
│   ├── DatabaseDesign.md
│   ├── APIContract.md
│   ├── FolderStructure.md
│   ├── Roadmap.md
│   ├── SecurityPlan.md
│   ├── CodingStandards.md
│   ├── DeploymentGuide.md
│   ├── TestingStrategy.md
│   └── CONTRIBUTING.md
├── reports/              # Generated PDFs (gitignored)
├── .github/
│   └── workflows/
│       └── ci.yml        # GitHub Actions CI
├── .env.example
├── .gitignore
├── .prettierrc
├── pnpm-workspace.yaml
├── package.json          # Root: scripts for orchestration
├── tsconfig.base.json    # Shared TypeScript config
├── turbo.json            # (V2: Turborepo)
└── README.md
```

## 2. Backend Structure (`apps/backend`)

```
apps/backend/
├── src/
│   ├── index.ts                    # Entry point
│   ├── app.ts                      # Express app setup
│   ├── config/
│   │   └── env.ts                  # Environment variable loading (Zod-validated)
│   ├── middleware/
│   │   ├── auth.ts                 # JWT verification
│   │   ├── validate.ts             # Zod validation middleware factory
│   │   ├── errorHandler.ts         # Global error handler
│   │   ├── rateLimiter.ts          # Rate limiting
│   │   ├── requestLogger.ts        # Winston HTTP logging
│   │   └── cors.ts                 # CORS configuration
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.routes.ts
│   │   ├── customers/
│   │   │   ├── customers.controller.ts
│   │   │   ├── customers.service.ts
│   │   │   ├── customers.repository.ts
│   │   │   └── customers.routes.ts
│   │   ├── devices/
│   │   │   ├── devices.controller.ts
│   │   │   ├── devices.service.ts
│   │   │   ├── devices.repository.ts
│   │   │   └── devices.routes.ts
│   │   ├── diagnostics/
│   │   │   ├── diagnostics.controller.ts
│   │   │   ├── diagnostics.service.ts
│   │   │   ├── diagnostics.repository.ts
│   │   │   └── diagnostics.routes.ts
│   │   ├── reports/
│   │   │   ├── reports.controller.ts
│   │   │   ├── reports.service.ts
│   │   │   ├── reports.repository.ts
│   │   │   ├── reports.routes.ts
│   │   │   └── pdfGenerator.ts
│   │   ├── dashboard/
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── dashboard.service.ts
│   │   │   └── dashboard.routes.ts
│   │   └── search/
│   │       ├── search.controller.ts
│   │       ├── search.service.ts
│   │       └── search.routes.ts
│   ├── shared/
│   │   ├── errors.ts               # Custom error classes
│   │   ├── response.ts             # Response helpers
│   │   └── pagination.ts           # Pagination logic
│   └── types/
│       └── express.d.ts            # Express extension (req.technician)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── api/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 3. Frontend Structure (`apps/frontend`)

```
apps/frontend/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Router setup
│   ├── index.css                   # Tailwind imports
│   ├── api/
│   │   ├── client.ts               # Axios instance with interceptors
│   │   ├── auth.ts                 # Auth API calls
│   │   ├── customers.ts
│   │   ├── devices.ts
│   │   ├── diagnostics.ts
│   │   ├── reports.ts
│   │   └── dashboard.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCustomers.ts
│   │   ├── useDevices.ts
│   │   ├── useDiagnostics.ts
│   │   ├── useReports.ts
│   │   └── useDashboard.ts
│   ├── components/
│   │   ├── ui/                     # Reusable UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── Pagination.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── ThemeToggle.tsx
│   │   └── shared/
│   │       ├── SearchBar.tsx
│   │       └── EmptyState.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Customers.tsx
│   │   ├── CustomerDetail.tsx
│   │   ├── Devices.tsx
│   │   ├── DeviceDetail.tsx
│   │   ├── Diagnostics.tsx
│   │   ├── DiagnosticDetail.tsx
│   │   ├── Reports.tsx
│   │   └── Settings.tsx
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── types/
│   │   └── index.ts                # Frontend-specific types
│   └── utils/
│       ├── format.ts               # Date, bytes, percentage formatters
│       └── constants.ts
├── public/
│   └── logo.svg
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
└── vitest.config.ts
```

## 4. Shared Package (`packages/shared`)

```
packages/shared/
├── src/
│   ├── schemas/
│   │   ├── auth.schema.ts          # Login/register Zod schemas
│   │   ├── customer.schema.ts
│   │   ├── device.schema.ts
│   │   ├── diagnostic.schema.ts
│   │   ├── report.schema.ts
│   │   └── common.schema.ts        # Pagination, UUID, etc.
│   ├── types/
│   │   ├── customer.types.ts
│   │   ├── device.types.ts
│   │   ├── diagnostic.types.ts
│   │   ├── report.types.ts
│   │   ├── auth.types.ts
│   │   └── api.types.ts            # ApiResponse<T>, PaginationMeta
│   ├── constants.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

## 5. Database Package (`packages/database`)

```
packages/database/
├── src/
│   ├── schema/
│   │   ├── index.ts                # Re-exports all tables
│   │   ├── technicians.ts
│   │   ├── customers.ts
│   │   ├── devices.ts
│   │   ├── diagnostics.ts
│   │   ├── reports.ts
│   │   ├── deviceImages.ts
│   │   ├── sessions.ts
│   │   └── auditLogs.ts
│   ├── migrations/                 # Drizzle Kit generated SQL
│   ├── seed.ts                     # Demo data seeder
│   ├── client.ts                   # Drizzle database instance
│   └── index.ts                    # Package exports
├── drizzle.config.ts               # Drizzle Kit config
├── package.json
└── tsconfig.json
```

## 6. Rationale

| Choice | Reason |
|---|---|
| `modules/` over `controllers/`, `services/`, `repositories/` | Groups all files for a feature together. Easier navigation for a solo dev. |
| `packages/shared` validation in Zod | Single source of truth — schemas drive both API validation and TypeScript types |
| Separate `packages/database` | Keeps schema/DB concerns isolated. Backend and future migration tools can depend on it. |
| UI primitives in `components/ui/` | Atomic design; prevents layout/page components from being tightly coupled to DOM elements |
