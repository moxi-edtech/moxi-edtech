# Resultado do apply — hardening de views e RLS
run_id: AA33F63A-459D-4A31-90CD-9C90E00AD511
approval_commit: bd869804981c08dbf761e8a8373b6cc415e7df17
status: PASS

## Aplicação

- Migration: `supabase/migrations/20260718123000_security_invoker_and_public_rls_hardening.sql`
- Transação PostgreSQL: `COMMIT`
- Views convertidas para `security_invoker`: 19
- Tabelas com RLS ativada: 8
- Policies criadas: 7

## Validação pós-apply

- Views listadas sem `security_invoker`: 0
- Tabelas listadas sem RLS: 0
- `anon` com `TRUNCATE` em `public_rate_limits`: false
- `authenticated` com `TRUNCATE` em `idempotency_keys`: false
- `anon` com `SELECT` em `partner_support_tickets`: false
- Calendário autenticado: `SELECT` preservado
- Tabelas internas: acesso mediado por RPC `SECURITY DEFINER` ou `service_role`

## Veredito

PASS — alterações aplicadas e controles esperados confirmados no banco.
