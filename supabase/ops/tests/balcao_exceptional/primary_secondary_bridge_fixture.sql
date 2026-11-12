-- PostgreSQL 17 disposable fixture: 2025 EP 6th -> 2026 ESG 7th.
-- Loads the installed late-enrollment writer and replaces only the reviewed
-- progression functions. No customer data or production credentials.
\ir fixture.sql

ALTER TABLE public.turmas ADD COLUMN nivel_ensino text;
ALTER TABLE public.turmas ADD COLUMN status_validacao text DEFAULT 'ativo';
ALTER TABLE public.matriculas ALTER COLUMN id SET DEFAULT gen_random_uuid();
UPDATE public.classes SET numero=6,nome='6ª classe'
 WHERE id='c0000000-0000-4000-8000-000000000001';
UPDATE public.classes SET numero=7,nome='7ª classe'
 WHERE id='c0000000-0000-4000-8000-000000000002';
UPDATE public.turmas
 SET nivel_ensino='primario',curso_id='d0000000-0000-4000-8000-000000000001'
 WHERE id='40000000-0000-4000-8000-000000000001';
UPDATE public.turmas
 SET nivel_ensino='secundario',curso_id='d0000000-0000-4000-8000-000000000002'
 WHERE id='40000000-0000-4000-8000-000000000002';
CREATE FUNCTION public.turma_classe_numero(uuid) RETURNS integer LANGUAGE sql STABLE AS $$
 SELECT c.numero FROM public.turmas t
 JOIN public.classes c ON c.id=t.classe_id WHERE t.id=$1
$$;

\ir ../../../migrations/20271112020000_balcao_primary_secondary_6_to_7.sql
