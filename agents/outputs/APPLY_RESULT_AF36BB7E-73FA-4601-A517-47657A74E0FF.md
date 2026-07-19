# Resultado — Agent 3
run_id: AF36BB7E-73FA-4601-A517-47657A74E0FF
timestamp: 2026-07-19T03:45:00Z
status: PASS

## Aplicado
`supabase/migrations/20270718181000_guard_formacao_self_service_user_identity.sql`

## Verificação

- Wrapper público contém guarda `auth.uid() = p_formando_user_id`.
- Wrapper não é executável por `anon`; mantém `authenticated` e `service_role`.
- Implementação interna não é executável por `anon` nem `authenticated`.
- Hash da implementação interna `2f9fda0e0e5a4885115130260b764197` é idêntico ao corpo original.
- Nenhuma reversão necessária.
