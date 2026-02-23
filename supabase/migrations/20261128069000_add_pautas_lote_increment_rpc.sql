BEGIN;

CREATE OR REPLACE FUNCTION public.increment_pautas_lote_job(
  p_job_id uuid,
  p_success boolean,
  p_failed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.pautas_lote_jobs
  SET processed = processed + 1,
      success_count = success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
      failed_count = failed_count + CASE WHEN p_failed THEN 1 ELSE 0 END
  WHERE id = p_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_pautas_lote_job(uuid, boolean, boolean) TO authenticated, service_role;

COMMIT;
