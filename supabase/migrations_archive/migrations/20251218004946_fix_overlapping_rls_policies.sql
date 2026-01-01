BEGIN;

DO $$
BEGIN

    -- =================================================================
    -- 1. TABELA: ALUNOS (Separando para evitar erro de sintaxe)
    -- =================================================================
    -- Removemos a versão 'write' unificada que deu erro
    DROP POLICY IF EXISTS "alunos_write_staff_v3" ON public.alunos;

    -- Insert
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alunos' AND policyname = 'alunos_insert_staff_v3') THEN
        CREATE POLICY "alunos_insert_staff_v3" ON public.alunos FOR INSERT TO authenticated
        WITH CHECK (is_staff_escola(escola_id));
    END IF;

    -- Update
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alunos' AND policyname = 'alunos_update_staff_v3') THEN
        CREATE POLICY "alunos_update_staff_v3" ON public.alunos FOR UPDATE TO authenticated
        USING (is_staff_escola(escola_id)) WITH CHECK (is_staff_escola(escola_id));
    END IF;

    -- Delete
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alunos' AND policyname = 'alunos_delete_staff_v3') THEN
        CREATE POLICY "alunos_delete_staff_v3" ON public.alunos FOR DELETE TO authenticated
        USING (is_staff_escola(escola_id));
    END IF;


    -- =================================================================
    -- 2. TABELA: MATRICULAS
    -- =================================================================
    DROP POLICY IF EXISTS "matriculas_write_v3" ON public.matriculas;

    -- Insert
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matriculas' AND policyname = 'matriculas_insert_staff_v3') THEN
        CREATE POLICY "matriculas_insert_staff_v3" ON public.matriculas FOR INSERT TO authenticated
        WITH CHECK (is_staff_escola(escola_id));
    END IF;

    -- Update
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matriculas' AND policyname = 'matriculas_update_staff_v3') THEN
        CREATE POLICY "matriculas_update_staff_v3" ON public.matriculas FOR UPDATE TO authenticated
        USING (is_staff_escola(escola_id)) WITH CHECK (is_staff_escola(escola_id));
    END IF;

    -- Delete
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matriculas' AND policyname = 'matriculas_delete_staff_v3') THEN
        CREATE POLICY "matriculas_delete_staff_v3" ON public.matriculas FOR DELETE TO authenticated
        USING (is_staff_escola(escola_id));
    END IF;


    -- =================================================================
    -- 3. TABELA: NOTAS
    -- =================================================================
    DROP POLICY IF EXISTS "notas_write_v3" ON public.notas;

    -- Insert
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notas' AND policyname = 'notas_insert_staff_v3') THEN
        CREATE POLICY "notas_insert_staff_v3" ON public.notas FOR INSERT TO authenticated
        WITH CHECK (is_staff_escola(escola_id));
    END IF;

    -- Update
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notas' AND policyname = 'notas_update_staff_v3') THEN
        CREATE POLICY "notas_update_staff_v3" ON public.notas FOR UPDATE TO authenticated
        USING (is_staff_escola(escola_id)) WITH CHECK (is_staff_escola(escola_id));
    END IF;

    -- Delete
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notas' AND policyname = 'notas_delete_staff_v3') THEN
        CREATE POLICY "notas_delete_staff_v3" ON public.notas FOR DELETE TO authenticated
        USING (is_staff_escola(escola_id));
    END IF;

END $$;

COMMIT;