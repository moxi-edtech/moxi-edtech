-- Disposable PostgreSQL 17 contract for the contextual-course read model.
-- Never run against a real school database.
\set ON_ERROR_STOP on

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated;

CREATE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE FUNCTION public.has_access_to_escola_fast(p_escola uuid) RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT auth.uid() IS NOT NULL
       AND p_escola = nullif(current_setting('test.escola_id', true), '')::uuid $$;
CREATE FUNCTION public.user_has_role_in_school(p_escola uuid, p_roles text[]) RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT public.has_access_to_escola_fast(p_escola)
       AND current_setting('test.role', true) = ANY(p_roles) $$;

CREATE TABLE public.cursos (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL,
  nome text, codigo text, nivel text, descricao text, status_aprovacao text
);
CREATE TABLE public.anos_letivos (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, ano integer NOT NULL, ativo boolean NOT NULL
);
CREATE TABLE public.classes (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, curso_id uuid NOT NULL,
  ano_letivo_id uuid, nome text NOT NULL
);
CREATE TABLE public.turmas (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, curso_id uuid NOT NULL,
  classe_id uuid, nome text NOT NULL, turno text,
  capacidade_maxima integer, status_validacao text,
  ano_letivo_id uuid, ano_letivo integer
);
CREATE TABLE public.alunos (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, deleted_at timestamptz
);
CREATE TABLE public.matriculas (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, turma_id uuid NOT NULL,
  aluno_id uuid NOT NULL, ano_letivo integer NOT NULL, status text NOT NULL, ativo boolean
);
-- Match the installed PostgreSQL 17 enum, not a permissive synthetic text column.
CREATE TYPE public.curriculo_status AS ENUM ('draft', 'published', 'archived');
CREATE TABLE public.curso_curriculos (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, curso_id uuid NOT NULL,
  classe_id uuid, ano_letivo_id uuid NOT NULL, status public.curriculo_status NOT NULL
);

INSERT INTO public.cursos VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Informática', 'INF', 'II', null, 'aprovado'),
  ('11111111-1111-1111-1111-111111111112', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Curso B', 'CB', 'II', null, 'aprovado');
INSERT INTO public.anos_letivos VALUES
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2026, true),
  ('22222222-2222-2222-2222-222222222223', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2026, true),
  ('22222222-2222-2222-2222-222222222224', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2025, false);
