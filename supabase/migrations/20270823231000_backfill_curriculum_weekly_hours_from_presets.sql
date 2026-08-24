-- Reconstitui somente cargas ausentes a partir do preset curricular aplicável.
-- Cargas já configuradas pela escola (semanal ou legado) nunca são substituídas.
WITH resolved_defaults AS (
  SELECT
    cm.id,
    cm.carga_horaria,
    cm.carga_horaria_semanal,
    cm.preset_subject_id,
    COALESCE(
      NULLIF(cm.carga_horaria_semanal, 0),
      NULLIF(cm.carga_horaria, 0),
      NULLIF(ss.custom_weekly_hours, 0),
      NULLIF(cps.weekly_hours, 0),
      NULLIF(dc.carga_horaria_semana, 0)
    ) AS resolved_weekly_hours,
    cps.id AS resolved_preset_subject_id
  FROM public.curso_matriz cm
  INNER JOIN public.cursos c
    ON c.id = cm.curso_id
   AND c.escola_id = cm.escola_id
  INNER JOIN public.classes cl
    ON cl.id = cm.classe_id
   AND cl.escola_id = cm.escola_id
  INNER JOIN public.disciplinas_catalogo dc
    ON dc.id = cm.disciplina_id
   AND dc.escola_id = cm.escola_id
  LEFT JOIN public.curriculum_preset_subjects cps
    ON cps.preset_id = c.curriculum_key
   AND cps.grade_level = cl.nome
   AND cps.name = dc.nome
  LEFT JOIN public.school_subjects ss
    ON ss.escola_id = cm.escola_id
   AND ss.preset_subject_id = cps.id
  WHERE cm.ativo = true
    AND COALESCE(cm.carga_horaria_semanal, 0) <= 0
)
UPDATE public.curso_matriz cm
SET
  preset_subject_id = COALESCE(cm.preset_subject_id, resolved_defaults.resolved_preset_subject_id),
  carga_horaria_semanal = resolved_defaults.resolved_weekly_hours,
  carga_horaria = COALESCE(NULLIF(cm.carga_horaria, 0), resolved_defaults.resolved_weekly_hours)
FROM resolved_defaults
WHERE cm.id = resolved_defaults.id
  AND resolved_defaults.resolved_weekly_hours > 0;
