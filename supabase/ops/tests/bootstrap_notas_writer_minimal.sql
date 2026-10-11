CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END;
$$;

CREATE TABLE public.escola_users (
  escola_id uuid NOT NULL,
  user_id uuid NOT NULL,
  papel text,
  PRIMARY KEY (escola_id, user_id)
);

CREATE TABLE public.professores (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  profile_id uuid NOT NULL
);

CREATE TABLE public.anos_letivos (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  ano integer NOT NULL,
  ativo boolean NOT NULL DEFAULT false
);

CREATE TABLE public.periodos_letivos (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  ano_letivo_id uuid NOT NULL,
  tipo text NOT NULL,
  numero integer NOT NULL,
  trava_notas_em timestamptz
);

CREATE TABLE public.turmas (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  session_id uuid,
  ano_letivo integer NOT NULL,
  status_fecho text DEFAULT 'ABERTO',
  nivel_ensino text
);

CREATE TABLE public.disciplinas_catalogo (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  nome text
);

CREATE TABLE public.curso_matriz (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  disciplina_id uuid NOT NULL
);

CREATE TABLE public.turma_disciplinas (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  curso_matriz_id uuid NOT NULL,
  professor_id uuid
);

CREATE TABLE public.turma_disciplinas_professores (
  escola_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  disciplina_id uuid NOT NULL,
  professor_id uuid NOT NULL
);

CREATE TABLE public.alunos (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  nome text
);

CREATE TABLE public.matriculas (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  session_id uuid,
  ano_letivo integer,
  status text,
  ativo boolean NOT NULL DEFAULT false
);

CREATE TABLE public.avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  turma_disciplina_id uuid NOT NULL,
  periodo_letivo_id uuid,
  ano_letivo integer NOT NULL,
  trimestre integer NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL,
  peso numeric,
  nota_max numeric(6,2) NOT NULL DEFAULT 20,
  UNIQUE (escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo)
);

CREATE TABLE public.notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  avaliacao_id uuid NOT NULL,
  matricula_id uuid NOT NULL,
  valor numeric,
  is_isento boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escola_id, matricula_id, avaliacao_id)
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  actor_id uuid,
  action text,
  entity text,
  entity_id text,
  portal text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.safe_auth_uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_claims jsonb := '{}'::jsonb;
BEGIN
  BEGIN
    v_claims := COALESCE(NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_claims := '{}'::jsonb;
  END;
  BEGIN
    RETURN NULLIF(v_claims->>'sub', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
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
BEGIN
  BEGIN
    v_claims := COALESCE(NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_claims := '{}'::jsonb;
  END;
  BEGIN
    RETURN NULLIF(v_claims->>'escola_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_role_in_school(p_escola_id uuid, p_roles text[])
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
      AND lower(COALESCE(eu.papel, '')) = ANY (
        ARRAY(SELECT lower(trim(role_name)) FROM unnest(COALESCE(p_roles, ARRAY[]::text[])) role_name)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_regime_academico(p_turma_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'escala',
    CASE
      WHEN lower(COALESCE(t.nivel_ensino, '')) = 'primario' THEN 'quantitativa_primario'
      ELSE 'quantitativa_secundario'
    END
  )
  FROM public.turmas t
  WHERE t.id = p_turma_id;
$$;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
