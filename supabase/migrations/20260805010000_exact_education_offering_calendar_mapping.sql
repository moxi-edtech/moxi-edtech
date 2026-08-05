BEGIN;

ALTER TABLE public.school_education_offerings
  ADD COLUMN IF NOT EXISTS classification_source text,
  ADD COLUMN IF NOT EXISTS classification_reason text;

-- Reclassifica as ofertas existentes com base nos nomes reais dos cursos.
-- A regra é deliberadamente conservadora: técnico nunca cai em PRIMARY;
-- cursos científicos/económicos e ciclos do secundário ficam em REGULAR_ADULTOS/SECONDARY.
UPDATE public.school_education_offerings o
SET
  education_subsystem = CASE
    WHEN lower(c.nome) LIKE '%pré%' OR lower(c.nome) LIKE '%pre-%' THEN 'PRE_ESCOLAR'
    WHEN lower(c.nome) LIKE '%técnic%' OR lower(c.nome) LIKE '%tecnic%' THEN 'TECNICO_PROFISSIONAL'
    ELSE 'REGULAR_ADULTOS'
  END,
  education_level = CASE
    WHEN lower(c.nome) LIKE '%pré%' OR lower(c.nome) LIKE '%pre-%' THEN 'PRE_SCHOOL'
    WHEN lower(c.nome) LIKE '%primári%' OR lower(c.nome) LIKE '%primari%' THEN 'PRIMARY'
    WHEN lower(c.nome) LIKE '%secund%' OR lower(c.nome) LIKE '%ciclo%'
      OR lower(c.nome) LIKE '%ciên%' OR lower(c.nome) LIKE '%cien%'
      OR lower(c.nome) LIKE '%económ%' OR lower(c.nome) LIKE '%econom%' THEN 'SECONDARY'
    WHEN lower(c.tipo) IN ('tecnico', 'técnico') THEN 'SECONDARY'
    ELSE o.education_level
  END,
  classification_source = 'course_name_v2',
  classification_reason = CASE
    WHEN lower(c.nome) LIKE '%pré%' OR lower(c.nome) LIKE '%pre-%' THEN 'Curso identificado como pré-escolar.'
    WHEN lower(c.nome) LIKE '%técnic%' OR lower(c.nome) LIKE '%tecnic%' OR lower(c.tipo) IN ('tecnico', 'técnico') THEN 'Curso identificado como técnico-profissional.'
    WHEN lower(c.nome) LIKE '%secund%' OR lower(c.nome) LIKE '%ciclo%' OR lower(c.nome) LIKE '%ciên%' OR lower(c.nome) LIKE '%cien%' OR lower(c.nome) LIKE '%económ%' OR lower(c.nome) LIKE '%econom%' THEN 'Curso identificado como ensino secundário regular.'
    WHEN lower(c.nome) LIKE '%primári%' OR lower(c.nome) LIKE '%primari%' THEN 'Curso identificado como ensino primário.'
    ELSE 'Classificação anterior preservada; revisão manual necessária.'
  END,
  updated_at = now()
FROM public.cursos c
WHERE c.id = o.course_id
  AND c.escola_id = o.escola_id;

UPDATE public.school_education_offerings o
SET calendar_profile_id = (
  SELECT ct.id
  FROM public.calendario_templates ct
  WHERE ct.is_oficial = true
    AND ct.estado = 'PUBLICADO'
    AND ct.ano_base = 2026
    AND ct.subsistema = o.education_subsystem
  ORDER BY ct.publicado_em DESC NULLS LAST, ct.updated_at DESC
  LIMIT 1
), updated_at = now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.school_education_offerings WHERE calendar_profile_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existem ofertas educativas sem template oficial 2026/2027 compatível.';
  END IF;
END;
$$;

ALTER TABLE public.school_education_offerings
  ALTER COLUMN calendar_profile_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_education_offering_calendar_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subsystem text;
BEGIN
  SELECT subsistema INTO v_subsystem
  FROM public.calendario_templates
  WHERE id = NEW.calendar_profile_id;

  IF v_subsystem IS NULL THEN
    RAISE EXCEPTION 'Template regulatório inexistente para a oferta educativa.';
  END IF;
  IF v_subsystem <> NEW.education_subsystem THEN
    RAISE EXCEPTION 'Template % incompatível com o subsistema %.', v_subsystem, NEW.education_subsystem;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_education_offering_calendar_profile
  ON public.school_education_offerings;
CREATE TRIGGER trg_validate_education_offering_calendar_profile
  BEFORE INSERT OR UPDATE OF education_subsystem, calendar_profile_id
  ON public.school_education_offerings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_education_offering_calendar_profile();

COMMENT ON COLUMN public.school_education_offerings.classification_source IS
  'Fonte da classificação da oferta educativa; course_name_v2 usa o curso real da escola.';
COMMENT ON COLUMN public.school_education_offerings.classification_reason IS
  'Justificação legível da classificação que determinou o template regulatório.';

COMMIT;
