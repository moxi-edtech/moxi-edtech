#!/usr/bin/env python3
"""Fail CI if the financial fix changes anything beyond three narrow gates.

The original canonical 20270605120000 function is the source of truth
for authorization, settled metadata, receipt generation and service state.
No huge snapshot, mock SQL replacement, skipped fiscal guard, or RLS change.
"""
from pathlib import Path

old = Path("supabase/migrations/20270605120000_unificar_recebimentos_balcao_portal.sql").read_text()
new = Path("supabase/migrations/20271015110000_fix_validar_pagamento_idempotency.sql").read_text()
marker = "CREATE OR REPLACE FUNCTION public.validar_pagamento("
assert old.count(marker) == 1 and new.count(marker) == 1
source = old[old.index(marker):].strip()
candidate = new[new.index(marker):].strip()
assert source.endswith("$$;") and candidate.endswith("$$;")

def strip_inserted_block(sql: str, start: str, before: str) -> str:
    assert sql.count(start) == 1 and sql.count(before) >= 1, (start, before)
    first = sql.index(start)
    ending = sql.index(before, first)
    return sql[:first] + sql[ending:]

assert candidate.count("IF v_pagamento.status IS DISTINCT FROM 'pending'") == 1
assert candidate.count("IF v_intent.status IS DISTINCT FROM 'pending'") == 1
assert candidate.count("IF v_valor_pago_atual >= v_valor_esperado") == 0
candidate = strip_inserted_block(
    candidate, "    -- We hold the payment row's FOR UPDATE lock",
    "    IF v_pagamento.mensalidade_id IS NULL THEN",
)
candidate = strip_inserted_block(
    candidate, "    -- Keep the service side equally atomic",
    "    IF NOT p_aprovado THEN",
)
assert candidate.count("IF v_novo_valor_pago > v_valor_esperado THEN") == 1
left = "    v_valor_pago_atual := COALESCE(v_mensalidade.valor_pago_total, 0);\n"
right = "    UPDATE public.pagamentos\n    SET status = 'settled',"
assert candidate.count(left) == source.count(left) == 1
assert candidate.count(right) == source.count(right) == 1
baseline_between = source[source.index(left) + len(left):source.index(right,source.index(left))]
prefix = candidate[:candidate.index(left) + len(left)]
suffix = candidate[candidate.index(right,candidate.index(left)):]
candidate = prefix + baseline_between + suffix

assert [line.rstrip() for line in candidate.splitlines()] == [line.rstrip() for line in source.splitlines()], (
    "Canonical financial function changed beyond idempotency, balance and service state guards"
)
print("FINANCE_VALIDATOR_SCOPE_PASS: canonical receipt/authorization/fiscal/service SQL unchanged")
