BEGIN;

ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'sistema.manutencao';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'sistema.funcionalidade';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'plano.limite_80';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'plano.limite_100';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'subscricao.expira';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'subscricao.expirada';

COMMIT;
