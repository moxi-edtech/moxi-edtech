# Resultado — Agent 3
run_id: 11C9FD14-7ED5-447F-BA2E-F89237A02392
timestamp: 2026-07-18T23:52:00Z
status: PASS

## Aplicado
`supabase/migrations/20270718162000_revoke_anon_formacao_backoffice_execute.sql`

## Verificação

- 9/9 funções de Formação internas/backoffice sem privilégio efectivo de `anon`.
- 9/9 mantêm `authenticated`.
- 9/9 mantêm `service_role`.
- RPCs self-service públicas e helpers usados por RLS ficaram fora do lote.
- Nenhuma reversão necessária.
