# Aprovação necessária — Agent 3
run_id:    fa6b8977-7b3e-4965-8ac5-8a88c107729a
timestamp: 2026-06-19T16:45:00Z

## Acção proposta
Corrigir a recursão RLS `42P17` entre `public.alunos` e `public.aluno_encarregados` substituindo a subquery directa a `public.alunos` na policy de `aluno_encarregados` por um helper `SECURITY DEFINER`.

## Diff
```diff
diff --git a/supabase/migrations/20270619164500_fix_aluno_encarregados_rls_recursion.sql b/supabase/migrations/20270619164500_fix_aluno_encarregados_rls_recursion.sql
new file mode 100644
index 00000000..11111111
--- /dev/null
+++ b/supabase/migrations/20270619164500_fix_aluno_encarregados_rls_recursion.sql
@@ -0,0 +1,58 @@
+BEGIN;
+
+CREATE OR REPLACE FUNCTION public.aluno_belongs_to_escola(
+  p_aluno_id uuid,
+  p_escola_id uuid
+)
+RETURNS boolean
+LANGUAGE sql
+STABLE
+SECURITY DEFINER
+SET search_path TO 'public'
+AS $$
+  SELECT EXISTS (
+    SELECT 1
+    FROM public.alunos a
+    WHERE a.id = p_aluno_id
+      AND a.escola_id = p_escola_id
+  );
+$$;
+
+REVOKE ALL ON FUNCTION public.aluno_belongs_to_escola(uuid, uuid) FROM PUBLIC;
+REVOKE ALL ON FUNCTION public.aluno_belongs_to_escola(uuid, uuid) FROM anon;
+GRANT EXECUTE ON FUNCTION public.aluno_belongs_to_escola(uuid, uuid) TO authenticated;
+GRANT EXECUTE ON FUNCTION public.aluno_belongs_to_escola(uuid, uuid) TO service_role;
+
+DROP POLICY IF EXISTS aluno_encarregados_tenant ON public.aluno_encarregados;
+
+CREATE POLICY aluno_encarregados_tenant
+ON public.aluno_encarregados
+FOR ALL
+TO public
+USING (
+  escola_id = public.current_tenant_escola_id()
+  AND public.aluno_belongs_to_escola(aluno_id, escola_id)
+)
+WITH CHECK (
+  escola_id = public.current_tenant_escola_id()
+  AND public.aluno_belongs_to_escola(aluno_id, escola_id)
+);
+
+COMMIT;
```

## Risco
Se aplicado incorrectamente, pode bloquear leituras e escritas em vínculos aluno-encarregado; a proposta mantém o mesmo critério funcional e apenas move a consulta a `alunos` para um helper `SECURITY DEFINER` para evitar RLS recursiva.

## Como aprovar
Commit com mensagem: `APPROVE: fa6b8977-7b3e-4965-8ac5-8a88c107729a`

## Como rejeitar
Commit com mensagem: `REJECT: fa6b8977-7b3e-4965-8ac5-8a88c107729a [motivo]`
