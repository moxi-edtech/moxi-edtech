-- Migration: Add curso_id to formacao_cohorts and metrics helper
-- Date: 02/05/2026

BEGIN;

-- 1. Add curso_id to formacao_cohorts
ALTER TABLE public.formacao_cohorts ADD COLUMN IF NOT EXISTS curso_id uuid REFERENCES public.formacao_cursos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_formacao_cohorts_curso_id ON public.formacao_cohorts(curso_id);

-- 2. Backfill curso_id from formacao_cohort_modulos
UPDATE public.formacao_cohorts c
SET curso_id = (SELECT m.curso_id FROM public.formacao_cohort_modulos m WHERE m.cohort_id = c.id LIMIT 1)
WHERE curso_id IS NULL;

-- 3. Create view for course metrics (cockpit helper)
CREATE OR REPLACE VIEW public.vw_formacao_curso_cockpit_metrics AS
SELECT 
    c.id as curso_id,
    c.escola_id,
    COUNT(DISTINCT l.id) as total_leads,
    COUNT(DISTINCT co.id) as total_turmas,
    COALESCE(AVG(CASE WHEN co.vagas > 0 THEN (SELECT COUNT(*) FROM public.formacao_inscricoes i WHERE i.cohort_id = co.id AND i.estado IN ('pre_inscrito', 'inscrito'))::float / co.vagas ELSE 0 END), 0) as ocupacao_media,
    COALESCE(SUM((SELECT SUM(val.valor_referencia) FROM public.formacao_cohort_financeiro val WHERE val.cohort_id = co.id)), 0) as receita_estimada
FROM 
    public.formacao_cursos c
LEFT JOIN public.formacao_leads l ON l.curso_id = c.id
LEFT JOIN public.formacao_cohorts co ON co.curso_id = c.id
GROUP BY 
    c.id, c.escola_id;

COMMIT;
