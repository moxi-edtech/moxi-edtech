BEGIN;

CREATE OR REPLACE FUNCTION public.try_start_pautas_lote_job(
  p_job_id uuid,
  p_escola_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_updated integer := 0;
BEGIN
  IF p_escola_id IS DISTINCT FROM v_escola_id THEN
    NULL;
  END IF;

  IF NOT public.user_has_role_in_school(v_escola_id, ARRAY['admin_escola', 'secretaria', 'admin']) THEN
    RAISE EXCEPTION 'permission denied: admin_escola required';
  END IF;

  UPDATE public.pautas_lote_jobs
     SET status = 'PROCESSING',
         processed = 0,
         success_count = 0,
         failed_count = 0,
         zip_path = NULL,
         error_message = NULL
   WHERE id = p_job_id
     AND escola_id = v_escola_id
     AND status <> 'PROCESSING'
     AND NOT EXISTS (
       SELECT 1
         FROM public.pautas_lote_jobs
        WHERE escola_id = v_escola_id
          AND status = 'PROCESSING'
          AND id <> p_job_id
     );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_start_pautas_lote_job(uuid, uuid) TO authenticated;

COMMIT;
