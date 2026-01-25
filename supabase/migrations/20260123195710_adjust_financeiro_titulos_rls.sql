begin;

-- ============================================================
-- P0.3 - Ajustes nas políticas RLS da tabela financeiro_titulos
-- ============================================================

-- Drop da política ALL existente
DROP POLICY IF EXISTS financeiro_titulos_unificado_v3 ON public.financeiro_titulos;

-- Drop de políticas nomeadas (idempotência)
DROP POLICY IF EXISTS financeiro_titulos_select ON public.financeiro_titulos;
DROP POLICY IF EXISTS financeiro_titulos_insert ON public.financeiro_titulos;
DROP POLICY IF EXISTS financeiro_titulos_update ON public.financeiro_titulos;
DROP POLICY IF EXISTS financeiro_titulos_delete ON public.financeiro_titulos;

-- Políticas de SELECT: qualquer usuário autenticado da própria escola
CREATE POLICY financeiro_titulos_select
ON public.financeiro_titulos
FOR SELECT
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
);

-- Políticas de INSERT: somente admin_escola/secretaria
CREATE POLICY financeiro_titulos_insert
ON public.financeiro_titulos
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria'])
);

-- Políticas de UPDATE: somente admin_escola/secretaria
CREATE POLICY financeiro_titulos_update
ON public.financeiro_titulos
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
CREATE POLICY financeiro_titulos_delete
ON public.financeiro_titulos
FOR DELETE
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria'])
);

commit;
