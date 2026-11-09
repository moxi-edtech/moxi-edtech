-- Isolated synthetic PostgreSQL fixture. NEVER apply to customer data.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.escola_users(escola_id uuid,user_id uuid,papel text);
CREATE FUNCTION public.safe_auth_uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT auth.uid()$$;
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','public' AS $$
 SELECT escola_id FROM public.escola_users WHERE user_id=auth.uid() LIMIT 1
$$;
CREATE FUNCTION public.user_has_role_in_school(p_escola_id uuid,p_roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','public' AS $$
 SELECT EXISTS(SELECT 1 FROM public.escola_users
  WHERE escola_id=p_escola_id AND user_id=auth.uid()
    AND (papel=ANY(p_roles) OR (papel='admin_financeiro' AND 'admin'=ANY(p_roles))))
$$;
CREATE TABLE public.anos_letivos(id uuid PRIMARY KEY,escola_id uuid,ano int,ativo boolean);
CREATE TABLE public.turmas(id uuid PRIMARY KEY,escola_id uuid,session_id uuid,ano_letivo int,
 status_fecho text,regime jsonb);
CREATE FUNCTION public.resolve_regime_academico(p_turma_id uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$SELECT regime FROM public.turmas WHERE id=p_turma_id$$;
CREATE TABLE public.matriculas(id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,turma_id uuid,
 session_id uuid,ano_letivo int,status text,ativo boolean,status_fecho_origem text,
 created_at timestamptz DEFAULT now());
CREATE TABLE public.historico_anos(id uuid PRIMARY KEY,escola_id uuid,matricula_id uuid,resultado_final text);
CREATE TABLE public.curso_matriz(id uuid PRIMARY KEY,escola_id uuid,disciplina_id uuid);
CREATE TABLE public.turma_disciplinas(id uuid PRIMARY KEY,escola_id uuid,turma_id uuid,
 curso_matriz_id uuid,professor_id uuid,periodos_ativos int[]);
CREATE TABLE public.periodos_letivos(id uuid PRIMARY KEY,escola_id uuid,ano_letivo_id uuid,
 tipo text,numero int,data_inicio date,data_fim date,trava_notas_em timestamptz,
 offering_id uuid,source_template_id uuid,source_item_id uuid);
CREATE TABLE public.calendario_templates(id uuid PRIMARY KEY,is_oficial boolean,
 estado text,ano_base int);
CREATE TABLE public.calendario_template_items(id uuid PRIMARY KEY,template_id uuid,
 numero int,tipo text,data_inicio date,data_fim date);
CREATE TABLE public.avaliacoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid,
 turma_disciplina_id uuid,periodo_letivo_id uuid,ano_letivo int,trimestre int,
 nome text,tipo text,peso numeric,nota_max numeric,
 UNIQUE(escola_id,turma_disciplina_id,ano_letivo,trimestre,tipo));
CREATE TABLE public.notas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid,
 avaliacao_id uuid,matricula_id uuid,valor numeric,is_isento boolean,
 updated_at timestamptz DEFAULT now(),
 UNIQUE(escola_id,matricula_id,avaliacao_id));
CREATE TABLE public.rematricula_janelas(id uuid PRIMARY KEY,escola_id uuid,
 ano_letivo int,ativa boolean,data_inicio timestamptz,data_fim timestamptz);
CREATE TABLE public.audit_logs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 escola_id uuid,actor_id uuid,action text,entity text,entity_id text,
 portal text,details jsonb);
CREATE FUNCTION public.can_bypass_pauta_lock(uuid,uuid,uuid,uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
CREATE TABLE public.professores(id uuid,profile_id uuid,escola_id uuid);
CREATE TABLE public.turma_disciplinas_professores(escola_id uuid,turma_id uuid,disciplina_id uuid,professor_id uuid);

\ir ../../../migrations/20271109015000_balcao_rematricula_fora_prazo_individual.sql
\ir ../../../migrations/20271109020000_rematricula_preserva_origem_legal_fechada.sql
\ir ../../../migrations/20271109030000_balcao_notas_historicas_individuais.sql

GRANT SELECT ON public.notas,public.anos_letivos,public.rematricula_janelas TO authenticated;
CREATE TRIGGER grade_year_guard BEFORE INSERT OR UPDATE ON public.notas FOR EACH ROW
 EXECUTE FUNCTION public.guard_grade_period_source_and_window();
CREATE TRIGGER grade_date_guard BEFORE INSERT OR UPDATE ON public.notas FOR EACH ROW
 EXECUTE FUNCTION public.block_notas_after_lock_date();
CREATE TRIGGER grade_turma_guard BEFORE INSERT OR UPDATE ON public.notas FOR EACH ROW
 EXECUTE FUNCTION public.guard_notas_when_turma_fechada();
CREATE TRIGGER evaluation_turma_guard BEFORE INSERT OR UPDATE ON public.avaliacoes FOR EACH ROW
 EXECUTE FUNCTION public.guard_avaliacoes_when_turma_fechada();

INSERT INTO public.escola_users(escola_id,user_id,papel) VALUES
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','secretaria'),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','admin_financeiro'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','diretor');
INSERT INTO public.anos_letivos VALUES
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',2025,false),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',2026,true);
INSERT INTO public.turmas VALUES
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',2025,'ABERTO',
 '{"escala":"quantitativa_secundario","nivel_ensino":"secundario"}');
