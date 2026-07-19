# Resultado — KLASSE Fortress v1, lote 6
run_id: 6EADF9BC-A0A3-46D9-B6D1-46A85D599D0E
approval_commit: 87fcd62be797710c460e010f06941c270dfed0f4
status: APPLIED

## Ficheiro aplicado
`supabase/migrations/20270718133000_harden_boletim_refresh_grant.sql`

## Verificações
- P0_CHECKLIST.md sem itens pendentes: PASS
- Diff aplicado idêntico ao diff aprovado: PASS
- Aplicação remota com `ON_ERROR_STOP`: PASS
- `anon` EXECUTE: false
- `authenticated` EXECUTE: false
- `service_role` EXECUTE: true
- Cron `refresh-boletim-hourly`: ativo, a cada 20 minutos

## Efeito
`refresh_mv_boletim_por_matricula()` deixou de ser uma RPC acessível por
clientes. O refresh periódico continua executado no backend.
