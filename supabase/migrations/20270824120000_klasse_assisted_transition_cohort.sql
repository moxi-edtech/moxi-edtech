BEGIN;

-- 1. Normalizar as matrículas históricas de 2025 da Escola KLASSE sem notas/pautas completas
UPDATE public.matriculas m
SET status = 'pendente',
    ativo = false,
    motivo_fecho = 'Aguardando decisão académica individual — Virada assistida KLASSE 2025/2026',
    data_fecho = NULL,
    updated_at = now()
FROM public.escolas e
WHERE m.escola_id = e.id
  AND e.slug = 'escola-klasse'
  AND m.ano_letivo = 2025
  AND lower(coalesce(m.status, '')) = 'pendente';

-- 2. Criar a coorte de transição assistida para a Escola KLASSE
WITH klasse_cohort AS (
  INSERT INTO public.academic_transition_cohorts (
    escola_id, codigo, nome, ano_origem, ano_destino, expira_em, motivo
  )
  SELECT
    e.id,
    'KLASSE_2025_SEM_PAUTAS',
    'KLASSE 2025 — virada assistida sem pautas completas',
    2025,
    2026,
    DATE '2027-09-30',
    'Transição iniciada em 2025; decisões de progressão serão confirmadas individualmente no Balcão.'
  FROM public.escolas e
  WHERE e.slug = 'escola-klasse'
  ON CONFLICT (escola_id, codigo) DO UPDATE
    SET ativo = true, expira_em = EXCLUDED.expira_em, updated_at = now()
  RETURNING id, escola_id
)
INSERT INTO public.academic_transition_cohort_members (
  escola_id, cohort_id, aluno_id, matricula_origem_id, motivo_inclusao
)
SELECT
  c.escola_id,
  c.id,
  m.aluno_id,
  m.id,
  'Matrícula KLASSE 2025 incluída na virada assistida por ausência de pautas completas.'
FROM klasse_cohort c
JOIN public.matriculas m
  ON m.escola_id = c.escola_id
 AND m.ano_letivo = 2025
WHERE NOT (
  EXISTS (
    SELECT 1
    FROM public.historico_anos h
    WHERE h.escola_id = c.escola_id
      AND h.aluno_id = m.aluno_id
      AND h.ano_letivo = 2025
      AND nullif(btrim(coalesce(h.resultado_final, '')), '') IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.matriculas destino
    WHERE destino.escola_id = c.escola_id
      AND destino.aluno_id = m.aluno_id
      AND destino.ano_letivo = 2026
      AND lower(coalesce(destino.status, '')) IN ('ativo', 'ativa', 'active')
  )
)
ON CONFLICT (cohort_id, matricula_origem_id) DO NOTHING;

COMMIT;
