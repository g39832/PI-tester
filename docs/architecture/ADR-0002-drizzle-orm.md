# ADR-0002: Drizzle ORM

## Status
Accepted

## Context
DDS requires type-safe database access. The backend must query PostgreSQL for customers, devices, diagnostics, reports, and audit logs. We need an ORM that provides TypeScript type safety, supports PostgreSQL-specific features (JSONB, UUID, array types), and has a lightweight footprint suitable for Raspberry Pi deployment.

## Options Considered

| Option | Description |
|---|---|
| Prisma | Full-featured ORM with schema DSL, migrations, client generation |
| Drizzle ORM | Lightweight, SQL-like, no code generation step |
| Knex.js | SQL query builder, minimal abstraction |
| Sequelize | Mature ORM, heavy, implicit behavior |
| TypeORM | Feature-rich but complex, decorator-based |

## Chosen Solution
**Drizzle ORM** with **Drizzle Kit** for migrations.

## Reasons
1. **Type safety without code generation** — Drizzle infers types directly from schema definitions. No `prisma generate` step needed. Faster iteration.
2. **SQL-like API** — Drizzle queries read like SQL. Developers who know PostgreSQL can immediately understand the query. No magic under the hood.
3. **Explicit relation handling** — No N+1 problem by default. Relations are joined explicitly in queries, not lazily loaded.
4. **JSONB support** — Native `jsonb()` column type with TypeScript inference. Critical for diagnostic payload storage.
5. **Migration control** — Drizzle Kit generates raw SQL migration files. Engineers can review and optimize before applying. No hidden migration logic.
6. **Lightweight** — Zero runtime dependencies beyond `drizzle-orm`. Smaller bundle, faster startup on Raspberry Pi.
7. **Zod integration** — `zodSchema()` utility bridges Drizzle schemas with Zod validation, ensuring DB schema and API validation share one source of truth.

## Tradeoffs
- **Smaller ecosystem** — fewer community plugins, guides, and middleware compared to Prisma
- **Manual migration authoring** — Drizzle Kit generates migrations from schema diffs, but the engineer must review them. Less automated than Prisma's `prisma migrate`
- **No migration seeding built in** — seed scripts must be written manually (which we need anyway for demo data)

## Future Considerations
- If the team struggles with Drizzle's SQL-like API, Prisma could be considered as a replacement (schemas are structured similarly)
- Drizzle's `relational queries` feature (added in v0.30+) may reduce explicit join boilerplate
