DO $$
BEGIN

    -- =================================================================
    -- 1. NOTAS (Unificação)
    -- =================================================================
    -- Removemos antigas se existirem
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.notas;
    DROP POLICY IF EXISTS "notas_select" ON public.notas;
    DROP POLICY IF EXISTS "notas_manage" ON public.notas;

    -- Recriamos as novas apenas se não existirem
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notas' AND policyname = 'notas_select_unificado') THEN
        CREATE POLICY "notas_select_unificado" ON public.notas FOR SELECT TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notas' AND policyname = 'notas_write_staff') THEN
        CREATE POLICY "notas_write_staff" ON public.notas FOR ALL TO authenticated
        USING (is_staff_escola(escola_id)) WITH CHECK (is_staff_escola(escola_id));
    END IF;


    -- =================================================================
    -- 2. DISCIPLINAS (Resolução de initplan)
    -- =================================================================
    DROP POLICY IF EXISTS "Escola cria suas disciplinas" ON public.disciplinas;
    DROP POLICY IF EXISTS "Escola vê suas disciplinas" ON public.disciplinas;
    DROP POLICY IF EXISTS "Gerir Disciplinas" ON public.disciplinas;
    DROP POLICY IF EXISTS "Ver Disciplinas" ON public.disciplinas;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disciplinas' AND policyname = 'disciplinas_isolation_unificado') THEN
        CREATE POLICY "disciplinas_isolation_unificado" ON public.disciplinas FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;


    -- =================================================================
    -- 3. CURSOS & CACHE (Unificação)
    -- =================================================================
    DROP POLICY IF EXISTS "Gerir Cursos" ON public.cursos;
    DROP POLICY IF EXISTS "Ver Cursos" ON public.cursos;
    DROP POLICY IF EXISTS "tenant_isolation" ON public.cursos;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cursos' AND policyname = 'cursos_isolation_unificado') THEN
        CREATE POLICY "cursos_isolation_unificado" ON public.cursos FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;

    -- Cache Global
    DROP POLICY IF EXISTS "Autenticados podem inserir" ON public.cursos_globais_cache;
    DROP POLICY IF EXISTS "Autenticados podem sugerir novos cursos" ON public.cursos_globais_cache;
    DROP POLICY IF EXISTS "AuthInsert" ON public.cursos_globais_cache;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cursos_globais_cache' AND policyname = 'cursos_globais_insert_opt') THEN
        CREATE POLICY "cursos_globais_insert_opt" ON public.cursos_globais_cache FOR INSERT TO authenticated
        WITH CHECK ((select auth.role()) IN ('authenticated', 'service_role'));
    END IF;


    -- =================================================================
    -- 4. CONFIGURAÇÕES & FINANCEIRO (Limpeza Final)
    -- =================================================================
    -- Configurações Escola
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.configuracoes_escola;
    DROP POLICY IF EXISTS "config_escola_select" ON public.configuracoes_escola;
    DROP POLICY IF EXISTS "config_escola_manage" ON public.configuracoes_escola;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'configuracoes_escola' AND policyname = 'config_escola_unificado') THEN
        CREATE POLICY "config_escola_unificado" ON public.configuracoes_escola FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;

    -- Itens Financeiros
    DROP POLICY IF EXISTS "financeiro_itens_manage" ON public.financeiro_itens;
    DROP POLICY IF EXISTS "financeiro_itens_mutation" ON public.financeiro_itens;
    DROP POLICY IF EXISTS "financeiro_itens_select" ON public.financeiro_itens;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financeiro_itens' AND policyname = 'financeiro_itens_unificado') THEN
        CREATE POLICY "financeiro_itens_unificado" ON public.financeiro_itens FOR ALL TO authenticated
        USING (escola_id IN (SELECT p.escola_id FROM profiles p WHERE p.user_id = (select auth.uid())));
    END IF;

END $$;