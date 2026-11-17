-- The admin teacher roster must show assignments for the ACTIVE academic year only.
-- The previous implementation multiplied shared links across curriculum versions,
-- so one professor could appear to have dozens of "turmas" from a handful of real links.
-- Keep historical teacher assignments unchanged.
CREATE OR REPLACE FUNCTION public.get_teacher_assignments_by_profiles(
  p_escola_id uuid,
  p_profile_ids uuid[]
)
RETURNS TABLE (
  profile_id uuid,
  turma_id uuid,
  turma_nome text,
  disciplina_nome text,
  carga_horaria_semanal integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_ano_letivo_id uuid;
BEGIN
  IF p_escola_id IS NULL THEN
    RETURN;
  END IF;

  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(
    p_escola_id, ARRAY['admin_escola', 'admin', 'secretaria', 'staff_admin', 'admin_financeiro', 'secretaria_financeiro']
  ) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  IF p_profile_ids IS NULL OR cardinality(p_profile_ids) = 0 THEN
    RETURN;
  END IF;

  SELECT a.id INTO v_ano_letivo_id
  FROM public.anos_letivos AS a
  WHERE a.escola_id = p_escola_id AND a.ativo = true
  ORDER BY a.data_inicio DESC NULLS LAST, a.ano DESC, a.id
  LIMIT 1;

  IF v_ano_letivo_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH target_turmas AS (
    SELECT t.id, t.escola_id, t.session_id, t.curso_id, t.classe_id, t.nome
    FROM public.turmas AS t
    WHERE t.escola_id = p_escola_id AND t.session_id = v_ano_letivo_id
  ),
  candidates AS (
    -- The canonical link: teacher directly assigned to turma_disciplinas.
    SELECT
      pr.profile_id AS teacher_profile_id,
      t.id AS assigned_turma_id,
      t.nome AS assigned_turma_name,
      cm.disciplina_id AS assigned_disciplina_id,
      dc.nome AS assigned_disciplina_name,
      COALESCE(td.carga_horaria_semanal, cm.carga_horaria_semanal)::integer AS assigned_load,
      0 AS source_priority
    FROM public.turma_disciplinas AS td
    JOIN target_turmas AS t
      ON t.id = td.turma_id AND t.escola_id = td.escola_id
    JOIN public.curso_matriz AS cm
      ON cm.id = td.curso_matriz_id
     AND cm.escola_id = t.escola_id
     AND cm.curso_id = t.curso_id
     AND cm.classe_id = t.classe_id
     AND cm.ativo = true
    JOIN public.curso_curriculos AS cc
      ON cc.id = cm.curso_curriculo_id
     AND cc.ano_letivo_id = t.session_id
     AND cc.status = 'published'
    JOIN public.professores AS pr
      ON pr.id = td.professor_id AND pr.escola_id = t.escola_id
    LEFT JOIN public.disciplinas_catalogo AS dc
      ON dc.id = cm.disciplina_id AND dc.escola_id = t.escola_id
    WHERE pr.profile_id = ANY(p_profile_ids)

    UNION ALL

    -- Additional / shared links. Never cross-join all matrices for a subject.
    SELECT
      pr.profile_id AS teacher_profile_id,
      t.id AS assigned_turma_id,
      t.nome AS assigned_turma_name,
      tdp.disciplina_id AS assigned_disciplina_id,
      dc.nome AS assigned_disciplina_name,
      load_info.assigned_load,
      1 AS source_priority
    FROM public.turma_disciplinas_professores AS tdp
    JOIN target_turmas AS t
      ON t.id = tdp.turma_id AND t.escola_id = tdp.escola_id
    JOIN public.professores AS pr
      ON pr.id = tdp.professor_id AND pr.escola_id = t.escola_id
    JOIN public.disciplinas_catalogo AS dc
      ON dc.id = tdp.disciplina_id AND dc.escola_id = t.escola_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(td.carga_horaria_semanal, cm.carga_horaria_semanal)::integer AS assigned_load
      FROM public.turma_disciplinas AS td
      JOIN public.curso_matriz AS cm
        ON cm.id = td.curso_matriz_id
       AND cm.escola_id = t.escola_id
       AND cm.curso_id = t.curso_id
       AND cm.classe_id = t.classe_id
       AND cm.disciplina_id = tdp.disciplina_id
       AND cm.ativo = true
      JOIN public.curso_curriculos AS cc
        ON cc.id = cm.curso_curriculo_id
       AND cc.ano_letivo_id = t.session_id
       AND cc.status = 'published'
      WHERE td.escola_id = t.escola_id AND td.turma_id = t.id
      ORDER BY td.id
      LIMIT 1
    ) AS load_info ON true
    WHERE pr.profile_id = ANY(p_profile_ids)
  )
  SELECT DISTINCT ON (c.teacher_profile_id, c.assigned_turma_id, c.assigned_disciplina_id)
    c.teacher_profile_id,
    c.assigned_turma_id,
    c.assigned_turma_name,
    c.assigned_disciplina_name,
    c.assigned_load
  FROM candidates AS c
  ORDER BY
    c.teacher_profile_id,
    c.assigned_turma_id,
    c.assigned_disciplina_id,
    c.source_priority;
END;
$function$;

-- This SECURITY DEFINER routine enforces tenant and staff-role checks itself;
-- explicit grants avoid making it callable by anonymous sessions.
REVOKE ALL ON FUNCTION public.get_teacher_assignments_by_profiles(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_assignments_by_profiles(uuid, uuid[]) TO authenticated;
