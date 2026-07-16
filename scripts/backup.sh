#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "Creating database backup..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-dds}" "${POSTGRES_DB:-dds}" > "$BACKUP_DIR/dds_$TIMESTAMP.sql"
echo "Backup saved to $BACKUP_DIR/dds_$TIMESTAMP.sql"
