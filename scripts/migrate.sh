#!/bin/bash
set -euo pipefail

echo "Running database migrations..."
pnpm --filter @dds/database migrate
echo "Migrations complete."
