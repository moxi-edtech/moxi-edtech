\set ON_ERROR_STOP on
-- Fixture exclusivamente sintética, executada num PostgreSQL 17 descartável.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.escola_id', true),'')::uuid $$;
GRANT EXECUTE ON FUNCTION public.current_tenant_escola_id() TO authenticated;

CREATE TABLE public.escolas(id uuid PRIMARY KEY);
CREATE TABLE public.cursos(id uuid PRIMARY KEY, escola_id uuid);
CREATE TABLE public.classes(id uuid PRIMARY KEY, escola_id uuid, curso_id uuid);
CREATE TABLE public.anos_letivos(id uuid PRIMARY KEY, escola_id uuid);
CREATE TABLE public.escola_users(escola_id uuid,user_id uuid,papel text);
CREATE TABLE public.disciplinas_catalogo(id uuid PRIMARY KEY,escola_id uuid,nome text);
CREATE TABLE public.curso_curriculos(id uuid PRIMARY KEY,escola_id uuid,curso_id uuid,ano_letivo_id uuid,classe_id uuid);
CREATE TABLE public.curso_matriz(id uuid PRIMARY KEY,escola_id uuid,curso_id uuid,classe_id uuid,disciplina_id uuid,curso_curriculo_id uuid);
CREATE TABLE public.notas(id uuid PRIMARY KEY,nota numeric);
GRANT SELECT ON public.escola_users TO authenticated;