INSERT INTO public.classes VALUES
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '10.ª'),
  ('33333333-3333-3333-3333-333333333334', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222224', '10.ª em 2025'),
  ('33333333-3333-3333-3333-333333333337', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222222223', 'Classe B');
INSERT INTO public.turmas VALUES
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '10 A', 'M', 90, 'ativo', '22222222-2222-2222-2222-222222222222', 2026),
  ('44444444-4444-4444-4444-444444444445', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333334', '10 A antigo', 'M', 90, 'ativo', '22222222-2222-2222-2222-222222222224', 2025),
  ('44444444-4444-4444-4444-444444444447', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111112', '33333333-3333-3333-3333-333333333337', 'Turma B', 'M', 30, 'ativo', '22222222-2222-2222-2222-222222222223', 2026);
INSERT INTO public.alunos
  SELECT ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
         CASE WHEN n = 69 THEN now() ELSE null::timestamptz END
  FROM generate_series(1, 70) n;
INSERT INTO public.matriculas
  SELECT ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
         '44444444-4444-4444-4444-444444444444'::uuid,
         ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
         CASE WHEN n=70 THEN 2025 ELSE 2026 END,
         CASE WHEN n=66 THEN 'transferido' WHEN n=67 THEN 'pendente' ELSE 'ativo' END,
         (n NOT IN (66, 67, 68))
  FROM generate_series(1,70) n;
-- Duplicate historical write for an active student must not inflate counts.
INSERT INTO public.matriculas VALUES
  ('10000000-0000-0000-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 2026, 'ativo', true);

-- Relevant tables in the installed KLASSE schema have RLS enabled. In
-- particular alunos, matriculas and turmas have FORCE RLS. This local policy
-- reproduces the school isolation *effect*, not the production policy graph
-- (whose auth/profile relationships are broader than this synthetic fixture).
-- These are solely disposable test objects, never migration changes.
DO $fixture_rls$
DECLARE relation text;
BEGIN
  FOREACH relation IN ARRAY ARRAY[
    'cursos','anos_letivos','classes','turmas',
    'alunos','matriculas','curso_curriculos'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation);
    EXECUTE format(
      'CREATE POLICY fixture_school_read ON public.%I FOR SELECT TO authenticated USING (escola_id = nullif(current_setting(''test.escola_id'',true),'''')::uuid)',
      relation
    );
  END LOOP;
END $fixture_rls$;
ALTER TABLE public.turmas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.matriculas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.alunos FORCE ROW LEVEL SECURITY;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_access_to_escola_fast(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role_in_school(uuid,text[]) TO authenticated;
\ir ../../migrations/20271015100000_command_center_course_overview.sql
\ir ../../migrations/20271015100001_command_center_course_reused_classes.sql
\ir ../../migrations/20271015100002_command_center_course_turmas_page.sql

DO $$
BEGIN
  IF has_function_privilege('anon','public.command_center_course_overview(uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'anonymous role must not execute overview';
  END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
SELECT set_config('test.escola_id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
SELECT set_config('test.role','secretaria',false);

DO $$
DECLARE result jsonb;
BEGIN
  result := public.command_center_course_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  );
  IF (result->'stats'->>'alunos')::int <> 65
     OR (result->'stats'->>'turmas')::int <> 1
     OR (result->'stats'->>'classes')::int <> 1
     OR jsonb_array_length(result->'turmas') <> 1
     OR (result->'classes'->0->>'alunos')::int <> 65
  THEN RAISE EXCEPTION 'invalid counts: %', result->'stats'; END IF;

  IF public.command_center_course_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222223'
  ) IS NOT NULL THEN RAISE EXCEPTION 'foreign year leak'; END IF;

  BEGIN
    PERFORM public.command_center_course_overview(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '11111111-1111-1111-1111-111111111112',
      '22222222-2222-2222-2222-222222222223'
    );
    RAISE EXCEPTION 'cross-tenant request unexpectedly allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END $$;

SELECT set_config('test.role','professor',false);
DO $$
BEGIN
  BEGIN
    PERFORM public.command_center_course_overview(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222'
    );
    RAISE EXCEPTION 'unauthorized role unexpectedly allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END $$;
RESET ROLE;

-- EX-005: an old class can have a *current-year* turma even when created
-- in the previous year. An additional old class may be referenced only by
-- a published curriculum; an archived-only or unreferenced class must stay out.
INSERT INTO public.turmas VALUES
  ('44444444-4444-4444-4444-444444444446',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333334',
   '11 A reutilizada', 'T', 90, 'ativo',
   '22222222-2222-2222-2222-222222222222', 2026);
INSERT INTO public.classes VALUES
  ('33333333-3333-3333-3333-333333333335',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222224', '12.ª publicada'),
  ('33333333-3333-3333-3333-333333333336',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222224', '12.ª arquivada');
INSERT INTO public.curso_curriculos VALUES
  ('55555555-5555-5555-5555-555555555551',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333335',
   '22222222-2222-2222-2222-222222222222', 'published'),
  ('55555555-5555-5555-5555-555555555552',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333336',
   '22222222-2222-2222-2222-222222222222', 'archived');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
SELECT set_config('test.escola_id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
SELECT set_config('test.role','secretaria',false);
DO $$
DECLARE
  result jsonb;
BEGIN
  result := public.command_center_course_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  );
  IF (result->'stats'->>'classes')::integer <> 3
    OR (result->'stats'->>'turmas')::integer <> 2
    OR (result->'stats'->>'alunos')::integer <> 65
    OR jsonb_array_length(result->'classes') <> 3
  THEN RAISE EXCEPTION 'reused class counts inconsistent: %', result->'stats'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(result->'classes') cl
    WHERE cl->>'id' = '33333333-3333-3333-3333-333333333334'
      AND (cl->>'turmas')::integer = 1
  ) THEN RAISE EXCEPTION 'class with active current-year turma was excluded'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(result->'classes') cl
    WHERE cl->>'id' = '33333333-3333-3333-3333-333333333335'
      AND (cl->>'turmas')::integer = 0
  ) THEN RAISE EXCEPTION 'class with published current-year curriculum was excluded'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(result->'classes') cl
    WHERE cl->>'id' = '33333333-3333-3333-3333-333333333336'
  ) THEN RAISE EXCEPTION 'archived-only curriculum leaked into current year'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(result->'turmas') t
    WHERE t->>'id' = '44444444-4444-4444-4444-444444444446'
      AND t->>'classeId' = '33333333-3333-3333-3333-333333333334'
  ) THEN RAISE EXCEPTION 'reused turma is not navigable from Course'; END IF;
END $$;
RESET ROLE;
SELECT 'command-center contextual course DB regression passed (EX-005)' AS result;

-- EX-007: >100 turmas are paginated by the database, not a React slice.
-- Names provide a deterministic order; no identifiable student data included.
INSERT INTO public.turmas (
  id,escola_id,curso_id,classe_id,nome,turno,capacidade_maxima,status_validacao,ano_letivo_id,ano_letivo
)
SELECT ('44444444-4444-4444-5555-' || lpad(n::text,12,'0'))::uuid,
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
 '11111111-1111-1111-1111-111111111111'::uuid,
 '33333333-3333-3333-3333-333333333333'::uuid,
 'Turma ' || lpad(n::text,3,'0'), 'M', 30, 'ativo',
 '22222222-2222-2222-2222-222222222222'::uuid, 2026
FROM generate_series(1,125) n;

DO $
DECLARE fn oid;
BEGIN
  fn := to_regprocedure('public.command_center_course_turmas_page(uuid,uuid,uuid,integer,integer,uuid,text)');
  IF fn IS NULL THEN RAISE EXCEPTION 'EX-007 function missing'; END IF;
  IF (SELECT prosecdef OR provolatile <> 's' FROM pg_proc WHERE oid=fn) THEN
    RAISE EXCEPTION 'EX-007 must remain STABLE SECURITY INVOKER';
  END IF;
  -- Anon inherits PUBLIC, so this checks both direct and default grants.
  IF has_function_privilege('anon', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous/public execution must be revoked';
  END IF;
  IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated user must have access, with a per-school role gate';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('turmas','alunos','matriculas')
        AND c.relrowsecurity AND c.relforcerowsecurity) <> 3 THEN
    RAISE EXCEPTION 'fixture must exercise forced tenant RLS on critical tables';
  END IF;
END $;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
SELECT set_config('test.escola_id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
SELECT set_config('test.role','secretaria',false);
DO $$
DECLARE
  a jsonb; b jsonb; last_page jsonb; by_class jsonb; searched jsonb; escaped jsonb;
BEGIN
  a := public.command_center_course_turmas_page(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',1,25,null,null);
  b := public.command_center_course_turmas_page(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',2,25,null,null);
  last_page := public.command_center_course_turmas_page(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',6,25,null,null);

  IF (a->>'total')::integer<>127 OR jsonb_array_length(a->'items')<>25
    OR (a->>'hasMore')::boolean IS NOT TRUE OR jsonb_array_length(b->'items')<>25
    OR (last_page->>'total')::integer<>127 OR jsonb_array_length(last_page->'items')<>2
    OR (last_page->>'hasMore')::boolean IS NOT FALSE
  THEN RAISE EXCEPTION 'pagination totals/window drift: % % %',a,b,last_page; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(a->'items') aa
    JOIN jsonb_array_elements(b->'items') bb ON aa->>'id'=bb->>'id'
  ) THEN RAISE EXCEPTION 'overlapping adjacent turma pages'; END IF;

  by_class := public.command_center_course_turmas_page(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',1,25,
    '33333333-3333-3333-3333-333333333334',null);
  IF (by_class->>'total')::integer<>1
  THEN RAISE EXCEPTION 'reused class filtering wrong: %',by_class; END IF;

  searched := public.command_center_course_turmas_page(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',1,25,null,'Turma 10');
  IF (searched->>'total')::integer<>10
  THEN RAISE EXCEPTION 'literal name search wrong: %',searched; END IF;

  escaped := public.command_center_course_turmas_page(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',1,25,null,'%');
  IF (escaped->>'total')::integer<>0
  THEN RAISE EXCEPTION 'wildcard injection in course search'; END IF;

  BEGIN
    PERFORM public.command_center_course_turmas_page(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',0,25,null,null);
    RAISE EXCEPTION 'page zero accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.command_center_course_turmas_page(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '11111111-1111-1111-1111-111111111112',
      '22222222-2222-2222-2222-222222222223',1,25,null,null);
    RAISE EXCEPTION 'unauthorized school accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT 'EX-007 Course pagination >100 turmas, scope and search regression passed' AS result;

-- EX-007 hardening: exercise *all* six windows, permissions and edge cases.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
SELECT set_config('test.escola_id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
SELECT set_config('test.role','secretaria',false);
DO $$
DECLARE
  actual_pages integer;
  total_rows integer;
  unique_rows integer;
  invalid_class boolean := false;
  result jsonb;
BEGIN
  SELECT count(DISTINCT p.n), count(x.item), count(DISTINCT x.item->>'id')
  INTO actual_pages,total_rows,unique_rows
  FROM generate_series(1,6) p(n)
  CROSS JOIN LATERAL jsonb_array_elements(public.command_center_course_turmas_page(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',p.n,25,null,null)->'items') x(item);
  IF actual_pages<>6 OR total_rows<>127 OR unique_rows<>127 THEN
    RAISE EXCEPTION 'incomplete or duplicated windows: pages %, items %, distinct %',
      actual_pages,total_rows,unique_rows;
  END IF;
  result := public.command_center_course_turmas_page(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',7,25,null,null);
  IF (result->>'total')::int<>127 OR jsonb_array_length(result->'items')<>0
     OR (result->>'hasMore')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'out-of-range page must be empty without faking zero total: %',result;
  END IF;
  result := public.command_center_course_turmas_page(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',1,25,null,'10 A');
  IF (result->>'total')::int<>1 OR (result->'items'->0->>'alunos')::int<>65 THEN
    RAISE EXCEPTION 'deduplicated active student count drift: %',result;
  END IF;
  -- Unrelated class/year must not be accepted or leak via arbitrary filtering.
  BEGIN
    PERFORM public.command_center_course_turmas_page(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',1,25,
      '99999999-9999-9999-9999-999999999999',null);
    RAISE EXCEPTION 'unknown class accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.command_center_course_turmas_page(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',1,51,null,null);
    RAISE EXCEPTION 'page size beyond 50 accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.command_center_course_turmas_page(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',1,25,null,repeat('x',73));
    RAISE EXCEPTION 'unbounded search accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
END $$;
-- Tenant row filtering remains effective even when an operator passes
-- a different school into a direct SELECT; the function separately rejects it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.turmas WHERE escola_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') THEN
    RAISE EXCEPTION 'school B leaked through the tenant RLS fixture';
  END IF;
END $$;
-- A real school-B row must be visible to its own school, but never to A.
SELECT set_config('test.escola_id','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.turmas WHERE nome='Turma B') <> 1 THEN
    RAISE EXCEPTION 'school B control row invisible: RLS assertion was vacuous';
  END IF;
  IF EXISTS (SELECT 1 FROM public.turmas WHERE escola_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') THEN
    RAISE EXCEPTION 'school A leaked to school B';
  END IF;
END $$;
SELECT set_config('test.escola_id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
SELECT set_config('test.role','professor',false);
DO $$
BEGIN
  BEGIN
    PERFORM public.command_center_course_turmas_page(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',1,25,null,null);
    RAISE EXCEPTION 'teacher role bypassed staff-only EX-007';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END $$;
SELECT set_config('test.role','secretaria',false);
SELECT set_config('request.jwt.claim.sub','',false);
DO $$
BEGIN
  BEGIN
    PERFORM public.command_center_course_turmas_page(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',1,25,null,null);
    RAISE EXCEPTION 'missing JWT subject accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT 'EX-007 SQL RLS, privileges, six-window and malformed request checks passed' AS result;
