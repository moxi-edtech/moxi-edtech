BEGIN;

-- The original read model counted every class of the school against every
-- academic year. Keep it intact and publish a scoped replacement instead.
CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_financeiro_missing_pricing_count_v2 AS
SELECT
  a.escola_id,
  a.ano AS ano_letivo,
  COUNT(*) FILTER (
    WHERE ft.id IS NULL
      OR COALESCE(ft.valor_matricula, 0) <= 0
      OR COALESCE(ft.valor_mensalidade, 0) <= 0
  ) AS missing_count
FROM public.anos_letivos a
JOIN public.classes c
  ON c.escola_id = a.escola_id
  AND c.ano_letivo_id = a.id
JOIN public.cursos co
  ON co.id = c.curso_id
  AND co.escola_id = a.escola_id
LEFT JOIN public.financeiro_tabelas ft
  ON ft.escola_id = a.escola_id
  AND ft.ano_letivo = a.ano
  AND ft.curso_id = co.id
  AND ft.classe_id = c.id
GROUP BY a.escola_id, a.ano
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_financeiro_missing_pricing_count_v2
  ON internal.mv_financeiro_missing_pricing_count_v2 (escola_id, ano_letivo);

CREATE OR REPLACE VIEW public.vw_financeiro_missing_pricing_count AS
SELECT escola_id, ano_letivo, missing_count
FROM internal.mv_financeiro_missing_pricing_count_v2
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.refresh_mv_financeiro_missing_pricing_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_missing_pricing_count_v2;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_financeiro_missing_pricing_count_v2',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_missing_pricing_count_v2$$
);

GRANT ALL ON TABLE internal.mv_financeiro_missing_pricing_count_v2 TO anon, authenticated, service_role;

REFRESH MATERIALIZED VIEW internal.mv_financeiro_missing_pricing_count_v2;

COMMIT;
