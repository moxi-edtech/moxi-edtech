BEGIN;

ALTER TABLE public.afiliados
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_afiliados_email_lower
  ON public.afiliados (lower(email))
  WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.list_afiliados_admin()
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
    RAISE EXCEPTION 'forbidden'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.codigo,
    a.nome,
    a.email,
    a.ativo,
    a.created_at
  FROM public.afiliados a
  ORDER BY a.created_at DESC, a.id DESC;
END;
$$;

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

  RETURN QUERY
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
  RETURNING
    afiliados.id,
    afiliados.codigo,
    afiliados.nome,
    afiliados.email,
    afiliados.ativo,
    afiliados.created_at;
END;
$$;

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
BEGIN
  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'forbidden'
      USING ERRCODE = '42501';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.list_afiliados_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_afiliado_admin(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_afiliado_admin(UUID, BOOLEAN) TO authenticated;

COMMIT;
