#!/usr/bin/env bash
set -euo pipefail
: "${PGURL:?Point PGURL to an empty disposable PostgreSQL database}"
[[ "$PGURL" == *"127.0.0.1"* || "$PGURL" == *"localhost"* ]] ||
  { echo "Refusing non-local database URL"; exit 5; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

actor="00000000-0000-4000-8000-000000000a14"
school="00000000-0000-4000-8000-000000000a11"
validate() {
  local id="$1" approved="$2" reason="$3"
  psql -X -qAt -v ON_ERROR_STOP=1 "$PGURL" <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$actor',false);
SELECT set_config('request.jwt.claims','{"sub":"$actor","escola_id":"$school"}',false);
SELECT public.validar_pagamento('$id'::uuid,$approved,$reason);
SQL
}
race_two() {
  local id1="$1" approve1="$2" reason1="$3" id2="$4" approve2="$5" reason2="$6" expected_failure="$7" label="$8"
  validate "$id1" "$approve1" "$reason1" > "$tmp/first" 2>&1 &
  local p1=$!
  validate "$id2" "$approve2" "$reason2" > "$tmp/second" 2>&1 &
  local p2=$!
  local e1=0 e2=0
  wait "$p1" || e1=$?
  wait "$p2" || e2=$?
  local successes=0
  [[ "$e1" -eq 0 ]] && successes=$((successes+1))
  [[ "$e2" -eq 0 ]] && successes=$((successes+1))
  if [[ "$successes" -ne 1 ]]; then
    echo "FAIL $label: expected exactly one successful state transition, got $successes"
    cat "$tmp/first" "$tmp/second" | tail -14
    exit 1
  fi
  if [[ "$e1" -ne 0 ]]; then
    grep -Fq "$expected_failure" "$tmp/first" || { echo "FAIL $label: unexpected loser error"; tail -10 "$tmp/first"; exit 1; }
  fi
  if [[ "$e2" -ne 0 ]]; then
    grep -Fq "$expected_failure" "$tmp/second" || { echo "FAIL $label: unexpected loser error"; tail -10 "$tmp/second"; exit 1; }
  fi
  echo "PASS $label: one winner, one STATE guard rejection"
}
# Race: two real DB sessions decide opposite states on the same monthly proof.
race_two "00000000-0000-4000-8000-000000000a19" true NULL          "00000000-0000-4000-8000-000000000a19" false "'fixture rejection'"          "STATE: pagamento_ja_processado" "opposite monthly decisions"

# Race: two pending proof records try to settle the same single monthly debt.
race_two "00000000-0000-4000-8000-000000000a37" true NULL          "00000000-0000-4000-8000-000000000a38" true NULL          "STATE: mensalidade_ja_liquidada" "two distinct proofs for one debt"

# Race: service grant versus rejection must not flip finalized service status.
race_two "00000000-0000-4000-8000-000000000a34" true NULL          "00000000-0000-4000-8000-000000000a34" false "'fixture rejection'"          "STATE: comprovativo_ja_processado" "opposite service decisions"

psql -X -qAt -v ON_ERROR_STOP=1 "$PGURL" <<'SQL'
DO $check$
DECLARE monthly_status text; monthly_amount numeric; settled integer; receipt_count integer;
BEGIN
 SELECT p.status,m.valor_pago_total INTO monthly_status, monthly_amount
 FROM public.pagamentos p JOIN public.mensalidades m ON m.id=p.mensalidade_id
 WHERE p.id='00000000-0000-4000-8000-000000000a19';
 IF (monthly_status='settled' AND monthly_amount<>200)
 OR (monthly_status='rejected' AND monthly_amount<>0)
 OR monthly_status NOT IN ('settled','rejected') THEN
  RAISE EXCEPTION 'OPPOSITE_MONTHLY_STATE_AND_BALANCE_MISMATCH';
 END IF;
 SELECT valor_pago_total INTO monthly_amount FROM public.mensalidades WHERE id='00000000-0000-4000-8000-000000000a36';
 SELECT count(*) INTO settled FROM public.pagamentos
 WHERE mensalidade_id='00000000-0000-4000-8000-000000000a36' AND status='settled';
 SELECT count(*) INTO receipt_count FROM public.documentos_emitidos
 WHERE mensalidade_id='00000000-0000-4000-8000-000000000a36';
 IF monthly_amount <> 200 OR settled <> 1 OR receipt_count <> 1 THEN
  RAISE EXCEPTION 'PARALLEL_PROOFS_DOUBLE_CHARGE_OR_DUPLICATE_RECEIPT';
 END IF;
 IF (SELECT status FROM public.servico_pedidos WHERE id='00000000-0000-4000-8000-000000000a24')
 NOT IN ('granted','canceled') THEN RAISE EXCEPTION 'SERVICE_RACE_NOT_FINAL'; END IF;
END $check$;
SQL
echo "FINANCE_VALIDATOR_REAL_PG_CONCURRENCY_PASS"
