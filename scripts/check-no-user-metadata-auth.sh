#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ALLOWLIST_FILE="scripts/security-user-metadata-allowlist.txt"

declare -a QUERIES=(
  'user_metadata\??\.(role|tenant_type|modelo_ensino|escola_id)'
  'user_metadata\s+as\s+[^\n]*(role|tenant_type|modelo_ensino|escola_id)'
  'app_metadata\.(role|tenant_type|modelo_ensino|escola_id)[^\n]*(\|\||\?\?)[^\n]*user_metadata'
  'user_metadata[^\n]*(\|\||\?\?)[^\n]*app_metadata\.(role|tenant_type|modelo_ensino|escola_id)'
  '\buserMetadata\.(role|tenant_type|modelo_ensino|escola_id)\b'
)

declare -a SCAN_PATHS=(
  "apps/web"
  "apps/formacao"
  "apps/auth"
)

collect_matches() {
  local query="$1"
  rg -n --no-heading --pcre2 "$query" "${SCAN_PATHS[@]}" --glob '*.ts' --glob '*.tsx' || true
}

MATCHES_RAW="$(mktemp)"
MATCHES_FILTERED="$(mktemp)"
trap 'rm -f "$MATCHES_RAW" "$MATCHES_FILTERED"' EXIT

for query in "${QUERIES[@]}"; do
  collect_matches "$query" >> "$MATCHES_RAW"
done

sort -u "$MATCHES_RAW" > "$MATCHES_FILTERED"

if [[ -s "$ALLOWLIST_FILE" ]]; then
  while IFS= read -r allow_pattern; do
    if [[ -z "$allow_pattern" || "$allow_pattern" == \#* ]]; then
      continue
    fi
    grep -F -v "$allow_pattern" "$MATCHES_FILTERED" > "${MATCHES_FILTERED}.tmp" || true
    mv "${MATCHES_FILTERED}.tmp" "$MATCHES_FILTERED"
  done < "$ALLOWLIST_FILE"
fi

if [[ -s "$MATCHES_FILTERED" ]]; then
  echo "FAIL: uso inseguro de user_metadata detectado em caminhos de auth/tenant."
  echo "Use app_metadata + membership DB (escola_users/escolas)."
  echo
  cat "$MATCHES_FILTERED"
  exit 1
fi

echo "PASS: nenhum fallback inseguro para user_metadata encontrado."
