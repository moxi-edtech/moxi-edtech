# Apply diff — Agent 3
run_id:    9528F6E6-93AF-456D-9DBB-84C4DF9BBC57
timestamp: 2026-07-18T20:53:14Z

## Acção proposta

Revogar `EXECUTE` do role `anon` nas seis funções administrativas `SECURITY DEFINER` actualmente expostas. Os grants de `authenticated` e `service_role` permanecem inalterados.

## Diff

```diff
diff --git a/supabase/migrations/20270718135000_revoke_anon_admin_function_execute.sql b/supabase/migrations/20270718135000_revoke_anon_admin_function_execute.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270718135000_revoke_anon_admin_function_execute.sql
@@
+-- Administrative SECURITY DEFINER functions must never be callable anonymously.
+REVOKE EXECUTE ON FUNCTION public.admin_get_escola_health_metrics() FROM anon;
+REVOKE EXECUTE ON FUNCTION public.admin_get_storage_usage(integer, text[]) FROM anon;
+REVOKE EXECUTE ON FUNCTION public.admin_get_system_health() FROM anon;
+REVOKE EXECUTE ON FUNCTION public.admin_list_profiles(text[], integer) FROM anon;
+REVOKE EXECUTE ON FUNCTION public.admin_profiles_by_ids(uuid[]) FROM anon;
+REVOKE EXECUTE ON FUNCTION public.admin_recalc_all_aggregates() FROM anon;
```

## Evidência pré-apply

- As seis funções são `SECURITY DEFINER` e `anon` possui `EXECUTE` efectivo.
- Consumidores encontrados apenas em superfícies de super-admin autenticadas.
- `authenticated` e `service_role` mantêm `EXECUTE` neste lote.

## Verificação prevista

- Aplicar com `ON_ERROR_STOP=1` e transacção única.
- Confirmar `has_function_privilege('anon', ..., 'EXECUTE') = false` nas seis assinaturas.
- Confirmar que `authenticated` e `service_role` continuam com os grants anteriores.
