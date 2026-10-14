#!/bin/bash
set -euo pipefail
: "${PGURL:?}"
S=00000000-0000-4000-8000-000000000101
A=00000000-0000-4000-8000-000000000102
M=00000000-0000-4000-8000-000000000106
Y=00000000-0000-4000-8000-000000000104
ACTOR=00000000-0000-4000-8000-000000000103
for i in 1 2 3 4; do
  (psql "$PGURL" -v ON_ERROR_STOP=1 -c "SET test.actor='$ACTOR'; SET test.school='$S'; SELECT public.aluno_solicitar_boletim_matricula('$S','$A','$M','$Y');" >/dev/null) &
done
wait
psql "$PGURL" -tAc "SELECT count(*) FROM public.servico_pedidos WHERE aluno_id='$A' AND matricula_id='$M'" | grep -qx 1
psql "$PGURL" -tAc "SELECT count(*) FROM public.pagamento_intents" | grep -qx 1
echo 'PASS: simultaneous requests share one order and one payment intent.'
