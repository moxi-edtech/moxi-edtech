BEGIN;

UPDATE public.school_education_offerings o
SET
  education_level = 'SECONDARY',
  classification_reason = 'Curso identificado como técnico-profissional; nível normalizado para ensino secundário.',
  updated_at = now()
FROM public.cursos c
WHERE c.id = o.course_id
  AND c.escola_id = o.escola_id
  AND (
    lower(c.nome) LIKE '%técnic%'
    OR lower(c.nome) LIKE '%tecnic%'
    OR lower(c.tipo) IN ('tecnico', 'técnico')
  )
  AND o.education_subsystem = 'TECNICO_PROFISSIONAL';

COMMIT;
