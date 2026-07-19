# Apply result — Agent 3
run_id:          02C5ADC3-78CE-4ABA-8214-1122486CF21A
approval_commit: 544e7fd34f9b3059d9da846b9006ba7d3e7bf575
status:          FAIL_REVERTED

## Resultado

As definições foram aplicadas, mas o teste negativo encontrou `blocked_calls=0`: sem JWT, `auth.role()` retorna `NULL`, e `NULL <> 'service_role'` não é `TRUE`.

## Reversão automática

- Restaurados os três corpos anteriores numa transacção com exit 0.
- Removida a migration local falhada.
- Catálogo confirmado: `guarded=0`, `anon=0`, `authenticated=3`, `service_role=3`.

## Causa e correção

O operador deve ser `IS DISTINCT FROM`, que considera `NULL` diferente de `service_role` e activa correctamente o guard.
