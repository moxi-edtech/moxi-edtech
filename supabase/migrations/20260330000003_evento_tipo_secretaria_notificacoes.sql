BEGIN;

ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'turma.aprovada';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'turma.rejeitada';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'propina.definida';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'desconto.aprovado';
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'importacao.alunos.concluida';

COMMIT;
