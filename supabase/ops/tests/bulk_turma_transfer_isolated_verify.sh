#!/usr/bin/env bash
set -euo pipefail
# AUT-002: apenas PostgreSQL EFÉMERO/Vazio em localhost, nunca produção.
# PGURL=postgresql://localhost:5432/klasse_transfer_test bash \
#   supabase/ops/tests/bulk_turma_transfer_isolated_verify.sh
: "${PGURL:?Aponte a BD de teste local vazia via PGURL.}"
case "$PGURL" in
  *localhost*|*127.0.0.1*) ;;
  *) echo "Recusado: apenas localhost/127.0.0.1, nunca Supabase remoto." >&2; exit 2 ;;
esac
command -v psql >/dev/null || { echo "psql não instalado" >&2; exit 2; }
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DBNAME="$(psql "$PGURL" -v ON_ERROR_STOP=1 -Atqc "SELECT current_database()")"
case "$DBNAME" in
  klasse_transfer_test*|klasse_transfer_isolated*) ;;
  *) echo "Recusado: base de dados '$DBNAME' não é efémera de transferências." >&2; exit 2 ;;
esac
EXISTING="$(psql "$PGURL" -v ON_ERROR_STOP=1 -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('matriculas','turmas','notas','audit_logs')")"
if [[ "$EXISTING" != "0" ]]; then
  echo "Recusado: BD não está vazia. Crie uma nova BD isolada." >&2
  exit 2
fi

psql "$PGURL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/ops/tests/bulk_turma_transfer_isolated_bootstrap.sql"
psql "$PGURL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261104133500_bulk_turma_transfer_atomic.sql"
psql "$PGURL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/ops/tests/bulk_turma_transfer_isolated_regression.sql"

# A e C concorrem pela mesma turma destino; apenas uma cabe.
log_a="$(mktemp)" log_b="$(mktemp)"
trap 'rm -f "$log_a" "$log_b"' EXIT
do_transfer() {
  local source="$1"
  psql "$PGURL" -v ON_ERROR_STOP=1 -At <<SQL
SET statement_timeout = '45s';
SET test.school = '00000000-0000-4000-8000-000000000001';
SET test.actor = '00000000-0000-4000-8000-000000000031';
SET ROLE authenticated;
SELECT public.transferir_turma_em_lote(
 '$source','00000000-0000-4000-8000-000000000012',
 '00000000-0000-4000-8000-000000000006',
 'Teste de concorrência com capacidade controlada');
SQL
}
do_transfer '00000000-0000-4000-8000-000000000011' >"$log_a" 2>&1 & a=$!
do_transfer '00000000-0000-4000-8000-000000000013' >"$log_b" 2>&1 & b=$!
successes=0
if wait "$a"; then successes=$((successes+1)); fi
if wait "$b"; then successes=$((successes+1)); fi
if [[ "$successes" -ne 1 ]]; then
  echo "Erro: esperada uma transferência vencedora, obtidas $successes" >&2
  cat "$log_a" "$log_b" >&2
  exit 1
fi
psql "$PGURL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE dest_count integer; moved_a integer; moved_c integer; audit_count integer;
BEGIN
  SELECT count(*) INTO dest_count FROM public.matriculas
  WHERE turma_id='00000000-0000-4000-8000-000000000012' AND ativo;
  SELECT count(*) INTO moved_a FROM public.matriculas
  WHERE turma_id='00000000-0000-4000-8000-000000000011' AND ativo;
  SELECT count(*) INTO moved_c FROM public.matriculas
  WHERE turma_id='00000000-0000-4000-8000-000000000013' AND ativo;
  SELECT count(*) INTO audit_count FROM public.audit_logs
  WHERE action='MATRICULA_TRANSFERIDA';
  IF dest_count < 1 OR dest_count > 2
     OR dest_count <> audit_count
     OR moved_a NOT IN (0,2) OR moved_c NOT IN (0,1)
     OR moved_a + moved_c + dest_count <> 3 THEN
    RAISE EXCEPTION 'Concorrência: lotação, auditoria ou atomicidade incorreta';
  END IF;
END $$;
SQL
echo "Homologação SQL isolada e concorrência: PASS (somente BD local sintética)."
