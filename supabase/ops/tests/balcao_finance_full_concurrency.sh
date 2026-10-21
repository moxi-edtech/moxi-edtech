#!/usr/bin/env bash
set -euo pipefail
: "${PGURL:?PGURL must point to disposable Postgres}"
PAYMENT_ID="$(psql "$PGURL" -At -v ON_ERROR_STOP=1 -c "SELECT id FROM public.pagamentos WHERE mensalidade_id='00000000-0000-4000-8000-000000000a17' AND status='pending' ORDER BY created_at DESC LIMIT 1")"
if [ -z "$PAYMENT_ID" ]; then echo "Pending fixture missing"; exit 1; fi
claim="00000000-0000-4000-8000-000000000a14"
tenant="00000000-0000-4000-8000-000000000a11"
run_validation() {
  local approved="$1" reason="$2"
  psql "$PGURL" -v ON_ERROR_STOP=1 -q <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$claim', false);
SELECT set_config('request.jwt.claims', '{"sub":"$claim","escola_id":"$tenant"}', false);
SELECT public.validar_pagamento('$PAYMENT_ID'::uuid, $approved, $reason);
SQL
}
run_validation true NULL >/tmp/balcao-finance-race-approve.log 2>&1 &
approve_pid=$!
run_validation false "'fixture concurrent reject'" >/tmp/balcao-finance-race-reject.log 2>&1 &
reject_pid=$!
set +e
wait "$approve_pid"; approve_exit=$?
wait "$reject_pid"; reject_exit=$?
set -e
if [[ $approve_exit -ne 0 && $reject_exit -ne 0 ]]; then
  echo "CONCURRENCY_NO_VALIDATOR_WON: both operations failed"
  exit 1
fi
# Only one final outcome may be accepted. A second operation can be safely
# rejected or report already-finalized; opposite successful transitions on
# the very same payment are forbidden even if balance happens to match.
if [[ $approve_exit -eq 0 && $reject_exit -eq 0 ]] &&
   grep -Eq '\"status\": *\"approved\"' /tmp/balcao-finance-race-approve.log &&
   grep -Eq '\"status\": *\"rejected\"' /tmp/balcao-finance-race-reject.log; then
  echo "CONCURRENCY_P0: approve and reject BOTH succeeded on same proof"
  exit 1
fi
psql "$PGURL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE paid numeric; settled_count integer; state text;
BEGIN
 SELECT valor_pago_total INTO paid FROM public.mensalidades WHERE id='00000000-0000-4000-8000-000000000a17';
 SELECT count(*) INTO settled_count FROM public.pagamentos WHERE mensalidade_id='00000000-0000-4000-8000-000000000a17' AND status='settled';
 SELECT status INTO state FROM public.pagamentos WHERE mensalidade_id='00000000-0000-4000-8000-000000000a17' ORDER BY created_at DESC LIMIT 1;
 IF settled_count > 1 THEN RAISE EXCEPTION 'CONCURRENCY_DUPLICATED_PAYMENT'; END IF;
 IF paid NOT IN (0,200) THEN RAISE EXCEPTION 'CONCURRENCY_BALANCE_INVALID: %', paid; END IF;
 IF paid = 0 AND settled_count <> 0 THEN RAISE EXCEPTION 'SETTLEMENT_AND_BALANCE_MISMATCH'; END IF;
 IF paid = 200 AND settled_count <> 1 THEN RAISE EXCEPTION 'SETTLEMENT_AND_BALANCE_MISMATCH'; END IF;
END $$;
SQL
echo "PASS: Two actual PostgreSQL connections, one authoritative ledger, no duplicated charge"
