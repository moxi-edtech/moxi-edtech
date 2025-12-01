#!/usr/bin/env bash
set -euo pipefail

echo "[info] Loading DB_URL from .env.db"
if [[ ! -f .env.db ]]; then
  echo "[err] .env.db not found at repo root" >&2
  exit 1
fi
source .env.db

if [[ -z "${DB_URL:-}" ]]; then
  echo "[err] DB_URL is not set in .env.db" >&2
  exit 1
fi

# Ensure SSL is used
if [[ "$DB_URL" != *"sslmode="* ]]; then
  DB_URL="${DB_URL}?sslmode=require"
fi

echo "[info] Using pooler URL (hidden), sslmode=require enforced"

echo "[step] supabase migration list"
supabase migration list --db-url "$DB_URL" || true

echo "[step] Repairing migration history to match local order"
# Expected local set includes (by filename prefix): 20251201090000, 20251201, 20251203
# We first ensure any date-only (20251201) is marked reverted, then re-apply in order
supabase migration repair --status reverted 20251201 --db-url "$DB_URL" || true
supabase migration repair --status applied 20251201090000 --db-url "$DB_URL" || true
supabase migration repair --status applied 20251201 --db-url "$DB_URL" || true
supabase migration repair --status applied 20251203 --db-url "$DB_URL" || true

# If an accidental 20251202 exists remotely, revert it
supabase migration repair --status reverted 20251202 --db-url "$DB_URL" || true

echo "[step] Verify migration history after repair"
supabase migration list --db-url "$DB_URL"

echo "[step] Push pending migrations (include all)"
supabase db push --include-all --db-url "$DB_URL"

echo "[done] Final migration history"
supabase migration list --db-url "$DB_URL"

