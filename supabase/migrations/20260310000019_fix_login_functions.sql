BEGIN;

DROP FUNCTION IF EXISTS public.confirmar_matricula_core(uuid);
DROP FUNCTION IF EXISTS public.build_numero_login(uuid, integer, bigint);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid;
BEGIN
  v_escola_id := nullif(new.raw_user_meta_data->>'escola_id', '')::uuid;

  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    email_real,
    role,
    telefone,
    onboarding_finalizado,
    escola_id,
    current_escola_id
  )
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'nome', 'Novo Usuário'),
    new.email,
    coalesce(new.raw_user_meta_data->>'email_real', new.email),
    'encarregado'::user_role,
    coalesce(new.raw_user_meta_data->>'phone', new.phone),
    false,
    v_escola_id,
    v_escola_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nome = excluded.nome,
    email = excluded.email,
    email_real = coalesce(excluded.email_real, public.profiles.email_real),
    telefone = coalesce(excluded.telefone, public.profiles.telefone),
    escola_id = coalesce(excluded.escola_id, public.profiles.escola_id),
    current_escola_id = coalesce(excluded.current_escola_id, public.profiles.current_escola_id);

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_or_confirm_matricula(
  p_aluno_id uuid,
  p_turma_id uuid,
  p_ano_letivo integer,
  p_matricula_id uuid DEFAULT NULL::uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.confirmar_matricula_core(
    p_aluno_id,
    p_ano_letivo,
    p_turma_id,
    p_matricula_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.matricula_counter_floor(p_escola_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_floor bigint := 0;
BEGIN
  v_floor := COALESCE((
    SELECT MAX(cleaned::bigint)
    FROM (
      SELECT NULLIF(regexp_replace(m.numero_matricula::text, '[^0-9]', '', 'g'), '') AS cleaned
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
    ) src
    WHERE cleaned ~ '^\d+$' AND length(cleaned) <= 18
  ), 0);

  RETURN v_floor;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_profile_to_archive(
  p_user_id uuid,
  p_performed_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles_archive (
    user_id, nome, avatar_url, created_at, updated_at, role, email, escola_id,
    onboarding_finalizado, telefone, global_role, current_escola_id, numero_login, deleted_at, archived_by
  )
  SELECT user_id, nome, avatar_url, created_at, updated_at, role, email, escola_id,
    onboarding_finalizado, telefone, global_role, current_escola_id, NULL::text, deleted_at, p_performed_by
  FROM public.profiles
  WHERE user_id = p_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    avatar_url = EXCLUDED.avatar_url,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    role = EXCLUDED.role,
    email = EXCLUDED.email,
    escola_id = EXCLUDED.escola_id,
    onboarding_finalizado = EXCLUDED.onboarding_finalizado,
    telefone = EXCLUDED.telefone,
    global_role = EXCLUDED.global_role,
    current_escola_id = EXCLUDED.current_escola_id,
    numero_login = EXCLUDED.numero_login,
    deleted_at = EXCLUDED.deleted_at,
    archived_at = now(),
    archived_by = EXCLUDED.archived_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_unique_numero_login(
  p_escola_id uuid,
  p_role public.user_role,
  p_prefix text,
  p_start integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix text := trim(coalesce(p_prefix, ''));
  v_next integer;
BEGIN
  IF v_prefix = '' THEN
    RAISE EXCEPTION 'Prefixo inválido para numero_login.';
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_processo_login FROM '(\\d+)$') AS INTEGER)), 0)
    INTO v_next
  FROM public.profiles
  WHERE escola_id = p_escola_id
    AND role = p_role
    AND numero_processo_login LIKE v_prefix || '%'
    AND SUBSTRING(numero_processo_login FROM '(\\d+)$') ~ '^\\d{4,6}$';

  v_next := GREATEST(v_next, COALESCE(p_start, 0));

  RETURN v_prefix || LPAD((v_next + 1)::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.admissao_convert_to_matricula(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_from text;
  v_to text := 'matriculado';
  v_matricula_id uuid;
  v_turma_id uuid := NULLIF(p_metadata->>'turma_id', '')::uuid;
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida.';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin','financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes.';
  END IF;

  SELECT status, matricula_id, escola_id, aluno_id, ano_letivo INTO v_cand
  FROM public.candidaturas
  WHERE id = p_candidatura_id AND escola_id = v_tenant
  FOR UPDATE;

  IF v_cand.status IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada.';
  END IF;

  v_from := v_cand.status;

  IF v_from = 'matriculado' THEN
    RETURN v_cand.matricula_id;
  END IF;

  IF v_from NOT IN ('aprovada', 'aguardando_pagamento') THEN
    RAISE EXCEPTION 'Transição inválida: % -> matriculado (requer aprovada)', v_from;
  END IF;

  IF v_from = 'aguardando_pagamento'
    AND NOT public.user_has_role_in_school(
      p_escola_id,
      array['financeiro','admin','admin_escola','staff_admin']
    ) THEN
    RAISE EXCEPTION 'Aguardando validação financeira.';
  END IF;

  v_matricula_id := public.confirmar_matricula_core(
    v_cand.aluno_id,
    v_cand.ano_letivo,
    v_turma_id,
    NULL
  );

  IF v_matricula_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao gerar matrícula.';
  END IF;

  PERFORM set_config('app.rpc_internal', 'on', true);

  UPDATE public.candidaturas
  SET
    status = v_to,
    matricula_id = v_matricula_id,
    matriculado_em = now(),
    updated_at = now()
  WHERE id = p_candidatura_id;

  INSERT INTO public.candidaturas_status_log (
    escola_id, candidatura_id, from_status, to_status, metadata
  ) VALUES (
    p_escola_id, p_candidatura_id, v_from, v_to,
    jsonb_build_object('matricula_id', v_matricula_id) || coalesce(p_metadata, '{}'::jsonb)
  );

  PERFORM financeiro.gerar_carnet_anual(v_matricula_id);

  RETURN v_matricula_id;
END;
$$;

COMMIT;
