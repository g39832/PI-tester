# DDS — Testing Strategy

## Version 1.0

---

## 1. Testing Philosophy

- **Test behavior, not implementation.** Tests should validate that the system produces correct outputs for given inputs, not that specific functions were called.
- **High confidence, low maintenance.** Each test must earn its maintenance cost. Flaky tests are removed immediately.
- **Test the critical path.** Not every getter, not every UI component. Focus on business logic, data integrity, and API contracts.

---

## 2. Test Pyramid (V1)

```
    ╱╲
   ╱ E2E ╲         0 (V1) — Full end-to-end deferred to V2
  ╱────────╲
 ╱   API    ╲     30+ — All endpoints tested
╱────────────╲
╲ Integration ╱   20+ — Repository + service integration
 ╲──────────╱
  ╲  Unit  ╱     50+ — Service logic, validation, helpers
   ╲──────╱
```

### V1 Target: 80+ tests

---

## 3. Test Types

### 3.1 Unit Tests
**Framework:** Vitest
**Location:** Co-located with source files (`*.test.ts`)
**Scope:** Services, validation schemas, helpers, PDF generation

**What to test:**
- Service business logic with mocked repositories
- Zod schema validation (valid inputs pass, invalid inputs fail with correct errors)
- Helper functions (formatting, date math, pagination)
- PDF generation structure (correct sections, data present)

**What NOT to test:**
- Database queries (covered by integration tests)
- Controller request parsing (covered by API tests)
- Third-party libraries (Drizzle, Express, Zod)

### 3.2 Integration Tests
**Framework:** Vitest + Supertest
**Location:** `apps/backend/tests/integration/`
**Scope:** Repository + database, service + database

**Approach:**
- Test database via `pg-mem` or testcontainers
- Repository methods return correct data for valid queries
- Repository methods handle null/not-found cases
- Services correctly orchestrate multiple repository calls

### 3.3 API Tests
**Framework:** Vitest + Supertest
**Location:** `apps/backend/tests/api/`
**Scope:** Full HTTP request → response cycle

**What to test:**
- Happy path: each endpoint returns correct status and shape
- Validation: invalid bodies return 400 with correct error details
- Auth: unauthenticated requests return 401
- Auth: invalid tokens return 401
- Pagination: correct meta in list responses
- Rate limiting: exceeded limit returns 429

---

## 4. Test Data

### 4.1 Factories
Use `@dds/shared` schemas to generate valid test data:

```typescript
// factories/customer.factory.ts
import { CreateCustomerSchema } from '@dds/shared';

export function buildCustomer(overrides?: Partial<CreateCustomerInput>) {
  return CreateCustomerSchema.parse({
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '555-0100',
    ...overrides,
  });
}
```

### 4.2 Seed Data
`packages/database/src/seed.ts` provides reproducible demo data for development and integration tests.

---

## 5. Running Tests

```bash
# All tests
pnpm test

# Backend only
pnpm --filter @dds/backend test

# Frontend only
pnpm --filter @dds/frontend test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

---

## 6. CI Integration

Tests run in GitHub Actions on every push and PR:
1. `pnpm install`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test:coverage`

Pipeline fails if:
- Any test fails
- Coverage drops below 70%
- Lint or typecheck errors exist

---

## 7. V2 Testing (Not Implemented)

- E2E tests with Playwright
- Visual regression tests for PDF output
- Load testing with k6
- Security scanning with OWASP ZAP
- Fuzz testing for diagnostic upload endpoint
