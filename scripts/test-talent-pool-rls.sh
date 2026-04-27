#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

LOCAL_URL=${LOCAL_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}
TEST_FILE="supabase/ops/tests/regression_talent_pool_matches_rls.sql"

if [[ ! -f "$TEST_FILE" ]]; then
  echo "[ERR] Arquivo de teste não encontrado: $TEST_FILE" >&2
  exit 1
fi

psql "$LOCAL_URL" -v ON_ERROR_STOP=1 -f "$TEST_FILE"
