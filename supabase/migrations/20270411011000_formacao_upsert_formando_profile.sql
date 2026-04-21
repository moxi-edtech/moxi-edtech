BEGIN;

CREATE OR REPLACE FUNCTION public.formacao_upsert_formando_profile(
  p_escola_id uuid,
  p_user_id uuid,
  p_nome text,
  p_email text DEFAULT NULL,
  p_bi_numero text DEFAULT NULL,
  p_telefone text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.profiles%ROWTYPE;
  v_normalized_bi text;
  v_conflict_user uuid;
BEGIN
  IF p_escola_id IS NULL OR p_user_id IS NULL OR nullif(btrim(coalesce(p_nome, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_access_formacao_backoffice(p_escola_id) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar perfil de formando' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  FOR UPDATE;

  IF FOUND AND v_existing.escola_id IS NOT NULL AND v_existing.escola_id <> p_escola_id THEN
    RAISE EXCEPTION 'PROFILE_OWNED_BY_OTHER_SCHOOL' USING ERRCODE = 'P0001';
  END IF;

  v_normalized_bi := nullif(
    regexp_replace(upper(coalesce(p_bi_numero, '')), '[^A-Z0-9]', '', 'g'),
    ''
  );

  IF v_normalized_bi IS NOT NULL THEN
    SELECT p.user_id
    INTO v_conflict_user
    FROM public.profiles p
    WHERE p.escola_id = p_escola_id
      AND p.user_id <> p_user_id
      AND regexp_replace(upper(coalesce(p.bi_numero, '')), '[^A-Z0-9]', '', 'g') = v_normalized_bi
    LIMIT 1;

    IF v_conflict_user IS NOT NULL THEN
      RAISE EXCEPTION 'BI_ALREADY_EXISTS' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.profiles (
    user_id,
    escola_id,
    nome,
    email,
    role,
    bi_numero,
    telefone,
    updated_at
  )
  VALUES (
    p_user_id,
    p_escola_id,
    btrim(p_nome),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    'formando'::public.user_role,
    nullif(btrim(coalesce(p_bi_numero, '')), ''),
    nullif(btrim(coalesce(p_telefone, '')), ''),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    escola_id = EXCLUDED.escola_id,
    nome = coalesce(nullif(btrim(EXCLUDED.nome), ''), public.profiles.nome),
    email = coalesce(nullif(lower(btrim(coalesce(EXCLUDED.email, ''))), ''), public.profiles.email),
    role = 'formando'::public.user_role,
    bi_numero = coalesce(nullif(btrim(coalesce(EXCLUDED.bi_numero, '')), ''), public.profiles.bi_numero),
    telefone = coalesce(nullif(btrim(coalesce(EXCLUDED.telefone, '')), ''), public.profiles.telefone),
    updated_at = now()
  RETURNING *
  INTO v_existing;

  RETURN v_existing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.formacao_upsert_formando_profile(
  uuid, uuid, text, text, text, text
) TO authenticated;

COMMIT;
