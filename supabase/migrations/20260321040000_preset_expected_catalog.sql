CREATE TABLE IF NOT EXISTS public.curriculum_preset_subjects_expected (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_id text NOT NULL,
  name text NOT NULL,
  grade_level text NOT NULL,
  component public.discipline_component NOT NULL,
  weekly_hours int NOT NULL,
  subject_type text DEFAULT 'core',
  UNIQUE(preset_id, name, grade_level)
);

INSERT INTO public.curriculum_preset_subjects_expected (
  preset_id,
  name,
  grade_level,
  component,
  weekly_hours,
  subject_type
)
SELECT
  preset_id,
  name,
  grade_level,
  component,
  weekly_hours,
  subject_type
FROM public.curriculum_preset_subjects
ON CONFLICT (preset_id, name, grade_level) DO UPDATE SET
  component = EXCLUDED.component,
  weekly_hours = EXCLUDED.weekly_hours,
  subject_type = EXCLUDED.subject_type;

CREATE OR REPLACE FUNCTION public.validate_presets_global()
RETURNS TABLE (
  preset_id text,
  grade_level text,
  disciplina_nome text,
  status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  (
    SELECT
      e.preset_id,
      e.grade_level,
      e.name AS disciplina_nome,
      'missing_in_preset'::text AS status
    FROM public.curriculum_preset_subjects_expected e
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.curriculum_preset_subjects cps
      WHERE cps.preset_id = e.preset_id
        AND cps.grade_level = e.grade_level
        AND cps.name = e.name
    )
  )
  UNION ALL
  (
    SELECT
      cps.preset_id,
      cps.grade_level,
      cps.name AS disciplina_nome,
      'extra_in_preset'::text AS status
    FROM public.curriculum_preset_subjects cps
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.curriculum_preset_subjects_expected e
      WHERE e.preset_id = cps.preset_id
        AND e.grade_level = cps.grade_level
        AND e.name = cps.name
    )
  )
  ORDER BY preset_id, grade_level, disciplina_nome;
$$;

GRANT EXECUTE ON FUNCTION public.validate_presets_global() TO authenticated;
