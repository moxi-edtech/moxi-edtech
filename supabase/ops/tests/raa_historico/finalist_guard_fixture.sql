-- Disposable PostgreSQL 17 only. Never run against customer databases.
\ir fixture.sql

CREATE TABLE public.escolas (id uuid PRIMARY KEY, nome text NOT NULL);
CREATE TABLE public.classes (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, nome text NOT NULL, numero int
);
ALTER TABLE public.turmas
  ADD COLUMN escola_id uuid,
  ADD COLUMN curso_id uuid,
  ADD COLUMN classe_id uuid,
  ADD COLUMN ano_letivo integer,
  ADD COLUMN session_id uuid,
  ADD COLUMN classe_num integer;
ALTER TABLE public.matriculas
  ADD COLUMN origem_transicao_matricula_id uuid;

-- Preserve the real wrapper's optional individual-journey predicate. In this
-- minimal test the pupil qualifies through the real scoped historical cohort.
CREATE FUNCTION public.balcao_origem_percurso_elegivel(uuid,uuid)
RETURNS boolean LANGUAGE sql STABLE AS $test_eligibility$ SELECT false $test_eligibility$;

-- The academic branch is an additive override of the installed canonical RAA.
\ir ../../../migrations/20271117173000_raa_historical_finalists_and_voided_destinations.sql
CREATE TRIGGER test_curtume_history_destination_guard
  BEFORE INSERT OR UPDATE OF status ON public.historico_snapshot_locks
  FOR EACH ROW
  EXECUTE FUNCTION public.curtume_guard_legal_history_destination_v1();
GRANT SELECT ON public.escolas,public.classes TO authenticated;
