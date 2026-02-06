BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_financeiro_inadimplencia_top AS
SELECT
  m.escola_id,
  m.aluno_id,
  MAX(m.nome_aluno) AS aluno_nome,
  SUM(COALESCE(m.valor_em_atraso, 0))::numeric(14, 2) AS valor_em_atraso,
  MAX(COALESCE(m.dias_em_atraso, 0))::int AS dias_em_atraso
FROM internal.mv_radar_inadimplencia m
GROUP BY m.escola_id, m.aluno_id
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_financeiro_inadimplencia_top
  ON internal.mv_financeiro_inadimplencia_top (escola_id, aluno_id);

CREATE OR REPLACE VIEW public.vw_financeiro_inadimplencia_top
WITH (security_invoker = true) AS
SELECT
  escola_id,
  aluno_id,
  aluno_nome,
  valor_em_atraso,
  dias_em_atraso
FROM internal.mv_financeiro_inadimplencia_top
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.refresh_mv_financeiro_inadimplencia_top()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_inadimplencia_top;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_financeiro_inadimplencia_top',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_inadimplencia_top$$
);

GRANT ALL ON TABLE internal.mv_financeiro_inadimplencia_top TO anon, authenticated, service_role;

COMMIT;
