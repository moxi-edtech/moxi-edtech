BEGIN;

-- =====================================================
-- 1) Perfil de empresa parceira (quarentena + verificada)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.empresas_parceiras (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nif varchar(32) UNIQUE,
  dominio_email varchar(255),
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.empresas_parceiras_dominios_verificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dominio varchar(255) NOT NULL UNIQUE,
  empresa_nome text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas_parceiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas_parceiras FORCE ROW LEVEL SECURITY;

ALTER TABLE public.empresas_parceiras_dominios_verificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas_parceiras_dominios_verificados FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.empresas_parceiras FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.empresas_parceiras TO authenticated;

REVOKE ALL ON TABLE public.empresas_parceiras_dominios_verificados FROM anon, authenticated;

DROP POLICY IF EXISTS empresas_parceiras_select_self ON public.empresas_parceiras;
CREATE POLICY empresas_parceiras_select_self
ON public.empresas_parceiras
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS empresas_parceiras_insert_self ON public.empresas_parceiras;
CREATE POLICY empresas_parceiras_insert_self
ON public.empresas_parceiras
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS empresas_parceiras_update_self ON public.empresas_parceiras;
CREATE POLICY empresas_parceiras_update_self
ON public.empresas_parceiras
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_super_admin())
WITH CHECK (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS empresas_parceiras_delete_super_admin ON public.empresas_parceiras;
CREATE POLICY empresas_parceiras_delete_super_admin
ON public.empresas_parceiras
FOR DELETE
TO authenticated
USING (public.is_super_admin());

DROP POLICY IF EXISTS empresas_parceiras_dominios_read_super_admin ON public.empresas_parceiras_dominios_verificados;
CREATE POLICY empresas_parceiras_dominios_read_super_admin
ON public.empresas_parceiras_dominios_verificados
FOR SELECT
TO authenticated
USING (public.is_super_admin());

DROP POLICY IF EXISTS empresas_parceiras_dominios_write_super_admin ON public.empresas_parceiras_dominios_verificados;
CREATE POLICY empresas_parceiras_dominios_write_super_admin
ON public.empresas_parceiras_dominios_verificados
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- =====================================================
-- 2) Helpers de verificacao de dominio
-- =====================================================
CREATE OR REPLACE FUNCTION public.normalize_email_domain(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(split_part(coalesce(p_email, ''), '@', 2)), '');
$$;

