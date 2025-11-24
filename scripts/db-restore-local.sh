#!/usr/bin/env bash
set -euo pipefail

# Restaura um dump SQL no Postgres local do Supabase.
# Uso:
#   bash scripts/db-restore-local.sh [dump.sql]
# Vars:
#   LOCAL_URL   Opcional. Padrão: postgresql://postgres:postgres@127.0.0.1:54322/postgres

LOCAL_URL=${LOCAL_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}

FILE=${1:-}
if [[ -z "$FILE" ]]; then
  # pega o mais recente em tmp/remote_public_*.sql
  FILE=$(ls -1t tmp/remote_public_*.sql 2>/dev/null | head -n1 || true)
  if [[ -z "$FILE" ]]; then
    echo "[ERR] Caminho do dump não informado e nenhum tmp/remote_public_*.sql encontrado." >&2
    exit 1
  fi
fi

if [[ ! -f "$FILE" ]]; then
  echo "[ERR] Arquivo não encontrado: $FILE" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[ERR] psql não encontrado. Instale postgresql (preferencialmente 17)." >&2
  exit 1
fi

echo "[INFO] Testando conexão local: $LOCAL_URL"
psql "$LOCAL_URL" -Atqc 'SELECT 1' >/dev/null

echo "[INFO] Preparando schemas locais"
psql "$LOCAL_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- garante schemas básicos, sem remover graphql_public (obj. do Supabase)
CREATE SCHEMA IF NOT EXISTS graphql_public;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

echo "[INFO] Restaurando arquivo: $FILE"
# Não usar ON_ERROR_STOP aqui para ignorar erros de "schema already exists" do dump
psql "$LOCAL_URL" -f "$FILE"

echo "[OK] Restauração concluída."

