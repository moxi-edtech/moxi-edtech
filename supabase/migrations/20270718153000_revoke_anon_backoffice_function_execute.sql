BEGIN;

REVOKE EXECUTE ON FUNCTION public.fix_academic_session_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_partner_commission_for_saas_payment(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_documento_print(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_mv_escola_cursos_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_mv_turmas_para_matricula() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_onboarding_workflow_state(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fix_academic_session_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_partner_commission_for_saas_payment(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_documento_print(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_mv_escola_cursos_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_mv_turmas_para_matricula() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_onboarding_workflow_state(uuid) TO authenticated, service_role;

COMMIT;