CREATE OR REPLACE FUNCTION public.is_consumer_email_domain(p_domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(lower(p_domain), '') = ANY (ARRAY[
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'icloud.com',
    'aol.com',
    'proton.me',
    'protonmail.com'
  ]);
$$;

CREATE OR REPLACE FUNCTION public.is_empresa_parceira_verified(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.empresas_parceiras ep
    WHERE ep.id = p_user_id
      AND ep.is_verified IS TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_empresa_parceira_auto_verification(
  p_email text
)
RETURNS TABLE (dominio_email text, auto_verified boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
BEGIN
  v_domain := public.normalize_email_domain(p_email);

  dominio_email := CASE
    WHEN v_domain IS NULL THEN NULL
    ELSE '@' || v_domain
  END;

  IF v_domain IS NULL OR public.is_consumer_email_domain(v_domain) THEN
    auto_verified := false;
    RETURN NEXT;
    RETURN;
  END IF;

  auto_verified := EXISTS (
    SELECT 1
    FROM public.empresas_parceiras_dominios_verificados d
    WHERE lower(d.dominio) = v_domain
      AND d.is_active IS TRUE
  );

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_empresas_parceiras_apply_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_res record;
BEGIN
  SELECT u.email
  INTO v_email
  FROM auth.users u
  WHERE u.id = NEW.id;

  SELECT *
  INTO v_res
  FROM public.resolve_empresa_parceira_auto_verification(v_email)
  LIMIT 1;

  NEW.dominio_email := v_res.dominio_email;

  IF TG_OP = 'INSERT' THEN
    IF public.is_super_admin() THEN
      NEW.is_verified := coalesce(NEW.is_verified, false) OR coalesce(v_res.auto_verified, false);
    ELSE
      NEW.is_verified := coalesce(v_res.auto_verified, false);
    END IF;
  ELSE
    IF public.is_super_admin() THEN
      NEW.is_verified := coalesce(NEW.is_verified, OLD.is_verified, false) OR coalesce(v_res.auto_verified, false);
    ELSE
      NEW.is_verified := coalesce(OLD.is_verified, false) OR coalesce(v_res.auto_verified, false);
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresas_parceiras_apply_verification ON public.empresas_parceiras;
CREATE TRIGGER trg_empresas_parceiras_apply_verification
BEFORE INSERT OR UPDATE ON public.empresas_parceiras
FOR EACH ROW
EXECUTE FUNCTION public.trg_empresas_parceiras_apply_verification();

CREATE OR REPLACE FUNCTION public.ensure_empresa_parceira_profile(
  p_nif text DEFAULT NULL
)
RETURNS public.empresas_parceiras
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.empresas_parceiras%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.empresas_parceiras (id, nif)
  VALUES (auth.uid(), nullif(btrim(coalesce(p_nif, '')), ''))
  ON CONFLICT (id)
  DO UPDATE SET
    nif = COALESCE(EXCLUDED.nif, public.empresas_parceiras.nif),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_empresa_parceira_profile(text) TO authenticated;

-- =====================================================
-- 3) Teaser: empresa pode ver candidatos anonimos sem verificar
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_talent_empresa_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fiscal_empresa_users feu WHERE feu.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.empresas_parceiras ep WHERE ep.id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.list_talent_pool_candidates(
  p_escola_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  aluno_id uuid,
  escola_id uuid,
  provincia text,
  municipio text,
  preferencia_trabalho text,
  career_headline text,
  skills_tags jsonb,
  anonymous_slug text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_talent_empresa_user() THEN
    RAISE EXCEPTION 'Acesso restrito a perfis empresariais'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.escola_id,
    a.provincia,
    a.municipio,
    a.preferencia_trabalho,
    a.career_headline,
    a.skills_tags,
    a.anonymous_slug
  FROM public.alunos a
  WHERE a.is_open_to_work IS TRUE
    AND nullif(btrim(coalesce(a.anonymous_slug, '')), '') IS NOT NULL
    AND (
      p_escola_id IS NULL
      OR a.escola_id = p_escola_id
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.fiscal_empresa_users feu
        JOIN public.fiscal_escola_bindings feb
          ON feb.empresa_id = feu.empresa_id
        WHERE feu.user_id = auth.uid()
          AND feb.escola_id = a.escola_id
          AND feb.effective_from <= current_date
          AND (feb.effective_to IS NULL OR feb.effective_to >= current_date)
      )
      OR EXISTS (
        SELECT 1
        FROM public.empresas_parceiras ep
        WHERE ep.id = auth.uid()
      )
    )
  ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 100)
  OFFSET GREATEST(coalesce(p_offset, 0), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_talent_pool_candidates(uuid, integer, integer) TO authenticated;

-- =====================================================
-- 4) Bloqueio estrategico: INSERT de match so com empresa verificada
-- =====================================================
DROP POLICY IF EXISTS talent_pool_matches_insert_empresa ON public.talent_pool_matches;
CREATE POLICY talent_pool_matches_insert_empresa
ON public.talent_pool_matches
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = auth.uid()
  AND public.is_talent_empresa_user()
  AND public.is_empresa_parceira_verified(auth.uid())
  AND status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = talent_pool_matches.aluno_id
      AND a.is_open_to_work IS TRUE
      AND nullif(btrim(coalesce(a.anonymous_slug, '')), '') IS NOT NULL
  )
  AND (
    EXISTS (
      SELECT 1
      FROM public.fiscal_empresa_users feu
      JOIN public.fiscal_escola_bindings feb
        ON feb.empresa_id = feu.empresa_id
      JOIN public.alunos a
        ON a.id = talent_pool_matches.aluno_id
      WHERE feu.user_id = auth.uid()
        AND feb.escola_id = a.escola_id
        AND feb.effective_from <= current_date
        AND (feb.effective_to IS NULL OR feb.effective_to >= current_date)
    )
    OR EXISTS (
      SELECT 1
      FROM public.empresas_parceiras ep
      WHERE ep.id = auth.uid()
    )
  )
);

COMMIT;
