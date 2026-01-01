BEGIN;

-- =================================================================
-- Final RLS Policy Cleanup
-- This script aims to resolve all "Multiple Permissive Policies" warnings.
-- =================================================================

DO $$
BEGIN

    -- ----------------------------------------------------------------
    -- TABELA: alunos
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "alunos_write_staff_v2" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_select_unificado_v2" ON public.alunos;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alunos' AND policyname = 'alunos_select_unificado_v3') THEN
        CREATE POLICY "alunos_select_unificado_v3" ON public.alunos FOR SELECT TO authenticated
        USING (
            is_staff_escola(escola_id) 
            OR 
            (SELECT count(*) FROM profiles p WHERE p.user_id = (select auth.uid()) AND (
                p.user_id = alunos.profile_id OR (p.role = 'encarregado' AND p.telefone = alunos.encarregado_telefone)
            )) > 0
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alunos' AND policyname = 'alunos_write_staff_v3') THEN
        CREATE POLICY "alunos_write_staff_v3" ON public.alunos FOR ALL TO authenticated
        USING (is_staff_escola(escola_id)) WITH CHECK (is_staff_escola(escola_id));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: audit_logs
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "audit_logs_insert_opt" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_insert_v2" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_select_opt" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_select_v2" ON public.audit_logs;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_select_v3') THEN
        CREATE POLICY "audit_logs_select_v3" ON public.audit_logs FOR SELECT TO authenticated
        USING (
            (select auth.role()) = 'service_role' OR
            escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())) OR
            (escola_id IS NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = (select auth.uid()) AND p.role = 'super_admin'))
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_insert_v3') THEN
        CREATE POLICY "audit_logs_insert_v3" ON public.audit_logs FOR INSERT TO authenticated
        WITH CHECK ((select auth.uid()) IS NOT NULL);
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: classes
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "Gerir Classes" ON public.classes;
    DROP POLICY IF EXISTS "classes_delete_staff" ON public.classes;
    DROP POLICY IF EXISTS "classes_write_opt" ON public.classes;
    DROP POLICY IF EXISTS "classes_write_staff_opt" ON public.classes;
    DROP POLICY IF EXISTS "classes_insert_staff" ON public.classes;
    DROP POLICY IF EXISTS "Ver Classes" ON public.classes;
    DROP POLICY IF EXISTS "classes_select_unificado" ON public.classes;
    DROP POLICY IF EXISTS "classes_update_staff" ON public.classes;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'classes' AND policyname = 'classes_unificado_v3') THEN
        CREATE POLICY "classes_unificado_v3" ON public.classes FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: configuracoes_escola
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "config_escola_unificado" ON public.configuracoes_escola;
    DROP POLICY IF EXISTS "config_escola_unificado_v2" ON public.configuracoes_escola;
    DROP POLICY IF EXISTS "tenant_isolation" ON public.configuracoes_escola;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'configuracoes_escola' AND policyname = 'config_escola_unificado_v3') THEN
        CREATE POLICY "config_escola_unificado_v3" ON public.configuracoes_escola FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: cursos_globais_cache
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "cursos_globais_insert_opt" ON public.cursos_globais_cache;
    DROP POLICY IF EXISTS "cursos_globais_insert_v2" ON public.cursos_globais_cache;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cursos_globais_cache' AND policyname = 'cursos_globais_insert_v3') THEN
        CREATE POLICY "cursos_globais_insert_v3" ON public.cursos_globais_cache FOR INSERT TO authenticated
        WITH CHECK ((select auth.role()) IN ('authenticated', 'service_role'));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: disciplinas
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "disciplinas_isolation_opt" ON public.disciplinas;
    DROP POLICY IF EXISTS "disciplinas_isolation_unificado" ON public.disciplinas;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disciplinas' AND policyname = 'disciplinas_unificado_v3') THEN
        CREATE POLICY "disciplinas_unificado_v3" ON public.disciplinas FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: escola_administradores
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "escola_admins_unificado" ON public.escola_administradores;
    DROP POLICY IF EXISTS "escola_admins_unificado_v2" ON public.escola_administradores;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escola_administradores' AND policyname = 'escola_admins_unificado_v3') THEN
        CREATE POLICY "escola_admins_unificado_v3" ON public.escola_administradores FOR ALL TO authenticated
        USING ((select auth.role()) = 'service_role' OR escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: escola_configuracoes
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.escola_configuracoes;
    DROP POLICY IF EXISTS "escola_configuracoes_manage" ON public.escola_configuracoes;
    DROP POLICY IF EXISTS "escola_configuracoes_select" ON public.escola_configuracoes;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escola_configuracoes' AND policyname = 'escola_configuracoes_unificado_v3') THEN
        CREATE POLICY "escola_configuracoes_unificado_v3" ON public.escola_configuracoes FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: escola_users
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "escola_users_select_opt" ON public.escola_users;
    DROP POLICY IF EXISTS "escola_users_select_v2" ON public.escola_users;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escola_users' AND policyname = 'escola_users_select_v3') THEN
        CREATE POLICY "escola_users_select_v3" ON public.escola_users FOR SELECT TO authenticated
        USING (user_id = (select auth.uid()));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: financeiro_itens
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "fin_itens_unificado_opt" ON public.financeiro_itens;
    DROP POLICY IF EXISTS "fin_itens_unificado_v2" ON public.financeiro_itens;
    DROP POLICY IF EXISTS "financeiro_itens_unificado" ON public.financeiro_itens;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financeiro_itens' AND policyname = 'financeiro_itens_unificado_v3') THEN
        CREATE POLICY "financeiro_itens_unificado_v3" ON public.financeiro_itens FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: financeiro_lancamentos
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "fin_lancamentos_unificado_opt" ON public.financeiro_lancamentos;
    DROP POLICY IF EXISTS "fin_lancamentos_unificado_v2" ON public.financeiro_lancamentos;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financeiro_lancamentos' AND policyname = 'financeiro_lancamentos_unificado_v3') THEN
        CREATE POLICY "financeiro_lancamentos_unificado_v3" ON public.financeiro_lancamentos FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: financeiro_titulos
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "fin_titulos_unificado_opt" ON public.financeiro_titulos;
    DROP POLICY IF EXISTS "fin_titulos_unificado_v2" ON public.financeiro_titulos;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financeiro_titulos' AND policyname = 'financeiro_titulos_unificado_v3') THEN
        CREATE POLICY "financeiro_titulos_unificado_v3" ON public.financeiro_titulos FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: matriculas
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "matriculas_delete" ON public.matriculas;
    DROP POLICY IF EXISTS "matriculas_write_staff" ON public.matriculas;
    DROP POLICY IF EXISTS "matriculas_insert" ON public.matriculas;
    DROP POLICY IF EXISTS "matriculas_select_unificado" ON public.matriculas;
    DROP POLICY IF EXISTS "matriculas_update" ON public.matriculas;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matriculas' AND policyname = 'matriculas_select_v3') THEN
        CREATE POLICY "matriculas_select_v3" ON public.matriculas FOR SELECT TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matriculas' AND policyname = 'matriculas_write_v3') THEN
        CREATE POLICY "matriculas_write_v3" ON public.matriculas FOR ALL TO authenticated
        USING (is_staff_escola(escola_id)) WITH CHECK (is_staff_escola(escola_id));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: mensalidades
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "mensalidades_super_admin_opt" ON public.mensalidades;
    DROP POLICY IF EXISTS "mensalidades_unificado_opt" ON public.mensalidades;
    DROP POLICY IF EXISTS "mensalidades_unificado_v2" ON public.mensalidades;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mensalidades' AND policyname = 'mensalidades_unificado_v3') THEN
        CREATE POLICY "mensalidades_unificado_v3" ON public.mensalidades FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- ----------------------------------------------------------------
    -- TABELA: notas
    -- ----------------------------------------------------------------
    -- Drop redundant policies
    DROP POLICY IF EXISTS "notas_select_unificado" ON public.notas;
    DROP POLICY IF EXISTS "notas_write_staff" ON public.notas;

    -- Recreate unified policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notas' AND policyname = 'notas_select_v3') THEN
        CREATE POLICY "notas_select_v3" ON public.notas FOR SELECT TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notas' AND policyname = 'notas_write_v3') THEN
        CREATE POLICY "notas_write_v3" ON public.notas FOR ALL TO authenticated
        USING (is_staff_escola(escola_id)) WITH CHECK (is_staff_escola(escola_id));
    END IF;

END $$;

COMMIT;