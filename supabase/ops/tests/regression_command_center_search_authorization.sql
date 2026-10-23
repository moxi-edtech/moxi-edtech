-- Disposable PostgreSQL 17 contract test. All users/records are synthetic.
\set ON_ERROR_STOP on
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid;
$$;
CREATE EXTENSION pg_trgm;
CREATE FUNCTION public.unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT $1 $$;
CREATE TABLE public.escola_users (
  escola_id uuid NOT NULL, user_id uuid NOT NULL, papel text, role text
);
INSERT INTO public.escola_users VALUES
 ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','secretaria','staff'),
 ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000002','financeiro','staff'),
 ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000003','professor','staff'),
 ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000004','admin_escola','staff'),
 ('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000005','secretaria','staff');
CREATE FUNCTION public.has_access_to_escola_fast(uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.escola_users
    WHERE escola_id=$1 AND user_id=auth.uid());
$$;
CREATE FUNCTION public.check_super_admin_role() RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT false $$;
CREATE TABLE public.search_fixture (
 id uuid, escola_id uuid, type text, label text, highlight text, search_text text,
 updated_at timestamptz, created_at timestamptz
);
INSERT INTO public.search_fixture VALUES
 ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000010','aluno','Pessoa Aluno','Processo artificial','Pessoa Aluno',now(),now()),
 ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000010','pagamento','Pessoa Pagamento',null,'Pessoa Pagamento',now(),now()),
 ('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000020','aluno','Pessoa Outra Escola',null,'Pessoa Outra Escola',now(),now());
DO $$
DECLARE entity text;
BEGIN
 FOREACH entity IN ARRAY ARRAY['alunos','turmas','matriculas','candidaturas','documentos',
 'mensalidades','pagamentos','recibos','professores','cursos','classes','usuarios'] LOOP
   EXECUTE format('CREATE VIEW public.vw_search_%I AS SELECT * FROM public.search_fixture WHERE type = %L',
     entity,
     CASE entity WHEN 'alunos' THEN 'aluno' WHEN 'matriculas' THEN 'matricula'
       WHEN 'pagamentos' THEN 'pagamento' WHEN 'usuarios' THEN 'usuario'
       WHEN 'mensalidades' THEN 'mensalidade' WHEN 'professores' THEN 'professor'
       WHEN 'candidaturas' THEN 'candidatura' WHEN 'documentos' THEN 'documento'
       WHEN 'turmas' THEN 'turma' WHEN 'recibos' THEN 'recibo'
       WHEN 'cursos' THEN 'curso' ELSE 'classe' END);
 END LOOP;
END $$;

\ir ../../migrations/20271022130000_command_center_search_role_authorization.sql
SET ROLE authenticated;
-- Member of school A, Secretary: academic results yes, financial no.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.search_global_entities(
  '00000000-0000-4000-8000-000000000010','Pessoa',ARRAY['aluno'])) <> 1 THEN
  RAISE EXCEPTION 'Secretary must see one academic result in own school';
 END IF;
 BEGIN
  PERFORM * FROM public.search_global_entities(
   '00000000-0000-4000-8000-000000000010','Pessoa',ARRAY['aluno','pagamento']);
  RAISE EXCEPTION 'Mixed category request was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM * FROM public.search_global_entities(
   '00000000-0000-4000-8000-000000000010','Pessoa',NULL::text[]);
  RAISE EXCEPTION 'NULL category request was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM * FROM public.search_global_entities(
   '00000000-0000-4000-8000-000000000010','Pessoa',ARRAY['aluno','unknown']);
  RAISE EXCEPTION 'Unknown category request was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
-- Finance may search payment, but not academic enrollment or teachers.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.search_global_entities(
  '00000000-0000-4000-8000-000000000010','Pessoa',ARRAY['pagamento'])) <> 1 THEN
  RAISE EXCEPTION 'Finance must see a payment in its own school';
 END IF;
 BEGIN
  PERFORM * FROM public.search_global_entities(
   '00000000-0000-4000-8000-000000000010','Pessoa',ARRAY['professor']);
  RAISE EXCEPTION 'Finance accessed teacher category';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
-- No global student directory for teacher without student/class scoped policy.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
DO $$
BEGIN
 BEGIN
  PERFORM * FROM public.search_global_entities(
   '00000000-0000-4000-8000-000000000010','Pessoa',ARRAY['aluno']);
  RAISE EXCEPTION 'Teacher accessed unrestricted student directory';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
-- Admin can search both categories, but still only inside own school.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.search_global_entities(
  '00000000-0000-4000-8000-000000000010','Pessoa',ARRAY['aluno','pagamento'])) <> 2 THEN
  RAISE EXCEPTION 'Admin lost authorized categories';
 END IF;
END $$;
-- School B Secretary cannot read school A.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',false);
DO $$
BEGIN
 BEGIN
  PERFORM * FROM public.search_global_entities(
   '00000000-0000-4000-8000-000000000010','Pessoa',ARRAY['aluno']);
  RAISE EXCEPTION 'Cross-tenant search was allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'forbidden' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.search_global_entities(
  '00000000-0000-4000-8000-000000000020','Pessoa',ARRAY['aluno'])) <> 1 THEN
  RAISE EXCEPTION 'School B cannot search itself';
 END IF;
END $$;
RESET ROLE;
SELECT 'command-center search authorization regression passed' as result;
