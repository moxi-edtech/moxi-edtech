-- Synthetic schema for Curtume HIST_FINAL mirror. Run only in disposable PG.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.escola_users(escola_id uuid NOT NULL,user_id uuid NOT NULL,papel text NOT NULL);
CREATE FUNCTION public.safe_auth_uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT auth.uid() $$;
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','public'
AS $$ SELECT escola_id FROM public.escola_users WHERE user_id=auth.uid() LIMIT 1 $$;

CREATE TABLE public.anos_letivos(id uuid PRIMARY KEY,escola_id uuid,ano int,ativo boolean);
CREATE TABLE public.classes(id uuid PRIMARY KEY,escola_id uuid,numero integer);
CREATE TABLE public.turmas(id uuid PRIMARY KEY,escola_id uuid,classe_id uuid,
 session_id uuid,ano_letivo integer,status_fecho text);
CREATE TABLE public.matriculas(id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,
 turma_id uuid,session_id uuid,ano_letivo integer,status text,ativo boolean,
 status_fecho_origem text);
CREATE TABLE public.historico_anos(
 id uuid PRIMARY KEY,escola_id uuid,matricula_id uuid,aluno_id uuid,
 ano_letivo integer,ano_letivo_id uuid,turma_id uuid,resultado_final text,snapshot_status text);
CREATE TABLE public.historico_disciplinas(
 id uuid PRIMARY KEY,historico_ano_id uuid,disciplina_id uuid,
 nota_final numeric,notas_detalhe jsonb);
CREATE TABLE public.historico_snapshot_locks(
 escola_id uuid,historico_ano_id uuid,matricula_id uuid,ano_letivo_id uuid,status text);
CREATE TABLE public.curso_matriz(id uuid PRIMARY KEY,escola_id uuid,disciplina_id uuid);
CREATE TABLE public.turma_disciplinas(id uuid PRIMARY KEY,escola_id uuid,turma_id uuid,curso_matriz_id uuid);
CREATE TABLE public.periodos_letivos(id uuid PRIMARY KEY,escola_id uuid,ano_letivo_id uuid,
 tipo text,numero integer,offering_id uuid);
CREATE TABLE public.avaliacoes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid,turma_disciplina_id uuid,
 periodo_letivo_id uuid,ano_letivo integer,trimestre smallint,nome text,tipo text,
 peso numeric,nota_max numeric,
 UNIQUE(escola_id,turma_disciplina_id,ano_letivo,trimestre,tipo));
CREATE TABLE public.notas(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid,avaliacao_id uuid,
 matricula_id uuid,valor numeric,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_by uuid,UNIQUE(escola_id,matricula_id,avaliacao_id));
CREATE TABLE public.audit_logs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 escola_id uuid,actor_id uuid,action text,entity text,entity_id text,
 portal text,details jsonb);
CREATE TABLE public.outbox_events(
 escola_id uuid, event_type text,nota_id uuid);

-- Fixture guards reject late writes unless the reviewable real migration
-- inserts its exact signed source exemption.
CREATE FUNCTION public.block_notas_after_lock_date() RETURNS trigger LANGUAGE plpgsql
AS $f$
BEGIN
  RAISE EXCEPTION 'PERIOD_LOCK';
  RETURN NEW;
END;
$f$;
CREATE FUNCTION public.guard_grade_period_source_and_window() RETURNS trigger LANGUAGE plpgsql
AS $f$
BEGIN
  RAISE EXCEPTION 'GRADE_PERIOD_LOCK';
  RETURN NEW;
END;
$f$;
CREATE FUNCTION public.guard_notas_when_turma_fechada() RETURNS trigger LANGUAGE plpgsql
AS $f$
BEGIN
  RAISE EXCEPTION 'TURMA_LOCK';
  RETURN NEW;
END;
$f$;
CREATE FUNCTION public.guard_avaliacoes_when_turma_fechada() RETURNS trigger LANGUAGE plpgsql
AS $f$
BEGIN
  RAISE EXCEPTION 'TURMA_ASSESSMENT_LOCK';
  RETURN NEW;
END;
$f$;
CREATE FUNCTION public.trigger_nota_outbox() RETURNS trigger LANGUAGE plpgsql
AS $f$
BEGIN
  INSERT INTO public.outbox_events(escola_id,event_type,nota_id)
  VALUES(NEW.escola_id,'nota_lancada',NEW.id);
  RETURN NEW;
