BEGIN;

-- Remove duplicated effective policies for authenticated on mensalidades
-- by inlining super_admin bypass into command-specific policies.

ALTER POLICY mensalidades_select ON public.mensalidades
USING (
  (
    (escola_id = current_tenant_escola_id())
    AND (
      user_has_role_in_school(
        escola_id,
        ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']::text[]
      )
      OR EXISTS (
        SELECT 1
        FROM alunos a
        WHERE a.id = mensalidades.aluno_id
          AND a.escola_id = mensalidades.escola_id
          AND (a.usuario_auth_id = (SELECT auth.uid()) OR a.profile_id = (SELECT auth.uid()))
      )
    )
  )
  OR is_super_admin()
);

ALTER POLICY mensalidades_insert ON public.mensalidades
WITH CHECK (
  (
    (escola_id = current_tenant_escola_id())
    AND user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']::text[]
    )
  )
  OR is_super_admin()
);

ALTER POLICY mensalidades_update ON public.mensalidades
USING (
  (
    (escola_id = current_tenant_escola_id())
    AND user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']::text[]
    )
  )
  OR is_super_admin()
)
WITH CHECK (
  (
    (escola_id = current_tenant_escola_id())
    AND user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']::text[]
    )
  )
  OR is_super_admin()
);

ALTER POLICY mensalidades_delete ON public.mensalidades
USING (
  (
    (escola_id = current_tenant_escola_id())
    AND user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']::text[]
    )
  )
  OR is_super_admin()
);

DROP POLICY IF EXISTS tenant_all_access ON public.mensalidades;

COMMIT;
