# Resultado — Agent 3
run_id: 6FC2BC0C-9C67-4323-9AE7-48FF8B14061C
timestamp: 2026-07-18T22:51:00Z
status: PASS

## Aplicado
`supabase/migrations/20270718155000_revoke_anon_admissions_function_execute.sql`

## Verificação

- 17/17 funções administrativas sem privilégio efectivo de `anon`.
- 17/17 mantêm `authenticated`.
- 17/17 mantêm `service_role`.
- Funções públicas de lookup, protocolo e self-service ficaram fora do lote.
- Nenhuma reversão necessária.
