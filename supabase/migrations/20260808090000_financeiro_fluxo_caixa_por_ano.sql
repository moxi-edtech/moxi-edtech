CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_financeiro_escola_dia_ano AS
SELECT
  p.escola_id,
  COALESCE(NULLIF(m.ano_letivo, '')::integer, mat.ano_letivo) AS ano_letivo,
  p.data_pagamento::date AS dia,
  count(*) FILTER (WHERE p.status IN ('pago', 'concluido')) AS qtd_pagos,
  count(*) AS qtd_total
FROM public.pagamentos p
JOIN public.mensalidades m ON m.id = p.mensalidade_id
LEFT JOIN public.matriculas mat ON mat.id = m.matricula_id
WHERE p.data_pagamento IS NOT NULL
  AND COALESCE(NULLIF(m.ano_letivo, '')::integer, mat.ano_letivo) IS NOT NULL
GROUP BY
  p.escola_id,
  COALESCE(NULLIF(m.ano_letivo, '')::integer, mat.ano_letivo),
  p.data_pagamento::date
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_financeiro_escola_dia_ano
  ON internal.mv_financeiro_escola_dia_ano (escola_id, ano_letivo, dia);

CREATE OR REPLACE VIEW public.vw_financeiro_escola_dia_ano AS
SELECT escola_id, ano_letivo, dia, qtd_pagos, qtd_total
FROM internal.mv_financeiro_escola_dia_ano
WHERE escola_id = public.current_tenant_escola_id();

CREATE OR REPLACE FUNCTION public.refresh_mv_financeiro_escola_dia_ano()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_escola_dia_ano;
END;
$$;

GRANT SELECT ON public.vw_financeiro_escola_dia_ano TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_mv_financeiro_escola_dia_ano() TO service_role;

SELECT cron.schedule(
  'refresh_mv_financeiro_escola_dia_ano',
  '*/10 * * * *',
  $$SELECT public.refresh_mv_financeiro_escola_dia_ano()$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_financeiro_escola_dia_ano'
);

REFRESH MATERIALIZED VIEW internal.mv_financeiro_escola_dia_ano;
