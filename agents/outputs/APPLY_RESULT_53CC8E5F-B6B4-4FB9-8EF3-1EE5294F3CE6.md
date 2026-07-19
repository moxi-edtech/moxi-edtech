# Resultado — Agent 3
run_id: 53CC8E5F-B6B4-4FB9-8EF3-1EE5294F3CE6
timestamp: 2026-07-19T00:12:00Z
status: PASS

## Aplicado
`supabase/migrations/20270718163000_revoke_anon_super_admin_execute.sql`

## Verificação

- 18/18 assinaturas de super-admin/provisionamento sem privilégio efectivo de `anon`.
- 18/18 mantêm `authenticated`.
- 18/18 mantêm `service_role`.
- Funções públicas de sessão, CRM e suporte do parceiro ficaram fora do lote.
- Nenhuma reversão necessária.
