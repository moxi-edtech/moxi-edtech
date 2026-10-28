-- KLASSE P0: remove direct JWT access to legacy SECURITY DEFINER writers.
-- They remain callable internally by owner/service_role.
-- No changes to student data, RAA results, notes, receipts or history.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.confirmar_matricula_core(uuid,integer,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_matricula_core(uuid,integer,uuid,uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.confirmar_matricula(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_matricula(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.finalizar_matricula_anual(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_matricula_anual(uuid,uuid,text,text) TO service_role;
COMMIT;
