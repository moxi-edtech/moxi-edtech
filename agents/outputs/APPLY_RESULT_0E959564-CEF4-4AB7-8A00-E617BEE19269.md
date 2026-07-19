# Resultado — KLASSE Fortress v1, lote 1
run_id: 0E959564-CEF4-4AB7-8A00-E617BEE19269
approval_commit: 86aad4559f888d4c11fe3d42c6d30d9f98b6f99f
status: APPLIED

## Ficheiro aplicado
`supabase/migrations/20270718130000_harden_public_function_default_privileges.sql`

## Verificações
- P0_CHECKLIST.md sem itens pendentes: PASS
- Diff aplicado idêntico ao diff aprovado: PASS
- Migration posterior às migrations SQL numeradas existentes: PASS
- Nenhum GRANT default posterior encontrado: PASS
- Aplicação no banco remoto com `ON_ERROR_STOP`: PASS
- Catálogo `pg_default_acl` confirmado: `{postgres=X/postgres,service_role=X/postgres}`

## Efeito
Funções futuras criadas por `postgres` no schema `public` deixam de conceder
`EXECUTE` implicitamente a `PUBLIC`, `anon` e `authenticated`. RPCs públicas ou
autenticadas passam a exigir `GRANT EXECUTE` explícito por assinatura.

## Aplicação remota
Executada em 2026-07-18. A transação concluiu com `BEGIN`,
`ALTER DEFAULT PRIVILEGES` e `COMMIT`. A verificação posterior confirmou que
`PUBLIC`, `anon` e `authenticated` não constam no default ACL de funções de
`postgres` no schema `public`.
