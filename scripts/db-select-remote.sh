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
Usage: scripts/db-select-remote.sh [--no-limit] "SQL_QUERY"
Env vars: DB_URL (required if .env.db missing)
Example: scripts/db-select-remote.sh "SELECT * FROM users LIMIT 10;"
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

if [[ -z "${DB_URL:-}" ]] && [[ -f .env.db ]]; then
  # shellcheck disable=SC1091
  set -a && source .env.db && set +a
fi

if [[ -z "${DB_URL:-}" ]]; then
  echo "[ERR] DB_URL não definido. Exporte DB_URL ou crie .env.db com DB_URL=..." >&2
  exit 1
fi

SQL_LOWER=$(printf '%s' "$SQL" | tr '[:upper:]' '[:lower:]')
if [[ ! "$SQL_LOWER" =~ ^[[:space:]]*select[[:space:]] ]]; then
  echo "[ERR] Apenas SELECT é permitido neste script." >&2
  exit 1
fi

if [[ $NO_LIMIT -eq 0 ]] && [[ ! "$SQL_LOWER" =~ limit[[:space:]]+[0-9]+ ]]; then
  SQL="${SQL%;} LIMIT 100;"
  echo "[WARN] SELECT sem LIMIT detectado. Aplicando LIMIT 100." >&2
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -P pager=off -c "$SQL"
