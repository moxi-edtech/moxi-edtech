BEGIN;

DROP VIEW IF EXISTS public.vw_financeiro_propinas_mensal_escola;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_financeiro_propinas_mensal_escola;

CREATE MATERIALIZED VIEW internal.mv_financeiro_propinas_mensal_escola AS
WITH mensalidades_normalizadas AS (
  SELECT
    m.escola_id,
    CASE
      WHEN trim(coalesce(m.ano_letivo, '')) ~ '^\d{4}$' THEN trim(m.ano_letivo)::integer
      WHEN m.ano_referencia IS NOT NULL THEN m.ano_referencia
      ELSE EXTRACT(YEAR FROM m.data_vencimento)::integer
    END AS ano_letivo,
    date_trunc('month', m.data_vencimento)::date AS competencia_mes,
    EXTRACT(YEAR FROM m.data_vencimento)::integer AS ano,
    EXTRACT(MONTH FROM m.data_vencimento)::integer AS mes,
    coalesce(m.valor_previsto, 0)::numeric(14,2) AS valor_previsto,
    coalesce(m.valor_pago_total, 0)::numeric(14,2) AS valor_pago_total,
    m.data_vencimento,
    m.data_pagamento_efetiva
  FROM public.mensalidades m
),
agregado AS (
  SELECT
    mn.escola_id,
    mn.ano_letivo,
    mn.competencia_mes,
    mn.ano,
    mn.mes,
    COUNT(*)::integer AS qtd_mensalidades,
    COUNT(*) FILTER (
      WHERE mn.data_vencimento < CURRENT_DATE
        AND GREATEST(mn.valor_previsto - mn.valor_pago_total, 0) > 0
    )::integer AS qtd_em_atraso,
    COUNT(*) FILTER (
      WHERE mn.valor_pago_total >= mn.valor_previsto
        AND mn.valor_previsto > 0
        AND mn.data_pagamento_efetiva IS NOT NULL
        AND mn.data_pagamento_efetiva < mn.data_vencimento
    )::integer AS qtd_pagas_adiantadas,
    COUNT(*) FILTER (
      WHERE mn.valor_pago_total > 0
        AND mn.valor_pago_total < mn.valor_previsto
    )::integer AS qtd_parciais,
    SUM(mn.valor_previsto)::numeric(14,2) AS total_previsto,
    SUM(mn.valor_pago_total)::numeric(14,2) AS total_pago,
    SUM(
      CASE
        WHEN mn.valor_pago_total >= mn.valor_previsto
          AND mn.valor_previsto > 0
          AND mn.data_pagamento_efetiva IS NOT NULL
          AND mn.data_pagamento_efetiva < mn.data_vencimento
        THEN mn.valor_pago_total
        ELSE 0
      END
    )::numeric(14,2) AS total_pago_adiantado,
    SUM(
      CASE
        WHEN mn.valor_pago_total > 0
          AND mn.valor_pago_total < mn.valor_previsto
        THEN GREATEST(mn.valor_previsto - mn.valor_pago_total, 0)
        ELSE 0
      END
    )::numeric(14,2) AS total_parcial_em_aberto,
    SUM(
      CASE
        WHEN mn.data_vencimento < CURRENT_DATE
          AND GREATEST(mn.valor_previsto - mn.valor_pago_total, 0) > 0
        THEN GREATEST(mn.valor_previsto - mn.valor_pago_total, 0)
        ELSE 0
      END
    )::numeric(14,2) AS total_em_atraso
  FROM mensalidades_normalizadas mn
  GROUP BY mn.escola_id, mn.ano_letivo, mn.competencia_mes, mn.ano, mn.mes
)
SELECT
  a.escola_id,
  a.ano_letivo,
  a.ano,
  a.mes,
  a.competencia_mes,
  a.qtd_mensalidades,
  a.qtd_em_atraso,
  a.qtd_pagas_adiantadas,
  a.qtd_parciais,
  a.total_previsto,
  a.total_pago,
  a.total_pago_adiantado,
  a.total_parcial_em_aberto,
  a.total_em_atraso,
  CASE
    WHEN a.qtd_mensalidades > 0
    THEN ROUND((a.qtd_em_atraso::numeric / a.qtd_mensalidades::numeric) * 100, 2)
    ELSE 0
  END AS inadimplencia_pct
FROM agregado a
WITH NO DATA;

CREATE UNIQUE INDEX ux_mv_financeiro_propinas_mensal_escola
  ON internal.mv_financeiro_propinas_mensal_escola (escola_id, ano_letivo, ano, mes);

CREATE VIEW public.vw_financeiro_propinas_mensal_escola AS
SELECT
  escola_id,
  ano_letivo,
  ano,
  mes,
  competencia_mes,
  qtd_mensalidades,
  qtd_em_atraso,
  qtd_pagas_adiantadas,
  qtd_parciais,
  total_previsto,
  total_pago,
  total_pago_adiantado,
  total_parcial_em_aberto,
  total_em_atraso,
  inadimplencia_pct
FROM internal.mv_financeiro_propinas_mensal_escola
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

