ALTER TABLE public.curso_matriz
  ADD COLUMN IF NOT EXISTS preset_subject_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'fk_curso_matriz_preset_subject'
  ) THEN
    ALTER TABLE public.curso_matriz
      ADD CONSTRAINT fk_curso_matriz_preset_subject
      FOREIGN KEY (preset_subject_id)
      REFERENCES public.curriculum_preset_subjects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.curso_matriz AS cm
SET preset_subject_id = cps.id,
    carga_horaria_semanal = CASE
      WHEN cm.carga_horaria_semanal IS NULL OR cm.carga_horaria_semanal <= 0
        THEN cps.weekly_hours
      ELSE cm.carga_horaria_semanal
    END
FROM public.cursos AS c,
     public.classes AS cl,
     public.disciplinas_catalogo AS dc,
     public.curriculum_preset_subjects AS cps
WHERE cm.curso_id = c.id
  AND cl.id = cm.classe_id
  AND dc.id = cm.disciplina_id
  AND cps.preset_id = c.curriculum_key
  AND cps.grade_level = cl.nome
  AND cps.name = dc.nome
  AND cm.preset_subject_id IS NULL;
