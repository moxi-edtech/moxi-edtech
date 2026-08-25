BEGIN;

-- Keep the professor management area aligned with the turma assignment modal.
-- Older and shared assignments may exist in turma_disciplinas_professores while
-- turma_disciplinas.professor_id is null; both representations are valid links.
CREATE OR REPLACE FUNCTION public.get_teacher_assignments_by_profiles(
  p_escola_id uuid,
  p_profile_ids uuid[]
)
RETURNS TABLE(
  profile_id uuid,
  turma_id uuid,
  turma_nome text,
  disciplina_nome text,
  carga_horaria_semanal integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_escola_id IS NULL THEN
    RETURN;
  END IF;

  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola','admin','secretaria','staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  IF p_profile_ids IS NULL OR array_length(p_profile_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH assignment_rows AS (
    SELECT
      td.turma_id,
      COALESCE(td.professor_id, tdp.professor_id) AS professor_id,
      td.curso_matriz_id,
      COALESCE(td.carga_horaria_semanal, cm.carga_horaria_semanal)::integer AS carga_horaria_semanal
    FROM public.turma_disciplinas td
    LEFT JOIN public.curso_matriz cm
      ON cm.id = td.curso_matriz_id
     AND cm.escola_id = p_escola_id
    LEFT JOIN public.turma_disciplinas_professores tdp
      ON tdp.escola_id = p_escola_id
     AND tdp.turma_id = td.turma_id
     AND tdp.disciplina_id = cm.disciplina_id
    WHERE td.escola_id = p_escola_id
      AND COALESCE(td.professor_id, tdp.professor_id) IS NOT NULL

    UNION ALL

    SELECT
      tdp.turma_id,
      tdp.professor_id,
      cm.id AS curso_matriz_id,
      cm.carga_horaria_semanal::integer
    FROM public.turma_disciplinas_professores tdp
    JOIN public.curso_matriz cm
      ON cm.escola_id = p_escola_id
     AND cm.disciplina_id = tdp.disciplina_id
    WHERE tdp.escola_id = p_escola_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.turma_disciplinas td
        WHERE td.escola_id = p_escola_id
          AND td.turma_id = tdp.turma_id
          AND td.curso_matriz_id = cm.id
      )
  )
  SELECT pr.profile_id,
         ar.turma_id,
         t.nome,
         dc.nome,
         ar.carga_horaria_semanal
    FROM assignment_rows ar
    JOIN public.professores pr
      ON pr.id = ar.professor_id
     AND pr.escola_id = p_escola_id
    LEFT JOIN public.turmas t ON t.id = ar.turma_id
    LEFT JOIN public.disciplinas_catalogo dc ON dc.id = (
      SELECT cm2.disciplina_id
      FROM public.curso_matriz cm2
      WHERE cm2.id = ar.curso_matriz_id
        AND cm2.escola_id = p_escola_id
      LIMIT 1
    )
   WHERE pr.profile_id = ANY(p_profile_ids);
END;
$function$;

ALTER FUNCTION public.get_teacher_assignments_by_profiles(uuid, uuid[]) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_teacher_assignments_by_profiles(uuid, uuid[]) TO authenticated;

COMMIT;
