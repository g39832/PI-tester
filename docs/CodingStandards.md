# DDS — Coding Standards

## Version 1.0

---

## 1. Language & Toolchain

- **TypeScript strict mode** enabled in all `tsconfig.json` files
- No `any` types unless absolutely necessary (and documented with `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reason`)
- Prefer `unknown` over `any` for truly dynamic data
- Null checks required: use optional chaining (`?.`) and nullish coalescing (`??`)
- Discriminated unions for complex state

## 2. Naming Conventions

| Construct | Convention | Example |
|---|---|---|
| Files | kebab-case | `customer.service.ts` |
| Classes | PascalCase | `CustomerService` |
| Interfaces | PascalCase, no `I` prefix | `CustomerResponse` |
| Types | PascalCase | `DiagnosticPayload` |
| Functions/variables | camelCase | `getCustomerById` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PAGE_SIZE` |
| Database columns | snake_case | `serial_number` |
| API JSON fields | camelCase | `serialNumber` |
| Zod schemas | PascalCase + `Schema` | `CustomerCreateSchema` |
| DTOs | PascalCase + `DTO` | `CreateCustomerDTO` |
| Enums | PascalCase | `DeviceType` |

## 3. File Organization

- One primary export per file (except index files)
- Maximum 300 lines per file. If exceeded, split by concern.
- Maximum 3 levels of nesting. Extract helper functions or early-return.
- Group imports: external → internal → relative

## 4. Function Standards

- Pure functions preferred. Side effects isolated to services.
- Async functions return `Promise<T>`, not `Promise<T | undefined>` (use `null` for absence)
- Early returns for guard clauses. No deep `if/else` nesting.

## 5. Error Handling

- Use custom error classes from `shared/errors.ts`
- Services throw typed errors; controllers catch and format
- Never `console.log` — use Winston logger
- Never expose stack traces to API responses

## 6. TypeScript Patterns

```typescript
// Prefer interfaces for public API shapes
interface CustomerResponse {
  id: string;
  name: string;
  email: string | null;
}

// Prefer types for unions and computed types
type DiagnosticStatus = 'pending' | 'completed' | 'error';

// Use satisfies for validation without widening
const config = {
  port: 3001,
} satisfies Record<string, unknown>;
```

## 7. Database Access

- All queries go through repositories, never from services
- Repositories return domain types, not Drizzle row types
- Transactions for multi-table operations
- No raw SQL in V1

## 8. API Routes

- RESTful resource naming: `/api/v1/customers`
- Plural nouns for collections
- Consistent response envelope: `{ success, data, error, meta }`
- HTTP status codes follow RFC 7231

## 9. Testing

- Test file co-located with source: `customer.service.ts` → `customer.service.test.ts`
- `describe`/`it` blocks describe behavior, not implementation
- Mock external dependencies (database) at the repository boundary
- Factories for test data (avoid hardcoded test fixtures)

## 10. Git

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- Feature branches from `main`
- Squash merge to `main`
- No commits with failing tests or type errors

## 11. Documentation

- JSDoc for all public exports (services, controllers, repositories)
- Comment *why*, not *what* — the code says what
- TODO comments include ticket number: `// TODO: DDS-123 — implement refresh token rotation`
- Module-level doc comment at top of each file

## 12. Prohibited Patterns

| Pattern | Reason | Alternative |
|---|---|---|
| `any` | Subverts type system | `unknown` with type guards |
| `!` non-null assertion | Hides real null issues | Proper null checking |
| `console.log` | Production noise | Winston logger |
| `eval` | Security hazard | Never use |
| Magic numbers | Unreadable | Named constants |
| `else` after `return` | Unnecessary nesting | Early return |
| `Function` type | Unsafe | Specific function signature |
