# Resultado — KLASSE Fortress v1, lote 2
run_id: 0D6C4397-BF44-4A96-A325-F16185E8AC6C
approval_commit: 2a1dd6fc5cea853967e5858edd0f4287c5236295
status: APPLIED

## Ficheiro aplicado
`supabase/migrations/20270718131000_revoke_client_execute_from_trigger_functions.sql`

## Verificações
- P0_CHECKLIST.md sem itens pendentes: PASS
- Diff aplicado idêntico ao diff aprovado: PASS
- Aplicação remota com `ON_ERROR_STOP`: PASS
- Transação remota: `BEGIN`, `DO`, `COMMIT`
- Funções `trigger` encontradas no schema `public`: 105
- Grants `EXECUTE` proibidos remanescentes: 0

## Efeito
As funções de trigger continuam associadas e executadas pelos triggers do
PostgreSQL, mas deixaram de ser executáveis diretamente por `PUBLIC`, `anon` e
`authenticated`.
