DROP VIEW IF EXISTS public.vw_financeiro_kpis_mes;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_financeiro_kpis_mes;

CREATE MATERIALIZED VIEW internal.mv_financeiro_kpis_mes AS
WITH active_ano AS (
  SELECT escola_id, ano
  FROM public.anos_letivos
  WHERE ativo = true
),
previsto AS (
  SELECT
    m.escola_id,
    date_trunc('month', m.data_vencimento)::date AS mes_ref,
    SUM(COALESCE(m.valor_previsto, m.valor, 0))::numeric(14,2) AS previsto_total
  FROM public.mensalidades m
  JOIN active_ano aa
    ON aa.escola_id = m.escola_id
   AND m.ano_referencia = aa.ano
  WHERE m.status IN ('pendente', 'pago', 'atrasado', 'parcial', 'pago_parcial')
  GROUP BY m.escola_id, date_trunc('month', m.data_vencimento)::date
),
realizado AS (
  SELECT
    m.escola_id,
    date_trunc('month', m.data_pagamento_efetiva)::date AS mes_ref,
    SUM(COALESCE(m.valor_pago_total, 0))::numeric(14,2) AS realizado_total
  FROM public.mensalidades m
  JOIN active_ano aa
    ON aa.escola_id = m.escola_id
   AND m.ano_referencia = aa.ano
  WHERE m.data_pagamento_efetiva IS NOT NULL
    AND m.status IN ('pago', 'pago_parcial')
  GROUP BY m.escola_id, date_trunc('month', m.data_pagamento_efetiva)::date
),
inadimplencia AS (
  SELECT
    m.escola_id,
    SUM(GREATEST(COALESCE(m.valor_previsto, m.valor, 0) - COALESCE(m.valor_pago_total, 0), 0))::numeric(14,2) AS inadimplencia_total
  FROM public.mensalidades m
  JOIN active_ano aa
    ON aa.escola_id = m.escola_id
   AND m.ano_referencia = aa.ano
  WHERE m.data_vencimento < CURRENT_DATE
    AND m.status IN ('pendente', 'atrasado', 'parcial', 'pago_parcial')
  GROUP BY m.escola_id
),
meses AS (
  SELECT DISTINCT escola_id, mes_ref FROM previsto
  UNION
  SELECT DISTINCT escola_id, mes_ref FROM realizado
)
SELECT
  meses.escola_id,
  meses.mes_ref,
  COALESCE(previsto.previsto_total, 0) AS previsto_total,
  COALESCE(realizado.realizado_total, 0) AS realizado_total,
  COALESCE(inadimplencia.inadimplencia_total, 0) AS inadimplencia_total
FROM meses
LEFT JOIN previsto
  ON previsto.escola_id = meses.escola_id
 AND previsto.mes_ref = meses.mes_ref
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
  m.realizado_total,
  m.inadimplencia_total
FROM internal.mv_financeiro_kpis_mes m;

GRANT ALL ON TABLE internal.mv_financeiro_kpis_mes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.vw_financeiro_kpis_mes TO authenticated, service_role;
