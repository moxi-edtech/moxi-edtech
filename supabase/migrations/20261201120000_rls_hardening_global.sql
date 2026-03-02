BEGIN;

-- 1. Hardening para a tabela ALUNOS
DROP POLICY IF EXISTS "tenant_or_super_admin_select" ON public.alunos;
DROP POLICY IF EXISTS "tenant_all_access" ON public.alunos;
CREATE POLICY "tenant_all_access" ON public.alunos
  FOR ALL
  TO authenticated
  USING (escola_id = current_tenant_escola_id() OR is_super_admin())
  WITH CHECK (escola_id = current_tenant_escola_id() OR is_super_admin());

-- 2. Hardening para a tabela MATRICULAS
DROP POLICY IF EXISTS "tenant_or_super_admin_select" ON public.matriculas;
DROP POLICY IF EXISTS "tenant_all_access" ON public.matriculas;
CREATE POLICY "tenant_all_access" ON public.matriculas
  FOR ALL
  TO authenticated
  USING (escola_id = current_tenant_escola_id() OR is_super_admin())
  WITH CHECK (escola_id = current_tenant_escola_id() OR is_super_admin());

-- 3. Hardening para a tabela MENSALIDADES
DROP POLICY IF EXISTS "tenant_or_super_admin_select" ON public.mensalidades;
DROP POLICY IF EXISTS "tenant_all_access" ON public.mensalidades;
CREATE POLICY "tenant_all_access" ON public.mensalidades
  FOR ALL
  TO authenticated
  USING (escola_id = current_tenant_escola_id() OR is_super_admin())
  WITH CHECK (escola_id = current_tenant_escola_id() OR is_super_admin());

-- 4. Hardening para a tabela NOTAS
DROP POLICY IF EXISTS "tenant_or_super_admin_select" ON public.notas;
DROP POLICY IF EXISTS "tenant_all_access" ON public.notas;
CREATE POLICY "tenant_all_access" ON public.notas
  FOR ALL
  TO authenticated
  USING (escola_id = current_tenant_escola_id() OR is_super_admin())
  WITH CHECK (escola_id = current_tenant_escola_id() OR is_super_admin());

-- 5. Hardening para a tabela AVALIACOES
DROP POLICY IF EXISTS "tenant_all_access" ON public.avaliacoes;
CREATE POLICY "tenant_all_access" ON public.avaliacoes
  FOR ALL
  TO authenticated
  USING (escola_id = current_tenant_escola_id() OR is_super_admin())
  WITH CHECK (escola_id = current_tenant_escola_id() OR is_super_admin());

COMMIT;
