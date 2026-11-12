-- Disposable synthetic school only. No production data or credentials.
\ir staff_permissions_fixture.sql
CREATE TABLE public.anos_letivos(id uuid PRIMARY KEY,escola_id uuid,ano int,ativo boolean);
ALTER TABLE public.matriculas ADD COLUMN origem_transicao_matricula_id uuid;
ALTER TABLE public.turmas ADD COLUMN escola_id uuid, ADD COLUMN curso_id uuid, ADD COLUMN classe_id uuid;
CREATE TABLE public.mensalidades(id uuid DEFAULT gen_random_uuid(),escola_id uuid,matricula_id uuid,status text,valor_previsto numeric,valor numeric,valor_pago_total numeric,data_vencimento date);
CREATE TABLE public.configuracoes_escola(escola_id uuid,avaliacao_config jsonb,modelo_avaliacao text);
CREATE TABLE public.modelos_avaliacao(id uuid PRIMARY KEY,escola_id uuid,curso_id uuid,nome text,componentes jsonb,formula jsonb,tipo text,regras jsonb,is_default boolean,updated_at timestamptz);
CREATE TABLE public.curso_matriz(id uuid PRIMARY KEY,escola_id uuid,curso_id uuid,classe_id uuid,disciplina_id uuid,ativo boolean,avaliacao_mode text,avaliacao_modelo_id uuid,avaliacao_disciplina_id uuid);
CREATE TABLE public.turma_disciplinas(id uuid PRIMARY KEY,escola_id uuid,turma_id uuid,curso_matriz_id uuid,periodos_ativos integer[]);
CREATE TABLE public.avaliacoes(id uuid PRIMARY KEY,escola_id uuid,turma_disciplina_id uuid,trimestre integer,tipo text);
ALTER TABLE public.notas ADD COLUMN avaliacao_id uuid, ADD COLUMN valor numeric, ADD COLUMN is_isento boolean DEFAULT false;
\ir ../../../migrations/20271112040000_balcao_retificacao_classe_sem_progressao.sql
\ir ../../../migrations/20271112050000_balcao_percurso_academico.sql
-- Live linking trigger, absent from the minimal historical fixture.
CREATE FUNCTION public.fixture_percurso_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.matricula_id='60000000-0000-4000-8000-000000000093' AND current_setting('fixture.fail',true)='on' THEN RAISE EXCEPTION 'synthetic_snapshot_failure'; END IF;
 IF NEW.status='fechado' THEN SELECT id INTO NEW.historico_ano_id FROM public.historico_anos
 WHERE escola_id=NEW.escola_id AND matricula_id=NEW.matricula_id AND ano_letivo_id=NEW.ano_letivo_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixture_percurso_link BEFORE INSERT OR UPDATE ON public.historico_snapshot_locks FOR EACH ROW EXECUTE FUNCTION public.fixture_percurso_link();

CREATE FUNCTION public.check_super_admin_role() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
\ir ../../../migrations/20271112060000_balcao_secretaria_role_aliases.sql
