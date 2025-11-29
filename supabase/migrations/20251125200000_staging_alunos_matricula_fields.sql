-- Campos de apoio à matrícula em massa no staging_alunos

ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS curso_codigo   text,
  ADD COLUMN IF NOT EXISTS classe_numero  integer,
  ADD COLUMN IF NOT EXISTS turno_codigo   text,
  ADD COLUMN IF NOT EXISTS turma_letra    text,
  ADD COLUMN IF NOT EXISTS ano_letivo     integer;

-- Índice para agrupar rápido por combo de matrícula
CREATE INDEX IF NOT EXISTS staging_alunos_matricula_group_idx
  ON public.staging_alunos (
    import_id,
    escola_id,
    curso_codigo,
    classe_numero,
    turno_codigo,
    turma_letra,
    ano_letivo
  );