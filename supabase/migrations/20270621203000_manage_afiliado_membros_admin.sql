BEGIN;

REVOKE ALL ON public.afiliado_membros FROM PUBLIC;
REVOKE ALL ON public.afiliado_membros FROM anon;
REVOKE ALL ON public.afiliado_membros FROM authenticated;

GRANT SELECT ON public.afiliado_membros TO authenticated;

CREATE OR REPLACE FUNCTION public.list_afiliado_membros_admin(p_afiliado_id uuid)
RETURNS TABLE (
  id uuid,
  afiliado_id uuid,
  nome text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.afiliado_id,
    m.nome,
    m.ativo,
    m.created_at,
    m.updated_at
  FROM public.afiliado_membros m
  WHERE m.afiliado_id = p_afiliado_id
  ORDER BY m.ativo DESC, lower(m.nome) ASC, m.id ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_afiliado_membro_admin(
  p_afiliado_id uuid,
  p_nome text,
  p_pin text,
  p_ativo boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  afiliado_id uuid,
  nome text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
DECLARE
  v_nome text := nullif(trim(coalesce(p_nome, '')), '');
  v_pin text := trim(coalesce(p_pin, ''));
  v_pin_hash text;
  v_member_id uuid;
BEGIN
  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_afiliado_id IS NULL THEN
    RAISE EXCEPTION 'invalid_afiliado_id' USING ERRCODE = '22023';
  END IF;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'invalid_nome' USING ERRCODE = '22023';
  END IF;

  IF v_pin = '' OR length(v_pin) < 4 THEN
    RAISE EXCEPTION 'invalid_pin' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.afiliados a
  WHERE a.id = p_afiliado_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'afiliado_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_pin_hash := extensions.crypt(v_pin, extensions.gen_salt('bf'));

  INSERT INTO public.afiliado_membros (
    afiliado_id,
    nome,
    pin_hash,
    ativo
  )
  VALUES (
    p_afiliado_id,
    v_nome,
    v_pin_hash,
    coalesce(p_ativo, true)
  )
  RETURNING afiliado_membros.id INTO v_member_id;

  INSERT INTO public.audit_logs (
    user_id,
    portal,
    action,
    entity,
    entity_id,
    details
  )
  VALUES (
    auth.uid(),
    'super_admin',
    'AFILIADO_MEMBRO_CRIADO',
    'afiliado_membro',
    v_member_id::text,
    jsonb_build_object(
      'afiliado_id', p_afiliado_id,
      'nome', v_nome,
      'ativo', coalesce(p_ativo, true)
    )
  );

  RETURN QUERY
  SELECT
    m.id,
    m.afiliado_id,
    m.nome,
    m.ativo,
    m.created_at,
    m.updated_at
  FROM public.afiliado_membros m
  WHERE m.id = v_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_afiliado_membro_admin(
  p_member_id uuid,
  p_ativo boolean
)
RETURNS TABLE (
  id uuid,
  afiliado_id uuid,
  nome text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_afiliado_id uuid;
BEGIN
  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_member_id IS NULL THEN
    RAISE EXCEPTION 'invalid_member_id' USING ERRCODE = '22023';
  END IF;

  UPDATE public.afiliado_membros
  SET
    ativo = p_ativo,
    updated_at = now()
  WHERE id = p_member_id
  RETURNING afiliado_membros.afiliado_id INTO v_afiliado_id;

  IF v_afiliado_id IS NULL THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    portal,
    action,
    entity,
    entity_id,
    details
  )
  VALUES (
    auth.uid(),
    'super_admin',
    'AFILIADO_MEMBRO_STATUS_ALTERADO',
    'afiliado_membro',
    p_member_id::text,
    jsonb_build_object(
      'afiliado_id', v_afiliado_id,
      'ativo', p_ativo
    )
  );

  RETURN QUERY
  SELECT
    m.id,
    m.afiliado_id,
    m.nome,
    m.ativo,
    m.created_at,
    m.updated_at
  FROM public.afiliado_membros m
  WHERE m.id = p_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_influencer_members_admin(p_afiliado_id uuid)
RETURNS TABLE (
  id uuid,
  afiliado_id uuid,
  nome text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.list_afiliado_membros_admin(p_afiliado_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_influencer_member_admin(
  p_afiliado_id uuid,
  p_nome text,
  p_pin text,
  p_ativo boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  afiliado_id uuid,
  nome text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.create_afiliado_membro_admin(p_afiliado_id, p_nome, p_pin, p_ativo);
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_influencer_member_admin(
  p_member_id uuid,
  p_ativo boolean
)
RETURNS TABLE (
  id uuid,
  afiliado_id uuid,
  nome text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.toggle_afiliado_membro_admin(p_member_id, p_ativo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_afiliado_membros_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_afiliado_membro_admin(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_afiliado_membro_admin(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_influencer_members_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_influencer_member_admin(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_influencer_member_admin(uuid, boolean) TO authenticated;

COMMIT;
