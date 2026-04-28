#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE="${COOKIE:-}"
AUTH_BEARER="${AUTH_BEARER:-}"
ESCOLA_ID="${ESCOLA_ID:-}"
EMPRESA_ID="${EMPRESA_ID:-}"
LOGIN_EMAIL="${LOGIN_EMAIL:-}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-}"
NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}"
NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"
YEAR="$(date +%Y)"
FT_PREFIXO_SERIE="${FT_PREFIXO_SERIE:-FR}"
RC_PREFIXO_SERIE="${RC_PREFIXO_SERIE:-RC}"
TEST_FOREIGN_CURRENCY="${TEST_FOREIGN_CURRENCY:-0}"
COOKIE_JAR="$(mktemp)"

if [[ -z "$COOKIE" && -z "$AUTH_BEARER" && -n "$LOGIN_EMAIL" && -n "$LOGIN_PASSWORD" ]]; then
  if [[ -z "$NEXT_PUBLIC_SUPABASE_URL" || -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]]; then
    echo "[ERR] Login automático requer SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY." >&2
    exit 1
  fi

  PROJECT_REF="$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's#https?://([^.]+)\..*#\1#')"
  AUTH_JSON="$(curl -sS -X POST "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    --data-raw "{\"email\":\"${LOGIN_EMAIL}\",\"password\":\"${LOGIN_PASSWORD}\"}")"

  ACCESS_TOKEN="$(printf '%s' "$AUTH_JSON" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p' | head -n1)"
  REFRESH_TOKEN="$(printf '%s' "$AUTH_JSON" | sed -n 's/.*"refresh_token":"\([^"]*\)".*/\1/p' | head -n1)"

  if [[ -z "$ACCESS_TOKEN" || -z "$REFRESH_TOKEN" ]]; then
    echo "[ERR] Falha no login automático. Resposta auth: $AUTH_JSON" >&2
    exit 1
  fi

  # O auth cookie esperado pelo @supabase/ssr usa o payload completo de sessão.
  COOKIE_PAYLOAD="$(printf '%s' "$AUTH_JSON" | tr -d '\n')"
  COOKIE_B64="$(printf '%s' "$COOKIE_PAYLOAD" | base64 | tr -d '\n')"
  COOKIE="sb-${PROJECT_REF}-auth-token=base64-${COOKIE_B64}"
fi

if [[ (-z "$COOKIE" && -z "$AUTH_BEARER") || -z "$ESCOLA_ID" || -z "$EMPRESA_ID" ]]; then
  echo "Uso:"
  echo "  BASE_URL=http://localhost:3000 \\" 
  echo "  COOKIE='nome1=valor1; nome2=valor2' OU AUTH_BEARER='eyJ...' \\" 
  echo "  ESCOLA_ID='uuid' EMPRESA_ID='uuid' \\" 
  echo "  FT_PREFIXO_SERIE='FR' RC_PREFIXO_SERIE='RC' \\" 
  echo "  (opcional) LOGIN_EMAIL='user@dominio' LOGIN_PASSWORD='senha' para login automático \\" 
  echo "  $0"
  echo
  echo "Opcional: TEST_FOREIGN_CURRENCY=1 para emitir um documento em moeda estrangeira."
  exit 1
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="agents/outputs/FISCAL_SMOKE_AUTH_E2E_${TS}.md"
TMP_DIR="$(mktemp -d)"
LAST_STATUS=""
LAST_BODY=""
STATUS_STEP_1=""
STATUS_STEP_2=""
STATUS_STEP_3=""
STATUS_STEP_4=""
STATUS_STEP_5=""
STATUS_STEP_6=""
STATUS_STEP_7=""
STATUS_STEP_8=""
STATUS_STEP_9=""

cleanup() {
  rm -f "$COOKIE_JAR"
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p agents/outputs

append() {
  printf "%s\n" "$1" >> "$OUT"
}

extract_documento_id() {
  local file="$1"
  sed -n 's/.*"documento_id":"\([^"]*\)".*/\1/p' "$file" | head -n1
}

run_api_step() {
  local title="$1"
  local method="$2"
  local path="$3"
  local data="${4:-}"

  local body_file="$TMP_DIR/body_$(date +%s%N).json"
  local header_file="$TMP_DIR/header_$(date +%s%N).txt"
  local auth_preview="Cookie: ***"
  if [[ -n "$AUTH_BEARER" ]]; then
    auth_preview="Authorization: Bearer ***"
  fi
  local cmd_preview="curl -sS -X ${method} '${BASE_URL}${path}' -H '${auth_preview}' -H 'x-escola-id: ${ESCOLA_ID}'"

  if [[ "$method" != "GET" ]]; then
    cmd_preview+=" -H 'Content-Type: application/json' --data-raw '${data}'"
  fi

  append "## ${title}"
  append '```bash'
  append "$cmd_preview"
  append '```'

  if [[ "$method" == "GET" ]]; then
    if [[ -n "$AUTH_BEARER" ]]; then
      LAST_STATUS="$(curl -L -sS -o "$body_file" -D "$header_file" -w "%{http_code}" -X "$method" "${BASE_URL}${path}" -H "Authorization: Bearer ${AUTH_BEARER}" -H "x-escola-id: ${ESCOLA_ID}")"
    else
      LAST_STATUS="$(curl -L -sS -o "$body_file" -D "$header_file" -w "%{http_code}" -X "$method" "${BASE_URL}${path}" -H "Cookie: ${COOKIE}" -H "x-escola-id: ${ESCOLA_ID}" -c "$COOKIE_JAR" -b "$COOKIE_JAR")"
    fi
  else
    if [[ -n "$AUTH_BEARER" ]]; then
      LAST_STATUS="$(curl -L -sS -o "$body_file" -D "$header_file" -w "%{http_code}" -X "$method" "${BASE_URL}${path}" -H "Content-Type: application/json" -H "Authorization: Bearer ${AUTH_BEARER}" -H "x-escola-id: ${ESCOLA_ID}" --data-raw "$data")"
    else
      LAST_STATUS="$(curl -L -sS -o "$body_file" -D "$header_file" -w "%{http_code}" -X "$method" "${BASE_URL}${path}" -H "Content-Type: application/json" -H "Cookie: ${COOKIE}" -H "x-escola-id: ${ESCOLA_ID}" --data-raw "$data" -c "$COOKIE_JAR" -b "$COOKIE_JAR")"
    fi
  fi

  LAST_BODY="$body_file"

  append "status_http: ${LAST_STATUS}"
  append '```http'
  sed -n '1,20p' "$header_file" >> "$OUT"
  append '```'
  append '```json'
  cat "$body_file" >> "$OUT"
  append ""
  append '```'
  append ""
}

cat > "$OUT" <<MARKDOWN
# Fiscal Smoke Auth E2E

timestamp_utc: ${TS}
base_url: ${BASE_URL}
escola_id: ${ESCOLA_ID}
empresa_id: ${EMPRESA_ID}
ft_prefixo_serie: ${FT_PREFIXO_SERIE}
rc_prefixo_serie: ${RC_PREFIXO_SERIE}

MARKDOWN

run_api_step \
  "1) Compliance Probe" \
  "GET" \
  "/api/fiscal/compliance/status?probe=1"
STATUS_STEP_1="$LAST_STATUS"

FT_A_PAYLOAD="{\"empresa_id\":\"${EMPRESA_ID}\",\"tipo_documento\":\"FT\",\"prefixo_serie\":\"${FT_PREFIXO_SERIE}\",\"origem_documento\":\"interno\",\"invoice_date\":\"$(date +%F)\",\"moeda\":\"AOA\",\"cliente\":{\"nome\":\"Consumidor final\"},\"itens\":[{\"descricao\":\"Mensalidade - Smoke FT\",\"product_code\":\"SERV_MENSALIDADE\",\"quantidade\":1,\"preco_unit\":15000,\"taxa_iva\":14}]}"
run_api_step \
  "2) Emissão FT padrão (AOA, ProductNumberCode fallback)" \
  "POST" \
  "/api/fiscal/documentos" \
  "$FT_A_PAYLOAD"
STATUS_STEP_2="$LAST_STATUS"
FT_A_DOC_ID=""
if [[ "$LAST_STATUS" == "201" ]]; then
  FT_A_DOC_ID="$(extract_documento_id "$LAST_BODY")"
fi

FT_B_PAYLOAD="{\"empresa_id\":\"${EMPRESA_ID}\",\"tipo_documento\":\"FT\",\"prefixo_serie\":\"${FT_PREFIXO_SERIE}\",\"origem_documento\":\"interno\",\"invoice_date\":\"$(date +%F)\",\"moeda\":\"AOA\",\"cliente\":{\"nome\":\"Pai sem NIF\"},\"itens\":[{\"descricao\":\"Propina Isenta\",\"product_code\":\"SERV_PROPINA_ISENTA\",\"quantidade\":1,\"preco_unit\":10000,\"taxa_iva\":0,\"tax_exemption_code\":\"M07\",\"tax_exemption_reason\":\"Isencao de IVA - servicos de educacao\"}]}"
run_api_step \
  "3) Emissão FT isenta (IVA=0 com TaxExemption*)" \
  "POST" \
  "/api/fiscal/documentos" \
  "$FT_B_PAYLOAD"
STATUS_STEP_3="$LAST_STATUS"
FT_B_DOC_ID=""
if [[ "$LAST_STATUS" == "201" ]]; then
  FT_B_DOC_ID="$(extract_documento_id "$LAST_BODY")"
fi

RC_PAYLOAD="{\"empresa_id\":\"${EMPRESA_ID}\",\"tipo_documento\":\"RC\",\"prefixo_serie\":\"${RC_PREFIXO_SERIE}\",\"origem_documento\":\"interno\",\"invoice_date\":\"$(date +%F)\",\"moeda\":\"AOA\",\"payment_mechanism\":\"TB\",\"cliente\":{\"nome\":\"Consumidor final\"},\"itens\":[{\"descricao\":\"Recebimento de mensalidade\",\"product_code\":\"SERV_RECEB_MENSAL\",\"quantidade\":1,\"preco_unit\":5000,\"taxa_iva\":14}]}"
run_api_step \
  "4) Emissão RC com PaymentMechanism" \
  "POST" \
  "/api/fiscal/documentos" \
  "$RC_PAYLOAD"
STATUS_STEP_4="$LAST_STATUS"

if [[ "$TEST_FOREIGN_CURRENCY" == "1" ]]; then
  FX_PAYLOAD="{\"empresa_id\":\"${EMPRESA_ID}\",\"tipo_documento\":\"FT\",\"prefixo_serie\":\"${FT_PREFIXO_SERIE}\",\"origem_documento\":\"interno\",\"invoice_date\":\"$(date +%F)\",\"moeda\":\"USD\",\"taxa_cambio_aoa\":920,\"cliente\":{\"nome\":\"Cliente USD\",\"nif\":\"999999999\"},\"itens\":[{\"descricao\":\"Servico em moeda externa\",\"product_code\":\"SERV_USD\",\"product_number_code\":\"SERV_USD\",\"quantidade\":1,\"preco_unit\":50,\"taxa_iva\":14}]}"
  run_api_step \
    "5) Emissão FT em moeda estrangeira (USD)" \
    "POST" \
    "/api/fiscal/documentos" \
    "$FX_PAYLOAD"
  STATUS_STEP_5="$LAST_STATUS"
else
  append "## 5) Emissão FT em moeda estrangeira"
  append "skip: TEST_FOREIGN_CURRENCY!=1"
  append ""
  STATUS_STEP_5="SKIP"
fi

if [[ -n "$FT_A_DOC_ID" ]]; then
  run_api_step \
    "6) Retificação FT (documento emitido no passo 2)" \
    "POST" \
    "/api/fiscal/documentos/${FT_A_DOC_ID}/rectificar" \
    '{"motivo":"Correcao operacional no smoke E2E"}'
  STATUS_STEP_6="$LAST_STATUS"
else
  append "## 6) Retificação FT"
  append "skip: documento do passo 2 não retornou documento_id"
  append ""
  STATUS_STEP_6="SKIP"
fi

if [[ -n "$FT_B_DOC_ID" ]]; then
  run_api_step \
    "7) Anulação FT (documento emitido no passo 3)" \
    "POST" \
    "/api/fiscal/documentos/${FT_B_DOC_ID}/anular" \
    '{"motivo":"Anulacao operacional no smoke E2E"}'
  STATUS_STEP_7="$LAST_STATUS"
else
  append "## 7) Anulação FT"
  append "skip: documento do passo 3 não retornou documento_id"
  append ""
  STATUS_STEP_7="SKIP"
fi

if [[ -n "$FT_A_DOC_ID" ]]; then
  run_api_step \
    "8) PDF Fiscal (documento emitido no passo 2)" \
    "GET" \
    "/api/fiscal/documentos/${FT_A_DOC_ID}/pdf"
  STATUS_STEP_8="$LAST_STATUS"
else
  append "## 8) PDF Fiscal"
  append "skip: documento do passo 2 não retornou documento_id"
  append ""
  STATUS_STEP_8="SKIP"
fi

SAFT_PAYLOAD="{\"empresa_id\":\"${EMPRESA_ID}\",\"periodo_inicio\":\"${YEAR}-01-01\",\"periodo_fim\":\"${YEAR}-12-31\",\"xsd_version\":\"AO_SAFT_1.01\",\"metadata\":{\"canal\":\"smoke_e2e\",\"fase\":\"fase_4\"}}"
run_api_step \
  "9) Exportação SAF-T(AO)" \
  "POST" \
  "/api/fiscal/saft/export" \
  "$SAFT_PAYLOAD"
STATUS_STEP_9="$LAST_STATUS"

step_pass() {
  local actual="$1"
  shift
  local expected
  for expected in "$@"; do
    if [[ "$actual" == "$expected" ]]; then
      return 0
    fi
  done
  return 1
}

OVERALL_STATUS="PASS"
append "## Veredito automático"
append "| Etapa | HTTP esperado | HTTP obtido | Resultado |"
append "|---|---|---|---|"

if step_pass "$STATUS_STEP_1" "200"; then R="PASS"; else R="FAIL"; OVERALL_STATUS="FAIL"; fi
append "| 1 Probe | 200 | ${STATUS_STEP_1:-n/a} | ${R} |"

if step_pass "$STATUS_STEP_2" "201"; then R="PASS"; else R="FAIL"; OVERALL_STATUS="FAIL"; fi
append "| 2 FT padrão | 201 | ${STATUS_STEP_2:-n/a} | ${R} |"

if step_pass "$STATUS_STEP_3" "201"; then R="PASS"; else R="FAIL"; OVERALL_STATUS="FAIL"; fi
append "| 3 FT isenta | 201 | ${STATUS_STEP_3:-n/a} | ${R} |"

if step_pass "$STATUS_STEP_4" "201"; then R="PASS"; else R="FAIL"; OVERALL_STATUS="FAIL"; fi
append "| 4 RC | 201 | ${STATUS_STEP_4:-n/a} | ${R} |"

if [[ "$STATUS_STEP_5" == "SKIP" ]]; then
  append "| 5 FT moeda estrangeira | 201 (opcional) | SKIP | SKIP |"
elif step_pass "$STATUS_STEP_5" "201"; then
  append "| 5 FT moeda estrangeira | 201 (opcional) | ${STATUS_STEP_5:-n/a} | PASS |"
else
  append "| 5 FT moeda estrangeira | 201 (opcional) | ${STATUS_STEP_5:-n/a} | FAIL |"
  OVERALL_STATUS="FAIL"
fi

if [[ "$STATUS_STEP_6" == "SKIP" ]]; then
  append "| 6 Retificação | 200 | SKIP | FAIL |"
  OVERALL_STATUS="FAIL"
elif step_pass "$STATUS_STEP_6" "200"; then
  append "| 6 Retificação | 200 | ${STATUS_STEP_6:-n/a} | PASS |"
else
  append "| 6 Retificação | 200 | ${STATUS_STEP_6:-n/a} | FAIL |"
  OVERALL_STATUS="FAIL"
fi

if [[ "$STATUS_STEP_7" == "SKIP" ]]; then
  append "| 7 Anulação | 200 | SKIP | FAIL |"
  OVERALL_STATUS="FAIL"
elif step_pass "$STATUS_STEP_7" "200"; then
  append "| 7 Anulação | 200 | ${STATUS_STEP_7:-n/a} | PASS |"
else
  append "| 7 Anulação | 200 | ${STATUS_STEP_7:-n/a} | FAIL |"
  OVERALL_STATUS="FAIL"
fi

if [[ "$STATUS_STEP_8" == "SKIP" ]]; then
  append "| 8 PDF | 200 ou 409 | SKIP | FAIL |"
  OVERALL_STATUS="FAIL"
elif step_pass "$STATUS_STEP_8" "200" "409"; then
  append "| 8 PDF | 200 ou 409 | ${STATUS_STEP_8:-n/a} | PASS |"
else
  append "| 8 PDF | 200 ou 409 | ${STATUS_STEP_8:-n/a} | FAIL |"
  OVERALL_STATUS="FAIL"
fi

if step_pass "$STATUS_STEP_9" "201" "202"; then R="PASS"; else R="FAIL"; OVERALL_STATUS="FAIL"; fi
append "| 9 SAF-T | 201 ou 202 | ${STATUS_STEP_9:-n/a} | ${R} |"
append ""
append "status_global: ${OVERALL_STATUS}"

append "## Critérios mínimos de sucesso"
append "- 1) Probe: HTTP 200"
append "- 2) FT padrão: HTTP 201"
append "- 3) FT isenta: HTTP 201"
append "- 4) RC com PaymentMechanism: HTTP 201"
append "- 6) Retificação: HTTP 200"
append "- 7) Anulação: HTTP 200"
append "- 8) PDF: HTTP 200 ou HTTP 409 FISCAL_PREVIEW_NOT_ALLOWED"
append "- 9) SAF-T: HTTP 201 ou HTTP 202"
append ""
append "## IDs capturados"
append "- FT passo 2: ${FT_A_DOC_ID:-n/a}"
append "- FT passo 3: ${FT_B_DOC_ID:-n/a}"
append ""
append "## Notas"
append "- Se algum POST retornar 404 SERIE_NAO_ENCONTRADA, crie/ative as séries ${FT_PREFIXO_SERIE} (FT) e ${RC_PREFIXO_SERIE} (RC)."
append "- Para validar omissão do bloco Currency em AOA no XML, faça download do ficheiro SAF-T exportado e confirme ausência de <Currency> em faturas AOA."
append "- Para validar renderização de Currency, rode com TEST_FOREIGN_CURRENCY=1 e confirme <Currency> no documento em USD."

echo "Evidência gerada em: $OUT"
