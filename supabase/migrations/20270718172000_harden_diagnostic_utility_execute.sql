BEGIN;

REVOKE EXECUTE ON FUNCTION public.audit_request_context() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_request_context() TO service_role;

DO $migration$
DECLARE signature regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.check_super_admin_role()'::regprocedure,
    'public.create_or_get_turma_by_code(uuid,integer,text)'::regprocedure,
    'public.get_public_slug_for_current_tenant(uuid)'::regprocedure,
    'public.partitions_info()'::regprocedure,
    'public.set_communication_outbox_action(uuid,text)'::regprocedure
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
  END LOOP;
END
$migration$;

COMMIT;
