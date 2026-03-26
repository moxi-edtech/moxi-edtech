#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <xml_file> [xsd_version]"
  exit 1
fi

XML_FILE="$1"
XSD_VERSION="${2:-AO_SAFT_1.01}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
XSD_FILE="$REPO_ROOT/apps/web/src/lib/fiscal/xsd/${XSD_VERSION}.xsd"
OUT_FILE="$REPO_ROOT/agents/outputs/SAFT_XSD_VALIDATION_EVIDENCE_$(date -u +%Y%m%dT%H%M%SZ).md"

if [[ ! -f "$XML_FILE" ]]; then
  echo "XML não encontrado: $XML_FILE"
  exit 1
fi

if [[ ! -f "$XSD_FILE" ]]; then
  echo "XSD não encontrado: $XSD_FILE"
  exit 1
fi

if ! command -v xmllint >/dev/null 2>&1; then
  echo "xmllint não encontrado no ambiente."
  exit 1
fi

VALIDATION_OUTPUT="$(xmllint --noout --schema "$XSD_FILE" "$XML_FILE" 2>&1 || true)"
STATUS="PASS"
if ! echo "$VALIDATION_OUTPUT" | grep -qi "validates"; then
  STATUS="FAIL"
fi

XML_SHA256="$(shasum -a 256 "$XML_FILE" | awk '{print $1}')"
XSD_SHA256="$(shasum -a 256 "$XSD_FILE" | awk '{print $1}')"

cat > "$OUT_FILE" <<EOF
# SAF-T XSD Validation Evidence

timestamp_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)
status: $STATUS
xsd_version: $XSD_VERSION
xml_file: $XML_FILE
xsd_file: $XSD_FILE
xml_sha256: $XML_SHA256
xsd_sha256: $XSD_SHA256

## Validator
\`xmllint --noout --schema "$XSD_FILE" "$XML_FILE"\`

## Output
\`\`\`
$VALIDATION_OUTPUT
\`\`\`
EOF

echo "Evidência gravada em: $OUT_FILE"
echo "Status: $STATUS"

if [[ "$STATUS" != "PASS" ]]; then
  exit 2
fi
