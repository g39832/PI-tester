# ADR-0003: PostgreSQL

## Status
Accepted

## Context
DDS needs a relational database that supports structured entity data (customers, devices, technicians), flexible document-style storage (diagnostic payloads), full-text search, and reliable ACID transactions.

## Options Considered

| Option | Description |
|---|---|
| PostgreSQL | Mature RDBMS with JSONB, full-text search, extensive ecosystem |
| SQLite | Embedded, zero-config, file-based |
| MySQL | Popular RDBMS, weaker JSON support than PostgreSQL |
| MongoDB | Document database, no relations, no joins |

## Chosen Solution
**PostgreSQL 16**

## Reasons
1. **JSONB data type** — Diagnostic PowerShell payloads have variable structure. JSONB allows storing the full payload while indexing specific paths. Unlike MongoDB, JSONB coexists with relational tables.
2. **Full-text search** — Built-in `tsvector`/`tsquery` for searching across customers, devices, and diagnostics. No external search service needed in V1.
3. **UUID support** — Native `gen_random_uuid()` and `uuid` type for primary keys. Essential for eventual multi-shop sync.
4. **ACID compliance** — Diagnostic uploads involve creating/updating multiple rows (device, diagnostic, audit log). Transactions ensure consistency.
5. **Maturity** — PostgreSQL is battle-tested in production environments of all scales. Extensive documentation, tooling, and community.
6. **Raspberry Pi support** — Official ARM64 Docker images available. Runs well on 4GB RAM with tuned configuration.
7. **No license cost** — PostgreSQL is MIT-licensed. No per-core or per-server fees.

## Tradeoffs
- **Higher resource usage than SQLite** — SQLite would use less memory, but lacks JSONB querying and concurrent write support
- **Operational overhead** — Requires connection pooling, backup strategy, tuning. SQLite would be zero-config
- **Single-node only in V1** — PostgreSQL replication adds complexity. Acceptable for V1; multi-node read replicas deferred to V2+

## Future Considerations
- Connection pooling via PgBouncer when concurrent connections exceed 50
- Read replicas for reporting queries in V3+
- TimescaleDB extension for time-series diagnostic data in V3+
