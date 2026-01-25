begin;

-- ============================================================
-- P0.3 - Ajustes nas políticas RLS da tabela pagamentos
-- ============================================================

-- Drop da política ALL existente
DROP POLICY IF EXISTS "Tenant Isolation" ON public.pagamentos;

-- Drop de políticas nomeadas (idempotência)
DROP POLICY IF EXISTS pagamentos_select ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_insert ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_update ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_delete ON public.pagamentos;

-- Políticas de SELECT: qualquer usuário autenticado da própria escola
CREATE POLICY pagamentos_select
ON public.pagamentos
FOR SELECT
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
);

-- Políticas de INSERT: somente admin_escola/secretaria
CREATE POLICY pagamentos_insert
ON public.pagamentos
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria'])
);

-- Políticas de UPDATE: somente admin_escola/secretaria
CREATE POLICY pagamentos_update
ON public.pagamentos
FOR UPDATE
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria'])
)
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria'])
);

-- Políticas de DELETE: somente admin_escola/secretaria
CREATE POLICY pagamentos_delete
ON public.pagamentos
FOR DELETE
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria'])
);

commit;
