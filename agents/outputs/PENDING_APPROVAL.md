# Aprovação necessária — Agent 3
run_id:    4F9D6A1E-CE5B-4B95-95A5-7CC5362CBF0F
timestamp: 2026-06-17T00:21:44Z
status:    APPROVED_AND_APPLIED

## Acção proposta
Corrigir a policy de leitura de `servico_pedidos` no portal do aluno para eliminar a recursão RLS em `alunos` e permitir que a Identidade Digital valide o Cartão de Estudante concedido.

## Diff
```diff
diff --git a/supabase/migrations/20270616140000_fix_servico_pedidos_portal_rls_recursion.sql b/supabase/migrations/20270616140000_fix_servico_pedidos_portal_rls_recursion.sql
new file mode 100644
index 00000000..939e57ec
--- /dev/null
+++ b/supabase/migrations/20270616140000_fix_servico_pedidos_portal_rls_recursion.sql
@@ -0,0 +1,44 @@
+BEGIN;
+
+CREATE OR REPLACE FUNCTION public.portal_user_can_access_aluno(p_aluno_id uuid)
+RETURNS boolean
+LANGUAGE sql
+SECURITY DEFINER
+STABLE
+SET search_path = public
+AS $$
+  SELECT EXISTS (
+    SELECT 1
+    FROM public.alunos a
+    WHERE a.id = p_aluno_id
+      AND (
+        a.profile_id = auth.uid()
+        OR a.usuario_auth_id = auth.uid()
+      )
+  )
+  OR EXISTS (
+    SELECT 1
+    FROM public.aluno_encarregados ae
+    JOIN public.encarregados e ON e.id = ae.encarregado_id
+    WHERE ae.aluno_id = p_aluno_id
+      AND lower(e.email) = lower(auth.jwt() ->> 'email')
+  );
+$$;
+
+REVOKE ALL ON FUNCTION public.portal_user_can_access_aluno(uuid) FROM PUBLIC;
+GRANT EXECUTE ON FUNCTION public.portal_user_can_access_aluno(uuid) TO authenticated;
+GRANT EXECUTE ON FUNCTION public.portal_user_can_access_aluno(uuid) TO service_role;
+
+DROP POLICY IF EXISTS "Alunos podem ver seus próprios pedidos de serviço" ON public.servico_pedidos;
+DROP POLICY IF EXISTS "Encarregados podem ver pedidos de serviço dos seus educandos" ON public.servico_pedidos;
+DROP POLICY IF EXISTS servico_pedidos_portal_access ON public.servico_pedidos;
+
+CREATE POLICY servico_pedidos_portal_access
+ON public.servico_pedidos
+FOR SELECT
+TO authenticated
+USING (
+  public.portal_user_can_access_aluno(aluno_id)
+);
+
+COMMIT;
```

## Risco
Se a função `SECURITY DEFINER` for alterada indevidamente, pode ampliar leitura de pedidos de serviço; a versão proposta limita o acesso ao próprio aluno ou aos educandos do encarregado autenticado.

## Resultado
- Aprovado por commit `9b2f8a9d8594453b50ec257b34ea4d6ca8d31299`.
- Migration aplicada no banco remoto.
- Versão `20270616140000` registrada em `supabase_migrations.schema_migrations`.
- Validação RLS com a sessão da Caroline:
  - `horario_versoes`: 1 versão publicada.
  - `quadro_horarios`: 4 linhas.
  - join `quadro_horarios` + `horario_slots`: 4 linhas.
  - `servico_pedidos` para cartão `granted`: 1 linha.

## Como aprovar
Commit com mensagem: `APPROVE: 4F9D6A1E-CE5B-4B95-95A5-7CC5362CBF0F`

## Como rejeitar
Commit com mensagem: `REJECT: 4F9D6A1E-CE5B-4B95-95A5-7CC5362CBF0F [motivo]`
