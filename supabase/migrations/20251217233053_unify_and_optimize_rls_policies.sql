BEGIN;

-- =================================================================
-- 1. ÍNDICE DUPLICADO (Financeiro)
-- =================================================================
-- A tabela financeiro_tabelas tem dois índices idênticos.
-- Vamos remover o redundante para acelerar INSERTs.
ALTER TABLE public.financeiro_tabelas DROP CONSTRAINT IF EXISTS financeiro_tabelas_unq_escola_ano_curso_classe;


-- =================================================================
-- 2. TABELA: MATRICULAS (Unificação & Otimização)
-- =================================================================
-- Removemos as 6 políticas antigas que estavam rodando ao mesmo tempo
DROP POLICY IF EXISTS "Tenant Isolation" ON public.matriculas;
DROP POLICY IF EXISTS "matriculas_select" ON public.matriculas;
DROP POLICY IF EXISTS "matriculas_select_membro" ON public.matriculas;
DROP POLICY IF EXISTS "matriculas_insert_staff" ON public.matriculas;
DROP POLICY IF EXISTS "matriculas_update_staff" ON public.matriculas;
DROP POLICY IF EXISTS "matriculas_delete_staff" ON public.matriculas;

-- Nova Política Unificada (Leitura)
-- Todo usuário autenticado daquela escola pode ver as matrículas (Staff e Alunos/Pais)
CREATE POLICY "matriculas_select_unificado" ON public.matriculas
FOR SELECT
TO authenticated
USING (
  -- Otimização: Cache do ID da escola
  escola_id IN (
      SELECT p.escola_id 
      FROM profiles p
      WHERE p.user_id = (select auth.uid()) -- Wrap para cache na transação
  )
);

-- Nova Política Unificada (Escrita - Apenas Staff)
CREATE POLICY "matriculas_write_staff" ON public.matriculas
FOR ALL
TO authenticated
USING (
  is_staff_escola(escola_id) 
  AND 
  escola_id IN (
      SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())
  )
)
WITH CHECK (
  is_staff_escola(escola_id)
);


-- =================================================================
-- 3. TABELA: NOTAS (Unificação)
-- =================================================================
DROP POLICY IF EXISTS "Tenant Isolation" ON public.notas;
DROP POLICY IF EXISTS "notas_select" ON public.notas;
DROP POLICY IF EXISTS "notas_manage" ON public.notas;

-- Leitura: Membros da escola podem ver notas (filtragem fina feita no frontend/query)
CREATE POLICY "notas_select_unificado" ON public.notas
FOR SELECT
TO authenticated
USING (
  escola_id IN (
      SELECT p.escola_id 
      FROM profiles p
      WHERE p.user_id = (select auth.uid())
  )
);

-- Escrita: Apenas Staff
CREATE POLICY "notas_write_staff" ON public.notas
FOR ALL
TO authenticated
USING (is_staff_escola(escola_id))
WITH CHECK (is_staff_escola(escola_id));


-- =================================================================
-- 4. TABELA: DISCIPLINAS (Resolução de 'auth_rls_initplan')
-- =================================================================
DROP POLICY IF EXISTS "Escola cria suas disciplinas" ON public.disciplinas;
DROP POLICY IF EXISTS "Escola vê suas disciplinas" ON public.disciplinas;
DROP POLICY IF EXISTS "Gerir Disciplinas" ON public.disciplinas;
DROP POLICY IF EXISTS "Ver Disciplinas" ON public.disciplinas;

CREATE POLICY "disciplinas_isolation_unificado" ON public.disciplinas
FOR ALL
TO authenticated
USING (
  escola_id IN (
      SELECT p.escola_id 
      FROM profiles p
      WHERE p.user_id = (select auth.uid()) -- Otimização Critical
  )
);


-- =================================================================
-- 5. TABELA: CURSOS (Unificação)
-- =================================================================
DROP POLICY IF EXISTS "Gerir Cursos" ON public.cursos;
DROP POLICY IF EXISTS "Ver Cursos" ON public.cursos;
DROP POLICY IF EXISTS "tenant_isolation" ON public.cursos;

CREATE POLICY "cursos_isolation_unificado" ON public.cursos
FOR ALL
TO authenticated
USING (
  escola_id IN (
      SELECT p.escola_id 
      FROM profiles p
      WHERE p.user_id = (select auth.uid())
  )
);


-- =================================================================
-- 6. TABELA: CONFIGURACOES_ESCOLA & TABELAS_MENSALIDADE
-- =================================================================

-- Configurações Escola
DROP POLICY IF EXISTS "Tenant Isolation" ON public.configuracoes_escola;
DROP POLICY IF EXISTS "config_escola_select" ON public.configuracoes_escola;
DROP POLICY IF EXISTS "config_escola_manage" ON public.configuracoes_escola;

CREATE POLICY "config_escola_unificado" ON public.configuracoes_escola
FOR ALL
TO authenticated
USING (
  escola_id IN (
      SELECT p.escola_id 
      FROM profiles p
      WHERE p.user_id = (select auth.uid())
  )
);

-- Tabelas Mensalidade (Financeiro)
DROP POLICY IF EXISTS "TabelasMens - Tenant Isolation" ON public.tabelas_mensalidade;
DROP POLICY IF EXISTS "tabelas_mensalidade_select" ON public.tabelas_mensalidade;
DROP POLICY IF EXISTS "tabelas_mensalidade_manage" ON public.tabelas_mensalidade;

CREATE POLICY "tabelas_mens_unificado" ON public.tabelas_mensalidade
FOR ALL
TO authenticated
USING (
  escola_id IN (
      SELECT p.escola_id 
      FROM profiles p
      WHERE p.user_id = (select auth.uid())
  )
);

COMMIT;