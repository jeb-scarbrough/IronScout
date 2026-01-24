#!/bin/bash
# Baseline script - marks all existing migrations as applied
# Use this when the database schema exists but has no migration history
#
# Usage: ./scripts/baseline-migrations.sh

set -e

cd "$(dirname "$0")/.."

echo "=== Prisma Migration Baseline ==="
echo "This will mark all migrations as applied WITHOUT running them."
echo "Only use this if your database schema already matches the migrations."
echo ""

# Get all migration directories
MIGRATIONS=$(ls -1 migrations/ | sort)

echo "Found $(echo "$MIGRATIONS" | wc -l) migrations to baseline."
echo ""

# Mark each migration as applied
for migration in $MIGRATIONS; do
  echo "Marking as applied: $migration"
  npx prisma migrate resolve --applied "$migration"
done

echo ""
echo "=== Baseline complete ==="
echo "Run 'pnpm db:migrate:status' to verify."
