#!/usr/bin/env bash
set -euo pipefail

# Dump remote Supabase schema using Dockerized pg_dump (Postgres 17)
# - Reads DB_URL from environment or .env.db
# - Writes to supabase/remote/schema.sql by default
#
# Env/flags:
#   DB_URL             Connection string. If unset, tries to source from .env.db
#   SCHEMAS            Comma-separated schemas (default: public,auth,storage)
#   OUTPUT             Output path (default: supabase/remote/schema.sql)
#   IMAGE              Docker image (default: postgres:17)
#   --schemas <list>   Override SCHEMAS (comma-separated)
#   --output <path>    Override OUTPUT
#   --image <image>    Override IMAGE

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SCHEMAS_DEFAULT="public,auth,storage"
SCHEMAS="${SCHEMAS:-$SCHEMAS_DEFAULT}"
OUTPUT="${OUTPUT:-supabase/remote/schema.sql}"
IMAGE="${IMAGE:-postgres:17}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --schemas)
      SCHEMAS="$2"; shift 2 ;;
    --output)
      OUTPUT="$2"; shift 2 ;;
    --image)
      IMAGE="$2"; shift 2 ;;
    -h|--help)
      cat <<USAGE
Usage: scripts/supabase-dump-schema.sh [--schemas public,auth,storage] [--output supabase/remote/schema.sql] [--image postgres:17]
Env vars: DB_URL (required if .env.db missing), SCHEMAS, OUTPUT, IMAGE
USAGE
      exit 0 ;;
    *)
      echo "[WARN] Ignorando argumento desconhecido: $1" >&2; shift ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERR] Docker não encontrado. Instale/inicie o Docker e tente novamente." >&2
  exit 1
fi

# Resolve IPv4 for host and export PGHOSTADDR to avoid IPv6 inside Docker
extract_host() {
  local url="$1"
  local no_proto hostpart host
  no_proto="${url#*://}"
  if [[ "$no_proto" == *"@"* ]]; then
    hostpart="${no_proto#*@}"
  else
    hostpart="$no_proto"
  fi
  host="${hostpart%%[:/?]*}"
  printf '%s\n' "$host"
}

resolve_ipv4() {
  local host="$1" ip=""
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
  if [[ -z "$ip" ]] && command -v dig >/dev/null 2>&1; then
    ip=$(dig +short A "$host" | head -n1)
  fi
  if [[ -z "$ip" ]] && command -v nslookup >/dev/null 2>&1; then
    ip=$(nslookup -type=A "$host" 2>/dev/null | awk '/^Address: /{print $2; exit}')
  fi
  printf '%s\n' "$ip"
}

# Load DB_URL from .env.db if not present
if [[ -z "${DB_URL:-}" ]]; then
  if [[ -f .env.db ]]; then
    # shellcheck disable=SC1091
    set -a && source .env.db && set +a
  fi
fi

if [[ -z "${DB_URL:-}" ]]; then
  echo "[ERR] DB_URL não definido. Exporte DB_URL ou crie .env.db com DB_URL=..." >&2
  exit 1
fi

# Precompute IPv4 host address if possible
HOSTNAME_ONLY=$(extract_host "$DB_URL")
HOSTADDR_V4=""
if [[ -n "$HOSTNAME_ONLY" ]]; then
  HOSTADDR_V4=$(resolve_ipv4 "$HOSTNAME_ONLY" || true)
fi

# Prepare output directory
OUT_DIR="$(dirname "$OUTPUT")"
mkdir -p "$OUT_DIR"

# Build --schema flags from comma list
IFS=',' read -r -a schema_arr <<< "$SCHEMAS"
SCHEMA_FLAGS=()
for s in "${schema_arr[@]}"; do
  s_trimmed="${s// /}"
  [[ -n "$s_trimmed" ]] && SCHEMA_FLAGS+=(--schema "$s_trimmed")
done

echo "[INFO] Dumping schemas: ${SCHEMAS} -> $OUTPUT"
echo "[INFO] Using image: $IMAGE"

if [[ -n "$HOSTADDR_V4" ]]; then
  echo "[INFO] Preferindo IPv4 dentro do Docker: $HOSTNAME_ONLY -> $HOSTADDR_V4"
  docker run --rm \
    -e PGHOST="$HOSTNAME_ONLY" -e PGHOSTADDR="$HOSTADDR_V4" \
    -v "$OUT_DIR:/dump" \
    "$IMAGE" \
    pg_dump "$DB_URL" \
      --schema-only \
      --no-owner --no-privileges \
      "${SCHEMA_FLAGS[@]}" \
      --exclude-schema=supabase_migrations \
      -f /dump/"$(basename "$OUTPUT")"
else
  docker run --rm \
    -v "$OUT_DIR:/dump" \
    "$IMAGE" \
    pg_dump "$DB_URL" \
      --schema-only \
      --no-owner --no-privileges \
      "${SCHEMA_FLAGS[@]}" \
      --exclude-schema=supabase_migrations \
      -f /dump/"$(basename "$OUTPUT")"
fi

wc -l "$OUTPUT" | awk '{print "[OK] Gerado:", $2, "("$1" linhas)"}'
