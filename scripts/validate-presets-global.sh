#!/bin/bash
set -euo pipefail

if [ -z "${DB_URL:-}" ]; then
  echo "DB_URL env var obrigatório" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql não encontrado" >&2
  exit 1
fi

count=$(psql "$DB_URL" -At -c "select count(*) from public.validate_presets_global();")
count=${count:-0}

if [ "$count" -eq 0 ]; then
  echo "✅ Presets globais válidos (0 gaps)"
  exit 0
fi

echo "❌ Presets globais com gaps: $count" >&2
psql "$DB_URL" -c "select * from public.validate_presets_global() order by preset_id, grade_level, disciplina_nome;"
exit 1
