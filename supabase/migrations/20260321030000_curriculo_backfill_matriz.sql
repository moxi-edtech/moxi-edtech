CREATE OR REPLACE FUNCTION public.curriculo_backfill_matriz_from_preset(
  p_escola_id uuid,
  p_curso_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preset_id text;
  v_rows integer := 0;
BEGIN
  IF NOT public.is_super_or_global_admin() THEN
    IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola', 'admin', 'secretaria']) THEN
      RAISE EXCEPTION 'AUTH: Permissão negada.';
    END IF;
  END IF;

  SELECT curriculum_key
    INTO v_preset_id
    FROM public.cursos
   WHERE id = p_curso_id
     AND escola_id = p_escola_id;

  IF v_preset_id IS NULL THEN
    RAISE EXCEPTION 'DATA: curso sem preset.';
  END IF;

  WITH latest_curriculos AS (
    SELECT DISTINCT ON (classe_id)
      id,
      classe_id
    FROM public.curso_curriculos
    WHERE escola_id = p_escola_id
      AND curso_id = p_curso_id
    ORDER BY classe_id, version DESC
  ),
  base AS (
    SELECT
      p_escola_id AS escola_id,
      p_curso_id AS curso_id,
      cl.id AS classe_id,
      dc.id AS disciplina_id,
      lc.id AS curso_curriculo_id,
      cps.id AS preset_subject_id,
      cps.weekly_hours AS carga_horaria_semanal,
      row_number() OVER (PARTITION BY cl.id ORDER BY cps.name) AS ordem
    FROM public.classes cl
    JOIN latest_curriculos lc ON lc.classe_id = cl.id
    JOIN public.curriculum_preset_subjects cps
      ON cps.preset_id = v_preset_id
     AND cps.grade_level = cl.nome
    JOIN public.disciplinas_catalogo dc
      ON dc.escola_id = p_escola_id
     AND dc.nome = cps.name
    WHERE cl.escola_id = p_escola_id
      AND cl.curso_id = p_curso_id
  )
  INSERT INTO public.curso_matriz (
    escola_id,
    curso_id,
    classe_id,
    disciplina_id,
    curso_curriculo_id,
    preset_subject_id,
    carga_horaria,
    carga_horaria_semanal,
    obrigatoria,
    classificacao,
    ordem,
    ativo,
    periodos_ativos,
    entra_no_horario,
    avaliacao_mode,
    status_completude
  )
  SELECT
    base.escola_id,
    base.curso_id,
    base.classe_id,
    base.disciplina_id,
    base.curso_curriculo_id,
    base.preset_subject_id,
    NULL,
    base.carga_horaria_semanal,
    true,
    'core',
    base.ordem,
    true,
    ARRAY[1,2,3],
    true,
    'inherit_school',
    'incompleto'
  FROM base
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.curriculo_backfill_matriz_from_preset(uuid, uuid) TO authenticated;
