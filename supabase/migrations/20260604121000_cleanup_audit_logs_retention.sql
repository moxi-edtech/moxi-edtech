BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_audit_logs()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  -- Mantém apenas os últimos 30 dias de logs de auditoria
  DELETE FROM public.audit_logs
  WHERE created_at < now() - interval '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_audit_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_audit_logs() TO postgres, service_role;

-- Executa a primeira limpeza manualmente
SELECT public.cleanup_audit_logs();

-- Agenda a limpeza diária às 04:00 da manhã
SELECT cron.schedule(
  'cleanup-audit-logs-30d',
  '0 4 * * *',
  'SELECT public.cleanup_audit_logs();'
);

COMMIT;
