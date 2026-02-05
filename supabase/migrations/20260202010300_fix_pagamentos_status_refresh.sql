CREATE OR REPLACE FUNCTION public.refresh_mv_pagamentos_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_pagamentos_status;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_pagamentos_status',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_pagamentos_status$$
);
