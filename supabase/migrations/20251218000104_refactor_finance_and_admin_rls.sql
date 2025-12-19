BEGIN;

-- =================================================================
-- 1. ADMINISTRADORES & ESCOLA_USERS
-- =================================================================

-- Tabela: escola_administradores
DROP POLICY IF EXISTS "escola_administradores_select" ON public.escola_administradores;
DROP POLICY IF EXISTS "escola_administradores_manage" ON public.escola_administradores;
DROP POLICY IF EXISTS "unified_delete_escola_administradores" ON public.escola_administradores;
DROP POLICY IF EXISTS "unified_insert_escola_administradores" ON public.escola_administradores;
DROP POLICY IF EXISTS "unified_select_escola_administradores" ON public.escola_administradores;
DROP POLICY IF EXISTS "unified_update_escola_administradores" ON public.escola_administradores;

-- Unificada: Admin Global ou da própria escola
CREATE POLICY "escola_admins_unificado" ON public.escola_administradores
FOR ALL
TO authenticated
USING (
    -- Super Admin (via role) OU Admin daquela escola
    (select auth.role()) = 'service_role'
    OR
    escola_id IN (
        SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())
    )
);

-- Tabela: escola_users
DROP POLICY IF EXISTS "Usuarios veem suas proprias escolas" ON public.escola_users;
DROP POLICY IF EXISTS "escola_users_select" ON public.escola_users;

CREATE POLICY "escola_users_select_opt" ON public.escola_users
FOR SELECT
TO authenticated
USING (
    user_id = (select auth.uid())
);


-- =================================================================
-- 2. MÓDULO FINANCEIRO (Limpeza Pesada)
-- =================================================================

-- Tabela: mensalidades
DROP POLICY IF EXISTS "mensalidades_select" ON public.mensalidades;
DROP POLICY IF EXISTS "mensalidades_manage" ON public.mensalidades;
DROP POLICY IF EXISTS "Mensalidades - Tenant Isolation" ON public.mensalidades;

CREATE POLICY "mensalidades_unificado_opt" ON public.mensalidades
FOR ALL
TO authenticated
USING (
    escola_id IN (
        SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())
    )
);

-- Tabela: financeiro_titulos
DROP POLICY IF EXISTS "financeiro_titulos_select" ON public.financeiro_titulos;
DROP POLICY IF EXISTS "financeiro_titulos_manage" ON public.financeiro_titulos;

CREATE POLICY "fin_titulos_unificado_opt" ON public.financeiro_titulos
FOR ALL
TO authenticated
USING (
    escola_id IN (
        SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())
    )
);

-- Tabela: financeiro_lancamentos
DROP POLICY IF EXISTS "financeiro_lancamentos_manage" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "financeiro_lancamentos_select" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "financeiro_lancamentos_mutation" ON public.financeiro_lancamentos;

CREATE POLICY "fin_lancamentos_unificado_opt" ON public.financeiro_lancamentos
FOR ALL
TO authenticated
USING (
    escola_id IN (
        SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())
    )
);

-- Tabela: financeiro_itens (Reforço)
DROP POLICY IF EXISTS "financeiro_itens_select" ON public.financeiro_itens;
DROP POLICY IF EXISTS "financeiro_itens_manage" ON public.financeiro_itens;
DROP POLICY IF EXISTS "financeiro_itens_mutation" ON public.financeiro_itens;

CREATE POLICY "fin_itens_unificado_opt" ON public.financeiro_itens
FOR ALL
TO authenticated
USING (
    escola_id IN (
        SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())
    )
);


-- =================================================================
-- 3. AUDIT LOGS & CACHE
-- =================================================================

-- Tabela: audit_logs
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_by_scope" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;

-- Leitura: Apenas logs da própria escola ou se for Super Admin
CREATE POLICY "audit_logs_select_opt" ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    -- Otimização: Check simples de role primeiro (Short-circuit evaluation)
    ((select auth.role()) = 'service_role')
    OR
    (escola_id IN (
        SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())
    ))
    OR
    (escola_id IS NULL AND EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.user_id = (select auth.uid()) AND p.role = 'super_admin'
    ))
);

-- Escrita: Qualquer autenticado pode gerar log
CREATE POLICY "audit_logs_insert_opt" ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
    (select auth.uid()) IS NOT NULL
);


-- =================================================================
-- 4. CLASSES (Otimização Final)
-- =================================================================
DROP POLICY IF EXISTS "delete_own_classes" ON public.classes;
DROP POLICY IF EXISTS "insert_own_classes" ON public.classes;
DROP POLICY IF EXISTS "update_own_classes" ON public.classes;
DROP POLICY IF EXISTS "select_own_classes" ON public.classes;
DROP POLICY IF EXISTS "classes select membros escola" ON public.classes;
-- Nota: Mantemos 'classes_select_unificado' se criado no passo anterior,
-- aqui criamos a de escrita unificada.

CREATE POLICY "classes_write_opt" ON public.classes
FOR ALL
TO authenticated
USING (
    escola_id IN (
        SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())
    )
);

COMMIT;