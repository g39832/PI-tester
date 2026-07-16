#!/bin/bash
set -euo pipefail

echo "Seeding database..."
pnpm --filter @dds/database seed
echo "Seed complete."
