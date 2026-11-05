-- Disposable PostgreSQL fixture only. Never run against a customer database.
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE storage.objects(bucket_id text,name text,metadata jsonb,UNIQUE(bucket_id,name));
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role,anon;
CREATE TABLE public.escolas(id uuid PRIMARY KEY);
CREATE TABLE public.escola_users(escola_id uuid,user_id uuid,papel text);
GRANT SELECT ON public.escola_users TO authenticated;
CREATE TABLE public.anos_letivos(id uuid PRIMARY KEY,escola_id uuid,ano int,ativo boolean,data_inicio date,data_fim date);
CREATE TABLE public.turmas(id uuid PRIMARY KEY,escola_id uuid,ano_letivo int,regime jsonb);
CREATE TABLE public.alunos(id uuid PRIMARY KEY);
CREATE TABLE public.matriculas(id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,turma_id uuid,session_id uuid,status text,ativo boolean,ano_letivo int DEFAULT 2026);
CREATE TABLE public.disciplinas_catalogo(id uuid PRIMARY KEY,nome text,escola_id uuid);
CREATE TABLE public.curso_matriz(id uuid PRIMARY KEY,escola_id uuid,classificacao text);
ALTER TABLE public.disciplinas_catalogo ADD COLUMN area text;
CREATE TABLE public.turma_disciplinas(id uuid PRIMARY KEY,escola_id uuid,turma_id uuid,avaliacao_disciplina_id uuid,curso_matriz_id uuid,classificacao text);
CREATE TABLE public.avaliacoes(id uuid PRIMARY KEY,escola_id uuid,turma_disciplina_id uuid,trimestre int);
CREATE TABLE public.periodos_letivos(id uuid PRIMARY KEY,escola_id uuid,ano_letivo_id uuid,tipo text,numero int,data_inicio date,data_fim date);
CREATE TABLE public.excecoes_pauta(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid,turma_id uuid,disciplina_id uuid,trimestre int,user_id uuid,motivo text,expira_em timestamptz,criado_por uuid,solicitado_por uuid,aprovado_por uuid,decidido_em timestamptz,ano_letivo_id uuid,status text,decisao_motivo text);
CREATE TABLE public.audit_logs(id uuid DEFAULT gen_random_uuid(),escola_id uuid,actor_id uuid,action text,entity text,entity_id text,portal text,details jsonb);
CREATE TABLE public.frequencia_status_periodo(escola_id uuid,matricula_id uuid,aulas_previstas numeric,faltas numeric,presencas numeric,periodo_letivo_id uuid);
CREATE TABLE public.raa_indisciplina_eventos(escola_id uuid,matricula_id uuid,ano_letivo_id uuid,estado text,impacta_resultado boolean);
CREATE TABLE public.pautas_oficiais(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid,turma_id uuid,periodo_letivo_id uuid,tipo text,status text,pdf_path text,hash text,generated_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),error_message text,UNIQUE(escola_id,turma_id,periodo_letivo_id,tipo));
CREATE FUNCTION public.resolve_regime_academico(p_turma_id uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT regime FROM public.turmas WHERE id=p_turma_id$$;
CREATE FUNCTION public.resolve_estado_resultado(p_matricula_id uuid,p_disciplina_id uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{"status":"aprovado","nota":15}'::jsonb$$;
CREATE FUNCTION public.resolve_raa_progression_for_matricula(p_escola_id uuid,p_matricula_id uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
CREATE FUNCTION public.immutable_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT $1$$;
GRANT SELECT ON public.matriculas,public.turmas,public.anos_letivos,public.raa_indisciplina_eventos TO authenticated;
\ir ../../../migrations/20260815150000_raa_exam_sessions_model.sql
\ir ../../../migrations/20260815210000_raa_indisciplina_result_ssot.sql
\ir ../../../migrations/20260816010000_raa_decreto_sql_ssot.sql
\ir ../../../migrations/20260816012000_raa_decreto_note_bands.sql
\ir exam_guard.sql
\ir ../../../migrations/20271105001000_balcao_academic_resolution.sql
