BEGIN;

-- Enable RLS on linter-flagged public tables.
ALTER TABLE public.curriculum_preset_subjects_expected ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_reprocess_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curso_professor_responsavel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matriculas_status_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_fiscal_links ENABLE ROW LEVEL SECURITY;

-- Remove broad anon access on sensitive tables.
REVOKE ALL ON TABLE public.curriculum_preset_subjects_expected FROM anon;
REVOKE ALL ON TABLE public.fiscal_reprocess_jobs FROM anon;
REVOKE ALL ON TABLE public.curso_professor_responsavel FROM anon;
REVOKE ALL ON TABLE public.matriculas_status_audit FROM anon;
REVOKE ALL ON TABLE public.horario_versoes FROM anon;
REVOKE ALL ON TABLE public.financeiro_fiscal_links FROM anon;

-- Keep minimal authenticated grants (RLS enforces row access).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.curriculum_preset_subjects_expected FROM authenticated;
GRANT SELECT ON TABLE public.curriculum_preset_subjects_expected TO authenticated;

REVOKE DELETE, TRUNCATE ON TABLE public.fiscal_reprocess_jobs FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fiscal_reprocess_jobs TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.curso_professor_responsavel TO authenticated;

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.matriculas_status_audit FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.matriculas_status_audit TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.horario_versoes TO authenticated;

REVOKE DELETE, TRUNCATE ON TABLE public.financeiro_fiscal_links FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.financeiro_fiscal_links TO authenticated;

-- curriculum_preset_subjects_expected: authenticated read-only catalog.
DROP POLICY IF EXISTS cpse_select_auth ON public.curriculum_preset_subjects_expected;
CREATE POLICY cpse_select_auth
ON public.curriculum_preset_subjects_expected
FOR SELECT
TO authenticated
USING (true);

-- fiscal_reprocess_jobs: financeiro/admin roles scoped by escola.
DROP POLICY IF EXISTS frj_select ON public.fiscal_reprocess_jobs;
CREATE POLICY frj_select
ON public.fiscal_reprocess_jobs
FOR SELECT
TO authenticated
USING (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['financeiro','admin_financeiro','secretaria_financeiro','admin_escola','admin','staff_admin','super_admin']::text[]
  )
);

DROP POLICY IF EXISTS frj_insert ON public.fiscal_reprocess_jobs;
CREATE POLICY frj_insert
ON public.fiscal_reprocess_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['financeiro','admin_financeiro','secretaria_financeiro','admin_escola','admin','staff_admin','super_admin']::text[]
  )
);

DROP POLICY IF EXISTS frj_update ON public.fiscal_reprocess_jobs;
CREATE POLICY frj_update
ON public.fiscal_reprocess_jobs
FOR UPDATE
TO authenticated
USING (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['financeiro','admin_financeiro','secretaria_financeiro','admin_escola','admin','staff_admin','super_admin']::text[]
  )
)
WITH CHECK (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['financeiro','admin_financeiro','secretaria_financeiro','admin_escola','admin','staff_admin','super_admin']::text[]
  )
);

-- curso_professor_responsavel: escola tenant-scoped + pedagogic/admin roles.
DROP POLICY IF EXISTS cpr_select ON public.curso_professor_responsavel;
CREATE POLICY cpr_select
ON public.curso_professor_responsavel
FOR SELECT
TO authenticated
USING (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin());

DROP POLICY IF EXISTS cpr_insert ON public.curso_professor_responsavel;
CREATE POLICY cpr_insert
ON public.curso_professor_responsavel
FOR INSERT
TO authenticated
WITH CHECK (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['admin_escola','admin','staff_admin','secretaria','formacao_admin','formacao_secretaria','super_admin']::text[]
  )
);

DROP POLICY IF EXISTS cpr_update ON public.curso_professor_responsavel;
CREATE POLICY cpr_update
ON public.curso_professor_responsavel
FOR UPDATE
TO authenticated
USING (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['admin_escola','admin','staff_admin','secretaria','formacao_admin','formacao_secretaria','super_admin']::text[]
  )
)
WITH CHECK (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['admin_escola','admin','staff_admin','secretaria','formacao_admin','formacao_secretaria','super_admin']::text[]
  )
);

