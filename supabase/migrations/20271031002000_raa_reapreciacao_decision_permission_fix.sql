-- RAA: school-scoped reading and filing, director-only academic decisions.
-- The old permissive FOR ALL policy let any school member UPDATE/DELETE
-- an academic appeal directly through PostgREST, bypassing the Next.js route.
-- Run after 20271031001000_historico_transitado_academic_permissions_ssot_20261030.sql.
BEGIN;

-- Exact role check for academic decisions. The generic
-- user_has_role_in_school() expands admin to admin_financeiro: unsafe here.
CREATE OR REPLACE FUNCTION public.raa_has_exact_school_role(
  p_escola_id uuid, p_roles text[]
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.escola_users AS eu
    WHERE eu.escola_id = p_escola_id
      AND eu.user_id = auth.uid()
      AND eu.papel::text = ANY (p_roles)
  );
$function$;
REVOKE ALL ON FUNCTION public.raa_has_exact_school_role(uuid, text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.raa_has_exact_school_role(uuid, text[])
  TO authenticated;

ALTER TABLE public.reapreciacao_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reapreciacao_pedidos_tenant ON public.reapreciacao_pedidos;
DROP POLICY IF EXISTS reapreciacao_pedidos_school_read ON public.reapreciacao_pedidos;
DROP POLICY IF EXISTS reapreciacao_pedidos_staff_file ON public.reapreciacao_pedidos;
DROP POLICY IF EXISTS reapreciacao_pedidos_director_decide ON public.reapreciacao_pedidos;

-- No direct anonymous API mutations, DELETE, TRUNCATE, references or trigger
-- maintenance for authenticated users. The service role retains existing rights.
REVOKE ALL ON TABLE public.reapreciacao_pedidos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.reapreciacao_pedidos TO authenticated;
GRANT UPDATE (estado, decisao_motivo, decidido_por, decidido_em, updated_at)
  ON TABLE public.reapreciacao_pedidos TO authenticated;

CREATE POLICY reapreciacao_pedidos_school_read
  ON public.reapreciacao_pedidos
  FOR SELECT TO authenticated
  USING (public.user_can_access_raa_school(escola_id));

-- The secretary/teacher may file a petition on their own identity.
-- Filing a request can never create a decided or time-expired record.
CREATE POLICY reapreciacao_pedidos_staff_file
  ON public.reapreciacao_pedidos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_raa_school(escola_id)
    AND public.raa_has_exact_school_role(
      escola_id, ARRAY['admin','admin_escola','staff_admin','diretor','secretaria','professor']::text[]
    )
    AND solicitado_por = (SELECT auth.uid())
    AND estado = 'pendente'
    AND decidido_por IS NULL
    AND decidido_em IS NULL
    AND decisao_motivo IS NULL
    AND resultado_publicado_em IS NOT NULL
    AND prazo_em > now()
  );

-- Only school academic directors may move a pending petition forward.
-- An updated row cannot switch school or origin identifiers: authenticated
-- users have UPDATE grants exclusively for the five decision columns above.
CREATE POLICY reapreciacao_pedidos_director_decide
  ON public.reapreciacao_pedidos
  FOR UPDATE TO authenticated
  USING (
    public.user_can_access_raa_school(escola_id)
    AND public.raa_has_exact_school_role(
      escola_id, ARRAY['admin','admin_escola','diretor']::text[]
    )
    AND estado IN ('pendente','em_analise')
  )
  WITH CHECK (
    public.user_can_access_raa_school(escola_id)
    AND public.raa_has_exact_school_role(
      escola_id, ARRAY['admin','admin_escola','diretor']::text[]
    )
    AND (
      (estado = 'expirado' AND prazo_em <= now())
      OR (
        estado IN ('em_analise','deferido','indeferido','cancelado')
        AND prazo_em > now()
        AND decidido_por = (SELECT auth.uid())
        AND decidido_em IS NOT NULL
        AND length(btrim(coalesce(decisao_motivo,''))) >= 5
      )
    )
  );

COMMENT ON POLICY reapreciacao_pedidos_director_decide ON public.reapreciacao_pedidos
  IS 'Only academic directors can decide petitions; web endpoint and PostgREST enforce the same roles.';

-- The disciplinary decision table had the same alias bypass in UPDATE.
-- Keep new event filing and school-scoped reading, but prevent client
-- manipulation of the enrolment, school, classification and outcome evidence.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.raa_indisciplina_eventos
  FROM PUBLIC, anon, authenticated;
GRANT UPDATE (estado, decisao_motivo, resolvido_por, resolvido_em, updated_at)
  ON TABLE public.raa_indisciplina_eventos TO authenticated;

DROP POLICY IF EXISTS raa_indisciplina_director_update_v2
  ON public.raa_indisciplina_eventos;
CREATE POLICY raa_indisciplina_director_update_v2
  ON public.raa_indisciplina_eventos FOR UPDATE TO authenticated
  USING (
    public.user_can_access_raa_school(escola_id)
    AND public.raa_has_exact_school_role(escola_id, ARRAY['admin','admin_escola','diretor']::text[])
    AND estado IN ('registado','em_analise')
  )
  WITH CHECK (
    public.user_can_access_raa_school(escola_id)
    AND public.raa_has_exact_school_role(escola_id, ARRAY['admin','admin_escola','diretor']::text[])
    AND length(btrim(coalesce(decisao_motivo,''))) >= 15
    AND (
      (estado = 'em_analise' AND resolvido_por IS NULL AND resolvido_em IS NULL)
      OR
      (estado IN ('resolvido','cancelado')
       AND resolvido_por = (SELECT auth.uid()) AND resolvido_em IS NOT NULL)
    )
  );

COMMIT;
