BEGIN;

CREATE OR REPLACE FUNCTION public.curriculum_presets_upsert(
  p_id text,
  p_name text,
  p_category public.course_category,
  p_description text DEFAULT NULL
) RETURNS TABLE (
  id text,
  name text,
  category public.course_category,
  description text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_or_global_admin() THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  IF p_id IS NULL OR btrim(p_id) = '' THEN
    RAISE EXCEPTION 'DATA: id obrigatório.';
  END IF;

  INSERT INTO public.curriculum_presets (id, name, category, description)
  VALUES (p_id, p_name, p_category, p_description)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description
  RETURNING curriculum_presets.id, curriculum_presets.name,
            curriculum_presets.category, curriculum_presets.description
    INTO id, name, category, description;

  INSERT INTO public.curriculum_presets_audit (
    preset_id,
    action,
    actor_id,
    details
  ) VALUES (
    id,
    'UPSERT',
    auth.uid(),
    jsonb_build_object(
      'name', name,
      'category', category,
      'description', description
    )
  );

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.curriculum_preset_subjects_upsert(
  p_subject_id uuid,
  p_preset_id text,
  p_name text,
  p_grade_level text,
  p_component public.discipline_component,
  p_weekly_hours int,
  p_subject_type text DEFAULT 'core'
) RETURNS TABLE (
  id uuid,
  preset_id text,
  name text,
  grade_level text,
  component public.discipline_component,
  weekly_hours int,
  subject_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_or_global_admin() THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  IF p_preset_id IS NULL OR btrim(p_preset_id) = '' THEN
    RAISE EXCEPTION 'DATA: preset_id obrigatório.';
  END IF;

  IF p_subject_id IS NOT NULL THEN
    UPDATE public.curriculum_preset_subjects
    SET preset_id = p_preset_id,
        name = p_name,
        grade_level = p_grade_level,
        component = p_component,
        weekly_hours = COALESCE(p_weekly_hours, 0),
        subject_type = COALESCE(p_subject_type, subject_type)
    WHERE id = p_subject_id
    RETURNING curriculum_preset_subjects.id, curriculum_preset_subjects.preset_id,
              curriculum_preset_subjects.name, curriculum_preset_subjects.grade_level,
              curriculum_preset_subjects.component, curriculum_preset_subjects.weekly_hours,
              curriculum_preset_subjects.subject_type
      INTO id, preset_id, name, grade_level, component, weekly_hours, subject_type;

    IF id IS NULL THEN
      RAISE EXCEPTION 'DATA: disciplina do preset não encontrada.';
    END IF;

    INSERT INTO public.curriculum_presets_audit (
      preset_id,
      subject_id,
      action,
      actor_id,
      details
    ) VALUES (
      preset_id,
      id,
      'SUBJECT_UPSERT',
      auth.uid(),
      jsonb_build_object(
        'name', name,
        'grade_level', grade_level,
        'component', component,
        'weekly_hours', weekly_hours,
        'subject_type', subject_type
      )
    );

    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.curriculum_preset_subjects (
    preset_id,
    name,
    grade_level,
    component,
    weekly_hours,
    subject_type
  ) VALUES (
    p_preset_id,
    p_name,
    p_grade_level,
    p_component,
    COALESCE(p_weekly_hours, 0),
    COALESCE(p_subject_type, 'core')
  )
  ON CONFLICT (preset_id, name, grade_level) DO UPDATE
    SET component = EXCLUDED.component,
        weekly_hours = EXCLUDED.weekly_hours,
        subject_type = EXCLUDED.subject_type
  RETURNING curriculum_preset_subjects.id, curriculum_preset_subjects.preset_id,
            curriculum_preset_subjects.name, curriculum_preset_subjects.grade_level,
            curriculum_preset_subjects.component, curriculum_preset_subjects.weekly_hours,
            curriculum_preset_subjects.subject_type
    INTO id, preset_id, name, grade_level, component, weekly_hours, subject_type;

  INSERT INTO public.curriculum_presets_audit (
    preset_id,
    subject_id,
    action,
    actor_id,
    details
  ) VALUES (
    preset_id,
    id,
    'SUBJECT_UPSERT',
    auth.uid(),
    jsonb_build_object(
      'name', name,
      'grade_level', grade_level,
      'component', component,
      'weekly_hours', weekly_hours,
      'subject_type', subject_type
    )
  );

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.curriculum_preset_subjects_delete(
  p_subject_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_or_global_admin() THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  DELETE FROM public.curriculum_preset_subjects
  WHERE id = p_subject_id;

  IF FOUND THEN
    INSERT INTO public.curriculum_presets_audit (
      subject_id,
      action,
      actor_id
    ) VALUES (
      p_subject_id,
      'SUBJECT_DELETE',
      auth.uid()
    );
  END IF;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.curriculum_presets_delete(
  p_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_or_global_admin() THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  DELETE FROM public.curriculum_presets
  WHERE id = p_id;

  IF FOUND THEN
    INSERT INTO public.curriculum_presets_audit (
      preset_id,
      action,
      actor_id
    ) VALUES (
      p_id,
      'PRESET_DELETE',
      auth.uid()
    );
  END IF;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.curriculum_presets_upsert(text, text, public.course_category, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.curriculum_preset_subjects_upsert(uuid, text, text, text, public.discipline_component, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.curriculum_preset_subjects_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.curriculum_presets_delete(text) TO authenticated;

COMMIT;
