begin;

-- ============================================================
-- P0.3 - Ajustes nas políticas RLS da tabela frequencias
-- ============================================================

-- Drop das políticas ALL existentes
DROP POLICY IF EXISTS "Tenant Isolation" ON public.frequencias;
DROP POLICY IF EXISTS tenant_isolation ON public.frequencias;

-- Drop de políticas nomeadas (idempotência)
DROP POLICY IF EXISTS frequencias_select ON public.frequencias;
DROP POLICY IF EXISTS frequencias_insert ON public.frequencias;
DROP POLICY IF EXISTS frequencias_update ON public.frequencias;
DROP POLICY IF EXISTS frequencias_delete ON public.frequencias;

-- Políticas de SELECT: qualquer usuário autenticado da própria escola
CREATE POLICY frequencias_select
ON public.frequencias
FOR SELECT
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
);

-- Políticas de INSERT: somente admin_escola/secretaria/professor
CREATE POLICY frequencias_insert
ON public.frequencias
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria', 'professor'])
);

-- Políticas de UPDATE: somente admin_escola/secretaria/professor
CREATE POLICY frequencias_update
ON public.frequencias
FOR UPDATE
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria', 'professor'])
)
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria', 'professor'])
);

-- Políticas de DELETE: somente admin_escola/secretaria
CREATE POLICY frequencias_delete
ON public.frequencias
FOR DELETE
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria'])
);

commit;
