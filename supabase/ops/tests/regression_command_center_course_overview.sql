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
CREATE TABLE public.curso_curriculos (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, curso_id uuid NOT NULL,
  classe_id uuid NOT NULL, ano_letivo_id uuid NOT NULL, status text NOT NULL
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
  ('33333333-3333-3333-3333-333333333334', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222224', '10.ª em 2025');
INSERT INTO public.turmas VALUES
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '10 A', 'M', 90, 'ativo', '22222222-2222-2222-2222-222222222222', 2026),
  ('44444444-4444-4444-4444-444444444445', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333334', '10 A antigo', 'M', 90, 'ativo', '22222222-2222-2222-2222-222222222224', 2025);
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

GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_access_to_escola_fast(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role_in_school(uuid,text[]) TO authenticated;
\ir ../../migrations/20271015100000_command_center_course_overview.sql
\ir ../../migrations/20271015100001_command_center_course_reused_classes.sql

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
DO $
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
END $;
RESET ROLE;
SELECT 'command-center contextual course DB regression passed (EX-005)' AS result;
