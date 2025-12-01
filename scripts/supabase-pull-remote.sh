#!/usr/bin/env bash
set -euo pipefail

# Pulls schema from the remote Supabase project into supabase/migrations
# - Ignores local Docker and services
# - Temporarily disables realtime/storage in config to avoid known migration issues
#
# Environment variables:
#   PROJECT_REF         Optional. Supabase project ref (e.g., abcdefghijklmnopqrstu). If not set, must be linked already.
#   SCHEMAS             Optional. Comma-separated schemas. Default: public,graphql_public
#   SUPABASE_PROFILE    Optional. CLI profile name. Default: supabase
#   DB_URL              Optional. If provided, pulls from this URL instead of linked project.
#   SKIP_TOGGLE         Optional. If set (to any value), do not toggle config (advanced).

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKDIR="$ROOT_DIR"
CONFIG="$WORKDIR/supabase/config.toml"
SCHEMAS="${SCHEMAS:-public,graphql_public}"
PROFILE_FLAG=(--profile "${SUPABASE_PROFILE:-supabase}")

if ! command -v supabase >/dev/null 2>&1; then
  echo "[ERR] Supabase CLI não encontrado. Instale-o e tente novamente." >&2
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "[ERR] Arquivo $CONFIG não encontrado. Rode dentro do repo do projeto." >&2
  exit 1
fi

# Verifica login (não interativo). Se falhar, peça para rodar `supabase login`.
if ! supabase projects list "${PROFILE_FLAG[@]}" >/dev/null 2>&1; then
  echo "[ERR] Não autenticado no Supabase CLI. Execute: supabase login" >&2
  exit 1
fi

# Garante link do projeto, se PROJECT_REF for fornecido e ainda não houver .temp.
if [[ ! -f "$WORKDIR/supabase/.temp/project-ref" ]]; then
  if [[ -n "${PROJECT_REF:-}" ]]; then
    echo "[INFO] Linkando projeto $PROJECT_REF..."
    supabase link --project-ref "$PROJECT_REF" --yes "${PROFILE_FLAG[@]}" --workdir "$WORKDIR"
  else
    echo "[WARN] Projeto não está linkado e PROJECT_REF não foi fornecido. Tentando continuar mesmo assim..." >&2
  fi
fi

BACKUP="$CONFIG.bak"
restore_config() {
  if [[ -f "$BACKUP" ]]; then
    mv "$BACKUP" "$CONFIG"
  fi
}
trap restore_config EXIT

# Desativa temporariamente realtime/storage para evitar erros de migração internos.
if [[ -z "${SKIP_TOGGLE:-}" ]]; then
  cp "$CONFIG" "$BACKUP"
  awk '
    BEGIN{section=""}
    /^\[/{section=$0}
    {line=$0}
    section=="[realtime]" && $0 ~ /^enabled\s*=\s*true\s*$/ { sub(/true/ , "false", line) }
    section=="[storage]"  && $0 ~ /^enabled\s*=\s*true\s*$/ { sub(/true/ , "false", line) }
    {print line}
  ' "$BACKUP" > "$CONFIG"
fi

# Tenta carregar DB_URL de .env.db, se não fornecido no ambiente
if [[ -z "${DB_URL:-}" ]] && [[ -f "$WORKDIR/.env.db" ]]; then
  # shellcheck disable=SC1091
  set -a && source "$WORKDIR/.env.db" && set +a
fi

echo "[INFO] Iniciando pull remoto (schemas=$SCHEMAS) ..."

PULL_ARGS=(db pull --schema "$SCHEMAS" --yes --workdir "$WORKDIR" "${PROFILE_FLAG[@]}")
if [[ -n "${DB_URL:-}" ]]; then
  PULL_ARGS+=(--db-url "$DB_URL")
fi

# Prefer IPv4 when DB_URL is provided, to avoid IPv6 issues inside containers
extract_host() {
  local url="$1" no_proto hostpart host
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

HOSTADDR_V4=""
HOSTNAME_ONLY=""
if [[ -n "${DB_URL:-}" ]]; then
  HOSTNAME_ONLY=$(extract_host "$DB_URL")
  if [[ -n "$HOSTNAME_ONLY" ]]; then
    HOSTADDR_V4=$(resolve_ipv4 "$HOSTNAME_ONLY" || true)
  fi
fi

set +e
if [[ -n "$HOSTADDR_V4" ]]; then
  echo "[INFO] Preferindo IPv4 para db pull: $HOSTNAME_ONLY -> $HOSTADDR_V4"
  PGHOST="$HOSTNAME_ONLY" PGHOSTADDR="$HOSTADDR_V4" supabase "${PULL_ARGS[@]}"
else
  supabase "${PULL_ARGS[@]}"
fi
status=$?
set -e

# Restaura o config antes de checar resultado
restore_config
trap - EXIT

# Mostra o arquivo de migração mais recente, se existir
if ls "$WORKDIR"/supabase/migrations/*.sql >/dev/null 2>&1; then
  latest=$(ls -1t "$WORKDIR"/supabase/migrations/*.sql | head -n 1)
  echo "[INFO] Última migração gerada/atualizada: $latest"
fi

if [[ $status -ne 0 ]]; then
  echo "[WARN] supabase db pull retornou status $status. Verifique logs acima; em alguns casos o arquivo é gerado mesmo com exit code != 0." >&2
  exit $status
fi

echo "[OK] Pull remoto concluído."
