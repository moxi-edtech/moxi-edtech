DO $$
BEGIN

    -- =================================================================
    -- 1. CURSOS GLOBAIS (Correção de Sintaxe e Performance)
    -- =================================================================
    DROP POLICY IF EXISTS "Autenticados podem inserir" ON public.cursos_globais_cache;
    DROP POLICY IF EXISTS "Autenticados podem sugerir novos cursos" ON public.cursos_globais_cache;
    DROP POLICY IF EXISTS "AuthInsert" ON public.cursos_globais_cache;
    
    -- Remover política antiga otimizada se existir para recriar
    DROP POLICY IF EXISTS "cursos_globais_insert_opt" ON public.cursos_globais_cache;

    CREATE POLICY "cursos_globais_insert_opt" ON public.cursos_globais_cache
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Otimização: Cache da role (service_role ou authenticated)
        (select auth.role()) IN ('authenticated', 'service_role')
    );


    -- =================================================================
    -- 2. ALUNOS & ALUNOS EXCLUIDOS (Unificação Final)
    -- =================================================================
    -- Alunos (Lógica v3.1 já aplicada, reforçando limpeza de antigas)
    DROP POLICY IF EXISTS "alunos_select_own" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_select_proprio" ON public.alunos;
    DROP POLICY IF EXISTS "insert_alunos_mesma_escola" ON public.alunos;
    DROP POLICY IF EXISTS "update_alunos_mesma_escola" ON public.alunos;
    DROP POLICY IF EXISTS "select_alunos_ativos_mesma_escola" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_delete_own" ON public.alunos;
    
    -- Alunos Excluídos
    DROP POLICY IF EXISTS "select_alunos_excluidos" ON public.alunos_excluidos;
    DROP POLICY IF EXISTS "insert_alunos_excluidos_service" ON public.alunos_excluidos;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alunos_excluidos' AND policyname = 'alunos_excluidos_select_opt') THEN
        CREATE POLICY "alunos_excluidos_select_opt" ON public.alunos_excluidos
        FOR SELECT
        TO authenticated
        USING (
            escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid()))
        );
    END IF;


    -- =================================================================
    -- 3. ONBOARDING DRAFTS (Performance)
    -- =================================================================
    DROP POLICY IF EXISTS "unified_select_onboarding_drafts" ON public.onboarding_drafts;

    CREATE POLICY "onboarding_drafts_select_opt" ON public.onboarding_drafts
    FOR SELECT
    TO authenticated
    USING (
        user_id = (select auth.uid())
    );


    -- =================================================================
    -- 4. ESCOLA USERS (Performance)
    -- =================================================================
    DROP POLICY IF EXISTS "Usuarios veem suas proprias escolas" ON public.escola_users;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escola_users' AND policyname = 'escola_users_select_opt') THEN
        CREATE POLICY "escola_users_select_opt" ON public.escola_users
        FOR SELECT
        TO authenticated
        USING (
            user_id = (select auth.uid())
        );
    END IF;


    -- =================================================================
    -- 5. MENSALIDADES SUPER ADMIN
    -- =================================================================
    DROP POLICY IF EXISTS "Mensalidades - super admin" ON public.mensalidades;
    
    -- A política unificada 'tabelas_mens_unificado' (criada antes) já deve cobrir o acesso normal.
    -- Se precisar de acesso global para super admin:
    CREATE POLICY "mensalidades_super_admin_opt" ON public.mensalidades
    FOR ALL
    TO authenticated
    USING (
        (select auth.role()) = 'service_role' -- Ou super_admin logic
    );

END $$;