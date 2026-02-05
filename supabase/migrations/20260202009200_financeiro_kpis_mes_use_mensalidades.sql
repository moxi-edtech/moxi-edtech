DROP VIEW IF EXISTS public.vw_financeiro_kpis_mes;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_financeiro_kpis_mes;

CREATE MATERIALIZED VIEW internal.mv_financeiro_kpis_mes AS
WITH previsto AS (
  SELECT m.escola_id,
     date_trunc('month', m.data_vencimento::timestamptz)::date AS mes_ref,
     sum(COALESCE(m.valor_previsto, m.valor, 0::numeric))::numeric(14,2) AS previsto_total
    FROM mensalidades m
   WHERE m.status = ANY (ARRAY['pendente'::text, 'pago'::text, 'atrasado'::text, 'parcial'::text, 'pago_parcial'::text])
   GROUP BY m.escola_id, date_trunc('month', m.data_vencimento::timestamptz)::date
), realizado AS (
  SELECT m.escola_id,
     date_trunc('month', m.data_pagamento_efetiva::timestamptz)::date AS mes_ref,
     sum(COALESCE(m.valor_pago_total, 0::numeric))::numeric(14,2) AS realizado_total
    FROM mensalidades m
   WHERE m.data_pagamento_efetiva IS NOT NULL
     AND m.status = ANY (ARRAY['pago'::text, 'pago_parcial'::text])
   GROUP BY m.escola_id, date_trunc('month', m.data_pagamento_efetiva::timestamptz)::date
), inadimplencia AS (
  SELECT m.escola_id,
     sum(GREATEST(COALESCE(m.valor_previsto, m.valor, 0::numeric) - COALESCE(m.valor_pago_total, 0::numeric), 0::numeric))::numeric(14,2) AS inadimplencia_total
    FROM mensalidades m
   WHERE m.data_vencimento < CURRENT_DATE
     AND m.status = ANY (ARRAY['pendente'::text, 'atrasado'::text, 'parcial'::text, 'pago_parcial'::text])
   GROUP BY m.escola_id
), meses AS (
  SELECT DISTINCT previsto.escola_id, previsto.mes_ref FROM previsto
  UNION
  SELECT DISTINCT realizado.escola_id, realizado.mes_ref FROM realizado
)
SELECT meses.escola_id,
  meses.mes_ref,
  COALESCE(previsto.previsto_total, 0::numeric) AS previsto_total,
  COALESCE(realizado.realizado_total, 0::numeric) AS realizado_total,
  COALESCE(inadimplencia.inadimplencia_total, 0::numeric) AS inadimplencia_total
FROM meses
LEFT JOIN previsto ON previsto.escola_id = meses.escola_id AND previsto.mes_ref = meses.mes_ref
LEFT JOIN realizado ON realizado.escola_id = meses.escola_id AND realizado.mes_ref = meses.mes_ref
LEFT JOIN inadimplencia ON inadimplencia.escola_id = meses.escola_id;

CREATE UNIQUE INDEX ux_mv_financeiro_kpis_mes
  ON internal.mv_financeiro_kpis_mes (escola_id, mes_ref);

CREATE OR REPLACE VIEW public.vw_financeiro_kpis_mes WITH (security_invoker = true) AS
SELECT escola_id,
  mes_ref,
  previsto_total,
  realizado_total,
  inadimplencia_total
FROM internal.mv_financeiro_kpis_mes m
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM escola_users eu
  WHERE eu.user_id = auth.uid()
);

GRANT ALL ON TABLE internal.mv_financeiro_kpis_mes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.vw_financeiro_kpis_mes TO authenticated, service_role;
