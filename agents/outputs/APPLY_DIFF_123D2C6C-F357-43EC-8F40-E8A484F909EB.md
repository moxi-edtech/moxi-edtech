# Apply diff — Agent 3
run_id:    123D2C6C-F357-43EC-8F40-E8A484F909EB
timestamp: 2026-07-18T21:14:27Z

## Acção proposta

Optimizar `formacao_funnel_eventos_insert_authenticated` para avaliar `auth.uid()` uma vez por statement através de InitPlan, preservando exactamente a lógica de autorização.

## Diff

```diff
diff --git a/supabase/migrations/20270718145000_optimize_formacao_funnel_auth_initplan.sql b/supabase/migrations/20270718145000_optimize_formacao_funnel_auth_initplan.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270718145000_optimize_formacao_funnel_auth_initplan.sql
@@
+ALTER POLICY formacao_funnel_eventos_insert_authenticated
+ON public.formacao_funnel_eventos
+WITH CHECK (
+  app = 'formacao'
+  AND btrim(event) <> '' AND length(event) <= 100
+  AND (path IS NULL OR length(path) <= 2048)
+  AND (source IS NULL OR length(source) <= 200)
+  AND (tenant_slug IS NULL OR length(tenant_slug) <= 200)
+  AND (user_id IS NULL OR user_id = (SELECT auth.uid()))
+  AND jsonb_typeof(details) = 'object'
+);
```

## Equivalência

```diff
- user_id = auth.uid()
+ user_id = (SELECT auth.uid())
```

Roles, comando, restantes predicados e grants não mudam.

## Verificação prevista

- Confirmar `(SELECT auth.uid())` na expressão catalogada.
- Confirmar ausência de chamada directa `auth.uid()` na policy.
- Repetir inserção anónima válida e teste de identidade forjada.
