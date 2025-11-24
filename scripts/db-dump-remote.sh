#!/usr/bin/env bash
set -euo pipefail

# Dumpa schemas do banco remoto (via pooler) para um arquivo local.
# Uso:
#   DB_URL=postgresql://... bash scripts/db-dump-remote.sh [saida.sql]
# Vars:
#   DB_URL      Obrigatório. URL do pooler remoto (de preferência com sslmode=require)
#   SCHEMAS     Opcional. Padrão: public,graphql_public. Use '*' para todos os schemas.
#   DUMP_FILE   Opcional. Caminho do arquivo de saída (padrão: tmp/remote_public_YYYYmmdd_HHMMSS.sql)
#   SCHEMA_ONLY Opcional. Se setado (qualquer valor), adiciona --schema-only

if [[ -z "${DB_URL:-}" ]]; then
  echo "[ERR] DB_URL não setado. Ex.: export DB_URL='postgresql://...pooler.supabase.com:5432/postgres?sslmode=require'" >&2
  exit 1
fi

SCHEMAS_CSV=${SCHEMAS:-public,graphql_public}
IFS=',' read -r -a SCHEMA_LIST <<< "$SCHEMAS_CSV"

OUT=${1:-${DUMP_FILE:-}}
if [[ -z "$OUT" ]]; then
  mkdir -p tmp
  OUT="tmp/remote_public_$(date +%Y%m%d_%H%M%S).sql"
fi
mkdir -p "$(dirname "$OUT")"

# Anexa sslmode=require se não houver querystring
if [[ "$DB_URL" != *"?"* && "$DB_URL" != *"sslmode="* ]]; then
  DB_URL="${DB_URL}?sslmode=require"
fi

build_schema_args() {
  local args=()
  # Se SCHEMAS='*', não passa --schema (dump de todos os schemas permitidos)
  if [[ "${SCHEMAS_CSV}" == "*" ]]; then
    printf '%s\n' "${args[@]}"
    return
  fi
  for s in "${SCHEMA_LIST[@]}"; do
    s="$(echo "$s" | xargs)"
    [[ -n "$s" ]] && args+=(--schema "$s")
  done
  printf '%s\n' "${args[@]}"
}

use_local_pg_dump=false
if command -v pg_dump >/dev/null 2>&1; then
  ver=$(pg_dump --version | awk '{print $3}' | cut -d. -f1)
  if [[ "$ver" -ge 17 ]]; then
    use_local_pg_dump=true
  fi
fi

echo "[INFO] Gerando dump dos schemas: $SCHEMAS_CSV"
if $use_local_pg_dump; then
  echo "[INFO] Usando pg_dump local ($(pg_dump --version))"
  pg_args=("$DB_URL" --no-owner --no-privileges)
  if [[ -n "${SCHEMA_ONLY:-}" ]]; then
    pg_args+=(--schema-only)
  fi
  # shellcheck disable=SC2046
  pg_dump ${pg_args[@]} $(build_schema_args) -f "$OUT"
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "[ERR] pg_dump >=17 não encontrado e Docker indisponível. Instale postgresql@17 ou Docker." >&2
    exit 1
  fi
  echo "[INFO] Usando Docker image postgres:17 para pg_dump"
  extra=""
  if [[ -n "${SCHEMA_ONLY:-}" ]]; then
    extra="--schema-only"
  fi
  # shellcheck disable=SC2046
  docker run --rm -v "$PWD:/work" postgres:17 \
    pg_dump "$DB_URL" --no-owner --no-privileges $extra $(build_schema_args) -f "/work/$OUT"
fi

echo "[OK] Dump gerado em $OUT"
