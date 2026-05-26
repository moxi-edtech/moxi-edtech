BEGIN;

CREATE SCHEMA IF NOT EXISTS internal;

DROP VIEW IF EXISTS public.vw_relatorio_financeiro_escolar_fluxo_mensal;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_relatorio_financeiro_escolar_fluxo_mensal;

CREATE MATERIALIZED VIEW internal.mv_relatorio_financeiro_escolar_fluxo_mensal AS
WITH anos AS (
  SELECT
    al.escola_id,
    al.id AS ano_letivo_id,
    al.ano AS ano_letivo,
    al.data_inicio,
    al.data_fim,
    date_trunc('month', al.data_inicio::timestamp)::date AS inicio_mes,
    date_trunc('month', al.data_fim::timestamp)::date AS fim_mes
  FROM public.anos_letivos al
  WHERE al.data_inicio IS NOT NULL
    AND al.data_fim IS NOT NULL
),
meses AS (
  SELECT
    a.escola_id,
    a.ano_letivo_id,
    a.ano_letivo,
    a.data_inicio,
    a.data_fim,
    gs::date AS mes_ref
  FROM anos a
  CROSS JOIN LATERAL generate_series(a.inicio_mes, a.fim_mes, interval '1 month') AS gs
),
movimentos_mes AS (
  SELECT
    fl.escola_id,
    date_trunc('month', fl.data_movimento)::date AS mes_ref,
    COALESCE(SUM(fl.valor) FILTER (WHERE fl.tipo = 'credito'), 0)::numeric(14,2) AS entradas_total,
    COALESCE(SUM(fl.valor) FILTER (WHERE fl.tipo = 'debito'), 0)::numeric(14,2) AS saidas_total,
    COALESCE(SUM(
      CASE
        WHEN fl.tipo = 'credito' THEN fl.valor
        WHEN fl.tipo = 'debito' THEN -fl.valor
        ELSE 0
      END
    ), 0)::numeric(14,2) AS saldo_delta
  FROM public.financeiro_ledger fl
  GROUP BY fl.escola_id, date_trunc('month', fl.data_movimento)::date
),
saldo_base AS (
  SELECT
    a.escola_id,
    a.ano_letivo_id,
    COALESCE(SUM(
      CASE
        WHEN fl.tipo = 'credito' THEN fl.valor
        WHEN fl.tipo = 'debito' THEN -fl.valor
        ELSE 0
      END
    ), 0)::numeric(14,2) AS saldo_base
  FROM anos a
  LEFT JOIN public.financeiro_ledger fl
    ON fl.escola_id = a.escola_id
   AND fl.data_movimento < a.inicio_mes::timestamp
  GROUP BY a.escola_id, a.ano_letivo_id
),
base AS (
  SELECT
    m.escola_id,
    m.ano_letivo_id,
    m.ano_letivo,
    m.data_inicio,
    m.data_fim,
    m.mes_ref,
    COALESCE(mm.entradas_total, 0)::numeric(14,2) AS entradas_total,
    COALESCE(mm.saidas_total, 0)::numeric(14,2) AS saidas_total,
    COALESCE(mm.saldo_delta, 0)::numeric(14,2) AS saldo_delta,
    COALESCE(sb.saldo_base, 0)::numeric(14,2) AS saldo_base
  FROM meses m
  LEFT JOIN movimentos_mes mm
    ON mm.escola_id = m.escola_id
   AND mm.mes_ref = m.mes_ref
  LEFT JOIN saldo_base sb
    ON sb.escola_id = m.escola_id
   AND sb.ano_letivo_id = m.ano_letivo_id
)
SELECT
  b.escola_id,
  b.ano_letivo_id,
  b.ano_letivo,
  b.mes_ref,
  (
    b.saldo_base +
    COALESCE(
      SUM(b.saldo_delta) OVER (
        PARTITION BY b.escola_id, b.ano_letivo_id
        ORDER BY b.mes_ref
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    )
  )::numeric(14,2) AS saldo_anterior,
  b.entradas_total,
  b.saidas_total,
  (b.entradas_total - b.saidas_total)::numeric(14,2) AS diferenca,
  (
    b.saldo_base +
    COALESCE(
      SUM(b.saldo_delta) OVER (
        PARTITION BY b.escola_id, b.ano_letivo_id
        ORDER BY b.mes_ref
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ),
      0
    )
  )::numeric(14,2) AS saldo_final
FROM base b
WITH NO DATA;

CREATE UNIQUE INDEX ux_mv_relatorio_financeiro_escolar_fluxo_mensal
  ON internal.mv_relatorio_financeiro_escolar_fluxo_mensal (escola_id, ano_letivo_id, mes_ref);

CREATE OR REPLACE VIEW public.vw_relatorio_financeiro_escolar_fluxo_mensal
WITH (security_invoker = true) AS
SELECT
  escola_id,
  ano_letivo_id,
  ano_letivo,
  mes_ref,
  saldo_anterior,
  entradas_total,
  saidas_total,
  diferenca,
  saldo_final
FROM internal.mv_relatorio_financeiro_escolar_fluxo_mensal
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

DROP VIEW IF EXISTS public.vw_relatorio_financeiro_escolar_inadimplencia_classe;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_relatorio_financeiro_escolar_inadimplencia_classe;

CREATE MATERIALIZED VIEW internal.mv_relatorio_financeiro_escolar_inadimplencia_classe AS
WITH base AS (
  SELECT
    m.escola_id,
    t.ano_letivo_id,
    al.ano AS ano_letivo,
    date_trunc('month', m.data_vencimento::timestamp)::date AS mes_ref,
    c.id AS classe_id,
    c.nome AS classe_label,
    COALESCE(m.valor_previsto, m.valor, 0)::numeric(14,2) AS valor_previsto,
    COALESCE(m.valor_pago_total, 0)::numeric(14,2) AS valor_pago_total,
    GREATEST(COALESCE(m.valor_previsto, m.valor, 0) - COALESCE(m.valor_pago_total, 0), 0)::numeric(14,2) AS saldo_em_aberto,
    m.data_vencimento
  FROM public.mensalidades m
  JOIN public.turmas t
    ON t.id = m.turma_id
   AND t.escola_id = m.escola_id
  JOIN public.anos_letivos al
    ON al.id = t.ano_letivo_id
   AND al.escola_id = t.escola_id
  LEFT JOIN public.classes c
    ON c.id = t.classe_id
   AND c.escola_id = t.escola_id
  WHERE m.turma_id IS NOT NULL
    AND m.data_vencimento IS NOT NULL
)
SELECT
  b.escola_id,
  b.ano_letivo_id,
  b.ano_letivo,
  b.mes_ref,
  b.classe_id,
  COALESCE(b.classe_label, 'Sem Classe') AS classe_label,
  COUNT(*) FILTER (
    WHERE b.data_vencimento < CURRENT_DATE
      AND b.saldo_em_aberto > 0
  )::integer AS qtd_em_atraso,
  ROUND(
    COALESCE(AVG(b.valor_previsto) FILTER (
      WHERE b.data_vencimento < CURRENT_DATE
        AND b.saldo_em_aberto > 0
    ), 0)::numeric,
    2
  )::numeric(14,2) AS valor_unitario_medio,
  COALESCE(SUM(b.saldo_em_aberto) FILTER (
    WHERE b.data_vencimento < CURRENT_DATE
      AND b.saldo_em_aberto > 0
  ), 0)::numeric(14,2) AS total_em_atraso,
  COUNT(*) FILTER (
    WHERE b.valor_pago_total > 0
      AND b.valor_pago_total < b.valor_previsto
  )::integer AS qtd_parciais,
  COALESCE(SUM(b.saldo_em_aberto) FILTER (
    WHERE b.valor_pago_total > 0
      AND b.valor_pago_total < b.valor_previsto
  ), 0)::numeric(14,2) AS total_parcial_em_aberto
FROM base b
GROUP BY b.escola_id, b.ano_letivo_id, b.ano_letivo, b.mes_ref, b.classe_id, COALESCE(b.classe_label, 'Sem Classe')
WITH NO DATA;

CREATE UNIQUE INDEX ux_mv_relatorio_financeiro_escolar_inadimplencia_classe
  ON internal.mv_relatorio_financeiro_escolar_inadimplencia_classe (escola_id, ano_letivo_id, mes_ref, classe_id);

CREATE OR REPLACE VIEW public.vw_relatorio_financeiro_escolar_inadimplencia_classe
WITH (security_invoker = true) AS
SELECT
  escola_id,
  ano_letivo_id,
  ano_letivo,
  mes_ref,
  classe_id,
  classe_label,
  qtd_em_atraso,
  valor_unitario_medio,
  total_em_atraso,
  qtd_parciais,
  total_parcial_em_aberto
FROM internal.mv_relatorio_financeiro_escolar_inadimplencia_classe
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.refresh_mv_relatorio_financeiro_escolar_fluxo_mensal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_relatorio_financeiro_escolar_fluxo_mensal;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_relatorio_financeiro_escolar_inadimplencia_classe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_relatorio_financeiro_escolar_inadimplencia_classe;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_relatorio_financeiro_escolar_fluxo_mensal',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_relatorio_financeiro_escolar_fluxo_mensal$$
);

SELECT cron.schedule(
  'refresh_mv_relatorio_financeiro_escolar_inadimplencia_classe',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_relatorio_financeiro_escolar_inadimplencia_classe$$
);

GRANT ALL ON TABLE internal.mv_relatorio_financeiro_escolar_fluxo_mensal TO anon, authenticated, service_role;
GRANT ALL ON TABLE internal.mv_relatorio_financeiro_escolar_inadimplencia_classe TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.vw_relatorio_financeiro_escolar_fluxo_mensal TO authenticated, service_role;
GRANT ALL ON TABLE public.vw_relatorio_financeiro_escolar_inadimplencia_classe TO authenticated, service_role;

COMMIT;
