# DDS — Contributing Guide

## Version 1.0

---

## 1. Welcome

DDS is a commercial product developed by Dispo.Tech LLC. This guide exists for current and future team members.

## 2. Development Setup

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker Desktop 4+

### First-Time Setup

```bash
# Clone
git clone <repo-url> dispo-diagnostic-station
cd dispo-diagnostic-station

# Install dependencies
pnpm install

# Copy environment
cp .env.example .env

# Start infrastructure (PostgreSQL)
docker compose -f docker/docker-compose.yml up -d postgres

# Run database migrations
pnpm --filter @dds/database migrate

# Seed demo data
pnpm --filter @dds/database seed

# Start development
pnpm dev
```

## 3. Development Workflow

### 3.1 Branch Strategy

```
main         — Production-ready code
├── feat/*   — New features
├── fix/*    — Bug fixes
├── chore/*  — Tooling, dependencies, CI
└── docs/*   — Documentation
```

### 3.2 Commit Convention

```
<type>(<scope>): <description>

Types: feat, fix, chore, docs, test, refactor, style
Scope: backend, frontend, shared, database, docker, ci

Examples:
  feat(backend): add customer search endpoint
  fix(frontend): correct dark mode toggle persistence
  chore(deps): update drizzle-orm to 0.30
```

### 3.3 PR Process

1. Create feature branch from `main`
2. Implement changes following Coding Standards
3. Ensure all tests pass: `pnpm check`
4. Run linter: `pnpm lint`
5. Typecheck: `pnpm typecheck`
6. Create PR with description of changes
7. Squash merge to `main`

### 3.4 Code Review Checklist

- [ ] Does the code follow Coding Standards?
- [ ] Are there tests for new functionality?
- [ ] Do all existing tests still pass?
- [ ] Is the API contract maintained or updated?
- [ ] Are validation schemas updated?
- [ ] Are security concerns addressed?
- [ ] Is documentation updated?
- [ ] Are there no `console.log` statements?
- [ ] Are error paths handled?

## 4. Package Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | Run TypeScript compiler checks |
| `pnpm test` | Run all tests |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm check` | lint + typecheck + test (pre-merge gate) |
| `pnpm clean` | Remove all `node_modules` and build output |

## 5. Project Communication

- Issues tracked in GitHub Issues
- ADRs stored in `docs/architecture/` — mandatory for any significant technical decision
- Architecture discussions happen before implementation, not during code review

## 6. Onboarding

New developers should:
1. Read all documents in `docs/`
2. Set up local development environment
3. Review the ADRs to understand technical decisions
4. Complete a small bug fix (labeled `good first issue`)
5. Implement a vertical slice feature

## 7. Releases

- V1 follows manual release process
- Tagged with semantic version: `v1.0.0`
- Release notes generated from commit messages
- Docker images tagged with version and `latest`
