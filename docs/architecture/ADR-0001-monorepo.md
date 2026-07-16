# ADR-0001: Monorepo with pnpm Workspaces

## Status
Accepted

## Context
DDS has multiple deployable components (backend API, frontend dashboard) and shared libraries (types, database schema, validation). These components share TypeScript types, Zod schemas, and configuration. Without a monorepo, each component would duplicate type definitions, leading to drift between API contracts and consumers.

## Options Considered

| Option | Description |
|---|---|
| Multiple repositories | Separate repos for backend, frontend, shared libs |
| npm workspaces | Built-in npm support for monorepos |
| pnpm workspaces | Disk-efficient, strict dependency isolation |
| Turborepo | Build orchestrator on top of pnpm/npm workspaces |
| Nx | Full-featured monorepo tool with computation caching |

## Chosen Solution
**pnpm workspaces** without Turborepo for V1.

## Reasons
1. **Disk efficiency** — pnpm uses a content-addressable store, saving significant space on Raspberry Pi deployments
2. **Strict dependency resolution** — pnpm prevents phantom dependencies (packages accessing dependencies not declared in their `package.json`)
3. **Native workspace protocol** — `"@dds/shared": "workspace:*"` syntax is clean and supported out of the box
4. **Minimal tooling overhead** — unlike Nx/Turborepo, pnpm workspaces require no additional configuration or build pipeline
5. **Solo-developer friendly** — simpler mental model; Turborepo caching adds value only when the monorepo grows beyond ~10 packages

## Tradeoffs
- **No parallel task orchestration** — pnpm runs workspace scripts sequentially by default. For V1 this is acceptable (2 apps + 2 packages). Turborepo can be added in V2 if build times become a bottleneck.
- **No remote caching** — unnecessary for V1 (single developer, single machine)
- **Cross-package watch mode** — requires `--parallel` flag; no first-class support for dev-mode orchestration

## Future Considerations
- If the project grows to 10+ packages, adopt Turborepo for build caching
- If the team grows to 3+ developers, Nx's affected command becomes valuable for CI
