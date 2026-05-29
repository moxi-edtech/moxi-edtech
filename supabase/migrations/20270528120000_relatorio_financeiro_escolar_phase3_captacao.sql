-- Migração para criação da MV de Captação Mensal
-- Parte da Fase 3 do Plano Técnico de Evolução do Relatório Financeiro

BEGIN;

CREATE SCHEMA IF NOT EXISTS internal;

DROP VIEW IF EXISTS public.vw_relatorio_financeiro_escolar_capitacao_mensal;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_relatorio_financeiro_escolar_capitacao_mensal;

CREATE MATERIALIZED VIEW internal.mv_relatorio_financeiro_escolar_capitacao_mensal AS
WITH base_matriculas AS (
  SELECT
    m.escola_id,
    m.ano_letivo,
    m.id AS matricula_id,
    COALESCE(m.data_matricula, m.created_at::date) AS data_ref,
    m.origem_transicao_matricula_id,
    m.percentagem_desconto,
    m.motivo_desconto,
    COALESCE(t.classe_id, '00000000-0000-0000-0000-000000000000'::uuid) AS classe_id,
    COALESCE(c.nome, 'Sem Classe') AS classe_label
  FROM public.matriculas m
  LEFT JOIN public.turmas t ON m.turma_id = t.id
  LEFT JOIN public.classes c ON t.classe_id = c.id
)
SELECT
  escola_id,
  ano_letivo,
  date_trunc('month', data_ref)::date AS mes_ref,
  classe_id,
  classe_label,
  COUNT(*) FILTER (WHERE origem_transicao_matricula_id IS NULL)::integer AS matriculas_qtd,
  COUNT(*) FILTER (WHERE origem_transicao_matricula_id IS NOT NULL)::integer AS confirmacoes_qtd,
  COUNT(*) FILTER (WHERE (percentagem_desconto > 0 OR (motivo_desconto IS NOT NULL AND motivo_desconto <> '')))::integer AS bolsistas_qtd,
  COUNT(*)::integer AS total_qtd
FROM base_matriculas
GROUP BY 1, 2, 3, 4, 5;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_relatorio_capitacao_unique 
ON internal.mv_relatorio_financeiro_escolar_capitacao_mensal (escola_id, ano_letivo, mes_ref, classe_id);

-- View pública para exposição via Supabase
CREATE OR REPLACE VIEW public.vw_relatorio_financeiro_escolar_capitacao_mensal AS
SELECT * FROM internal.mv_relatorio_financeiro_escolar_capitacao_mensal;

-- Permissões
GRANT SELECT ON TABLE public.vw_relatorio_financeiro_escolar_capitacao_mensal TO authenticated, service_role;

COMMIT;
