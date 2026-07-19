# Apply diff — Agent 3
run_id:    E3C024A9-3B92-45E4-8DCE-A5D210ACB9FE
timestamp: 2026-07-18T20:59:43Z

## Acção proposta

Reaplicar as três definições exactas documentadas em `APPLY_DIFF_02C5ADC3-78CE-4ABA-8214-1122486CF21A.md`, substituindo nas três ocorrências o operador nulo-inseguro pelo operador nulo-seguro abaixo.

## Delta exacto face ao diff anterior

```diff
diff --git a/supabase/migrations/20270718140000_guard_admin_health_functions.sql b/supabase/migrations/20270718140000_guard_admin_health_functions.sql
--- a/supabase/migrations/20270718140000_guard_admin_health_functions.sql
+++ b/supabase/migrations/20270718140000_guard_admin_health_functions.sql
@@ admin_get_escola_health_metrics
-  IF auth.role() <> 'service_role' AND NOT public.check_super_admin_role() THEN
+  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.check_super_admin_role() THEN
@@ admin_get_system_health
-  IF auth.role() <> 'service_role' AND NOT public.check_super_admin_role() THEN
+  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.check_super_admin_role() THEN
@@ admin_recalc_all_aggregates
-  IF auth.role() <> 'service_role' AND NOT public.check_super_admin_role() THEN
+  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.check_super_admin_role() THEN
```

## Verificação prevista

- As três chamadas sem JWT devem lançar SQLSTATE `42501` (`blocked_calls=3`).
- Os três corpos devem conter `IS DISTINCT FROM 'service_role'` e `check_super_admin_role()`.
- Grants devem permanecer `anon=0`, `authenticated=3`, `service_role=3`.