DROP POLICY IF EXISTS cpr_delete ON public.curso_professor_responsavel;
CREATE POLICY cpr_delete
ON public.curso_professor_responsavel
FOR DELETE
TO authenticated
USING (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['admin_escola','admin','staff_admin','secretaria','formacao_admin','formacao_secretaria','super_admin']::text[]
  )
);

-- matriculas_status_audit: infer tenant by matricula relation.
DROP POLICY IF EXISTS msa_select ON public.matriculas_status_audit;
CREATE POLICY msa_select
ON public.matriculas_status_audit
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.matriculas m
    WHERE m.id = matriculas_status_audit.matricula_id
      AND (m.escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
      AND public.user_has_role_in_school(
        m.escola_id,
        ARRAY['admin_escola','admin','staff_admin','secretaria','secretaria_financeiro','admin_financeiro','super_admin']::text[]
      )
  )
);

DROP POLICY IF EXISTS msa_insert ON public.matriculas_status_audit;
CREATE POLICY msa_insert
ON public.matriculas_status_audit
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.matriculas m
    WHERE m.id = matriculas_status_audit.matricula_id
      AND (m.escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
      AND public.user_has_role_in_school(
        m.escola_id,
        ARRAY['admin_escola','admin','staff_admin','secretaria','secretaria_financeiro','admin_financeiro','super_admin']::text[]
      )
  )
);

-- horario_versoes: tenant-wide read, admin/secretaria write.
DROP POLICY IF EXISTS hv_select ON public.horario_versoes;
CREATE POLICY hv_select
ON public.horario_versoes
FOR SELECT
TO authenticated
USING (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin());

DROP POLICY IF EXISTS hv_insert ON public.horario_versoes;
CREATE POLICY hv_insert
ON public.horario_versoes
FOR INSERT
TO authenticated
WITH CHECK (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['admin_escola','admin','staff_admin','secretaria','super_admin']::text[]
  )
);

DROP POLICY IF EXISTS hv_update ON public.horario_versoes;
CREATE POLICY hv_update
ON public.horario_versoes
FOR UPDATE
TO authenticated
USING (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['admin_escola','admin','staff_admin','secretaria','super_admin']::text[]
  )
)
WITH CHECK (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['admin_escola','admin','staff_admin','secretaria','super_admin']::text[]
  )
);

DROP POLICY IF EXISTS hv_delete ON public.horario_versoes;
CREATE POLICY hv_delete
ON public.horario_versoes
FOR DELETE
TO authenticated
USING (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['admin_escola','admin','staff_admin','secretaria','super_admin']::text[]
  )
);

-- financeiro_fiscal_links: financeiro/admin roles only.
DROP POLICY IF EXISTS ffl_select ON public.financeiro_fiscal_links;
CREATE POLICY ffl_select
ON public.financeiro_fiscal_links
FOR SELECT
TO authenticated
USING (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['secretaria','financeiro','admin_financeiro','secretaria_financeiro','admin_escola','admin','staff_admin','super_admin']::text[]
  )
);

DROP POLICY IF EXISTS ffl_insert ON public.financeiro_fiscal_links;
CREATE POLICY ffl_insert
ON public.financeiro_fiscal_links
FOR INSERT
TO authenticated
WITH CHECK (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['secretaria','financeiro','admin_financeiro','secretaria_financeiro','admin_escola','admin','staff_admin','super_admin']::text[]
  )
);

DROP POLICY IF EXISTS ffl_update ON public.financeiro_fiscal_links;
CREATE POLICY ffl_update
ON public.financeiro_fiscal_links
FOR UPDATE
TO authenticated
USING (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['secretaria','financeiro','admin_financeiro','secretaria_financeiro','admin_escola','admin','staff_admin','super_admin']::text[]
  )
)
WITH CHECK (
  (escola_id = public.current_tenant_escola_id() OR public.is_super_or_global_admin())
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['secretaria','financeiro','admin_financeiro','secretaria_financeiro','admin_escola','admin','staff_admin','super_admin']::text[]
  )
);

COMMIT;
