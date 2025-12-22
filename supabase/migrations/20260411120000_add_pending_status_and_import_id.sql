BEGIN;

-- =============================================================================
-- MIGRATION: Adicionar Status de Aprovação e ID de Importação
-- OBJETIVO:  Preparar o esquema para o fluxo de trabalho de importação com
--            aprovação pendente para cursos e rastreamento de origem para
--            cursos e turmas.
-- =============================================================================

-- -------------------------------------------------------------
-- 1. TABELA `cursos`
-- -------------------------------------------------------------

-- Adiciona uma coluna de status para o fluxo de aprovação por administradores.
-- 'aprovado':   Visível e utilizável por todos.
-- 'pendente':   Criado por um não-admin (ex: via importação), aguardando aprovação.
ALTER TABLE public.cursos
  ADD COLUMN IF NOT EXISTS status_aprovacao TEXT DEFAULT 'aprovado';

-- Adiciona a coluna `import_id` para rastrear a origem da criação do curso.
ALTER TABLE public.cursos
  ADD COLUMN IF NOT EXISTS import_id UUID;

-- Cria um índice para otimizar a busca de cursos por `import_id`.
CREATE INDEX IF NOT EXISTS idx_cursos_import_id ON public.cursos (import_id);


-- -------------------------------------------------------------
-- 2. TABELA `turmas`
-- -------------------------------------------------------------

-- Adiciona a coluna `import_id` para rastrear a origem da criação da turma.
ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS import_id UUID;

-- Cria um índice para otimizar a busca de turmas por `import_id`.
CREATE INDEX IF NOT EXISTS idx_turmas_import_id ON public.turmas (import_id);


COMMIT;
