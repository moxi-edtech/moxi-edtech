-- Disposable-only rollback of CC-015 indexes; never execute on production.
DROP INDEX IF EXISTS public.ix_cc_candidates_per_student_year;
DROP INDEX IF EXISTS public.ix_cc_active_matricula_per_year_turma;
