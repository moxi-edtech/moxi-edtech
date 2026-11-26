#!/usr/bin/env bash
set -euo pipefail
test "${PGHOST:-}" = 127.0.0.1
test "${PGDATABASE:-}" = expediente_ci
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO public.escolas VALUES('10000000-0000-0000-0000-000000000010','k12');
INSERT INTO auth.users VALUES('20000000-0000-0000-0000-000000000010');
INSERT INTO public.escola_users VALUES('10000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000010','k12','secretaria');
SQL
# Writer holds the shared close lock until commit.
PGAPPNAME=fecho-ci-writer psql -X -v ON_ERROR_STOP=1 <<'SQL' &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000010"}',true);
INSERT INTO public.alunos(escola_id,status) VALUES('10000000-0000-0000-0000-000000000010','active');
SELECT pg_sleep(3);
COMMIT;
SQL
writer=$!
trap 'kill "$writer" 2>/dev/null || true' EXIT
found=0
for attempt in $(seq 1 60); do
  if [ "$(psql -X -Atc "SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='fecho-ci-writer' AND l.locktype='advisory' AND l.granted")" -ge 1 ]; then
    found=1
    break
  fi
  sleep 0.05
done
test "$found" = 1
close_day() {
 psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000010"}',true);
SELECT public.secretaria_fechar_expediente('10000000-0000-0000-0000-000000000010',(clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date);
COMMIT;
SQL
}
close_day &
closer1=$!
close_day &
closer2=$!
wait "$writer"
wait "$closer1"
wait "$closer2"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM public.secretaria_expedientes WHERE escola_id='10000000-0000-0000-0000-000000000010')<>1 OR (SELECT operation_count FROM public.secretaria_expedientes WHERE escola_id='10000000-0000-0000-0000-000000000010')<>1 THEN RAISE EXCEPTION 'close failed to serialize committed writer'; END IF;
 IF (SELECT count(*) FROM public.eventos WHERE escola_id='10000000-0000-0000-0000-000000000010' AND tipo='secretaria.expediente.fechado')<>1 THEN RAISE EXCEPTION 'duplicate close notification event'; END IF;
END $$;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000010"}',true);
INSERT INTO public.alunos(escola_id,status) VALUES('10000000-0000-0000-0000-000000000010','active');
COMMIT;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.secretaria_expediente_operacoes WHERE escola_id='10000000-0000-0000-0000-000000000010' AND is_after_close)<>1 THEN RAISE EXCEPTION 'late mutation not recorded'; END IF;
END $$;
-- Indicative only: same synthetic write with/without capture.
BEGIN;
ALTER TABLE public.alunos DISABLE TRIGGER trg_secretaria_expediente_operation;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000010"}',true);
EXPLAIN (ANALYZE,BUFFERS,WAL) INSERT INTO public.alunos(escola_id,status) SELECT '10000000-0000-0000-0000-000000000010'::uuid,'active' FROM generate_series(1,1000);
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000010"}',true);
EXPLAIN (ANALYZE,BUFFERS,WAL) INSERT INTO public.alunos(escola_id,status) SELECT '10000000-0000-0000-0000-000000000010'::uuid,'active' FROM generate_series(1,1000);
ROLLBACK;
SQL