INSERT INTO public.matriculas VALUES
('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',2025,'pendente',false,'manual',now());
INSERT INTO public.curso_matriz VALUES
('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000001');
INSERT INTO public.turma_disciplinas VALUES
('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
 NULL,ARRAY[1,2,3]);
INSERT INTO public.periodos_letivos(id,escola_id,ano_letivo_id,tipo,numero,
 data_inicio,data_fim,trava_notas_em,offering_id) VALUES
('a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001','TRIMESTRE',1,'2025-09-02','2025-12-31',
 '2026-01-01 00:00+00',NULL);
INSERT INTO public.rematricula_janelas VALUES
('b0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 2026,true,'2026-07-01 00:00+00','2026-09-06 22:30+00');

-- Synthetic end-to-end late renewal writer dependencies. The actual
-- production finalizar_rematricula_balcao function is not mocked.
ALTER TABLE public.turmas ADD COLUMN capacidade_maxima integer;
ALTER TABLE public.turmas ADD COLUMN classe_id uuid;
ALTER TABLE public.turmas ADD COLUMN curso_id uuid;
ALTER TABLE public.matriculas ADD COLUMN numero_matricula bigint;
ALTER TABLE public.matriculas ADD COLUMN data_matricula date;
ALTER TABLE public.matriculas ADD COLUMN data_inicio_financeiro date;
ALTER TABLE public.matriculas ADD COLUMN origem_transicao_matricula_id uuid;
ALTER TABLE public.matriculas ADD COLUMN motivo_fecho text;
ALTER TABLE public.matriculas ADD COLUMN data_fecho timestamptz;
ALTER TABLE public.matriculas ADD COLUMN updated_at timestamptz;
CREATE TABLE public.classes(id uuid PRIMARY KEY,numero int,nome text);
CREATE TABLE public.servico_pedidos(
 id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,servico_codigo text,
 status text,matricula_id uuid,contexto jsonb);
CREATE FUNCTION public.canonicalize_matricula_status_text(p text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT p $$;
CREATE FUNCTION public.resolve_raa_progression_for_matricula(uuid,uuid)
 RETURNS jsonb LANGUAGE sql STABLE
 AS $$ SELECT '{"decision":"transitou","destino":"proxima_etapa","efetivacao_matricula_bloqueada":false}'::jsonb $$;
CREATE FUNCTION public.confirmar_matricula_core(uuid,int,uuid,uuid)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','public'
 AS $$
 BEGIN
  UPDATE public.matriculas SET numero_matricula=2026001 WHERE id=$4;
  RETURN 2026001;
 END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
INSERT INTO public.classes VALUES
('c0000000-0000-4000-8000-000000000001',7,'7ª classe'),
('c0000000-0000-4000-8000-000000000002',8,'8ª classe');
UPDATE public.turmas SET capacidade_maxima=35,
 classe_id='c0000000-0000-4000-8000-000000000001',
 curso_id='d0000000-0000-4000-8000-000000000001'
WHERE id='40000000-0000-4000-8000-000000000001';
INSERT INTO public.turmas(id,escola_id,session_id,ano_letivo,status_fecho,regime,
 capacidade_maxima,classe_id,curso_id) VALUES
('40000000-0000-4000-8000-000000000002',
 '20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002',
 2026,'ABERTO','{}',35,
 'c0000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000001');
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,
 status,ativo,status_fecho_origem,created_at) VALUES
('60000000-0000-4000-8000-000000000002',
 '20000000-0000-4000-8000-000000000001',
 '50000000-0000-4000-8000-000000000002',
 '40000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',
 2025,'concluido',false,'override_admin',now()-interval '1 year');
INSERT INTO public.servico_pedidos VALUES(
 'e0000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000001',
 '50000000-0000-4000-8000-000000000002',
 'SERV_REMATRICULA','pending_payment',NULL,'{}');
