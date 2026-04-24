BEGIN;

-- Explicit internal execution context for trusted backend calls (service_role).
CREATE OR REPLACE FUNCTION public.is_internal_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(auth.role(), '') = 'service_role';
$$;

COMMENT ON FUNCTION public.is_internal_service_role()
IS 'Returns true only for service_role context. Used to keep admin/internal views callable by trusted backend jobs without relaxing anon/authenticated access.';

-- Super-admin schools listing should be available for super/global admins and trusted service_role backend context.
CREATE OR REPLACE VIEW public.escolas_view AS
SELECT
  e.id,
  e.nome,
  e.status,
  e.plano_atual,
  e.plano_atual::text AS plano,
  (
    SELECT max(al.created_at)::timestamp without time zone
    FROM public.audit_logs al
    WHERE al.escola_id = e.id
  ) AS last_access,
  COALESCE(a.total_alunos, 0) AS total_alunos,
  COALESCE(pf.total_professores, 0) AS total_professores,
  e.endereco AS cidade,
  NULL::text AS estado
FROM public.escolas e
LEFT JOIN (
  SELECT alunos.escola_id, count(*)::integer AS total_alunos
  FROM public.alunos
  GROUP BY alunos.escola_id
) a ON a.escola_id = e.id
LEFT JOIN (
  SELECT p.escola_id, count(*)::integer AS total_professores
  FROM public.profiles p
  WHERE p.role = 'professor'::public.user_role
  GROUP BY p.escola_id
) pf ON pf.escola_id = e.id
WHERE public.is_super_or_global_admin()
   OR public.is_internal_service_role();

-- Super-admin wrappers for dashboard metrics: keep super/global admin + internal service role access.
CREATE OR REPLACE VIEW public.vw_super_admin_audit_metrics AS
SELECT
  escola_id,
  ultimo_acesso,
  accessos_24h,
  error_count_24h,
  last_error
FROM internal.mv_super_admin_audit_metrics
WHERE public.is_super_or_global_admin()
   OR public.is_internal_service_role();

CREATE OR REPLACE VIEW public.vw_super_admin_escola_metrics AS
SELECT
  escola_id,
  alunos_ativos,
  alunos_inativos,
  professores,
  turmas_ativas,
  turmas_total,
  matriculas_ativas
FROM internal.mv_super_admin_escola_metrics
WHERE public.is_super_or_global_admin()
   OR public.is_internal_service_role();

ALTER VIEW public.escolas_view SET (security_invoker = true);
ALTER VIEW public.vw_super_admin_audit_metrics SET (security_invoker = true);
ALTER VIEW public.vw_super_admin_escola_metrics SET (security_invoker = true);

COMMIT;
