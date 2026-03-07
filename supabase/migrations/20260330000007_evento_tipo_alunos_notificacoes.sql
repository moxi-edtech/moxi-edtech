BEGIN;

ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'matricula.confirmada';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'nota.lancada';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'avaliacao.marcada';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'frequencia.falta_registada';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'frequencia.faltas_limite';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'nota.abaixo_media';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'matricula.renovacao_disponivel';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'propina.atraso';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'propina.vence_3d';

COMMIT;
