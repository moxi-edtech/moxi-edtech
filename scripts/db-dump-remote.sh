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

# Resolve IPv4 for host and export PGHOSTADDR to avoid IPv6 inside Docker
# This prevents "Network is unreachable" when the hostname resolves to AAAA first.
extract_host() {
  local url="$1"
  local no_proto hostpart host
  no_proto="${url#*://}"
  # strip credentials if present
  if [[ "$no_proto" == *"@"* ]]; then
    hostpart="${no_proto#*@}"
  else
    hostpart="$no_proto"
  fi
  # host ends before ':' or '/' or '?' whatever comes first
  host="${hostpart%%[:/?]*}"
  printf '%s\n' "$host"
}

resolve_ipv4() {
  local host="$1" ip=""
  # Prefer system Python if available (works on macOS/Linux)
  if command -v python3 >/dev/null 2>&1; then
    ip=$(printf '%s\n' \
      'import socket, sys' \
      'h=sys.argv[1]' \
      'try:' \
      '    print(socket.gethostbyname(h))' \
      'except Exception:' \
      '    sys.exit(1)' \
      | python3 - "$host" 2>/dev/null)
  fi
  # Fallback to dig
  if [[ -z "$ip" ]] && command -v dig >/dev/null 2>&1; then
    ip=$(dig +short A "$host" | head -n1)
  fi
  # Fallback to nslookup
  if [[ -z "$ip" ]] && command -v nslookup >/dev/null 2>&1; then
    ip=$(nslookup -type=A "$host" 2>/dev/null | awk '/^Address: /{print $2; exit}')
  fi
  printf '%s\n' "$ip"
}

HOSTNAME_ONLY=$(extract_host "$DB_URL")
HOSTADDR_V4=""
if [[ -n "$HOSTNAME_ONLY" ]]; then
  HOSTADDR_V4=$(resolve_ipv4 "$HOSTNAME_ONLY" || true)
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
  if [[ -n "$HOSTADDR_V4" ]]; then
    echo "[INFO] Preferindo IPv4: $HOSTNAME_ONLY -> $HOSTADDR_V4"
    PGHOST="$HOSTNAME_ONLY" PGHOSTADDR="$HOSTADDR_V4" pg_dump ${pg_args[@]} $(build_schema_args) -f "$OUT"
  else
    pg_dump ${pg_args[@]} $(build_schema_args) -f "$OUT"
  fi
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
  if [[ -n "$HOSTADDR_V4" ]]; then
    echo "[INFO] Preferindo IPv4 dentro do Docker: $HOSTNAME_ONLY -> $HOSTADDR_V4"
    docker run --rm -e PGHOST="$HOSTNAME_ONLY" -e PGHOSTADDR="$HOSTADDR_V4" -v "$PWD:/work" postgres:17 \
      pg_dump "$DB_URL" --no-owner --no-privileges $extra $(build_schema_args) -f "/work/$OUT"
  else
    docker run --rm -v "$PWD:/work" postgres:17 \
      pg_dump "$DB_URL" --no-owner --no-privileges $extra $(build_schema_args) -f "/work/$OUT"
  fi
fi

echo "[OK] Dump gerado em $OUT"
