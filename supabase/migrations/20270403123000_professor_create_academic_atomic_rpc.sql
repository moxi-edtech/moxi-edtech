DO $$
BEGIN
  EXECUTE $function$
CREATE OR REPLACE FUNCTION public.create_or_update_professor_academico(
  p_escola_id uuid,
  p_user_id uuid,
  p_profile jsonb,
  p_teacher jsonb,
  p_disciplina_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $body$
DECLARE
  v_teacher_id uuid;
  v_professor_id uuid;
  v_valid_disciplina_ids uuid[] := '{}';
  v_skills_inserted int := 0;
BEGIN
  IF p_escola_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'escola_id e user_id são obrigatórios';
  END IF;

  INSERT INTO public.profiles (
    user_id,
    email,
    nome,
    telefone,
    role,
    escola_id,
    current_escola_id
  )
  VALUES (
    p_user_id,
    p_profile->>'email',
    p_profile->>'nome',
    NULLIF(p_profile->>'telefone', ''),
    COALESCE((p_profile->>'role')::public.user_role, 'professor'::public.user_role),
    p_escola_id,
    p_escola_id
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    role = EXCLUDED.role,
    escola_id = EXCLUDED.escola_id,
    current_escola_id = EXCLUDED.current_escola_id;

  INSERT INTO public.escola_users (
    escola_id,
    user_id,
    papel
  )
  VALUES (
    p_escola_id,
    p_user_id,
    'professor'
  )
  ON CONFLICT (escola_id, user_id)
  DO UPDATE SET
    papel = 'professor';

  SELECT id
    INTO v_professor_id
  FROM public.professores
  WHERE escola_id = p_escola_id
    AND profile_id = p_user_id
  ORDER BY created_at DESC NULLS LAST, id DESC
  LIMIT 1;

  IF v_professor_id IS NULL THEN
    INSERT INTO public.professores (escola_id, profile_id)
    VALUES (p_escola_id, p_user_id)
    RETURNING id INTO v_professor_id;
  END IF;

  INSERT INTO public.teachers (
    escola_id,
    profile_id,
    nome_completo,
    genero,
    data_nascimento,
    numero_bi,
    telefone_principal,
    habilitacoes,
    area_formacao,
    vinculo_contratual,
    carga_horaria_maxima,
    turnos_disponiveis,
    is_diretor_turma
  )
  VALUES (
    p_escola_id,
    p_user_id,
    p_teacher->>'nome_completo',
    p_teacher->>'genero',
    NULLIF(p_teacher->>'data_nascimento', '')::date,
    NULLIF(p_teacher->>'numero_bi', ''),
    NULLIF(p_teacher->>'telefone_principal', ''),
    p_teacher->>'habilitacoes',
    NULLIF(p_teacher->>'area_formacao', ''),
    p_teacher->>'vinculo_contratual',
    COALESCE((p_teacher->>'carga_horaria_maxima')::integer, 0),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_teacher->'turnos_disponiveis', '[]'::jsonb))),
      '{}'::text[]
    ),
    COALESCE((p_teacher->>'is_diretor_turma')::boolean, false)
  )
  ON CONFLICT (escola_id, profile_id)
  DO UPDATE SET
    nome_completo = EXCLUDED.nome_completo,
    genero = EXCLUDED.genero,
    data_nascimento = EXCLUDED.data_nascimento,
    numero_bi = EXCLUDED.numero_bi,
    telefone_principal = EXCLUDED.telefone_principal,
    habilitacoes = EXCLUDED.habilitacoes,
    area_formacao = EXCLUDED.area_formacao,
    vinculo_contratual = EXCLUDED.vinculo_contratual,
    carga_horaria_maxima = EXCLUDED.carga_horaria_maxima,
    turnos_disponiveis = EXCLUDED.turnos_disponiveis,
    is_diretor_turma = EXCLUDED.is_diretor_turma,
    updated_at = now()
  RETURNING id INTO v_teacher_id;

  DELETE FROM public.teacher_skills
  WHERE teacher_id = v_teacher_id;

  IF COALESCE(array_length(p_disciplina_ids, 1), 0) > 0 THEN
    SELECT COALESCE(array_agg(id), '{}')
      INTO v_valid_disciplina_ids
    FROM public.disciplinas_catalogo
    WHERE escola_id = p_escola_id
      AND id = ANY(p_disciplina_ids);

    IF COALESCE(array_length(v_valid_disciplina_ids, 1), 0) > 0 THEN
      INSERT INTO public.teacher_skills (escola_id, teacher_id, disciplina_id)
      SELECT p_escola_id, v_teacher_id, disciplina_id
      FROM unnest(v_valid_disciplina_ids) AS disciplina_id
      ON CONFLICT (teacher_id, disciplina_id)
      DO UPDATE SET escola_id = EXCLUDED.escola_id;

      GET DIAGNOSTICS v_skills_inserted = ROW_COUNT;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'teacher_id', v_teacher_id,
    'professor_id', v_professor_id,
    'skills_count', v_skills_inserted,
    'valid_disciplina_ids', v_valid_disciplina_ids
  );
END;
$body$;
$function$;

  EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_or_update_professor_academico(uuid, uuid, jsonb, jsonb, uuid[]) TO authenticated';
END
$$;
