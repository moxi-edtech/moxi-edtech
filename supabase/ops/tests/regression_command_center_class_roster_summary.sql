\set ON_ERROR_STOP on
\timing on
-- Disposable PostgreSQL fixture. NOT a substitute for a full Supabase migration replay.
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TABLE public.escola_users (escola_id uuid NOT NULL, user_id uuid NOT NULL);
CREATE FUNCTION public.has_access_to_escola_fast(p_escola_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.escola_users
    WHERE escola_id = p_escola_id AND user_id = auth.uid())
$$;
CREATE TABLE public.classes (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, curso_id uuid NULL
);
CREATE TABLE public.turmas (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, classe_id uuid NOT NULL,
  curso_id uuid NULL, ano_letivo_id uuid NULL, ano_letivo integer,
  nome text NOT NULL, capacidade_maxima integer
);
CREATE TABLE public.alunos (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL,
  nome text, nome_completo text, deleted_at timestamptz
);
CREATE TABLE public.matriculas (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL,
  session_id uuid, ano_letivo integer NOT NULL,
  turma_id uuid NOT NULL, aluno_id uuid NOT NULL,
  numero_chamada integer, status text NOT NULL, ativo boolean NOT NULL
);
INSERT INTO public.escola_users VALUES
  ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000d1'),
  ('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000d2');
INSERT INTO public.classes VALUES
  ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000a1',NULL),
  ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000b2',NULL);
INSERT INTO public.turmas VALUES
  ('00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000c1',NULL,'00000000-0000-4000-8000-000000000026',2026,'Turma Sintética A',50),
  ('00000000-0000-4000-8000-0000000000f2','00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000c2',NULL,'00000000-0000-4000-8000-000000000026',2026,'Turma Sintética B',50);
INSERT INTO public.alunos
SELECT ('00000000-0000-4000-8100-' || lpad(n::text,12,'0'))::uuid,
  '00000000-0000-4000-8000-0000000000a1',
  'Aluno de teste ' || lpad(n::text,2,'0'),
  'Aluno de teste ' || lpad(n::text,2,'0'),NULL
FROM generate_series(1,55) AS n;
INSERT INTO public.matriculas
SELECT ('00000000-0000-4000-8200-' || lpad(n::text,12,'0'))::uuid,
  '00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000026',
  2026,'00000000-0000-4000-8000-0000000000f1',
  ('00000000-0000-4000-8100-' || lpad(n::text,12,'0'))::uuid,
  n,'ativo',true
FROM generate_series(1,55) AS n;
INSERT INTO public.alunos VALUES
  ('00000000-0000-4000-8100-000000000999','00000000-0000-4000-8000-0000000000b2','Aluno B','Aluno B',NULL);
INSERT INTO public.matriculas VALUES
  ('00000000-0000-4000-8200-000000000999','00000000-0000-4000-8000-0000000000b2',
   '00000000-0000-4000-8000-000000000026',2026,
   '00000000-0000-4000-8000-0000000000f2','00000000-0000-4000-8100-000000000999',
   1,'ativo',true);

-- RLS fixture restricts all reads to the signed-in user's school.
GRANT USAGE ON SCHEMA auth, public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(), public.has_access_to_escola_fast(uuid) TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER TABLE public.escola_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_membership ON public.escola_users TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY class_school ON public.classes TO authenticated
  USING (public.has_access_to_escola_fast(escola_id));
CREATE POLICY group_school ON public.turmas TO authenticated
  USING (public.has_access_to_escola_fast(escola_id));
CREATE POLICY student_school ON public.alunos TO authenticated
  USING (public.has_access_to_escola_fast(escola_id));
CREATE POLICY enrollment_school ON public.matriculas TO authenticated
  USING (public.has_access_to_escola_fast(escola_id));
\ir ../../migrations/20271022131500_command_center_class_roster_summary.sql

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
DO $$
DECLARE
  v jsonb;
  page2 jsonb;
  page3 jsonb;
  forbidden boolean := false;
