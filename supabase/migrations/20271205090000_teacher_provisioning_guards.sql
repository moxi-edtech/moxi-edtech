-- Replace rewrite rules that interfere with FK referential actions.
-- Keep the audit log append-only; only FK-driven actor anonymisation is allowed.
CREATE OR REPLACE FUNCTION public.guard_eventos_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1
    AND OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL
    AND (to_jsonb(OLD) - 'actor_id') = (to_jsonb(NEW) - 'actor_id')
    AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.actor_id)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'EVENTOS_IMMUTABLE' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.guard_eventos_immutable() FROM PUBLIC, anon, authenticated;
DROP RULE IF EXISTS eventos_no_update ON public.eventos;
DROP RULE IF EXISTS eventos_no_delete ON public.eventos;
DROP TRIGGER IF EXISTS eventos_immutable_guard ON public.eventos;
CREATE TRIGGER eventos_immutable_guard
BEFORE UPDATE OR DELETE ON public.eventos
FOR EACH ROW EXECUTE FUNCTION public.guard_eventos_immutable();

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
  IF p_escola_id IS NULL OR p_user_id IS NULL OR auth.uid() IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id = p_escola_id AND eu.user_id = auth.uid()
        AND eu.tenant_type = 'k12'
        AND lower(trim(coalesce(eu.papel::text, eu.role::text))) IN
          ('admin','admin_escola','staff_admin','staff','administrador','diretor','gestor','admin_financeiro','admin_secretaria','admin_secretario'))
    OR EXISTS (SELECT 1 FROM public.escola_administradores ea
      WHERE ea.escola_id = p_escola_id AND ea.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- Auth's profile trigger can initially set the role to encarregado. The
  -- server-owned provisioning marker survives that trigger and binds this
  -- transaction to the identity created for this request.
  PERFORM 1 FROM auth.users u
    WHERE u.id = p_user_id
      AND u.raw_app_meta_data->>'teacher_provisioning_id' = p_profile->>'provisioning_id'
      AND u.raw_app_meta_data->>'teacher_provisioning_id' IS NOT NULL
      AND u.raw_app_meta_data->>'escola_id' = p_escola_id::text
      AND lower(u.email) = lower(p_profile->>'email')
      AND u.last_sign_in_at IS NULL AND u.deleted_at IS NULL
    FOR UPDATE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM public.escola_users WHERE user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.escola_usuarios WHERE user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.escola_administradores WHERE user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.teachers WHERE profile_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.professores WHERE profile_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.alunos WHERE profile_id = p_user_id OR usuario_auth_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.encarregados WHERE lower(email) = lower(p_profile->>'email'))
    OR EXISTS (SELECT 1 FROM public.alunos WHERE lower(encarregado_email) = lower(p_profile->>'email'))
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id
      AND escola_id = p_escola_id AND role::text IN ('encarregado','professor') AND deleted_at IS NULL)
  THEN
    RAISE EXCEPTION 'IDENTITY_ALREADY_LINKED' USING ERRCODE = '23505';
  END IF;

  IF nullif(trim(p_teacher->>'numero_bi'), '') IS NOT NULL
    AND (upper(trim(p_teacher->>'numero_bi')) !~ '^[A-Z0-9]{14}$'
      OR trim(p_teacher->>'numero_bi') ~ '^0+$') THEN
    RAISE EXCEPTION 'INVALID_BI' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(p_disciplina_ids, '{}'::uuid[])) AS requested(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.disciplinas_catalogo d
      WHERE d.id = requested.id AND d.escola_id = p_escola_id)
  ) THEN
    RAISE EXCEPTION 'INVALID_SKILLS' USING ERRCODE = '22023';
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
    'professor'::public.user_role,
    p_escola_id,
    p_escola_id
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    role = 'professor'::public.user_role,
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
    papel = CASE
      WHEN public.escola_users.papel = 'professor' OR public.escola_users.papel IS NULL
        THEN 'professor'
      ELSE public.escola_users.papel
    END;

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
    NULLIF(upper(trim(p_teacher->>'numero_bi')), ''),
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

  -- A consumed marker cannot be used to provision again.
  UPDATE auth.users SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'teacher_provisioning_id'
    WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'teacher_id', v_teacher_id,
    'professor_id', v_professor_id,
    'skills_count', v_skills_inserted,
    'valid_disciplina_ids', v_valid_disciplina_ids
  );
END;
$body$;

REVOKE EXECUTE ON FUNCTION public.create_or_update_professor_academico(uuid, uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_update_professor_academico(uuid, uuid, jsonb, jsonb, uuid[]) TO authenticated;
