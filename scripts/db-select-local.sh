#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

NO_LIMIT=0
SQL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-limit)
      NO_LIMIT=1; shift ;;
    -h|--help)
      cat <<USAGE
Usage: scripts/db-select-local.sh [--no-limit] "SQL_QUERY"
Env vars: LOCAL_URL (optional, default local Supabase 54322)
Example: scripts/db-select-local.sh "SELECT * FROM users LIMIT 10;"
USAGE
      exit 0 ;;
    *)
      SQL="$1"; shift ;;
  esac
done

if [[ -z "$SQL" ]]; then
  echo "[ERR] Informe uma query SQL." >&2
  exit 1
fi

LOCAL_URL=${LOCAL_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}

SQL_LOWER=$(printf '%s' "$SQL" | tr '[:upper:]' '[:lower:]')
if [[ ! "$SQL_LOWER" =~ ^[[:space:]]*select[[:space:]] ]]; then
  echo "[ERR] Apenas SELECT é permitido neste script." >&2
  exit 1
fi

if [[ $NO_LIMIT -eq 0 ]] && [[ ! "$SQL_LOWER" =~ limit[[:space:]]+[0-9]+ ]]; then
  SQL="${SQL%;} LIMIT 100;"
  echo "[WARN] SELECT sem LIMIT detectado. Aplicando LIMIT 100." >&2
fi

psql "$LOCAL_URL" -v ON_ERROR_STOP=1 -P pager=off -c "$SQL"
