-- Adiciona campos de pré-classificação para matrícula
ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS classe_label       text,
  ADD COLUMN IF NOT EXISTS turma_label        text,
  ADD COLUMN IF NOT EXISTS ano_letivo         integer,
  ADD COLUMN IF NOT EXISTS numero_matricula   text;

-- Índice para agrupar rápido por import+classe+turma+ano
CREATE INDEX IF NOT EXISTS staging_alunos_import_classe_turma_ano_idx
  ON public.staging_alunos (import_id, classe_label, turma_label, ano_letivo);
