-- Adicionar colunas para gestão de bloqueio de acesso ao portal
ALTER TABLE public.alunos 
ADD COLUMN acesso_bloqueado boolean DEFAULT false NOT NULL,
ADD COLUMN motivo_bloqueio text,
ADD COLUMN bloqueado_em timestamp with time zone,
ADD COLUMN bloqueado_por uuid REFERENCES public.profiles(user_id);

-- Índice para busca rápida de alunos bloqueados
CREATE INDEX idx_alunos_acesso_bloqueado ON public.alunos(escola_id, acesso_bloqueado) WHERE acesso_bloqueado = true;

-- Comentários para documentação
COMMENT ON COLUMN public.alunos.acesso_bloqueado IS 'Indica se o acesso ao portal do aluno foi bloqueado manualmente.';
COMMENT ON COLUMN public.alunos.motivo_bloqueio IS 'Motivo do bloqueio manual (ex: indisciplina, administrativo).';
COMMENT ON COLUMN public.alunos.bloqueado_em IS 'Data e hora em que o bloqueio foi aplicado.';
COMMENT ON COLUMN public.alunos.bloqueado_por IS 'ID do perfil administrativo que realizou o bloqueio.';
