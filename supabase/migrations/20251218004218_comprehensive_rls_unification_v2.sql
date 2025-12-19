BEGIN;

-- =================================================================
-- 1. LIMPEZA DE ÍNDICES DUPLICADOS
-- =================================================================
DROP INDEX IF EXISTS financeiro_tabelas_unq_escola_ano_curso_classe;

-- =================================================================
-- 2. BLOCO LÓGICO DE RLS (Usando DO $$ para evitar erros de duplicidade)
-- =================================================================
DO $$
BEGIN

    -- ----------------------------------------------------------------
    -- TABELA: ALUNOS (A mais crítica)
    -- ----------------------------------------------------------------
    -- Limpeza das antigas
    DROP POLICY IF EXISTS "alunos_delete" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_delete_staff" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_insert" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_insert_staff" ON public.alunos;
    DROP POLICY IF EXISTS "insert_alunos_mesma_escola" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_select" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_select_por_escola_ou_proprio" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_select_unificado" ON public.alunos; -- Removemos para recriar otimizado
    DROP POLICY IF EXISTS "alunos_update" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_update_staff" ON public.alunos;
    DROP POLICY IF EXISTS "update_alunos_mesma_escola" ON public.alunos;

    -- Recriação Unificada (Lógica v3.1: Staff, Próprio Aluno ou Encarregado via Telefone)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alunos' AND policyname = 'alunos_select_unificado_v2') THEN
        CREATE POLICY "alunos_select_unificado_v2" ON public.alunos FOR SELECT TO authenticated
        USING (
            is_staff_escola(escola_id) 
            OR 
            (SELECT count(*) FROM profiles p WHERE p.user_id = (select auth.uid()) AND (
                p.user_id = alunos.profile_id OR (p.role = 'encarregado' AND p.telefone = alunos.encarregado_telefone)
            )) > 0
        );
    END IF;

    -- Escrita para Alunos (Apenas Staff)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alunos' AND policyname = 'alunos_write_staff_v2') THEN
        CREATE POLICY "alunos_write_staff_v2" ON public.alunos FOR ALL TO authenticated
        USING (is_staff_escola(escola_id)) WITH CHECK (is_staff_escola(escola_id));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: ESCOLA_ADMINISTRADORES
    -- ----------------------------------------------------------------
    DROP POLICY IF EXISTS "escola_administradores_select" ON public.escola_administradores;
    DROP POLICY IF EXISTS "escola_administradores_manage" ON public.escola_administradores;
    DROP POLICY IF EXISTS "unified_delete_escola_administradores" ON public.escola_administradores;
    DROP POLICY IF EXISTS "unified_insert_escola_administradores" ON public.escola_administradores;
    DROP POLICY IF EXISTS "unified_select_escola_administradores" ON public.escola_administradores;
    DROP POLICY IF EXISTS "unified_update_escola_administradores" ON public.escola_administradores;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escola_administradores' AND policyname = 'escola_admins_unificado_v2') THEN
        CREATE POLICY "escola_admins_unificado_v2" ON public.escola_administradores FOR ALL TO authenticated
        USING (
            (select auth.role()) = 'service_role' OR escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid()))
        );
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: ESCOLA_USERS
    -- ----------------------------------------------------------------
    DROP POLICY IF EXISTS "Usuarios veem suas proprias escolas" ON public.escola_users;
    DROP POLICY IF EXISTS "escola_users_select" ON public.escola_users;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escola_users' AND policyname = 'escola_users_select_v2') THEN
        CREATE POLICY "escola_users_select_v2" ON public.escola_users FOR SELECT TO authenticated
        USING (user_id = (select auth.uid()));
    END IF;


    -- ----------------------------------------------------------------
    -- MÓDULO FINANCEIRO (Mensalidades, Títulos, Lançamentos, Itens)
    -- ----------------------------------------------------------------
    -- Mensalidades
    DROP POLICY IF EXISTS "mensalidades_select" ON public.mensalidades;
    DROP POLICY IF EXISTS "mensalidades_manage" ON public.mensalidades;
    DROP POLICY IF EXISTS "Mensalidades - Tenant Isolation" ON public.mensalidades;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mensalidades' AND policyname = 'mensalidades_unificado_v2') THEN
        CREATE POLICY "mensalidades_unificado_v2" ON public.mensalidades FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;

    -- Títulos
    DROP POLICY IF EXISTS "financeiro_titulos_select" ON public.financeiro_titulos;
    DROP POLICY IF EXISTS "financeiro_titulos_manage" ON public.financeiro_titulos;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financeiro_titulos' AND policyname = 'fin_titulos_unificado_v2') THEN
        CREATE POLICY "fin_titulos_unificado_v2" ON public.financeiro_titulos FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;

    -- Lançamentos
    DROP POLICY IF EXISTS "financeiro_lancamentos_select" ON public.financeiro_lancamentos;
    DROP POLICY IF EXISTS "financeiro_lancamentos_manage" ON public.financeiro_lancamentos;
    DROP POLICY IF EXISTS "financeiro_lancamentos_mutation" ON public.financeiro_lancamentos;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financeiro_lancamentos' AND policyname = 'fin_lancamentos_unificado_v2') THEN
        CREATE POLICY "fin_lancamentos_unificado_v2" ON public.financeiro_lancamentos FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;

    -- Itens
    DROP POLICY IF EXISTS "financeiro_itens_select" ON public.financeiro_itens;
    DROP POLICY IF EXISTS "financeiro_itens_manage" ON public.financeiro_itens;
    DROP POLICY IF EXISTS "financeiro_itens_mutation" ON public.financeiro_itens;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financeiro_itens' AND policyname = 'fin_itens_unificado_v2') THEN
        CREATE POLICY "fin_itens_unificado_v2" ON public.financeiro_itens FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: TURMAS
    -- ----------------------------------------------------------------
    DROP POLICY IF EXISTS "turmas delete membros escola" ON public.turmas;
    DROP POLICY IF EXISTS "turmas_delete_staff" ON public.turmas;
    DROP POLICY IF EXISTS "turmas_manage" ON public.turmas;
    DROP POLICY IF EXISTS "turmas insert membros escola" ON public.turmas;
    DROP POLICY IF EXISTS "turmas_insert_staff" ON public.turmas;
    DROP POLICY IF EXISTS "turmas_select" ON public.turmas;
    DROP POLICY IF EXISTS "turmas_select_unificado" ON public.turmas; -- Recriar
    DROP POLICY IF EXISTS "turmas update membros escola" ON public.turmas;
    DROP POLICY IF EXISTS "turmas_update_staff" ON public.turmas;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'turmas' AND policyname = 'turmas_unificado_v2') THEN
        CREATE POLICY "turmas_unificado_v2" ON public.turmas FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: CONFIGURACOES_ESCOLA
    -- ----------------------------------------------------------------
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.configuracoes_escola;
    DROP POLICY IF EXISTS "escola_configuracoes_manage" ON public.configuracoes_escola;
    DROP POLICY IF EXISTS "config_escola_manage" ON public.configuracoes_escola;
    DROP POLICY IF EXISTS "escola_configuracoes_select" ON public.configuracoes_escola;
    DROP POLICY IF EXISTS "config_escola_select" ON public.configuracoes_escola;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'configuracoes_escola' AND policyname = 'config_escola_unificado_v2') THEN
        CREATE POLICY "config_escola_unificado_v2" ON public.configuracoes_escola FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: AUDIT_LOGS
    -- ----------------------------------------------------------------
    DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_select_by_scope" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_select_v2') THEN
        CREATE POLICY "audit_logs_select_v2" ON public.audit_logs FOR SELECT TO authenticated
        USING (
            (select auth.role()) = 'service_role' OR
            escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())) OR
            (escola_id IS NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (select auth.uid()) AND p.role = 'super_admin'))
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_insert_v2') THEN
        CREATE POLICY "audit_logs_insert_v2" ON public.audit_logs FOR INSERT TO authenticated
        WITH CHECK ((select auth.uid()) IS NOT NULL);
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: CURSOS_GLOBAIS_CACHE
    -- ----------------------------------------------------------------
    DROP POLICY IF EXISTS "Autenticados podem inserir" ON public.cursos_globais_cache;
    DROP POLICY IF EXISTS "Autenticados podem sugerir novos cursos" ON public.cursos_globais_cache;
    DROP POLICY IF EXISTS "AuthInsert" ON public.cursos_globais_cache;
    DROP POLICY IF EXISTS "Cursos globais públicos para leitura" ON public.cursos_globais_cache;
    DROP POLICY IF EXISTS "Cursos globais são públicos para leitura" ON public.cursos_globais_cache;
    DROP POLICY IF EXISTS "Publico" ON public.cursos_globais_cache;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cursos_globais_cache' AND policyname = 'cursos_globais_read_v2') THEN
        CREATE POLICY "cursos_globais_read_v2" ON public.cursos_globais_cache FOR SELECT TO anon, authenticated
        USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cursos_globais_cache' AND policyname = 'cursos_globais_insert_v2') THEN
        CREATE POLICY "cursos_globais_insert_v2" ON public.cursos_globais_cache FOR INSERT TO authenticated
        WITH CHECK ((select auth.role()) IN ('authenticated', 'service_role'));
    END IF;

END $$;

COMMIT;