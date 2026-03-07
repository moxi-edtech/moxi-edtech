BEGIN;

ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'matricula.aluno_matriculado';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'matricula.aluno_transferido';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'matricula.aluno_cancelado';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'matricula.aluno_reintegrado';

COMMIT;
