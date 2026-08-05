BEGIN;

ALTER TABLE public.school_education_offerings
  ADD COLUMN IF NOT EXISTS curriculum_preset_id text
    REFERENCES public.curriculum_presets(id) ON DELETE RESTRICT;

UPDATE public.school_education_offerings o
SET
  curriculum_preset_id = p.id,
  education_subsystem = CASE
    WHEN p.id = 'pre_escolar' THEN 'PRE_ESCOLAR'
    WHEN p.category::text LIKE 'TECNICO%' THEN 'TECNICO_PROFISSIONAL'
    ELSE 'REGULAR_ADULTOS'
  END,
  education_level = CASE
    WHEN p.id = 'pre_escolar' THEN 'PRE_SCHOOL'
    WHEN p.category::text = 'PRIMARIO' THEN 'PRIMARY'
    ELSE 'SECONDARY'
  END,
  classification_source = 'curriculum_preset',
  classification_reason = 'Correspondência exata por cursos.curriculum_key para curriculum_presets.id.',
  updated_at = now()
FROM public.cursos c
JOIN public.curriculum_presets p ON p.id = c.curriculum_key
WHERE c.id = o.course_id
  AND c.escola_id = o.escola_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.school_education_offerings o
    JOIN public.cursos c ON c.id = o.course_id AND c.escola_id = o.escola_id
    WHERE o.curriculum_preset_id IS NULL
       OR o.curriculum_preset_id IS DISTINCT FROM c.curriculum_key
  ) THEN
    RAISE EXCEPTION 'Existem ofertas K12 sem correspondência exata com curriculum_presets.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_k12_offering_curriculum_preset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_key text;
BEGIN
  IF NEW.course_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.curriculum_key INTO v_course_key
  FROM public.cursos c
  WHERE c.id = NEW.course_id
    AND c.escola_id = NEW.escola_id;

  IF v_course_key IS NULL OR NEW.curriculum_preset_id IS DISTINCT FROM v_course_key THEN
    RAISE EXCEPTION 'A oferta K12 exige correspondência exata entre curso e curriculum preset.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_k12_offering_curriculum_preset
  ON public.school_education_offerings;
CREATE TRIGGER trg_validate_k12_offering_curriculum_preset
  BEFORE INSERT OR UPDATE OF escola_id, course_id, curriculum_preset_id
  ON public.school_education_offerings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_k12_offering_curriculum_preset();

COMMENT ON COLUMN public.school_education_offerings.curriculum_preset_id IS
  'Preset K12 exato que classifica o curso e determina o perfil regulatório compatível.';

COMMIT;
