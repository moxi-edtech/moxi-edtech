CREATE OR REPLACE FUNCTION public.validate_curriculum_presets(
  p_escola_id uuid DEFAULT NULL
)
RETURNS TABLE (
  escola_id uuid,
  curso_id uuid,
  preset_id text,
  grade_level text,
  disciplina_nome text,
  ocorrencias integer,
  carga_horaria_sugerida integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_or_global_admin() THEN
    IF p_escola_id IS NULL OR NOT public.user_has_role_in_school(
      p_escola_id,
      ARRAY['admin_escola', 'admin', 'secretaria']
    ) THEN
      RAISE EXCEPTION 'AUTH: Permissão negada.';
    END IF;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      c.escola_id,
      c.id AS curso_id,
      c.curriculum_key AS preset_id,
      cl.nome AS grade_level,
      dc.nome AS disciplina_nome,
      MAX(cm.carga_horaria_semanal) AS carga_horaria_sugerida,
      COUNT(*)::int AS ocorrencias
    FROM public.curso_matriz cm
    JOIN public.cursos c ON c.id = cm.curso_id
    JOIN public.classes cl ON cl.id = cm.classe_id
    JOIN public.disciplinas_catalogo dc ON dc.id = cm.disciplina_id
    WHERE c.curriculum_key IS NOT NULL
      AND (p_escola_id IS NULL OR c.escola_id = p_escola_id)
    GROUP BY c.escola_id, c.id, c.curriculum_key, cl.nome, dc.nome
  )
  SELECT
    base.escola_id,
    base.curso_id,
    base.preset_id,
    base.grade_level,
    base.disciplina_nome,
    base.ocorrencias,
    base.carga_horaria_sugerida
  FROM base
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.curriculum_preset_subjects cps
    WHERE cps.preset_id = base.preset_id
      AND cps.grade_level = base.grade_level
      AND cps.name = base.disciplina_nome
  )
  ORDER BY base.preset_id, base.grade_level, base.disciplina_nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_curriculum_presets(uuid) TO authenticated;
