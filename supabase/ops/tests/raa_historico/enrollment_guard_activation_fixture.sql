-- Isolated PostgreSQL 17 fixture: synthetic RAA decisions to exercise trigger control flow.
-- Never execute this fixture against a KLASSE database.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
DO $role$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $role$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('fixture.tenant_id', true),'')::uuid $$;
CREATE FUNCTION public.canonicalize_matricula_status_text(text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT lower(btrim($1)) $$;
CREATE TABLE public.turmas(
 id uuid PRIMARY KEY, escola_id uuid NOT NULL, curso_id uuid NOT NULL,
 classe_id uuid NOT NULL, ano_letivo integer NOT NULL, session_id uuid NOT NULL,
 classe_num integer
);
CREATE FUNCTION public.turma_classe_numero(uuid) RETURNS integer
LANGUAGE sql STABLE AS $$ SELECT classe_num FROM public.turmas WHERE id=$1 $$;
CREATE TABLE public.matriculas(
 id uuid PRIMARY KEY, escola_id uuid NOT NULL, aluno_id uuid NOT NULL,
 turma_id uuid, session_id uuid, ano_letivo integer, status text,
 ativo boolean, origem_transicao_matricula_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), observacao text
);
CREATE TABLE public.balcao_pauta_turma_correction_nonce(
 escola_id uuid, matricula_id uuid, actor_id uuid,
 turma_origem_id uuid, turma_destino_id uuid
);
CREATE TABLE public.fixture_raa_decision(
 escola_id uuid NOT NULL, matricula_id uuid PRIMARY KEY, resultado jsonb NOT NULL
);
CREATE FUNCTION public.resolve_raa_progression_for_matricula(uuid,uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $raa$
 SELECT COALESCE(
   (SELECT resultado FROM public.fixture_raa_decision
      WHERE escola_id=$1 AND matricula_id=$2),
   '{"decision":"pendente","destino":"aguardar_dados"}'::jsonb
 )
$raa$;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_escola_id(),public.canonicalize_matricula_status_text(text),public.turma_classe_numero(uuid),public.resolve_raa_progression_for_matricula(uuid,uuid) TO authenticated;
GRANT ALL ON public.turmas,public.matriculas,public.fixture_raa_decision,public.balcao_pauta_turma_correction_nonce TO authenticated;
-- End of synthetic-only schema; the candidate migration installs the real trigger below.
