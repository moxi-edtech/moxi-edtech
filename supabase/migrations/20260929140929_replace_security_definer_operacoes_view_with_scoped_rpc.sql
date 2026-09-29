CREATE OR REPLACE FUNCTION public.get_operacoes_dashboard_work_for_current_user()
RETURNS TABLE (
  escola_id uuid,
  classes_without_published_schedule integer,
  first_class_without_published_schedule_id uuid,
  documents_pending integer,
  failed_messages integer,
  refreshed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT
    m.escola_id,
    m.classes_without_published_schedule,
    m.first_class_without_published_schedule_id,
    m.documents_pending,
    m.failed_messages,
    m.refreshed_at
  FROM internal.mv_operacoes_dashboard_work m
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.escola_users eu
      WHERE eu.escola_id = m.escola_id
        AND eu.user_id = (SELECT auth.uid())
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_operacoes_dashboard_work_for_current_user()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operacoes_dashboard_work_for_current_user()
TO authenticated;

CREATE OR REPLACE VIEW public.vw_operacoes_dashboard_work
WITH (security_invoker = true, security_barrier = true)
AS
SELECT *
FROM public.get_operacoes_dashboard_work_for_current_user();

REVOKE ALL ON TABLE public.vw_operacoes_dashboard_work FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vw_operacoes_dashboard_work TO authenticated, service_role;

REVOKE ALL ON TABLE internal.mv_operacoes_dashboard_work FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE internal.mv_operacoes_dashboard_work TO service_role;

