\set ON_ERROR_STOP on
\timing on
-- PostgreSQL 17 descartável, com dados fictícios; não replica integralmente produção.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.escola_users (escola_id uuid, user_id uuid, papel text, role text);
CREATE FUNCTION public.has_access_to_escola_fast(p_escola_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT EXISTS(SELECT 1 FROM public.escola_users
 WHERE escola_id=p_escola_id AND user_id=auth.uid()) $$;
CREATE FUNCTION public.check_super_admin_role() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.immutable_unaccent(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT public.unaccent(p_text) $$;
CREATE FUNCTION public.normalize_search_text(VARIADIC p_parts text[]) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
 SELECT btrim(regexp_replace(
  public.immutable_unaccent(lower(coalesce(array_to_string(p_parts,' '),''))),
  '[^a-z0-9]+',' ','g')) $$;
CREATE TABLE public.classes(id uuid PRIMARY KEY,escola_id uuid NOT NULL);
CREATE TABLE public.turmas(
  id uuid PRIMARY KEY, escola_id uuid NOT NULL,
  classe_id uuid NOT NULL, nome text NOT NULL, ano_letivo_id uuid
);
CREATE TABLE public.alunos(
  id uuid PRIMARY KEY,escola_id uuid NOT NULL,
  nome text,nome_completo text,numero_processo text,deleted_at timestamptz
);
CREATE TABLE public.matriculas(
  id uuid PRIMARY KEY,escola_id uuid NOT NULL,aluno_id uuid NOT NULL,
  turma_id uuid NOT NULL,ano_letivo integer NOT NULL,numero_chamada integer,
  status text NOT NULL,ativo boolean NOT NULL
);
INSERT INTO public.escola_users VALUES
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000d1','secretaria',NULL),
 ('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000d2','secretaria',NULL);
INSERT INTO public.classes VALUES
 ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000a1'),
 ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000b2');
INSERT INTO public.turmas VALUES
 ('00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000c1','Turma A','00000000-0000-4000-8000-000000000026'),
 ('00000000-0000-4000-8000-0000000000f2','00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000c2','Turma B','00000000-0000-4000-8000-000000000026');
INSERT INTO public.alunos
SELECT ('00000000-0000-4000-8100-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-4000-8000-0000000000a1',
 CASE WHEN n=55 THEN 'Álvaro Sintético 55' ELSE 'Aluno Sintético '||lpad(n::text,2,'0') END,
 CASE WHEN n=55 THEN 'Álvaro Sintético 55' ELSE 'Aluno Sintético '||lpad(n::text,2,'0') END,
 '2026/'||lpad(n::text,4,'0'), NULL FROM generate_series(1,55) n;
INSERT INTO public.matriculas
SELECT ('00000000-0000-4000-8200-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-4000-8000-0000000000a1',
 ('00000000-0000-4000-8100-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-4000-8000-0000000000f1',2026,n,'ativo',true
FROM generate_series(1,55) n;
INSERT INTO public.alunos VALUES
 ('00000000-0000-4000-8100-000000000999','00000000-0000-4000-8000-0000000000b2','Aluno Exclusivo B','Aluno Exclusivo B','B/001',NULL);
INSERT INTO public.matriculas VALUES
 ('00000000-0000-4000-8200-000000000999','00000000-0000-4000-8000-0000000000b2',
 '00000000-0000-4000-8100-000000000999','00000000-0000-4000-8000-0000000000f2',2026,1,'ativo',true);

GRANT USAGE ON SCHEMA auth,public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(),public.has_access_to_escola_fast(uuid),
 public.check_super_admin_role(),public.normalize_search_text(VARIADIC text[]) TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER TABLE public.escola_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_membership ON public.escola_users TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_class ON public.classes TO authenticated USING(public.has_access_to_escola_fast(escola_id));
CREATE POLICY own_turma ON public.turmas TO authenticated USING(public.has_access_to_escola_fast(escola_id));
CREATE POLICY own_student ON public.alunos TO authenticated USING(public.has_access_to_escola_fast(escola_id));
CREATE POLICY own_matricula ON public.matriculas TO authenticated USING(public.has_access_to_escola_fast(escola_id));
\ir ../../migrations/20271022130500_command_center_roster_keyset.sql

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
DO $$
DECLARE
  e uuid := '00000000-0000-4000-8000-0000000000a1';
  t uuid := '00000000-0000-4000-8000-0000000000f1';
  ids uuid[] := '{}'; part uuid[];
  cursor_n text; cursor_i uuid;
  n integer; total_n bigint; forbidden boolean;
BEGIN
  FOR n IN 1..3 LOOP
    SELECT array_agg(aluno_id ORDER BY cursor_name, aluno_id),
           max(total_filtrado)
      INTO part,total_n
      FROM public.command_center_roster_keyset(e,2026,t,NULL,NULL,cursor_n,cursor_i,20,NULL);
    IF total_n <> 55 OR cardinality(part) <> CASE WHEN n=3 THEN 15 ELSE 20 END THEN
      RAISE EXCEPTION 'Expected stable 20/20/15 pages and total 55 on page %',n;
    END IF;
    ids:=ids||part;
    SELECT cursor_name,aluno_id INTO cursor_n,cursor_i
      FROM public.command_center_roster_keyset(e,2026,t,NULL,NULL,cursor_n,cursor_i,20,NULL)
      ORDER BY cursor_name DESC,aluno_id DESC LIMIT 1;
  END LOOP;
  IF (SELECT count(DISTINCT student) FROM unnest(ids) AS student) <> 55 THEN
    RAISE EXCEPTION 'Missing or repeated student in keyset pages';
  END IF;
  SELECT count(*) INTO n FROM public.command_center_roster_keyset(e,2026,t,NULL,'alVARo',NULL,NULL,20,NULL);
  IF n<>1 THEN RAISE EXCEPTION 'Unaccented query did not find Álvaro'; END IF;
  SELECT count(*) INTO n FROM public.command_center_roster_keyset(e,2026,t,NULL,'2026/0055',NULL,NULL,20,NULL);
  IF n<>1 THEN RAISE EXCEPTION 'Student number lookup failed'; END IF;
  SELECT count(*) INTO n FROM public.command_center_roster_keyset(e,2026,t,NULL,'xyz'' OR true --',NULL,NULL,20,NULL);
  IF n<>0 THEN RAISE EXCEPTION 'Hostile search returned unexpected records'; END IF;
  forbidden:=false;
  BEGIN
    PERFORM public.command_center_roster_keyset('00000000-0000-4000-8000-0000000000b2',2026,
      '00000000-0000-4000-8000-0000000000f2',NULL,NULL,NULL,NULL,20,NULL);
  EXCEPTION WHEN insufficient_privilege THEN forbidden:=true;
  END;
  IF NOT forbidden THEN RAISE EXCEPTION 'Cross-tenant access was not rejected'; END IF;
  forbidden:=false;
  BEGIN
    PERFORM public.command_center_roster_keyset(e,2026,t,NULL,NULL,NULL,NULL,20,
      '00000000-0000-4000-8000-000000000099');
  EXCEPTION WHEN insufficient_privilege THEN forbidden:=true;
  END;
  IF NOT forbidden THEN RAISE EXCEPTION 'Unverified polo must fail closed'; END IF;
END $$;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.command_center_roster_keyset(
 '00000000-0000-4000-8000-0000000000a1',2026,
 '00000000-0000-4000-8000-0000000000f1',NULL,'aluno',NULL,NULL,20,NULL);
\timing off
