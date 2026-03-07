BEGIN;

ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'ano_letivo.ativado';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'turma.atribuida';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'notas.prazo_3d';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'notas.prazo_expirado';

COMMIT;
