# Apply diff — Agent 3
run_id:    D2A3FB1E-706F-4C35-A30E-D0ACC92DE341
timestamp: 2026-07-18T21:07:53Z

## Acção proposta

Substituir as duas policies `WITH CHECK (true)` de `formacao_funnel_eventos` por validação estrutural. A inserção pública permanece permitida, mas `anon` não pode atribuir `user_id` e utilizadores autenticados só podem usar o próprio `auth.uid()`.

## Diff

```diff
diff --git a/supabase/migrations/20270718143000_harden_formacao_funnel_insert_policies.sql b/supabase/migrations/20270718143000_harden_formacao_funnel_insert_policies.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270718143000_harden_formacao_funnel_insert_policies.sql
@@
+DROP POLICY IF EXISTS formacao_funnel_eventos_insert_anon ON public.formacao_funnel_eventos;
+CREATE POLICY formacao_funnel_eventos_insert_anon
+ON public.formacao_funnel_eventos
+FOR INSERT TO anon
+WITH CHECK (
+  app = 'formacao'
+  AND btrim(event) <> '' AND length(event) <= 100
+  AND (path IS NULL OR length(path) <= 2048)
+  AND (source IS NULL OR length(source) <= 200)
+  AND (tenant_slug IS NULL OR length(tenant_slug) <= 200)
+  AND user_id IS NULL
+  AND jsonb_typeof(details) = 'object'
+);
+
+DROP POLICY IF EXISTS formacao_funnel_eventos_insert_authenticated ON public.formacao_funnel_eventos;
+CREATE POLICY formacao_funnel_eventos_insert_authenticated
+ON public.formacao_funnel_eventos
+FOR INSERT TO authenticated
+WITH CHECK (
+  app = 'formacao'
+  AND btrim(event) <> '' AND length(event) <= 100
+  AND (path IS NULL OR length(path) <= 2048)
+  AND (source IS NULL OR length(source) <= 200)
+  AND (tenant_slug IS NULL OR length(tenant_slug) <= 200)
+  AND (user_id IS NULL OR user_id = auth.uid())
+  AND jsonb_typeof(details) = 'object'
+);
```

## Evidência pré-apply

- 10 eventos existentes.
- Comprimentos máximos: `event=29`, `path=13`, `source=23`, `tenant_slug=12`.
- Registos com `details` não-objecto: 0.
- A rota escreve sempre `app='formacao'` e envia `user_id` autenticado ou nulo.

## Verificação prevista

- Confirmar que nenhuma das duas policies contém expressão `true`.
- Sob role `anon`, aceitar payload válido com `user_id=NULL` dentro de transacção revertida.
- Sob role `anon`, rejeitar `user_id` forjado.
- Confirmar que a policy SELECT existente permanece inalterada.
