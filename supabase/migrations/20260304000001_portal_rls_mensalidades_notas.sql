BEGIN;

ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notas_select ON public.notas;
DROP POLICY IF EXISTS notas_insert ON public.notas;
DROP POLICY IF EXISTS notas_update ON public.notas;
DROP POLICY IF EXISTS notas_delete ON public.notas;

CREATE POLICY notas_select ON public.notas
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.user_has_role_in_school(
        escola_id,
        ARRAY['admin_escola','secretaria','professor','admin','staff_admin','admin_financeiro','secretaria_financeiro']
      )
      OR EXISTS (
        SELECT 1
        FROM public.matriculas m
        JOIN public.alunos a ON a.id = m.aluno_id
        WHERE m.id = notas.matricula_id
          AND a.escola_id = notas.escola_id
          AND (a.usuario_auth_id = auth.uid() OR a.profile_id = auth.uid())
      )
    )
  );

CREATE POLICY notas_insert ON public.notas
  FOR INSERT
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','professor','admin','staff_admin','admin_financeiro','secretaria_financeiro']
    )
  );

CREATE POLICY notas_update ON public.notas
  FOR UPDATE
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','professor','admin','staff_admin','admin_financeiro','secretaria_financeiro']
    )
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','professor','admin','staff_admin','admin_financeiro','secretaria_financeiro']
    )
  );

CREATE POLICY notas_delete ON public.notas
  FOR DELETE
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','professor','admin','staff_admin','admin_financeiro','secretaria_financeiro']
    )
  );

DROP POLICY IF EXISTS mensalidades_select ON public.mensalidades;
DROP POLICY IF EXISTS mensalidades_insert ON public.mensalidades;
DROP POLICY IF EXISTS mensalidades_update ON public.mensalidades;
DROP POLICY IF EXISTS mensalidades_delete ON public.mensalidades;

CREATE POLICY mensalidades_select ON public.mensalidades
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.user_has_role_in_school(
        escola_id,
        ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']
      )
      OR EXISTS (
        SELECT 1
        FROM public.alunos a
        WHERE a.id = mensalidades.aluno_id
          AND a.escola_id = mensalidades.escola_id
          AND (a.usuario_auth_id = auth.uid() OR a.profile_id = auth.uid())
      )
    )
  );

CREATE POLICY mensalidades_insert ON public.mensalidades
  FOR INSERT
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']
    )
  );

CREATE POLICY mensalidades_update ON public.mensalidades
  FOR UPDATE
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']
    )
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']
    )
  );

CREATE POLICY mensalidades_delete ON public.mensalidades
  FOR DELETE
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']
    )
  );

COMMIT;
