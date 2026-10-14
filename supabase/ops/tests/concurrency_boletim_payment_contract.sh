#!/usr/bin/env bash
set -euo pipefail
: "${PGURL:?PGURL obrigatório; usar Postgres descartável}"
SCHOOL="00000000-0000-4000-8000-000000000001"
STUDENT="00000000-0000-4000-8000-000000000002"
ACTOR="00000000-0000-4000-8000-000000000003"
ORDER="00000000-0000-4000-8000-000000000014"
INTENT="00000000-0000-4000-8000-000000000015"
psql "$PGURL" -v ON_ERROR_STOP=1 -c "INSERT INTO public.servico_pedidos VALUES ('$ORDER', '$SCHOOL', '$STUDENT', 'DOC_BOLETIM_TRIMESTRAL', '00000000-0000-4000-8000-000000000016', 'pending_payment', 100); INSERT INTO public.pagamento_intents (id, escola_id, aluno_id, servico_pedido_id, status, evidence_url) VALUES ('$INTENT', '$SCHOOL', '$STUDENT', '$ORDER', 'pending', 'synthetic://proof');" >/dev/null
APPROVE_LOG="$(mktemp)"
REJECT_LOG="$(mktemp)"
(
  psql "$PGURL" -v ON_ERROR_STOP=1 > "$APPROVE_LOG" 2>&1 <<SQL
SET request.jwt.claim.sub = '$ACTOR';
BEGIN;
UPDATE public.pagamento_intents SET status = 'settled' WHERE id = '$INTENT';
SELECT pg_sleep(2);
COMMIT;
SQL
) &
p1=$!
sleep 0.5
set +e
psql "$PGURL" -v ON_ERROR_STOP=1 > "$REJECT_LOG" 2>&1 <<SQL
SET request.jwt.claim.sub = '$ACTOR';
UPDATE public.pagamento_intents SET status = 'failed' WHERE id = '$INTENT';
SQL
r2=$?
wait "$p1"
r1=$?
set -e
if [[ "$r1" -ne 0 || "$r2" -eq 0 ]]; then
  echo "FAIL: aprovação/rejeição concorrentes não serializadas"
  exit 1
fi
psql "$PGURL" -v ON_ERROR_STOP=1 -tAc "SELECT CASE WHEN status='settled' THEN 1 ELSE 0 END FROM public.pagamento_intents WHERE id='$INTENT'" | grep -qx 1
psql "$PGURL" -v ON_ERROR_STOP=1 -tAc "SELECT count(*) FROM public.audit_logs WHERE entity_id='$INTENT' AND action='BOLETIM_PAGAMENTO_TRANSICAO'" | grep -qx 1
echo "PASS: aprovação vence; rejeição concorrente é impedida, 1 transição auditada."
