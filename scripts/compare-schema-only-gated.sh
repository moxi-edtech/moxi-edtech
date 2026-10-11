#!/usr/bin/env bash
# Read-only schema comparison, NOT run until full replay and a DB account with
# database-level read-only grants are available. Never prints the connection URL.
set -euo pipefail
set +x
if [[ ! -f /tmp/klasse-full-replay-green ]]; then
  echo "::warning::BLOCKED: cannot dump/compare incomplete disposable replay"
  exit 2
fi
if [[ -z "${KLASSE_PROD_READONLY_DB_URL:-}" || -z "${KLASSE_DISPOSABLE_DB_URL:-}" ]]; then
  echo "::warning::BLOCKED: read-only production DB URL or disposable DB URL not configured"
  exit 2
fi
outdir="${RUNNER_TEMP:-/tmp}/klasse-schema-compare"
mkdir -p "$outdir"
chmod 700 "$outdir"
# A database credential with read-only grants is required in addition to
# PGOPTIONS; PGOPTIONS enforces read-only even if the role were misconfigured.
PGOPTIONS='-c default_transaction_read_only=on' pg_dump \
  --schema-only --no-owner --no-privileges --schema=public \
  --dbname="$KLASSE_PROD_READONLY_DB_URL" --file="$outdir/production.sql" \
  2>"$outdir/production-dump-errors.log" || {
  echo "::error::Read-only production pg_dump failed (details not printed)"
  exit 3
}
pg_dump --schema-only --no-owner --no-privileges --schema=public \
  --dbname="$KLASSE_DISPOSABLE_DB_URL" --file="$outdir/disposable.sql" \
  2>"$outdir/disposable-dump-errors.log" || {
  echo "::error::Disposable pg_dump failed (details not printed)"
  exit 3
}
python3 - "$outdir" <<'PY'
from pathlib import Path
import re,sys,difflib
root=Path(sys.argv[1])
def normalize(path):
    out=[]
    for line in path.read_text().splitlines():
        if line.startswith('--') or not line.strip():
            continue
        if line.startswith(('SET ', 'SELECT pg_catalog.set_config', '\\restrict ', '\\unrestrict ')):
            continue
        out.append(line.rstrip())
    return out
a=normalize(root/'production.sql')
b=normalize(root/'disposable.sql')
if a==b:
    print('SCHEMA_ONLY_PUBLIC_DUMP_MATCH=true')
    (root/'comparison-status.txt').write_text('MATCH\n')
    sys.exit(0)
diff=list(difflib.unified_diff(a,b,fromfile='production',tofile='disposable'))
(root/'normalized-schema.diff').write_text('\n'.join(diff)+'\n')
obj=re.compile(r'^\s*(?:CREATE|ALTER|DROP)\s+(?:(?:OR\s+REPLACE|UNIQUE|MATERIALIZED|IF\s+(?:NOT\s+)?EXISTS)\s+)*(?:TABLE|INDEX|FUNCTION|TRIGGER|POLICY|VIEW|TYPE|SEQUENCE)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([^\s(]+)',re.I)
names=sorted(set(m.group(1) for l in diff[2:] if (m:=obj.search(l[1:]))))
(root/'objects-different.txt').write_text('\n'.join(names)+'\n')
print(f'::error::SCHEMA_ONLY_DIFF_FOUND lines={len(diff)} candidate_objects={len(names)}. Full SQL diff retained as CI-local artifact, not printed.')
sys.exit(4)
PY
