#!/usr/bin/env bash
set -euo pipefail
[[ "${PGDATABASE:-}" == bill023_fixture && "${PGHOST:-}" == 127.0.0.1 ]] || exit 2
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
pids=()
for i in $(seq 1 32); do
  psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT numero FROM fiscal_private.reserve_number('00000000-0000-0000-0000-000000000047','00000000-0000-0000-0000-000000000100','FT','2026-11-24')" > "$dir/$i" &
  pids+=("$!")
done
failed=0
for p in "${pids[@]}"; do if ! wait "$p"; then failed=1; fi; done
if (( failed )); then exit 1; fi
cat "$dir"/[0-9]* | sort -n > "$dir/actual"
seq 1000 1031 > "$dir/expected"
diff -u "$dir/expected" "$dir/actual"
psql -X -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF (SELECT ultimo_numero FROM public.fiscal_series WHERE id='00000000-0000-0000-0000-000000000047')<>1031 THEN RAISE EXCEPTION 'counter mismatch'; END IF; END \$\$;"
echo 'BILL-045 private allocator: 32 unique consecutive reservations'
