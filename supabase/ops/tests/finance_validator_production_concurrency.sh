#!/usr/bin/env bash
set -euo pipefail
: "${PGURL:?Set PGURL to a disposable local database}"
[[ "$PGURL" == *127.0.0.1* || "$PGURL" == *localhost* ]] || exit 5
actor="00000000-0000-4000-8000-000000000a14"
school="00000000-0000-4000-8000-000000000a11"
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
call() {
 local id="$1" approve="$2" reason="$3"
 psql "$PGURL" -X -qAt -v ON_ERROR_STOP=1 <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$actor',false);
SELECT set_config('request.jwt.claims','{"sub":"$actor","escola_id":"$school"}',false);
SELECT public.validar_pagamento('$id'::uuid,$approve,$reason);
SQL
}
race() {
 local label="$1" id1="$2" a1="$3" r1="$4" id2="$5" a2="$6" r2="$7"
 call "$id1" "$a1" "$r1" >"$temp/a" 2>&1 & p1=$!
 call "$id2" "$a2" "$r2" >"$temp/b" 2>&1 & p2=$!
 wait "$p1" || true
 wait "$p2" || true
 echo "RACE $label"
}
race monthly_opposite "00000000-0000-4000-8000-000000000a19" true NULL "00000000-0000-4000-8000-000000000a19" false "'invalid'"
race monthly_distinct_proofs "00000000-0000-4000-8000-000000000a37" true NULL "00000000-0000-4000-8000-000000000a38" true NULL
race service_opposite "00000000-0000-4000-8000-000000000a34" true NULL "00000000-0000-4000-8000-000000000a34" false "'invalid'"
psql "$PGURL" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $check$
DECLARE status1 text; balance1 numeric; count1 int; status2 text; count2 int; service_state text; intent_state text;
BEGIN
 SELECT p.status,m.valor_pago_total INTO status1,balance1
 FROM public.pagamentos p JOIN public.mensalidades m ON m.id=p.mensalidade_id
 WHERE p.id='00000000-0000-4000-8000-000000000a19';
 IF (status1='settled' AND balance1<>200) OR (status1='rejected' AND balance1<>0)
 OR status1 NOT IN ('settled','rejected') THEN RAISE EXCEPTION 'MONTHLY_OPPOSITE_RACE_BROKEN'; END IF;
 SELECT valor_pago_total INTO balance1 FROM public.mensalidades WHERE id='00000000-0000-4000-8000-000000000a36';
 SELECT count(*) INTO count1 FROM public.financeiro_pagamento_alocacoes
 WHERE mensalidade_id='00000000-0000-4000-8000-000000000a36';
 IF balance1<>200 OR count1<>1 THEN RAISE EXCEPTION 'MONTHLY_DOUBLE_ALLOCATION'; END IF;
 SELECT status INTO service_state FROM public.servico_pedidos WHERE id='00000000-0000-4000-8000-000000000a24';
 SELECT status INTO intent_state FROM public.pagamento_intents WHERE id='00000000-0000-4000-8000-000000000a34';
 IF NOT ((service_state='granted' AND intent_state='settled') OR
 (service_state='canceled' AND intent_state='failed')) THEN
 RAISE EXCEPTION 'SERVICE_OPPOSITE_RACE_BROKEN'; END IF;
END $check$;
SQL
echo FINANCE_VALIDATOR_PRODUCTION_CONCURRENCY_PASS
