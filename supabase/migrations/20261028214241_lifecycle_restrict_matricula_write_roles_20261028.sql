-- Applied to KLASSE Supabase on 2026-10-28.
BEGIN;
-- Escola/polo controla o contexto. O cargo é uma condição ADICIONAL,
-- jamais alternativa: cc_security.allowed_turma devolve true quando
-- os polos ainda não são aplicados na escola.
DROP POLICY IF EXISTS lifecycle_matriculas_insert_staff ON public.matriculas;
DROP POLICY IF EXISTS lifecycle_matriculas_update_staff ON public.matriculas;
DROP POLICY IF EXISTS lifecycle_matriculas_delete_staff ON public.matriculas;

CREATE POLICY lifecycle_matriculas_insert_staff ON public.matriculas
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['secretaria','secretaria_financeiro','admin_financeiro','admin','admin_escola','staff_admin']::text[])
  )
);

CREATE POLICY lifecycle_matriculas_update_staff ON public.matriculas
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['secretaria','secretaria_financeiro','admin_financeiro','admin','admin_escola','staff_admin']::text[])
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['secretaria','secretaria_financeiro','admin_financeiro','admin','admin_escola','staff_admin']::text[])
  )
);

CREATE POLICY lifecycle_matriculas_delete_staff ON public.matriculas
AS RESTRICTIVE FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['secretaria','secretaria_financeiro','admin_financeiro','admin','admin_escola','staff_admin']::text[])
  )
);
COMMIT;
