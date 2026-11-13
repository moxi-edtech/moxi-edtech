-- Disposable contract fixture; no production student or payment data.
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN
  CREATE ROLE authenticated NOLOGIN;
END IF; END $$;
CREATE SCHEMA auth;
CREATE SCHEMA financeiro;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.fixture_id(text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT md5($1)::uuid $$;
CREATE TABLE profiles(user_id uuid,escola_id uuid,current_escola_id uuid);
CREATE TABLE escola_users(user_id uuid,escola_id uuid,papel text);
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT escola_id FROM profiles WHERE user_id=auth.uid() $$;
CREATE FUNCTION public.user_has_role_in_school(uuid,text[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM escola_users WHERE escola_id=$1 AND user_id=auth.uid() AND papel=ANY($2)) $$;
CREATE FUNCTION public.canonicalize_matricula_status_text(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower($1) $$;
CREATE FUNCTION public.is_turma_classe_exame(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE anos_letivos(id uuid PRIMARY KEY,escola_id uuid,ano int,data_inicio date,data_fim date,ativo boolean,created_at timestamptz DEFAULT now());
CREATE TABLE turmas(id uuid PRIMARY KEY,escola_id uuid,curso_id uuid,classe_id uuid,ano_letivo_id uuid);
CREATE TABLE matriculas(id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,turma_id uuid,session_id uuid,ano_letivo int,status text,ativo boolean,data_inicio_financeiro date,data_matricula date,created_at timestamptz DEFAULT now(),updated_at timestamptz,origem_transicao_matricula_id uuid);
CREATE TABLE turma_janelas_cobranca(turma_id uuid,ano_letivo_id uuid,data_inicio date,data_fim date);
CREATE TABLE financeiro_tabelas(escola_id uuid,ano_letivo int,curso_id uuid,classe_id uuid,valor_mensalidade numeric,dia_vencimento int);
CREATE TABLE mensalidades(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid,aluno_id uuid,turma_id uuid,matricula_id uuid,ano_letivo text,mes_referencia int,ano_referencia int,valor numeric,valor_previsto numeric,valor_pago_total numeric,status text,data_vencimento date, UNIQUE(escola_id,matricula_id,ano_referencia,mes_referencia));
\ir ../../migrations/20261012194156_billing_retroactive_from_academic_period_start.sql
\ir ../../migrations/20270824080000_garantir_vinculo_financeiro_rematricula.sql
CREATE TRIGGER trg_validate_mensalidade_matricula_scope BEFORE INSERT OR UPDATE OF escola_id,aluno_id,turma_id,matricula_id,ano_letivo,mes_referencia,ano_referencia ON mensalidades FOR EACH ROW EXECUTE FUNCTION enforce_mensalidade_matricula_scope();
INSERT INTO profiles VALUES(fixture_id('staff'),fixture_id('school'),fixture_id('school')),(fixture_id('student'),fixture_id('school'),fixture_id('school')),(fixture_id('otherstaff'),fixture_id('otherschool'),fixture_id('otherschool'));
INSERT INTO escola_users VALUES(fixture_id('staff'),fixture_id('school'),'secretaria'),(fixture_id('student'),fixture_id('school'),'aluno'),(fixture_id('otherstaff'),fixture_id('otherschool'),'secretaria');
INSERT INTO anos_letivos VALUES(fixture_id('year'),fixture_id('school'),2026,'2026-09-01','2027-08-31',true,now());
INSERT INTO turmas VALUES(fixture_id('class'),fixture_id('school'),fixture_id('course'),fixture_id('level'),fixture_id('year'));
INSERT INTO financeiro_tabelas VALUES(fixture_id('school'),2026,fixture_id('course'),fixture_id('level'),2500,10);
INSERT INTO matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,data_matricula,origem_transicao_matricula_id) VALUES
(fixture_id('source'),fixture_id('school'),fixture_id('student'),fixture_id('oldclass'),fixture_id('oldyear'),2025,'concluido',false,'2025-09-01',null),
(fixture_id('reservation'),fixture_id('school'),fixture_id('student'),fixture_id('class'),fixture_id('year'),2026,'pendente',false,'2026-11-12',fixture_id('source'));
SELECT set_config('request.jwt.claim.sub',fixture_id('staff')::text,false);
-- Reproduce the exact pre-fix failure with the real annual writer and trigger.
DO $$ BEGIN
  PERFORM garantir_vinculo_financeiro_rematricula(fixture_id('school'),fixture_id('reservation'),fixture_id('year'));
  RAISE EXCEPTION 'Expected pending reservation to fail before migration';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Não é permitido lançar mensalidade para matrícula não activa%' THEN RAISE; END IF;
END $$;
\ir ../../migrations/20271112090000_rematricula_reserved_carnet_scope.sql
