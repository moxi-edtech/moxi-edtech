begin;

ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS curso_codigo text,
  ADD COLUMN IF NOT EXISTS classe_numero integer,
  ADD COLUMN IF NOT EXISTS turno_codigo text,
  ADD COLUMN IF NOT EXISTS turma_letra text,
  ADD COLUMN IF NOT EXISTS ano_letivo integer,
  ADD COLUMN IF NOT EXISTS numero_matricula text,
  ADD COLUMN IF NOT EXISTS numero_processo text,
  ADD COLUMN IF NOT EXISTS bi_numero text,
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS encarregado_telefone text,
  ADD COLUMN IF NOT EXISTS encarregado_email text,
  ADD COLUMN IF NOT EXISTS turma_codigo text,
  ADD COLUMN IF NOT EXISTS encarregado_nome text,
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS row_number integer;

commit;
