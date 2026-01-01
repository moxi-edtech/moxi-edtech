-- Add ano_letivo column to matriculas table
ALTER TABLE public.matriculas ADD COLUMN ano_letivo TEXT;

-- Update ano_letivo from turmas table
UPDATE public.matriculas m
SET ano_letivo = t.ano_letivo
FROM public.turmas t
WHERE m.turma_id = t.id;

-- Create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS matriculas_unica_por_ano
ON public.matriculas (escola_id, aluno_id, turma_id, ano_letivo)
WHERE status IN ('ativo','pendente','concluido');
