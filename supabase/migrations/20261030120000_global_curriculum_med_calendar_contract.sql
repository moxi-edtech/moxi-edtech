-- Global KLASSE curriculum -> MED subsystem contract.
-- School-specific offerings inherit this mapping when a course preset is installed.
-- No calendar records, grades, terms or preexisting course mappings are changed.
BEGIN;

CREATE TABLE public.curriculum_preset_calendar_contract (
  preset_id text PRIMARY KEY REFERENCES public.curriculum_presets(id) ON DELETE RESTRICT,
  education_subsystem text NOT NULL CHECK (education_subsystem IN
    ('PRE_ESCOLAR','REGULAR_ADULTOS','SECUNDARIO_PEDAGOGICO','TECNICO_PROFISSIONAL')),
  education_level text NOT NULL CHECK (education_level IN ('PRE_SCHOOL','PRIMARY','SECONDARY')),
  mapping_origin text NOT NULL DEFAULT 'KLASSE_GLOBAL_CATALOG',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.curriculum_preset_calendar_contract ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.curriculum_preset_calendar_contract FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.curriculum_preset_calendar_contract TO service_role;

-- This is a catalog-wide classification, independent of school IDs.
-- The pedagogical template exists but no current KLASSE curriculum preset
-- explicitly classifies itself as pedagogical. Do NOT infer that from names.
INSERT INTO public.curriculum_preset_calendar_contract
  (preset_id,education_subsystem,education_level)
SELECT p.id,
  CASE
    WHEN p.id='pre_escolar' THEN 'PRE_ESCOLAR'
    WHEN p.category::text LIKE 'TECNICO%' THEN 'TECNICO_PROFISSIONAL'
    ELSE 'REGULAR_ADULTOS'
  END,
  CASE
    WHEN p.id='pre_escolar' THEN 'PRE_SCHOOL'
    WHEN p.category::text='PRIMARIO' THEN 'PRIMARY'
    ELSE 'SECONDARY'
  END
FROM public.curriculum_presets p;

DO $catalog$
DECLARE v_missing int;
BEGIN
  SELECT count(*) INTO v_missing FROM public.curriculum_presets p
  LEFT JOIN public.curriculum_preset_calendar_contract map ON map.preset_id=p.id
  WHERE map.preset_id IS NULL;
  IF v_missing>0 THEN
    RAISE EXCEPTION 'KLASSE_GLOBAL_CALENDAR_CATALOG_INCOMPLETE: % curriculum presets without MED mapping',v_missing;
  END IF;
END;
$catalog$;

CREATE OR REPLACE FUNCTION public.ensure_k12_course_offering(
  p_escola_id uuid,p_course_id uuid,p_curriculum_preset_id text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog,public,pg_temp
AS $ensure$
DECLARE
  v_subsystem text;
  v_level text;
  v_year integer;
  v_profile uuid;
  v_matches integer;
  v_offering uuid;
  v_existing integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_has_role_in_school(
      p_escola_id,
      ARRAY['admin_escola','secretaria','admin','staff_admin','admin_financeiro']
    ) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada para esta escola.' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cursos c
     WHERE c.id=p_course_id AND c.escola_id=p_escola_id
       AND c.curriculum_key=p_curriculum_preset_id
  ) THEN
    RAISE EXCEPTION 'CURRICULUM_PRESET_MISMATCH: O curso não pertence ao preset ou à escola.';
  END IF;

  SELECT map.education_subsystem,map.education_level
    INTO v_subsystem,v_level
  FROM public.curriculum_preset_calendar_contract map
  WHERE map.preset_id=p_curriculum_preset_id;
  IF v_subsystem IS NULL THEN
    RAISE EXCEPTION 'CURRICULUM_CALENDAR_MAPPING_REQUIRED: Preset global sem classificação MED.';
  END IF;

  SELECT a.ano INTO v_year
  FROM public.anos_letivos a
  WHERE a.escola_id=p_escola_id AND a.ativo IS TRUE
  ORDER BY a.ano DESC LIMIT 1;
  IF v_year IS NULL THEN
    RAISE EXCEPTION 'ACADEMIC_YEAR_NOT_CONFIGURED: Configure o ano letivo antes de instalar o curso.';
  END IF;

  -- Legacy 2025 schools receive the earliest supported published catalog
  -- profile for future application, without mutating their historic year.
  -- From 2026 onward never silently substitute another school year.
  IF v_year < 2026 THEN v_year := 2026; END IF;

  SELECT count(*),min(t.id)
    INTO v_matches,v_profile
  FROM public.calendario_templates t
  JOIN public.calendarios_oficiais_anos parent
    ON parent.ano_base=t.calendario_canonico_ano
  WHERE t.ano_base=v_year AND t.subsistema=v_subsystem
    AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
    AND parent.estado='PUBLICADO'
    AND t.data_inicio=parent.data_inicio AND t.data_fim=parent.data_fim
    AND t.versao_documento=parent.versao_documento;

  IF v_matches<>1 OR v_profile IS NULL THEN
    RAISE EXCEPTION 'OFFICIAL_CALENDAR_PROFILE_NOT_UNIQUE: Ano %, subsistema %, perfis %.',
      v_year,v_subsystem,v_matches;
  END IF;

  -- Protect against two parallel installers choosing to create a second
  -- active offering for the same course.
  PERFORM pg_advisory_xact_lock(hashtext(p_escola_id::text),hashtext(p_course_id::text));

  SELECT count(*) INTO v_existing
  FROM public.school_education_offerings o
  WHERE o.escola_id=p_escola_id AND o.course_id=p_course_id AND o.status='active';
  IF v_existing>1 THEN
    RAISE EXCEPTION 'COURSE_OFFERING_AMBIGUOUS: Mais de uma oferta ativa neste curso.';
  END IF;

  SELECT o.id INTO v_offering
  FROM public.school_education_offerings o
  WHERE o.escola_id=p_escola_id AND o.course_id=p_course_id
  ORDER BY (o.status='active') DESC,o.updated_at DESC,o.id DESC
  LIMIT 1 FOR UPDATE;

  IF v_offering IS NULL THEN
    INSERT INTO public.school_education_offerings (
      escola_id,education_subsystem,education_level,course_id,
      curriculum_preset_id,grades,calendar_profile_id,
      classification_source,classification_reason,status
    ) VALUES (
      p_escola_id,v_subsystem,v_level,p_course_id,
      p_curriculum_preset_id,ARRAY[]::text[],v_profile,
      'KLASSE_GLOBAL_CATALOG',
      'Classificação global do preset e perfil MED do ano letivo.', 'active'
    ) RETURNING id INTO v_offering;
  ELSE
    UPDATE public.school_education_offerings
    SET education_subsystem=v_subsystem,education_level=v_level,
        curriculum_preset_id=p_curriculum_preset_id,
        calendar_profile_id=v_profile,
        classification_source='KLASSE_GLOBAL_CATALOG',
        classification_reason='Classificação global do preset e perfil MED do ano letivo.',
        status='active',updated_at=now()
    WHERE id=v_offering AND escola_id=p_escola_id;
  END IF;
  RETURN v_offering;
END;
$ensure$;

REVOKE ALL ON FUNCTION public.ensure_k12_course_offering(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ensure_k12_course_offering(uuid,uuid,text) TO authenticated,service_role;

COMMIT;
