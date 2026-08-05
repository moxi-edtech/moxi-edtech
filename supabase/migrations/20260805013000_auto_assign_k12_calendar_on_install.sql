BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_k12_course_offering(
  p_escola_id uuid,
  p_course_id uuid,
  p_curriculum_preset_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_key text;
  v_category text;
  v_subsystem text;
  v_level text;
  v_calendar_profile_id uuid;
  v_offering_id uuid;
BEGIN
  SELECT c.curriculum_key
    INTO v_course_key
  FROM public.cursos c
  WHERE c.id = p_course_id
    AND c.escola_id = p_escola_id;

  IF v_course_key IS NULL OR v_course_key IS DISTINCT FROM p_curriculum_preset_id THEN
    RAISE EXCEPTION 'Curso K12 sem correspondência exata com o preset solicitado.';
  END IF;

  SELECT p.category::text
    INTO v_category
  FROM public.curriculum_presets p
  WHERE p.id = p_curriculum_preset_id;

  IF v_category IS NULL THEN
    RAISE EXCEPTION 'Preset curricular K12 inexistente.';
  END IF;

  IF p_curriculum_preset_id = 'pre_escolar' THEN
    v_subsystem := 'PRE_ESCOLAR';
    v_level := 'PRE_SCHOOL';
  ELSIF v_category LIKE 'TECNICO%' THEN
    v_subsystem := 'TECNICO_PROFISSIONAL';
    v_level := 'SECONDARY';
  ELSIF v_category = 'PRIMARIO' THEN
    v_subsystem := 'REGULAR_ADULTOS';
    v_level := 'PRIMARY';
  ELSE
    v_subsystem := 'REGULAR_ADULTOS';
    v_level := 'SECONDARY';
  END IF;

  SELECT ct.id
    INTO v_calendar_profile_id
  FROM public.calendario_templates ct
  WHERE ct.is_oficial = true
    AND ct.estado = 'PUBLICADO'
    AND ct.ano_base = 2026
    AND ct.subsistema = v_subsystem
  ORDER BY ct.publicado_em DESC NULLS LAST, ct.updated_at DESC, ct.id DESC
  LIMIT 1;

  IF v_calendar_profile_id IS NULL THEN
    RAISE EXCEPTION 'Calendário oficial 2026/2027 não encontrado para o subsistema %.', v_subsystem;
  END IF;

  SELECT o.id
    INTO v_offering_id
  FROM public.school_education_offerings o
  WHERE o.escola_id = p_escola_id
    AND o.course_id = p_course_id
  ORDER BY o.status = 'active' DESC, o.updated_at DESC, o.id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_offering_id IS NULL THEN
    INSERT INTO public.school_education_offerings (
      escola_id,
      education_subsystem,
      education_level,
      course_id,
      curriculum_preset_id,
      grades,
      calendar_profile_id,
      classification_source,
      classification_reason,
      status
    ) VALUES (
      p_escola_id,
      v_subsystem,
      v_level,
      p_course_id,
      p_curriculum_preset_id,
      '{}'::text[],
      v_calendar_profile_id,
      'curriculum_preset_install',
      'Preset K12 exato escolhido no momento da instalação do curso.',
      'active'
    )
    RETURNING id INTO v_offering_id;
  ELSE
    UPDATE public.school_education_offerings
    SET
      education_subsystem = v_subsystem,
      education_level = v_level,
      curriculum_preset_id = p_curriculum_preset_id,
      calendar_profile_id = v_calendar_profile_id,
      classification_source = 'curriculum_preset_install',
      classification_reason = 'Preset K12 exato escolhido no momento da instalação do curso.',
      status = 'active',
      updated_at = now()
    WHERE id = v_offering_id;
  END IF;

  RETURN v_offering_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_k12_course_offering(uuid, uuid, text) IS
  'Cria ou atualiza a oferta K12 do curso e associa o calendário oficial 2026/2027 compatível com o preset exato.';

GRANT EXECUTE ON FUNCTION public.ensure_k12_course_offering(uuid, uuid, text) TO authenticated;

COMMIT;
