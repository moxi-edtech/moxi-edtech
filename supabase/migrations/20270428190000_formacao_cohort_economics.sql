-- Migration: Relatórios executivos com cohort economics (NH-5)
-- Data: 2026-04-28

BEGIN;

-- 1. Adicionar campo de custo de marketing se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'formacao_cohort_financeiro' AND COLUMN_NAME = 'custo_marketing') THEN
    ALTER TABLE public.formacao_cohort_financeiro ADD COLUMN custo_marketing numeric(14,2) NOT NULL DEFAULT 0 CHECK (custo_marketing >= 0);
  END IF;
END $$;

-- 2. View para métricas de conversão (tempo médio)
CREATE OR REPLACE VIEW public.vw_formacao_conversion_stats AS
WITH conversao AS (
    SELECT 
        s.escola_id,
        s.cohort_id,
        s.created_at as data_inscricao,
        MIN(i.created_at) as data_pagamento,
        (EXTRACT(EPOCH FROM (MIN(i.created_at) - s.created_at)) / 3600)::numeric(10,2) as horas_para_conversao
    FROM public.formacao_inscricoes_staging s
    JOIN public.formacao_faturas_lote_itens i ON i.escola_id = s.escola_id 
        AND i.formando_user_id IN (
            SELECT user_id FROM public.profiles WHERE email = s.email OR bi_numero = s.bi_passaporte
        )
    WHERE s.status = 'APROVADA' AND i.status_pagamento = 'pago'
    GROUP BY s.escola_id, s.cohort_id, s.id, s.created_at
)
SELECT 
    escola_id,
    cohort_id,
    COUNT(*)::int as total_conversoes,
    AVG(horas_para_conversao)::numeric(10,2) as avg_horas_conversao
FROM conversao
GROUP BY escola_id, cohort_id;

-- 3. View consolidada de Cohort Economics
CREATE OR REPLACE VIEW public.vw_formacao_cohort_economics AS
SELECT 
    c.escola_id,
    c.id as cohort_id,
    c.nome as cohort_nome,
    c.curso_nome,
    m.receita_total,
    m.custo_honorarios,
    m.margem_bruta,
    cf.custo_marketing,
    (m.margem_bruta - cf.custo_marketing)::numeric(14,2) as margem_liquida,
    l.inscritos_total,
    l.inscritos_pagos,
    CASE 
        WHEN l.inscritos_pagos > 0 THEN (cf.custo_marketing / l.inscritos_pagos)::numeric(14,2)
        ELSE 0 
    END as cac,
    CASE 
        WHEN l.inscritos_pagos > 0 THEN (m.receita_total / l.inscritos_pagos)::numeric(14,2)
        ELSE 0 
    END as ltv_medio,
    CASE 
        WHEN cf.custo_marketing > 0 THEN ROUND(((m.margem_bruta - cf.custo_marketing) / cf.custo_marketing) * 100, 2)
        ELSE NULL 
    END as roi_percentual,
    COALESCE(cs.avg_horas_conversao, 0) as avg_horas_conversao
FROM public.formacao_cohorts c
JOIN internal.mv_formacao_margem_por_edicao m ON m.escola_id = c.escola_id AND m.cohort_id = c.id
JOIN internal.mv_formacao_cohorts_lotacao l ON l.escola_id = c.escola_id AND l.cohort_id = c.id
LEFT JOIN public.formacao_cohort_financeiro cf ON cf.escola_id = c.escola_id AND cf.cohort_id = c.id
LEFT JOIN public.vw_formacao_conversion_stats cs ON cs.escola_id = c.escola_id AND cs.cohort_id = c.id
WHERE c.escola_id = public.current_tenant_escola_id();

-- 4. View de agregação por Curso
CREATE OR REPLACE VIEW public.vw_formacao_course_economics AS
SELECT 
    escola_id,
    curso_nome,
    COUNT(cohort_id) as total_cohorts,
    SUM(receita_total)::numeric(14,2) as receita_total,
    SUM(custo_honorarios)::numeric(14,2) as custo_honorarios,
    SUM(custo_marketing)::numeric(14,2) as custo_marketing,
    SUM(margem_liquida)::numeric(14,2) as margem_liquida,
    AVG(roi_percentual)::numeric(10,2) as avg_roi_percentual,
    AVG(avg_horas_conversao)::numeric(10,2) as avg_horas_conversao
FROM public.vw_formacao_cohort_economics
GROUP BY escola_id, curso_nome;

GRANT SELECT ON public.vw_formacao_conversion_stats TO authenticated;
GRANT SELECT ON public.vw_formacao_cohort_economics TO authenticated;
GRANT SELECT ON public.vw_formacao_course_economics TO authenticated;

COMMIT;
