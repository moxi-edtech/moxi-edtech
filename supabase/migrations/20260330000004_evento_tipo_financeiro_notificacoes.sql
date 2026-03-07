BEGIN;

ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'catalogo.precos.ativado';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'financeiro.fecho.autorizado';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'desconto.aprovado';

COMMIT;
