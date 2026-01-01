-- ======================================================================
--  STAGING ALUNOS — CAMPOS PARA MATRÍCULA EM MASSA
--  - Adiciona dimensões de curso / classe / turno / turma / ano letivo
--  - Pensado para agrupar e matricular alunos em massa por turma
-- ======================================================================

ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS curso_codigo     text,    -- Ex.: EMG, CTI, EF1, EF2...
  ADD COLUMN IF NOT EXISTS classe_numero    integer, -- Ex.: 1, 7, 10, 11, 12...
  ADD COLUMN IF NOT EXISTS turno_codigo     text,    -- Ex.: M, T, N
  ADD COLUMN IF NOT EXISTS turma_letra      text,    -- Ex.: A, B, AB, ABNG
  ADD COLUMN IF NOT EXISTS ano_letivo       integer, -- Ex.: 2025
  ADD COLUMN IF NOT EXISTS numero_matricula text;    -- Opcional (pode ser gerado pelo sistema)

-- Índice para agrupar rapidamente por import + dimensões de matrícula
CREATE INDEX IF NOT EXISTS staging_alunos_import_matricula_idx
  ON public.staging_alunos (
    import_id,
    escola_id,
    ano_letivo,
    curso_codigo,
    classe_numero,
    turno_codigo,
    turma_letra
  );