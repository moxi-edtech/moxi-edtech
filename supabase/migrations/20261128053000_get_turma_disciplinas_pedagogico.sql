BEGIN;

CREATE OR REPLACE FUNCTION public.get_turma_disciplinas_pedagogico(
  p_escola_id uuid,
  p_turma_id uuid
)
RETURNS TABLE(
  id uuid,
  turma_id uuid,
  disciplina_id uuid,
  disciplina_nome text,
  professor_nome text,
  professor_email text,
  periodos_ativos integer[],
  carga_horaria_semanal integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_escola_id IS NULL OR p_turma_id IS NULL THEN
    RETURN;
  END IF;

  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola','admin','secretaria','staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  RETURN QUERY
  SELECT td.id,
         td.turma_id,
         cm.disciplina_id,
         dc.nome,
         prof.nome,
         prof.email,
         td.periodos_ativos,
         COALESCE(td.carga_horaria_semanal, cm.carga_horaria_semanal)::integer
    FROM public.turma_disciplinas td
    LEFT JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
    LEFT JOIN public.disciplinas_catalogo dc ON dc.id = cm.disciplina_id
    LEFT JOIN public.professores pr ON pr.id = td.professor_id
    LEFT JOIN public.profiles prof ON prof.user_id = pr.profile_id
   WHERE td.escola_id = p_escola_id
     AND td.turma_id = p_turma_id;
END;
$$;

ALTER FUNCTION public.get_turma_disciplinas_pedagogico(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_turma_disciplinas_pedagogico(uuid, uuid) TO authenticated;

COMMIT;
