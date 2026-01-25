begin;

-- ============================================================
-- P0.3 - Ajustes nas políticas RLS da tabela turmas
-- ============================================================

-- Drop da política ALL existente
DROP POLICY IF EXISTS turmas_unificado_v2 ON public.turmas;

-- Drop de políticas nomeadas (idempotência)
DROP POLICY IF EXISTS turmas_insert ON public.turmas;
DROP POLICY IF EXISTS turmas_update ON public.turmas;
DROP POLICY IF EXISTS turmas_delete ON public.turmas;

-- Políticas de INSERT: somente admin_escola/secretaria
CREATE POLICY turmas_insert
ON public.turmas
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria'])
);

-- Políticas de UPDATE: somente admin_escola/secretaria
CREATE POLICY turmas_update
ON public.turmas
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
CREATE POLICY turmas_delete
ON public.turmas
FOR DELETE
TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola', 'secretaria'])
);

-- A política SELECT 'tenant_select' já existe e é aceitável para SELECT

commit;
