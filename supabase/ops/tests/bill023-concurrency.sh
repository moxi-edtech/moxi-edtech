#!/usr/bin/env bash
set -euo pipefail
[[ "${PGDATABASE:-}" == bill023_fixture && "${PGHOST:-}" == 127.0.0.1 ]] || exit 2
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
pids=()
for i in $(seq 1 32); do
  (
    psql -X -qAt -v ON_ERROR_STOP=1 <<'SQL' > "$dir/$i"
SELECT set_config('fixture.user', '00000000-0000-0000-0000-000000000101', false) AS fixture_user \gset
SELECT set_config('fixture.empresa', '00000000-0000-0000-0000-000000000100', false) AS fixture_empresa \gset
SELECT numero FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000019');
SQL
  ) &
  pids+=("$!")
done
failed=0
for p in "${pids[@]}"; do
  if ! wait "$p"; then failed=1; fi
done
if (( failed )); then echo "At least one reservation session failed" >&2; exit 1; fi
cat "$dir"/[0-9]* | sort -n > "$dir/actual"
seq 1000 1031 > "$dir/expected"
diff -u "$dir/expected" "$dir/actual"
psql -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
SELECT set_config('fixture.user', '00000000-0000-0000-0000-000000000101', false) AS fixture_user \gset
SELECT set_config('fixture.empresa', '00000000-0000-0000-0000-000000000100', false) AS fixture_empresa \gset
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000019')$q$,'P0001','STATE: intervalo autorizado');
DO $$ BEGIN IF (SELECT ultimo_numero FROM public.fiscal_series WHERE id='00000000-0000-0000-0000-000000000019') <> 1031 THEN RAISE EXCEPTION 'COUNTER_MISMATCH'; END IF; END $$;
SQL
echo '32 concurrent reservations: contiguous, unique, exhausted correctly'
