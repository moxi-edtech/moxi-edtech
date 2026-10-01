-- Minimal disposable Postgres 17 contract used only by the Gracefulness Balcao
-- P0 CI. It intentionally models the authority/idempotency boundaries touched
-- by the two new migrations instead of replaying the repository's historical
-- migration chain (which has known pre-existing reset debt).
--
-- Production is NOT mutated by this harness.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid,
  id uuid PRIMARY KEY,
  email text,
  aud text,
  role text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.escolas (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  status text,
  onboarding_finalizado boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY,
  email text,
  nome text,
  role text,
  escola_id uuid,
  current_escola_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escola_users (
  escola_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text,
  papel text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (escola_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.alunos (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  nome text
);

CREATE TABLE IF NOT EXISTS public.anos_letivos (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  ano integer,
  ativo boolean DEFAULT false
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'tipo_documento'
  ) THEN
    CREATE TYPE public.tipo_documento AS ENUM (
      'recibo',
      'comprovante_matricula',
      'declaracao_frequencia',
      'declaracao_notas',
      'boletim_trimestral',
      'ficha_inscricao',
      'cartao_estudante',
      'historico',
      'certificado'
    );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.documentos_emitidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  public_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo public.tipo_documento NOT NULL,
  dados_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  hash_validacao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.documentos_emitidos TO authenticated;

CREATE OR REPLACE FUNCTION public.safe_auth_uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_sub text;
BEGIN
  v_sub := nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '');
  IF v_sub IS NULL THEN
    BEGIN
      v_sub := nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
    EXCEPTION WHEN OTHERS THEN
      v_sub := NULL;
    END;
  END IF;
  BEGIN
    RETURN v_sub::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_super_admin_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT false;
$$;

CREATE OR REPLACE FUNCTION public.user_has_role_in_school(
  p_escola_id uuid,
  p_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id
      AND eu.user_id = public.safe_auth_uid()
      AND lower(coalesce(eu.papel, '')) = ANY (
        ARRAY(
          SELECT lower(trim(role_name))
          FROM unnest(coalesce(p_roles, ARRAY[]::text[])) AS requested(role_name)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_escola_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_claims jsonb := '{}'::jsonb;
  v_uid uuid := public.safe_auth_uid();
  v_escola uuid;
BEGIN
  BEGIN
    v_claims := nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_claims := '{}'::jsonb;
  END;

  IF nullif(v_claims->>'escola_id', '') IS NOT NULL THEN
    RETURN (v_claims->>'escola_id')::uuid;
  END IF;

  SELECT coalesce(p.current_escola_id, p.escola_id)
    INTO v_escola
  FROM public.profiles p
  WHERE p.user_id = v_uid;

  IF v_escola IS NOT NULL THEN
    RETURN v_escola;
  END IF;

  SELECT eu.escola_id
    INTO v_escola
  FROM public.escola_users eu
  WHERE eu.user_id = v_uid
  ORDER BY eu.created_at NULLS FIRST
  LIMIT 1;

  RETURN v_escola;
END;
$$;

-- Needed by the BAL-GR-003 regression stub.
CREATE OR REPLACE FUNCTION public.sha256(p_input bytea)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT public.digest(p_input, 'sha256');
$$;

GRANT EXECUTE ON FUNCTION public.safe_auth_uid() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_super_admin_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_role_in_school(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_tenant_escola_id() TO authenticated, service_role;
