#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE="${COOKIE:-}"
ESCOLA_ID="${ESCOLA_ID:-}"
EMPRESA_ID="${EMPRESA_ID:-}"
DOC_ID="${DOC_ID:-}"

if [[ -z "$COOKIE" || -z "$ESCOLA_ID" || -z "$EMPRESA_ID" ]]; then
  echo "Uso:"
  echo "  BASE_URL=http://localhost:3000 \\"
  echo "  COOKIE='next-auth.session-token=...' \\"
  echo "  ESCOLA_ID='uuid' EMPRESA_ID='uuid' \\"
  echo "  $0"
  echo
  echo "Opcional: DOC_ID para testar retificação/anulação/pdf de documento existente."
  exit 1
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="agents/outputs/FISCAL_SMOKE_AUTH_E2E_${TS}.md"

mkdir -p agents/outputs

append() {
  printf "%s\n" "$1" >> "$OUT"
}

run_step() {
  local title="$1"
  local cmd="$2"
  append "## ${title}"
  append '```bash'
  append "$cmd"
  append '```'
  append '```text'
  bash -lc "$cmd" >> "$OUT" 2>&1 || true
  append '```'
  append ""
}

cat > "$OUT" <<EOF
# Fiscal Smoke Auth E2E

timestamp_utc: ${TS}
base_url: ${BASE_URL}
escola_id: ${ESCOLA_ID}
empresa_id: ${EMPRESA_ID}

EOF

run_step \
  "1) Compliance Probe" \
  "curl -sS -i -X GET '${BASE_URL}/api/fiscal/compliance/status?probe=1' -H 'Cookie: ${COOKIE}' -H 'x-escola-id: ${ESCOLA_ID}'"

run_step \
  "2) Emissão Fiscal" \
  "curl -sS -i -X POST '${BASE_URL}/api/fiscal/documentos' -H 'Content-Type: application/json' -H 'Cookie: ${COOKIE}' -H 'x-escola-id: ${ESCOLA_ID}' --data-raw '{\"empresa_id\":\"${EMPRESA_ID}\",\"tipo_documento\":\"FT\",\"prefixo_serie\":\"FR\",\"origem_documento\":\"interno\",\"invoice_date\":\"2026-03-26\",\"moeda\":\"AOA\",\"cliente\":{\"nome\":\"Consumidor Final\",\"nif\":\"000000000\"},\"itens\":[{\"descricao\":\"Mensalidade - Smoke Fiscal\",\"quantidade\":1,\"preco_unit\":15000,\"taxa_iva\":14}]}'"

if [[ -n "$DOC_ID" ]]; then
  run_step \
    "3) Retificação (DOC_ID fornecido)" \
    "curl -sS -i -X POST '${BASE_URL}/api/fiscal/documentos/${DOC_ID}/rectificar' -H 'Content-Type: application/json' -H 'Cookie: ${COOKIE}' -H 'x-escola-id: ${ESCOLA_ID}' --data-raw '{\"motivo\":\"Correcção fiscal operacional\"}'"

  run_step \
    "4) Anulação (DOC_ID fornecido)" \
    "curl -sS -i -X POST '${BASE_URL}/api/fiscal/documentos/${DOC_ID}/anular' -H 'Content-Type: application/json' -H 'Cookie: ${COOKIE}' -H 'x-escola-id: ${ESCOLA_ID}' --data-raw '{\"motivo\":\"Anulação de validação operacional\"}'"

  run_step \
    "5) PDF Fiscal (DOC_ID fornecido)" \
    "curl -sS -i -X GET '${BASE_URL}/api/fiscal/documentos/${DOC_ID}/pdf' -H 'Cookie: ${COOKIE}' -H 'x-escola-id: ${ESCOLA_ID}'"
else
  append "## 3) Retificação/Anulação/PDF"
  append "DOC_ID não informado. Reexecute com DOC_ID para validar fluxo completo."
  append ""
fi

run_step \
  "6) Exportação SAF-T(AO)" \
  "curl -sS -i -X POST '${BASE_URL}/api/fiscal/saft/export' -H 'Content-Type: application/json' -H 'Cookie: ${COOKIE}' -H 'x-escola-id: ${ESCOLA_ID}' --data-raw '{\"empresa_id\":\"${EMPRESA_ID}\",\"periodo_inicio\":\"2026-03-01\",\"periodo_fim\":\"2026-03-31\",\"xsd_version\":\"AO_SAFT_1.01\",\"metadata\":{\"canal\":\"smoke_e2e\"}}'"

append "## Resultado"
append "Revisar status HTTP de cada passo. Critério mínimo de sucesso:"
append "- Probe: 200"
append "- Emissão: 201"
append "- Retificação: 201/200 (quando aplicável)"
append "- Anulação: 201/200 (quando aplicável)"
append "- PDF: 200 ou 409 FISCAL_PREVIEW_NOT_ALLOWED para pendente_assinatura"
append "- SAF-T: 201/202"

echo "Evidência gerada em: $OUT"
