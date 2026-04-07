-- Ticket 5 — Performance Financeira (Formação)
-- MVs para dashboards pesados com refresh concorrente + cron.

CREATE SCHEMA IF NOT EXISTS internal;

DROP MATERIALIZED VIEW IF EXISTS internal.mv_formacao_cohorts_lotacao;
CREATE MATERIALIZED VIEW internal.mv_formacao_cohorts_lotacao AS
SELECT
  c.escola_id,
  c.id AS cohort_id,
  c.nome AS cohort_nome,
  c.vagas,
  COUNT(i.id) FILTER (WHERE i.status_pagamento <> 'cancelado')::int AS inscritos_total,
  COUNT(i.id) FILTER (WHERE i.status_pagamento = 'pago')::int AS inscritos_pagos,
  ROUND(
    (COUNT(i.id) FILTER (WHERE i.status_pagamento <> 'cancelado')::numeric / NULLIF(c.vagas::numeric, 0)) * 100,
    2
  ) AS lotacao_percentual
FROM public.formacao_cohorts c
LEFT JOIN public.formacao_faturas_lote f
  ON f.escola_id = c.escola_id
 AND f.cohort_id = c.id
LEFT JOIN public.formacao_faturas_lote_itens i
  ON i.escola_id = f.escola_id
 AND i.fatura_lote_id = f.id
GROUP BY c.escola_id, c.id, c.nome, c.vagas;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_formacao_cohorts_lotacao
  ON internal.mv_formacao_cohorts_lotacao (escola_id, cohort_id);

DROP MATERIALIZED VIEW IF EXISTS internal.mv_formacao_inadimplencia_resumo;
CREATE MATERIALIZED VIEW internal.mv_formacao_inadimplencia_resumo AS
WITH b2c AS (
  SELECT
    i.escola_id,
    COUNT(*) FILTER (WHERE i.status_pagamento IN ('pendente', 'parcial'))::int AS titulos_em_aberto,
    COALESCE(SUM(i.valor_total) FILTER (WHERE i.status_pagamento IN ('pendente', 'parcial')), 0)::numeric(14,2) AS valor_em_aberto
  FROM public.formacao_faturas_lote_itens i
  GROUP BY i.escola_id
),
b2b AS (
  SELECT
    f.escola_id,
    COUNT(*) FILTER (WHERE f.status IN ('emitida', 'parcial'))::int AS faturas_em_aberto,
    COALESCE(SUM(f.total_liquido) FILTER (WHERE f.status IN ('emitida', 'parcial')), 0)::numeric(14,2) AS valor_em_aberto
  FROM public.formacao_faturas_lote f
  GROUP BY f.escola_id
)
SELECT
  COALESCE(b2c.escola_id, b2b.escola_id) AS escola_id,
  COALESCE(b2c.titulos_em_aberto, 0) AS b2c_titulos_em_aberto,
  COALESCE(b2c.valor_em_aberto, 0)::numeric(14,2) AS b2c_valor_em_aberto,
  COALESCE(b2b.faturas_em_aberto, 0) AS b2b_faturas_em_aberto,
  COALESCE(b2b.valor_em_aberto, 0)::numeric(14,2) AS b2b_valor_em_aberto,
  (COALESCE(b2c.valor_em_aberto, 0) + COALESCE(b2b.valor_em_aberto, 0))::numeric(14,2) AS total_em_aberto
FROM b2c
FULL OUTER JOIN b2b
  ON b2b.escola_id = b2c.escola_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_formacao_inadimplencia_resumo
  ON internal.mv_formacao_inadimplencia_resumo (escola_id);

DROP MATERIALIZED VIEW IF EXISTS internal.mv_formacao_margem_por_edicao;
CREATE MATERIALIZED VIEW internal.mv_formacao_margem_por_edicao AS
WITH receita AS (
  SELECT
    f.escola_id,
    f.cohort_id,
    COALESCE(SUM(i.valor_total) FILTER (WHERE i.status_pagamento <> 'cancelado'), 0)::numeric(14,2) AS receita_total
  FROM public.formacao_faturas_lote f
  LEFT JOIN public.formacao_faturas_lote_itens i
    ON i.escola_id = f.escola_id
   AND i.fatura_lote_id = f.id
  WHERE f.cohort_id IS NOT NULL
  GROUP BY f.escola_id, f.cohort_id
),
custo AS (
  SELECT
    h.escola_id,
    h.cohort_id,
    COALESCE(SUM(h.valor_liquido) FILTER (WHERE h.status IN ('aprovado', 'pago')), 0)::numeric(14,2) AS custo_honorarios
  FROM public.formacao_honorarios_lancamentos h
  GROUP BY h.escola_id, h.cohort_id
)
SELECT
  c.escola_id,
  c.id AS cohort_id,
  c.nome AS cohort_nome,
  COALESCE(r.receita_total, 0)::numeric(14,2) AS receita_total,
  COALESCE(ct.custo_honorarios, 0)::numeric(14,2) AS custo_honorarios,
  (COALESCE(r.receita_total, 0) - COALESCE(ct.custo_honorarios, 0))::numeric(14,2) AS margem_bruta
FROM public.formacao_cohorts c
LEFT JOIN receita r
  ON r.escola_id = c.escola_id
 AND r.cohort_id = c.id
LEFT JOIN custo ct
  ON ct.escola_id = c.escola_id
 AND ct.cohort_id = c.id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_formacao_margem_por_edicao
  ON internal.mv_formacao_margem_por_edicao (escola_id, cohort_id);

CREATE OR REPLACE VIEW public.vw_formacao_cohorts_lotacao AS
SELECT *
FROM internal.mv_formacao_cohorts_lotacao
WHERE escola_id = public.current_tenant_escola_id();

CREATE OR REPLACE VIEW public.vw_formacao_inadimplencia_resumo AS
SELECT *
FROM internal.mv_formacao_inadimplencia_resumo
WHERE escola_id = public.current_tenant_escola_id();

CREATE OR REPLACE VIEW public.vw_formacao_margem_por_edicao AS
SELECT *
FROM internal.mv_formacao_margem_por_edicao
WHERE escola_id = public.current_tenant_escola_id();

GRANT SELECT ON public.vw_formacao_cohorts_lotacao TO authenticated;
GRANT SELECT ON public.vw_formacao_inadimplencia_resumo TO authenticated;
GRANT SELECT ON public.vw_formacao_margem_por_edicao TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_mv_formacao_cohorts_lotacao()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_formacao_cohorts_lotacao;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_formacao_inadimplencia_resumo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_formacao_inadimplencia_resumo;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_formacao_margem_por_edicao()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_formacao_margem_por_edicao;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_formacao_cohorts_lotacao',
  '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_formacao_cohorts_lotacao$$
);

SELECT cron.schedule(
  'refresh_mv_formacao_inadimplencia_resumo',
  '*/2 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_formacao_inadimplencia_resumo$$
);

SELECT cron.schedule(
  'refresh_mv_formacao_margem_por_edicao',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_formacao_margem_por_edicao$$
);
