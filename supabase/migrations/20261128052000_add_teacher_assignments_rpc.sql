BEGIN;

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
AS $$
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
  SELECT pr.profile_id,
         td.turma_id,
         t.nome,
         dc.nome,
         COALESCE(td.carga_horaria_semanal, cm.carga_horaria_semanal)::integer
    FROM public.professores pr
    JOIN public.turma_disciplinas td
      ON td.professor_id = pr.id
     AND td.escola_id = p_escola_id
    LEFT JOIN public.turmas t ON t.id = td.turma_id
    LEFT JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
    LEFT JOIN public.disciplinas_catalogo dc ON dc.id = cm.disciplina_id
   WHERE pr.escola_id = p_escola_id
     AND pr.profile_id = ANY(p_profile_ids);
END;
$$;

ALTER FUNCTION public.get_teacher_assignments_by_profiles(uuid, uuid[]) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_teacher_assignments_by_profiles(uuid, uuid[]) TO authenticated;

COMMIT;
