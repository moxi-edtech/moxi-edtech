-- ======================================================================
--  FINANCEIRO — RELATÓRIO DE PROPINA GLOBAL
--  - Visão mensal por escola (para gráficos)
--  - Visão por turma/classe (ranking e tabela)
--  - Base: public.mensalidades + matriculas + turmas
-- ======================================================================

-- Limpando versões antigas, se existirem
DROP VIEW IF EXISTS public.vw_financeiro_propinas_por_turma;
DROP VIEW IF EXISTS public.vw_financeiro_propinas_mensal_escola;

-- ----------------------------------------------------------------------
-- 1) Visão mensal de propinas por escola
-- ----------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_financeiro_propinas_mensal_escola
WITH (security_invoker = true) AS
SELECT
  m.escola_id,
  m.ano_letivo,
  date_trunc('month', m.data_vencimento)::date AS competencia_mes,
  EXTRACT(YEAR  FROM m.data_vencimento)::int   AS ano,
  EXTRACT(MONTH FROM m.data_vencimento)::int   AS mes,

  -- quantidades
  COUNT(*)::int AS qtd_mensalidades,
  COUNT(*) FILTER (
    WHERE 
      m.data_vencimento < CURRENT_DATE
      AND m.status IN ('pendente','pago_parcial')
  )::int AS qtd_em_atraso,

  -- valores
  SUM(COALESCE(m.valor_previsto, 0))::numeric(14,2)                  AS total_previsto,
  SUM(COALESCE(m.valor_pago_total, 0))::numeric(14,2)                AS total_pago,
  SUM(
    CASE 
      WHEN m.data_vencimento < CURRENT_DATE
       AND m.status IN ('pendente','pago_parcial')
      THEN GREATEST(0, COALESCE(m.valor_previsto,0) - COALESCE(m.valor_pago_total,0))
      ELSE 0
    END
  )::numeric(14,2) AS total_em_atraso,

  -- % inadimplência (por quantidade de títulos)
  CASE 
    WHEN COUNT(*) > 0 THEN
      ROUND(
        COUNT(*) FILTER (
          WHERE 
            m.data_vencimento < CURRENT_DATE
            AND m.status IN ('pendente','pago_parcial')
        )::numeric
        / COUNT(*)::numeric * 100,
        2
      )
    ELSE 0
  END AS inadimplencia_pct
FROM public.mensalidades m
WHERE m.escola_id = public.current_tenant_escola_id()
GROUP BY
  m.escola_id,
  m.ano_letivo,
  date_trunc('month', m.data_vencimento),
  EXTRACT(YEAR  FROM m.data_vencimento),
  EXTRACT(MONTH FROM m.data_vencimento);

COMMENT ON VIEW public.vw_financeiro_propinas_mensal_escola IS
  'Resumo mensal de propinas por escola/ano letivo: total previsto, pago, em atraso, quantidades e % de inadimplência. Usa escopo current_tenant_escola_id().';

-- ----------------------------------------------------------------------
-- 2) Visão por turma/classe (ranking de inadimplência)
-- ----------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_financeiro_propinas_por_turma
WITH (security_invoker = true) AS
SELECT
  m.escola_id,
  m.ano_letivo,
  t.id                        AS turma_id,
  COALESCE(t.nome, t.codigo)  AS turma_nome,
  t.classe                    AS classe_label,
  t.turno                     AS turno,
  
  -- agregação por turma
  COUNT(*)::int AS qtd_mensalidades,
  COUNT(*) FILTER (
    WHERE 
      m.data_vencimento < CURRENT_DATE
      AND m.status IN ('pendente','pago_parcial')
  )::int AS qtd_em_atraso,

  SUM(COALESCE(m.valor_previsto, 0))::numeric(14,2)                  AS total_previsto,
  SUM(COALESCE(m.valor_pago_total, 0))::numeric(14,2)                AS total_pago,
  SUM(
    CASE 
      WHEN m.data_vencimento < CURRENT_DATE
       AND m.status IN ('pendente','pago_parcial')
      THEN GREATEST(0, COALESCE(m.valor_previsto,0) - COALESCE(m.valor_pago_total,0))
      ELSE 0
    END
  )::numeric(14,2) AS total_em_atraso,

  CASE 
    WHEN COUNT(*) > 0 THEN
      ROUND(
        COUNT(*) FILTER (
          WHERE 
            m.data_vencimento < CURRENT_DATE
            AND m.status IN ('pendente','pago_parcial')
        )::numeric
        / COUNT(*)::numeric * 100,
        2
      )
    ELSE 0
  END AS inadimplencia_pct
FROM public.mensalidades m
JOIN public.matriculas mat
  ON mat.id = m.matricula_id
 AND (mat.status IN ('ativo','ativa') OR mat.ativo = true)
LEFT JOIN public.turmas t
  ON t.id = mat.turma_id
WHERE m.escola_id = public.current_tenant_escola_id()
GROUP BY
  m.escola_id,
  m.ano_letivo,
  t.id,
  COALESCE(t.nome, t.codigo),
  t.classe,
  t.turno;

COMMENT ON VIEW public.vw_financeiro_propinas_por_turma IS
  'Resumo de propinas por turma/ano letivo: total previsto, pago, em atraso, quantidades e % inadimplência. Usa escopo current_tenant_escola_id().';
