# ADR-0007: Layered API Architecture (Controller → Service → Repository)

## Status
Accepted

## Context
DDS has a REST API that must handle varied business operations: technician authentication, customer/device/diagnostic CRUD, PDF report generation, and dashboard aggregation. The API must be maintainable, testable, and structured enough that future team members can quickly understand where to make changes.

## Options Considered

| Option | Description |
|---|---|
| Layered (Controller → Service → Repository) | Traditional separation of concerns |
| MVC (Model-View-Controller) | Model couples DB and business logic |
| Flat route handlers | Business logic in route callbacks |
| CQRS | Command/Query separation with separate models |

## Chosen Solution
**Layered architecture with Controller → Service → Repository separation.**

```
Route → Middleware → Controller → Service → Repository → Database
```

## Reasons
1. **Testability** — Each layer can be tested in isolation. Repositories can be mocked in service tests. Services can be mocked in controller tests.
2. **Separation of concerns** — Controllers handle HTTP (request parsing, response formatting). Services handle business rules. Repositories handle data access. Changes to one layer don't cascade to others.
3. **Consistency** — Every feature follows the same pattern. A developer who knows the customer module automatically understands the diagnostic module.
4. **Transaction management** — Services control transaction scope, calling multiple repository methods within a single transaction boundary.
5. **CQRS not needed in V1** — Command/Query separation adds ceremony without benefit when read and write models are the same.

## Layer Definitions

### Controllers
- Parse and validate HTTP request (params, query, body)
- Call service methods
- Format HTTP response (status code, body, headers)
- NO business logic
- NO database access

### Services
- Business logic and orchestration
- Transaction management
- Call repositories
- Throw typed errors (not HTTP-specific)
- NO HTTP request/response handling
- NO direct database access

### Repositories
- Database queries via Drizzle ORM
- Return domain types
- Single responsibility per entity
- NO business logic
- NO HTTP concerns

## Module Organization

Each feature is a self-contained module:

```
modules/
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.routes.ts
├── customers/
│   ├── customers.controller.ts
│   ├── customers.service.ts
│   ├── customers.repository.ts
│   └── customers.routes.ts
```

This vertical grouping keeps related files together, unlike the horizontal grouping (all controllers in one directory, all services in another) which becomes unwieldy as the project grows.

## Tradeoffs
- **More files** than flat route handlers. Each feature has 3-4 files instead of 1. Acceptable tradeoff for separation of concerns.
- **Boilerplate** — Simple CRUD operations require passing through all layers. Mitigated by thin controllers and services for CRUD-heavy features.
- **Overkill for simple endpoints** — A health check doesn't need a service class. Exception made for trivial endpoints (handled directly in route).

## Future Considerations
- Event-driven architecture (EventEmitter or message queue) for async operations like PDF generation
- Webhook dispatch layer for V3 integrations
- GraphQL gateway if frontend query patterns become complex (unlikely for V1)
