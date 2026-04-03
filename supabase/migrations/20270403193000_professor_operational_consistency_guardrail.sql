BEGIN;

CREATE OR REPLACE FUNCTION public.check_professor_operational_consistency(
  p_escola_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  check_key text,
  severity text,
  total bigint,
  sample jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 20), 200));
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'CONSISTENCY_INVALID_ESCOLA_ID';
  END IF;

  RETURN QUERY
  WITH
  teachers_without_professor AS (
    SELECT
      t.id AS teacher_id,
      t.profile_id
    FROM public.teachers t
    LEFT JOIN public.professores p
      ON p.escola_id = t.escola_id
     AND p.profile_id = t.profile_id
    WHERE t.escola_id = p_escola_id
      AND p.id IS NULL
    ORDER BY t.created_at DESC NULLS LAST
  ),
  professores_without_teacher AS (
    SELECT
      p.id AS professor_id,
      p.profile_id
    FROM public.professores p
    LEFT JOIN public.teachers t
      ON t.escola_id = p.escola_id
     AND t.profile_id = p.profile_id
    WHERE p.escola_id = p_escola_id
      AND t.id IS NULL
    ORDER BY p.created_at DESC NULLS LAST
  ),
  professores_duplicates AS (
    SELECT
      p.profile_id,
      COUNT(*)::int AS duplicates,
      ARRAY_AGG(p.id ORDER BY p.created_at DESC NULLS LAST, p.id DESC) AS professor_ids
    FROM public.professores p
    WHERE p.escola_id = p_escola_id
    GROUP BY p.profile_id
    HAVING COUNT(*) > 1
  ),
  teacher_skills_escola_mismatch AS (
    SELECT
      ts.id AS teacher_skill_id,
      ts.teacher_id,
      ts.escola_id AS teacher_skill_escola_id,
      t.escola_id AS teacher_escola_id
    FROM public.teacher_skills ts
    JOIN public.teachers t
      ON t.id = ts.teacher_id
    WHERE ts.escola_id = p_escola_id
      AND t.escola_id <> ts.escola_id
    ORDER BY ts.created_at DESC
  ),
  alocacoes_without_teacher AS (
    SELECT
      tdp.id AS alocacao_id,
      tdp.turma_id,
      tdp.disciplina_id,
      tdp.professor_id,
      p.profile_id
    FROM public.turma_disciplinas_professores tdp
    JOIN public.professores p
      ON p.id = tdp.professor_id
     AND p.escola_id = tdp.escola_id
    LEFT JOIN public.teachers t
      ON t.escola_id = p.escola_id
     AND t.profile_id = p.profile_id
    WHERE tdp.escola_id = p_escola_id
      AND t.id IS NULL
    ORDER BY tdp.updated_at DESC NULLS LAST, tdp.created_at DESC NULLS LAST
  ),
  alocacoes_without_skill AS (
    SELECT
      tdp.id AS alocacao_id,
      tdp.turma_id,
      tdp.disciplina_id,
      tdp.professor_id,
      t.id AS teacher_id
    FROM public.turma_disciplinas_professores tdp
    JOIN public.professores p
      ON p.id = tdp.professor_id
     AND p.escola_id = tdp.escola_id
    JOIN public.teachers t
      ON t.escola_id = p.escola_id
     AND t.profile_id = p.profile_id
    LEFT JOIN public.teacher_skills ts
      ON ts.escola_id = tdp.escola_id
     AND ts.teacher_id = t.id
     AND ts.disciplina_id = tdp.disciplina_id
    WHERE tdp.escola_id = p_escola_id
      AND ts.id IS NULL
    ORDER BY tdp.updated_at DESC NULLS LAST, tdp.created_at DESC NULLS LAST
  )
  SELECT
    'teachers_without_professor'::text,
    'high'::text,
    COUNT(*)::bigint,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT teacher_id, profile_id
        FROM teachers_without_professor
        LIMIT v_limit
      ) x
    ), '[]'::jsonb)
  FROM teachers_without_professor

  UNION ALL

  SELECT
    'professores_without_teacher'::text,
    'high'::text,
    COUNT(*)::bigint,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT professor_id, profile_id
        FROM professores_without_teacher
        LIMIT v_limit
      ) x
    ), '[]'::jsonb)
  FROM professores_without_teacher

  UNION ALL

  SELECT
    'professores_duplicates_profile'::text,
    'medium'::text,
    COUNT(*)::bigint,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT profile_id, duplicates, professor_ids
        FROM professores_duplicates
        ORDER BY duplicates DESC, profile_id
        LIMIT v_limit
      ) x
    ), '[]'::jsonb)
  FROM professores_duplicates

  UNION ALL

  SELECT
    'teacher_skills_escola_mismatch'::text,
    'high'::text,
    COUNT(*)::bigint,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT teacher_skill_id, teacher_id, teacher_skill_escola_id, teacher_escola_id
        FROM teacher_skills_escola_mismatch
        LIMIT v_limit
      ) x
    ), '[]'::jsonb)
  FROM teacher_skills_escola_mismatch

  UNION ALL

  SELECT
    'alocacoes_without_teacher'::text,
    'high'::text,
    COUNT(*)::bigint,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT alocacao_id, turma_id, disciplina_id, professor_id, profile_id
        FROM alocacoes_without_teacher
        LIMIT v_limit
      ) x
    ), '[]'::jsonb)
  FROM alocacoes_without_teacher

  UNION ALL

  SELECT
    'alocacoes_without_skill'::text,
    'high'::text,
    COUNT(*)::bigint,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT alocacao_id, turma_id, disciplina_id, professor_id, teacher_id
        FROM alocacoes_without_skill
        LIMIT v_limit
      ) x
    ), '[]'::jsonb)
  FROM alocacoes_without_skill;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_professor_operational_consistency(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_professor_operational_consistency(uuid, integer) TO service_role;

COMMIT;
