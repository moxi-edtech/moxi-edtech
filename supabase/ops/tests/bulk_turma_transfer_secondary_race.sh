#!/usr/bin/env bash
set -euo pipefail
: "${PGURL:?}"
# The fixture must be disposable and exclusively owned by the test job.
case "$PGURL" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "Refusing non-local database" >&2; exit 2 ;;
esac
pauta_log="$(mktemp)"
transfer_log="$(mktemp)"
trap 'rm -f "$pauta_log" "$transfer_log"' EXIT
psql "$PGURL" -v ON_ERROR_STOP=1 >"$pauta_log" 2>&1 <<'SQL' &
BEGIN;
INSERT INTO public.pautas_oficiais
  (id,escola_id,turma_id)
VALUES
  ('00000000-0000-4000-8000-000000000041',
   '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000011');
SELECT pg_sleep(2);
COMMIT;
SQL
publisher=$!
# Give the publisher time to take the class lock.
sleep 0.4
if psql "$PGURL" -v ON_ERROR_STOP=1 >"$transfer_log" 2>&1 <<'SQL'; then
SET statement_timeout='8s';
SET test.school='00000000-0000-4000-8000-000000000001';
SET test.actor='00000000-0000-4000-8000-000000000031';
SET ROLE authenticated;
SELECT public.transferir_turma_em_lote(
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000006',
  'Verificação de concorrência com pauta oficial');
SQL
  echo "Unexpected transfer success during in-flight official pauta" >&2
  cat "$transfer_log" >&2
  wait "$publisher"
  exit 1
fi
wait "$publisher"
if ! grep -q 'P1050\|histórico\|pauta' "$transfer_log"; then
  echo "Race failed for a reason unrelated to protected academic evidence" >&2
  cat "$transfer_log" >&2
  exit 1
fi
psql "$PGURL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM public.pautas_oficiais) <> 1
    OR (SELECT count(*) FROM public.matriculas
        WHERE turma_id='00000000-0000-4000-8000-000000000011' AND ativo) <> 2
    OR (SELECT count(*) FROM public.audit_logs) <> 0
  THEN RAISE EXCEPTION 'Race mutated students or audit unexpectedly'; END IF;
END $$;
DELETE FROM public.pautas_oficiais
WHERE id='00000000-0000-4000-8000-000000000041';
SQL
echo "In-flight official pauta serialisation: PASS"
