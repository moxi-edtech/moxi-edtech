#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

pnpm agents:scan

if [[ -f "REPORT_SCAN.md" ]]; then
  mv REPORT_SCAN.md agents/ACADEMIC_REPORT_SCAN.md
fi

cat > agents/outputs/REPORT_INDEX.md <<'EOF'
# Reports Index

- `agents/ACADEMIC_REPORT_SCAN.md`
- `agents/outputs/REPORT_SCAN.md`
- `agents/outputs/REPORT_IMPLEMENTATION_SESSION.md`
- `agents/outputs/REPORT_PILOT_READINESS.md`
EOF
