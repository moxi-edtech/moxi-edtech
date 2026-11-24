#!/usr/bin/env bash
set -euo pipefail
[[ "${PGDATABASE:-}" == bill023_fixture && "${PGHOST:-}" == 127.0.0.1 ]] || exit 2
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
pids=()
for i in $(seq 1 32); do
  (
    psql -X -qAt -v ON_ERROR_STOP=1 <<'SQL' > "$dir/$i"
SET fixture.user = '00000000-0000-0000-0000-000000000101';
SET fixture.empresa = '00000000-0000-0000-0000-000000000100';
SELECT numero FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000019');
SQL
  ) &
  pids+=("$!")
done
for p in "${pids[@]}"; do wait "$p"; done
cat "$dir"/[0-9]* | sort -n > "$dir/actual"
seq 1000 1031 > "$dir/expected"
diff -u "$dir/expected" "$dir/actual"
psql -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
SET fixture.user = '00000000-0000-0000-0000-000000000101';
SET fixture.empresa = '00000000-0000-0000-0000-000000000100';
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000019')$q$,'P0001','STATE: intervalo autorizado');
DO $$ BEGIN IF (SELECT ultimo_numero FROM public.fiscal_series WHERE id='00000000-0000-0000-0000-000000000019') <> 1031 THEN RAISE EXCEPTION 'COUNTER_MISMATCH'; END IF; END $$;
SQL
echo '32 concurrent reservations: contiguous, unique, exhausted correctly'
