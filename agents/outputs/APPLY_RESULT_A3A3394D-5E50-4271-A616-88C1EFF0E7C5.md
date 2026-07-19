# Apply result — Agent 3
run_id: A3A3394D-5E50-4271-A616-88C1EFF0E7C5
timestamp: 2026-07-18T00:00:00-03:00
status: PASS

## Aplicação

- Approval commit: `72ca6ea1`
- Migration: `supabase/migrations/20270718196000_restrict_internal_maintenance_rpcs.sql`
- Transação SQL: PASS (`BEGIN`, dois `REVOKE/GRANT`, `COMMIT`)

## Verificação pós-apply

| Função | authenticated | service_role |
|---|---:|---:|
| `admissao_auto_expire_reservations()` | false | true |
| `increment_pautas_lote_job(uuid, boolean, boolean)` | false | true |

- Cron `admissao-auto-expire-30m`: presente (1 job).
- Warnings `authenticated_security_definer`: 277 → 275.

## Resultado

As duas RPCs internas deixaram de estar expostas a qualquer utilizador autenticado sem interromper os seus executores legítimos.
