-- Via C (Self-service): resolução pública por slug + inscrição controlada

CREATE OR REPLACE FUNCTION public.formacao_self_service_resolve_target(
  p_escola_slug text,
  p_cohort_ref text
)
RETURNS TABLE (
  escola_id uuid,
  escola_nome text,
  escola_slug text,
  cohort_id uuid,
  cohort_codigo text,
  cohort_nome text,
  curso_nome text,
  data_inicio date,
  data_fim date,
  status text,
  vagas integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.nome,
    e.slug,
    c.id,
    c.codigo,
    c.nome,
    c.curso_nome,
    c.data_inicio,
    c.data_fim,
    c.status,
    c.vagas
  FROM public.escolas e
  JOIN public.formacao_cohorts c
    ON c.escola_id = e.id
  WHERE e.slug = btrim(lower(p_escola_slug))
    AND (c.id::text = btrim(p_cohort_ref) OR upper(c.codigo) = upper(btrim(p_cohort_ref)))
    AND c.status IN ('planeada', 'em_andamento')
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.formacao_self_service_precheck(
  p_escola_slug text,
  p_cohort_ref text,
  p_bi_numero text
)
RETURNS TABLE (
  escola_id uuid,
  cohort_id uuid,
  escola_nome text,
  cohort_nome text,
  curso_nome text,
  existing_user_id uuid,
  existing_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola_id uuid;
  v_cohort_id uuid;
  v_escola_nome text;
  v_cohort_nome text;
  v_curso_nome text;
  v_bi_norm text;
BEGIN
  SELECT
    t.escola_id,
    t.cohort_id,
    t.escola_nome,
    t.cohort_nome,
    t.curso_nome
  INTO
    v_escola_id,
    v_cohort_id,
    v_escola_nome,
    v_cohort_nome,
    v_curso_nome
  FROM public.formacao_self_service_resolve_target(p_escola_slug, p_cohort_ref) t
  LIMIT 1;

  IF v_escola_id IS NULL OR v_cohort_id IS NULL THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND';
  END IF;

  v_bi_norm := nullif(upper(regexp_replace(coalesce(p_bi_numero, ''), '[^A-Za-z0-9]', '', 'g')), '');

  RETURN QUERY
  SELECT
    v_escola_id,
    v_cohort_id,
    v_escola_nome,
    v_cohort_nome,
    v_curso_nome,
    p.user_id,
    lower(btrim(coalesce(p.email, '')))
  FROM public.profiles p
  WHERE p.escola_id = v_escola_id
    AND v_bi_norm IS NOT NULL
    AND upper(regexp_replace(coalesce(p.bi_numero, ''), '[^A-Za-z0-9]', '', 'g')) = v_bi_norm
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_escola_id,
      v_cohort_id,
      v_escola_nome,
      v_cohort_nome,
      v_curso_nome,
      null::uuid,
      null::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.formacao_self_service_create_inscricao(
  p_escola_slug text,
  p_cohort_ref text,
  p_formando_user_id uuid,
  p_nome text,
  p_email text DEFAULT NULL,
  p_bi_numero text DEFAULT NULL,
  p_telefone text DEFAULT NULL
)
RETURNS public.formacao_inscricoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target record;
  v_existing public.formacao_inscricoes%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_bi_norm text;
BEGIN
  IF p_formando_user_id IS NULL THEN
    RAISE EXCEPTION 'FORMANDO_REQUIRED';
  END IF;

  SELECT * INTO v_target
  FROM public.formacao_self_service_resolve_target(p_escola_slug, p_cohort_ref)
  LIMIT 1;

  IF v_target.cohort_id IS NULL THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND';
  END IF;

  v_bi_norm := nullif(upper(regexp_replace(coalesce(p_bi_numero, ''), '[^A-Za-z0-9]', '', 'g')), '');

  IF v_bi_norm IS NOT NULL THEN
    PERFORM 1
    FROM public.profiles p
    WHERE p.escola_id = v_target.escola_id
      AND p.user_id <> p_formando_user_id
      AND upper(regexp_replace(coalesce(p.bi_numero, ''), '[^A-Za-z0-9]', '', 'g')) = v_bi_norm;

    IF FOUND THEN
      RAISE EXCEPTION 'BI_ALREADY_EXISTS';
    END IF;
  END IF;

  INSERT INTO public.profiles (
    user_id,
    escola_id,
    current_escola_id,
    role,
    nome,
    email,
    bi_numero,
    telefone
  )
  VALUES (
    p_formando_user_id,
    v_target.escola_id,
    v_target.escola_id,
    'formando',
    nullif(btrim(coalesce(p_nome, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    nullif(btrim(coalesce(p_bi_numero, '')), ''),
    nullif(btrim(coalesce(p_telefone, '')), '')
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    escola_id = coalesce(public.profiles.escola_id, EXCLUDED.escola_id),
    current_escola_id = coalesce(public.profiles.current_escola_id, EXCLUDED.current_escola_id),
    role = coalesce(nullif(btrim(public.profiles.role), ''), EXCLUDED.role),
    nome = coalesce(nullif(btrim(EXCLUDED.nome), ''), public.profiles.nome),
    email = coalesce(nullif(lower(btrim(coalesce(EXCLUDED.email, ''))), ''), public.profiles.email),
    bi_numero = coalesce(nullif(btrim(coalesce(EXCLUDED.bi_numero, '')), ''), public.profiles.bi_numero),
    telefone = coalesce(nullif(btrim(coalesce(EXCLUDED.telefone, '')), ''), public.profiles.telefone);

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = p_formando_user_id
  LIMIT 1;

  IF v_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_RESOLVED';
  END IF;

  IF v_profile.escola_id IS NOT NULL AND v_profile.escola_id <> v_target.escola_id THEN
    RAISE EXCEPTION 'PROFILE_OWNED_BY_OTHER_SCHOOL';
  END IF;

  INSERT INTO public.formacao_inscricoes (
    escola_id,
    cohort_id,
    formando_user_id,
    origem,
    estado,
    status_pagamento,
    nome_snapshot,
    email_snapshot,
    bi_snapshot,
    telefone_snapshot
  )
  VALUES (
    v_target.escola_id,
    v_target.cohort_id,
    p_formando_user_id,
    'self_service',
    'confirmada',
    'pendente',
    nullif(btrim(coalesce(p_nome, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    nullif(btrim(coalesce(p_bi_numero, '')), ''),
    nullif(btrim(coalesce(p_telefone, '')), '')
  )
  ON CONFLICT (escola_id, cohort_id, formando_user_id)
  DO NOTHING;

  SELECT * INTO v_existing
  FROM public.formacao_inscricoes fi
  WHERE fi.escola_id = v_target.escola_id
    AND fi.cohort_id = v_target.cohort_id
    AND fi.formando_user_id = p_formando_user_id
  LIMIT 1;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'INSCRICAO_NOT_CREATED';
  END IF;

  RETURN v_existing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.formacao_self_service_resolve_target(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.formacao_self_service_precheck(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.formacao_self_service_create_inscricao(text, text, uuid, text, text, text, text) TO anon, authenticated;
