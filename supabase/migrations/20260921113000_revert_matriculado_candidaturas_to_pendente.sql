BEGIN;

-- Reclassificar candidaturas marcadas como "matriculado" mas sem matrícula ativa numerada
UPDATE public.candidaturas c
SET status = 'pendente'
WHERE status = 'matriculado'
  AND NOT EXISTS (
    SELECT 1
    FROM public.matriculas m
    WHERE m.aluno_id = c.aluno_id
      AND m.escola_id = c.escola_id
      AND (m.status ILIKE 'ativa' OR m.status ILIKE 'ativo')
      AND m.numero_matricula IS NOT NULL
      AND btrim(m.numero_matricula) <> ''
  );

COMMIT;