BEGIN
  v := public.command_center_class_roster_summary(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1',
    '00000000-0000-4000-8000-000000000026', 2026,false,1,20);
  IF (v->>'total')::integer <> 55 OR jsonb_array_length(v->'items') <> 20
      OR (v->'counts'->>'00000000-0000-4000-8000-0000000000f1')::integer <> 55 THEN
    RAISE EXCEPTION 'Expected 55 students (20 on page 1) and class occupancy count';
  END IF;
  page2 := public.command_center_class_roster_summary(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1',
    '00000000-0000-4000-8000-000000000026', 2026,false,2,20);
  page3 := public.command_center_class_roster_summary(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1',
    '00000000-0000-4000-8000-000000000026', 2026,false,3,20);
  IF jsonb_array_length(page2->'items') <> 20 OR jsonb_array_length(page3->'items') <> 15 THEN
    RAISE EXCEPTION 'Expected stable 20/20/15 pagination';
  END IF;
  IF (SELECT count(DISTINCT x->>'id') FROM (
      SELECT x FROM jsonb_array_elements(v->'items') x
      UNION ALL SELECT x FROM jsonb_array_elements(page2->'items') x
      UNION ALL SELECT x FROM jsonb_array_elements(page3->'items') x
    ) pages) <> 55 THEN
    RAISE EXCEPTION 'Pages omit or repeat a student';
  END IF;
  IF (SELECT capacidade_maxima FROM public.turmas WHERE id='00000000-0000-4000-8000-0000000000f1') <> 50 THEN
    RAISE EXCEPTION 'Fixture capacity mismatch (55 enrolled, 50 capacity, 5 over)';
  END IF;
  BEGIN
    PERFORM public.command_center_class_roster_summary(
      '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000c2',
      '00000000-0000-4000-8000-000000000026', 2026,false,1,20);
  EXCEPTION WHEN insufficient_privilege THEN forbidden := true;
  END;
  IF NOT forbidden THEN RAISE EXCEPTION 'Cross-school RPC access was not rejected'; END IF;
END $$;

-- EXPLAIN is real and reproducible on disposable synthetic data; it is NOT a production p95.
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(DISTINCT m.aluno_id) FROM public.matriculas m
WHERE m.escola_id = '00000000-0000-4000-8000-0000000000a1'
  AND m.session_id = '00000000-0000-4000-8000-000000000026'
  AND m.status = 'ativo' AND m.ativo IS TRUE;

-- The following numbers are measurements on synthetic RLS fixtures only.
-- New RPC query plan, runtime distribution (30 executions) and JSON size.
EXPLAIN (ANALYZE, BUFFERS)
SELECT public.command_center_class_roster_summary(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1',
    '00000000-0000-4000-8000-000000000026', 2026,false,1,20);
SELECT pg_column_size(public.command_center_class_roster_summary(
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1',
    '00000000-0000-4000-8000-000000000026', 2026,false,1,20)) AS fixture_new_response_bytes;
SELECT pg_column_size(coalesce(jsonb_agg(to_jsonb(data)), '[]'::jsonb)) AS fixture_bulk_response_bytes
FROM (
  SELECT a.id, a.nome, a.nome_completo, m.turma_id, m.numero_chamada
  FROM public.matriculas m
  JOIN public.alunos a ON a.id=m.aluno_id AND a.escola_id=m.escola_id
  WHERE m.escola_id='00000000-0000-4000-8000-0000000000a1'
  ORDER BY m.id LIMIT 500
) data;
DO $$
DECLARE
  samples double precision[] := '{}';
  tick timestamptz;
  v jsonb;
  i integer;
  p95 double precision;
BEGIN
  FOR i IN 1..30 LOOP
    tick := clock_timestamp();
    SELECT public.command_center_class_roster_summary(
      '00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000c1',
      '00000000-0000-4000-8000-000000000026',2026,false,1,20) INTO v;
    samples := array_append(samples, extract(epoch FROM (clock_timestamp()-tick)) * 1000);
  END LOOP;
  SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY sample) INTO p95 FROM unnest(samples) sample;
  RAISE NOTICE 'SQL-fixture p95 milliseconds / 30 runs: %', p95;
END $$;
\timing off
