# ADR-0004: JSONB Diagnostic Storage with Denormalized Query Columns

## Status
Accepted

## Context
The Windows PowerShell diagnostic script collects a rich, variable-shaped payload covering CPU, RAM, storage, SMART, battery, motherboard, BIOS, serial number, Windows version, drivers, TPM, Secure Boot, network, temperatures, event logs, and Windows Updates. Not all fields are present in every payload (depending on Windows version, hardware capabilities, script version). The storage strategy must balance queryability against schema flexibility.

## Options Considered

| Option | Description |
|---|---|
| Fully normalized | Every diagnostic field in its own column/table |
| Fully JSONB | Entire payload stored in a single JSONB column |
| Hybrid | JSONB for the full payload + denormalized key columns for common queries |

## Chosen Solution
**Hybrid: JSONB payload with denormalized query columns.**

The `diagnostics` table has:
- `payload` (JSONB, NOT NULL) — complete, unmodified diagnostic payload
- `cpu_model` (VARCHAR, NULLABLE) — denormalized for filtering/sorting
- `ram_gb` (NUMERIC, NULLABLE) — denormalized for filtering/sorting
- `storage_gb` (NUMERIC, NULLABLE) — denormalized for filtering/sorting
- `os_version` (VARCHAR, NULLABLE) — denormalized for filtering/sorting
- `serial_number` (VARCHAR, NULLABLE) — denormalized for search
- `warnings` (JSONB, NULLABLE) — extracted warnings array
- `is_healthy` (BOOLEAN, NULLABLE) — computed health flag

## Reasons
1. **Schema flexibility** — The PowerShell script will evolve. New fields appear, old fields change shape. JSONB accommodates this without migrations.
2. **Query performance** — Common dashboard queries (filter by OS, sort by RAM, search by serial) would require JSONB path queries (`payload->'cpu'->>'model'`) that:
   - Cannot use standard B-tree indexes
   - Are slower than column lookups
   - Require GIN indexes for reasonable performance
3. **Partial data handling** — JSONB naturally handles missing fields. The schema doesn't break when a payload lacks battery data (desktop PC) or TPM info (older Windows).
4. **Data preservation** — The full `payload` column preserves every detail the script sent. No information loss. The denormalized columns are extracted at insert time.
5. **Future-proof** — If we add AI diagnostics in V2, the full payload is available for analysis without schema changes.

## Tradeoffs
- **Data duplication** — Key fields exist in both JSONB and columns. Storage cost is negligible (text fields).
- **Extraction logic** — Service code must extract denormalized columns on insert. Adds ~10 lines of mapping logic.
- **Schema drift risk** — If the PowerShell script changes field paths (e.g., `cpu.model` → `processor.model`), extraction logic must be updated. Mitigated by having the full payload always available.

## Future Considerations
- If query patterns shift, additional denormalized columns can be added via migration without touching existing data
- PostgreSQL GIN indexes on JSONB paths can be added if JSONB-only queries become necessary
- The `payload` schema should be versioned (add `payload_version` column) when the script evolves significantly
