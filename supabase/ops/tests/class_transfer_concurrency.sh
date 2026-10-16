#!/usr/bin/env bash
set -euo pipefail
: "${PGURL:?}"
psql "$PGURL" -v ON_ERROR_STOP=1 <<'SQL'
UPDATE public.matriculas SET turma_id='00000000-0000-4000-8000-000000000011' WHERE id IN ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022');
TRUNCATE public.audit_logs RESTART IDENTITY;
SQL
run_transfer() {
  psql "$PGURL" -v ON_ERROR_STOP=1 -At <<SQL
SET test.school='00000000-0000-4000-8000-000000000001';
SET test.actor='00000000-0000-4000-8000-000000000031';
SELECT public.transferir_aluno_turma('$1','00000000-0000-4000-8000-000000000012','Transferência concorrente testada');
SQL
}
run_transfer '00000000-0000-4000-8000-000000000021' >/tmp/transfer-a.log 2>&1 & a=$!
run_transfer '00000000-0000-4000-8000-000000000022' >/tmp/transfer-b.log 2>&1 & b=$!
ok=0
wait "$a" && ok=$((ok+1)) || true
wait "$b" && ok=$((ok+1)) || true
cat /tmp/transfer-a.log /tmp/transfer-b.log
if [ "$ok" -ne 1 ]; then echo "Expected one successful transfer; got $ok" >&2; exit 1; fi
psql "$PGURL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM public.matriculas WHERE turma_id='00000000-0000-4000-8000-000000000012')<>1 THEN RAISE EXCEPTION 'Capacity exceeded'; END IF;
 IF (SELECT count(*) FROM public.audit_logs)<>1 THEN RAISE EXCEPTION 'Expected exactly one audit event'; END IF;
END $$;
SQL
