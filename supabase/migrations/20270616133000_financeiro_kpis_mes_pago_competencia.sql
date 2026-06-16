DROP VIEW IF EXISTS public.vw_financeiro_kpis_mes;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_financeiro_kpis_mes;

CREATE MATERIALIZED VIEW internal.mv_financeiro_kpis_mes AS
WITH mensalidades_validas AS (
  SELECT
    m.*
  FROM public.mensalidades m
  WHERE COALESCE(m.status, '') NOT IN ('cancelado', 'cancelada', 'anulado', 'anulada', 'estornado', 'estornada')
    AND m.escola_id IS NOT NULL
    AND m.ano_referencia IS NOT NULL
    AND m.mes_referencia IS NOT NULL
    AND m.ano_referencia::text ~ '^\d{4}$'
    AND m.mes_referencia::text ~ '^\d{1,2}$'
    AND m.ano_referencia::int BETWEEN 2000 AND 2100
    AND m.mes_referencia::int BETWEEN 1 AND 12
),
competencia AS (
  SELECT
    m.escola_id,
    make_date(m.ano_referencia::int, m.mes_referencia::int, 1) AS mes_ref,
    SUM(COALESCE(m.valor_previsto, m.valor, 0))::numeric(14,2) AS previsto_total,
    SUM(COALESCE(m.valor_pago_total, 0))::numeric(14,2) AS pago_competencia_total
  FROM mensalidades_validas m
  GROUP BY m.escola_id, make_date(m.ano_referencia::int, m.mes_referencia::int, 1)
),
realizado AS (
  SELECT
    m.escola_id,
    date_trunc('month', m.data_pagamento_efetiva)::date AS mes_ref,
    SUM(COALESCE(m.valor_pago_total, 0))::numeric(14,2) AS realizado_total
  FROM mensalidades_validas m
  WHERE m.data_pagamento_efetiva IS NOT NULL
    AND COALESCE(m.status, '') IN ('pago', 'pago_parcial')
  GROUP BY m.escola_id, date_trunc('month', m.data_pagamento_efetiva)::date
),
inadimplencia AS (
  SELECT
    m.escola_id,
    SUM(
      GREATEST(
        COALESCE(m.valor_previsto, m.valor, 0) - COALESCE(m.valor_pago_total, 0),
        0
      )
    )::numeric(14,2) AS inadimplencia_total
  FROM mensalidades_validas m
  WHERE m.data_vencimento < CURRENT_DATE
    AND COALESCE(m.status, '') IN ('pendente', 'atrasado', 'parcial', 'pago_parcial')
  GROUP BY m.escola_id
),
meses AS (
  SELECT DISTINCT escola_id, mes_ref FROM competencia
  UNION
  SELECT DISTINCT escola_id, mes_ref FROM realizado
)
SELECT
  meses.escola_id,
  meses.mes_ref,
  COALESCE(competencia.previsto_total, 0)::numeric(14,2) AS previsto_total,
  COALESCE(competencia.pago_competencia_total, 0)::numeric(14,2) AS pago_competencia_total,
  COALESCE(realizado.realizado_total, 0)::numeric(14,2) AS realizado_total,
  COALESCE(inadimplencia.inadimplencia_total, 0)::numeric(14,2) AS inadimplencia_total
FROM meses
LEFT JOIN competencia
  ON competencia.escola_id = meses.escola_id
 AND competencia.mes_ref = meses.mes_ref
LEFT JOIN realizado
  ON realizado.escola_id = meses.escola_id
 AND realizado.mes_ref = meses.mes_ref
LEFT JOIN inadimplencia
  ON inadimplencia.escola_id = meses.escola_id;

CREATE UNIQUE INDEX ux_mv_financeiro_kpis_mes
  ON internal.mv_financeiro_kpis_mes (escola_id, mes_ref);

CREATE OR REPLACE VIEW public.vw_financeiro_kpis_mes WITH (security_invoker = true) AS
SELECT
  m.escola_id,
  m.mes_ref,
  m.previsto_total,
  m.pago_competencia_total,
  m.realizado_total,
  m.inadimplencia_total
FROM internal.mv_financeiro_kpis_mes m;

GRANT ALL ON TABLE internal.mv_financeiro_kpis_mes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.vw_financeiro_kpis_mes TO authenticated, service_role;
