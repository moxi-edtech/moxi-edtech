BEGIN;

-- =================================================================
-- 1. REMOÇÃO DE ÍNDICES DUPLICADOS (Aprovado)
-- =================================================================

-- Tabela Alunos
DROP INDEX IF EXISTS idx_alunos_escola_id; 
DROP INDEX IF EXISTS ix_alunos_profile;    

-- Tabela Classes
DROP INDEX IF EXISTS idx_classes_escola_curso_nome; 

-- Tabela Cursos
ALTER TABLE public.cursos DROP CONSTRAINT IF EXISTS unique_codigo_por_escola; 

-- Tabela Matriculas
DROP INDEX IF EXISTS idx_matriculas_unica_aluno_turma; 
DROP INDEX IF EXISTS matriculas_unica_por_ano;         

-- Tabela Mensalidades
DROP INDEX IF EXISTS idx_mensalidades_escola; 

-- Tabela Turmas
DROP INDEX IF EXISTS idx_turmas_session; 


-- =================================================================
-- 2. OTIMIZAÇÃO DE RLS (Schema v3.1 - Angola Standard)
-- =================================================================

-- -------------------------------------------------------
-- TABELA: ALUNOS 
-- Lógica: Staff Vê tudo NA escola; Aluno vê a si mesmo; Encarregado vê pelo telefone
-- -------------------------------------------------------

-- Removemos as políticas antigas fragmentadas
DROP POLICY IF EXISTS "alunos_select_own" ON public.alunos;
DROP POLICY IF EXISTS "alunos_select_proprio" ON public.alunos;
DROP POLICY IF EXISTS "alunos_select_staff" ON public.alunos;
DROP POLICY IF EXISTS "select_alunos_ativos_mesma_escola" ON public.alunos;
DROP POLICY IF EXISTS "alunos_select_unificado" ON public.alunos; -- Caso já tenha rodado a versão anterior

-- Criamos a política v3.1
CREATE POLICY "alunos_select_unificado" ON public.alunos
FOR SELECT
TO authenticated
USING (
  -- 1. É Staff da escola (Diretor, Secretaria, Prof)
  is_staff_escola(escola_id) 
  OR 
  -- 2. É o Usuário Final (Aluno ou Encarregado) verificando acesso
  (
    SELECT count(*) 
    FROM public.profiles p
    WHERE p.user_id = (select auth.uid()) -- OTIMIZAÇÃO: Cache do ID na transação
    AND (
       -- Cenário A: É o próprio aluno (Profile vinculado)
       p.user_id = alunos.profile_id
       OR
       -- Cenário B: É o Encarregado (Match pelo Telefone)
       -- Importante: O frontend deve garantir a formatação do telefone (ex: +244...)
       (p.role = 'encarregado' AND p.telefone = alunos.encarregado_telefone)
    )
  ) > 0
);

-- -------------------------------------------------------
-- TABELA: CLASSES (Mantido - Aprovado)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "select_own_classes" ON public.classes;
DROP POLICY IF EXISTS "classes_select_membro" ON public.classes;
DROP POLICY IF EXISTS "classes select membros escola" ON public.classes;

CREATE POLICY "classes_select_unificado" ON public.classes
FOR SELECT
TO authenticated
USING (
    escola_id IN (
        SELECT escola_id FROM profiles 
        WHERE user_id = (select auth.uid())
    )
);

-- -------------------------------------------------------
-- TABELA: TURMAS (Mantido - Aprovado)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "select_own_turmas" ON public.turmas;
DROP POLICY IF EXISTS "turmas_select_membro" ON public.turmas;
DROP POLICY IF EXISTS "turmas select membros escola" ON public.turmas;

CREATE POLICY "turmas_select_unificado" ON public.turmas
FOR SELECT
TO authenticated
USING (
    escola_id IN (
        SELECT escola_id FROM profiles 
        WHERE user_id = (select auth.uid())
    )
);

-- =================================================================
-- 3. LIMPEZA DE POLÍTICAS REDUNDANTES (Financeiro - Aprovado)
-- =================================================================

DROP POLICY IF EXISTS "financeiro_itens_select" ON public.financeiro_itens;
DROP POLICY IF EXISTS "financeiro_lancamentos_select" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "financeiro_tabelas_select" ON public.financeiro_tabelas;

COMMIT;