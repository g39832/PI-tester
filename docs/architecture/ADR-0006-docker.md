# ADR-0006: Docker & Docker Compose

## Status
Accepted

## Context
DDS must run on disparate environments: developer laptops (macOS/Windows), CI pipelines (Linux), and production (Raspberry Pi 4 ARM64). Each environment has different Node.js versions, PostgreSQL versions, and system configurations. We need reproducible environments across all stages.

## Options Considered

| Option | Description |
|---|---|
| Docker Compose | Multi-container Docker orchestration |
| Podman | Rootless container alternative |
| Manual setup | Install Node.js, PostgreSQL directly on host |
| Vagrant | Full VM provisioning |

## Chosen Solution
**Docker Compose** for both development and production.

## Reasons
1. **Environment parity** — Development, CI, and production run identical container images. Eliminates "works on my machine" bugs.
2. **Raspberry Pi ARM64 support** — Docker provides official ARM64 images for PostgreSQL, Node.js. Docker Compose works on Raspberry Pi OS.
3. **Single dependency** — Developers only need Docker Desktop (or Docker Engine + Compose). No need to install PostgreSQL, Node.js, or any other tooling on the host.
4. **Health checks** — Docker Compose health checks ensure the backend waits for PostgreSQL to be ready before starting.
5. **Production path** — The same Compose file (with minimal changes) can deploy to production. No context switch between dev and deploy tooling.

## Tradeoffs
- **Performance overhead** — Docker adds ~5-10% CPU/memory overhead vs. native. Acceptable on Raspberry Pi 4 for V1 traffic levels.
- **Disk usage** — Docker images consume disk space. Mitigated by multi-stage builds and Alpine-based images.
- **Learning curve** — Team members must understand Docker concepts. Mitigated by scripting common operations.

## Image Strategy
- **Base image**: `node:20-alpine` for backend (small, secure)
- **Frontend**: Multi-stage build — `node:20-alpine` to build, `nginx:alpine` to serve
- **Database**: `postgres:16-alpine`
- **No root containers**: All services run as non-root user

## Future Considerations
- `docker compose profiles` for optional services (PgAdmin, monitoring)
- Kubernetes manifests for V3+ multi-shop cloud deployment
- Docker layer caching in CI for faster builds
