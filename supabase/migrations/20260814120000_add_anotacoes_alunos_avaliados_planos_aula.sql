ALTER TABLE public.planos_aula
  ADD COLUMN IF NOT EXISTS anotacoes_alunos_avaliados text;
