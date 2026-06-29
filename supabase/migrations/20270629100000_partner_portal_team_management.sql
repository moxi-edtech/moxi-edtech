BEGIN;

ALTER TABLE public.afiliado_membros
  DROP CONSTRAINT IF EXISTS afiliado_membros_role_check;

ALTER TABLE public.afiliado_membros
  ADD CONSTRAINT afiliado_membros_role_check
  CHECK (role IN ('owner', 'admin', 'vendas', 'implantacao', 'suporte_l1', 'operator'));

CREATE OR REPLACE FUNCTION public.require_influencer_owner_session(
  p_session_id uuid,
  p_codigo text
)
RETURNS TABLE (
  afiliado_id uuid,
  codigo text,
  member_id uuid,
  member_name text,
  member_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session jsonb;
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);

  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    a.id AS afiliado_id,
    a.codigo,
    m.id AS member_id,
    m.nome AS member_name,
    m.role AS member_role
  FROM public.afiliados a
  JOIN public.afiliado_membros m
    ON m.afiliado_id = a.id
  WHERE a.codigo = (v_session->'session'->>'codigo')::text
    AND a.ativo = true
    AND m.id = (v_session->'session'->>'member_id')::uuid
    AND m.ativo = true
    AND m.role IN ('owner', 'admin')
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_influencer_members_by_session(
  p_session_id uuid,
  p_codigo text
)
RETURNS TABLE (
  id uuid,
  afiliado_id uuid,
  nome text,
  role text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_owner record;
BEGIN
  SELECT *
    INTO v_owner
  FROM public.require_influencer_owner_session(p_session_id, p_codigo)
  LIMIT 1;

  RETURN QUERY
  SELECT
    m.id,
    m.afiliado_id,
    m.nome,
    m.role,
    m.ativo,
    m.created_at,
    m.updated_at
  FROM public.afiliado_membros m
  WHERE m.afiliado_id = v_owner.afiliado_id
  ORDER BY m.ativo DESC, m.role = 'owner' DESC, lower(m.nome) ASC, m.id ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_influencer_member_by_session(
  p_session_id uuid,
  p_codigo text,
  p_nome text,
  p_pin text,
  p_role text DEFAULT 'vendas',
  p_ativo boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  afiliado_id uuid,
  nome text,
  role text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
DECLARE
  v_owner record;
  v_nome text := nullif(trim(coalesce(p_nome, '')), '');
  v_pin text := trim(coalesce(p_pin, ''));
  v_role text := lower(trim(coalesce(p_role, 'vendas')));
  v_member_id uuid;
BEGIN
  SELECT *
    INTO v_owner
  FROM public.require_influencer_owner_session(p_session_id, p_codigo)
  LIMIT 1;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'invalid_nome' USING ERRCODE = '22023';
  END IF;

  IF v_pin = '' OR length(v_pin) < 4 THEN
    RAISE EXCEPTION 'invalid_pin' USING ERRCODE = '22023';
  END IF;

  IF v_role NOT IN ('admin', 'vendas', 'implantacao', 'suporte_l1', 'operator') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.afiliado_membros (
    afiliado_id,
    nome,
    pin_hash,
    ativo,
    role
  )
  VALUES (
    v_owner.afiliado_id,
    v_nome,
    extensions.crypt(v_pin, extensions.gen_salt('bf')),
    coalesce(p_ativo, true),
    v_role
  )
  RETURNING afiliado_membros.id INTO v_member_id;

  INSERT INTO public.audit_logs (
    portal,
    action,
    entity,
    entity_id,
    details
  )
  VALUES (
    'influencer_portal',
    'AFILIADO_MEMBRO_CRIADO_PELO_PARCEIRO',
    'afiliado_membros',
    v_member_id::text,
    jsonb_build_object(
      'afiliado_id', v_owner.afiliado_id,
      'codigo', v_owner.codigo,
      'actor_member_id', v_owner.member_id,
      'actor_member_name', v_owner.member_name,
      'nome', v_nome,
      'role', v_role,
      'ativo', coalesce(p_ativo, true)
    )
  );

  RETURN QUERY
  SELECT
    m.id,
    m.afiliado_id,
    m.nome,
    m.role,
    m.ativo,
    m.created_at,
    m.updated_at
  FROM public.afiliado_membros m
  WHERE m.id = v_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_influencer_member_by_session(
  p_session_id uuid,
  p_codigo text,
  p_member_id uuid,
  p_nome text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL,
  p_pin text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  afiliado_id uuid,
  nome text,
  role text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
DECLARE
  v_owner record;
  v_member public.afiliado_membros%ROWTYPE;
  v_nome text := nullif(trim(coalesce(p_nome, '')), '');
  v_role text := nullif(lower(trim(coalesce(p_role, ''))), '');
  v_pin text := nullif(trim(coalesce(p_pin, '')), '');
BEGIN
  SELECT *
    INTO v_owner
  FROM public.require_influencer_owner_session(p_session_id, p_codigo)
  LIMIT 1;

  SELECT *
    INTO v_member
  FROM public.afiliado_membros
  WHERE id = p_member_id
    AND afiliado_id = v_owner.afiliado_id
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_member.role = 'owner' AND p_ativo = false THEN
    RAISE EXCEPTION 'cannot_disable_owner' USING ERRCODE = '42501';
  END IF;

  IF v_role IS NOT NULL AND v_role NOT IN ('admin', 'vendas', 'implantacao', 'suporte_l1', 'operator') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  IF v_pin IS NOT NULL AND length(v_pin) < 4 THEN
    RAISE EXCEPTION 'invalid_pin' USING ERRCODE = '22023';
  END IF;

  UPDATE public.afiliado_membros
  SET
    nome = coalesce(v_nome, nome),
    role = CASE WHEN v_member.role = 'owner' THEN role ELSE coalesce(v_role, role) END,
    ativo = coalesce(p_ativo, ativo),
    pin_hash = CASE
      WHEN v_pin IS NULL THEN pin_hash
      ELSE extensions.crypt(v_pin, extensions.gen_salt('bf'))
    END,
    updated_at = now()
  WHERE id = p_member_id
    AND afiliado_id = v_owner.afiliado_id;

  INSERT INTO public.audit_logs (
    portal,
    action,
    entity,
    entity_id,
    details
  )
  VALUES (
    'influencer_portal',
    'AFILIADO_MEMBRO_ATUALIZADO_PELO_PARCEIRO',
    'afiliado_membros',
    p_member_id::text,
    jsonb_build_object(
      'afiliado_id', v_owner.afiliado_id,
      'codigo', v_owner.codigo,
      'actor_member_id', v_owner.member_id,
      'actor_member_name', v_owner.member_name,
      'nome_changed', v_nome IS NOT NULL,
      'role', v_role,
      'ativo', p_ativo,
      'pin_reset', v_pin IS NOT NULL
    )
  );

  RETURN QUERY
  SELECT
    m.id,
    m.afiliado_id,
    m.nome,
    m.role,
    m.ativo,
    m.created_at,
    m.updated_at
  FROM public.afiliado_membros m
  WHERE m.id = p_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.require_influencer_owner_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_influencer_members_by_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_influencer_member_by_session(uuid, text, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_influencer_member_by_session(uuid, text, uuid, text, text, boolean, text) TO anon, authenticated;

COMMIT;
