-- ⚠️ PERIGO: ESTE SCRIPT APAGA DADOS. USE APENAS EM AMBIENTE DEV.

BEGIN;

-- Limpeza em ordem de dependência para evitar FK violations
TRUNCATE TABLE public.financeiro_lancamentos CASCADE;
TRUNCATE TABLE public.matriculas CASCADE;
TRUNCATE TABLE public.alunos CASCADE;
TRUNCATE TABLE public.staging_alunos CASCADE;
TRUNCATE TABLE public.import_errors CASCADE;
TRUNCATE TABLE public.import_migrations CASCADE;

-- Opcional: Limpar profiles criados em testes (Cuidado se tiver admins aqui)
-- DELETE FROM public.profiles WHERE role = 'encarregado';

COMMIT;