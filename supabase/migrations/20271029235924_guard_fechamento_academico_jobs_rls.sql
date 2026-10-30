-- P0: only school leadership with academic closing permission may create,
-- update or resume irreversible closure jobs and their audit steps.
-- This file is intentionally not applied by this PR.
BEGIN;

DROP POLICY IF EXISTS fechamento_academico_jobs_select
  ON public.fechamento_academico_jobs;
DROP POLICY IF EXISTS fechamento_academico_jobs_insert
  ON public.fechamento_academico_jobs;
DROP POLICY IF EXISTS fechamento_academico_jobs_update
  ON public.fechamento_academico_jobs;
DROP POLICY IF EXISTS fechamento_academico_steps_select
  ON public.fechamento_academico_job_steps;
DROP POLICY IF EXISTS fechamento_academico_steps_insert
  ON public.fechamento_academico_job_steps;

-- Secretaria and pedagogical leadership may inspect progress. Changes require
-- the same privileged roles used by the API and the async executor.
CREATE POLICY fechamento_academico_jobs_select
  ON public.fechamento_academico_jobs FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_financeiro',
            'secretaria','diretor','diretor_pedagogico']::text[])
  );

CREATE POLICY fechamento_academico_jobs_insert
  ON public.fechamento_academico_jobs FOR INSERT TO authenticated
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_financeiro']::text[])
  );

CREATE POLICY fechamento_academico_jobs_update
  ON public.fechamento_academico_jobs FOR UPDATE TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_financeiro']::text[])
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_financeiro']::text[])
  );

CREATE POLICY fechamento_academico_steps_select
  ON public.fechamento_academico_job_steps FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_financeiro',
            'secretaria','diretor','diretor_pedagogico']::text[])
  );

CREATE POLICY fechamento_academico_steps_insert
  ON public.fechamento_academico_job_steps FOR INSERT TO authenticated
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_financeiro']::text[])
  );

COMMIT;
