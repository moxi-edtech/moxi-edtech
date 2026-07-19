# Apply diff — Agent 3
run_id:    DD4BBEA0-561B-4DAD-BA24-B628EBFE0118
timestamp: 2026-07-18T20:54:43Z

## Acção proposta

Revogar `EXECUTE` de `PUBLIC` e `anon` nas seis funções administrativas. Os grants explícitos existentes para `authenticated` e `service_role` são preservados.

## Diff

```diff
diff --git a/supabase/migrations/20270718135000_revoke_public_anon_admin_function_execute.sql b/supabase/migrations/20270718135000_revoke_public_anon_admin_function_execute.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270718135000_revoke_public_anon_admin_function_execute.sql
@@
+-- Administrative SECURITY DEFINER functions must never be callable anonymously.
+REVOKE EXECUTE ON FUNCTION public.admin_get_escola_health_metrics() FROM PUBLIC, anon;
+REVOKE EXECUTE ON FUNCTION public.admin_get_storage_usage(integer, text[]) FROM PUBLIC, anon;
+REVOKE EXECUTE ON FUNCTION public.admin_get_system_health() FROM PUBLIC, anon;
+REVOKE EXECUTE ON FUNCTION public.admin_list_profiles(text[], integer) FROM PUBLIC, anon;
+REVOKE EXECUTE ON FUNCTION public.admin_profiles_by_ids(uuid[]) FROM PUBLIC, anon;
+REVOKE EXECUTE ON FUNCTION public.admin_recalc_all_aggregates() FROM PUBLIC, anon;
```

## Estado ACL confirmado

As seis funções têm grants explícitos para `PUBLIC`, `anon`, `authenticated` e `service_role`. A alteração remove somente os dois primeiros.

## Verificação prevista

- `anon`: 0/6 com EXECUTE efectivo.
- `authenticated`: 6/6 preservadas.
- `service_role`: 6/6 preservadas.
