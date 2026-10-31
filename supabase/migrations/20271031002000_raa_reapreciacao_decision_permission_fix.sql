-- RAA: school-scoped reading and filing, director-only academic decisions.
-- The old permissive FOR ALL policy let any school member UPDATE/DELETE
-- an academic appeal directly through PostgREST, bypassing the Next.js route.
-- Run after 20271031001000_historico_transitado_academic_permissions_ssot_20261030.sql.
BEGIN;

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
    AND public.user_has_role_in_school(
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
    AND public.user_has_role_in_school(
      escola_id, ARRAY['admin','admin_escola','diretor']::text[]
    )
    AND estado IN ('pendente','em_analise')
  )
  WITH CHECK (
    public.user_can_access_raa_school(escola_id)
    AND public.user_has_role_in_school(
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

COMMIT;
