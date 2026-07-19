# Apply result — Agent 3
run_id: E30E9BFE-3935-4ECF-87FC-E1C003448F0F
timestamp: 2026-07-18T00:00:00-03:00
status: PASS

## Aplicação

- Approval commit: `0243c789`
- Migration: `supabase/migrations/20270718195000_restrict_generic_public_rate_limit_helper.sql`
- `psql -v ON_ERROR_STOP=1`: PASS (`REVOKE`, `GRANT`)

## Verificação pós-apply

| Papel | EXECUTE |
|---|---|
| anon | false |
| authenticated | false |
| PUBLIC | false |
| service_role | true |

ACL efectiva: apenas owner (`postgres`) e `service_role` conservam `EXECUTE`.

## Resultado

O helper genérico já não pode ser chamado directamente por clientes públicos ou autenticados. As rotas conhecidas continuam funcionais porque usam `supabaseServerRole()`, e as RPCs `SECURITY DEFINER` continuam a invocá-lo como owner.