INSERT INTO public.escolas VALUES
('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO public.cursos VALUES
('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000002');
INSERT INTO public.classes VALUES
('00000000-0000-4000-8000-000000001101','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001001'),
('00000000-0000-4000-8000-000000001102','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000001002');
INSERT INTO public.anos_letivos VALUES
('00000000-0000-4000-8000-000000001201','00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000001202','00000000-0000-4000-8000-000000000002');
INSERT INTO public.escola_users VALUES
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101','diretor'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000102','professor'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000103','admin_financeiro'),
('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000201','diretor');
INSERT INTO public.disciplinas_catalogo VALUES
('00000000-0000-4000-8000-000000001401','00000000-0000-4000-8000-000000000001','Educação Manual e Plástica'),
('00000000-0000-4000-8000-000000001402','00000000-0000-4000-8000-000000000001','Ed. Manual e Plástica'),
('00000000-0000-4000-8000-000000001403','00000000-0000-4000-8000-000000000002','Educação Manual e Plástica');
INSERT INTO public.curso_curriculos VALUES
('00000000-0000-4000-8000-000000001301','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000001201','00000000-0000-4000-8000-000000001101'),
('00000000-0000-4000-8000-000000001302','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000001202','00000000-0000-4000-8000-000000001102');
INSERT INTO public.curso_matriz VALUES
('00000000-0000-4000-8000-000000001701','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000001101','00000000-0000-4000-8000-000000001401','00000000-0000-4000-8000-000000001301'),
('00000000-0000-4000-8000-000000001702','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000001101','00000000-0000-4000-8000-000000001402','00000000-0000-4000-8000-000000001301'),
('00000000-0000-4000-8000-000000001703','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000001102','00000000-0000-4000-8000-000000001403','00000000-0000-4000-8000-000000001302');
INSERT INTO public.notas VALUES ('00000000-0000-4000-8000-000000009999',16);
\ir ../../migrations/20271118110000_curricular_equivalence_decisions.sql

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',false);
SELECT set_config('request.jwt.claim.escola_id','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
INSERT INTO public.disciplina_equivalencia_decisoes
(escola_id,curso_id,classe_id,ano_letivo_id,nome_normalizado,disciplina_oficial_id,candidatos_ids,motivo,decidido_por)
VALUES (
'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001001',
'00000000-0000-4000-8000-000000001101','00000000-0000-4000-8000-000000001201',
'educacao manual e plastica','00000000-0000-4000-8000-000000001401',
ARRAY['00000000-0000-4000-8000-000000001401'::uuid,'00000000-0000-4000-8000-000000001402'::uuid],
'Nome oficial confirmado pela Direção','00000000-0000-4000-8000-000000000101');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.disciplina_equivalencia_decisoes)<>1 THEN
    RAISE EXCEPTION 'Direção A não vê a própria decisão'; END IF;
  BEGIN
    UPDATE public.disciplina_equivalencia_decisoes SET motivo='Alteração proibida';
    RAISE EXCEPTION 'UPDATE indevido autorizado';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.disciplina_equivalencia_decisoes;
    RAISE EXCEPTION 'DELETE indevido autorizado';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.disciplina_equivalencia_decisoes
    (escola_id,curso_id,classe_id,ano_letivo_id,nome_normalizado,disciplina_oficial_id,candidatos_ids,motivo,decidido_por)
    VALUES (
    '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001001',
    '00000000-0000-4000-8000-000000001101','00000000-0000-4000-8000-000000001201',
    'educacao manual e plastica','00000000-0000-4000-8000-000000001401',
    ARRAY['00000000-0000-4000-8000-000000001401'::uuid,'00000000-0000-4000-8000-000000001402'::uuid],
    'Tentativa de duplicação','00000000-0000-4000-8000-000000000101');
    RAISE EXCEPTION 'Duplicação indevida autorizada';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.disciplina_equivalencia_decisoes
    (escola_id,curso_id,classe_id,ano_letivo_id,nome_normalizado,disciplina_oficial_id,candidatos_ids,motivo,decidido_por)
    VALUES (
    '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001001',
    '00000000-0000-4000-8000-000000001101','00000000-0000-4000-8000-000000001201',
    'nome diferente','00000000-0000-4000-8000-000000001401',
    ARRAY['00000000-0000-4000-8000-000000001401'::uuid,'00000000-0000-4000-8000-000000001403'::uuid],
    'Tentativa de disciplina de outra escola','00000000-0000-4000-8000-000000000101');
    RAISE EXCEPTION 'Disciplina estrangeira autorizada';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',false);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.disciplina_equivalencia_decisoes
    (escola_id,curso_id,classe_id,ano_letivo_id,nome_normalizado,disciplina_oficial_id,candidatos_ids,motivo,decidido_por)
    VALUES (
    '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001001',
    '00000000-0000-4000-8000-000000001101','00000000-0000-4000-8000-000000001201',
    'outra escolha','00000000-0000-4000-8000-000000001401',
    ARRAY['00000000-0000-4000-8000-000000001401'::uuid,'00000000-0000-4000-8000-000000001402'::uuid],
    'Docente tenta decidir','00000000-0000-4000-8000-000000000102');
    RAISE EXCEPTION 'Docente autorizou decisão';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',false);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.disciplina_equivalencia_decisoes
    (escola_id,curso_id,classe_id,ano_letivo_id,nome_normalizado,disciplina_oficial_id,candidatos_ids,motivo,decidido_por)
    VALUES (
    '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001001',
    '00000000-0000-4000-8000-000000001101','00000000-0000-4000-8000-000000001201',
    'outro grupo','00000000-0000-4000-8000-000000001401',
    ARRAY['00000000-0000-4000-8000-000000001401'::uuid,'00000000-0000-4000-8000-000000001402'::uuid],
    'Financeiro tenta decidir','00000000-0000-4000-8000-000000000103');
    RAISE EXCEPTION 'Financeiro autorizou decisão';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',false);
SELECT set_config('request.jwt.claim.escola_id','00000000-0000-4000-8000-000000000002',false);
SET ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.disciplina_equivalencia_decisoes)<>0 THEN
    RAISE EXCEPTION 'Escola B viu decisão da escola A'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.disciplina_equivalencia_decisoes)<>1
    OR (SELECT nota FROM public.notas WHERE id='00000000-0000-4000-8000-000000009999')<>16 THEN
    RAISE EXCEPTION 'A decisão alterou notas ou perdeu auditoria'; END IF;
END $$;
