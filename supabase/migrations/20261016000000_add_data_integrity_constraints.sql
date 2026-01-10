BEGIN;

-- ============================================================================
-- 1. INTEGRIDADE DE MATRÍCULAS
-- Regra: Se o aluno está "Ativo", "Concluído" ou "Transferido", ele PRECISA ter uma turma.
-- Matrículas "Pendentes" ou "Canceladas" podem ficar sem turma.
-- ============================================================================

ALTER TABLE public.matriculas
ADD CONSTRAINT chk_matricula_turma_obrigatoria_se_ativa
CHECK (
  status NOT IN ('ativo', 'concluido', 'transferido')
  OR
  turma_id IS NOT NULL
)
NOT VALID;

-- ============================================================================
-- 2. INTEGRIDADE DE TURMAS
-- Regra: Uma turma só pode ser "Ativa" (validada) se tiver Curso e Classe definidos.
-- Turmas "Rascunho" ou "Pendente" podem ficar com campos nulos.
-- =================================t===========================================

ALTER TABLE public.turmas
ADD CONSTRAINT chk_turma_curso_obrigatorio_se_ativa
CHECK (
  status_validacao <> 'ativo'
  OR
  curso_id IS NOT NULL
)
NOT VALID;

ALTER TABLE public.turmas
ADD CONSTRAINT chk_turma_classe_obrigatoria_se_ativa
CHECK (
  status_validacao <> 'ativo'
  OR
  classe_id IS NOT NULL
)
NOT VALID;

-- ============================================================================
-- 3. INTEGRIDADE DE CURSOS (A "Trava" do Importador)
-- Regra: Não pode haver dois cursos com a mesma Sigla Oficial (course_code) na mesma escola.
-- Ex: Só um 'TI', só um 'CFB'.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_cursos_escola_course_code
ON public.cursos (escola_id, course_code)
WHERE course_code IS NOT NULL;

COMMIT;
