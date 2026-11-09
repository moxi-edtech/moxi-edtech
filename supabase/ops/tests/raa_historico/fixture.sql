-- Disposable PostgreSQL 17 fixture. Never use against production/customer data.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.escola_users(escola_id uuid,user_id uuid,papel text,
  PRIMARY KEY (escola_id,user_id));
CREATE FUNCTION public.safe_auth_uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT auth.uid() $$;
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT escola_id FROM public.escola_users WHERE user_id=auth.uid() LIMIT 1 $$;
-- Mimic the production role-expansion behavior to make exact-role regressions meaningful.
CREATE FUNCTION public.user_has_role_in_school(p_escola_id uuid,p_roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
SELECT EXISTS (
  SELECT 1 FROM public.escola_users eu
  WHERE eu.escola_id=p_escola_id AND eu.user_id=auth.uid()
    AND (eu.papel=ANY(p_roles) OR (eu.papel='admin_financeiro' AND 'admin'=ANY(p_roles)))
) $$;
CREATE FUNCTION public.canonicalize_matricula_status_text(p_status text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT p_status $$;

CREATE TABLE public.matriculas(
  id uuid PRIMARY KEY,escola_id uuid NOT NULL,aluno_id uuid NOT NULL,
  turma_id uuid,session_id uuid,ano_letivo int,status text,ativo boolean,
  status_fecho_origem text,motivo_fecho text,data_fecho timestamptz,
  updated_at timestamptz,updated_by uuid
);
CREATE TABLE public.historico_anos(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,aluno_id uuid NOT NULL,ano_letivo integer NOT NULL,
  matricula_id uuid,ano_letivo_id uuid,turma_id uuid,
  resultado_final text,status_final text,snapshot_status text NOT NULL DEFAULT 'aberto',
  data_fechamento timestamptz,
  snapshot_lock_run_id uuid,snapshot_locked_at timestamptz,
  snapshot_reopened_at timestamptz,snapshot_reopened_by uuid,snapshot_reopen_reason text,
  CONSTRAINT historico_ano_unico UNIQUE(escola_id,aluno_id,ano_letivo)
);
CREATE TABLE public.historico_snapshot_locks(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid NOT NULL,
  ano_letivo_id uuid NOT NULL,matricula_id uuid NOT NULL,historico_ano_id uuid,
  status text,lock_run_id uuid,lock_job_id uuid,lock_step text,
  lock_reason text,locked_at timestamptz,reopened_at timestamptz,
  reopened_by uuid,reopened_reason text,allow_reopen boolean,updated_at timestamptz,
  UNIQUE (escola_id,ano_letivo_id,matricula_id)
);
CREATE TABLE public.audit_logs(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escola_id uuid,actor_id uuid,action text,entity text,entity_id text,
  portal text,details jsonb
);
CREATE TABLE public.academic_transition_cohorts(
  id uuid PRIMARY KEY,escola_id uuid,ano_origem int,ano_destino int,
  modo text,ativo boolean,expira_em date
);
CREATE TABLE public.academic_transition_cohort_members(
  id uuid PRIMARY KEY,escola_id uuid,cohort_id uuid,aluno_id uuid,
  matricula_origem_id uuid,status text
);
CREATE TABLE public.promocoes_com_pendencias(
  id uuid PRIMARY KEY,escola_id uuid,matricula_origem_id uuid,
  status text,pendencias jsonb,motivo text,created_at timestamptz
);
CREATE TABLE public.notas(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escola_id uuid,matricula_id uuid);
CREATE TABLE public.turmas(id uuid PRIMARY KEY,regime jsonb);
CREATE FUNCTION public.resolve_regime_academico(p_turma_id uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT regime FROM public.turmas WHERE id=p_turma_id
$$;
CREATE FUNCTION public.resolve_raa_decreto_for_matricula(uuid,uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$ SELECT NULL::jsonb $$;
CREATE FUNCTION public.resolve_raa_progression_for_matricula_generic(uuid,uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT '{"decision":"pendente","destino":"aguardar_dados","motivo":"dados_pendentes","disciplina_ids_pendentes":[]}'::jsonb
$$;
\ir ../../../migrations/20271109010000_raa_historico_documental_ratificado.sql

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
