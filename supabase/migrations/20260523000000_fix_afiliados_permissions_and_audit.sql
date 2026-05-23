-- Fix permissions and add audit logging to affiliate system
BEGIN;

-- 1. Fix permissions for marketing_assets and marketing_leads (so affiliates can read assets and funnel can insert leads)
GRANT SELECT ON public.marketing_assets TO anon, authenticated;
GRANT INSERT ON public.marketing_leads TO anon, authenticated;
GRANT ALL ON public.marketing_leads TO authenticated;

-- 2. Enhance create_afiliado_admin with audit logging
CREATE OR REPLACE FUNCTION public.create_afiliado_admin(
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
SET search_path = public
AS $$
DECLARE
  v_nome TEXT := nullif(trim(coalesce(p_nome, '')), '');
  v_codigo TEXT := upper(trim(coalesce(p_codigo, '')));
  v_email TEXT := lower(trim(coalesce(p_email, '')));
  v_pin TEXT := trim(coalesce(p_pin, ''));
  v_new_id UUID;
BEGIN
  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'forbidden'
      USING ERRCODE = '42501';
  END IF;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'invalid_nome'
      USING ERRCODE = '22023';
  END IF;

  IF v_codigo = '' THEN
    RAISE EXCEPTION 'invalid_codigo'
      USING ERRCODE = '22023';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'invalid_email'
      USING ERRCODE = '22023';
  END IF;

  IF v_pin = '' OR length(v_pin) < 4 THEN
    RAISE EXCEPTION 'invalid_pin'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.afiliados (
    nome,
    codigo,
    email,
    pin_hash
  )
  VALUES (
    v_nome,
    v_codigo,
    v_email,
    crypt(v_pin, gen_salt('bf'))
  )
  RETURNING afiliados.id INTO v_new_id;

  -- Log do evento
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
    'AFILIADO_CRIADO',
    'afiliado',
    v_new_id::text,
    jsonb_build_object(
      'nome', v_nome,
      'codigo', v_codigo,
      'email', v_email
    )
  );

  RETURN QUERY
  SELECT
    a.id,
    a.codigo,
    a.nome,
    a.email,
    a.ativo,
    a.created_at
  FROM public.afiliados a
  WHERE a.id = v_new_id;
END;
$$;

-- 3. Enhance toggle_afiliado_admin with audit logging
CREATE OR REPLACE FUNCTION public.toggle_afiliado_admin(
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
DECLARE
  v_codigo TEXT;
BEGIN
  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'forbidden'
      USING ERRCODE = '42501';
  END IF;

  SELECT codigo INTO v_codigo FROM public.afiliados WHERE id = p_id;

  -- Log do evento
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
    CASE WHEN p_ativo THEN 'AFILIADO_ATIVADO' ELSE 'AFILIADO_DESATIVADO' END,
    'afiliado',
    p_id::text,
    jsonb_build_object('codigo', v_codigo)
  );

  RETURN QUERY
  UPDATE public.afiliados
  SET
    ativo = p_ativo,
    updated_at = now()
  WHERE afiliados.id = p_id
  RETURNING
    afiliados.id,
    afiliados.codigo,
    afiliados.nome,
    afiliados.email,
    afiliados.ativo,
    afiliados.created_at;
END;
$$;

COMMIT;