ALTER VIEW public.vw_financeiro_propinas_mensal_escola SET (security_invoker = true);

DROP VIEW IF EXISTS public.vw_financeiro_propinas_por_turma;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_financeiro_propinas_por_turma;

CREATE MATERIALIZED VIEW internal.mv_financeiro_propinas_por_turma AS
WITH mensalidades_normalizadas AS (
  SELECT
    m.escola_id,
    CASE
      WHEN trim(coalesce(m.ano_letivo, '')) ~ '^\d{4}$' THEN trim(m.ano_letivo)::integer
      WHEN m.ano_referencia IS NOT NULL THEN m.ano_referencia
      ELSE EXTRACT(YEAR FROM m.data_vencimento)::integer
    END AS ano_letivo,
    m.turma_id,
    coalesce(m.valor_previsto, 0)::numeric(14,2) AS valor_previsto,
    coalesce(m.valor_pago_total, 0)::numeric(14,2) AS valor_pago_total,
    m.data_vencimento,
    m.data_pagamento_efetiva
  FROM public.mensalidades m
  WHERE m.turma_id IS NOT NULL
),
agregado AS (
  SELECT
    mn.escola_id,
    mn.ano_letivo,
    mn.turma_id,
    COUNT(*)::integer AS qtd_mensalidades,
    COUNT(*) FILTER (
      WHERE mn.data_vencimento < CURRENT_DATE
        AND GREATEST(mn.valor_previsto - mn.valor_pago_total, 0) > 0
    )::integer AS qtd_em_atraso,
    COUNT(*) FILTER (
      WHERE mn.valor_pago_total >= mn.valor_previsto
        AND mn.valor_previsto > 0
        AND mn.data_pagamento_efetiva IS NOT NULL
        AND mn.data_pagamento_efetiva < mn.data_vencimento
    )::integer AS qtd_pagas_adiantadas,
    COUNT(*) FILTER (
      WHERE mn.valor_pago_total > 0
        AND mn.valor_pago_total < mn.valor_previsto
    )::integer AS qtd_parciais,
    SUM(mn.valor_previsto)::numeric(14,2) AS total_previsto,
    SUM(mn.valor_pago_total)::numeric(14,2) AS total_pago,
    SUM(
      CASE
        WHEN mn.valor_pago_total >= mn.valor_previsto
          AND mn.valor_previsto > 0
          AND mn.data_pagamento_efetiva IS NOT NULL
          AND mn.data_pagamento_efetiva < mn.data_vencimento
        THEN mn.valor_pago_total
        ELSE 0
      END
    )::numeric(14,2) AS total_pago_adiantado,
    SUM(
      CASE
        WHEN mn.valor_pago_total > 0
          AND mn.valor_pago_total < mn.valor_previsto
        THEN GREATEST(mn.valor_previsto - mn.valor_pago_total, 0)
        ELSE 0
      END
    )::numeric(14,2) AS total_parcial_em_aberto,
    SUM(
      CASE
        WHEN mn.data_vencimento < CURRENT_DATE
          AND GREATEST(mn.valor_previsto - mn.valor_pago_total, 0) > 0
        THEN GREATEST(mn.valor_previsto - mn.valor_pago_total, 0)
        ELSE 0
      END
    )::numeric(14,2) AS total_em_atraso
  FROM mensalidades_normalizadas mn
  GROUP BY mn.escola_id, mn.ano_letivo, mn.turma_id
)
SELECT
  a.escola_id,
  a.ano_letivo,
  t.id AS turma_id,
  t.nome AS turma_nome,
  c.nome AS classe_label,
  t.turno,
  a.qtd_mensalidades,
  a.qtd_em_atraso,
  a.qtd_pagas_adiantadas,
  a.qtd_parciais,
  a.total_previsto,
  a.total_pago,
  a.total_pago_adiantado,
  a.total_parcial_em_aberto,
  a.total_em_atraso,
  CASE
    WHEN a.qtd_mensalidades > 0
    THEN ROUND((a.qtd_em_atraso::numeric / a.qtd_mensalidades::numeric) * 100, 2)
    ELSE 0
  END AS inadimplencia_pct
FROM agregado a
JOIN public.turmas t ON t.id = a.turma_id
LEFT JOIN public.classes c ON c.id = t.classe_id
WITH NO DATA;

CREATE UNIQUE INDEX ux_mv_financeiro_propinas_por_turma
  ON internal.mv_financeiro_propinas_por_turma (escola_id, ano_letivo, turma_id);

CREATE VIEW public.vw_financeiro_propinas_por_turma AS
SELECT
  escola_id,
  ano_letivo,
  turma_id,
  turma_nome,
  classe_label,
  turno,
  qtd_mensalidades,
  qtd_em_atraso,
  qtd_pagas_adiantadas,
  qtd_parciais,
  total_previsto,
  total_pago,
  total_pago_adiantado,
  total_parcial_em_aberto,
  total_em_atraso,
  inadimplencia_pct
FROM internal.mv_financeiro_propinas_por_turma
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

ALTER VIEW public.vw_financeiro_propinas_por_turma SET (security_invoker = true);

COMMIT;