END;
$f$;
CREATE FUNCTION public.curtume_2025_notas_conferidas_validas(uuid,uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;

-- Mimic the production ratified branch's exact expression to ensure
-- the migration can patch and retain its legal decision.
CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula(
 p_escola_id uuid,p_matricula_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE
AS $f$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.matriculas m
    JOIN public.historico_anos h ON h.matricula_id=m.id AND h.escola_id=m.escola_id
    WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id AND h.snapshot_status='fechado'
      AND (NOT EXISTS (
        SELECT 1 FROM public.notas n
        WHERE n.escola_id=p_escola_id AND n.matricula_id=m.id
      ) OR public.curtume_2025_notas_conferidas_validas(p_escola_id,m.id))
  ) THEN
    RETURN '{"decision":"transitou","destino":"proxima_etapa"}'::jsonb;
  END IF;
  RETURN '{"decision":"pendente","destino":"aguardar_dados"}'::jsonb;
END;
$f$;

CREATE TRIGGER grade_date_guard BEFORE INSERT OR UPDATE ON public.notas
FOR EACH ROW EXECUTE FUNCTION public.block_notas_after_lock_date();
CREATE TRIGGER grade_year_guard BEFORE INSERT OR UPDATE ON public.notas
FOR EACH ROW EXECUTE FUNCTION public.guard_grade_period_source_and_window();
CREATE TRIGGER grade_turma_guard BEFORE INSERT OR UPDATE ON public.notas
FOR EACH ROW EXECUTE FUNCTION public.guard_notas_when_turma_fechada();
CREATE TRIGGER grade_notification AFTER INSERT ON public.notas
FOR EACH ROW EXECUTE FUNCTION public.trigger_nota_outbox();
CREATE TRIGGER grade_assessment_guard BEFORE INSERT OR UPDATE ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.guard_avaliacoes_when_turma_fechada();

-- Minimal authentic-looking, synthetic Curtume annual historical source.
INSERT INTO public.escola_users VALUES
 ('3744879f-2e19-4671-8995-78604302d8c5',
  '10000000-0000-4000-8000-000000000001','admin_financeiro'),
 ('20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002','diretor');
INSERT INTO public.anos_letivos VALUES
 ('30000000-0000-4000-8000-000000000001','3744879f-2e19-4671-8995-78604302d8c5',2025,false);
INSERT INTO public.classes VALUES
 ('40000000-0000-4000-8000-000000000001','3744879f-2e19-4671-8995-78604302d8c5',3);
INSERT INTO public.turmas VALUES
 ('50000000-0000-4000-8000-000000000001','3744879f-2e19-4671-8995-78604302d8c5',
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',2025,'FECHADO');
INSERT INTO public.matriculas VALUES
 ('60000000-0000-4000-8000-000000000001','3744879f-2e19-4671-8995-78604302d8c5',
  '70000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',2025,
  'concluido',false,'override_admin');
INSERT INTO public.historico_anos VALUES
 ('80000000-0000-4000-8000-000000000001',
  '3744879f-2e19-4671-8995-78604302d8c5',
  '60000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',2025,
  '30000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001','aprovado','fechado');
INSERT INTO public.historico_snapshot_locks VALUES
 ('3744879f-2e19-4671-8995-78604302d8c5',
  '80000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001','fechado');
INSERT INTO public.curso_matriz VALUES
 ('90000000-0000-4000-8000-000000000001',
  '3744879f-2e19-4671-8995-78604302d8c5',
  'a0000000-0000-4000-8000-000000000001');
INSERT INTO public.turma_disciplinas VALUES
 ('b0000000-0000-4000-8000-000000000001',
  '3744879f-2e19-4671-8995-78604302d8c5',
  '50000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001');
INSERT INTO public.periodos_letivos VALUES
 ('c0000000-0000-4000-8000-000000000001',
  '3744879f-2e19-4671-8995-78604302d8c5',
  '30000000-0000-4000-8000-000000000001','TRIMESTRE',3,NULL);
INSERT INTO public.historico_disciplinas VALUES
 ('d0000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',10,
  '{"ano_letivo":"2025","arquivo":"MAPA FINAL 2025-26.xlsx","aba":"3A","linha":"5","tipo_nota":"MFD"}');

GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
