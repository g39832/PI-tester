# DDS — Deployment Guide

## Version 1.0

---

## 1. Prerequisites

- Docker Engine 24+ and Docker Compose v2+
- Git
- 4GB+ RAM (Raspberry Pi 4) or 2GB+ RAM (VPS)
- PostgreSQL 16 (handled by Docker)

## 2. Development Deployment

```bash
# Clone and enter
git clone <repo-url> dispo-diagnostic-station
cd dispo-diagnostic-station

# Copy environment
cp .env.example .env

# Start stack
docker compose -f docker/docker-compose.yml up --build
```

This starts:
- Backend API on `http://localhost:3001`
- Frontend on `http://localhost:5173`
- PostgreSQL on `localhost:5432`
- Database migrations run automatically on backend start

## 3. Production Deployment

### 3.1 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | Backend port | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://dds:dds@postgres:5432/dds` |
| `JWT_SECRET` | JWT signing secret (minimum 32 chars) | (required) |
| `JWT_EXPIRES_IN` | Token expiry duration | `24h` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `UPLOAD_DIR` | File upload directory | `./uploads` |
| `REPORTS_DIR` | PDF storage directory | `./reports` |
| `LOG_LEVEL` | Winston log level | `info` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |

### 3.2 Production Stack

```bash
cp .env.example .env
# Edit .env with production values
docker compose -f docker/docker-compose.prod.yml up --build -d
```

### 3.3 Reverse Proxy (Recommended)

For production, place behind Nginx or Traefik with Let's Encrypt TLS:

```
# /etc/nginx/sites-available/dds
server {
    listen 443 ssl;
    server_name dds.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/dds.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dds.yourdomain.com/privkey.pem;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:80;  # Frontend (Nginx)
    }
}
```

### 3.4 Raspberry Pi Deployment

```bash
# On your development machine
docker compose -f docker/docker-compose.prod.yml build
docker save dds-backend:latest dds-frontend:latest | bzip2 | ssh pi@raspberrypi.local 'bunzip2 | docker load'

# On the Pi
# Ensure Docker is installed (Raspberry Pi OS Lite + Docker)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker pi

# Copy docker-compose.prod.yml and .env to Pi, then:
docker compose -f docker/docker-compose.prod.yml up -d
```

## 4. Database Migrations

Migrations run automatically on container startup. Manual run:

```bash
# From host machine with database running
docker compose exec backend pnpm --filter @dds/database migrate
```

## 5. Backup

```bash
# Database backup
docker compose exec postgres pg_dump -U dds dds > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T postgres psql -U dds dds < backup.sql
```

## 6. Monitoring

- Health check: `GET /api/v1/health`
- Container logs: `docker compose logs -f backend`
- Resource usage: `docker stats`

## 7. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Backend won't start | Database not ready | Docker Compose health check handles this; wait 30s |
| `ECONNREFUSED` on database | PostgreSQL not running | `docker compose logs postgres` |
| JWT errors | `JWT_SECRET` not set or changed | Check `.env` file |
| CORS errors | `CORS_ORIGIN` mismatch | Ensure frontend URL matches CORS_ORIGIN |
| Frontend shows blank page | Build failure | Check frontend container logs |
