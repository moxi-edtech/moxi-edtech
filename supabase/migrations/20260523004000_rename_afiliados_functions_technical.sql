-- Technical Refactor: Rename Afiliado functions and provide aliases for compatibility
BEGIN;

-- 1. get_influencer_portal (alias for get_afiliado_portal)
CREATE OR REPLACE FUNCTION public.get_influencer_portal(p_codigo text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN public.get_afiliado_portal(p_codigo, p_pin);
END;
$$;

-- 2. list_influencers_admin (alias for list_afiliados_admin)
CREATE OR REPLACE FUNCTION public.list_influencers_admin()
RETURNS TABLE (
  id UUID,
  codigo TEXT,
  nome TEXT,
  email TEXT,
  ativo BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id, a.codigo, a.nome, a.email, a.ativo, a.created_at
  FROM public.afiliados a
  ORDER BY a.created_at DESC;
END;
$$;

-- 3. create_influencer_admin (alias for create_afiliado_admin)
CREATE OR REPLACE FUNCTION public.create_influencer_admin(
  p_nome TEXT,
  p_codigo TEXT,
  p_email TEXT,
  p_pin TEXT
)
RETURNS TABLE (
  id UUID,
  codigo TEXT,
  nome TEXT,
  email TEXT,
  ativo BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.create_afiliado_admin(p_nome, p_codigo, p_email, p_pin);
END;
$$;

-- 4. toggle_influencer_admin (alias for toggle_afiliado_admin)
CREATE OR REPLACE FUNCTION public.toggle_influencer_admin(
  p_id UUID,
  p_ativo BOOLEAN
)
RETURNS TABLE (
  id UUID,
  codigo TEXT,
  nome TEXT,
  email TEXT,
  ativo BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.toggle_afiliado_admin(p_id, p_ativo);
END;
$$;

-- Grant permissions to new functions
GRANT EXECUTE ON FUNCTION public.get_influencer_portal(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_influencers_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_influencer_admin(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_influencer_admin(UUID, BOOLEAN) TO authenticated;

COMMIT;
