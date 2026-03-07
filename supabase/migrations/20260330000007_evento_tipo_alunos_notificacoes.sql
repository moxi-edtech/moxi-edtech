BEGIN;

ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'matricula.confirmada';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'matricula.renovacao_disponivel';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'propina.atraso';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'propina.vence_3d';

COMMIT;
